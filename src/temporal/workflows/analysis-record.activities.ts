/**
 * 分析记录Activities
 * 为股票分析工作流提供分析记录的创建和更新功能
 */

import {BusinessLogger} from '../../common/utils/business-logger.util';
import {AnalysisService} from '../../modules/analysis/analysis.service';

/**
 * 分析记录Activities接口定义
 */
export interface AnalysisRecordActivities {
  createAnalysisRecord: (params: {
    sessionId: string;
    workflowId: string;
    stockCode: string;
    stockName?: string;
    analysisType: string;
    status: 'running' | 'success' | 'partial' | 'failed';
  }) => Promise<string>;
  
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
    summary?: string; // 新增摘要字段
    metadata?: Record<string, any>;
  }) => Promise<void>;
}

/**
 * 创建分析记录Activities实现
 */
export function createAnalysisRecordActivities(
  analysisService: AnalysisService
): AnalysisRecordActivities {
  const logger = new BusinessLogger('AnalysisRecordActivities');

  return {
    /**
     * 创建分析记录
     */
    createAnalysisRecord: async (params): Promise<string> => {
      try {
        logger.serviceInfo('创建分析记录', {
          sessionId: params.sessionId,
          workflowId: params.workflowId,
          stockCode: params.stockCode,
          status: params.status,
        });

        // 创建记录（由于workflowId在外部已经生成，这里用save方法）
        const record = await analysisService['analysisRepository'].save({
          workflowId: params.workflowId,
          sessionId: params.sessionId,
          stockCode: params.stockCode,
          stockName: params.stockName,
          analysisType: params.analysisType,
          status: params.status,
          startTime: new Date(),
          executionTime: 0,
          context: {},
          results: {},
          metadata: {
            activityCreatedAt: new Date().toISOString(),
          },
        });

        logger.serviceInfo('分析记录创建成功', {
          recordId: String(record.id),
          sessionId: params.sessionId,
        });

        return String(record.id);
      } catch (error) {
        logger.businessError('创建分析记录失败', error, params);
        throw error;
      }
    },

    /**
     * 更新分析记录
     */
    updateAnalysisRecord: async (params): Promise<void> => {
      try {
        logger.serviceInfo('更新分析记录', {
          recordId: params.recordId,
          status: params.status,
        });

        // 构建更新数据
        const updateData: any = {
          updatedAt: new Date(),
        };

        // 只更新提供的字段
        if (params.status) updateData.status = params.status;
        if (params.results) updateData.results = params.results;
        if (params.averageScore !== undefined) updateData.averageScore = params.averageScore;
        if (params.finalRecommendation !== undefined) updateData.finalRecommendation = params.finalRecommendation;
        if (params.confidence !== undefined) updateData.confidence = params.confidence;
        if (params.keyInsights !== undefined) updateData.keyInsights = params.keyInsights;
        if (params.majorRisks !== undefined) updateData.majorRisks = params.majorRisks;
        if (params.executionTime !== undefined) updateData.executionTime = params.executionTime;
        if (params.errorMessage !== undefined) updateData.errorMessage = params.errorMessage;
        if (params.summary !== undefined) updateData.summary = params.summary; // 新增摘要字段
        if (params.metadata) {
          updateData.metadata = {
            ...updateData.metadata,
            ...params.metadata,
          };
        }

        // 如果有executionTime，计算endTime
        if (params.executionTime) {
          updateData.endTime = new Date(Date.now() + params.executionTime);
        }

        // 更新记录
        await analysisService['analysisRepository'].update(params.recordId, updateData);

        logger.serviceInfo('分析记录更新成功', {
          recordId: params.recordId,
          status: params.status,
        });
      } catch (error) {
        logger.businessError('更新分析记录失败', error, params);
        throw error;
      }
    },
  };
}