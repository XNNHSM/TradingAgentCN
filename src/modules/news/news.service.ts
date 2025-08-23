import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawNews } from './entities/raw-news.entity';
import { CreateNewsDto, UpdateNewsDto, QueryNewsDto } from './dto/news.dto';
import { CrawlNewsDto } from './dto/crawl-news.dto';
import { NewsCrawlerFactory } from './factories/news-crawler.factory';
import { NewsSource } from './interfaces/news-crawler-factory.interface';
import { Result } from '../../common/dto/result.dto';
import { BusinessLogger } from '../../common/utils/business-logger.util';

@Injectable()
export class NewsService {
  private readonly businessLogger = new BusinessLogger(NewsService.name);

  constructor(
    @InjectRepository(RawNews)
    private readonly rawNewsRepository: Repository<RawNews>,
    private readonly newsCrawlerFactory: NewsCrawlerFactory,
  ) {}

  /**
   * 创建新闻记录
   */
  async create(createNewsDto: CreateNewsDto): Promise<Result<RawNews>> {
    try {
      const news = this.rawNewsRepository.create(createNewsDto);
      const savedNews = await this.rawNewsRepository.save(news);
      
      this.businessLogger.serviceInfo(`Created news: ${savedNews.title}`);
      
      return Result.success(savedNews);
    } catch (error) {
      this.businessLogger.serviceError(`Error creating news: ${error.message}`, error);
      return Result.error('创建新闻失败');
    }
  }

  /**
   * 批量创建新闻记录
   */
  async createBatch(newsItems: CreateNewsDto[]): Promise<Result<RawNews[]>> {
    try {
      const newsEntities = newsItems.map(item => this.rawNewsRepository.create(item));
      const savedNews = await this.rawNewsRepository.save(newsEntities);
      
      this.businessLogger.serviceInfo(`Created ${savedNews.length} news items`, { count: savedNews.length });
      
      return Result.success(savedNews);
    } catch (error) {
      this.businessLogger.serviceError(`Error creating batch news: ${error.message}`, error);
      return Result.error('批量创建新闻失败');
    }
  }

