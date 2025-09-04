/**
 * Temporal Worker配置
 * 用于执行工作流和活动
 */

import { Worker } from '@temporalio/worker';
import { ConfigService } from '@nestjs/config';
import { LLMService } from '../../agents/services/llm.service';
import { MCPClientService } from '../../agents/services/mcp-client.service';
import { AgentExecutionRecordService } from '../../agents/services/agent-execution-record.service';
import { BusinessLogger } from '../../common/utils/business-logger.util';
import type { MCPActivities } from '../activities/mcp.activities';
import { createMCPActivities } from '../activities/mcp.activities';
import type { PolicyAnalysisActivities } from '../activities/policy-analysis.activities';
import { createPolicyAnalysisActivities } from '../activities/policy-analysis.activities';
import type { AgentAnalysisActivities } from '../activities/agent-analysis.activities';
import { createAgentAnalysisActivities } from '../activities/agent-analysis.activities';
import { NewsSummaryService } from '../../modules/news/services/news-summary.service';

/**
 * 创建所有活动实现
 * 包含MCP数据获取活动、政策分析活动和智能体分析活动
 */
export function createActivities(
  configService: ConfigService,
  llmService?: LLMService,
  mcpClientService?: MCPClientService,
  executionRecordService?: AgentExecutionRecordService,
  newsSummaryService?: NewsSummaryService
): MCPActivities & PolicyAnalysisActivities & AgentAnalysisActivities {
  // 创建MCP Activities
  const mcpActivities = createMCPActivities(configService);
  
  // 创建智能体分析Activities
  let agentActivities: AgentAnalysisActivities;
  if (llmService && mcpClientService) {
    agentActivities = createAgentAnalysisActivities(configService, llmService, mcpClientService, executionRecordService);
  } else {
    console.warn('LLMService未提供，智能体分析活动将使用默认实现');
    // 创建默认的空实现
    agentActivities = {
      callBasicDataAgent: async () => ({ agentName: 'BasicDataAgent', agentType: 'BASIC_DATA_AGENT', analysis: 'LLMService未配置', processingTime: 0 }),
      callTechnicalAnalystAgent: async () => ({ agentName: 'TechnicalAnalystAgent', agentType: 'TECHNICAL_ANALYST', analysis: 'LLMService未配置', processingTime: 0 }),
      callFundamentalAnalystAgent: async () => ({ agentName: 'FundamentalAnalystAgent', agentType: 'FUNDAMENTAL_ANALYST', analysis: 'LLMService未配置', processingTime: 0 }),
      callNewsAnalystAgent: async () => ({ agentName: 'NewsAnalystAgent', agentType: 'NEWS_ANALYST', analysis: 'LLMService未配置', processingTime: 0 }),
      callIndustryAnalystAgent: async () => ({ agentName: 'IndustryAnalystAgent', agentType: 'INDUSTRY_ANALYST', analysis: 'LLMService未配置', processingTime: 0 }),
      callCompetitiveAnalystAgent: async () => ({ agentName: 'CompetitiveAnalystAgent', agentType: 'COMPETITIVE_ANALYST', analysis: 'LLMService未配置', processingTime: 0 }),
      callValuationAnalystAgent: async () => ({ agentName: 'ValuationAnalystAgent', agentType: 'VALUATION_ANALYST', analysis: 'LLMService未配置', processingTime: 0 }),
      callRiskAnalystAgent: async () => ({ agentName: 'RiskAnalystAgent', agentType: 'RISK_ANALYST', analysis: 'LLMService未配置', processingTime: 0 }),
      callUnifiedOrchestratorAgent: async () => ({ agentName: 'UnifiedOrchestratorAgent', agentType: 'UNIFIED_ORCHESTRATOR', analysis: 'LLMService未配置', processingTime: 0 }),
    };
  }
  
  // 创建政策分析Activities
  let policyActivities: PolicyAnalysisActivities;
  if (newsSummaryService) {
    policyActivities = createPolicyAnalysisActivities(configService, newsSummaryService);
  } else {
    // 如果没有传入newsSummaryService，创建默认的空实现
    console.warn('NewsSummaryService未提供，政策分析活动将使用默认实现');
    policyActivities = {
      getPolicyRelevantNews: async () => [],
      performPolicyAnalysis: async (input) => ({
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
        policyRecommendation: 'NewsSummaryService未配置，无法进行政策分析',
        keyRisks: ['服务未配置'],
        keyOpportunities: [],
        analysisSource: '默认实现',
        newsCount: 0,
        confidenceLevel: 0.1,
        processingTime: 0
      })
    };
  }

  // 合并所有活动
  return {
    ...mcpActivities,
    ...agentActivities,
    ...policyActivities,
  };
}

/**
 * 创建并启动Temporal Worker
 * 支持增强版股票分析工作流，包含智能体分析能力
 */
export async function createTemporalWorker(
  configService: ConfigService,
  llmService?: LLMService,
  mcpClientService?: MCPClientService,
  executionRecordService?: AgentExecutionRecordService
): Promise<Worker> {
  // 创建所有活动实现
  const activities = createActivities(configService, llmService, mcpClientService, executionRecordService);

  // 使用简化的业务功能名称 taskQueue
  const taskQueue = 'stock-analysis';
  
  // 创建Worker - 使用目录路径包含两种工作流
  const worker = await Worker.create({
    workflowsPath: require.resolve('../orchestrators'),
    activities,
    taskQueue,
  });
  
  console.log(`Temporal Worker 正在监听 taskQueue: ${taskQueue}`);

  return worker;
}