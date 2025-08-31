/**
 * Temporal配置接口定义
 * 统一管理所有Temporal相关配置
 */

import { TLSConfig } from '@temporalio/client';

/**
 * 重试退避策略
 */
export interface RetryBackoffStrategy {
  initialInterval?: string;
  maximumInterval?: string;
  backoffCoefficient?: number;
  maximumAttempts?: number;
}

/**
 * 告警阈值配置
 */
export interface AlertThresholds {
  workflowFailureRate?: number;     // 工作流失败率阈值 (0-1)
  activityTimeoutRate?: number;     // Activity超时率阈值 (0-1)
  workerDowntime?: number;          // Worker宕机时间阈值 (秒)
  queueBacklog?: number;            // 队列积压阈值
  responseTime?: number;            // 响应时间阈值 (毫秒)
}

/**
 * Temporal统一配置接口
 */
export interface TemporalConfig {
  connection: {
    address: string;                // Temporal服务地址 (如: localhost:7233)
    namespace: string;              // 命名空间 (统一使用 default)
    tls?: TLSConfig;               // TLS配置 (可选)
    timeout?: number;              // 连接超时时间 (毫秒)
    retryAttempts?: number;        // 连接重试次数
    reconnectInterval?: number;    // 重连间隔 (毫秒)
  };
  workflow: {
    defaultTimeout?: string;        // 默认工作流超时时间 (如: 30m)
    maxRetryAttempts?: number;     // 最大重试次数
    retryBackoff?: RetryBackoffStrategy; // 重试退避策略
  };
  worker: {
    maxConcurrentActivities?: number;      // 最大并发Activity数量
    maxConcurrentWorkflows?: number;       // 最大并发Workflow数量
    enableLogging?: boolean;               // 是否启用日志
    shutdownTimeout?: number;              // 关闭超时时间 (毫秒)
    maxActivitiesPerSecond?: number;       // Activity限流 (每秒最大数量)
  };
  monitoring: {
    metricsInterval?: number;              // 指标收集间隔 (毫秒)
    healthCheckInterval?: number;          // 健康检查间隔 (毫秒)
    alertThresholds?: AlertThresholds;     // 告警阈值配置
    enableMetrics?: boolean;               // 是否启用指标收集
  };
}

/**
 * 工作流启动选项
 */
export interface WorkflowStartOptions<T = any> {
  workflowType: any;                     // 工作流类型
  taskQueue: string;                     // 任务队列名称
  workflowId: string;                    // 工作流ID (必须唯一)
  args: T[];                            // 工作流参数
  timeout?: string;                     // 执行超时时间
  retryPolicy?: RetryBackoffStrategy;   // 重试策略
  searchAttributes?: Record<string, any>; // 搜索属性
  memo?: Record<string, any>;           // 备注信息
}

/**
 * 子工作流选项
 */
export interface ChildWorkflowOptions<T = any> {
  workflowType: any;                     // 子工作流类型
  taskQueue?: string;                    // 任务队列 (可继承父工作流)
  workflowId?: string;                   // 子工作流ID (可自动生成)
  args: T[];                            // 子工作流参数
  timeout?: string;                     // 执行超时时间
  retryPolicy?: RetryBackoffStrategy;   // 重试策略
  parentClosePolicy?: string;           // 父工作流关闭策略
}

/**
 * Worker创建选项
 */
export interface WorkerCreateOptions {
  taskQueue: string;                     // 任务队列名称
  workflowsPath?: string;               // 工作流文件路径
  activities?: any; // Activity实现 (支持各种类型)
  options?: {
    maxConcurrentActivities?: number;    // 最大并发Activity数量
    maxConcurrentWorkflows?: number;     // 最大并发Workflow数量
    enableLogging?: boolean;             // 是否启用详细日志
    shutdownTimeout?: number;            // 关闭超时时间
    stickyQueueScheduleToStartTimeout?: string; // Sticky队列超时
  };
}

/**
 * 工作流状态接口
 */
export interface WorkflowStatus {
  workflowId: string;
  runId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TERMINATED' | 'TIMED_OUT';
  startTime: Date;
  endTime?: Date;
  executionTime?: number;
  result?: any;
  failure?: {
    message: string;
    stackTrace?: string;
  };
}

/**
 * Worker健康状态
 */
export interface WorkerHealthStatus {
  healthy: boolean;
  totalWorkers: number;
  activeWorkers: number;
  failedWorkers: number;
  issues: Array<{
    workerId: string;
    taskQueue: string;
    issue: string;
    timestamp: Date;
  }>;
  lastChecked: Date;
}

/**
 * Temporal监控指标
 */
export interface TemporalMetrics {
  workflows: {
    total: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  activities: {
    total: number;
    running: number;
    completed: number;
    failed: number;
    timedOut: number;
  };
  workers: {
    total: number;
    active: number;
    idle: number;
  };
  performance: {
    averageWorkflowExecutionTime: number;  // 平均工作流执行时间 (毫秒)
    averageActivityExecutionTime: number;  // 平均Activity执行时间 (毫秒)
    throughput: number;                    // 吞吐量 (每分钟完成的工作流数量)
    errorRate: number;                     // 错误率 (0-1)
  };
  system: {
    cpuUsage: number;                      // CPU使用率 (0-100)
    memoryUsage: number;                   // 内存使用率 (0-100)
    connectionCount: number;               // 连接数量
  };
  timestamp: Date;
}

/**
 * 系统健康状态
 */
export interface SystemHealthStatus {
  overall: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  components: {
    connection: 'UP' | 'DOWN' | 'DEGRADED';
    workers: 'UP' | 'DOWN' | 'DEGRADED';
    workflows: 'UP' | 'DOWN' | 'DEGRADED';
  };
  metrics: TemporalMetrics;
  alerts: Array<{
    level: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    component: string;
    timestamp: Date;
  }>;
  lastChecked: Date;
}