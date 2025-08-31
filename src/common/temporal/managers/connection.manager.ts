/**
 * Temporal连接管理器
 * 负责连接创建、健康检查、自动重连等功能
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection } from '@temporalio/client';
import { BusinessLogger, LogCategory } from '../../utils/business-logger.util';
import { TemporalConfig } from '../interfaces/temporal-config.interface';

@Injectable()
export class TemporalConnectionManager {
  private readonly logger = new BusinessLogger(TemporalConnectionManager.name);
  private connection?: Connection;
  private reconnectTimer?: NodeJS.Timeout;
  private config: TemporalConfig;
  private isReconnecting = false;
  private connectionAttempts = 0;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
  }

  /**
   * 创建Temporal连接
   */
  async createConnection(customConfig?: Partial<TemporalConfig>): Promise<Connection> {
    const config = { ...this.config, ...customConfig };
    
    try {
      this.logger.info(LogCategory.SERVICE_INFO, '正在创建Temporal连接...', undefined, {
        address: config.connection.address,
        namespace: config.connection.namespace,
        timeout: config.connection.timeout,
      });

      this.connection = await Connection.connect({
        address: config.connection.address,
        tls: config.connection.tls,
        connectTimeout: config.connection.timeout || 10000,
      });

      this.connectionAttempts = 0;
      this.logger.serviceInfo('Temporal连接创建成功', {
        address: config.connection.address,
        namespace: config.connection.namespace,
      });

      return this.connection;
    } catch (error) {
      this.connectionAttempts++;
      this.logger.serviceError('创建Temporal连接失败', error, {
        address: config.connection.address,
        attempts: this.connectionAttempts,
      });
      throw error;
    }
  }

  /**
   * 检查连接健康状态
   */
  async checkConnection(): Promise<boolean> {
    if (!this.connection) {
      this.logger.warn(LogCategory.SERVICE_ERROR, '连接不存在，需要重新创建');
      return false;
    }

    try {
      // 通过创建一个简单的客户端来测试连接
      const { Client } = await import('@temporalio/client');
      const client = new Client({
        connection: this.connection,
        namespace: this.config.connection.namespace,
      });

      // 尝试获取系统信息来测试连接
      // 这是一个轻量级的操作，用于验证连接是否正常
      await client.workflowService.getSystemInfo({});
      
      this.logger.debug('Temporal连接健康检查通过');
      return true;
    } catch (error) {
      this.logger.serviceError('Temporal连接健康检查失败', error, {
        address: this.config.connection.address,
      });
      return false;
    }
  }

  /**
   * 自动重连机制
   */
  async reconnect(): Promise<void> {
    if (this.isReconnecting) {
      this.logger.warn(LogCategory.SERVICE_INFO, '重连正在进行中，跳过本次重连');
      return;
    }

    this.isReconnecting = true;
    const maxAttempts = this.config.connection.retryAttempts || 5;
    const reconnectInterval = this.config.connection.reconnectInterval || 5000;

    this.logger.serviceInfo('开始Temporal连接重连流程', {
      maxAttempts,
      reconnectInterval,
    });

    let attempt = 0;
    while (attempt < maxAttempts && this.isReconnecting) {
      attempt++;
      
      try {
        this.logger.info(LogCategory.SERVICE_INFO, `尝试重连 (${attempt}/${maxAttempts})...`);
        
        // 关闭现有连接
        await this.closeConnection();
        
        // 等待一段时间后重连
        await this.delay(reconnectInterval * Math.pow(1.5, attempt - 1)); // 指数退避
        
        // 创建新连接
        await this.createConnection();
        
        // 验证连接
        const isHealthy = await this.checkConnection();
        if (isHealthy) {
          this.logger.serviceInfo('Temporal连接重连成功', { attempts: attempt });
          this.isReconnecting = false;
          return;
        }
      } catch (error) {
        this.logger.serviceError(`重连尝试 ${attempt} 失败`, error);
        
        if (attempt === maxAttempts) {
          this.logger.serviceError('达到最大重连次数，重连失败');
          this.isReconnecting = false;
          throw new Error(`Temporal重连失败，已尝试 ${maxAttempts} 次`);
        }
      }
    }
    
    this.isReconnecting = false;
  }

  /**
   * 启动定期健康检查
   */
  startHealthCheck(): void {
    const interval = this.config.monitoring?.healthCheckInterval || 30000; // 默认30秒

    this.logger.serviceInfo('启动Temporal连接健康检查', { 
      interval: `${interval}ms` 
    });

    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
    }

    this.reconnectTimer = setInterval(async () => {
      try {
        const isHealthy = await this.checkConnection();
        
        if (!isHealthy && !this.isReconnecting) {
          this.logger.warn(LogCategory.SERVICE_ERROR, '检测到连接异常，启动自动重连...');
          await this.reconnect();
        }
      } catch (error) {
        this.logger.serviceError('健康检查过程中发生错误', error);
      }
    }, interval);
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = undefined;
      this.logger.serviceInfo('Temporal连接健康检查已停止');
    }
  }

  /**
   * 获取当前连接实例
   */
  getConnection(): Connection | undefined {
    return this.connection;
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): {
    connected: boolean;
    attempts: number;
    isReconnecting: boolean;
    address: string;
    namespace: string;
  } {
    return {
      connected: !!this.connection,
      attempts: this.connectionAttempts,
      isReconnecting: this.isReconnecting,
      address: this.config.connection.address,
      namespace: this.config.connection.namespace,
    };
  }

  /**
   * 关闭连接
   */
  async closeConnection(): Promise<void> {
    this.stopHealthCheck();
    this.isReconnecting = false;

    if (this.connection) {
      try {
        await this.connection.close();
        this.connection = undefined;
        this.logger.serviceInfo('Temporal连接已关闭');
      } catch (error) {
        this.logger.serviceError('关闭Temporal连接时发生错误', error);
      }
    }
  }

  /**
   * 加载配置
   */
  private loadConfig(): TemporalConfig {
    return {
      connection: {
        address: `${this.configService.get('TEMPORAL_HOST', 'localhost')}:${this.configService.get('TEMPORAL_PORT', '7233')}`,
        namespace: this.configService.get('TEMPORAL_NAMESPACE', 'default'),
        timeout: parseInt(this.configService.get('TEMPORAL_CONNECT_TIMEOUT', '10000')),
        retryAttempts: parseInt(this.configService.get('TEMPORAL_RETRY_ATTEMPTS', '5')),
        reconnectInterval: parseInt(this.configService.get('TEMPORAL_RECONNECT_INTERVAL', '5000')),
      },
      workflow: {
        defaultTimeout: this.configService.get('WORKFLOW_EXECUTION_TIMEOUT', '30m'),
        maxRetryAttempts: parseInt(this.configService.get('WORKFLOW_MAX_RETRY_ATTEMPTS', '3')),
      },
      worker: {
        maxConcurrentActivities: parseInt(this.configService.get('WORKER_MAX_CONCURRENT_ACTIVITIES', '10')),
        maxConcurrentWorkflows: parseInt(this.configService.get('WORKER_MAX_CONCURRENT_WORKFLOWS', '3')),
        enableLogging: this.configService.get('WORKER_ENABLE_LOGGING', 'true') === 'true',
        shutdownTimeout: parseInt(this.configService.get('WORKER_SHUTDOWN_TIMEOUT', '30000')),
      },
      monitoring: {
        metricsInterval: parseInt(this.configService.get('TEMPORAL_METRICS_INTERVAL', '60000')),
        healthCheckInterval: parseInt(this.configService.get('TEMPORAL_HEALTH_CHECK_INTERVAL', '30000')),
        enableMetrics: this.configService.get('TEMPORAL_ENABLE_METRICS', 'true') === 'true',
        alertThresholds: {
          workflowFailureRate: parseFloat(this.configService.get('TEMPORAL_WORKFLOW_FAILURE_THRESHOLD', '0.1')),
          activityTimeoutRate: parseFloat(this.configService.get('TEMPORAL_ACTIVITY_TIMEOUT_THRESHOLD', '0.05')),
          workerDowntime: parseInt(this.configService.get('TEMPORAL_WORKER_DOWNTIME_THRESHOLD', '300')),
          responseTime: parseInt(this.configService.get('TEMPORAL_RESPONSE_TIME_THRESHOLD', '5000')),
        },
      },
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}