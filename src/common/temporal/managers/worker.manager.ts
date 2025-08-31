/**
 * Temporal Worker管理器
 * 负责Worker创建、管理、健康检查等功能
 */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Worker } from '@temporalio/worker';
import { BusinessLogger, LogCategory } from '../../utils/business-logger.util';
import { 
  WorkerCreateOptions, 
  WorkerHealthStatus, 
  TemporalConfig 
} from '../interfaces/temporal-config.interface';
import { TemporalConnectionManager } from './connection.manager';

interface ManagedWorker {
  id: string;
  taskQueue: string;
  worker: Worker;
  startTime: Date;
  isHealthy: boolean;
  lastHealthCheck: Date;
  options: WorkerCreateOptions;
}

@Injectable()
export class TemporalWorkerManager implements OnModuleDestroy {
  private readonly logger = new BusinessLogger(TemporalWorkerManager.name);
  private workers: Map<string, ManagedWorker> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;
  private config: TemporalConfig;

  constructor(private readonly connectionManager: TemporalConnectionManager) {
    this.config = this.getDefaultConfig();
  }

  /**
   * 创建Worker
   */
  async createWorker(options: WorkerCreateOptions): Promise<Worker> {
    const workerId = `${options.taskQueue}-${Date.now()}`;
    
    try {
      this.logger.info(LogCategory.SERVICE_INFO, '正在创建Temporal Worker...', undefined, {
        workerId,
        taskQueue: options.taskQueue,
        workflowsPath: options.workflowsPath,
      });

      // 确保连接存在
      const connection = this.connectionManager.getConnection();
      if (!connection) {
        throw new Error('Temporal连接未建立，无法创建Worker');
      }

      // 创建 NativeConnection
      const { NativeConnection } = await import('@temporalio/worker');
      const nativeConnection = await NativeConnection.connect({
        address: this.config.connection.address,
      });

      const workerOptions: any = {
        connection: nativeConnection,
        namespace: this.config.connection.namespace,
        workflowsPath: options.workflowsPath,
        activities: options.activities || {},
        taskQueue: options.taskQueue,
        maxConcurrentActivityTaskExecutions: options.options?.maxConcurrentActivities || 
                                           this.config.worker.maxConcurrentActivities,
        maxConcurrentWorkflowTaskExecutions: options.options?.maxConcurrentWorkflows || 
                                            this.config.worker.maxConcurrentWorkflows,
      };

      const worker = await Worker.create(workerOptions);

      // 保存Worker信息
      const managedWorker: ManagedWorker = {
        id: workerId,
        taskQueue: options.taskQueue,
        worker,
        startTime: new Date(),
        isHealthy: true,
        lastHealthCheck: new Date(),
        options,
      };

      this.workers.set(workerId, managedWorker);

      this.logger.serviceInfo('Temporal Worker创建成功', {
        workerId,
        taskQueue: options.taskQueue,
        maxConcurrentActivities: options.options?.maxConcurrentActivities || this.config.worker.maxConcurrentActivities,
        maxConcurrentWorkflows: options.options?.maxConcurrentWorkflows || this.config.worker.maxConcurrentWorkflows,
      });

      // 🚀 关键修复: 启动Worker开始轮询TaskQueue
      worker.run().catch(error => {
        this.logger.serviceError('Worker运行时发生错误', error, {
          workerId,
          taskQueue: options.taskQueue,
        });
        // 标记Worker为不健康状态
        managedWorker.isHealthy = false;
      });

      this.logger.serviceInfo('Temporal Worker已开始轮询任务队列', {
        workerId,
        taskQueue: options.taskQueue,
      });

      // 启动健康检查
      this.startHealthCheck();

      return worker;
    } catch (error) {
      this.logger.serviceError('创建Temporal Worker失败', error, {
        workerId,
        taskQueue: options.taskQueue,
      });
      throw error;
    }
  }

  /**
   * 批量创建Workers
   */
  async createWorkers(workerConfigs: WorkerCreateOptions[]): Promise<Worker[]> {
    const workers: Worker[] = [];
    
    this.logger.serviceInfo('开始批量创建Workers', {
      count: workerConfigs.length,
      taskQueues: workerConfigs.map(config => config.taskQueue),
    });

    for (const config of workerConfigs) {
      try {
        const worker = await this.createWorker(config);
        workers.push(worker);
      } catch (error) {
        this.logger.serviceError(`创建Worker失败: ${config.taskQueue}`, error);
        // 继续创建其他Workers，不因为单个失败而停止
      }
    }

    this.logger.serviceInfo('批量创建Workers完成', {
      totalRequested: workerConfigs.length,
      successfullyCreated: workers.length,
    });

    return workers;
  }

  /**
   * 获取指定TaskQueue的Worker
   */
  getWorkerByTaskQueue(taskQueue: string): Worker | undefined {
    for (const managedWorker of this.workers.values()) {
      if (managedWorker.taskQueue === taskQueue) {
        return managedWorker.worker;
      }
    }
    return undefined;
  }

  /**
   * 获取所有Workers状态
   */
  getWorkersStatus(): Array<{
    id: string;
    taskQueue: string;
    isHealthy: boolean;
    startTime: Date;
    lastHealthCheck: Date;
    uptime: number;
  }> {
    const now = new Date();
    return Array.from(this.workers.values()).map(managedWorker => ({
      id: managedWorker.id,
      taskQueue: managedWorker.taskQueue,
      isHealthy: managedWorker.isHealthy,
      startTime: managedWorker.startTime,
      lastHealthCheck: managedWorker.lastHealthCheck,
      uptime: now.getTime() - managedWorker.startTime.getTime(),
    }));
  }

