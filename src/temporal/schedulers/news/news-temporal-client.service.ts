/**
 * 新闻模块 Temporal 客户端服务
 * 负责启动和管理新闻相关的工作流
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, Client, WorkflowHandle, ScheduleHandle } from '@temporalio/client';
import { ScheduleOverlapPolicy } from '@temporalio/client';
import { newsCrawlingWorkflow, NewsCrawlingWorkflowInput, NewsCrawlingWorkflowResult } from '../../workflows/news/news-crawling.workflow';
import { BusinessLogger } from '../../../common/utils/business-logger.util';

/**
 * Schedule 配置接口
 */
export interface NewsScheduleConfig {
  scheduleId: string;
  cronExpression: string;
  timeZone: string;
  memo?: string;
}

@Injectable()
export class NewsTemporalClientService implements OnModuleDestroy {
  private readonly logger = new Logger(NewsTemporalClientService.name);
  private readonly businessLogger = new BusinessLogger(NewsTemporalClientService.name);
  
  private client?: Client;
  private connection?: Connection;
  private readonly namespace: string;
  private readonly taskQueue: string;

  constructor(private readonly configService: ConfigService) {
    this.namespace = 'default'; // 统一使用 default namespace
    this.taskQueue = 'news-crawling'; // 统一使用简单的 task queue 名称
  }

  /**
   * 获取客户端实例
   */
  async getClient(): Promise<Client> {
    if (!this.client) {
      await this.initialize();
    }
    return this.client!;
  }

  /**
   * 初始化 Temporal 客户端
   */
  private async initialize(): Promise<void> {
    try {
      const host = this.configService.get('TEMPORAL_HOST', 'localhost');
      const port = this.configService.get('TEMPORAL_PORT', '7233');

      // 创建连接
      this.connection = await Connection.connect({
        address: `${host}:${port}`,
      });

      // 创建客户端
      this.client = new Client({
        connection: this.connection,
        namespace: this.namespace,
      });

      this.businessLogger.serviceInfo(`Temporal客户端初始化成功`, {
        namespace: this.namespace,
        taskQueue: this.taskQueue,
        address: `${host}:${port}`,
      });
    } catch (error) {
      this.businessLogger.serviceError('Temporal客户端初始化失败', error);
      throw error;
    }
  }

  /**
   * 启动新闻爬取工作流
   */
  async startNewsCrawlingWorkflow(
    input: NewsCrawlingWorkflowInput,
    workflowId?: string
  ): Promise<WorkflowHandle<typeof newsCrawlingWorkflow>> {
    try {
      const client = await this.getClient();
      
      // 如果没有提供 workflowId，基于 source 和 date 生成确定性ID
      let finalWorkflowId: string;
      if (workflowId) {
        finalWorkflowId = workflowId;
      } else if (input.sources && input.sources.length === 1) {
        // 单个数据源时，使用 source 和 date 作为唯一约束
        finalWorkflowId = `news-crawling-${input.sources[0]}-${input.date}`;
      } else {
        // 多个数据源时，使用日期作为主要约束
        finalWorkflowId = `news-crawling-multiple-${input.date}`;
      }
      
      this.businessLogger.serviceInfo('启动新闻爬取工作流', {
        workflowId: finalWorkflowId,
        date: input.date,
        sources: input.sources,
        skipDuplicateCheck: input.skipDuplicateCheck,
      });

      const handle = await client.workflow.start(newsCrawlingWorkflow, {
        taskQueue: this.taskQueue,
        workflowId: finalWorkflowId,
        args: [input],
        workflowExecutionTimeout: '30m', // 工作流总超时30分钟
      });

      this.businessLogger.serviceInfo('新闻爬取工作流启动成功', {
        workflowId: finalWorkflowId,
        runId: handle.firstExecutionRunId,
      });

      return handle;
    } catch (error) {
      this.businessLogger.serviceError('启动新闻爬取工作流失败', error, {
        date: input.date,
        sources: input.sources,
      });
      throw error;
    }
  }

