/**
 * LangGraphJS 与 Temporal 工作流桥接器
 * 实现两个系统的无缝集成和统一调用接口
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessLogger, LogCategory } from '../../../common/utils/business-logger.util';
import { LangGraphServiceManager } from '../langgraph.service';
import { AgentsTemporalClientService } from '../../../temporal/workers/agents/agents-temporal-client.service';
import { AnalysisState, LangGraphWorkflowResult } from '../state-manager';
import { AgentExecutionRecordService } from '../../services/agent-execution-record.service';

/**
 * 工作流执行模式
 */
export enum WorkflowExecutionMode {
  LANGGRAPHJS = 'langgraphjs',
  TEMPORAL = 'temporal',
  HYBRID = 'hybrid',
  FALLBACK = 'fallback',
}

/**
 * 工作流桥接器配置
 */
export interface WorkflowBridgeConfig {
  /** 默认执行模式 */
  defaultMode: WorkflowExecutionMode;
  /** 是否启用自动故障转移 */
  enableAutoFailover: boolean;
  /** LangGraphJS 可用时优先使用 */
  preferLangGraphJS: boolean;
  /** 混合模式下的重试次数 */
  hybridRetryAttempts: number;
  /** 性能监控启用状态 */
  enablePerformanceMonitoring: boolean;
}

/**
 * 工作流执行结果
 */
export interface WorkflowExecutionResult {
  /** 执行模式 */
  mode: WorkflowExecutionMode;
  /** 执行状态 */
  success: boolean;
  /** 执行结果数据 */
  data?: any;
  /** 错误信息 */
  error?: string;
  /** 执行时间 */
  executionTime: number;
  /** 重试次数 */
  retryCount: number;
  /** 使用的系统信息 */
  systemInfo: {
    langgraphjsAvailable: boolean;
    temporalAvailable: boolean;
    fallbackUsed: boolean;
  };
}

/**
 * 工作流桥接器
 * 提供 LangGraphJS 和 Temporal 的统一调用接口
 */
