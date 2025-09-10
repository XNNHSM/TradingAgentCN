/**
 * 智能体分析Activities
 * 为增强版股票分析工作流提供智能体LLM分析能力
 */

import { ConfigService } from '@nestjs/config';
import { BusinessLogger } from '../../../common/utils/business-logger.util';
import { BasicDataAgent } from '../../../agents/unified/basic-data.agent';
import { TechnicalAnalystAgent } from '../../../agents/unified/technical-analyst.agent';
import { FundamentalAnalystAgent } from '../../../agents/unified/fundamental-analyst.agent';
import { NewsAnalystAgent, NewsAnalysisInput, NewsAnalysisResult } from '../../../agents/unified/news-analyst.agent';
import { UnifiedOrchestratorAgent } from '../../../agents/unified/unified-orchestrator.agent';
import { IndustryAnalystAgent } from '../../../agents/unified/industry-analyst.agent';
import { CompetitiveAnalystAgent } from '../../../agents/unified/competitive-analyst.agent';
import { ValuationAnalystAgent } from '../../../agents/unified/valuation-analyst.agent';
import { LLMService } from '../../../agents/services/llm.service';
import { MCPClientSDKService } from '../../../agents/services/mcp-client-sdk.service';
import { AgentExecutionRecordService } from '../../../agents/services/agent-execution-record.service';
import { MarketNewsDataService } from '../../../agents/services/market-news-data.service';
import { NewsAnalysisCacheService } from '../../../agents/services/news-analysis-cache.service';
import { AgentContext, AgentResult } from '../../../agents/interfaces/agent.interface';

/**
 * 智能体分析结果接口
 */
export interface AgentAnalysisResult {
  agentName: string;
  agentType: string;
  analysis: string;
  score?: number;
  recommendation?: string;
  confidence?: number;
  keyInsights?: string[];
  risks?: string[];
  processingTime: number;
  success?: boolean;  // 可选：标记调用是否成功
  errorMessage?: string;  // 可选：错误信息（如果失败）
  stockName?: string; // 可选：股票名称
}

/**
 * 基础数据智能体调用参数
 */
export interface BasicDataAgentParams {
  stockCode: string;
  stockName: string;
  sessionId: string;
  mcpData: {
    basicInfo: any;
    realtimeData: any;
  };
}

/**
 * 技术分析智能体调用参数  
 */
export interface TechnicalAnalystParams {
  stockCode: string;
  stockName: string;
  sessionId: string;
  mcpData: {
    historicalData: any;
    technicalIndicators: any;
  };
}

/**
 * 基本面分析智能体调用参数
 */
export interface FundamentalAnalystParams {
  stockCode: string;
  stockName: string;
  sessionId: string;
  mcpData: {
    financialData: any;
  };
}

/**
 * 新闻分析智能体调用参数
 */
export interface NewsAnalystParams {
  sessionId: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  days?: number; // 最近N天的新闻分析
  forceRefresh?: boolean;
}

/**
 * 行业分析智能体调用参数
 */
export interface IndustryAnalystParams {
  stockCode: string;
  stockName: string;
  sessionId: string;
  basicInfo: any;
  marketOverview: any;
  policyAnalysis?: any;
  stage1Analysis: string;
}

/**
 * 竞争分析智能体调用参数
 */
export interface CompetitiveAnalystParams {
  stockCode: string;
  stockName: string;
  sessionId: string;
  basicInfo: any;
  financialData: any;
  marketOverview: any;
  stage1Analysis: string;
}

/**
 * 估值分析智能体调用参数
 */
export interface ValuationAnalystParams {
  stockCode: string;
  stockName: string;
  sessionId: string;
  basicInfo: any;
  financialData: any;
  realtimeData: any;
  stage1Analysis: string;
}

/**
 * 风险分析智能体调用参数
 */
export interface RiskAnalystParams {
  stockCode: string;
  stockName: string;
  sessionId: string;
  allMcpData: any;
  policyAnalysis?: any;
  stage1Analysis: string;
}

/**
 * 统一协调器调用参数
 */
export interface UnifiedOrchestratorParams {
  stockCode: string;
  stockName?: string;
  sessionId: string;
  previousResults: Array<{
    agentName: string;
    agentType: string;
    analysis: string;
    score?: number;
    recommendation?: string;
    confidence?: number;
    keyInsights?: string[];
    risks?: string[];
  }>;
}

/**
 * 智能体分析Activities接口定义
 */
