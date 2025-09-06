import { RawNews, NewsRegion } from '../entities/raw-news.entity';
import { BusinessLogger, LogCategory } from '../../../common/utils/business-logger.util';
import { NewsLink, NewsContent } from '../../../temporal/workflows/news/news.activities';

/**
 * 新闻文章数据接口
 */
export interface NewsArticleData {
  title: string;
  content: string;
  url: string;
  newsDate: string;
}

/**
 * 爬虫请求头接口
 */
export interface CrawlerHeaders {
  [key: string]: string;
}

/**
 * 抽象新闻爬虫服务类
 * 
 * 提供新闻爬取的基础功能和通用方法，支持实时落盘机制。
 * 
 * 核心特性:
 * - 实时落盘: 通过可选的saveNewsCallback参数，支持每获取一条新闻立即保存
 * - 容错性: 单条新闻获取失败不影响其他新闻的处理
 * - 异常隔离: 保存失败的新闻不会中断整个爬取流程  
 * - 统一日志: 使用BusinessLogger进行统一的日志记录
 */
export abstract class AbstractNewsCrawlerService {
  protected static readonly DELAY_MILLISECONDS = 1000;
  protected readonly businessLogger: BusinessLogger;

  constructor() {
    this.businessLogger = new BusinessLogger(this.constructor.name);
  }

  abstract getSourceCode(): string;

  abstract getBaseUrl(): string;
  
  abstract getSourceName(): string;
  
  abstract getRegion(): NewsRegion;

  /**
   * 获取需要跳过的新闻标题关键词
   */
  getNeedSkipNewsTitle(): string[] {
    return [];
  }

  /**
   * 获取指定日期的目标URL列表
   */
  abstract getTargetUrls(date: string): Promise<string[]>;

  /**
   * 获取请求头
   */
  protected getHeaders(): CrawlerHeaders {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    };
  }

  /**
   * 获取网页文档内容
   */
  abstract getDocument(url: string): Promise<any>;

  /**
   * 从文档中提取新闻标题
   */
  protected abstract extractTitle(document: any): string | null;

  /**
   * 从文档中提取新闻内容
   */
  protected abstract extractContent(document: any): string | null;

  /**
   * 爬取指定日期的新闻
   * @param date 爬取日期，格式: YYYY-MM-dd
   * @param saveNewsCallback 可选的保存回调函数，用于实时落盘每条获取到的新闻
   * @returns 爬取到的新闻列表
   */
  async crawlNews(date: string, saveNewsCallback?: (news: RawNews) => Promise<void>): Promise<RawNews[]> {
    const results: RawNews[] = [];
    const targetUrls = await this.getTargetUrls(date);
    
    for (const url of targetUrls) {
      try {
        const news = await this.crawlNewsFromUrl(url, date);
        if (news) {
          // 如果提供了保存回调，立即保存新闻
          if (saveNewsCallback) {
            try {
              await saveNewsCallback(news);
              this.businessLogger.debug(`Successfully saved news: ${news.title}`);
            } catch (saveError) {
              this.businessLogger.businessError('保存新闻数据', saveError, { 
                url: news.url, 
                title: news.title,
                date 
              });
            }
          }
          results.push(news);
        }
        await this.delay(AbstractNewsCrawlerService.DELAY_MILLISECONDS);
      } catch (error) {
        this.businessLogger.businessError('爬取新闻数据', error, { url, date });
      }
    }
    
    return results;
  }

  /**
   * 爬取指定日期范围的新闻
   * @param startDate 开始日期，格式: YYYY-MM-dd
   * @param endDate 结束日期，格式: YYYY-MM-dd
   * @param saveNewsCallback 可选的保存回调函数，用于实时落盘每条获取到的新闻
   * @returns 爬取到的新闻列表
   */
  async crawlNewsRange(startDate: string, endDate: string, saveNewsCallback?: (news: RawNews) => Promise<void>): Promise<RawNews[]> {
    const results: RawNews[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      try {
        const dayResults = await this.crawlNews(dateStr, saveNewsCallback);
        results.push(...dayResults);
        await this.delay(AbstractNewsCrawlerService.DELAY_MILLISECONDS);
      } catch (error) {
        this.businessLogger.businessError('爬取新闻数据', error, { 
          source: this.getSourceName(),
          date: dateStr 
        });
      }
    }
    
    return results;
  }

  /**
   * 从URL爬取并创建新闻对象
   */
  protected async crawlNewsFromUrl(url: string, date: string): Promise<RawNews | null> {
    try {
      const document = await this.getDocument(url);
      const title = this.extractTitle(document);
      const content = this.extractContent(document);

      if (!title || !content) {
        this.businessLogger.warn(LogCategory.SERVICE_ERROR, 'Could not find title or content', url, { title, content, url });
        return null;
      }

      const news = new RawNews();
      news.title = title;
      news.content = content;
      news.url = url;
      news.sourceCode = this.getSourceCode();
      news.sourceName = this.getSourceName();
      news.newsDate = date;
      news.analyzed = false;
      news.region = this.getRegion();

      if (this.shouldSkipNews(news)) {
        this.businessLogger.debug(LogCategory.SERVICE_INFO, `Skipping news with title: ${news.title}`);
        return null;
      }

      return news;
    } catch (error) {
      this.businessLogger.businessError('爬取新闻内容', error, { url, date });
      return null;
    }
  }

  /**
   * 判断是否需要跳过该新闻
   */
  protected shouldSkipNews(news: RawNews): boolean {
    if (!news.title || !news.content) {
      return true;
    }
    
    const skipTitles = this.getNeedSkipNewsTitle();
    if (skipTitles.length === 0) {
      return false;
    }
    
    return skipTitles.some(skipTitle => news.title.includes(skipTitle));
  }

  /**
   * 延迟执行
   */
  protected delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  // ============================================================================
  // 新的粒度化方法（可选实现，用于支持Temporal子工作流）
  // ============================================================================

  /**
   * 获取指定日期的新闻链接列表（可选实现）
   * 如果不实现此方法，将使用 crawlNews 的回退机制
   */
  async getNewsLinks?(date: string): Promise<NewsLink[]>;

  /**
   * 爬取单个新闻的详细内容（可选实现）  
   * 如果不实现此方法，将返回错误
   */
  async crawlSingleNews?(newsLink: NewsLink): Promise<NewsContent>;
}