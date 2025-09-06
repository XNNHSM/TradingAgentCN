/**
 * 新闻爬取相关 Temporal 活动
 * 实现具体的业务逻辑，作为工作流中的原子操作
 */

import { Injectable } from '@nestjs/common';
import { NewsService } from '../../../modules/news/news.service';
import { NewsSource } from '../../../modules/news/interfaces/news-crawler-factory.interface';
import { BusinessLogger } from '../../../common/utils/business-logger.util';
import { DateTimeUtil } from '../../../common/utils/date-time.util';

// 单个数据源爬取结果
export interface SourceCrawlResult {
  success: boolean;
  count: number;
  source: string;
  message?: string;
}

// 工作流摘要输入
export interface WorkflowSummaryInput {
  date: string;
  totalCrawled: number;
  successSources: number;
  failedSources: number;
  results: Record<string, number>;
  duration: string;
}

// 新闻链接信息
export interface NewsLink {
  url: string;
  title?: string;
  publishTime?: string;
  id?: string;
}

// 单个新闻内容
export interface NewsContent {
  title: string;
  content: string;
  url: string;
  publishTime?: string;
  source: string;
}

// 新闻摘要生成结果
export interface NewsSummaryResult {
  newsId: number;
  title: string;
  summary: string;
  newsDate: string;
}

// 数据持久化结果
export interface PersistenceResult {
  success: boolean;
  count: number;
  message?: string;
}

// 新闻活动接口定义（扩展后的粒度化活动）
export interface NewsActivities {
  // 原有活动（兼容性保留）
  getSupportedSources(): Promise<string[]>;
  validateDate(date: string): Promise<void>;
  crawlNewsFromSource(source: string, date: string): Promise<SourceCrawlResult>;
  getWorkflowSummary(input: WorkflowSummaryInput): Promise<string>;
  
  // 新的粒度化活动
  getNewsLinks(source: string, date: string): Promise<NewsLink[]>;
  crawlSingleNews(newsLink: NewsLink, source: string): Promise<NewsContent>;
  persistNewsData(newsContent: NewsContent[]): Promise<PersistenceResult>;
  generateNewsSummary(newsContent: NewsContent): Promise<NewsSummaryResult>;
  persistSummaryData(summaries: NewsSummaryResult[]): Promise<PersistenceResult>;
}

/**
 * 新闻活动实现类
 */
@Injectable()
export class NewsActivitiesImpl implements NewsActivities {
  private readonly businessLogger = new BusinessLogger(NewsActivitiesImpl.name);

  constructor(private readonly newsService: NewsService) {}

  /**
   * 获取支持的新闻源列表
   */
  async getSupportedSources(): Promise<string[]> {
    try {
      this.businessLogger.serviceInfo('获取支持的新闻源列表');
      
      const result = this.newsService.getSupportedSources();
      
      if (result.code !== 0) {
        throw new Error(`获取新闻源失败: ${result.message}`);
      }

      const sources = result.data;
      this.businessLogger.serviceInfo(`支持的新闻源: ${sources.join(', ')}`);
      
      return sources;
    } catch (error) {
      this.businessLogger.serviceError('获取支持的新闻源失败', error);
      throw error;
    }
  }

  /**
   * 验证日期格式
   */
  async validateDate(date: string): Promise<void> {
    try {
      this.businessLogger.serviceInfo(`验证日期格式: ${date}`);
      
      if (!DateTimeUtil.isValidDateFormat(date)) {
        throw new Error(`无效的日期格式: ${date}，期望格式为 YYYY-MM-dd`);
      }

      // 检查日期是否过于久远或未来
      const targetDate = DateTimeUtil.parseDate(date);
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (targetDate < oneYearAgo) {
        throw new Error(`日期过于久远: ${date}，超出一年范围`);
      }

      if (targetDate > tomorrow) {
        throw new Error(`日期不能为未来: ${date}`);
      }

      this.businessLogger.serviceInfo(`日期验证通过: ${date}`);
    } catch (error) {
      this.businessLogger.serviceError(`日期验证失败: ${date}`, error);
      throw error;
    }
  }

