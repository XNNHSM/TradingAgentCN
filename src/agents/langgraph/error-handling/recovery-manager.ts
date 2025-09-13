/**
 * 错误处理和恢复机制
 * 提供智能的错误分类、恢复策略和重试逻辑
 */

import { AnalysisState, AnalysisError } from '../state-manager';
import { BusinessLogger, LogCategory } from '../../../common/utils/business-logger.util';

/**
 * 错误分类器
 */
export class ErrorClassifier {
  
  /**
   * 分类错误类型
   */
  static classifyError(error: any): AnalysisError['type'] {
    const errorMessage = error?.message || '';
    const errorType = error?.type || '';
    const statusCode = error?.statusCode || error?.status;

    // 网络和连接错误
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('connection') ||
        errorType.includes('TIMEOUT')) {
      return 'TIMEOUT';
    }

    // 限流和配额错误
    if (errorMessage.includes('rate limit') || 
        errorMessage.includes('rate_limit') || 
        errorMessage.includes('429') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('too many requests') ||
        errorType.includes('RATE_LIMIT')) {
      return 'RATE_LIMIT';
    }

    // 认证和授权错误
    if (errorMessage.includes('API key') || 
        errorMessage.includes('auth') || 
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403') ||
        errorType.includes('AUTH_ERROR')) {
      return 'AUTH_ERROR';
    }

    // 数据相关错误
    if (errorMessage.includes('data') || 
        errorMessage.includes('fetch') || 
        errorMessage.includes('network') ||
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('ENOTFOUND') ||
        errorType.includes('DATA_ERROR')) {
      return 'DATA_ERROR';
    }

    // 服务器错误
    if (statusCode >= 500 && statusCode < 600) {
      return 'DATA_ERROR'; // 服务器错误可以重试
    }

    // 客户端错误
    if (statusCode >= 400 && statusCode < 500) {
      return 'UNKNOWN_ERROR'; // 客户端错误通常不可重试
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * 判断错误是否可重试
   */
  static isRetryable(errorType: AnalysisError['type']): boolean {
    const nonRetryableErrors = ['AUTH_ERROR'];
    return !nonRetryableErrors.includes(errorType);
  }

  /**
   * 计算重试延迟
   */
  static calculateRetryDelay(
    attempt: number, 
    errorType: AnalysisError['type']
  ): number {
    const baseDelay = {
      'TIMEOUT': 1000,        // 1秒
      'RATE_LIMIT': 5000,     // 5秒
      'DATA_ERROR': 2000,     // 2秒
      'UNKNOWN_ERROR': 1000,  // 1秒
    }[errorType] || 1000;

    // 指数退避
    const exponentialDelay = baseDelay * Math.pow(2, Math.min(attempt - 1, 5));
    
    // 添加随机抖动
    const jitter = exponentialDelay * 0.1 * Math.random();
    
    return Math.min(exponentialDelay + jitter, 30000); // 最大30秒
  }
}

/**
 * 恢复策略管理器
 */
export class RecoveryStrategyManager {
  private readonly logger: BusinessLogger;

  constructor() {
    this.logger = new BusinessLogger(RecoveryStrategyManager.name);
  }

  /**
   * 执行错误恢复
   */
  async executeRecovery(
    state: AnalysisState,
    error: AnalysisError
  ): Promise<Partial<AnalysisState>> {
    this.logger.serviceInfo(`开始错误恢复: ${error.agentName}`, {
      errorType: error.type,
      error: error.error,
      retryCount: state.retryCount,
    });

    try {
      switch (error.type) {
        case 'TIMEOUT':
          return await this.recoverFromTimeout(state, error);
        case 'RATE_LIMIT':
          return await this.recoverFromRateLimit(state, error);
        case 'DATA_ERROR':
          return await this.recoverFromDataError(state, error);
        case 'AUTH_ERROR':
          return await this.recoverFromAuthError(state, error);
        default:
          return await this.recoverFromUnknownError(state, error);
      }
    } catch (recoveryError) {
      this.logger.serviceError('错误恢复失败', recoveryError as Error, {
        originalError: error.error,
        recoveryError: (recoveryError as Error).message,
      });

      // 恢复失败，返回原始错误状态
      return {
        errors: [...state.errors, error],
        retryCount: state.retryCount + 1,
        currentStage: 'recovery_failed',
      };
    }
  }

  /**
   * 超时错误恢复
   */
  private async recoverFromTimeout(
    state: AnalysisState,
    error: AnalysisError
  ): Promise<Partial<AnalysisState>> {
    if (state.retryCount >= 3) {
      this.logger.warn(LogCategory.AGENT_ERROR, '超时重试次数已达上限', undefined, {
        agentName: error.agentName,
        retryCount: state.retryCount,
      });

      // 使用缓存数据或默认值继续执行
      return this.createFallbackResult(state, error, '使用超时策略继续执行');
    }

    // 延迟重试
    const delay = ErrorClassifier.calculateRetryDelay(state.retryCount + 1, error.type);
    await this.sleep(delay);

    return {
      currentStage: 'retrying_after_timeout',
      retryCount: state.retryCount + 1,
    };
  }