  /**
   * 获取工作流执行结果
   */
  async getWorkflowResult(workflowId: string): Promise<NewsCrawlingWorkflowResult> {
    try {
      const client = await this.getClient();
      const handle = client.workflow.getHandle(workflowId);
      
      this.businessLogger.serviceInfo('获取工作流执行结果', { workflowId });
      
      const result = await handle.result();
      
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
   * 查询工作流状态
   */
  async getWorkflowStatus(workflowId: string): Promise<{
    status: string;
    runId: string;
    startTime?: Date;
    endTime?: Date;
  }> {
    try {
      const client = await this.getClient();
      const handle = client.workflow.getHandle(workflowId);
      
      const description = await handle.describe();
      
      return {
        status: description.status.name,
        runId: description.runId,
        startTime: description.startTime,
        endTime: description.closeTime,
      };
    } catch (error) {
      this.businessLogger.serviceError('查询工作流状态失败', error, { workflowId });
      throw error;
    }
  }

  /**
   * 创建定时调度
   */
  async createDailyNewsSchedule(config?: Partial<NewsScheduleConfig>): Promise<ScheduleHandle> {
    const client = await this.getClient();
    
    const scheduleConfig: NewsScheduleConfig = {
      scheduleId: `daily-news-crawling-${this.configService.get('NODE_ENV', 'dev')}`,
      cronExpression: '0 1 * * *', // 每天凌晨1点
      timeZone: 'Asia/Shanghai',
      memo: '每日新闻爬取定时任务',
      ...config,
    };

    try {
      this.businessLogger.serviceInfo('创建新闻定时调度', scheduleConfig);

      // 获取昨天的日期作为默认爬取日期
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const defaultDate = yesterday.toISOString().split('T')[0];

      const handle = await client.schedule.create({
        scheduleId: scheduleConfig.scheduleId,
        spec: {
          cronExpressions: [scheduleConfig.cronExpression],
          timezone: scheduleConfig.timeZone,
        },
        action: {
          type: 'startWorkflow',
          workflowType: newsCrawlingWorkflow,
          args: [{
            date: defaultDate, // 这里会被 Schedule 的动态参数替换
          } as NewsCrawlingWorkflowInput],
          taskQueue: this.taskQueue,
        },
        policies: {
          overlap: ScheduleOverlapPolicy.SKIP, // 如果前一个任务还在运行，跳过新任务
          catchupWindow: '1m', // 最大补偿窗口1分钟
        },
        memo: scheduleConfig.memo ? { description: scheduleConfig.memo } : undefined,
      });

      this.businessLogger.serviceInfo('新闻定时调度创建成功', {
        scheduleId: scheduleConfig.scheduleId,
        cronExpression: scheduleConfig.cronExpression,
      });

      return handle;
    } catch (error) {
      // 检查是否为调度已存在的错误
      if (error instanceof Error && (
        error.message.includes('already exists') || 
        error.message.includes('Schedule already exists and is running')
      )) {
        this.businessLogger.serviceInfo('新闻定时调度已存在，获取现有调度句柄', {
          scheduleId: scheduleConfig.scheduleId,
          errorMessage: error.message
        });
        
        // 返回现有调度的句柄
        return client.schedule.getHandle(scheduleConfig.scheduleId);
      }
      
      this.businessLogger.serviceError('创建新闻定时调度失败', error);
      throw error;
    }
  }

  /**
   * 获取定时调度状态
   */
  async getScheduleStatus(): Promise<{
    scheduleId: string;
    nextRunTime?: Date;
    recentActions?: Array<{ result: string; startTime: Date; endTime?: Date }>;
  }> {
    try {
      const client = await this.getClient();
      const scheduleId = `daily-news-crawling-${this.configService.get('NODE_ENV', 'dev')}`;
      
      const handle = client.schedule.getHandle(scheduleId);
      const description = await handle.describe();
      
      return {
        scheduleId,
        nextRunTime: description.info?.nextActionTimes?.[0] || undefined,
        recentActions: description.info?.recentActions?.map(action => ({
          result: action.action?.toString() || 'unknown',
          startTime: action.scheduledAt || new Date(),
          endTime: undefined, // Temporal API doesn't provide end time in this version
        })) || [],
      };
    } catch (error) {
      this.businessLogger.serviceError('获取定时调度状态失败', error);
      return {
        scheduleId: `daily-news-crawling-${this.configService.get('NODE_ENV', 'dev')}`,
      };
    }
  }

  /**
   * 删除定时调度
   */
  async deleteSchedule(): Promise<void> {
    try {
      const client = await this.getClient();
      const scheduleId = `daily-news-crawling-${this.configService.get('NODE_ENV', 'dev')}`;
      
      const handle = client.schedule.getHandle(scheduleId);
      await handle.delete();
      
      this.businessLogger.serviceInfo('删除新闻定时调度成功', { scheduleId });
    } catch (error) {
      this.businessLogger.serviceError('删除新闻定时调度失败', error);
      throw error;
    }
  }

  /**
   * 手动触发昨日新闻爬取
   */
  async triggerYesterdayNewsCrawl(sources?: string[], skipDuplicateCheck = false): Promise<{
    success: boolean;
    workflowId: string;
    message: string;
  }> {
    try {
      // 计算昨天的日期
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const date = yesterday.toISOString().split('T')[0];

      // 使用新的唯一约束生成 workflowId
      let workflowId: string;
      if (sources && sources.length === 1) {
        workflowId = `manual-news-crawling-${sources[0]}-${date}`;
      } else {
        workflowId = `manual-news-crawling-multiple-${date}`;
      }
      
      const handle = await this.startNewsCrawlingWorkflow(
        { date, sources, skipDuplicateCheck },
        workflowId
      );

      return {
        success: true,
        workflowId: handle.workflowId,
        message: `手动触发昨日(${date})新闻爬取任务成功`,
      };
    } catch (error) {
      this.businessLogger.serviceError('手动触发新闻爬取失败', error);
      return {
        success: false,
        workflowId: '',
        message: `触发失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 模块销毁时关闭连接
   */
  async onModuleDestroy(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.close();
        this.businessLogger.serviceInfo('Temporal连接已关闭');
      }
    } catch (error) {
      this.businessLogger.serviceError('关闭Temporal连接失败', error);
    }
  }
}