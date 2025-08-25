/**
 * 新闻 Temporal 调度服务
 * 替代原有的 Cron 调度器，使用 Temporal Schedule 进行定时任务管理
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsTemporalClientService } from '../temporal/news-temporal-client.service';
import { BusinessLogger } from '../../../common/utils/business-logger.util';

@Injectable()
export class NewsTemporalSchedulerService implements OnModuleInit {
  private readonly businessLogger = new BusinessLogger(NewsTemporalSchedulerService.name);

  constructor(
    private readonly newsTemporalClient: NewsTemporalClientService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 模块初始化时启动定时调度
   */
  async onModuleInit(): Promise<void> {
    try {
      // 检查是否启用定时调度
      const schedulerEnabled = this.configService.get('NEWS_SCHEDULER_ENABLED', 'true') === 'true';
      
      if (!schedulerEnabled) {
        this.businessLogger.serviceInfo('新闻定时调度被禁用，跳过启动');
        return;
      }

      // 创建每日新闻爬取定时调度
      await this.createDailyNewsSchedule();
      
    } catch (error) {
      this.businessLogger.serviceError('启动新闻定时调度失败', error);
      // 不抛出错误，避免影响整个应用启动
    }
  }

  /**
   * 创建每日新闻爬取定时调度
   */
  async createDailyNewsSchedule(): Promise<void> {
    try {
      this.businessLogger.serviceInfo('创建每日新闻爬取定时调度');

      await this.newsTemporalClient.createDailyNewsSchedule({
        scheduleId: `daily-news-crawling-${this.configService.get('NODE_ENV', 'dev')}`,
        cronExpression: '0 1 * * *', // 每天凌晨1点
        timeZone: 'Asia/Shanghai',
        memo: '每日新闻爬取定时任务 - 由 Temporal Schedule 管理',
      });

      this.businessLogger.serviceInfo('每日新闻爬取定时调度创建成功');
    } catch (error) {
      // 如果调度已存在，记录信息但不抛出错误
      if (error instanceof Error && error.message.includes('already exists')) {
        this.businessLogger.serviceInfo('每日新闻爬取定时调度已存在，跳过创建');
      } else {
        this.businessLogger.serviceError('创建每日新闻爬取定时调度失败', error);
        throw error;
      }
    }
  }

  /**
   * 手动触发昨日新闻爬取
   */
  async triggerYesterdayNewsCrawl(): Promise<{
    success: boolean;
    workflowId: string;
    message: string;
  }> {
    try {
      this.businessLogger.serviceInfo('手动触发昨日新闻爬取任务');

      const result = await this.newsTemporalClient.triggerYesterdayNewsCrawl();

      if (result.success) {
        this.businessLogger.serviceInfo('手动触发昨日新闻爬取任务成功', {
          workflowId: result.workflowId,
        });
      } else {
        this.businessLogger.serviceError(
          '手动触发昨日新闻爬取任务失败',
          new Error(result.message),
          { workflowId: result.workflowId }
        );
      }

      return result;
    } catch (error) {
      this.businessLogger.serviceError('手动触发昨日新闻爬取任务异常', error);
      return {
        success: false,
        workflowId: '',
        message: `触发失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 获取定时任务状态
   */
  async getScheduleStatus(): Promise<{
    taskName: string;
    namespace: string;
    taskQueue: string;
    scheduleId: string;
    description: string;
    nextRunTime?: Date;
    recentActions?: Array<{ result: string; startTime: Date; endTime?: Date }>;
  }> {
    try {
      const environment = this.configService.get('NODE_ENV', 'dev');
      const scheduleStatus = await this.newsTemporalClient.getScheduleStatus();

      return {
        taskName: 'daily-news-crawling',
        namespace: `news-${environment}`,
        taskQueue: `news-crawling-${environment}`,
        scheduleId: scheduleStatus.scheduleId,
        description: '每天凌晨1点执行新闻爬取任务 - 由 Temporal Schedule 管理',
        nextRunTime: scheduleStatus.nextRunTime,
        recentActions: scheduleStatus.recentActions,
      };
    } catch (error) {
      this.businessLogger.serviceError('获取定时任务状态失败', error);
      
      // 返回默认状态信息
      const environment = this.configService.get('NODE_ENV', 'dev');
      return {
        taskName: 'daily-news-crawling',
        namespace: `news-${environment}`,
        taskQueue: `news-crawling-${environment}`,
        scheduleId: `daily-news-crawling-${environment}`,
        description: '每天凌晨1点执行新闻爬取任务 - 由 Temporal Schedule 管理',
      };
    }
  }

  /**
   * 重新创建定时调度
   */
  async recreateSchedule(): Promise<void> {
    try {
      this.businessLogger.serviceInfo('重新创建新闻定时调度');

      // 先删除现有调度
      await this.newsTemporalClient.deleteSchedule();
      
      // 等待一秒确保删除完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 重新创建调度
      await this.createDailyNewsSchedule();

      this.businessLogger.serviceInfo('重新创建新闻定时调度成功');
    } catch (error) {
      this.businessLogger.serviceError('重新创建新闻定时调度失败', error);
      throw error;
    }
  }

  /**
   * 删除定时调度
   */
  async deleteSchedule(): Promise<void> {
    try {
      this.businessLogger.serviceInfo('删除新闻定时调度');

      await this.newsTemporalClient.deleteSchedule();

      this.businessLogger.serviceInfo('删除新闻定时调度成功');
    } catch (error) {
      this.businessLogger.serviceError('删除新闻定时调度失败', error);
      throw error;
    }
  }

  /**
   * 检查工作流执行结果
   */
  async getWorkflowResult(workflowId: string): Promise<{
    success: boolean;
    date: string;
    totalCrawled: number;
    successSources: number;
    failedSources: number;
    results: Record<string, number>;
    duration: string;
    message: string;
  }> {
    try {
      this.businessLogger.serviceInfo('获取工作流执行结果', { workflowId });

      const result = await this.newsTemporalClient.getWorkflowResult(workflowId);

      this.businessLogger.serviceInfo('工作流执行结果获取成功', {
        workflowId,
        success: result.success,
        totalCrawled: result.totalCrawled,
      });

      return result;
    } catch (error) {
      this.businessLogger.serviceError('获取工作流执行结果失败', error, { workflowId });
      throw error;
    }
  }

  /**
   * 获取工作流状态
   */
  async getWorkflowStatus(workflowId: string): Promise<{
    status: string;
    runId: string;
    startTime?: Date;
    endTime?: Date;
  }> {
    try {
      this.businessLogger.serviceInfo('获取工作流状态', { workflowId });

      const status = await this.newsTemporalClient.getWorkflowStatus(workflowId);

      this.businessLogger.serviceInfo('工作流状态获取成功', {
        workflowId,
        status: status.status,
      });

      return status;
    } catch (error) {
      this.businessLogger.serviceError('获取工作流状态失败', error, { workflowId });
      throw error;
    }
  }
}