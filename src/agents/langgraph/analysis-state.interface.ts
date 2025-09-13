/**
 * LangGraphJS 股票分析状态接口
 * 定义工作流中传递的完整状态结构
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

export interface AgentNodeContext {
  state: AnalysisState;
  agentName: string;
  llmService: any;
  mcpClientService: any;
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