  /**
   * 查询新闻列表
   */
  async findAll(queryDto: QueryNewsDto): Promise<Result<{ items: RawNews[]; total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean }>> {
    try {
      const { sourceCode, startDate, endDate, analyzed, region, page = 1, limit = 20 } = queryDto;
      
      const query = this.rawNewsRepository.createQueryBuilder('news');
      
      if (sourceCode) {
        query.andWhere('news.sourceCode = :sourceCode', { sourceCode });
      }
      
      if (startDate && endDate) {
        query.andWhere('news.newsDate BETWEEN :startDate AND :endDate', { startDate, endDate });
      } else if (startDate) {
        query.andWhere('news.newsDate >= :startDate', { startDate });
      } else if (endDate) {
        query.andWhere('news.newsDate <= :endDate', { endDate });
      }
      
      if (analyzed !== undefined) {
        query.andWhere('news.analyzed = :analyzed', { analyzed });
      }
      
      if (region) {
        query.andWhere('news.region = :region', { region });
      }
      
      query
        .orderBy('news.newsDate', 'DESC')
        .addOrderBy('news.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);
      
      const [items, total] = await query.getManyAndCount();
      const totalPages = Math.ceil(total / limit);
      
      return Result.success({
        items,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      });
    } catch (error) {
      this.businessLogger.serviceError(`Error querying news: ${error.message}`, error);
      return Result.error('查询新闻失败');
    }
  }

  /**
   * 根据ID查找新闻
   */
  async findOne(id: number): Promise<Result<RawNews>> {
    try {
      const news = await this.rawNewsRepository.findOne({ where: { id } });
      
      if (!news) {
        return Result.error('新闻不存在');
      }
      
      return Result.success(news);
    } catch (error) {
      this.businessLogger.serviceError(`Error finding news by id ${id}: ${error.message}`, error, { id });
      return Result.error('查询新闻失败');
    }
  }

  /**
   * 更新新闻
   */
  async update(id: number, updateNewsDto: UpdateNewsDto): Promise<Result<RawNews>> {
    try {
      const news = await this.rawNewsRepository.findOne({ where: { id } });
      
      if (!news) {
        return Result.error('新闻不存在');
      }
      
      Object.assign(news, updateNewsDto);
      const updatedNews = await this.rawNewsRepository.save(news);
      
      this.businessLogger.serviceInfo(`Updated news: ${updatedNews.title}`, { id });
      
      return Result.success(updatedNews);
    } catch (error) {
      this.businessLogger.serviceError(`Error updating news ${id}: ${error.message}`, error, { id });
      return Result.error('更新新闻失败');
    }
  }

  /**
   * 删除新闻（软删除）
   */
  async remove(id: number): Promise<Result<void>> {
    try {
      const result = await this.rawNewsRepository.softDelete(id);
      
      if (result.affected === 0) {
        return Result.error('新闻不存在');
      }
      
      this.businessLogger.serviceInfo(`Deleted news with id: ${id}`, { id });
      
      return Result.success(null);
    } catch (error) {
      this.businessLogger.serviceError(`Error deleting news ${id}: ${error.message}`, error, { id });
      return Result.error('删除新闻失败');
    }
  }

  /**
   * 将 RawNews 实体转换为 CreateNewsDto
   */
  private convertToCreateDto(newsItem: RawNews): CreateNewsDto {
    return {
      title: newsItem.title,
      content: newsItem.content,
      url: newsItem.url,
      sourceCode: newsItem.sourceCode,
      sourceName: newsItem.sourceName,
      newsDate: newsItem.newsDate,
      analyzed: newsItem.analyzed,
      region: newsItem.region,
    };
  }

  /**
   * 爬取指定新闻源的新闻
   */
  async crawlNews(source: NewsSource, date: string): Promise<Result<RawNews[]>> {
    try {
      if (!this.newsCrawlerFactory.isSourceSupported(source)) {
        return Result.error(`不支持的新闻源: ${source}`);
      }
      
      const crawler = this.newsCrawlerFactory.createCrawler(source);
      const savedNews: RawNews[] = [];
      
      // 创建保存回调函数，在每获取一条新闻后立即落盘
      const saveNewsCallback = async (newsItem: RawNews): Promise<void> => {
        // 检查是否已存在相同URL的新闻
        const existing = await this.rawNewsRepository.findOne({ 
          where: { url: newsItem.url } 
        });
        
        if (!existing) {
          // 转换为 CreateNewsDto 并调用 create 方法
          const createDto = this.convertToCreateDto(newsItem);
          const createResult = await this.create(createDto);
          
          if (createResult.code === 0) {
            savedNews.push(createResult.data);
            this.businessLogger.debug(`Immediately saved news: ${newsItem.title}`);
          } else {
            this.businessLogger.serviceError(`Failed to create news: ${newsItem.title}`, undefined, {
              url: newsItem.url,
              title: newsItem.title,
              error: createResult.message,
              source,
              date
            });
            throw new Error(`Failed to save news: ${createResult.message}`);
          }
        } else {
          this.businessLogger.debug(`News already exists, skipping: ${newsItem.title}`);
        }
      };
      
      // 使用回调函数进行实时落盘的爬取
      const newsItems = await crawler.crawlNews(date, saveNewsCallback);
      
      this.businessLogger.serviceInfo(`Crawled and saved ${savedNews.length} news items from ${source}`, {
        count: savedNews.length,
        totalCrawled: newsItems.length,
        source,
        date
      });
      
      return Result.success(savedNews);
    } catch (error) {
      this.businessLogger.businessError(`爬取新闻数据`, error, { source, date });
      return Result.error('爬取新闻失败');
    }
  }

  /**
   * 爬取指定新闻源的日期范围新闻
   */
  async crawlNewsRange(source: NewsSource, startDate: string, endDate: string): Promise<Result<RawNews[]>> {
    try {
      if (!this.newsCrawlerFactory.isSourceSupported(source)) {
        return Result.error(`不支持的新闻源: ${source}`);
      }
      
      const crawler = this.newsCrawlerFactory.createCrawler(source);
      const savedNews: RawNews[] = [];
      
      // 创建保存回调函数，在每获取一条新闻后立即落盘
      const saveNewsCallback = async (newsItem: RawNews): Promise<void> => {
        // 检查是否已存在相同URL的新闻
        const existing = await this.rawNewsRepository.findOne({ 
          where: { url: newsItem.url } 
        });
        
        if (!existing) {
          // 转换为 CreateNewsDto 并调用 create 方法
          const createDto = this.convertToCreateDto(newsItem);
          const createResult = await this.create(createDto);
          
          if (createResult.code === 0) {
            savedNews.push(createResult.data);
            this.businessLogger.debug(`Immediately saved news: ${newsItem.title}`);
          } else {
            this.businessLogger.serviceError(`Failed to create news: ${newsItem.title}`, undefined, {
              url: newsItem.url,
              title: newsItem.title,
              error: createResult.message,
              source,
              date: newsItem.newsDate
            });
            throw new Error(`Failed to save news: ${createResult.message}`);
          }
        } else {
          this.businessLogger.debug(`News already exists, skipping: ${newsItem.title}`);
        }
      };
      
      // 使用回调函数进行实时落盘的爬取
      const newsItems = await crawler.crawlNewsRange(startDate, endDate, saveNewsCallback);
      
      this.businessLogger.serviceInfo(`Crawled and saved ${savedNews.length} news items from ${source} (${startDate} to ${endDate})`, {
        count: savedNews.length,
        totalCrawled: newsItems.length,
        source,
        startDate,
        endDate
      });
      
      return Result.success(savedNews);
    } catch (error) {
      this.businessLogger.businessError(`爬取新闻数据范围`, error, { source, startDate, endDate });
      return Result.error('爬取新闻失败');
    }
  }

  /**
   * 启动爬取任务（异步执行，不等待结果）
   */
  startCrawlingTask(crawlDto: CrawlNewsDto): void {
    const { startDate, endDate, sources } = crawlDto;
    
    // 获取目标数据源
    const targetSources = sources && sources.length > 0 
      ? sources 
      : this.newsCrawlerFactory.getSupportedSources();

    this.businessLogger.serviceInfo(`启动新闻爬取任务: sources=${targetSources.join(', ')}, dateRange=${startDate}~${endDate}`, {
      sources: targetSources,
      startDate,
      endDate
    });

    // 异步执行爬取任务，不阻塞接口响应
    this.performCrawling(crawlDto).catch(error => {
      this.businessLogger.businessError(`新闻爬取任务执行`, error);
    });
  }

  /**
   * 执行实际的爬取工作（内部方法）
   */
  private async performCrawling(crawlDto: CrawlNewsDto): Promise<void> {
    try {
      const { startDate, endDate, sources } = crawlDto;
      
      // 获取目标数据源
      const targetSources = sources && sources.length > 0 
        ? sources 
        : this.newsCrawlerFactory.getSupportedSources();

      let totalCrawled = 0;

      this.businessLogger.serviceInfo(`开始执行新闻爬取: sources=${targetSources.join(', ')}, dateRange=${startDate}~${endDate}`, {
        sources: targetSources,
        startDate,
        endDate
      });

      // 并发爬取所有数据源
      const crawlPromises = targetSources.map(async (source) => {
        try {
          const result = await this.crawlNewsRange(source, startDate, endDate);
          
          if (result.code === 0) {
            const count = result.data.length;
            totalCrawled += count;
            
            this.businessLogger.serviceInfo(`数据源 ${source} 爬取完成: ${count} 条新闻`, {
              source,
              count
            });
          } else {
            this.businessLogger.serviceError(`数据源 ${source} 爬取失败: ${result.message}`, undefined, {
              source,
              error: result.message
            });
          }
        } catch (error) {
          this.businessLogger.businessError(`数据源爬取异常`, error, { source });
        }
      });

      // 等待所有爬取任务完成
      await Promise.all(crawlPromises);

      this.businessLogger.serviceInfo(`新闻爬取任务完成，共爬取 ${totalCrawled} 条新闻`, {
        totalCrawled
      });
    } catch (error) {
      this.businessLogger.businessError(`新闻爬取任务执行异常`, error);
      throw error;
    }
  }

  /**
   * 获取支持的新闻源
   */
  getSupportedSources(): Result<NewsSource[]> {
    const sources = this.newsCrawlerFactory.getSupportedSources();
    return Result.success(sources);
  }
}