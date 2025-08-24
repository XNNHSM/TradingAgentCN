/**
 * 智能体模块专属 Temporal Worker 服务
 * 按照新规范管理不同业务域的 TaskQueue
 */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from '@temporalio/worker';
import { BusinessLogger } from '../../common/utils/business-logger.util';
import { createActivities } from '../../workflows/temporal/worker';

@Injectable()
export class AgentsWorkerService implements OnModuleDestroy {
  private readonly logger = new BusinessLogger(AgentsWorkerService.name);
  private workers: Worker[] = [];
  private readonly environment: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.get('NODE_ENV', 'dev');
  }

  /**
   * 启动智能体模块的所有 Workers
   * 注意：不再支持批量分析，只保留单股票分析功能
   */
  async startWorkers(): Promise<void> {
    try {
      // 创建MCP活动实现
      const activities = createActivities(this.configService);

      // 只启动股票分析 Worker
      await this.startAnalysisWorker(activities);

      this.logger.serviceInfo('智能体模块 Workers 启动成功', {
        environment: this.environment,
        workerCount: this.workers.length,
      });
    } catch (error) {
      this.logger.serviceError('启动智能体模块 Workers 失败', error);
      throw error;
    }
  }

  /**
   * 启动股票分析 Worker
   * 处理单个股票的深度分析任务
   */
  private async startAnalysisWorker(activities: any): Promise<void> {
    const taskQueue = 'agents-analysis'; // 简化任务队列名称

    try {
      const worker = await Worker.create({
        workflowsPath: require.resolve('../../workflows/orchestrators/stock-analysis-mcp.workflow'),
        activities,
        taskQueue,
        maxConcurrentActivityTaskExecutions: 10, // 适中并发，平衡质量和速度
        maxConcurrentWorkflowTaskExecutions: 3,
      });

      this.workers.push(worker);

      this.logger.serviceInfo('股票分析 Worker 启动成功', {
        taskQueue,
        maxConcurrentActivities: 10,
        maxConcurrentWorkflows: 3,
      });
    } catch (error) {
      this.logger.serviceError('启动股票分析 Worker 失败', error, { taskQueue });
      throw error;
    }
  }


  /**
   * 获取 Worker 状态信息
   */
  getWorkersStatus(): {
    environment: string;
    totalWorkers: number;
    workers: Array<{
      taskQueue: string;
      maxConcurrentActivities: number;
      maxConcurrentWorkflows: number;
    }>;
  } {
    return {
      environment: this.environment,
      totalWorkers: this.workers.length,
      workers: [
        {
          taskQueue: 'agents-analysis',
          maxConcurrentActivities: 10,
          maxConcurrentWorkflows: 3,
        },
      ],
    };
  }

  /**
   * 检查 Workers 健康状态
   */
  async checkWorkersHealth(): Promise<{
    healthy: boolean;
    totalWorkers: number;
    activeWorkers: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let activeWorkers = 0;

    // 简单的健康检查逻辑
    // 在实际实现中，可以检查更详细的状态
    for (let i = 0; i < this.workers.length; i++) {
      try {
        // Worker 对象本身存在说明基本健康
        if (this.workers[i]) {
          activeWorkers++;
        }
      } catch (error) {
        issues.push(`Worker ${i} 存在问题: ${error.message}`);
      }
    }

    return {
      healthy: activeWorkers === this.workers.length && issues.length === 0,
      totalWorkers: this.workers.length,
      activeWorkers,
      issues,
    };
  }

  /**
   * 停止所有 Workers
   */
  async shutdown(): Promise<void> {
    this.logger.serviceInfo('正在关闭智能体模块 Workers...');

    const shutdownPromises = this.workers.map(async (worker, index) => {
      try {
        await worker.shutdown();
        this.logger.debug(`Worker ${index} 已关闭`);
      } catch (error) {
        this.logger.serviceError(`关闭 Worker ${index} 失败`, error);
      }
    });

    await Promise.allSettled(shutdownPromises);
    this.workers = [];
    
    this.logger.serviceInfo('智能体模块所有 Workers 已关闭');
  }

  /**
   * 模块销毁时自动关闭 Workers
   */
  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }
}