  /**
   * 从指定数据源爬取新闻
   */
  async crawlNewsFromSource(source: string, date: string): Promise<SourceCrawlResult> {
    try {
      this.businessLogger.serviceInfo(`开始爬取 ${source} 的新闻数据`, { source, date });
      
      const crawlResult = await this.newsService.crawlNews(source as NewsSource, date);
      
      if (crawlResult.code === 0) {
        const count = crawlResult.data.length;
        
        this.businessLogger.serviceInfo(
          `${source} 爬取成功: 获取 ${count} 条新闻`,
          { source, date, count }
        );
        
        return {
          success: true,
          count,
          source,
          message: `成功爬取 ${count} 条新闻`,
        };
      } else {
        this.businessLogger.serviceError(
          `${source} 爬取失败: ${crawlResult.message}`,
          new Error(crawlResult.message),
          { source, date }
        );
        
        return {
          success: false,
          count: 0,
          source,
          message: crawlResult.message,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.businessLogger.serviceError(
        `${source} 爬取异常`,
        error,
        { source, date }
      );
      
      return {
        success: false,
        count: 0,
        source,
        message: errorMessage,
      };
    }
  }

  /**
   * 生成工作流执行摘要
   */
  async getWorkflowSummary(input: WorkflowSummaryInput): Promise<string> {
    const {
      date,
      totalCrawled,
      successSources,
      failedSources,
      results,
      duration,
    } = input;

    try {
      this.businessLogger.serviceInfo('生成工作流执行摘要', {
        date,
        totalCrawled,
        successSources,
        failedSources,
        duration,
      });

      const totalSources = successSources + failedSources;
      const successRate = totalSources > 0 ? Math.round((successSources / totalSources) * 100) : 0;

      // 构建详细的结果摘要
      const resultDetails = Object.entries(results)
        .map(([source, count]) => `${source}: ${count}条`)
        .join(', ');

      const summary = [
        `新闻爬取任务完成 (${date})`,
        `执行时间: ${duration}`,
        `总爬取新闻: ${totalCrawled}条`,
        `成功数据源: ${successSources}/${totalSources} (${successRate}%)`,
        `详细结果: ${resultDetails}`,
      ].join(' | ');

      this.businessLogger.serviceInfo('工作流摘要生成完成', { summary });

      return summary;
    } catch (error) {
      this.businessLogger.serviceError('生成工作流摘要失败', error);
      return `摘要生成失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // ============================================================================
  // 新的粒度化活动实现
  // ============================================================================

  /**
   * 获取指定数据源和日期的新闻链接列表
   */
  async getNewsLinks(source: string, date: string): Promise<NewsLink[]> {
    try {
      this.businessLogger.serviceInfo(`获取 ${source} 的新闻链接列表`, { source, date });
      
      // 调用新闻服务获取链接列表
      const result = await this.newsService.getNewsLinks(source as NewsSource, date);
      
      if (result.code === 0) {
        const links = result.data as NewsLink[];
        this.businessLogger.serviceInfo(
          `${source} 链接获取成功: 找到 ${links.length} 个新闻链接`,
          { source, date, count: links.length }
        );
        return links;
      } else {
        this.businessLogger.serviceError(
          `${source} 链接获取失败: ${result.message}`,
          new Error(result.message),
          { source, date }
        );
        return [];
      }
    } catch (error) {
      this.businessLogger.serviceError(
        `${source} 链接获取异常`,
        error,
        { source, date }
      );
      return [];
    }
  }

  /**
   * 爬取单个新闻的详细内容
   */
  async crawlSingleNews(newsLink: NewsLink, source: string): Promise<NewsContent> {
    try {
      this.businessLogger.serviceInfo(
        `爬取单个新闻: ${newsLink.title || newsLink.url}`,
        { source, url: newsLink.url }
      );
      
      // 调用新闻服务爬取单个新闻
      const result = await this.newsService.crawlSingleNewsContent(newsLink, source as NewsSource);
      
      if (result.code === 0) {
        const content = result.data as NewsContent;
        this.businessLogger.serviceInfo(
          `单个新闻爬取成功: ${content.title}`,
          { source, url: newsLink.url, titleLength: content.title.length, contentLength: content.content.length }
        );
        return content;
      } else {
        this.businessLogger.serviceError(
          `单个新闻爬取失败: ${result.message}`,
          new Error(result.message),
          { source, url: newsLink.url }
        );
        throw new Error(`爬取新闻失败: ${result.message}`);
      }
    } catch (error) {
      this.businessLogger.serviceError(
        `单个新闻爬取异常: ${newsLink.url}`,
        error,
        { source, url: newsLink.url }
      );
      throw error;
    }
  }

  /**
   * 将新闻内容批量保存到数据库
   */
  async persistNewsData(newsContent: NewsContent[]): Promise<PersistenceResult> {
    try {
      this.businessLogger.serviceInfo(
        `批量保存新闻数据: ${newsContent.length} 条`,
        { count: newsContent.length }
      );
      
      // 调用新闻服务批量保存
      const result = await this.newsService.batchSaveNewsContent(newsContent);
      
      if (result.code === 0) {
        const savedCount = result.data as number;
        this.businessLogger.serviceInfo(
          `新闻数据保存成功: ${savedCount} 条`,
          { requestedCount: newsContent.length, savedCount }
        );
        return {
          success: true,
          count: savedCount,
          message: `成功保存 ${savedCount} 条新闻`,
        };
      } else {
        this.businessLogger.serviceError(
          `新闻数据保存失败: ${result.message}`,
          new Error(result.message),
          { count: newsContent.length }
        );
        return {
          success: false,
          count: 0,
          message: result.message,
        };
      }
    } catch (error) {
      this.businessLogger.serviceError(
        '新闻数据保存异常',
        error,
        { count: newsContent.length }
      );
      return {
        success: false,
        count: 0,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 使用LLM为单个新闻生成摘要
   */
  async generateNewsSummary(newsContent: NewsContent): Promise<NewsSummaryResult> {
    try {
      this.businessLogger.serviceInfo(
        `生成新闻摘要: ${newsContent.title}`,
        { source: newsContent.source, url: newsContent.url }
      );
      
      // 调用新闻服务生成摘要
      const result = await this.newsService.generateNewsContentSummary(newsContent);
      
      if (result.code === 0) {
        const summary = result.data as NewsSummaryResult;
        this.businessLogger.serviceInfo(
          `新闻摘要生成成功: ${summary.title}`,
          { newsId: summary.newsId, summaryLength: summary.summary.length }
        );
        return summary;
      } else {
        this.businessLogger.serviceError(
          `新闻摘要生成失败: ${result.message}`,
          new Error(result.message),
          { title: newsContent.title, url: newsContent.url }
        );
        throw new Error(`摘要生成失败: ${result.message}`);
      }
    } catch (error) {
      this.businessLogger.serviceError(
        `新闻摘要生成异常: ${newsContent.title}`,
        error,
        { source: newsContent.source, url: newsContent.url }
      );
      throw error;
    }
  }

  /**
   * 将新闻摘要批量保存到数据库
   */
  async persistSummaryData(summaries: NewsSummaryResult[]): Promise<PersistenceResult> {
    try {
      this.businessLogger.serviceInfo(
        `批量保存新闻摘要: ${summaries.length} 条`,
        { count: summaries.length }
      );
      
      // 调用新闻服务批量保存摘要
      const result = await this.newsService.batchSaveNewsSummaries(summaries);
      
      if (result.code === 0) {
        const savedCount = result.data as number;
        this.businessLogger.serviceInfo(
          `新闻摘要保存成功: ${savedCount} 条`,
          { requestedCount: summaries.length, savedCount }
        );
        return {
          success: true,
          count: savedCount,
          message: `成功保存 ${savedCount} 条摘要`,
        };
      } else {
        this.businessLogger.serviceError(
          `新闻摘要保存失败: ${result.message}`,
          new Error(result.message),
          { count: summaries.length }
        );
        return {
          success: false,
          count: 0,
          message: result.message,
        };
      }
    } catch (error) {
      this.businessLogger.serviceError(
        '新闻摘要保存异常',
        error,
        { count: summaries.length }
      );
      return {
        success: false,
        count: 0,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}