/**
 * Temporal统一管理器
 * 提供Temporal所有功能的统一入口，简化代码层调用
 */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, WorkflowHandle, Client } from '@temporalio/client';
import { Worker } from '@temporalio/worker';
import { BusinessLogger, LogCategory } from '../common/utils/business-logger.util';

import { TemporalConnectionManager } from './managers/connection.manager';
import { TemporalWorkerManager } from './managers/worker.manager';
import { TemporalWorkflowManager } from './managers/workflow.manager';

import {
  TemporalConfig,
  WorkflowStartOptions,
  ChildWorkflowOptions,
  WorkerCreateOptions,
  WorkflowStatus,
  WorkerHealthStatus,
  TemporalMetrics,
  SystemHealthStatus,
} from './interfaces/temporal-config.interface';

/**
 * Temporal统一管理器接口
 */
export interface ITemporalManager {
  // 连接管理
  createConnection(config?: Partial<TemporalConfig>): Promise<Connection>;
  checkConnection(): Promise<boolean>;
  reconnect(): Promise<void>;
  
  // 工作流管理
  startWorkflow<T>(options: WorkflowStartOptions<T>): Promise<WorkflowHandle>;
  startChildWorkflow<T>(options: ChildWorkflowOptions<T>): Promise<WorkflowHandle>;
  getWorkflowStatus(workflowId: string): Promise<WorkflowStatus>;
  cancelWorkflow(workflowId: string): Promise<void>;
  waitForResult<T>(workflowId: string): Promise<T>;
  
  // Worker管理
  createWorker(options: WorkerCreateOptions): Promise<Worker>;
  createWorkers(options: WorkerCreateOptions[]): Promise<Worker[]>;
  checkWorkerHealth(): Promise<WorkerHealthStatus>;
  shutdownWorkers(): Promise<void>;
  
  // 监控管理
  collectMetrics(): Promise<TemporalMetrics>;
  exportHealthStatus(): Promise<SystemHealthStatus>;
}

@Injectable()
export class TemporalManager implements ITemporalManager, OnModuleDestroy {
  private readonly logger = new BusinessLogger(TemporalManager.name);
  private readonly connectionManager: TemporalConnectionManager;
  private readonly workerManager: TemporalWorkerManager;
  private readonly workflowManager: TemporalWorkflowManager;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    this.connectionManager = new TemporalConnectionManager(configService);
    this.workerManager = new TemporalWorkerManager(this.connectionManager);
    this.workflowManager = new TemporalWorkflowManager(this.connectionManager);
    
