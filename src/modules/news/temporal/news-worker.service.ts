/**
 * 新闻模块 Temporal Worker 服务
 * 负责执行新闻相关的工作流和活动
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Runtime, NativeConnection } from '@temporalio/worker';
import { BusinessLogger } from '../../../common/utils/business-logger.util';
import { NewsActivitiesImpl } from './news.activities';
import { NewsService } from '../news.service';

@Injectable()
export class NewsWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsWorkerService.name);
  private readonly businessLogger = new BusinessLogger(NewsWorkerService.name);
  
  private worker?: Worker;
  private connection?: NativeConnection;
  private readonly namespace: string;
  private readonly taskQueue: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly newsService: NewsService,
  ) {
    const environment = this.configService.get('NODE_ENV', 'dev');
    this.namespace = `news-${environment}`;
    this.taskQueue = `news-crawling-${environment}`;
  }

  /**
   * 模块初始化时启动 Worker
   */
  async onModuleInit(): Promise<void> {
    try {
      // 在开发环境或测试环境中可以选择不启动 Worker
      if (this.configService.get('TEMPORAL_WORKER_ENABLED', 'true') === 'false') {
        this.businessLogger.serviceInfo('Temporal Worker 被禁用，跳过启动');
        return;
      }

      await this.startWorker();
    } catch (error) {
      this.businessLogger.serviceError('启动 News Worker 失败', error);
      // 不抛出错误，避免影响整个应用启动
    }
  }

  /**
   * 启动 Temporal Worker
   */
  async startWorker(): Promise<void> {
    try {
      const host = this.configService.get('TEMPORAL_HOST', 'localhost');
      const port = this.configService.get('TEMPORAL_PORT', '7233');

      // 创建连接
      this.connection = await NativeConnection.connect({
        address: `${host}:${port}`,
      });

      // 创建活动实例
      const newsActivities = new NewsActivitiesImpl(this.newsService);

      // 创建 Worker
      this.worker = await Worker.create({
        connection: this.connection,
        namespace: this.namespace,
        taskQueue: this.taskQueue,
        workflowsPath: require.resolve('./news-crawling.workflow'),
        activities: {
          // 将活动实例的方法绑定到正确的上下文
          getSupportedSources: newsActivities.getSupportedSources.bind(newsActivities),
          validateDate: newsActivities.validateDate.bind(newsActivities),
          crawlNewsFromSource: newsActivities.crawlNewsFromSource.bind(newsActivities),
          getWorkflowSummary: newsActivities.getWorkflowSummary.bind(newsActivities),
        },
        // Worker 配置
        maxConcurrentActivityTaskExecutions: 5, // 最多同时执行5个活动
        maxConcurrentWorkflowTaskExecutions: 2, // 最多同时执行2个工作流
      });

      // 启动 Worker
      const runPromise = this.worker.run();

      this.businessLogger.serviceInfo('News Temporal Worker 启动成功', {
        namespace: this.namespace,
        taskQueue: this.taskQueue,
        address: `${host}:${port}`,
      });

      // 处理 Worker 运行时的错误
      runPromise.catch((error) => {
        this.businessLogger.serviceError('News Temporal Worker 运行异常', error);
      });

    } catch (error) {
      this.businessLogger.serviceError('启动 News Temporal Worker 失败', error);
      throw error;
    }
  }

  /**
   * 停止 Worker
   */
  async stopWorker(): Promise<void> {
    try {
      if (this.worker) {
        this.businessLogger.serviceInfo('正在停止 News Temporal Worker...');
        this.worker.shutdown();
        this.businessLogger.serviceInfo('News Temporal Worker 已停止');
      }
    } catch (error) {
      this.businessLogger.serviceError('停止 News Temporal Worker 失败', error);
    }
  }

  /**
   * 获取 Worker 状态
   */
  getWorkerStatus(): {
    isRunning: boolean;
    namespace: string;
    taskQueue: string;
    maxConcurrentActivities: number;
    maxConcurrentWorkflows: number;
  } {
    return {
      isRunning: !!this.worker,
      namespace: this.namespace,
      taskQueue: this.taskQueue,
      maxConcurrentActivities: 5,
      maxConcurrentWorkflows: 2,
    };
  }

  /**
   * 模块销毁时停止 Worker
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.stopWorker();
      
      if (this.connection) {
        await this.connection.close();
        this.businessLogger.serviceInfo('News Temporal 连接已关闭');
      }
    } catch (error) {
      this.businessLogger.serviceError('关闭 News Temporal 连接失败', error);
    }
  }
}