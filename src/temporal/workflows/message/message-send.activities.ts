/**
 * 消息发送 Activities
 * 
 * 具体的消息发送操作，由工作流调用
 * 利用Temporal的Activity重试机制
 */

import { Context } from '@temporalio/activity';
import { Injectable, Logger } from '@nestjs/common';
import { MessageType } from '../../../modules/message/dtos/message.dto';

// 消息发送参数
export interface SendMessageParams {
  messageType: 'stock-analysis' | 'news-summary' | 'system-notification' | 'custom';
  title: string;
  content: string;
  targets?: string[];
  metadata?: Record<string, any>;
}

// 提供者发送结果
export interface ProviderSendResult {
  provider: string;
  success: boolean;
  error?: string;
  messageId?: string;
  timestamp: Date;
}

/**
 * 消息发送 Activities 实现
 * 注意：这个类需要被注册到全局，以便 Temporal Worker 可以调用
 */
export class MessageSendActivities {
  private readonly logger = new Logger(MessageSendActivities.name);

  constructor() {}

  /**
   * 发送消息到所有配置的提供者
   */
  async sendToAllProviders(params: SendMessageParams): Promise<ProviderSendResult[]> {
    try {
      this.logger.log(`Temporal Activity: 发送消息到所有提供者 ${params.title}`);
      
      // 记录工作流上下文
      const workflowInfo = Context.current().info;
      this.logger.log(`工作流信息: ${workflowInfo.workflowType}`);

      // 获取消息服务实例
      const messageService = this.getMessageService();
      
      // 构建消息参数
      const messageParams = {
        title: params.title,
        content: params.content,
        messageType: this.getMessageType(params.messageType),
        metadata: {
          ...params.metadata,
          workflowType: workflowInfo.workflowType,
          sendTime: new Date().toISOString(),
        },
      };

      // 发送消息
      const results = await messageService.sendMessage(messageParams);
      
      // 转换结果格式
      const providerResults: ProviderSendResult[] = results.map(result => ({
        provider: result.provider || 'unknown',
        success: result.success,
        error: result.error,
        messageId: result.messageId,
        timestamp: result.timestamp || new Date(),
      }));

      this.logger.log(`消息发送完成: ${params.title}, 成功 ${providerResults.filter(r => r.success).length}/${providerResults.length}`);
      
      return providerResults;
    } catch (error) {
      this.logger.error(`发送消息失败: ${params.title}`, error);
      throw error;
    }
  }

  /**
   * 发送消息到指定提供者
   */
  async sendToProvider(params: SendMessageParams & { provider: string }): Promise<ProviderSendResult> {
    try {
      this.logger.log(`Temporal Activity: 发送消息到指定提供者 ${params.provider} - ${params.title}`);
      
      const workflowInfo = Context.current().info;
      this.logger.log(`工作流信息: ${workflowInfo.workflowType}`);

      // 获取消息服务实例
      const messageService = this.getMessageService();

      const messageParams = {
        title: params.title,
        content: params.content,
        messageType: this.getMessageType(params.messageType),
        provider: params.provider,
        metadata: {
          ...params.metadata,
          workflowType: workflowInfo.workflowType,
          sendTime: new Date().toISOString(),
        },
      };

      const results = await messageService.sendMessage(messageParams);
      
      if (results.length === 0) {
        throw new Error(`没有找到提供者: ${params.provider}`);
      }

      const result = results[0];
      
      return {
        provider: params.provider,
        success: result.success,
        error: result.error,
        messageId: result.messageId,
        timestamp: result.timestamp || new Date(),
      };
    } catch (error) {
      this.logger.error(`发送消息到提供者失败: ${params.provider} - ${params.title}`, error);
      throw error;
    }
  }

  /**
   * 发送股票分析报告 - 统一的股票分析消息发送Activity
   * 确保工作流和API接口使用完全相同的消息模板
   */
  async sendStockAnalysisReport(params: {
    stockCode: string;
    stockName: string;
    finalDecision: {
      overallScore: number;
      recommendation: string;
      confidence: number;
      keyDecisionFactors: string[];
      riskAssessment: string[];
      actionPlan: string;
    };
    currentPrice?: number;
    summary?: string;
    metadata?: Record<string, any>;
  }): Promise<ProviderSendResult[]> {
    try {
      this.logger.log(`Temporal Activity: 发送股票分析报告 ${params.stockName}（${params.stockCode}）`);
      
      // 记录工作流上下文
      const workflowInfo = Context.current().info;
      this.logger.log(`工作流信息: ${workflowInfo.workflowType}`);

      // 获取消息服务实例
      const messageService = this.getMessageService();
      
      // 使用统一的股票分析报告发送方法
      const results = await messageService.sendStockAnalysisReport({
        ...params,
        metadata: {
          ...params.metadata,
          workflowType: workflowInfo.workflowType,
          sendTime: new Date().toISOString(),
        },
      });
      
      // 转换结果格式
      const providerResults: ProviderSendResult[] = results.map(result => ({
        provider: result.provider || 'unknown',
        success: result.success,
        error: result.error,
        messageId: result.messageId,
        timestamp: result.timestamp || new Date(),
      }));

      this.logger.log(`股票分析报告发送完成: ${params.stockName}（${params.stockCode}）, 成功 ${providerResults.filter(r => r.success).length}/${providerResults.length}`);
      
      return providerResults;
    } catch (error) {
      this.logger.error(`发送股票分析报告失败: ${params.stockName}（${params.stockCode}）`, error);
      throw error;
    }
  }

  /**
   * 获取分析记录
   */
  async getAnalysisRecord(analysisRecordId: number): Promise<any> {
    try {
      this.logger.log(`Temporal Activity: 获取分析记录 ${analysisRecordId}`);
      
      const workflowInfo = Context.current().info;
      this.logger.log(`工作流信息: ${workflowInfo.workflowType}`);

      // 获取分析服务实例
      const analysisService = this.getAnalysisService();
      
      const analysisRecord = await analysisService.findById(analysisRecordId);
      
      if (!analysisRecord) {
        throw new Error(`分析记录不存在: ${analysisRecordId}`);
      }

      this.logger.log(`分析记录获取成功: ${analysisRecord.stockName}（${analysisRecord.stockCode}）`);
      
      return analysisRecord;
    } catch (error) {
      this.logger.error(`获取分析记录失败: ${analysisRecordId}`, error);
      throw error;
    }
  }

  /**
   * 获取分析服务实例
   */
  private getAnalysisService() {
    // 从全局获取分析服务实例
    const globalAnalysisService = (global as any).analysisService;
    if (!globalAnalysisService) {
      throw new Error('分析服务未注册到全局');
    }
    return globalAnalysisService;
  }

  /**
   * 获取消息服务实例
   */
  private getMessageService() {
    // 从全局获取消息服务实例
    const globalMessageService = (global as any).messageService;
    if (!globalMessageService) {
      throw new Error('消息服务未注册到全局');
    }
    return globalMessageService;
  }

  /**
   * 获取消息类型
   */
  private getMessageType(messageType: string): MessageType {
    switch (messageType) {
      case 'stock-analysis':
      case 'news-summary':
        return MessageType.MARKDOWN;
      case 'system-notification':
      case 'custom':
      default:
        return MessageType.TEXT;
    }
  }
}