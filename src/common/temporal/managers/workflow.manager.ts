/**
 * Temporal工作流管理器
 * 负责工作流启动、查询、管理等功能
 */

import { Injectable } from '@nestjs/common';
import { Client, WorkflowHandle, WorkflowIdReusePolicy } from '@temporalio/client';
import { BusinessLogger, LogCategory } from '../../utils/business-logger.util';
import { 
  WorkflowStartOptions, 
  ChildWorkflowOptions,
  WorkflowStatus,
  TemporalConfig 
} from '../interfaces/temporal-config.interface';
import { TemporalConnectionManager } from './connection.manager';

@Injectable()
export class TemporalWorkflowManager {
  private readonly logger = new BusinessLogger(TemporalWorkflowManager.name);
  private client?: Client;
  private config: TemporalConfig;

  constructor(private readonly connectionManager: TemporalConnectionManager) {
    this.config = this.getDefaultConfig();
    this.initializeClient();
  }

  /**
   * 初始化Temporal客户端
   */
  private async initializeClient(): Promise<void> {
    try {
      const connection = this.connectionManager.getConnection();
      
      if (!connection) {
        // 如果连接不存在，先创建连接
        await this.connectionManager.createConnection();
        const newConnection = this.connectionManager.getConnection();
        
        if (!newConnection) {
          throw new Error('无法创建Temporal连接');
        }

        this.client = new Client({
          connection: newConnection,
          namespace: this.config.connection.namespace,
        });
      } else {
        this.client = new Client({
          connection,
          namespace: this.config.connection.namespace,
        });
      }

      this.logger.serviceInfo('Temporal工作流客户端初始化成功', {
        namespace: this.config.connection.namespace,
      });
    } catch (error) {
      this.logger.serviceError('Temporal工作流客户端初始化失败', error);
      // 不抛出异常，允许延迟初始化
    }
  }

  /**
   * 确保客户端已初始化
   */
  private async ensureClientReady(): Promise<Client> {
    if (!this.client) {
      await this.initializeClient();
    }

    if (!this.client) {
      throw new Error('Temporal客户端未准备就绪');
    }

    return this.client;
  }

  /**
   * 启动工作流
   */
  async startWorkflow<T>(options: WorkflowStartOptions<T>): Promise<WorkflowHandle> {
    try {
      const client = await this.ensureClientReady();

      this.logger.info(LogCategory.SERVICE_INFO, '正在启动工作流...', undefined, {
        workflowId: options.workflowId,
        taskQueue: options.taskQueue,
        workflowType: options.workflowType.name || 'Unknown',
        timeout: options.timeout,
      });

      const workflowOptions: any = {
        taskQueue: options.taskQueue,
        workflowId: options.workflowId,
        args: options.args,
        workflowExecutionTimeout: options.timeout || this.config.workflow.defaultTimeout,
        workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE_FAILED_ONLY,
        retry: options.retryPolicy ? {
          initialInterval: options.retryPolicy.initialInterval,
          maximumInterval: options.retryPolicy.maximumInterval,
          backoffCoefficient: options.retryPolicy.backoffCoefficient,
          maximumAttempts: options.retryPolicy.maximumAttempts,
        } : undefined,
        searchAttributes: options.searchAttributes,
        memo: options.memo,
      };

      const handle = await client.workflow.start(options.workflowType, workflowOptions);

      this.logger.serviceInfo('工作流启动成功', {
        workflowId: options.workflowId,
        runId: handle.result() ? 'pending' : 'started',
        taskQueue: options.taskQueue,
      });

      return handle;
    } catch (error) {
      this.logger.serviceError('启动工作流失败', error, {
        workflowId: options.workflowId,
        taskQueue: options.taskQueue,
      });
      throw error;
    }
  }

