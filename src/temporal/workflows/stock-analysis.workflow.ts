/**
 * 股票分析工作流 - 完全遵循8步标准流程
 * 
 * 根据CLAUDE.md中定义的股票分析标准流程，将工作流分为三个阶段：
 * 1. 数据收集阶段：获取数据并进行基础智能分析
 * 2. 专业分析阶段：基于数据进行专业化智能分析 
 * 3. 决策整合阶段：综合所有结果生成最终决策
 * 
 * 特性：
 * - 容错机制：当某个智能体调用失败时，自动跳过并继续下一步分析
 * - 数据验证：对MCP数据进行验证，失败时提供默认值
 * - 阶段隔离：每个阶段独立处理错误，不影响其他阶段
 * - 执行记录：在开始时创建analysis_records记录，完成时更新状态
 */

import * as workflow from '@temporalio/workflow';
import type { MCPActivities } from './agents/mcp.activities';
import type { AgentAnalysisActivities, AgentAnalysisResult } from './agents/agent-analysis.activities';
import { TradingRecommendation } from '../../agents/interfaces/agent.interface';

// 工作流输入类型
export interface StockAnalysisInput {
  stockCode: string;
  stockName?: string;
  sessionId: string;
  workflowId?: string; // 可选，由服务端传入
  metadata: Record<string, any>;
}

// 阶段分析结果
export interface StageAnalysisResult {
  stageName: string;
  results: AgentAnalysisResult[];
  processingTime: number;
  timestamp: Date;
}


// 最终工作流结果
export interface StockAnalysisResult {
  sessionId: string;
  stockCode: string;
  stockName?: string;
  
  // 三个分析阶段结果
  stage1DataCollection: StageAnalysisResult;
  stage2ProfessionalAnalysis: StageAnalysisResult; 
  stage3DecisionIntegration: StageAnalysisResult;
  
  // MCP数据汇总
  mcpDataSummary: {
    basicInfo: any;
    realtimeData: any;
    historicalData: any;
    technicalIndicators: any;
    financialData: any;
    marketOverview: any;
    news: any;
  };
  
    
  // 最终决策
  finalDecision: {
    overallScore: number;
    recommendation: TradingRecommendation;
    confidence: number;
    keyDecisionFactors: string[];
    riskAssessment: string[];
    actionPlan: string;
  };
  
  totalProcessingTime: number;
  timestamp: Date;
}

// 配置MCP Activities
const {
  getStockBasicInfo,
  getStockRealtimeData,
  getStockHistoricalData,
  getStockTechnicalIndicators,
  getStockFinancialData,
  getMarketOverview,
  getStockNews,
} = workflow.proxyActivities<MCPActivities>({
  startToCloseTimeout: '10m',
  scheduleToCloseTimeout: '15m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
    maximumInterval: '30s',
  },
});


// 配置智能体分析Activities
const {
  callBasicDataAgent,
  callTechnicalAnalystAgent,
  callFundamentalAnalystAgent,
  callNewsAnalystAgent,
  callIndustryAnalystAgent,
  callCompetitiveAnalystAgent,
  callValuationAnalystAgent,
  callRiskAnalystAgent,
  callUnifiedOrchestratorAgent,
  generateAnalysisSummary,
} = workflow.proxyActivities<AgentAnalysisActivities>({
  startToCloseTimeout: '5m',
  scheduleToCloseTimeout: '10m',
  retry: {
    maximumAttempts: 1, // 默认不重试
  },
});

// 配置分析记录Activities
const {
  createAnalysisRecord,
  updateAnalysisRecord,
} = workflow.proxyActivities<{
  createAnalysisRecord: (params: {
    sessionId: string;
    workflowId: string;
    stockCode: string;
    stockName?: string;
    analysisType: string;
    status: 'running' | 'success' | 'partial' | 'failed';
  }) => Promise<string>; // 返回记录ID
  updateAnalysisRecord: (params: {
    recordId: string;
    status?: 'running' | 'success' | 'partial' | 'failed';
    results?: Record<string, any>;
    averageScore?: number;
    finalRecommendation?: TradingRecommendation;
    confidence?: number;
    keyInsights?: string[];
    majorRisks?: string[];
    executionTime?: number;
    errorMessage?: string;
    summary?: string; // 新增摘要字段
    metadata?: Record<string, any>;
  }) => Promise<void>;
}>({
  startToCloseTimeout: '30s',
  scheduleToCloseTimeout: '1m',
  retry: {
    maximumAttempts: 1, // 默认不重试
  },
});

// 配置消息发送Activity
const { sendToAllProviders } = workflow.proxyActivities({
  taskQueue: 'message-send',
  startToCloseTimeout: '2m',
  retry: {
    maximumAttempts: 1, // 默认不重试
  },
});

// ===============================
// 消息格式化函数
// ===============================

/**
 * 格式化分析报告内容
 */
