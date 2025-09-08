/**
 * 智能分析 Temporal 调度服务
 * 替代原有的 Cron 调度器，使用 Temporal Schedule 进行定时任务管理
 * 负责新闻爬取、摘要生成和股票分析的定时调度
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsTemporalClientService } from './news-temporal-client.service';
import { BusinessLogger } from '../../../common/utils/business-logger.util';

@Injectable()
export class IntelligentAnalysisSchedulerService implements OnModuleInit {
  private readonly businessLogger = new BusinessLogger(IntelligentAnalysisSchedulerService.name);

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
      const schedulerEnabled = this.configService.get('INTELLIGENT_ANALYSIS_SCHEDULER_ENABLED', 'true') === 'true';
      
      if (!schedulerEnabled) {
        this.businessLogger.serviceInfo('智能分析定时调度被禁用，跳过启动');
        return;
      }

      // 创建每日智能分析定时调度
      await this.createDailyIntelligentAnalysisSchedule();
      
    } catch (error) {
      this.businessLogger.serviceError('启动智能分析定时调度失败', error);
      // 不抛出错误，避免影响整个应用启动
    }
  }

  /**
   * 创建每日智能分析定时调度
   */
  async createDailyIntelligentAnalysisSchedule(): Promise<void> {
    try {
      this.businessLogger.serviceInfo('创建每日智能分析定时调度');

      await this.newsTemporalClient.createDailyNewsSchedule({
        scheduleId: `daily-intelligent-analysis-${this.configService.get('NODE_ENV', 'dev')}`,
        cronExpression: '0 1 * * *', // 每天凌晨1点
        timeZone: 'Asia/Shanghai',
        memo: '每日智能分析定时任务 - 由 Temporal Schedule 管理',
      });

      this.businessLogger.serviceInfo('每日智能分析定时调度创建成功');
    } catch (error) {
      // 如果调度已存在，记录信息但不抛出错误
      if (error instanceof Error && (
        error.message.includes('already exists') || 
        error.message.includes('Schedule already exists and is running')
      )) {
        this.businessLogger.serviceInfo('每日智能分析定时调度已存在，跳过创建', {
          scheduleId: `daily-intelligent-analysis-${this.configService.get('NODE_ENV', 'dev')}`,
          errorMessage: error.message
        });
      } else {
        this.businessLogger.serviceError('创建每日智能分析定时调度失败', error);
        throw error;
      }
    }
  }

  /**
   * 启动基于日期范围的新闻爬取工作流 (新增)
   */
  async startNewsRangeCrawlWorkflow(
    startDate: string,
    endDate: string,
    sources?: string[]
  ): Promise<{
    success: boolean;
    workflowId: string;
    message: string;
  }> {
    try {
      this.businessLogger.serviceInfo('启动日期范围新闻爬取工作流', {
        startDate,
        endDate,
        sources: sources || '所有支持的数据源'
      });

      // 计算日期范围内的所有日期
      const dates = this.generateDateRange(startDate, endDate);
      const workflowId = `range-news-crawling-${startDate}-to-${endDate}-${Date.now()}`;

      // 为每个日期启动独立的工作流
      const workflowPromises = dates.map(async (date) => {
        const dateWorkflowId = `${workflowId}-${date}`;
        return await this.newsTemporalClient.startNewsCrawlingWorkflow(
          {
            date,
            sources
          },
          dateWorkflowId
        );
      });

      // 启动所有工作流（并发执行）
      const workflows = await Promise.all(workflowPromises);

      this.businessLogger.serviceInfo('日期范围新闻爬取工作流启动成功', {
        startDate,
        endDate,
        totalDays: dates.length,
        workflowCount: workflows.length,
        mainWorkflowId: workflowId
      });

      return {
        success: true,
        workflowId,
        message: `成功启动 ${dates.length} 个日期的新闻爬取工作流 (${startDate} 至 ${endDate})`
      };
    } catch (error) {
      this.businessLogger.serviceError('启动日期范围新闻爬取工作流失败', error, {
        startDate,
        endDate,
        sources
      });
      return {
        success: false,
        workflowId: '',
        message: `启动失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 手动触发昨日智能分析任务
   */
  async triggerYesterdayIntelligentAnalysis(): Promise<{
    success: boolean;
    workflowId: string;
    message: string;
  }> {
    try {
      this.businessLogger.serviceInfo('手动触发昨日智能分析任务');

      const result = await this.newsTemporalClient.triggerYesterdayNewsCrawl();

      if (result.success) {
        this.businessLogger.serviceInfo('手动触发昨日智能分析任务成功', {
          workflowId: result.workflowId,
        });
      } else {
        this.businessLogger.serviceError(
          '手动触发昨日智能分析任务失败',
          new Error(result.message),
          { workflowId: result.workflowId }
        );
      }

      return result;
    } catch (error) {
      this.businessLogger.serviceError('手动触发昨日智能分析任务异常', error);
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
        taskName: 'daily-intelligent-analysis',
        namespace: `intelligent-analysis-${environment}`,
        taskQueue: `news-crawling-${environment}`,
        scheduleId: scheduleStatus.scheduleId,
        description: '每天凌晨1点执行智能分析任务 - 由 Temporal Schedule 管理',
        nextRunTime: scheduleStatus.nextRunTime,
        recentActions: scheduleStatus.recentActions,
      };
    } catch (error) {
      this.businessLogger.serviceError('获取定时任务状态失败', error);
      
      // 返回默认状态信息
      const environment = this.configService.get('NODE_ENV', 'dev');
      return {
        taskName: 'daily-intelligent-analysis',
        namespace: `intelligent-analysis-${environment}`,
        taskQueue: `news-crawling-${environment}`,
        scheduleId: `daily-intelligent-analysis-${environment}`,
        description: '每天凌晨1点执行智能分析任务 - 由 Temporal Schedule 管理',
      };
    }
  }

  /**
   * 重新创建定时调度
   */
  async recreateSchedule(): Promise<void> {
    try {
      this.businessLogger.serviceInfo('重新创建智能分析定时调度');

      // 先删除现有调度
      await this.newsTemporalClient.deleteSchedule();
      
      // 等待一秒确保删除完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 重新创建调度
      await this.createDailyIntelligentAnalysisSchedule();

      this.businessLogger.serviceInfo('重新创建智能分析定时调度成功');
    } catch (error) {
      this.businessLogger.serviceError('重新创建智能分析定时调度失败', error);
      throw error;
    }
  }

  /**
   * 删除定时调度
   */
  async deleteSchedule(): Promise<void> {
    try {
      this.businessLogger.serviceInfo('删除智能分析定时调度');

      await this.newsTemporalClient.deleteSchedule();

      this.businessLogger.serviceInfo('删除智能分析定时调度成功');
    } catch (error) {
      this.businessLogger.serviceError('删除智能分析定时调度失败', error);
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
        totalCrawled: result.totalCrawledNews,
      });

      // 转换新结果格式到旧格式（向后兼容）
      return {
        success: result.success,
        date: result.date,
        totalCrawled: result.totalCrawledNews,
        successSources: result.successfulSources,
        failedSources: result.failedSources,
        results: this.convertSourceResultsToLegacyFormat(result.sourceResults),
        duration: result.duration,
        message: result.message,
      };
    } catch (error) {
      this.businessLogger.serviceError('获取工作流执行结果失败', error, { workflowId });
      throw error;
    }
  }

  /**
   * 生成日期范围内的所有日期数组
   */
  private generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    // 验证日期格式和范围
    if (current > end) {
      throw new Error('开始日期不能晚于结束日期');
    }

    const daysDiff = Math.ceil((end.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      throw new Error('日期范围不能超过30天');
    }

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * 将新的源结果格式转换为旧的格式（向后兼容）
   */
  private convertSourceResultsToLegacyFormat(sourceResults: Record<string, any>): Record<string, number> {
    const legacyResults: Record<string, number> = {};
    for (const [source, result] of Object.entries(sourceResults)) {
      legacyResults[source] = (result as any).savedNews || 0;
    }
    return legacyResults;
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

  /**
   * 获取日期范围爬取进度 (新增)
   */
  async getRangeCrawlProgress(mainWorkflowId: string): Promise<{
    mainWorkflowId: string;
    totalDays: number;
    completedDays: number;
    runningDays: number;
    failedDays: number;
    overallProgress: number;
    dailyStatus: Array<{
      date: string;
      workflowId: string;
      status: string;
      startTime?: Date;
      endTime?: Date;
    }>;
    summary: string;
  }> {
    try {
      this.businessLogger.serviceInfo('获取日期范围爬取进度', { mainWorkflowId });

      // 从 mainWorkflowId 中解析日期范围
      const workflowIdPattern = /range-news-crawling-(\d{4}-\d{2}-\d{2})-to-(\d{4}-\d{2}-\d{2})-\d+/;
      const match = mainWorkflowId.match(workflowIdPattern);
      
      if (!match) {
        throw new Error('无效的主工作流ID格式');
      }

      const [, startDate, endDate] = match;
      const dates = this.generateDateRange(startDate, endDate);

      // 获取每个日期的工作流状态
      const dailyStatusPromises = dates.map(async (date) => {
        const dateWorkflowId = `${mainWorkflowId}-${date}`;
        try {
          const status = await this.newsTemporalClient.getWorkflowStatus(dateWorkflowId);
          return {
            date,
            workflowId: dateWorkflowId,
            status: status.status,
            startTime: status.startTime,
            endTime: status.endTime,
          };
        } catch (error) {
          // 如果某个工作流状态获取失败，标记为未知状态
          this.businessLogger.serviceError('获取单日工作流状态失败', error, { dateWorkflowId });
          return {
            date,
            workflowId: dateWorkflowId,
            status: 'UNKNOWN',
            startTime: undefined,
            endTime: undefined,
          };
        }
      });

      const dailyStatus = await Promise.all(dailyStatusPromises);

      // 统计各状态数量
      const completedDays = dailyStatus.filter(s => s.status === 'COMPLETED').length;
      const runningDays = dailyStatus.filter(s => ['RUNNING', 'WORKFLOW_TASK_SCHEDULED'].includes(s.status)).length;
      const failedDays = dailyStatus.filter(s => ['FAILED', 'TERMINATED', 'CANCELED', 'TIMED_OUT'].includes(s.status)).length;
      const totalDays = dates.length;
      const overallProgress = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

      // 生成摘要信息
      const summary = [
        `总计 ${totalDays} 天`,
        `已完成 ${completedDays} 天`,
        `运行中 ${runningDays} 天`,
        `失败 ${failedDays} 天`,
        `进度 ${overallProgress}%`
      ].join(', ');

      this.businessLogger.serviceInfo('日期范围爬取进度获取成功', {
        mainWorkflowId,
        totalDays,
        completedDays,
        runningDays,
        failedDays,
        overallProgress
      });

      return {
        mainWorkflowId,
        totalDays,
        completedDays,
        runningDays,
        failedDays,
        overallProgress,
        dailyStatus,
        summary
      };
    } catch (error) {
      this.businessLogger.serviceError('获取日期范围爬取进度失败', error, { mainWorkflowId });
      throw error;
    }
  }
}