/**
 * 新闻爬取相关 Temporal 活动
 * 实现具体的业务逻辑，作为工作流中的原子操作
 */

import { Injectable } from '@nestjs/common';
import { NewsService } from '../news.service';
import { NewsSource } from '../interfaces/news-crawler-factory.interface';
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

// 新闻活动接口定义
export interface NewsActivities {
  getSupportedSources(): Promise<string[]>;
  validateDate(date: string): Promise<void>;
  crawlNewsFromSource(source: string, date: string): Promise<SourceCrawlResult>;
  getWorkflowSummary(input: WorkflowSummaryInput): Promise<string>;
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
}