  /**
   * 限流错误恢复
   */
  private async recoverFromRateLimit(
    state: AnalysisState,
    error: AnalysisError
  ): Promise<Partial<AnalysisState>> {
    if (state.retryCount >= 2) {
      this.logger.warn(LogCategory.AGENT_ERROR, '限流重试次数已达上限', undefined, {
        agentName: error.agentName,
        retryCount: state.retryCount,
      });

      // 降级到更简单的模型或使用缓存
      return this.createFallbackResult(state, error, '使用降级策略继续执行');
    }

    // 较长的延迟
    const delay = ErrorClassifier.calculateRetryDelay(state.retryCount + 1, error.type);
    await this.sleep(delay);

    return {
      currentStage: 'retrying_after_rate_limit',
      retryCount: state.retryCount + 1,
    };
  }

  /**
   * 数据错误恢复
   */
  private async recoverFromDataError(
    state: AnalysisState,
    error: AnalysisError
  ): Promise<Partial<AnalysisState>> {
    if (state.retryCount >= 2) {
      this.logger.warn(LogCategory.AGENT_ERROR, '数据错误重试次数已达上限', undefined, {
        agentName: error.agentName,
        retryCount: state.retryCount,
      });

      // 使用备份数据源或模拟数据
      return this.createFallbackResult(state, error, '使用备份数据源继续执行');
    }

    // 尝试重新获取数据
    const delay = ErrorClassifier.calculateRetryDelay(state.retryCount + 1, error.type);
    await this.sleep(delay);

    return {
      currentStage: 'retrying_after_data_error',
      retryCount: state.retryCount + 1,
    };
  }

  /**
   * 认证错误恢复
   */
  private async recoverFromAuthError(
    state: AnalysisState,
    error: AnalysisError
  ): Promise<Partial<AnalysisState>> {
    this.logger.error(LogCategory.AGENT_ERROR, '认证错误，无法恢复', undefined, undefined, {
      agentName: error.agentName,
      error: error.error,
    });

    // 认证错误通常无法恢复，使用默认结果
    return this.createFallbackResult(state, error, '认证失败，使用默认分析结果');
  }

  /**
   * 未知错误恢复
   */
  private async recoverFromUnknownError(
    state: AnalysisState,
    error: AnalysisError
  ): Promise<Partial<AnalysisState>> {
    if (state.retryCount >= 1) {
      this.logger.warn(LogCategory.AGENT_ERROR, '未知错误重试次数已达上限', undefined, {
        agentName: error.agentName,
        retryCount: state.retryCount,
      });

      return this.createFallbackResult(state, error, '使用保守策略继续执行');
    }

    // 短暂延迟后重试
    const delay = ErrorClassifier.calculateRetryDelay(state.retryCount + 1, error.type);
    await this.sleep(delay);

    return {
      currentStage: 'retrying_after_unknown_error',
      retryCount: state.retryCount + 1,
    };
  }

