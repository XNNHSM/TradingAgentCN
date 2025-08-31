/**
 * 政策分析相关的Temporal Activities
 * 集成新闻摘要数据和政策分析智能体
 */

import { ConfigService } from '@nestjs/config';
import { BusinessLogger } from '../../common/utils/business-logger.util';
import { NewsSummaryService, PolicyRelevantNews } from '../../modules/news/services/news-summary.service';
import { PolicyAnalystAgent, PolicyAnalysisInput, PolicyAnalysisResult } from '../../agents/policy/policy-analyst.agent';
import { LLMService } from '../../agents/services/llm.service';

export interface PolicyAnalysisActivitiesInput {
  stockCode: string;
  stockName: string;
  stockIndustry?: string;
  analysisDate: string;
  sessionId: string;
  lookbackDays?: number; // 回看天数，默认15天
}

/**
 * 政策分析Activities接口定义
 */
export interface PolicyAnalysisActivities {
  // 获取政策相关新闻摘要
  getPolicyRelevantNews: (params: {
    stockCode: string;
    lookbackDays: number;
    analysisDate: string;
  }) => Promise<PolicyRelevantNews[]>;

  // 执行政策分析
  performPolicyAnalysis: (input: PolicyAnalysisActivitiesInput) => Promise<PolicyAnalysisResult>;
}

/**
 * 创建政策分析Activities实现
 */
export function createPolicyAnalysisActivities(
  configService: ConfigService,
  newsSummaryService: NewsSummaryService
): PolicyAnalysisActivities {
  const logger = new BusinessLogger('PolicyAnalysisActivities');

  return {
    /**
     * 获取政策相关新闻摘要
     */
    getPolicyRelevantNews: async (params: {
      stockCode: string;
      lookbackDays: number;
      analysisDate: string;
    }): Promise<PolicyRelevantNews[]> => {
      try {
        const { stockCode, lookbackDays, analysisDate } = params;
        
        logger.serviceInfo('获取政策相关新闻摘要', {
          stockCode,
          lookbackDays,
          analysisDate
        });

        // 计算查询时间范围
        const endDate = new Date(analysisDate);
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - lookbackDays);

        // 构建查询参数，包含政策和行业相关关键词
        const policyKeywords = [
          '政策', '监管', '央行', '政府', '国务院', '证监会', '银保监会',
          '发改委', '财政部', '工信部', '商务部', '环保部',
          '经济', '金融', '改革', '规划', '方案', '措施', '通知',
          '银行', '保险', '证券', '基金', '信托', '科技', '制造',
          '地产', '医药', '能源', '环保', '消费', '农业', '军工'
        ];

        const newsQuery = {
          startDate: startDate.toISOString().split('T')[0],
          endDate: analysisDate,
          limit: 50, // 获取最近50条相关新闻
          keyWords: policyKeywords
        };

        const result = await newsSummaryService.getNewsSummariesForPolicyAnalysis(newsQuery);
        
        if (result.code === 0) {
          logger.serviceInfo('成功获取政策相关新闻', {
            stockCode,
            newsCount: result.data.length,
            averageRelevance: result.data.reduce((sum, news) => sum + (news.relevanceScore || 0), 0) / result.data.length
          });
          
          return result.data;
        } else {
          logger.serviceError('获取政策新闻失败', undefined, {
            stockCode,
            error: result.message
          });
          
          // 返回空数组而不是抛出异常，让工作流继续执行
          return [];
        }
      } catch (error) {
        logger.businessError('获取政策相关新闻异常', error, {
          stockCode: params.stockCode,
          lookbackDays: params.lookbackDays
        });
        
        // 返回空数组，不阻断工作流
        return [];
      }
    },

    /**
     * 执行政策分析
     */
    performPolicyAnalysis: async (input: PolicyAnalysisActivitiesInput): Promise<PolicyAnalysisResult> => {
      try {
        const { stockCode, stockName, stockIndustry, analysisDate, sessionId, lookbackDays = 15 } = input;
        
        logger.serviceInfo('开始执行政策分析', {
          stockCode,
          stockName,
          analysisDate,
          lookbackDays
        });

        // 1. 获取政策相关新闻摘要
        const newsSummaries = await newsSummaryService.getHotNewsSummaries(lookbackDays);
        
        let policyNews: PolicyRelevantNews[] = [];
        if (newsSummaries.code === 0) {
          policyNews = newsSummaries.data;
        }

        logger.serviceInfo('获取到政策新闻数量', { count: policyNews.length });

        // 2. 创建政策分析智能体
        const llmService = new LLMService(configService);
        const policyAnalyst = new PolicyAnalystAgent(llmService);

        // 3. 构建分析输入
        const analysisInput: PolicyAnalysisInput = {
          stockCode,
          stockName,
          stockIndustry,
          newsSummaries: policyNews,
          analysisDate,
          sessionId
        };

        // 4. 执行政策分析
        const analysisResult = await policyAnalyst.analyze(analysisInput);
        
        logger.serviceInfo('政策分析完成', {
          stockCode,
          overallSentiment: analysisResult.overallSentiment,
          policySupport: analysisResult.policySupport,
          policyRisk: analysisResult.policyRisk,
          newsProcessed: analysisResult.newsCount,
          confidenceLevel: analysisResult.confidenceLevel
        });

        return analysisResult;
      } catch (error) {
        logger.businessError('政策分析执行失败', error, {
          stockCode: input.stockCode,
          sessionId: input.sessionId
        });
        
        // 返回默认结果而不是抛出异常
        return {
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
          
          policyRecommendation: '由于分析过程中出现异常，暂无政策建议。建议关注最新政策动向。',
          keyRisks: ['数据获取异常', '分析过程异常'],
          keyOpportunities: [],
          
          analysisSource: '分析异常，使用默认结果',
          newsCount: 0,
          confidenceLevel: 0.1,
          processingTime: Date.now() - Date.now()
        };
      }
    }
  };
}