export function formatAnalysisReport(params: {
  stockCode: string;
  stockName: string;
  finalDecision: any;
  totalProcessingTime: number;
  summary?: string; // 新增摘要参数
  currentPrice?: number; // 新增当前价格参数
}): string {
  const { stockCode, stockName, finalDecision, totalProcessingTime, summary, currentPrice } = params;
  
  let content = `## ${stockName}（${stockCode}）分析报告\n\n`;
  
  // 添加当前价格信息
  if (currentPrice) {
    content += `**当前价格**: ¥${currentPrice.toFixed(2)}\n\n`;
  }
  
  // 添加详细的分析摘要（改进为数据驱动的明确摘要）
  if (summary) {
    content += `### 📋 分析摘要\n\n`;
    content += `${summary}\n\n`;
  }
  
  // 添加投资决策摘要（新增的明确数据部分）
  content += `### 💰 投资决策摘要\n\n`;
  content += `| 指标 | 数值 | 评级 |\n`;
  content += `|------|------|------|\n`;
  content += `| **综合评分** | ${finalDecision.overallScore}/100 | ${getScoreGrade(finalDecision.overallScore)} |\n`;
  content += `| **置信度** | ${Math.round(finalDecision.confidence * 100)}% | ${getConfidenceGrade(finalDecision.confidence)} |\n`;
  content += `| **风险等级** | ${calculateRiskLevel(finalDecision)} | ${getRiskGrade(finalDecision)} |\n`;
  
  // 投资建议中文映射
  const recommendationMap = {
    [TradingRecommendation.BUY]: '🟢 买入',
    [TradingRecommendation.HOLD]: '🟡 持有',
    [TradingRecommendation.SELL]: '🔴 卖出'
  };
  const recommendationText = recommendationMap[finalDecision.recommendation] || finalDecision.recommendation;
  content += `\n**最终建议**: ${recommendationText}\n\n`;
  
  // 将来预估（新增部分）
  content += `### 📈 将来预估\n\n`;
  content += generateFutureEstimation(finalDecision);
  
  // 交易策略（新增部分）
  content += `### 🎯 交易策略\n\n`;
  content += generateTradingStrategy(finalDecision, currentPrice);
  
  // 关键决策因素
  if (finalDecision.keyDecisionFactors && finalDecision.keyDecisionFactors.length > 0) {
    content += `### 🔍 关键决策因素\n\n`;
    finalDecision.keyDecisionFactors.forEach((factor: string, index: number) => {
      content += `${index + 1}. **${factor}**\n`;
    });
    content += '\n';
  }
  
  // 风险评估
  if (finalDecision.riskAssessment && finalDecision.riskAssessment.length > 0) {
    content += `### ⚠️ 风险评估\n\n`;
    finalDecision.riskAssessment.forEach((risk: string, index: number) => {
      content += `${index + 1}. ${risk}\n`;
    });
    content += '\n';
  }
  
  // 执行计划
  content += `### 📋 执行计划\n\n`;
  content += `**行动计划**: ${finalDecision.actionPlan || '根据分析结果制定投资策略'}\n\n`;
  
  content += `---\n`;
  content += `*本报告由智能交易代理系统自动生成，仅供参考学习，不构成投资建议*\n`;
  content += `*生成时间: ${new Date().toLocaleString()}*\n`;
  
  return content;
}

/**
 * 评分等级评定
 */
function getScoreGrade(score: number): string {
  if (score >= 80) return '优秀';
  if (score >= 70) return '良好';
  if (score >= 60) return '中等';
  if (score >= 50) return '一般';
  return '较差';
}

/**
 * 置信度等级评定
 */
function getConfidenceGrade(confidence: number): string {
  if (confidence >= 0.8) return '高';
  if (confidence >= 0.6) return '中等';
  if (confidence >= 0.4) return '一般';
  return '低';
}

/**
 * 计算风险等级
 */
function calculateRiskLevel(finalDecision: any): string {
  const score = finalDecision.overallScore;
  const confidence = finalDecision.confidence;
  
  // 基于评分和置信度计算风险等级
  if (score < 40 || confidence < 0.4) return '高';
  if (score < 60 || confidence < 0.6) return '中高';
  if (score < 70 || confidence < 0.8) return '中等';
  return '低';
}

/**
 * 风险等级评定
 */
function getRiskGrade(finalDecision: any): string {
  const riskLevel = calculateRiskLevel(finalDecision);
  const riskGrades = {
    '高': '🔴 高风险',
    '中高': '🟠 中高风险',
    '中等': '🟡 中等风险',
    '低': '🟢 低风险'
  };
  return riskGrades[riskLevel] || '未知风险';
}

/**
 * 生成将来预估
 */
function generateFutureEstimation(finalDecision: any): string {
  const score = finalDecision.overallScore;
  const confidence = finalDecision.confidence;
  const recommendation = finalDecision.recommendation;
  
  let estimation = '';
  
  // 基于评分和推荐的未来走势预估
  if (recommendation === TradingRecommendation.BUY) {
    estimation += `**短期预期（1-3个月）**: ${score >= 70 ? '乐观' : '谨慎乐观'}，预期涨幅${score >= 70 ? '5-15%' : '3-8%'}\n`;
    estimation += `**中期预期（3-12个月）**: ${confidence >= 0.7 ? '看好' : '中性'}，${confidence >= 0.7 ? '有望突破前期高点' : '需关注市场环境变化'}\n`;
  } else if (recommendation === TradingRecommendation.HOLD) {
    estimation += `**短期预期（1-3个月）**: 震荡整理，波动区间±${Math.round((100-score)/2)}%\n`;
    estimation += `**中期预期（3-12个月）**: ${score >= 50 ? '有望企稳回升' : '继续观望，等待明确信号'}\n`;
  } else {
    estimation += `**短期预期（1-3个月）**: 承压下行，支撑位在当前价位的${Math.max(70, 100-score)}%附近\n`;
    estimation += `**中期预期（3-12个月）**: ${score >= 40 ? '需要基本面改善支撑' : '谨慎对待，控制仓位'}\n`;
  }
  
  // 基于置信度的预估可靠性
  estimation += `\n**预估可靠性**: ${getConfidenceGrade(confidence)} (${Math.round(confidence * 100)}%)\n`;
  
  // 关键观察指标
  estimation += `\n**关键观察指标**:\n`;
  estimation += `- 技术面：关注成交量变化、关键技术位突破\n`;
  estimation += `- 基本面：关注${score >= 60 ? '业绩增长' : '业绩改善'}情况\n`;
  estimation += `- 市场面：关注${confidence >= 0.6 ? '行业政策' : '市场情绪'}变化\n`;
  
  return estimation + '\n';
}