  /**
   * 创建后备结果
   */
  private createFallbackResult(
    state: AnalysisState,
    error: AnalysisError,
    strategy: string
  ): Partial<AnalysisState> {
    this.logger.serviceInfo('创建后备结果', {
      agentName: error.agentName,
      strategy,
      errorType: error.type,
    });

    const fallbackError: AnalysisError = {
      ...error,
      error: `${error.error} (已使用${strategy})`,
    };

    return {
      errors: [...state.errors, fallbackError],
      currentStage: 'fallback_result_created',
      retryCount: state.retryCount + 1,
      metadata: {
        ...state.metadata,
        recoveryStrategy: strategy,
        originalError: error.error,
      },
    };
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 错误监控和报告器
 */
export class ErrorMonitor {
  private readonly logger: BusinessLogger;
  private readonly errorHistory: Map<string, Array<{
    error: AnalysisError;
    timestamp: Date;
    context: Partial<AnalysisState>;
  }>> = new Map();

  constructor() {
    this.logger = new BusinessLogger(ErrorMonitor.name);
  }

  /**
   * 记录错误
   */
  recordError(
    error: AnalysisError,
    state: AnalysisState
  ): void {
    const key = `${error.agentName}_${error.type}`;
    
    if (!this.errorHistory.has(key)) {
      this.errorHistory.set(key, []);
    }

    this.errorHistory.get(key)!.push({
      error,
      timestamp: new Date(),
      context: this.sanitizeState(state),
    });

    // 保持历史记录在合理范围内
    const history = this.errorHistory.get(key)!;
    if (history.length > 10) {
      history.shift(); // 移除最旧的记录
    }

    this.logger.error(LogCategory.AGENT_ERROR, '错误已记录', new Error(error.error), undefined, {
      agentName: error.agentName,
      errorType: error.type,
      retryable: error.retryable,
      stockCode: state.stockCode,
      sessionId: state.sessionId,
    });
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): {
    totalErrors: number;
    errorByType: Record<string, number>;
    errorByAgent: Record<string, number>;
    topErrors: Array<{
      key: string;
      count: number;
      lastOccurrence: Date;
    }>;
  } {
    const errorByType: Record<string, number> = {};
    const errorByAgent: Record<string, number> = {};

    let totalErrors = 0;

    for (const [key, errors] of this.errorHistory) {
      const count = errors.length;
      totalErrors += count;

      const [agentName, errorType] = key.split('_');
      
      errorByAgent[agentName] = (errorByAgent[agentName] || 0) + count;
      errorByType[errorType] = (errorByType[errorType] || 0) + count;
    }

    const topErrors = Array.from(this.errorHistory.entries())
      .map(([key, errors]) => ({
        key,
        count: errors.length,
        lastOccurrence: errors[errors.length - 1].timestamp,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors,
      errorByType,
      errorByAgent,
      topErrors,
    };
  }

  /**
   * 获取错误趋势
   */
  getErrorTrend(hours: number = 24): Array<{
    hour: Date;
    errorCount: number;
  }> {
    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
    
    const trend: Array<{ hour: Date; errorCount: number }> = [];
    
    for (let i = 0; i < hours; i++) {
      const hour = new Date(startTime.getTime() + i * 60 * 60 * 1000);
      const hourEnd = new Date(hour.getTime() + 60 * 60 * 1000);
      
      let errorCount = 0;
      
      for (const errors of this.errorHistory.values()) {
        errorCount += errors.filter(e => 
          e.timestamp >= hour && e.timestamp < hourEnd
        ).length;
      }
      
      trend.push({
        hour,
        errorCount,
      });
    }
    
    return trend;
  }

  /**
   * 清理旧错误记录
   */
  cleanupOldRecords(keepHours: number = 48): void {
    const cutoffTime = new Date(Date.now() - keepHours * 60 * 60 * 1000);
    
    for (const [key, errors] of this.errorHistory.entries()) {
      const filteredErrors = errors.filter(e => e.timestamp >= cutoffTime);
      
      if (filteredErrors.length === 0) {
        this.errorHistory.delete(key);
      } else {
        this.errorHistory.set(key, filteredErrors);
      }
    }
    
    this.logger.serviceInfo('错误记录清理完成', {
      removedOlderThan: keepHours,
      remainingKeys: this.errorHistory.size,
    });
  }

  /**
   * 清理状态中的敏感信息
   */
  private sanitizeState(state: AnalysisState): Partial<AnalysisState> {
    return {
      stockCode: state.stockCode,
      stockName: state.stockName,
      sessionId: state.sessionId,
      currentStage: state.currentStage,
      retryCount: state.retryCount,
      dataQuality: state.dataQuality,
      // 不包含可能包含敏感信息的 mcpData 和 metadata
    };
  }

  /**
   * 生成错误报告
   */
  generateErrorReport(): string {
    const stats = this.getErrorStats();
    const trend = this.getErrorTrend();
    
    let report = `# 错误监控报告\n\n`;
    report += `生成时间: ${new Date().toISOString()}\n\n`;
    
    report += `## 错误统计\n`;
    report += `- 总错误数: ${stats.totalErrors}\n`;
    report += `- 涉及智能体: ${Object.keys(stats.errorByAgent).length}\n`;
    report += `- 错误类型: ${Object.keys(stats.errorByType).length}\n\n`;
    
    report += `## 错误类型分布\n`;
    for (const [type, count] of Object.entries(stats.errorByType)) {
      report += `- ${type}: ${count}\n`;
    }
    
    report += `\n## 智能体错误分布\n`;
    for (const [agent, count] of Object.entries(stats.errorByAgent)) {
      report += `- ${agent}: ${count}\n`;
    }
    
    report += `\n## 主要错误\n`;
    for (const error of stats.topErrors.slice(0, 5)) {
      report += `- ${error.key}: ${error.count} 次 (最近: ${error.lastOccurrence.toISOString()})\n`;
    }
    
    report += `\n## 24小时错误趋势\n`;
    const recentTrend = trend.slice(-24);
    const maxErrors = Math.max(...recentTrend.map(t => t.errorCount), 1);
    
    for (const hour of recentTrend) {
      const bar = '█'.repeat(Math.round((hour.errorCount / maxErrors) * 10));
      report += `${hour.hour.getHours()}:00 | ${bar} ${hour.errorCount}\n`;
    }
    
    return report;
  }
}