@Injectable()
export class WorkflowBridgeService implements OnModuleInit {
  private readonly logger: BusinessLogger;
  private config: WorkflowBridgeConfig;
  private performanceMetrics: Map<string, Array<{
    mode: WorkflowExecutionMode;
    executionTime: number;
    success: boolean;
    timestamp: Date;
  }>> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly langGraphService: LangGraphServiceManager,
    private readonly temporalClient: AgentsTemporalClientService,
    private readonly executionRecordService: AgentExecutionRecordService,
  ) {
    this.logger = new BusinessLogger(WorkflowBridgeService.name);
  }

  /**
   * 模块初始化
   */
  async onModuleInit(): Promise<void> {
    await this.initializeConfig();
    this.logger.serviceInfo('工作流桥接器初始化完成', {
      config: this.config,
      langGraphjsAvailable: this.langGraphService.isAvailable(),
      temporalAvailable: this.isTemporalAvailable(),
    });
  }

  /**
   * 初始化配置
   */
  private async initializeConfig(): Promise<void> {
    this.config = {
      defaultMode: this.configService.get<WorkflowExecutionMode>(
        'WORKFLOW_BRIDGE_DEFAULT_MODE',
        WorkflowExecutionMode.HYBRID
      ),
      enableAutoFailover: this.configService.get<boolean>(
        'WORKFLOW_BRIDGE_AUTO_FAILOVER',
        true
      ),
      preferLangGraphJS: this.configService.get<boolean>(
        'WORKFLOW_BRIDGE_PREFER_LANGGRAPHJS',
        true
      ),
      hybridRetryAttempts: this.configService.get<number>(
        'WORKFLOW_BRIDGE_HYBRID_RETRY_ATTEMPTS',
        2
      ),
      enablePerformanceMonitoring: this.configService.get<boolean>(
        'WORKFLOW_BRIDGE_PERFORMANCE_MONITORING',
        true
      ),
    };

    // 根据系统可用性调整默认模式
    await this.adjustDefaultModeBasedOnAvailability();
  }

  /**
   * 根据系统可用性调整默认模式
   */
  private async adjustDefaultModeBasedOnAvailability(): Promise<void> {
    const langGraphjsAvailable = this.langGraphService.isAvailable();
    const temporalAvailable = await this.isTemporalAvailable();

    if (!langGraphjsAvailable && !temporalAvailable) {
      throw new Error('无可用的工作流执行系统');
    }

    if (!langGraphjsAvailable && this.config.defaultMode === WorkflowExecutionMode.LANGGRAPHJS) {
      this.logger.warn(LogCategory.SERVICE_ERROR, 'LangGraphJS 不可用，切换到 Temporal 模式', undefined, undefined);
      this.config.defaultMode = WorkflowExecutionMode.TEMPORAL;
    }

    if (!temporalAvailable && this.config.defaultMode === WorkflowExecutionMode.TEMPORAL) {
      this.logger.warn(LogCategory.SERVICE_ERROR, 'Temporal 不可用，切换到 LangGraphJS 模式', undefined, undefined);
      this.config.defaultMode = WorkflowExecutionMode.LANGGRAPHJS;
    }
  }

  /**
   * 执行股票分析工作流
   */
  async executeStockAnalysis(params: {
    stockCode: string;
    stockName?: string;
    sessionId: string;
    workflowId?: string;
    enableMessagePush?: boolean;
    isScheduledRun?: boolean;
    metadata?: Record<string, any>;
    forceMode?: WorkflowExecutionMode;
  }): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const executionMode = params.forceMode || this.config.defaultMode;
    
    this.logger.serviceInfo('开始执行股票分析工作流', {
      stockCode: params.stockCode,
      sessionId: params.sessionId,
      executionMode,
      forceMode: params.forceMode,
    });

    try {
      let result: WorkflowExecutionResult;

      switch (executionMode) {
        case WorkflowExecutionMode.LANGGRAPHJS:
          result = await this.executeWithLangGraphJS(params);
          break;
        case WorkflowExecutionMode.TEMPORAL:
          result = await this.executeWithTemporal(params);
          break;
        case WorkflowExecutionMode.HYBRID:
          result = await this.executeHybrid(params);
          break;
        case WorkflowExecutionMode.FALLBACK:
          result = await this.executeWithFallback(params);
          break;
        default:
          throw new Error(`不支持的执行模式: ${executionMode}`);
      }

      // 记录性能指标
      if (this.config.enablePerformanceMonitoring) {
        this.recordPerformanceMetrics(params.stockCode, result);
      }

      // 记录执行记录
      await this.recordExecution(params, result);

      this.logger.serviceInfo('股票分析工作流执行完成', {
        stockCode: params.stockCode,
        executionMode: result.mode,
        success: result.success,
        executionTime: result.executionTime,
        retryCount: result.retryCount,
      });

      return result;

    } catch (error) {
      this.logger.serviceError('工作流执行失败', error as Error, {
        stockCode: params.stockCode,
        sessionId: params.sessionId,
        executionMode,
      });

      // 如果启用了自动故障转移，尝试使用备用系统
      if (this.config.enableAutoFailover) {
        return await this.handleFailover(params, error as Error, startTime);
      }

      throw error;
    }
  }

  /**
   * 使用 LangGraphJS 执行工作流
   */
  private async executeWithLangGraphJS(params: any): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();

    if (!this.langGraphService.isAvailable()) {
      throw new Error('LangGraphJS 服务不可用');
    }

    try {
      const result = await this.langGraphService.executeStockAnalysis({
        stockCode: params.stockCode,
        stockName: params.stockName,
        sessionId: params.sessionId,
        workflowId: params.workflowId,
        enableMessagePush: params.enableMessagePush,
        isScheduledRun: params.isScheduledRun,
        metadata: params.metadata,
      });

      return {
        mode: WorkflowExecutionMode.LANGGRAPHJS,
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
        retryCount: 0,
        systemInfo: {
          langgraphjsAvailable: true,
          temporalAvailable: await this.isTemporalAvailable(),
          fallbackUsed: false,
        },
      };

    } catch (error) {
      return {
        mode: WorkflowExecutionMode.LANGGRAPHJS,
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
        retryCount: 0,
        systemInfo: {
          langgraphjsAvailable: true,
          temporalAvailable: await this.isTemporalAvailable(),
          fallbackUsed: false,
        },
      };
    }
  }

  /**
   * 使用 Temporal 执行工作流
   */
  private async executeWithTemporal(params: any): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();

    if (!(await this.isTemporalAvailable())) {
      throw new Error('Temporal 服务不可用');
    }

    try {
      // Temporal 返回 WorkflowHandle，需要等待工作流完成并获取结果
      const workflowHandle = await this.temporalClient.startStockAnalysisWorkflow(params as any);
      
      if (!workflowHandle) {
        throw new Error('启动Temporal工作流失败');
      }
      
      // 等待工作流完成并获取结果
      const result = await workflowHandle.result();

      return {
        mode: WorkflowExecutionMode.TEMPORAL,
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
        retryCount: 0,
        systemInfo: {
          langgraphjsAvailable: this.langGraphService.isAvailable(),
          temporalAvailable: true,
          fallbackUsed: false,
        },
      };

    } catch (error) {
      return {
        mode: WorkflowExecutionMode.TEMPORAL,
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
        retryCount: 0,
        systemInfo: {
          langgraphjsAvailable: this.langGraphService.isAvailable(),
          temporalAvailable: true,
          fallbackUsed: false,
        },
      };
    }
  }

  /**
   * 混合模式执行
   */
  private async executeHybrid(params: any): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let retryCount = 0;

    // 根据偏好选择优先执行模式
    const primaryMode = this.config.preferLangGraphJS && this.langGraphService.isAvailable()
      ? WorkflowExecutionMode.LANGGRAPHJS
      : WorkflowExecutionMode.TEMPORAL;

    const fallbackMode = primaryMode === WorkflowExecutionMode.LANGGRAPHJS
      ? WorkflowExecutionMode.TEMPORAL
      : WorkflowExecutionMode.LANGGRAPHJS;

    // 尝试主模式
    try {
      const primaryResult = await this.executeWithMode(params, primaryMode);
      if (primaryResult.success) {
        return primaryResult;
      }
      lastError = new Error(primaryResult.error);
    } catch (error) {
      lastError = error as Error;
    }

    retryCount++;

    // 尝试备用模式
    if (retryCount < this.config.hybridRetryAttempts) {
      try {
        const fallbackResult = await this.executeWithMode(params, fallbackMode);
        if (fallbackResult.success) {
          return {
            ...fallbackResult,
            retryCount,
            systemInfo: {
              ...fallbackResult.systemInfo,
              fallbackUsed: true,
            },
          };
        }
        lastError = new Error(fallbackResult.error);
      } catch (error) {
        lastError = error as Error;
      }
      retryCount++;
    }

    // 如果都失败了，返回错误结果
    return {
      mode: WorkflowExecutionMode.HYBRID,
      success: false,
      error: lastError?.message || '混合模式执行失败',
      executionTime: Date.now() - startTime,
      retryCount,
      systemInfo: {
        langgraphjsAvailable: this.langGraphService.isAvailable(),
        temporalAvailable: await this.isTemporalAvailable(),
        fallbackUsed: retryCount > 0,
      },
    };
  }

  /**
   * 使用指定模式执行
   */
  private async executeWithMode(params: any, mode: WorkflowExecutionMode): Promise<WorkflowExecutionResult> {
    switch (mode) {
      case WorkflowExecutionMode.LANGGRAPHJS:
        return await this.executeWithLangGraphJS(params);
      case WorkflowExecutionMode.TEMPORAL:
        return await this.executeWithTemporal(params);
      default:
        throw new Error(`不支持的执行模式: ${mode}`);
    }
  }

  /**
   * 故障转移处理
   */
  private async handleFailover(
    params: any,
    error: Error,
    startTime: number
  ): Promise<WorkflowExecutionResult> {
    this.logger.warn(LogCategory.SERVICE_ERROR, '尝试故障转移到备用系统', undefined, {
      originalError: error.message,
      stockCode: params.stockCode,
    });

    try {
      // 尝试使用另一个系统
      const fallbackResult = await this.executeWithFallback(params);
      
      this.logger.serviceInfo('故障转移成功', {
        originalMode: params.forceMode || this.config.defaultMode,
        fallbackMode: fallbackResult.mode,
        stockCode: params.stockCode,
      });

      return fallbackResult;

    } catch (fallbackError) {
      this.logger.serviceError('故障转移失败', fallbackError as Error, {
        originalError: error.message,
        stockCode: params.stockCode,
      });

      return {
        mode: WorkflowExecutionMode.FALLBACK,
        success: false,
        error: `原系统失败: ${error.message}, 故障转移失败: ${(fallbackError as Error).message}`,
        executionTime: Date.now() - startTime,
        retryCount: 0,
        systemInfo: {
          langgraphjsAvailable: this.langGraphService.isAvailable(),
          temporalAvailable: await this.isTemporalAvailable(),
          fallbackUsed: true,
        },
      };
    }
  }

  /**
   * 执行备用系统
   */
  private async executeWithFallback(params: any): Promise<WorkflowExecutionResult> {
    const langGraphjsAvailable = this.langGraphService.isAvailable();
    const temporalAvailable = await this.isTemporalAvailable();

    if (langGraphjsAvailable) {
      return await this.executeWithLangGraphJS(params);
    } else if (temporalAvailable) {
      return await this.executeWithTemporal(params);
    } else {
      throw new Error('无可用的工作流执行系统');
    }
  }

  /**
   * 检查 Temporal 是否可用
   */
  private async isTemporalAvailable(): Promise<boolean> {
    try {
      // 简单的健康检查
      await this.temporalClient.isConnected();
      return true;
    } catch (error) {
      this.logger.warn(LogCategory.SERVICE_ERROR, 'Temporal 健康检查失败', undefined, {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * 记录性能指标
   */
  private recordPerformanceMetrics(stockCode: string, result: WorkflowExecutionResult): void {
    const key = `${stockCode}_${result.mode}`;
    
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, []);
    }

    const metrics = this.performanceMetrics.get(key)!;
    metrics.push({
      mode: result.mode,
      executionTime: result.executionTime,
      success: result.success,
      timestamp: new Date(),
    });

    // 保持最近100条记录
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  /**
   * 记录执行记录
   */
  private async recordExecution(params: any, result: WorkflowExecutionResult): Promise<void> {
    try {
      await this.executionRecordService.create({
        sessionId: params.sessionId,
        agentType: 'WorkflowBridge',
        agentName: 'WorkflowBridgeService',
        executionPhase: 'workflow_execution',
        llmProvider: result.mode,
        llmModel: 'N/A',
        inputMessages: {
          input: JSON.stringify(params)
        },
        outputContent: JSON.stringify(result),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        executionTimeMs: result.executionTime,
        status: result.success ? 'success' : 'failed',
        metadata: {
          executionMode: result.mode,
          retryCount: result.retryCount,
          systemInfo: result.systemInfo,
          stockCode: params.stockCode,
        },
      });
    } catch (error) {
      this.logger.warn(LogCategory.SERVICE_ERROR, '记录执行记录失败', undefined, {
        error: (error as Error).message,
      });
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): {
    totalExecutions: number;
    averageExecutionTime: number;
    successRate: number;
    modeDistribution: Record<WorkflowExecutionMode, {
      count: number;
      averageTime: number;
      successRate: number;
    }>;
  } {
    const allMetrics = Array.from(this.performanceMetrics.values()).flat();
    
    if (allMetrics.length === 0) {
      return {
        totalExecutions: 0,
        averageExecutionTime: 0,
        successRate: 0,
        modeDistribution: {} as any,
      };
    }

    const totalExecutions = allMetrics.length;
    const averageExecutionTime = allMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalExecutions;
    const successRate = allMetrics.filter(m => m.success).length / totalExecutions;

    const modeDistribution: Record<WorkflowExecutionMode, any> = {} as any;
    
    for (const mode of Object.values(WorkflowExecutionMode)) {
      const modeMetrics = allMetrics.filter(m => m.mode === mode);
      if (modeMetrics.length > 0) {
        const modeCount = modeMetrics.length;
        const modeAverageTime = modeMetrics.reduce((sum, m) => sum + m.executionTime, 0) / modeCount;
        const modeSuccessRate = modeMetrics.filter(m => m.success).length / modeCount;
        
        modeDistribution[mode] = {
          count: modeCount,
          averageTime: modeAverageTime,
          successRate: modeSuccessRate,
        };
      }
    }

    return {
      totalExecutions,
      averageExecutionTime,
      successRate,
      modeDistribution,
    };
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<{
    langgraphjs: {
      available: boolean;
      health: any;
    };
    temporal: {
      available: boolean;
      health: any;
    };
    bridge: {
      config: WorkflowBridgeConfig;
      performance: ReturnType<typeof this.getPerformanceStats>;
    };
  }> {
    return {
      langgraphjs: {
        available: this.langGraphService.isAvailable(),
        health: this.langGraphService.getHealthStatus(),
      },
      temporal: {
        available: await this.isTemporalAvailable(),
        health: {
          available: await this.temporalClient.isConnected().catch(() => false),
          connectionStatus: this.temporalClient.getClientInfo().then(info => info.connectionStatus).catch(() => null),
        },
      },
      bridge: {
        config: this.config,
        performance: this.getPerformanceStats(),
      },
    };
  }

  /**
   * 更新配置
   */
  async updateConfig(config: Partial<WorkflowBridgeConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.logger.serviceInfo('工作流桥接器配置已更新', { config: this.config });
  }

  /**
   * 重置性能指标
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics.clear();
    this.logger.serviceInfo('性能指标已重置');
  }
}