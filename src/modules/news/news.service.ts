import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawNews } from './entities/raw-news.entity';
import { CreateNewsDto, UpdateNewsDto, QueryNewsDto } from './dto/news.dto';
import { CrawlNewsDto } from './dto/crawl-news.dto';
import { NewsCrawlerFactory } from './factories/news-crawler.factory';
import { NewsSource } from './interfaces/news-crawler-factory.interface';
import { Result } from '../../common/dto/result.dto';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

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
      
      this.logger.log(JSON.stringify({
        category: 'SERVICE_INFO',
        message: `Created news: ${savedNews.title}`,
        url: ''
      }));
      
      return Result.success(savedNews);
    } catch (error) {
      this.logger.error(JSON.stringify({
        category: 'SERVICE_ERROR',
        message: `Error creating news: ${error.message}`,
        url: ''
      }));
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
      
      this.logger.log(JSON.stringify({
        category: 'SERVICE_INFO',
        message: `Created ${savedNews.length} news items`,
        url: ''
      }));
      
      return Result.success(savedNews);
    } catch (error) {
      this.logger.error(JSON.stringify({
        category: 'SERVICE_ERROR',
        message: `Error creating batch news: ${error.message}`,
        url: ''
      }));
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
      this.logger.error(JSON.stringify({
        category: 'SERVICE_ERROR',
        message: `Error querying news: ${error.message}`,
        url: ''
      }));
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
      this.logger.error(JSON.stringify({
        category: 'SERVICE_ERROR',
        message: `Error finding news by id ${id}: ${error.message}`,
        url: ''
      }));
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
      
      this.logger.log(JSON.stringify({
        category: 'SERVICE_INFO',
        message: `Updated news: ${updatedNews.title}`,
        url: ''
      }));
      
      return Result.success(updatedNews);
    } catch (error) {
      this.logger.error(JSON.stringify({
        category: 'SERVICE_ERROR',
        message: `Error updating news ${id}: ${error.message}`,
        url: ''
      }));
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
      
      this.logger.log(JSON.stringify({
        category: 'SERVICE_INFO',
        message: `Deleted news with id: ${id}`,
        url: ''
      }));
      
      return Result.success(null);
    } catch (error) {
      this.logger.error(JSON.stringify({
        category: 'SERVICE_ERROR',
        message: `Error deleting news ${id}: ${error.message}`,
        url: ''
      }));
      return Result.error('删除新闻失败');
    }
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
      const newsItems = await crawler.crawlNews(date);
      
      if (newsItems.length === 0) {
        this.logger.log(JSON.stringify({
          category: 'SERVICE_INFO',
          message: `No news found for ${source} on ${date}`,
          url: ''
        }));
        return Result.success([]);
      }
      
      // 保存新闻到数据库
      const savedNews: RawNews[] = [];
      for (const newsItem of newsItems) {
        try {
          const existing = await this.rawNewsRepository.findOne({ 
            where: { url: newsItem.url } 
          });
          
          if (!existing) {
            const saved = await this.rawNewsRepository.save(newsItem);
            savedNews.push(saved);
          }
        } catch (error) {
          this.logger.error(JSON.stringify({
            category: 'SERVICE_ERROR',
            message: `Error saving news: ${newsItem.title} - ${error.message}`,
            url: newsItem.url
          }));
        }
      }
      
      this.logger.log(JSON.stringify({
        category: 'SERVICE_INFO',
        message: `Crawled and saved ${savedNews.length} news items from ${source}`,
        url: ''
      }));
      
      return Result.success(savedNews);
    } catch (error) {
      this.logger.error(JSON.stringify({
        category: 'SERVICE_ERROR',
        message: `Error crawling news from ${source}: ${error.message}`,
        url: ''
      }));
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
      const newsItems = await crawler.crawlNewsRange(startDate, endDate);
      
      if (newsItems.length === 0) {
        this.logger.log(JSON.stringify({
          category: 'SERVICE_INFO',
          message: `No news found for ${source} between ${startDate} and ${endDate}`,
          url: ''
        }));
        return Result.success([]);
      }
      
      // 保存新闻到数据库
      const savedNews: RawNews[] = [];
      for (const newsItem of newsItems) {
        try {
          const existing = await this.rawNewsRepository.findOne({ 
            where: { url: newsItem.url } 
          });
          
          if (!existing) {
            const saved = await this.rawNewsRepository.save(newsItem);
            savedNews.push(saved);
          }
        } catch (error) {
          this.logger.error(JSON.stringify({
            category: 'SERVICE_ERROR',
            message: `Error saving news: ${newsItem.title} - ${error.message}`,
            url: newsItem.url
          }));
        }
      }
      
      this.logger.log(JSON.stringify({
        category: 'SERVICE_INFO',
        message: `Crawled and saved ${savedNews.length} news items from ${source} (${startDate} to ${endDate})`,
        url: ''
      }));
      
      return Result.success(savedNews);
    } catch (error) {
      this.logger.error(JSON.stringify({
        category: 'SERVICE_ERROR',
        message: `Error crawling news range from ${source}: ${error.message}`,
        url: ''
      }));
      return Result.error('爬取新闻失败');
    }
  }

  /**
   * 爬取新闻数据（支持多数据源和日期范围）
   */
  async crawlNewsWithSources(crawlDto: CrawlNewsDto): Promise<Result<{
    totalCrawled: number;
    sourceResults: {
      source: NewsSource;
      count: number;
      success: boolean;
      error?: string;
    }[];
  }>> {
    try {
      const { startDate, endDate, sources } = crawlDto;
      
      // 如果没有指定数据源，则使用所有支持的数据源
      const targetSources = sources && sources.length > 0 
        ? sources 
        : this.newsCrawlerFactory.getSupportedSources();

      const sourceResults: {
        source: NewsSource;
        count: number;
        success: boolean;
        error?: string;
      }[] = [];
      
      let totalCrawled = 0;

      this.logger.log(JSON.stringify({
        category: 'SERVICE_INFO',
        message: `Starting news crawl for sources: ${targetSources.join(', ')} from ${startDate} to ${endDate}`,
        url: ''
      }));

      // 并发爬取所有数据源
      const crawlPromises = targetSources.map(async (source) => {
        try {
          const result = await this.crawlNewsRange(source, startDate, endDate);
          
          if (result.code === 0) {
            const count = result.data.length;
            totalCrawled += count;
            sourceResults.push({
              source,
              count,
              success: true
            });
            
            this.logger.log(JSON.stringify({
              category: 'SERVICE_INFO',
              message: `Successfully crawled ${count} news from ${source}`,
              url: ''
            }));
          } else {
            sourceResults.push({
              source,
              count: 0,
              success: false,
              error: result.message
            });
            
            this.logger.error(JSON.stringify({
              category: 'SERVICE_ERROR',
              message: `Failed to crawl news from ${source}: ${result.message}`,
              url: ''
            }));
          }
        } catch (error) {
          sourceResults.push({
            source,
            count: 0,
            success: false,
            error: error.message
          });
          
          this.logger.error(JSON.stringify({
            category: 'SERVICE_ERROR',
            message: `Error crawling news from ${source}: ${error.message}`,
            url: ''
          }));
        }
      });

      // 等待所有爬取任务完成
      await Promise.all(crawlPromises);

      this.logger.log(JSON.stringify({
        category: 'SERVICE_INFO',
        message: `Completed news crawl. Total crawled: ${totalCrawled} news items`,
        url: ''
      }));

      return Result.success({
        totalCrawled,
        sourceResults
      });
    } catch (error) {
      this.logger.error(JSON.stringify({
        category: 'SERVICE_ERROR',
        message: `Error in crawlNewsWithSources: ${error.message}`,
        url: ''
      }));
      return Result.error('爬取新闻失败');
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