    this.logger.serviceInfo('TemporalManager 已初始化');
  }

  /**
   * 初始化Temporal管理器
   */
  async initialize(config?: Partial<TemporalConfig>): Promise<void> {
    if (this.isInitialized) {
      this.logger.debug('TemporalManager 已经初始化，跳过重复初始化');
      return;
    }

    try {
      this.logger.serviceInfo('正在初始化 TemporalManager...');

      // 创建连接
      await this.createConnection(config);
      
      // 启动连接健康检查
      this.connectionManager.startHealthCheck();

      this.isInitialized = true;
      this.logger.serviceInfo('TemporalManager 初始化完成');
    } catch (error) {
      this.logger.serviceError('TemporalManager 初始化失败', error);
      throw error;
    }
  }

  // ===== 连接管理方法 =====

  async createConnection(config?: Partial<TemporalConfig>): Promise<Connection> {
    try {
      return await this.connectionManager.createConnection(config);
    } catch (error) {
      this.logger.serviceError('创建连接失败', error);
      throw error;
    }
  }

  async checkConnection(): Promise<boolean> {
    return await this.connectionManager.checkConnection();
  }

  async reconnect(): Promise<void> {
    try {
      await this.connectionManager.reconnect();
      // 重连后重置工作流客户端
      await this.workflowManager.resetClient();
    } catch (error) {
      this.logger.serviceError('重连失败', error);
      throw error;
    }
  }

  // ===== 工作流管理方法 =====

  async startWorkflow<T>(options: WorkflowStartOptions<T>): Promise<WorkflowHandle> {
    await this.ensureInitialized();
    return await this.workflowManager.startWorkflow(options);
  }

  async startChildWorkflow<T>(options: ChildWorkflowOptions<T>): Promise<WorkflowHandle> {
    await this.ensureInitialized();
    return await this.workflowManager.startChildWorkflow(options);
  }

  async getWorkflowHandle(workflowId: string): Promise<WorkflowHandle> {
    await this.ensureInitialized();
    return await this.workflowManager.getWorkflowHandle(workflowId);
  }

  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatus> {
    await this.ensureInitialized();
    return await this.workflowManager.getWorkflowStatus(workflowId);
  }

  async cancelWorkflow(workflowId: string, reason?: string): Promise<void> {
    await this.ensureInitialized();
    return await this.workflowManager.cancelWorkflow(workflowId, reason);
  }

  async terminateWorkflow(workflowId: string, reason?: string): Promise<void> {
    await this.ensureInitialized();
    return await this.workflowManager.terminateWorkflow(workflowId, reason);
  }

  async waitForResult<T>(workflowId: string, timeout?: number): Promise<T> {
    await this.ensureInitialized();
    return await this.workflowManager.waitForWorkflowResult<T>(workflowId, timeout);
  }

  async signalWorkflow(workflowId: string, signalName: string, ...args: any[]): Promise<void> {
    await this.ensureInitialized();
    return await this.workflowManager.signalWorkflow(workflowId, signalName, ...args);
  }

  async queryWorkflow<T>(workflowId: string, queryType: string, ...args: any[]): Promise<T> {
    await this.ensureInitialized();
    return await this.workflowManager.queryWorkflow<T>(workflowId, queryType, ...args);
  }

  // ===== Worker管理方法 =====

  async createWorker(options: WorkerCreateOptions): Promise<Worker> {
    await this.ensureInitialized();
    return await this.workerManager.createWorker(options);
  }

  async createWorkers(options: WorkerCreateOptions[]): Promise<Worker[]> {
    await this.ensureInitialized();
    return await this.workerManager.createWorkers(options);
  }

  async checkWorkerHealth(): Promise<WorkerHealthStatus> {
    return await this.workerManager.checkWorkerHealth();
  }

  async shutdownWorkers(): Promise<void> {
    return await this.workerManager.shutdownAllWorkers();
  }

  getWorkerByTaskQueue(taskQueue: string): Worker | undefined {
    return this.workerManager.getWorkerByTaskQueue(taskQueue);
  }

  getWorkersStatus(): Array<{
    id: string;
    taskQueue: string;
    isHealthy: boolean;
    startTime: Date;
    lastHealthCheck: Date;
    uptime: number;
  }> {
    return this.workerManager.getWorkersStatus();
  }

  // ===== 监控管理方法 =====

  async collectMetrics(): Promise<TemporalMetrics> {
    // 这里可以收集来自Temporal的各种指标
    // 由于@temporalio/client没有直接提供指标API，我们需要自己实现
    const workerStatus = await this.checkWorkerHealth();
    const connectionStatus = await this.checkConnection();
    
    const now = new Date();
    const metrics: TemporalMetrics = {
      workflows: {
        total: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      },
      activities: {
        total: 0,
        running: 0,
        completed: 0,
        failed: 0,
        timedOut: 0,
      },
      workers: {
        total: workerStatus.totalWorkers,
        active: workerStatus.activeWorkers,
        idle: workerStatus.totalWorkers - workerStatus.activeWorkers,
      },
      performance: {
        averageWorkflowExecutionTime: 0,
        averageActivityExecutionTime: 0,
        throughput: 0,
        errorRate: workerStatus.failedWorkers / Math.max(workerStatus.totalWorkers, 1),
      },
      system: {
        cpuUsage: 0, // 需要系统监控工具支持
        memoryUsage: 0, // 需要系统监控工具支持
        connectionCount: connectionStatus ? 1 : 0,
      },
      timestamp: now,
    };

    return metrics;
  }

  async exportHealthStatus(): Promise<SystemHealthStatus> {
    const workerHealth = await this.checkWorkerHealth();
    const connectionHealth = await this.checkConnection();
    const metrics = await this.collectMetrics();

    // 确定整体健康状态
    let overall: SystemHealthStatus['overall'] = 'HEALTHY';
    if (!connectionHealth || !workerHealth.healthy) {
      overall = workerHealth.totalWorkers === 0 ? 'UNHEALTHY' : 'DEGRADED';
    }

    const healthStatus: SystemHealthStatus = {
      overall,
      components: {
        connection: connectionHealth ? 'UP' : 'DOWN',
        workers: workerHealth.healthy ? 'UP' : (workerHealth.totalWorkers > 0 ? 'DEGRADED' : 'DOWN'),
        workflows: 'UP', // 简化实现，实际应该检查工作流状态
      },
      metrics,
      alerts: [],
      lastChecked: new Date(),
    };

    // 生成告警
    if (!connectionHealth) {
      healthStatus.alerts.push({
        level: 'CRITICAL',
        message: 'Temporal连接断开',
        component: 'connection',
        timestamp: new Date(),
      });
    }

    if (workerHealth.failedWorkers > 0) {
      healthStatus.alerts.push({
        level: 'WARNING',
        message: `${workerHealth.failedWorkers} 个Worker健康状态异常`,
        component: 'workers',
        timestamp: new Date(),
      });
    }

    return healthStatus;
  }

  // ===== 便捷方法 =====

  /**
   * 获取连接状态信息
   */
  getConnectionStatus(): {
    connected: boolean;
    attempts: number;
    isReconnecting: boolean;
    address: string;
    namespace: string;
  } {
    return this.connectionManager.getConnectionStatus();
  }

  /**
   * 获取底层客户端实例（高级用法）
   */
  getClient(): Client | undefined {
    return this.workflowManager.getClient();
  }

  /**
   * 获取底层连接实例（高级用法）
   */
  getConnection(): Connection | undefined {
    return this.connectionManager.getConnection();
  }

  // ===== 内部方法 =====

  /**
   * 确保管理器已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * 模块销毁时清理资源
   */
  async onModuleDestroy(): Promise<void> {
    try {
      this.logger.serviceInfo('正在关闭 TemporalManager...');

      // 停止健康检查
      this.connectionManager.stopHealthCheck();
      
      // 关闭所有Workers
      await this.shutdownWorkers();
      
      // 关闭连接
      await this.connectionManager.closeConnection();

      this.isInitialized = false;
      this.logger.serviceInfo('TemporalManager 已成功关闭');
    } catch (error) {
      this.logger.serviceError('关闭 TemporalManager 时发生错误', error);
    }
  }
}