/**
 * 生成交易策略
 */
function generateTradingStrategy(finalDecision: any, currentPrice?: number): string {
  const score = finalDecision.overallScore;
  const confidence = finalDecision.confidence;
  const recommendation = finalDecision.recommendation;
  
  let strategy = '';
  
  // 仓位建议
  strategy += `**仓位建议**:\n`;
  if (recommendation === TradingRecommendation.BUY) {
    strategy += `- 建议仓位: ${score >= 80 ? '20-30%' : score >= 70 ? '15-25%' : '10-20%'}\n`;
    strategy += `- 分批建仓: 建议${score >= 70 ? '2-3批' : '3-4批'}逐步建仓\n`;
  } else if (recommendation === TradingRecommendation.HOLD) {
    strategy += `- 建议仓位: 维持现有仓位${score >= 50 ? '（可小幅调整）' : '（不建议增仓）'}\n`;
    strategy += `- 调仓策略: ${score >= 50 ? '逢高适当减仓，逢低小幅补仓' : '以观望为主，减少操作'}\n`;
  } else {
    strategy += `- 建议仓位: 逐步减仓至${score >= 40 ? '5-10%' : '0-5%'}\n`;
    strategy += `- 减仓节奏: 建议${confidence >= 0.6 ? '2-3批' : '分批'}逐步减仓\n`;
  }
  
  // 止损止盈策略
  strategy += `\n**止损止盈策略**:\n`;
  if (recommendation === TradingRecommendation.BUY) {
    const stopLoss = Math.max(5, 15 - Math.round(score/10));
    const takeProfit = Math.min(25, 10 + Math.round(score/5));
    strategy += `- 止损位: 建议设置在买入价的${stopLoss}%以下`;
    if (currentPrice) {
      const stopLossPrice = currentPrice * (1 - stopLoss/100);
      strategy += `（约¥${stopLossPrice.toFixed(2)}）`;
    }
    strategy += `\n`;
    strategy += `- 止盈位: 建议设置在买入价的${takeProfit}%以上`;
    if (currentPrice) {
      const takeProfitPrice = currentPrice * (1 + takeProfit/100);
      strategy += `（约¥${takeProfitPrice.toFixed(2)}）`;
    }
    strategy += `\n`;
    strategy += `- 调整策略: 达到第一目标位后，可上移止损位保护利润\n`;
  } else if (recommendation === TradingRecommendation.HOLD) {
    const stopLoss = Math.max(8, 20 - Math.round(score/5));
    const takeProfit = Math.min(20, Math.round(score/3));
    strategy += `- 止损位: 建议设置在当前价位的${stopLoss}%以下`;
    if (currentPrice) {
      const stopLossPrice = currentPrice * (1 - stopLoss/100);
      strategy += `（约¥${stopLossPrice.toFixed(2)}）`;
    }
    strategy += `\n`;
    strategy += `- 止盈位: 建议设置在当前价位的${takeProfit}%以上`;
    if (currentPrice) {
      const takeProfitPrice = currentPrice * (1 + takeProfit/100);
      strategy += `（约¥${takeProfitPrice.toFixed(2)}）`;
    }
    strategy += `\n`;
    strategy += `- 观望策略: 突破关键位后再调整仓位\n`;
  } else {
    const stopLoss = Math.max(5, 15 - Math.round(score/10));
    strategy += `- 止损位: 严格执行当前价位${stopLoss}%的止损`;
    if (currentPrice) {
      const stopLossPrice = currentPrice * (1 - stopLoss/100);
      strategy += `（约¥${stopLossPrice.toFixed(2)}）`;
    }
    strategy += `\n`;
    strategy += `- 反弹策略: 可等待反弹后减仓，避免恐慌性抛售\n`;
  }
  
  // 时间框架
  strategy += `\n**操作时间框架**:\n`;
  strategy += `- 短线操作: 1-3个月，关注技术面变化\n`;
  strategy += `- 中线布局: 3-12个月，关注基本面改善\n`;
  strategy += `- 长线持有: 12个月以上，${confidence >= 0.7 ? '可考虑长线配置' : '建议谨慎长线持有'}\n`;
  
  // 风险控制
  strategy += `\n**风险控制**:\n`;
  strategy += `- 单只股票仓位: 不超过总资金的${recommendation === TradingRecommendation.BUY ? '30%' : '20%'}\n`;
  strategy += `- 行业集中度: 同行业股票总仓位不超过${confidence >= 0.6 ? '50%' : '40%'}\n`;
  strategy += `- 定期回顾: 建议${confidence >= 0.7 ? '每月' : '每季度'}评估投资逻辑\n`;
  
  return strategy + '\n';
}