  /**
   * 检查Workers健康状态
   */
  async checkWorkerHealth(): Promise<WorkerHealthStatus> {
    const issues: WorkerHealthStatus['issues'] = [];
    let activeWorkers = 0;
    let failedWorkers = 0;
    const now = new Date();

    for (const managedWorker of this.workers.values()) {
      try {
        // 检查Worker是否还在运行
        // 注意：@temporalio/worker 没有直接的健康检查方法
        // 我们通过检查Worker对象是否存在以及上次健康检查时间来判断
        const timeSinceLastCheck = now.getTime() - managedWorker.lastHealthCheck.getTime();
        const healthCheckTimeout = this.config.monitoring?.healthCheckInterval || 60000;

        if (timeSinceLastCheck > healthCheckTimeout * 2) {
          // 如果超过两个健康检查周期没有更新，认为Worker可能有问题
          managedWorker.isHealthy = false;
          failedWorkers++;
          issues.push({
            workerId: managedWorker.id,
            taskQueue: managedWorker.taskQueue,
            issue: '健康检查超时',
            timestamp: now,
          });
        } else {
          managedWorker.isHealthy = true;
          managedWorker.lastHealthCheck = now;
          activeWorkers++;
        }
      } catch (error) {
        managedWorker.isHealthy = false;
        failedWorkers++;
        issues.push({
          workerId: managedWorker.id,
          taskQueue: managedWorker.taskQueue,
          issue: `健康检查失败: ${error.message}`,
          timestamp: now,
        });
      }
    }

    const healthStatus: WorkerHealthStatus = {
      healthy: failedWorkers === 0 && this.workers.size > 0,
      totalWorkers: this.workers.size,
      activeWorkers,
      failedWorkers,
      issues,
      lastChecked: now,
    };

    if (issues.length > 0) {
      this.logger.warn(LogCategory.SERVICE_ERROR, `检测到 ${issues.length} 个Worker健康问题`, undefined, {
        totalWorkers: this.workers.size,
        activeWorkers,
        failedWorkers,
      });
    }

    return healthStatus;
  }

  /**
   * 启动定期健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return; // 已经启动了健康检查
    }

    const interval = this.config.monitoring?.healthCheckInterval || 60000; // 默认1分钟

    this.logger.serviceInfo('启动Worker健康检查', { interval: `${interval}ms` });

    this.healthCheckTimer = setInterval(async () => {
      try {
        const healthStatus = await this.checkWorkerHealth();
        
        if (!healthStatus.healthy) {
          this.logger.warn(LogCategory.SERVICE_ERROR, 'Worker健康检查发现问题', undefined, {
            totalWorkers: healthStatus.totalWorkers,
            activeWorkers: healthStatus.activeWorkers,
            failedWorkers: healthStatus.failedWorkers,
            issueCount: healthStatus.issues.length,
          });
        }
      } catch (error) {
        this.logger.serviceError('Worker健康检查过程中发生错误', error);
      }
    }, interval);
  }

  /**
   * 停止健康检查
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
      this.logger.serviceInfo('Worker健康检查已停止');
    }
  }

  /**
   * 优雅关闭指定Worker
   */
  async shutdownWorker(workerId: string): Promise<void> {
    const managedWorker = this.workers.get(workerId);
    
    if (!managedWorker) {
      this.logger.warn(LogCategory.SERVICE_ERROR, `Worker不存在: ${workerId}`);
      return;
    }

    try {
      this.logger.info(LogCategory.SERVICE_INFO, '正在关闭Worker...', undefined, {
        workerId,
        taskQueue: managedWorker.taskQueue,
      });

      await managedWorker.worker.shutdown();
      this.workers.delete(workerId);

      this.logger.serviceInfo('Worker已成功关闭', {
        workerId,
        taskQueue: managedWorker.taskQueue,
      });
    } catch (error) {
      this.logger.serviceError('关闭Worker失败', error, {
        workerId,
        taskQueue: managedWorker.taskQueue,
      });
      // 即使关闭失败也要从管理列表中移除
      this.workers.delete(workerId);
    }
  }

  /**
   * 关闭所有Workers
   */
  async shutdownAllWorkers(): Promise<void> {
    this.stopHealthCheck();

    if (this.workers.size === 0) {
      this.logger.serviceInfo('没有需要关闭的Workers');
      return;
    }

    this.logger.serviceInfo('正在关闭所有Workers...', {
      totalWorkers: this.workers.size,
    });

    const shutdownPromises = Array.from(this.workers.keys()).map(workerId =>
      this.shutdownWorker(workerId)
    );

    try {
      await Promise.allSettled(shutdownPromises);
      this.logger.serviceInfo('所有Workers已关闭');
    } catch (error) {
      this.logger.serviceError('关闭Workers过程中发生错误', error);
    }
  }

  /**
   * 模块销毁时自动关闭所有Workers
   */
  async onModuleDestroy(): Promise<void> {
    await this.shutdownAllWorkers();
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): TemporalConfig {
    return {
      connection: {
        address: 'localhost:7233',
        namespace: 'default',
      },
      workflow: {
        defaultTimeout: '30m',
      },
      worker: {
        maxConcurrentActivities: 10,
        maxConcurrentWorkflows: 3,
        enableLogging: false,
        shutdownTimeout: 30000,
      },
      monitoring: {
        healthCheckInterval: 60000,
        enableMetrics: true,
      },
    };
  }
}