export interface AgentAnalysisActivities {
  // 第一阶段：数据收集阶段智能体
  callBasicDataAgent: (params: BasicDataAgentParams) => Promise<AgentAnalysisResult>;
  callTechnicalAnalystAgent: (params: TechnicalAnalystParams) => Promise<AgentAnalysisResult>;
  callFundamentalAnalystAgent: (params: FundamentalAnalystParams) => Promise<AgentAnalysisResult>;
  callNewsAnalystAgent: (params: NewsAnalystParams) => Promise<AgentAnalysisResult>;
  
  // 第二阶段：专业分析阶段智能体
  callIndustryAnalystAgent: (params: IndustryAnalystParams) => Promise<AgentAnalysisResult>;
  callCompetitiveAnalystAgent: (params: CompetitiveAnalystParams) => Promise<AgentAnalysisResult>;
  callValuationAnalystAgent: (params: ValuationAnalystParams) => Promise<AgentAnalysisResult>;
  callRiskAnalystAgent: (params: RiskAnalystParams) => Promise<AgentAnalysisResult>;
  
  // 第三阶段：决策整合阶段智能体
  callUnifiedOrchestratorAgent: (params: UnifiedOrchestratorParams) => Promise<AgentAnalysisResult>;
  
  // 摘要生成方法
  generateAnalysisSummary: (params: {
    finalDecision: {
      overallScore: number;
      recommendation: string;
      confidence: number;
      keyDecisionFactors: string[];
      riskAssessment: string[];
      actionPlan: string;
    };
    stockName?: string;
    previousResults: any[];
  }) => Promise<string>;
}

/**
 * 创建智能体分析Activities实现
 */
