import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NewsService } from '../news.service';
import { NewsSource } from '../interfaces/news-crawler-factory.interface';
import { BusinessLogger } from '../../../common/utils/business-logger.util';

/**
 * 新闻定时任务服务
 * 负责定时抓取各数据源的新闻数据
 */
@Injectable()
export class NewsSchedulerService {
  private readonly businessLogger = new BusinessLogger(NewsSchedulerService.name);

  constructor(private readonly newsService: NewsService) {}

  /**
   * 每天凌晨1点执行新闻爬取任务
   * 爬取前一天的所有数据源新闻
   */
  @Cron('0 1 * * *', {
    name: 'daily-news-crawl',
    timeZone: 'Asia/Shanghai',
  })
  async handleDailyNewsCrawl(): Promise<void> {
    this.businessLogger.serviceInfo('开始执行每日新闻爬取定时任务');

    try {
      // 获取前一天的日期
      const yesterday = this.getYesterdayDate();
      this.businessLogger.serviceInfo(`爬取日期: ${yesterday}`);

      // 获取所有支持的新闻源
      const supportedSourcesResult = this.newsService.getSupportedSources();
      
      if (supportedSourcesResult.code !== 0) {
        this.businessLogger.serviceError('获取支持的新闻源失败', new Error(supportedSourcesResult.message));
        return;
      }

      const sources = supportedSourcesResult.data;
      this.businessLogger.serviceInfo(`支持的新闻源: ${sources.join(', ')}`);

      // 统计信息
      let totalCrawled = 0;
      let successCount = 0;
      let failedCount = 0;
      const results: Record<string, number> = {};

      // 依次爬取每个数据源的新闻
      for (const source of sources) {
        try {
          this.businessLogger.serviceInfo(`开始爬取 ${source} 的新闻数据`);
          
          const crawlResult = await this.newsService.crawlNews(source, yesterday);
          
          if (crawlResult.code === 0) {
            const newsCount = crawlResult.data.length;
            results[source] = newsCount;
            totalCrawled += newsCount;
            successCount++;
            
            this.businessLogger.serviceInfo(
              `${source} 爬取成功: 获取 ${newsCount} 条新闻`
            );
          } else {
            results[source] = 0;
            failedCount++;
            
            this.businessLogger.serviceError(
              `${source} 爬取失败: ${crawlResult.message}`,
              new Error(crawlResult.message)
            );
          }
        } catch (error) {
          results[source] = 0;
          failedCount++;
          
          this.businessLogger.serviceError(
            `${source} 爬取异常`,
            error,
            { source, date: yesterday }
          );
        }

        // 在不同数据源之间添加延迟，避免过于频繁的请求
        await this.sleep(2000); // 2秒延迟
      }

      // 记录任务完成情况
      this.businessLogger.serviceInfo(
        '每日新闻爬取任务完成',
        {
          date: yesterday,
          totalCrawled,
          successSources: successCount,
          failedSources: failedCount,
          results,
        }
      );

    } catch (error) {
      this.businessLogger.businessError('每日新闻爬取任务', error);
    }
  }

  /**
   * 手动触发昨日新闻爬取（用于测试或补漏）
   */
  async triggerYesterdayNewsCrawl(): Promise<{
    success: boolean;
    message: string;
    results: Record<string, number>;
  }> {
    this.businessLogger.serviceInfo('手动触发昨日新闻爬取任务');

    try {
      const yesterday = this.getYesterdayDate();
      const supportedSourcesResult = this.newsService.getSupportedSources();
      
      if (supportedSourcesResult.code !== 0) {
        return {
          success: false,
          message: '获取支持的新闻源失败',
          results: {},
        };
      }

      const sources = supportedSourcesResult.data;
      const results: Record<string, number> = {};
      let totalCrawled = 0;

      for (const source of sources) {
        try {
          const crawlResult = await this.newsService.crawlNews(source, yesterday);
          
          if (crawlResult.code === 0) {
            const newsCount = crawlResult.data.length;
            results[source] = newsCount;
            totalCrawled += newsCount;
          } else {
            results[source] = 0;
          }
        } catch (error) {
          results[source] = 0;
          this.businessLogger.serviceError(`手动爬取 ${source} 失败`, error);
        }

        await this.sleep(1000); // 1秒延迟
      }

      return {
        success: true,
        message: `成功爬取 ${totalCrawled} 条新闻`,
        results,
      };

    } catch (error) {
      this.businessLogger.businessError('手动新闻爬取任务', error);
      return {
        success: false,
        message: `爬取失败: ${error.message}`,
        results: {},
      };
    }
  }

  /**
   * 获取昨天的日期字符串 (YYYY-MM-dd格式)
   */
  private getYesterdayDate(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    return yesterday.toISOString().split('T')[0]; // YYYY-MM-dd 格式
  }

  /**
   * 异步延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取定时任务状态
   */
  getScheduleStatus(): {
    taskName: string;
    cronExpression: string;
    timeZone: string;
    description: string;
    nextRunDate?: string;
  } {
    return {
      taskName: 'daily-news-crawl',
      cronExpression: '0 1 * * *',
      timeZone: 'Asia/Shanghai',
      description: '每天凌晨1点执行新闻爬取任务',
      nextRunDate: this.getNextRunTime(),
    };
  }

  /**
   * 获取下次运行时间
   */
  private getNextRunTime(): string {
    const now = new Date();
    const nextRun = new Date();
    
    // 设置为明天凌晨1点
    nextRun.setDate(now.getDate() + 1);
    nextRun.setHours(1, 0, 0, 0);
    
    // 如果当前时间还没到今天凌晨1点，则下次运行是今天凌晨1点
    const todayOne = new Date();
    todayOne.setHours(1, 0, 0, 0);
    
    if (now < todayOne) {
      nextRun.setDate(now.getDate());
    }
    
    return nextRun.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  }
}