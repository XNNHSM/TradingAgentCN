/**
 * LangGraphJS 状态管理核心组件
 * 提供统一的状态管理、持久化和序列化功能
 */

import { AgentResult, TradingRecommendation } from '../interfaces/agent.interface';

export interface AnalysisState {
  // 基础输入信息
  stockCode: string;
  stockName?: string;
  sessionId: string;
  workflowId?: string;
  
  // MCP 数据缓存
  mcpData: {
    basicInfo: any;
    realtimeData: any;
    historicalData: any;
    technicalIndicators: any;
    financialData: any;
    marketOverview: any;
    news: any;
  };
  
  // 智能体分析结果
  analysisResults: Map<string, AgentResult>;
  
  // 执行状态
  currentStage: string;
  errors: AnalysisError[];
  retryCount: number;
  dataQuality: DataQualityScore;
  
  // 决策元数据
  enableMessagePush?: boolean;
  isScheduledRun?: boolean;
  metadata?: Record<string, any>;
  
  // 性能监控
  startTime: number;
  processingTime?: number;
}

export interface AnalysisError {
  agentName: string;
  error: string;
  type: 'TIMEOUT' | 'RATE_LIMIT' | 'AUTH_ERROR' | 'DATA_ERROR' | 'UNKNOWN_ERROR';
  timestamp: Date;
  retryable: boolean;
}

export interface DataQualityScore {
  score: number; // 0-1
  factors: {
    dataCompleteness: number;
    dataFreshness: number;
    dataConsistency: number;
  };
  issues: string[];
}

export interface LangGraphWorkflowResult {
  sessionId: string;
  stockCode: string;
  stockName?: string;
  
  // 分析结果
  finalDecision: {
    overallScore: number;
    recommendation: TradingRecommendation;
    confidence: number;
    keyDecisionFactors: string[];
    riskAssessment: string[];
    actionPlan: string;
  };
  
  // 执行统计
  executionStats: {
    totalProcessingTime: number;
    successfulAgents: number;
    failedAgents: number;
    totalAgents: number;
    dataQuality: DataQualityScore;
  };
  
  // 所有智能体结果
  analysisResults: Map<string, AgentResult>;
  
  timestamp: Date;
}

// 图节点类型
export type GraphNodeType = 
  | 'data_collection'
  | 'data_quality_assessment' 
  | 'parallel_analysis'
  | 'sequential_analysis'
  | 'data_enhancement'
  | 'error_recovery'
  | 'result_aggregation'
  | 'decision_making'
  | 'error_recovery';

// 条件路由类型
export type GraphRoute = 
  | 'parallel_analysis'
  | 'sequential_analysis'
  | 'data_enhancement'
  | 'error_recovery'
  | 'complete';

/**
 * 状态管理器类
 * 提供状态的创建、验证、持久化和恢复功能
 */
export class StateManager {
  
  /**
   * 创建初始状态
   */
  static createInitialState(input: {
    stockCode: string;
    stockName?: string;
    sessionId: string;
    workflowId?: string;
    enableMessagePush?: boolean;
    isScheduledRun?: boolean;
    metadata?: Record<string, any>;
  }): AnalysisState {
    return {
      stockCode: input.stockCode,
      stockName: input.stockName,
      sessionId: input.sessionId,
      workflowId: input.workflowId,
      mcpData: {
        basicInfo: null,
        realtimeData: null,
        historicalData: null,
        technicalIndicators: null,
        financialData: null,
        marketOverview: null,
        news: null,
      },
      analysisResults: new Map(),
      currentStage: 'initialized',
      errors: [],
      retryCount: 0,
      dataQuality: {
        score: 0,
        factors: {
          dataCompleteness: 0,
          dataFreshness: 0,
          dataConsistency: 0,
        },
        issues: [],
      },
      enableMessagePush: input.enableMessagePush,
      isScheduledRun: input.isScheduledRun,
      metadata: input.metadata,
      startTime: Date.now(),
    };
  }

