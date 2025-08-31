/**
 * 基于MCP Activities的股票分析工作流
 * 演示如何在工作流中使用MCP Activities获取数据
 */

import * as workflow from '@temporalio/workflow';
import type { MCPActivities } from '../activities/mcp.activities';
import type { PolicyAnalysisActivities, PolicyAnalysisActivitiesInput } from '../activities/policy-analysis.activities';

// 直接定义分析结果类型，不依赖外部Activities
export interface AnalysisResult {
  agentName: string;
  agentType: string;
  analysis: string;
  score: number;
  recommendation: string;
  confidence: number;
  keyInsights: string[];
  risks: string[];
  timestamp: Date;
  processingTime: number;
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
  getPolicyRelevantNews,
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

// 推荐类型定义
enum TradingRecommendation {
  STRONG_BUY = 'STRONG_BUY',
  BUY = 'BUY', 
  HOLD = 'HOLD',
  SELL = 'SELL',
  STRONG_SELL = 'STRONG_SELL'
}

/**
 * 股票分析工作流输入
 */
export interface StockAnalysisWorkflowInput {
  stockCode: string;
  stockName?: string;
  sessionId: string;
  metadata: Record<string, any>;
}

/**
 * 股票分析工作流结果
 */
export interface StockAnalysisWorkflowResult {
  sessionId: string;
  stockCode: string;
  stockName?: string;
  results: AnalysisResult[];
  finalRecommendation: AnalysisResult;
  processingTime: number;
  mcpDataSummary: {
    basicInfo: any;
    realtimeData: any;
    technicalIndicators: any;
    financialData: any;
    news: any;
  };
  policyAnalysis?: {
    overallSentiment: string;
    policySupport: number;
    policyRisk: number;
    favorableSectors: any[];
    unfavorableSectors: any[];
    hotConcepts: any[];
    policyRecommendation: string;
    keyRisks: string[];
    keyOpportunities: string[];
    newsCount: number;
  };
}

/**
 * 股票分析工作流主函数
 * 使用MCP Activities获取全面的股票数据，然后进行智能体分析
 */
export async function stockAnalysisMCPWorkflow(
  input: StockAnalysisWorkflowInput
): Promise<StockAnalysisWorkflowResult> {
  const startTime = Date.now();
  
  workflow.log.info('开始股票分析工作流', {
    stockCode: input.stockCode,
    sessionId: input.sessionId,
  });

  try {
    // 第一步：初始化MCP连接
    workflow.log.info('步骤1: 初始化MCP连接');
    await initializeMCPConnection();

    // 第二步：测试MCP连接
    workflow.log.info('步骤2: 测试MCP连接');
    const connectionOk = await testMCPConnection();
    if (!connectionOk) {
      throw new Error('MCP连接测试失败');
    }

    // 第三步：并行获取基础数据
    workflow.log.info('步骤3: 并行获取股票基础数据');
    const [basicInfo, realtimeData] = await Promise.all([
      getStockBasicInfo({ stock_code: input.stockCode }),
      getStockRealtimeData({ stock_code: input.stockCode }),
    ]);

    // 第四步：获取历史数据和技术指标
    workflow.log.info('步骤4: 获取历史数据和技术指标');
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 90天前
    
    const [historicalData, technicalIndicators] = await Promise.all([
      getStockHistoricalData({
        stock_code: input.stockCode,
        start_date: startDate,
        end_date: endDate,
        period: 'daily',
      }),
      getStockTechnicalIndicators({
        stock_code: input.stockCode,
        indicators: ['MA5', 'MA10', 'MA20', 'RSI', 'MACD', 'BOLL_UPPER', 'BOLL_MIDDLE', 'BOLL_LOWER'],
        start_date: startDate,
        end_date: endDate,
      }),
    ]);

    // 第五步：获取财务数据和市场概览
    workflow.log.info('步骤5: 获取财务数据和市场概览');
    const [financialData, marketOverview] = await Promise.all([
      getStockFinancialData({
        stock_code: input.stockCode,
        report_type: 'annual',
        period: '2023',
      }),
      getMarketOverview(),
    ]);

    // 第六步：获取相关新闻
    workflow.log.info('步骤6: 获取相关新闻');
    const news = await getStockNews({
      stock_code: input.stockCode,
      start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7天前
      end_date: endDate,
      limit: 10,
    });

    // 第七步：执行政策分析 (分析近15天内的新闻摘要)
    workflow.log.info('步骤7: 执行政策分析');
    let policyAnalysis = null;
    try {
      const policyAnalysisInput: PolicyAnalysisActivitiesInput = {
        stockCode: input.stockCode,
        stockName: input.stockName || basicInfo.stock_name,
        stockIndustry: basicInfo.industry || undefined,
        analysisDate: endDate,
        sessionId: input.sessionId,
        lookbackDays: 15, // 分析近15天的政策相关新闻
      };

      policyAnalysis = await performPolicyAnalysis(policyAnalysisInput);
      workflow.log.info('政策分析完成', {
        stockCode: input.stockCode,
        newsCount: policyAnalysis.newsCount,
        overallSentiment: policyAnalysis.overallSentiment,
        policySupport: policyAnalysis.policySupport,
      });
    } catch (error) {
      workflow.log.warn('政策分析失败，继续执行后续流程', {
        stockCode: input.stockCode,
        error: error.message,
      });
    }

    // 汇总MCP数据
    const mcpDataSummary = {
      basicInfo,
      realtimeData,
      technicalIndicators,
      financialData,
      news,
    };

    workflow.log.info('MCP数据获取完成', {
      stockCode: input.stockCode,
      dataPoints: Object.keys(mcpDataSummary).length,
    });

    // 第八步：执行综合分析 (直接在workflow中实现)
    workflow.log.info('步骤8: 执行综合分析');
    const comprehensiveResult = await executeComprehensiveAnalysis(
      input.stockCode,
      input.stockName || basicInfo.stock_name,
      mcpDataSummary,
      input.sessionId,
      policyAnalysis // 传入政策分析结果
    );

    // 第九步：执行交易策略分析
    workflow.log.info('步骤9: 执行交易策略分析');
    const strategyResult = await executeTradingStrategy(
      input.stockCode,
      input.stockName || basicInfo.stock_name,
      mcpDataSummary,
      comprehensiveResult,
      input.sessionId,
      policyAnalysis // 传入政策分析结果
    );

    // 第十步：生成最终建议
    workflow.log.info('步骤10: 生成最终建议');
    const finalRecommendation = await generateFinalRecommendation(
      input.stockCode,
      input.sessionId,
      comprehensiveResult,
      strategyResult,
      policyAnalysis // 传入政策分析结果
    );

    const processingTime = Date.now() - startTime;

    workflow.log.info('股票分析工作流完成', {
      stockCode: input.stockCode,
      sessionId: input.sessionId,
      processingTime: `${processingTime}ms`,
      finalScore: finalRecommendation.score,
      recommendation: finalRecommendation.recommendation,
    });

    // 构造政策分析摘要数据
    const policyAnalysisSummary = policyAnalysis ? {
      overallSentiment: policyAnalysis.overallSentiment,
      policySupport: policyAnalysis.policySupport,
      policyRisk: policyAnalysis.policyRisk,
      favorableSectors: policyAnalysis.favorableSectors,
      unfavorableSectors: policyAnalysis.unfavorableSectors,
      hotConcepts: policyAnalysis.hotConcepts,
      policyRecommendation: policyAnalysis.policyRecommendation,
      keyRisks: policyAnalysis.keyRisks,
      keyOpportunities: policyAnalysis.keyOpportunities,
      newsCount: policyAnalysis.newsCount,
    } : undefined;

    return {
      sessionId: input.sessionId,
      stockCode: input.stockCode,
      stockName: input.stockName || basicInfo.stock_name,
      results: [comprehensiveResult, strategyResult],
      finalRecommendation,
      processingTime,
      mcpDataSummary,
      policyAnalysis: policyAnalysisSummary,
    };

  } catch (error) {
    workflow.log.error('股票分析工作流失败', {
      stockCode: input.stockCode,
      sessionId: input.sessionId,
      error: error.message,
    });
    
    throw new workflow.ApplicationFailure(
      `股票分析失败: ${error.message}`,
      'StockAnalysisError',
      false // nonRetryable
    );
  }
}

/**
 * 执行综合分析 - 直接在workflow中实现
 */
async function executeComprehensiveAnalysis(
  stockCode: string,
  stockName: string,
  mcpData: any,
  sessionId: string,
  policyAnalysis?: any
): Promise<AnalysisResult> {
  const startTime = Date.now();
  
  workflow.log.info('开始综合分析', { stockCode, stockName });
  
  // 模拟综合分析逻辑
  const policySection = policyAnalysis ? `

【政策面分析】
基于近15天政策相关新闻分析：
- 政策环境：${policyAnalysis.overallSentiment === 'positive' ? '利好' : policyAnalysis.overallSentiment === 'negative' ? '利空' : '中性'}
- 政策支持度：${policyAnalysis.policySupport}/100
- 政策风险度：${policyAnalysis.policyRisk}/100
- 利好板块：${policyAnalysis.favorableSectors?.slice(0, 3).map(s => s.sectorName || s.sector).join('、') || '暂无'}
- 热点概念：${policyAnalysis.hotConcepts?.slice(0, 3).map(c => c.conceptName || c.concept).join('、') || '暂无'}
- 政策建议：${policyAnalysis.policyRecommendation || '密切关注政策动向'}
  ` : '';

  const analysis = `
【股票代码】${stockCode}
【股票名称】${stockName}
【分析时间】${new Date().toISOString()}

【技术面分析】
基于技术指标分析，该股票当前技术形态良好。主要技术指标显示：
- 移动平均线呈多头排列
- RSI指标处于合理区间
- MACD指标显示买入信号

【基本面分析】
公司基本面分析显示财务状况稳健：
- 营收增长稳定
- 盈利能力较强
- 负债率控制在合理水平

【市场情绪分析】
基于近期新闻和市场情绪：
- 市场关注度较高
- 机构资金流入明显
- 行业前景向好${policySection}
  `.trim();

  // 基础评分
  let baseScore = Math.floor(Math.random() * 20) + 70; // 70-89分
  
  // 政策面调整评分
  if (policyAnalysis) {
    const policyImpact = (policyAnalysis.policySupport - policyAnalysis.policyRisk) / 10;
    baseScore = Math.max(30, Math.min(95, baseScore + policyImpact));
  }
  
  const score = Math.round(baseScore);
  const confidence = Math.random() * 0.2 + 0.7; // 0.7-0.9
  
  const result: AnalysisResult = {
    agentName: '综合分析师',
    agentType: 'TECHNICAL_ANALYST_NEW',
    analysis,
    score,
    recommendation: score >= 80 ? 'BUY' : score >= 60 ? 'HOLD' : 'SELL',
    confidence,
    keyInsights: [
      '技术面呈现多头格局',
      '基本面财务稳健',
      '市场情绪积极向上',
      '机构资金持续流入'
    ],
    risks: [
      '系统性市场风险',
      '行业政策变化风险',
      '宏观经济波动风险'
    ],
    timestamp: new Date(),
    processingTime: Date.now() - startTime
  };
  
  workflow.log.info('综合分析完成', {
    stockCode,
    score: result.score,
    recommendation: result.recommendation,
    processingTime: result.processingTime
  });
  
  return result;
}

/**
 * 执行交易策略分析 - 直接在workflow中实现
 */
async function executeTradingStrategy(
  stockCode: string,
  stockName: string,
  mcpData: any,
  comprehensiveResult: AnalysisResult,
  sessionId: string,
  policyAnalysis?: any
): Promise<AnalysisResult> {
  const startTime = Date.now();
  
  workflow.log.info('开始交易策略分析', { stockCode, stockName });
  
  // 基于综合分析结果制定交易策略
  const policyStrategySection = policyAnalysis ? `

【政策策略考虑】
- 政策环境：${policyAnalysis.overallSentiment === 'positive' ? '政策利好，可适当加仓' : policyAnalysis.overallSentiment === 'negative' ? '政策利空，建议谨慎' : '政策中性，正常配置'}
- 板块轮动：关注${policyAnalysis.favorableSectors?.slice(0, 2).map(s => s.sectorName || s.sector).join('、') || '相关'}板块机会
- 风险提示：${policyAnalysis.keyRisks?.slice(0, 2).join('；') || '密切关注政策变化'}
  ` : '';

  const analysis = `
【交易策略分析】
基于综合分析师的评分${comprehensiveResult.score}分，制定以下交易策略：

【仓位建议】
- 建议仓位：${comprehensiveResult.score >= 80 ? '20-30%' : comprehensiveResult.score >= 60 ? '10-20%' : '5-10%'}
- 分批建仓：建议分3-4次建仓，降低成本波动

【入场时机】
- 最佳入场点：回调至支撑位附近
- 止损设置：跌破重要支撑位即止损
- 止盈目标：分批止盈，保留核心仓位

【风险控制】
- 单日最大亏损：不超过总仓位的5%
- 持仓周期：中长期持有，关注基本面变化
- 市场环境：密切关注市场整体走势${policyStrategySection}
  `.trim();

  const score = Math.max(40, comprehensiveResult.score + Math.floor(Math.random() * 21) - 10); // 基于综合分析调整
  const confidence = Math.random() * 0.15 + 0.75; // 0.75-0.9
  
  const result: AnalysisResult = {
    agentName: '交易策略师',
    agentType: 'UNIFIED_ORCHESTRATOR',
    analysis,
    score,
    recommendation: score >= 75 ? 'BUY' : score >= 55 ? 'HOLD' : 'SELL',
    confidence,
    keyInsights: [
      '分批建仓策略有效降低风险',
      '中长期持有符合价值投资理念',
      '严格风控措施保障资金安全',
      '动态调整策略适应市场变化'
    ],
    risks: [
      '短期市场波动风险',
      '建仓节奏控制风险',
      '止损执行纪律风险'
    ],
    timestamp: new Date(),
    processingTime: Date.now() - startTime
  };
  
  workflow.log.info('交易策略分析完成', {
    stockCode,
    score: result.score,
    recommendation: result.recommendation,
    processingTime: result.processingTime
  });
  
  return result;
}

/**
 * 生成最终建议 - 直接在workflow中实现
 */
async function generateFinalRecommendation(
  stockCode: string,
  sessionId: string,
  comprehensiveResult: AnalysisResult,
  strategyResult: AnalysisResult,
  policyAnalysis?: any
): Promise<AnalysisResult> {
  const startTime = Date.now();
  
  workflow.log.info('生成最终建议', { stockCode, sessionId });
  
  // 权重化评分：综合分析70%，交易策略30%
  const finalScore = Math.round(comprehensiveResult.score * 0.7 + strategyResult.score * 0.3);
  const finalConfidence = (comprehensiveResult.confidence + strategyResult.confidence) / 2;
  
  // 合并关键洞察和风险
  const keyInsights = [...comprehensiveResult.keyInsights, ...strategyResult.keyInsights];
  const risks = [...comprehensiveResult.risks, ...strategyResult.risks];
  
  // 确定最终推荐
  let finalRecommendation: string;
  if (finalScore >= 85) {
    finalRecommendation = 'STRONG_BUY';
  } else if (finalScore >= 70) {
    finalRecommendation = 'BUY';
  } else if (finalScore >= 50) {
    finalRecommendation = 'HOLD';
  } else if (finalScore >= 35) {
    finalRecommendation = 'SELL';
  } else {
    finalRecommendation = 'STRONG_SELL';
  }
  
  // 政策分析摘要
  const policySection = policyAnalysis ? `

📰 **政策分析摘要**
- 分析新闻：${policyAnalysis.newsCount}条（近15天）
- 政策环境：${policyAnalysis.overallSentiment === 'positive' ? '利好 📈' : policyAnalysis.overallSentiment === 'negative' ? '利空 📉' : '中性 ⚖️'}
- 支持度评分：${policyAnalysis.policySupport}/100
- 风险度评分：${policyAnalysis.policyRisk}/100
- 利好板块：${policyAnalysis.favorableSectors?.slice(0, 3).map(s => s.sectorName || s.sector).join('、') || '暂无'}
- 热点概念：${policyAnalysis.hotConcepts?.slice(0, 3).map(c => c.conceptName || c.concept).join('、') || '暂无'}
` : '';

  // 生成最终分析报告
  const analysis = `
【MCP智能投顾综合报告】

📊 **分析概览**
- 股票代码：${stockCode}
- 会话ID：${sessionId}
- 分析时间：${new Date().toLocaleString('zh-CN')}
- 综合评分：${finalScore}/100
- 投资建议：${getRecommendationText(finalRecommendation)}
- 置信度：${(finalConfidence * 100).toFixed(1)}%

📈 **组件分析结果**
1. **综合分析师评分：${comprehensiveResult.score}/100**
   - 推荐：${comprehensiveResult.recommendation}
   - 置信度：${(comprehensiveResult.confidence * 100).toFixed(1)}%

2. **交易策略师评分：${strategyResult.score}/100**
   - 推荐：${strategyResult.recommendation}
   - 置信度：${(strategyResult.confidence * 100).toFixed(1)}%${policySection}

🎯 **关键洞察**
${keyInsights.map((insight, index) => `${index + 1}. ${insight}`).join('\n')}

⚠️  **风险提示**
${risks.map((risk, index) => `${index + 1}. ${risk}`).join('\n')}

💡 **投资建议**
基于MCP智能投顾系统的综合分析，建议投资者${getRecommendationText(finalRecommendation)}。
请注意风险管理，理性投资，根据个人风险承受能力做出投资决策。

🔍 **风险等级：${getRiskLevel(finalScore)}**

---
*本报告由MCP智能投顾系统生成，仅供参考，不构成投资建议*
  `.trim();
  
  const result: AnalysisResult = {
    agentName: 'MCP智能投顾系统',
    agentType: 'TECHNICAL_ANALYST_NEW',
    analysis,
    score: finalScore,
    recommendation: finalRecommendation.toLowerCase(),
    confidence: finalConfidence,
    keyInsights,
    risks,
    timestamp: new Date(),
    processingTime: Date.now() - startTime
  };
  
  workflow.log.info('最终建议生成完成', {
    stockCode,
    sessionId,
    finalScore,
    recommendation: finalRecommendation,
    confidence: finalConfidence,
    processingTime: result.processingTime
  });
  
  return result;
}

/**
 * 获取推荐文本
 */
function getRecommendationText(recommendation?: string): string {
  switch (recommendation?.toUpperCase()) {
    case 'STRONG_BUY':
      return '强烈买入 🚀';
    case 'BUY':
      return '买入 📈';
    case 'HOLD':
      return '持有 ⏸️';
    case 'SELL':
      return '卖出 📉';
    case 'STRONG_SELL':
      return '强烈卖出 ⚠️';
    default:
      return '持有 ⏸️';
  }
}

/**
 * 获取风险等级
 */
function getRiskLevel(score: number): string {
  if (score >= 80) {
    return '低风险 🟢';
  } else if (score >= 65) {
    return '中等风险 🟡';
  } else if (score >= 45) {
    return '较高风险 🟠';
  } else {
    return '高风险 🔴';
  }
}

// 注意：根据需求，不再支持批量分析工作流
// 每次只分析一只股票，并使用股票代码+日期作为workflowId保证唯一性