  /**
   * 启动子工作流
   */
  async startChildWorkflow<T>(options: ChildWorkflowOptions<T>): Promise<WorkflowHandle> {
    try {
      const client = await this.ensureClientReady();

      // 生成子工作流ID（如果未提供）
      const childWorkflowId = options.workflowId || 
        `child-${options.workflowType.name || 'workflow'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      this.logger.info(LogCategory.SERVICE_INFO, '正在启动子工作流...', undefined, {
        childWorkflowId,
        taskQueue: options.taskQueue,
        workflowType: options.workflowType.name || 'Unknown',
      });

      const childWorkflowOptions: any = {
        taskQueue: options.taskQueue || 'default', // 如果未指定，使用默认队列
        workflowId: childWorkflowId,
        args: options.args,
        workflowExecutionTimeout: options.timeout || this.config.workflow.defaultTimeout,
        retry: options.retryPolicy ? {
          initialInterval: options.retryPolicy.initialInterval,
          maximumInterval: options.retryPolicy.maximumInterval,
          backoffCoefficient: options.retryPolicy.backoffCoefficient,
          maximumAttempts: options.retryPolicy.maximumAttempts,
        } : undefined,
      };

      const handle = await client.workflow.start(options.workflowType, childWorkflowOptions);

      this.logger.serviceInfo('子工作流启动成功', {
        childWorkflowId,
        taskQueue: options.taskQueue,
      });

      return handle;
    } catch (error) {
      this.logger.serviceError('启动子工作流失败', error, {
        workflowType: options.workflowType.name,
        taskQueue: options.taskQueue,
      });
      throw error;
    }
  }

  /**
   * 获取工作流句柄
   */
  async getWorkflowHandle(workflowId: string): Promise<WorkflowHandle> {
    try {
      const client = await this.ensureClientReady();
      return client.workflow.getHandle(workflowId);
    } catch (error) {
      this.logger.serviceError('获取工作流句柄失败', error, { workflowId });
      throw error;
    }
  }

  /**
   * 查询工作流状态
   */
  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatus> {
    try {
      const client = await this.ensureClientReady();
      const handle = client.workflow.getHandle(workflowId);
      const description = await handle.describe();

      const status: WorkflowStatus = {
        workflowId: description.workflowId,
        runId: description.runId,
        status: description.status.name as WorkflowStatus['status'],
        startTime: description.startTime,
        endTime: description.closeTime || undefined,
      };

      // 尝试获取结果（如果已完成）
      if (description.status.name === 'COMPLETED') {
        try {
          status.result = await handle.result();
        } catch (error) {
          // 如果无法获取结果，记录但不抛出异常
          this.logger.warn(LogCategory.SERVICE_ERROR, '无法获取工作流结果', undefined, { 
            workflowId, 
            error: error.message 
          });
        }
      }

      // 计算执行时间
      if (status.startTime && status.endTime) {
        status.executionTime = status.endTime.getTime() - status.startTime.getTime();
      }

      return status;
    } catch (error) {
      this.logger.serviceError('查询工作流状态失败', error, { workflowId });
      throw error;
    }
  }

  /**
   * 等待工作流完成
   */
  async waitForWorkflowResult<T>(workflowId: string, timeout?: number): Promise<T> {
    try {
      const client = await this.ensureClientReady();
      const handle = client.workflow.getHandle(workflowId);

      this.logger.info(LogCategory.SERVICE_INFO, '等待工作流完成...', undefined, {
        workflowId,
        timeout: timeout ? `${timeout}ms` : '无限制',
      });

      const result = await handle.result();

      this.logger.serviceInfo('工作流执行完成', {
        workflowId,
      });

      return result as T;
    } catch (error) {
      this.logger.serviceError('等待工作流结果失败', error, { workflowId });
      throw error;
    }
  }

  /**
   * 取消工作流
   */
  async cancelWorkflow(workflowId: string, reason?: string): Promise<void> {
    try {
      const client = await this.ensureClientReady();
      const handle = client.workflow.getHandle(workflowId);

      this.logger.info(LogCategory.SERVICE_INFO, '正在取消工作流...', undefined, {
        workflowId,
        reason,
      });

      await handle.cancel();

      this.logger.serviceInfo('工作流已取消', {
        workflowId,
        reason,
      });
    } catch (error) {
      this.logger.serviceError('取消工作流失败', error, { workflowId });
      throw error;
    }
  }

  /**
   * 终止工作流
   */
  async terminateWorkflow(workflowId: string, reason?: string): Promise<void> {
    try {
      const client = await this.ensureClientReady();
      const handle = client.workflow.getHandle(workflowId);

      this.logger.info(LogCategory.SERVICE_INFO, '正在终止工作流...', undefined, {
        workflowId,
        reason,
      });

      await handle.terminate(reason);

      this.logger.serviceInfo('工作流已终止', {
        workflowId,
        reason,
      });
    } catch (error) {
      this.logger.serviceError('终止工作流失败', error, { workflowId });
      throw error;
    }
  }

  /**
   * 向工作流发送信号
   */
  async signalWorkflow(workflowId: string, signalName: string, ...args: any[]): Promise<void> {
    try {
      const client = await this.ensureClientReady();
      const handle = client.workflow.getHandle(workflowId);

      this.logger.info(LogCategory.SERVICE_INFO, '正在向工作流发送信号...', undefined, {
        workflowId,
        signalName,
        argsCount: args.length,
      });

      await handle.signal(signalName, ...args);

      this.logger.serviceInfo('工作流信号发送成功', {
        workflowId,
        signalName,
      });
    } catch (error) {
      this.logger.serviceError('发送工作流信号失败', error, {
        workflowId,
        signalName,
      });
      throw error;
    }
  }

  /**
   * 查询工作流
   */
  async queryWorkflow<T>(workflowId: string, queryType: string, ...args: any[]): Promise<T> {
    try {
      const client = await this.ensureClientReady();
      const handle = client.workflow.getHandle(workflowId);

      this.logger.info(LogCategory.SERVICE_INFO, '正在查询工作流...', undefined, {
        workflowId,
        queryType,
        argsCount: args.length,
      });

      const result = await handle.query(queryType, ...args);

      this.logger.serviceInfo('工作流查询成功', {
        workflowId,
        queryType,
      });

      return result as T;
    } catch (error) {
      this.logger.serviceError('查询工作流失败', error, {
        workflowId,
        queryType,
      });
      throw error;
    }
  }

  /**
   * 获取客户端实例
   */
  getClient(): Client | undefined {
    return this.client;
  }

  /**
   * 重置客户端（用于重连后）
   */
  async resetClient(): Promise<void> {
    this.client = undefined;
    await this.initializeClient();
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
        maxRetryAttempts: 3,
      },
      worker: {
        maxConcurrentActivities: 10,
        maxConcurrentWorkflows: 3,
      },
      monitoring: {
        enableMetrics: true,
      },
    };
  }
}