  /**
   * 验证状态完整性
   */
  static validateState(state: AnalysisState): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!state.stockCode) {
      errors.push('股票代码不能为空');
    }

    if (!state.sessionId) {
      errors.push('会话ID不能为空');
    }

    if (!state.mcpData) {
      errors.push('MCP数据对象不能为空');
    }

    if (!state.analysisResults) {
      errors.push('分析结果映射不能为空');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 序列化状态为可存储格式
   */
  static serializeState(state: AnalysisState): string {
    const serializableState = {
      ...state,
      analysisResults: Array.from(state.analysisResults.entries()),
      errors: state.errors.map(error => ({
        ...error,
        timestamp: error.timestamp.toISOString(),
      })),
      startTime: state.startTime,
      dataQuality: state.dataQuality,
    };

    return JSON.stringify(serializableState);
  }

  /**
   * 从序列化数据恢复状态
   */
  static deserializeState(serializedState: string): AnalysisState {
    const data = JSON.parse(serializedState);
    
    return {
      ...data,
      analysisResults: new Map(data.analysisResults || []),
      errors: (data.errors || []).map((error: any) => ({
        ...error,
        timestamp: new Date(error.timestamp),
      })),
      startTime: data.startTime,
      dataQuality: data.dataQuality,
    };
  }

  /**
   * 更新状态中的分析结果
   */
  static updateAnalysisResult(
    state: AnalysisState,
    agentName: string,
    result: AgentResult
  ): AnalysisState {
    const updatedResults = new Map(state.analysisResults);
    updatedResults.set(agentName, result);

    return {
      ...state,
      analysisResults: updatedResults,
      currentStage: `${agentName}_completed`,
    };
  }

  /**
   * 添加错误到状态
   */
  static addError(
    state: AnalysisState,
    error: AnalysisError
  ): AnalysisState {
    return {
      ...state,
      errors: [...state.errors, error],
      retryCount: state.retryCount + 1,
    };
  }

  /**
   * 更新数据质量评分
   */
  static updateDataQuality(
    state: AnalysisState,
    dataQuality: DataQualityScore
  ): AnalysisState {
    return {
      ...state,
      dataQuality,
    };
  }

  /**
   * 计算执行统计信息
   */
  static calculateExecutionStats(state: AnalysisState): LangGraphWorkflowResult['executionStats'] {
    const totalAgents = state.analysisResults.size;
    const successfulAgents = Array.from(state.analysisResults.values())
      .filter(result => result.success !== false).length;
    const failedAgents = totalAgents - successfulAgents;

    return {
      totalProcessingTime: Date.now() - state.startTime,
      successfulAgents,
      failedAgents,
      totalAgents,
      dataQuality: state.dataQuality,
    };
  }

  /**
   * 从状态生成最终结果
   */
  static generateFinalResult(state: AnalysisState): LangGraphWorkflowResult {
    const executionStats = this.calculateExecutionStats(state);
    
    // 从统一协调器获取最终决策
    const orchestratorResult = state.analysisResults.get('统一协调器');
    
    let finalDecision = {
      overallScore: 50,
      recommendation: TradingRecommendation.HOLD,
      confidence: 0.5,
      keyDecisionFactors: ['分析数据不足'],
      riskAssessment: ['数据完整性风险'],
      actionPlan: '建议获取更多信息后再做决策',
    };

    if (orchestratorResult && orchestratorResult.success !== false) {
      finalDecision = {
        overallScore: orchestratorResult.score || 50,
        recommendation: orchestratorResult.recommendation as TradingRecommendation || TradingRecommendation.HOLD,
        confidence: orchestratorResult.confidence || 0.5,
        keyDecisionFactors: orchestratorResult.keyInsights || ['综合分析结果'],
        riskAssessment: orchestratorResult.risks || ['市场波动风险'],
        actionPlan: this.extractActionPlan(orchestratorResult.analysis),
      };
    }

    return {
      sessionId: state.sessionId,
      stockCode: state.stockCode,
      stockName: state.stockName,
      finalDecision,
      executionStats,
      analysisResults: state.analysisResults,
      timestamp: new Date(),
    };
  }

  /**
   * 从分析文本中提取行动计划
   */
  private static extractActionPlan(analysis: string): string {
    const actionPatterns = [
      /(?:行动计划|执行策略|投资策略)[:：]\s*([^。]+)/i,
      /(?:建议|推荐)[:：]\s*([^。]+)/i,
    ];

    for (const pattern of actionPatterns) {
      const match = analysis.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return '请根据分析结果制定具体投资策略';
  }

  /**
   * 清理状态中的敏感信息
   */
  static sanitizeState(state: AnalysisState): AnalysisState {
    return {
      ...state,
      metadata: this.sanitizeMetadata(state.metadata),
      mcpData: this.sanitizeMcpData(state.mcpData),
    };
  }

  /**
   * 清理元数据中的敏感信息
   */
  private static sanitizeMetadata(metadata: Record<string, any> = {}): Record<string, any> {
    const sensitiveKeys = ['api_key', 'password', 'token', 'secret'];
    const sanitized = { ...metadata };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * 清理 MCP 数据中的敏感信息
   */
  private static sanitizeMcpData(mcpData: AnalysisState['mcpData']): AnalysisState['mcpData'] {
    return {
      basicInfo: this.sanitizeObject(mcpData.basicInfo),
      realtimeData: this.sanitizeObject(mcpData.realtimeData),
      historicalData: this.sanitizeObject(mcpData.historicalData),
      technicalIndicators: this.sanitizeObject(mcpData.technicalIndicators),
      financialData: this.sanitizeObject(mcpData.financialData),
      marketOverview: this.sanitizeObject(mcpData.marketOverview),
      news: this.sanitizeObject(mcpData.news),
    };
  }

  /**
   * 清理对象中的敏感信息
   */
  private static sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else if (typeof value === 'string' && this.isSensitiveData(value)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * 检查是否为敏感数据
   */
  private static isSensitiveData(data: string): boolean {
    const sensitivePatterns = [
      /api[_-]?key/i,
      /password/i,
      /token/i,
      /secret/i,
      /auth/i,
      /credential/i,
    ];

    return sensitivePatterns.some(pattern => pattern.test(data));
  }
}