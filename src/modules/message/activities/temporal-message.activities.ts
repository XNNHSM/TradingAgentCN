import { Context } from '@temporalio/activity';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { MessageActivityImpl } from '../activities/message.activity';

/**
 * Temporal 消息发送 Activities
 * 供工作流调用
 */
@Injectable()
export class MessageActivities {
  private readonly logger = new Logger(MessageActivities.name);

  constructor(
    @Inject(MessageActivityImpl)
    private readonly messageActivity: MessageActivityImpl,
  ) {}

  /**
   * 发送股票分析结果
   */
  async sendStockAnalysisResult(params: {
    stockCode: string;
    stockName: string;
    analysisResult: any;
    summary?: string;
    recommendation?: string;
    riskLevel?: string;
    metadata?: Record<string, any>;
  }): Promise<boolean> {
    try {
      this.logger.log(`Temporal Activity: 发送股票分析结果 ${params.stockCode}`);
      
      // 记录工作流上下文
      const workflowInfo = Context.current().info;
      this.logger.log(`工作流信息: ${workflowInfo.workflowType}`);

      const result = await this.messageActivity.sendStockAnalysisResult(params);
      
      this.logger.log(`股票分析结果发送完成: ${params.stockCode}, 结果: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`发送股票分析结果失败: ${params.stockCode}`, error);
      throw error;
    }
  }

  /**
   * 发送新闻摘要
   */
  async sendNewsSummary(params: {
    title: string;
    content: string;
    source?: string;
    category?: string;
    metadata?: Record<string, any>;
  }): Promise<boolean> {
    try {
      this.logger.log(`Temporal Activity: 发送新闻摘要 ${params.title}`);
      
      const workflowInfo = Context.current().info;
      this.logger.log(`工作流信息: ${workflowInfo.workflowType}`);

      const result = await this.messageActivity.sendNewsSummary(params);
      
      this.logger.log(`新闻摘要发送完成: ${params.title}, 结果: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`发送新闻摘要失败: ${params.title}`, error);
      throw error;
    }
  }

  /**
   * 发送系统通知
   */
  async sendSystemNotification(params: {
    title: string;
    content: string;
    level: 'info' | 'warning' | 'error' | 'success';
    metadata?: Record<string, any>;
  }): Promise<boolean> {
    try {
      this.logger.log(`Temporal Activity: 发送系统通知 ${params.title} [${params.level}]`);
      
      const workflowInfo = Context.current().info;
      this.logger.log(`工作流信息: ${workflowInfo.workflowType}`);

      const result = await this.messageActivity.sendSystemNotification(params);
      
      this.logger.log(`系统通知发送完成: ${params.title}, 结果: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`发送系统通知失败: ${params.title}`, error);
      throw error;
    }
  }

  /**
   * 发送自定义消息
   */
  async sendCustomMessage(params: {
    title: string;
    content: string;
    messageType: 'text' | 'markdown';
    targets?: string[];
    metadata?: Record<string, any>;
  }): Promise<boolean> {
    try {
      this.logger.log(`Temporal Activity: 发送自定义消息 ${params.title}`);
      
      const workflowInfo = Context.current().info;
      this.logger.log(`工作流信息: ${workflowInfo.workflowType}`);

      const result = await this.messageActivity.sendCustomMessage(params);
      
      this.logger.log(`自定义消息发送完成: ${params.title}, 结果: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`发送自定义消息失败: ${params.title}`, error);
      throw error;
    }
  }
}