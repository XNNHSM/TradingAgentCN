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
import type { MCPActivities } from '../activities/mcp.activities';
import type { PolicyAnalysisActivities, PolicyAnalysisActivitiesInput } from '../activities/policy-analysis.activities';
import type { AgentAnalysisActivities, AgentAnalysisResult } from '../activities/agent-analysis.activities';

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
  
  // 政策分析结果
  policyAnalysis?: any;
  
  // 最终决策
  finalDecision: {
    overallScore: number;
    recommendation: string;
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
  initializeMCPConnection,
  testMCPConnection,
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

// 配置政策分析Activities  
const {
  performPolicyAnalysis,
} = workflow.proxyActivities<PolicyAnalysisActivities>({
  startToCloseTimeout: '5m',
  scheduleToCloseTimeout: '8m',
  retry: {
    maximumAttempts: 2,
    initialInterval: '2s',
    maximumInterval: '10s',
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
} = workflow.proxyActivities<AgentAnalysisActivities>({
  startToCloseTimeout: '5m',
  scheduleToCloseTimeout: '10m',
  retry: {
    maximumAttempts: 2,
    initialInterval: '2s',
    maximumInterval: '15s',
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
    finalRecommendation?: string;
    confidence?: number;
    keyInsights?: string[];
    majorRisks?: string[];
    executionTime?: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }) => Promise<void>;
}>({
  startToCloseTimeout: '30s',
  scheduleToCloseTimeout: '1m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
    maximumInterval: '10s',
  },
});

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
      recommendation: 'HOLD', // 保守建议
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
 * 安全执行政策分析
 */
async function safePolicyAnalysis(
  input: PolicyAnalysisActivitiesInput
): Promise<any> {
  try {
    workflow.log.info('正在执行政策分析');
    return await performPolicyAnalysis(input);
  } catch (error) {
    workflow.log.warn('政策分析失败，使用默认结果', { 
      error: error.message 
    });
    
    return [{
      sessionId: input.sessionId,
      analysisDate: input.analysisDate,
      stockCode: input.stockCode,
      stockName: input.stockName,
      positiveImpacts: [],
      negativeImpacts: [],
      neutralImpacts: [],
      overallSentiment: 'neutral',
      policyRisk: 50,
      policySupport: 50,
      favorableSectors: [],
      unfavorableSectors: [],
      hotConcepts: [],
      policyRecommendation: '政策分析数据获取异常，建议关注政策动向，谨慎投资。',
      keyRisks: ['政策分析数据不足', '分析结果可能不准确'],
      keyOpportunities: [],
      analysisSource: '容错机制默认结果',
      newsCount: 0,
      confidenceLevel: 0.1,
      processingTime: 0,
      success: false,
      errorMessage: error.message,
    }];
  }
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
    // 初始化MCP连接
    // =================
    workflow.log.info('步骤1: 初始化MCP连接');
    await initializeMCPConnection();
    const connectionOk = await testMCPConnection();
    if (!connectionOk) {
      throw new Error('MCP连接测试失败');
    }

    // =================
    // 第一阶段：数据收集阶段 (对应标准流程1-2步)
    // =================
    workflow.log.info('步骤2: 开始第一阶段: 数据收集阶段');
    const stage1Result = await executeStage1DataCollection(input);
    
    // =================
    // 第二阶段：专业分析阶段 (对应标准流程3-7步)
    // =================
    workflow.log.info('步骤3: 开始第二阶段: 专业分析阶段');
    const stage2Result = await executeStage2ProfessionalAnalysis(input, stage1Result);
    
    // =================
    // 第三阶段：决策整合阶段 (对应标准流程第8步)
    // =================
    workflow.log.info('步骤4: 开始第三阶段: 决策整合阶段');
    const stage3Result = await executeStage3DecisionIntegration(input, stage1Result, stage2Result);

    // 生成最终决策
    const finalDecision = await generateFinalDecision(stage1Result, stage2Result, stage3Result);

    const totalProcessingTime = Date.now() - startTime;
    
    // 从第一阶段结果中获取MCP数据
    const mcpDataFromStage1 = (stage1Result.results[0] as any)?.mcpData || {};
    const policyDataFromStage1 = (stage1Result.results[0] as any)?.policyData;

    // 更新分析记录为完成状态
  await updateAnalysisRecord({
    recordId: analysisRecordId,
    status: 'success',
    results: {
      sessionId: input.sessionId,
      stockCode: input.stockCode,
      stockName: input.stockName,
      stage1DataCollection: stage1Result,
      stage2ProfessionalAnalysis: stage2Result,
      stage3DecisionIntegration: stage3Result,
      mcpDataSummary: mcpDataFromStage1,
      policyAnalysis: policyDataFromStage1,
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
    });

    return {
      sessionId: input.sessionId,
      stockCode: input.stockCode,
      stockName: input.stockName,
      stage1DataCollection: stage1Result,
      stage2ProfessionalAnalysis: stage2Result,
      stage3DecisionIntegration: stage3Result,
      mcpDataSummary: mcpDataFromStage1,
      policyAnalysis: policyDataFromStage1,
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
        {}, 
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

  // 安全执行政策分析
  workflow.log.info('执行政策分析（容错模式）');
  const policyAnalysisInput: PolicyAnalysisActivitiesInput = {
    stockCode: input.stockCode,
    stockName: input.stockName || basicInfo.stock_name || input.stockCode,
    stockIndustry: basicInfo.industry || undefined,
    analysisDate: endDate,
    sessionId: input.sessionId,
    lookbackDays: 15,
  };
  const policyAnalysis = await safePolicyAnalysis(policyAnalysisInput);

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
        stockCode: input.stockCode,
        stockName: input.stockName || basicInfo.stock_name || input.stockCode,
        sessionId: input.sessionId,
        mcpData: { news },
      }
    ),
  ]);

  // 将MCP数据和政策分析结果附加到结果中
  const enhancedStage1Results = stage1Agents.map((agent, index) => ({
    ...agent,
    ...(index === 0 ? { mcpData: mcpDataSummary, policyData: policyAnalysis } : {})
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
  recommendation: string;
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
      recommendation: orchestratorResult.recommendation || 'HOLD',
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
    recommendation: avgScore >= 70 ? 'BUY' : avgScore >= 40 ? 'HOLD' : 'SELL',
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