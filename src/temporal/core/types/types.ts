/**
 * Temporal工作流类型定义
 */

export interface StockAnalysisInput {
  stockCode: string;
  stockName?: string;
  sessionId: string;
  metadata: Record<string, any>;
}

export interface StockAnalysisResult {
  sessionId: string;
  results: Array<{
    agentName: string;
    agentType: string;
    score: number;
    recommendation: string;
    analysis: string;
    confidence: number;
    keyInsights: string[];
    risks: string[];
    processingTime: number;
  }>;
  finalRecommendation: {
    agentName: string;
    agentType: string;
    score: number;
    recommendation: string;
    analysis: string;
    confidence: number;
    keyInsights: string[];
    risks: string[];
  };
}

// 注意：根据需求，不再支持批量分析功能
// 每次只分析一只股票，使用股票代码+日期作为workflowId保证唯一性