// ===============================
// 容错辅助函数
// ===============================

/**
 * 安全调用智能体，失败时返回默认结果
 */
async function safeCallAgent<T extends any[]>(
  agentName: string,
  agentType: string,
  agentFunction: (...args: T) => Promise<AgentAnalysisResult>,
  ...args: T
): Promise<AgentAnalysisResult> {
  const startTime = Date.now();
  
  try {
    workflow.log.info(`正在调用智能体: ${agentName}`);
    const result = await agentFunction(...args);
    
    return {
      ...result,
      success: true,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    workflow.log.warn(`智能体调用失败: ${agentName}`, { 
      error: error.message,
      agentType 
    });
    
    return {
      agentName,
      agentType,
      analysis: `${agentName}调用失败，数据获取异常。建议：关注相关数据变化，谨慎决策。`,
      score: 50, // 中性分数
      recommendation: TradingRecommendation.HOLD, // 保守建议
      confidence: 0.1, // 低置信度
      keyInsights: ['数据获取异常', '建议人工核实'],
      risks: ['数据不完整', '分析可能不准确'],
      processingTime: Date.now() - startTime,
      success: false,
      errorMessage: error.message,
    };
  }
}

/**
 * 安全调用MCP数据获取，失败时返回默认值
 */
async function safeCallMCP<T, R>(
  funcName: string,
  mcpFunction: (params: T) => Promise<R>,
  params: T,
  defaultValue: R
): Promise<R> {
  try {
    workflow.log.info(`正在获取MCP数据: ${funcName}`);
    return await mcpFunction(params);
  } catch (error) {
    workflow.log.warn(`MCP数据获取失败: ${funcName}`, { 
      error: error.message 
    });
    return defaultValue;
  }
}

/**
 * 检查基础数据是否可用，如果关键数据缺失则抛出异常停止workflow
 */
function validateEssentialData(data: {
  basicInfo: any;
  realtimeData: any;
  financialData: any;
}): void {
  workflow.log.info('开始验证基础数据', {
    basicInfo: !!data.basicInfo,
    realtimeData: !!data.realtimeData,
    financialData: !!data.financialData
  });

  const essentialChecks = [
    { name: '基本信息', data: data.basicInfo, requiredFields: ['stock_code', 'stock_name'] },
    { name: '实时数据', data: data.realtimeData, requiredFields: ['price'] },
    { name: '财务数据', data: data.financialData, requiredFields: ['data'] }
  ];

  const missingData = essentialChecks.filter(check => {
    if (!check.data || typeof check.data !== 'object') {
      workflow.log.warn(`${check.name}数据缺失或格式错误`, { 
        数据类型: typeof check.data,
        数据内容: check.data 
      });
      return true;
    }
    
    const missingFields = check.requiredFields.filter(field => !check.data[field]);
    if (missingFields.length > 0) {
      workflow.log.warn(`${check.name}缺少必要字段`, { 
        缺失字段: missingFields,
        可用字段: Object.keys(check.data)
      });
      return true;
    }
    
    return false;
  });

  if (missingData.length > 0) {
    const missingFields = missingData.map(check => check.name).join('、');
    workflow.log.error('基础数据验证失败', {
      缺失数据: missingData.map(check => ({
        名称: check.name,
        缺失字段: check.requiredFields.filter(field => !check.data?.[field])
      })),
      数据概览: {
        基本信息: data.basicInfo ? Object.keys(data.basicInfo) : '无',
        实时数据: data.realtimeData ? Object.keys(data.realtimeData) : '无',
        财务数据: data.financialData ? Object.keys(data.financialData) : '无'
      }
    });
    
    throw new workflow.ApplicationFailure(
      `基础数据获取失败，缺少关键数据：${missingFields}。无法继续执行股票分析。`,
      'EssentialDataMissingError',
      false
    );
  }
  
  workflow.log.info('基础数据验证通过');
}


/**
 * 股票分析工作流主函数
 */
export async function stockAnalysisWorkflow(
  input: StockAnalysisInput
): Promise<StockAnalysisResult> {
  const startTime = Date.now();
  let analysisRecordId: string;
  
  workflow.log.info('开始股票分析工作流', {
    stockCode: input.stockCode,
    sessionId: input.sessionId,
  });

  try {
    // =================
    // 初始化阶段：创建分析记录
    // =================
    workflow.log.info('步骤0: 创建分析记录');
    if (!input.workflowId) {
      throw new Error('workflowId is required for analysis record creation');
    }
    
    analysisRecordId = await createAnalysisRecord({
      sessionId: input.sessionId,
      workflowId: input.workflowId,
      stockCode: input.stockCode,
      stockName: input.stockName,
      analysisType: 'comprehensive',
      status: 'running',
    });
    
    workflow.log.info(`分析记录已创建: ${analysisRecordId}`);

    // =================
    // 第一阶段：数据收集阶段 (对应标准流程1-2步)
    // =================
    workflow.log.info('步骤1: 开始第一阶段: 数据收集阶段');
    const stage1Result = await executeStage1DataCollection(input);
    
    // =================
    // 第二阶段：专业分析阶段 (对应标准流程3-7步)
    // =================
    workflow.log.info('步骤2: 开始第二阶段: 专业分析阶段');
    const stage2Result = await executeStage2ProfessionalAnalysis(input, stage1Result);
    
    // =================
    // 第三阶段：决策整合阶段 (对应标准流程第8步)
    // =================
    workflow.log.info('步骤3: 开始第三阶段: 决策整合阶段');
    const stage3Result = await executeStage3DecisionIntegration(input, stage1Result, stage2Result);

    // 生成最终决策
    const finalDecision = await generateFinalDecision(stage1Result, stage2Result, stage3Result);

    const totalProcessingTime = Date.now() - startTime;
    
    // 从第一阶段结果中获取MCP数据
    const mcpDataFromStage1 = (stage1Result.results[0] as any)?.mcpData || {};
    
    // 从实时数据中提取当前价格
    const realtimeData = mcpDataFromStage1.realtimeData || {};
    let currentPrice: number | undefined;
    
    // 尝试从不同的可能字段中获取价格
    if (realtimeData.price !== undefined) {
      currentPrice = parseFloat(realtimeData.price);
    } else if (realtimeData.current_price !== undefined) {
      currentPrice = parseFloat(realtimeData.current_price);
    } else if (realtimeData.close !== undefined) {
      currentPrice = parseFloat(realtimeData.close);
    } else if (realtimeData.latest_price !== undefined) {
      currentPrice = parseFloat(realtimeData.latest_price);
    }
    
    // 如果无法获取有效价格，记录警告但继续执行
    if (currentPrice === undefined || isNaN(currentPrice)) {
      workflow.log.warn('无法从实时数据中提取有效价格', { 
        stockCode: input.stockCode,
        realtimeData: JSON.stringify(realtimeData).substring(0, 200)
      });
    }

    // 汇总所有前置分析结果用于摘要生成
    const allPreviousResults = [
      ...stage1Result.results,
      ...stage2Result.results,
      ...stage3Result.results,
    ];

    // 从UnifiedOrchestratorAgent的结果中提取股票名称
  const orchestratorResult = stage3Result.results.find(r => r.agentType === 'UNIFIED_ORCHESTRATOR');
  const extractedStockName = orchestratorResult?.stockName || input.stockName || input.stockCode;

  // 生成分析摘要 - 调用Activity使用LLM生成
  const summary = await generateAnalysisSummary({
    finalDecision,
    stockName: extractedStockName,
    previousResults: allPreviousResults,
  });

  // 更新分析记录为完成状态
  await updateAnalysisRecord({
    recordId: analysisRecordId,
    status: 'success',
    results: {
      sessionId: input.sessionId,
      stockCode: input.stockCode,
      stockName: extractedStockName,
      stage1DataCollection: stage1Result,
      stage2ProfessionalAnalysis: stage2Result,
      stage3DecisionIntegration: stage3Result,
      mcpDataSummary: mcpDataFromStage1,
            finalDecision,
      totalProcessingTime,
      timestamp: new Date(),
    },
    averageScore: finalDecision.overallScore,
    finalRecommendation: finalDecision.recommendation,
    confidence: finalDecision.confidence,
    keyInsights: finalDecision.keyDecisionFactors,
    majorRisks: finalDecision.riskAssessment,
    executionTime: totalProcessingTime,
    summary, // 添加分析摘要
    metadata: {
      completedAt: new Date().toISOString(),
      workflowCompleted: true,
      stagesCompleted: [stage1Result, stage2Result, stage3Result],
    },
  });

  workflow.log.info('股票分析工作流完成', {
      stockCode: input.stockCode,
      sessionId: input.sessionId,
      totalProcessingTime: `${totalProcessingTime}ms`,
      finalScore: finalDecision.overallScore,
      recommendation: finalDecision.recommendation,
      extractedStockName,
    });

    // 发送分析结果到配置的消息通道（使用Activity）
    try {
      workflow.log.info('开始发送股票分析结果消息');
      
      const messageParams = {
        messageType: 'stock-analysis',
        title: `📈 ${extractedStockName}（${input.stockCode}）分析报告`,
        content: formatAnalysisReport({
          stockCode: input.stockCode,
          stockName: extractedStockName,
          finalDecision,
          totalProcessingTime,
          summary, // 传递分析摘要
          currentPrice, // 添加当前价格
        }),
        metadata: {
          sessionId: input.sessionId,
          workflowId: input.workflowId,
          stockCode: input.stockCode,
          stockName: extractedStockName,
          analysisCompletedAt: new Date().toISOString(),
          successfulAgentsCount: stage3Result.results.filter(r => r.success).length,
          totalAgentsCount: stage3Result.results.length,
          finalScore: finalDecision.overallScore,
          recommendation: finalDecision.recommendation,
          summary, // 在元数据中也包含摘要
        },
      };
      
      // 使用Activity发送消息，利用Temporal的重试机制
      const sendResult = await sendToAllProviders(messageParams);
      
      workflow.log.info('股票分析结果消息发送完成', { 
        stockCode: input.stockCode,
        extractedStockName,
        successCount: sendResult.filter(r => r.success).length,
        totalCount: sendResult.length
      });
    } catch (messageError) {
      workflow.log.warn('发送股票分析结果消息失败', {
        stockCode: input.stockCode,
        error: messageError.message,
      });
      // 消息发送失败不影响工作流结果
    }

    return {
      sessionId: input.sessionId,
      stockCode: input.stockCode,
      stockName: input.stockName,
      stage1DataCollection: stage1Result,
      stage2ProfessionalAnalysis: stage2Result,
      stage3DecisionIntegration: stage3Result,
      mcpDataSummary: mcpDataFromStage1,
            finalDecision,
      totalProcessingTime,
      timestamp: new Date(),
    };

  } catch (error) {
    workflow.log.error('股票分析工作流失败', {
      stockCode: input.stockCode,
      sessionId: input.sessionId,
      error: error.message,
    });

    // 更新分析记录为失败状态
    try {
      if (analysisRecordId) {
        await updateAnalysisRecord({
          recordId: analysisRecordId,
          status: 'failed',
          errorMessage: error.message,
          executionTime: Date.now() - startTime,
          metadata: {
            failedAt: new Date().toISOString(),
            workflowCompleted: false,
            error: error.message,
          },
        });
      }
    } catch (recordUpdateError) {
      workflow.log.warn('更新分析记录失败时记录失败', {
        error: recordUpdateError.message,
        originalError: error.message,
      });
    }
    
    throw new workflow.ApplicationFailure(
      `股票分析失败: ${error.message}`,
      'EnhancedStockAnalysisError',
      false
    );
  }
}

/**
 * 第一阶段：数据收集阶段
 * 对应标准流程步骤1-2：获取基础信息、基本面数据，并进行初步智能分析
 */
async function executeStage1DataCollection(
  input: StockAnalysisInput
): Promise<StageAnalysisResult> {
  const stageStartTime = Date.now();
  workflow.log.info('执行第一阶段: 数据收集阶段');

  // 安全并行获取所有基础数据
  workflow.log.info('步骤1-2: 安全并行获取基础数据（容错模式）');
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [basicInfo, realtimeData, historicalData, technicalIndicators, financialData, marketOverview, news] = 
    await Promise.all([
      safeCallMCP('getStockBasicInfo', getStockBasicInfo, 
        { stock_code: input.stockCode }, 
        { stock_name: input.stockCode, stock_code: input.stockCode, industry: '未知', market: '未知' }
      ),
      safeCallMCP('getStockRealtimeData', getStockRealtimeData, 
        { stock_code: input.stockCode }, 
        { price: 0, change: 0, change_percent: 0, volume: 0, market_cap: 0 }
      ),
      safeCallMCP('getStockHistoricalData', getStockHistoricalData, 
        {
          stock_code: input.stockCode,
          start_date: startDate,
          end_date: endDate,
          period: 'daily',
        }, 
        { data: [], message: '历史数据获取失败' }
      ),
      safeCallMCP('getStockTechnicalIndicators', getStockTechnicalIndicators, 
        {
          stock_code: input.stockCode,
          indicators: ['MA5', 'MA10', 'MA20', 'RSI', 'MACD', 'BOLL_UPPER', 'BOLL_MIDDLE', 'BOLL_LOWER'],
          start_date: startDate,
          end_date: endDate,
        }, 
        { data: [], message: '技术指标获取失败' }
      ),
      safeCallMCP('getStockFinancialData', getStockFinancialData, 
        {
          stock_code: input.stockCode,
          report_type: 'annual',
          period: '2023',
        }, 
        { data: [], message: '财务数据获取失败' }
      ),
      safeCallMCP('getMarketOverview', getMarketOverview, 
        { symbol: input.stockCode.startsWith('SH') || input.stockCode.startsWith('SZ') ? input.stockCode : 
              (input.stockCode.startsWith('6') || input.stockCode.startsWith('9') ? 'SH' + input.stockCode : 'SZ' + input.stockCode) }, 
        { market_trend: '未知', major_indices: [], message: '市场概况获取失败' }
      ),
      safeCallMCP('getStockNews', getStockNews, 
        {
          stock_code: input.stockCode,
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: endDate,
          limit: 10,
        }, 
        { news: [], message: '新闻数据获取失败' }
      ),
    ]);

  // 汇总MCP数据
  const mcpDataSummary = {
    basicInfo,
    realtimeData,
    historicalData,
    technicalIndicators,
    financialData,
    marketOverview,
    news,
  };

  // 检查基础数据是否可用，如果关键数据缺失则停止workflow
  workflow.log.info('验证基础数据完整性');
  validateEssentialData({
    basicInfo,
    realtimeData,
    financialData
  });

  
  // 第一阶段智能体分析：基础数据智能体(按需调用MCP服务) - 容错模式
  workflow.log.info('执行第一阶段智能体分析（容错模式）');
  
  const stage1Agents = await Promise.all([
    // BasicDataAgent：负责调用基础信息和实时数据MCP服务
    safeCallAgent(
      'BasicDataAgent',
      'BASIC_DATA_AGENT',
      callBasicDataAgent,
      {
        stockCode: input.stockCode,
        stockName: input.stockName || basicInfo.stock_name || input.stockCode,
        sessionId: input.sessionId,
        mcpData: { basicInfo, realtimeData },
      }
    ),
    
    // TechnicalAnalystAgent：负责调用历史数据和技术指标MCP服务
    safeCallAgent(
      'TechnicalAnalystAgent',
      'TECHNICAL_ANALYST',
      callTechnicalAnalystAgent,
      {
        stockCode: input.stockCode,
        stockName: input.stockName || basicInfo.stock_name || input.stockCode,
        sessionId: input.sessionId,
        mcpData: { historicalData, technicalIndicators },
      }
    ),
    
    // FundamentalAnalystAgent：负责调用财务数据MCP服务
    safeCallAgent(
      'FundamentalAnalystAgent',
      'FUNDAMENTAL_ANALYST',
      callFundamentalAnalystAgent,
      {
        stockCode: input.stockCode,
        stockName: input.stockName || basicInfo.stock_name || input.stockCode,
        sessionId: input.sessionId,
        mcpData: { financialData },
      }
    ),
    
    // NewsAnalystAgent：负责调用新闻数据MCP服务
    safeCallAgent(
      'NewsAnalystAgent',
      'NEWS_ANALYST',
      callNewsAnalystAgent,
      {
        sessionId: input.sessionId,
        days: 7, // 分析最近7天的市场新闻
        forceRefresh: false
      }
    ),
  ]);

  // 将MCP数据附加到结果中
  const enhancedStage1Results = stage1Agents.map((agent, index) => ({
    ...agent,
    ...(index === 0 ? { mcpData: mcpDataSummary } : {})
  }));

  return {
    stageName: '数据收集阶段',
    results: enhancedStage1Results,
    processingTime: Date.now() - stageStartTime,
    timestamp: new Date(),
  };
}

/**
 * 第二阶段：专业分析阶段
 * 对应标准流程步骤3-7：行业环境、竞争优势、市场情绪、估值水平、风险因素分析
 */
async function executeStage2ProfessionalAnalysis(
  input: StockAnalysisInput,
  stage1Result: StageAnalysisResult
): Promise<StageAnalysisResult> {
  const stageStartTime = Date.now();
  workflow.log.info('执行第二阶段: 专业分析阶段');

  // 从第一阶段结果中提取数据和分析结果
  const mcpData = (stage1Result.results[0] as any)?.mcpData || {};
  const policyData = (stage1Result.results[0] as any)?.policyData;
  const stage1Analysis = stage1Result.results.map(r => r.analysis).join('\n\n');

  // 第二阶段智能体分析：专业化分析智能体(基于第一阶段数据进行分析，不再调用MCP) - 容错模式
  workflow.log.info('执行第二阶段专业智能体分析（容错模式）');

  const stage2Agents = await Promise.all([
    // IndustryAnalystAgent：行业环境分析
    safeCallAgent(
      'IndustryAnalystAgent',
      'INDUSTRY_ANALYST',
      callIndustryAnalystAgent,
      {
        stockCode: input.stockCode,
        stockName: input.stockName || mcpData.basicInfo?.stock_name || input.stockCode,
        sessionId: input.sessionId,
        basicInfo: mcpData.basicInfo,
        marketOverview: mcpData.marketOverview,
        policyAnalysis: policyData,
        stage1Analysis,
      }
    ),
    
    // CompetitiveAnalystAgent：竞争优势分析
    safeCallAgent(
      'CompetitiveAnalystAgent',
      'COMPETITIVE_ANALYST',
      callCompetitiveAnalystAgent,
      {
        stockCode: input.stockCode,
        stockName: input.stockName || mcpData.basicInfo?.stock_name || input.stockCode,
        sessionId: input.sessionId,
        basicInfo: mcpData.basicInfo,
        financialData: mcpData.financialData,
        marketOverview: mcpData.marketOverview,
        stage1Analysis,
      }
    ),
    
    // ValuationAnalystAgent：估值水平分析
    safeCallAgent(
      'ValuationAnalystAgent',
      'VALUATION_ANALYST',
      callValuationAnalystAgent,
      {
        stockCode: input.stockCode,
        stockName: input.stockName || mcpData.basicInfo?.stock_name || input.stockCode,
        sessionId: input.sessionId,
        basicInfo: mcpData.basicInfo,
        financialData: mcpData.financialData,
        realtimeData: mcpData.realtimeData,
        stage1Analysis,
      }
    ),
    
    // RiskAnalystAgent：风险因素分析
    safeCallAgent(
      'RiskAnalystAgent',
      'RISK_ANALYST',
      callRiskAnalystAgent,
      {
        stockCode: input.stockCode,
        stockName: input.stockName || mcpData.basicInfo?.stock_name || input.stockCode,
        sessionId: input.sessionId,
        allMcpData: mcpData,
        policyAnalysis: policyData,
        stage1Analysis,
      }
    ),
  ]);

  return {
    stageName: '专业分析阶段',
    results: stage2Agents,
    processingTime: Date.now() - stageStartTime,
    timestamp: new Date(),
  };
}

/**
 * 第三阶段：决策整合阶段
 * 对应标准流程第8步：综合信息给出判断
 */
async function executeStage3DecisionIntegration(
  input: StockAnalysisInput,
  stage1Result: StageAnalysisResult,
  stage2Result: StageAnalysisResult
): Promise<StageAnalysisResult> {
  const stageStartTime = Date.now();
  workflow.log.info('执行第三阶段: 决策整合阶段');

  // 汇总所有前置分析结果
  const allPreviousResults = [
    ...stage1Result.results,
    ...stage2Result.results,
  ];

  // 第三阶段智能体分析：统一协调器(无MCP调用，纯整合分析) - 容错模式
  workflow.log.info('执行第三阶段统一协调分析（容错模式）');

  const stage3Agents = await Promise.all([
    // UnifiedOrchestratorAgent：整合所有结果生成最终投资建议
    safeCallAgent(
      'UnifiedOrchestratorAgent',
      'UNIFIED_ORCHESTRATOR',
      callUnifiedOrchestratorAgent,
      {
        stockCode: input.stockCode,
        stockName: input.stockName || input.stockCode,
        sessionId: input.sessionId,
        previousResults: allPreviousResults.map(r => ({
          agentName: r.agentName,
          agentType: r.agentType,
          analysis: r.analysis,
          score: r.score,
          recommendation: r.recommendation,
          confidence: r.confidence,
          keyInsights: r.keyInsights,
          risks: r.risks,
          success: r.success, // 添加成功状态信息
          errorMessage: r.errorMessage, // 添加错误信息
        })),
      }
    ),
  ]);

  return {
    stageName: '决策整合阶段',
    results: stage3Agents,
    processingTime: Date.now() - stageStartTime,
    timestamp: new Date(),
  };
}

/**
 * 生成最终决策（容错版）
 */
async function generateFinalDecision(
  stage1Result: StageAnalysisResult,
  stage2Result: StageAnalysisResult,
  stage3Result: StageAnalysisResult
): Promise<{
  overallScore: number;
  recommendation: TradingRecommendation;
  confidence: number;
  keyDecisionFactors: string[];
  riskAssessment: string[];
  actionPlan: string;
}> {
  workflow.log.info('生成最终投资决策（容错模式）');

  // 统计成功和失败的智能体
  const allResults = [
    ...stage1Result.results,
    ...stage2Result.results,
    ...stage3Result.results
  ];
  
  const successfulResults = allResults.filter(r => r.success !== false);
  const failedResults = allResults.filter(r => r.success === false);
  
  workflow.log.info('智能体执行统计', {
    total: allResults.length,
    successful: successfulResults.length,
    failed: failedResults.length,
    failedAgents: failedResults.map(r => r.agentName)
  });

  // 从统一协调器的结果中提取最终决策
  const orchestratorResult = stage3Result.results.find(r => r.agentType === 'UNIFIED_ORCHESTRATOR');
  
  if (orchestratorResult && orchestratorResult.success !== false) {
    // 根据失败率调整置信度
    const failureRate = failedResults.length / allResults.length;
    const adjustedConfidence = Math.max(0.1, (orchestratorResult.confidence || 0.7) * (1 - failureRate));
    
    return {
      overallScore: orchestratorResult.score || 50,
      recommendation: orchestratorResult.recommendation as TradingRecommendation || TradingRecommendation.HOLD,
      confidence: adjustedConfidence,
      keyDecisionFactors: [
        ...(orchestratorResult.keyInsights || ['综合分析结果']),
        ...(failedResults.length > 0 ? [`注意：${failedResults.length}个智能体分析失败`] : [])
      ],
      riskAssessment: [
        ...(orchestratorResult.risks || ['市场波动风险']),
        ...(failedResults.length > 0 ? ['数据完整性风险', '分析准确性风险'] : [])
      ],
      actionPlan: extractActionPlan(orchestratorResult.analysis),
    };
  }

  // 如果统一协调器也失败了，使用成功的智能体结果进行决策
  workflow.log.warn('统一协调器失败，使用成功智能体结果生成决策');
  
  const validScores = successfulResults
    .map(r => r.score)
    .filter(s => s !== undefined && !isNaN(s)) as number[];

  const avgScore = validScores.length > 0 ? 
    validScores.reduce((sum, score) => sum + score, 0) / validScores.length : 50;

  // 根据数据可用性调整置信度
  const dataAvailabilityRate = successfulResults.length / allResults.length;
  const baseConfidence = Math.max(0.1, 0.6 * dataAvailabilityRate);

  return {
    overallScore: Math.round(avgScore),
    recommendation: avgScore >= 70 ? TradingRecommendation.BUY : avgScore >= 40 ? TradingRecommendation.HOLD : TradingRecommendation.SELL,
    confidence: baseConfidence,
    keyDecisionFactors: [
      `基于${successfulResults.length}个成功智能体的分析`,
      ...(failedResults.length > 0 ? [`${failedResults.length}个智能体分析失败，结果可靠性降低`] : [])
    ],
    riskAssessment: [
      '市场波动风险',
      ...(failedResults.length > 0 ? ['数据获取风险', '分析完整性风险'] : []),
      ...(dataAvailabilityRate < 0.5 ? ['可用数据不足，建议谨慎决策'] : [])
    ],
    actionPlan: dataAvailabilityRate >= 0.7 ? 
      '基于现有分析结果执行投资策略' : 
      '数据不完整，建议获取更多信息后再做决策',
  };
}

/**
 * 从分析文本中提取行动计划
 */
function extractActionPlan(analysis: string): string {
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

