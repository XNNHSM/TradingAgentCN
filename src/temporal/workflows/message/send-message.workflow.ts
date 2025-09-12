/**
 * 消息发送工作流 - 专门用于发送已有分析记录的消息
 * 
 * 功能：
 * - 接收分析记录ID，查询完整的分析数据
 * - 格式化并发送股票分析报告
 * - 利用Temporal的重试机制和状态管理
 */

import {defineQuery, proxyActivities, setHandler, workflowInfo} from '@temporalio/workflow';
import {ProviderSendResult} from '../message/message-send.activities';

// ===============================
// 输入输出接口定义
// ===============================

export interface SendMessageInput {
  analysisRecordId: number;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface SendMessageResult {
  success: boolean;
  message: string;
  sendResults?: ProviderSendResult[];
  error?: string;
}

// ===============================
// Query
// ===============================

export const getStatusQuery = defineQuery<SendMessageResult>('getStatus');

// ===============================
// Activity 配置
// ===============================

const { getAnalysisRecord, sendStockAnalysisReport } = proxyActivities({
  taskQueue: 'message-send',
  startToCloseTimeout: '2m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
  },
});

// ===============================
// 工作流状态
// ===============================

interface WorkflowState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  sendResults?: ProviderSendResult[];
  error?: string;
  startTime?: Date;
  endTime?: Date;
}

let state: WorkflowState = {
  status: 'pending',
};

// ===============================
// 工作流主函数
// ===============================

export async function sendMessageWorkflow(input: SendMessageInput): Promise<SendMessageResult> {
  const startTime = Date.now();
  
  // 设置Query Handler
  setHandler(getStatusQuery, () => {
    return {
      success: state.status === 'completed',
      message: state.message || (state.status === 'pending' ? '等待发送消息' : '正在发送消息'),
      sendResults: state.sendResults,
      error: state.error,
    };
  });
  
  try {
    console.log('启动消息发送工作流', {
      analysisRecordId: input.analysisRecordId,
      sessionId: input.sessionId,
    });

    state.status = 'running';
    state.startTime = new Date();
    
    const workflowInfoResult = workflowInfo();
    console.log(`开始发送已有分析记录消息: ${input.analysisRecordId}`, {
      workflowId: workflowInfoResult.workflowId,
      runId: workflowInfoResult.runId,
      analysisRecordId: input.analysisRecordId,
    });

    // 获取分析记录
    const analysisRecord = await getAnalysisRecord(input.analysisRecordId);
    if (!analysisRecord) {
      throw new Error(`分析记录不存在: ${input.analysisRecordId}`);
    }

    // 从分析记录中提取当前价格
    let currentPrice: number | undefined;
    if (analysisRecord.results && analysisRecord.results.mcpDataSummary && analysisRecord.results.mcpDataSummary.realtimeData) {
      const realtimeData = analysisRecord.results.mcpDataSummary.realtimeData;
      if (realtimeData.price !== undefined) {
        currentPrice = parseFloat(realtimeData.price);
      } else if (realtimeData.current_price !== undefined) {
        currentPrice = parseFloat(realtimeData.current_price);
      } else if (realtimeData.close !== undefined) {
        currentPrice = parseFloat(realtimeData.close);
      }
    }

    // 发送股票分析报告
    const sendResults = await sendStockAnalysisReport({
      stockCode: analysisRecord.stockCode,
      stockName: analysisRecord.stockName || analysisRecord.stockCode,
      finalDecision: {
        overallScore: analysisRecord.averageScore || 0,
        recommendation: analysisRecord.finalRecommendation || 'HOLD',
        confidence: analysisRecord.confidence || 0,
        keyDecisionFactors: analysisRecord.keyInsights || [],
        riskAssessment: analysisRecord.majorRisks || [],
        actionPlan: '基于分析结果制定投资策略'
      },
      currentPrice,
      summary: analysisRecord.summary,
      metadata: {
        ...input.metadata,
        source: 'existing-analysis-workflow',
        analysisRecordId: analysisRecord.id,
        analysisType: analysisRecord.analysisType,
        averageScore: analysisRecord.averageScore,
        finalRecommendation: analysisRecord.finalRecommendation,
        workflowType: workflowInfoResult.workflowType,
        sendTime: new Date().toISOString(),
      },
    });

    // 更新状态
    state.status = 'completed';
    state.sendResults = sendResults;
    state.message = `已有分析记录消息发送完成: ${analysisRecord.stockName}（${analysisRecord.stockCode}）`;
    state.endTime = new Date();

    console.log(`已有分析记录消息发送完成`, {
      workflowId: workflowInfoResult.workflowId,
      stockCode: analysisRecord.stockCode,
      successCount: sendResults.filter(r => r.success).length,
      totalCount: sendResults.length,
    });

    const result: SendMessageResult = {
      success: true,
      message: state.message,
      sendResults: state.sendResults,
    };

    console.log('消息发送工作流完成', {
      processingTime: Date.now() - startTime,
      status: state.status,
    });

    return result;

  } catch (error) {
    state.status = 'failed';
    state.error = error.message;
    state.endTime = new Date();
    
    console.error('消息发送工作流失败', error);
    
    return {
      success: false,
      message: '消息发送工作流执行失败',
      error: error.message,
    };
  }
}