export function createAgentAnalysisActivities(
  configService: ConfigService,
  llmService: LLMService,
  mcpClientService: MCPClientSDKService,
  executionRecordService?: AgentExecutionRecordService,
  marketNewsDataService?: MarketNewsDataService,
  newsAnalysisCacheService?: NewsAnalysisCacheService
): AgentAnalysisActivities {
  const logger = new BusinessLogger('AgentAnalysisActivities');

  // 创建智能体实例
  const basicDataAgent = new BasicDataAgent(llmService, configService, executionRecordService);
  const technicalAnalystAgent = new TechnicalAnalystAgent(llmService, configService, executionRecordService);
  const fundamentalAnalystAgent = new FundamentalAnalystAgent(llmService, configService, executionRecordService);
  const newsAnalystAgent = new NewsAnalystAgent(llmService, marketNewsDataService, newsAnalysisCacheService);
  const industryAnalystAgent = new IndustryAnalystAgent(llmService, configService, executionRecordService);
  const competitiveAnalystAgent = new CompetitiveAnalystAgent(llmService, configService, executionRecordService);
  const valuationAnalystAgent = new ValuationAnalystAgent(llmService, configService, executionRecordService);
  const unifiedOrchestratorAgent = new UnifiedOrchestratorAgent(llmService, configService, executionRecordService);

  /**
   * 调用智能体的通用方法
   */
  const callAgent = async (
    agent: any,
    context: AgentContext,
    agentTypeName: string
  ): Promise<AgentAnalysisResult> => {
    try {
      logger.serviceInfo(`调用智能体: ${agentTypeName}`, {
        stockCode: context.stockCode,
        sessionId: context.metadata?.sessionId,
      });

      const startTime = Date.now();
      const result: AgentResult = await agent.analyze(context);
      const processingTime = Date.now() - startTime;

      logger.serviceInfo(`智能体 ${agentTypeName} 分析完成`, {
        stockCode: context.stockCode,
        processingTime: `${processingTime}ms`,
        score: result.score,
        recommendation: result.recommendation,
      });

      return {
        agentName: result.agentName || agentTypeName,
        agentType: result.agentType || agentTypeName,
        analysis: result.analysis,
        score: result.score,
        recommendation: result.recommendation,
        confidence: result.confidence,
        keyInsights: result.keyInsights,
        risks: result.risks,
        processingTime: result.processingTime || processingTime,
        stockName: result.stockName,
      };
    } catch (error) {
      logger.businessError(`智能体 ${agentTypeName} 调用失败`, error, {
        stockCode: context.stockCode,
        sessionId: context.metadata?.sessionId,
      });
      throw error;
    }
  };

  return {
    // =================
    // 第一阶段：数据收集阶段智能体
    // =================
    
    callBasicDataAgent: async (params: BasicDataAgentParams): Promise<AgentAnalysisResult> => {
      const context: AgentContext = {
        stockCode: params.stockCode,
        stockName: params.stockName,
        metadata: {
          sessionId: params.sessionId,
          mcpData: params.mcpData,
          analysisType: 'basic_data_collection',
        },
      };
      return await callAgent(basicDataAgent, context, 'BasicDataAgent');
    },

    callTechnicalAnalystAgent: async (params: TechnicalAnalystParams): Promise<AgentAnalysisResult> => {
      const context: AgentContext = {
        stockCode: params.stockCode,
        stockName: params.stockName,
        metadata: {
          sessionId: params.sessionId,
          mcpData: params.mcpData,
          analysisType: 'technical_analysis',
        },
      };
      return await callAgent(technicalAnalystAgent, context, 'TechnicalAnalystAgent');
    },

    callFundamentalAnalystAgent: async (params: FundamentalAnalystParams): Promise<AgentAnalysisResult> => {
      const context: AgentContext = {
        stockCode: params.stockCode,
        stockName: params.stockName,
        metadata: {
          sessionId: params.sessionId,
          mcpData: params.mcpData,
          analysisType: 'fundamental_analysis',
        },
      };
      return await callAgent(fundamentalAnalystAgent, context, 'FundamentalAnalystAgent');
    },

    callNewsAnalystAgent: async (params: NewsAnalystParams): Promise<AgentAnalysisResult> => {
      try {
        let marketNewsResult: NewsAnalysisResult;
        
        // 根据参数选择分析方法
        if (params.days) {
          // 分析最近N天的新闻
          marketNewsResult = await newsAnalystAgent.analyzeRecentMarketNews(
            params.days,
            params.forceRefresh || false
          );
        } else if (params.dateRange) {
          // 分析指定日期范围的新闻
          const input: NewsAnalysisInput = {
            startDate: params.dateRange.startDate,
            endDate: params.dateRange.endDate,
            analysisDate: new Date().toISOString().split('T')[0],
            sessionId: params.sessionId,
            newsSummaries: [],
            forceRefresh: params.forceRefresh || false
          };
          marketNewsResult = await newsAnalystAgent.analyzeMarketNews(input);
        } else {
          // 默认分析最近7天的新闻
          marketNewsResult = await newsAnalystAgent.analyzeRecentMarketNews(7, params.forceRefresh || false);
        }
        
        // 将市场新闻分析结果转换为AgentAnalysisResult格式
        return {
          agentName: 'MarketNewsAnalyst',
          agentType: 'NEWS_ANALYST',
          analysis: JSON.stringify(marketNewsResult),
          score: Math.round((marketNewsResult.marketSupport - marketNewsResult.marketRisk) / 2 + 50),
          confidence: marketNewsResult.confidenceLevel,
          keyInsights: [
            `市场情绪: ${marketNewsResult.overallSentiment}`,
            `支持度: ${marketNewsResult.marketSupport}/100`,
            `风险度: ${marketNewsResult.marketRisk}/100`,
            `分析新闻数: ${marketNewsResult.newsCount}条`
          ],
          risks: marketNewsResult.keyRisks,
          processingTime: marketNewsResult.processingTime,
        };
      } catch (error) {
        logger.businessError('市场新闻分析失败', error, {
          sessionId: params.sessionId,
          dateRange: params.dateRange,
          days: params.days
        });
        
        // 返回错误结果
        return {
          agentName: 'MarketNewsAnalyst',
          agentType: 'NEWS_ANALYST',
          analysis: '市场新闻分析失败',
          score: 50,
          confidence: 0.1,
          keyInsights: ['分析失败'],
          risks: ['市场新闻分析异常'],
          processingTime: 0,
          success: false,
          errorMessage: error instanceof Error ? error.message : '未知错误',
          stockName: undefined,
        };
      }
    },

    // =================
    // 第二阶段：专业分析阶段智能体
    // =================
    
    callIndustryAnalystAgent: async (params: IndustryAnalystParams): Promise<AgentAnalysisResult> => {
      // 使用专门的行业分析师
      const context: AgentContext = {
        stockCode: params.stockCode,
        stockName: params.stockName,
        metadata: {
          sessionId: params.sessionId,
          analysisData: {
            basicInfo: params.basicInfo,
            marketOverview: params.marketOverview,
            policyAnalysis: params.policyAnalysis,
          },
        },
        previousResults: params.stage1Analysis ? [{
          agentName: 'Stage1Analysis',
          agentType: 'stage1' as any,
          analysis: params.stage1Analysis,
          timestamp: new Date(),
        }] : undefined,
      };
      return await callAgent(industryAnalystAgent, context, 'IndustryAnalystAgent');
    },

    callCompetitiveAnalystAgent: async (params: CompetitiveAnalystParams): Promise<AgentAnalysisResult> => {
      // 使用专门的竞争分析师
      const context: AgentContext = {
        stockCode: params.stockCode,
        stockName: params.stockName,
        metadata: {
          sessionId: params.sessionId,
          analysisData: {
            basicInfo: params.basicInfo,
            financialData: params.financialData,
            marketOverview: params.marketOverview,
          },
        },
        previousResults: params.stage1Analysis ? [{
          agentName: 'Stage1Analysis',
          agentType: 'stage1' as any,
          analysis: params.stage1Analysis,
          timestamp: new Date(),
        }] : undefined,
      };
      return await callAgent(competitiveAnalystAgent, context, 'CompetitiveAnalystAgent');
    },

    callValuationAnalystAgent: async (params: ValuationAnalystParams): Promise<AgentAnalysisResult> => {
      // 使用专门的估值分析师
      const context: AgentContext = {
        stockCode: params.stockCode,
        stockName: params.stockName,
        metadata: {
          sessionId: params.sessionId,
          analysisData: {
            basicInfo: params.basicInfo,
            financialData: params.financialData,
            realtimeData: params.realtimeData,
          },
        },
        previousResults: params.stage1Analysis ? [{
          agentName: 'Stage1Analysis',
          agentType: 'stage1' as any,
          analysis: params.stage1Analysis,
          timestamp: new Date(),
        }] : undefined,
      };
      return await callAgent(valuationAnalystAgent, context, 'ValuationAnalystAgent');
    },

    callRiskAnalystAgent: async (params: RiskAnalystParams): Promise<AgentAnalysisResult> => {
      // 使用技术分析师代理风险分析
      const context: AgentContext = {
        stockCode: params.stockCode,
        stockName: params.stockName,
        metadata: {
          sessionId: params.sessionId,
          analysisType: 'risk_analysis',
          analysisData: {
            allMcpData: params.allMcpData,
            policyAnalysis: params.policyAnalysis,
            stage1Analysis: params.stage1Analysis,
          },
        },
      };
      return await callAgent(technicalAnalystAgent, context, 'RiskAnalystAgent');
    },

    // =================
    // 第三阶段：决策整合阶段智能体
    // =================
    
    callUnifiedOrchestratorAgent: async (params: UnifiedOrchestratorParams): Promise<AgentAnalysisResult> => {
      const context: AgentContext = {
        stockCode: params.stockCode,
        stockName: params.stockName,
        metadata: {
          sessionId: params.sessionId,
          analysisType: 'unified_orchestration',
        },
        previousResults: params.previousResults.map(r => ({
          agentName: r.agentName,
          agentType: r.agentType as any,
          analysis: r.analysis,
          score: r.score,
          recommendation: r.recommendation as any,
          confidence: r.confidence,
          keyInsights: r.keyInsights,
          risks: r.risks,
          timestamp: new Date(),
        })),
      };
      return await callAgent(unifiedOrchestratorAgent, context, 'UnifiedOrchestratorAgent');
    },

    // 生成分析摘要
    generateAnalysisSummary: async (params: {
      finalDecision: {
        overallScore: number;
        recommendation: string;
        confidence: number;
        keyDecisionFactors: string[];
        riskAssessment: string[];
        actionPlan: string;
      };
      stockName?: string;
      previousResults: any[];
    }): Promise<string> => {
      try {
        logger.serviceInfo('生成分析摘要', {
          stockName: params.stockName,
          recommendation: params.finalDecision.recommendation,
          score: params.finalDecision.overallScore,
        });

        // 调用UnifiedOrchestratorAgent的摘要生成方法
        const summary = await unifiedOrchestratorAgent.generateAnalysisSummary({
          ...params.finalDecision,
          recommendation: params.finalDecision.recommendation as any,
          previousResults: params.previousResults,
        }, params.stockName);

        logger.serviceInfo('分析摘要生成成功', {
          stockName: params.stockName,
          summaryLength: summary.length,
        });

        return summary;
      } catch (error) {
        logger.businessError('生成分析摘要失败', error, {
          stockName: params.stockName,
          finalDecision: params.finalDecision,
        });

        // 返回备用摘要
        const { finalDecision, stockName } = params;
        const confidencePercent = Math.round(finalDecision.confidence * 100);
        return `建议${finalDecision.recommendation}${stockName ? `（${stockName}）` : ''}。综合评分${finalDecision.overallScore}分，分析置信度${confidencePercent}%。请参考详细分析报告了解具体情况。`;
      }
    },
  };
}