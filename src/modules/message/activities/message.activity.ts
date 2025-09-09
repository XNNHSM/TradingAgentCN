import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageService } from '../message.service';
import { SendMessageActivity } from '../interfaces/message-activity.interface';
import { MessageSendRecord } from '../entities/message-send-record.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageType } from '../dtos/message.dto';

/**
 * 消息发送 Activity 实现
 * 供 Temporal 工作流调用
 */
@Injectable()
export class MessageActivityImpl implements SendMessageActivity {
  private readonly logger = new Logger(MessageActivityImpl.name);

  constructor(
    private readonly messageService: MessageService,
    private readonly configService: ConfigService,
    @InjectRepository(MessageSendRecord)
    private readonly messageSendRecordRepository: Repository<MessageSendRecord>,
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
      this.logger.log(`开始发送股票分析结果: ${params.stockCode}`);

      // 构建消息内容
      const title = `📈 ${params.stockName} (${params.stockCode}) 分析报告`;
      let content = '';

      // 添加摘要
      if (params.summary) {
        content += `## 分析摘要\n\n${params.summary}\n\n`;
      }

      // 添加建议
      if (params.recommendation) {
        content += `## 投资建议\n\n${params.recommendation}\n\n`;
      }

      // 添加风险等级
      if (params.riskLevel) {
        const riskEmoji = this.getRiskEmoji(params.riskLevel);
        content += `## 风险等级\n\n${riskEmoji} ${params.riskLevel}\n\n`;
      }

      // 添加详细信息链接（如果有）
      content += `---\n*本报告由智能交易代理系统自动生成*`;

      // 发送消息
      const results = await this.messageService.sendAnalysisResult({
        title,
        content,
        messageType: MessageType.MARKDOWN,
        metadata: {
          ...params.metadata,
          stockCode: params.stockCode,
          stockName: params.stockName,
          analysisType: 'stock',
          riskLevel: params.riskLevel,
          recommendation: params.recommendation,
          sendTime: new Date().toISOString(),
        },
      });

      // 检查发送结果
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      this.logger.log(`股票分析结果发送完成: ${params.stockCode}, 成功 ${successCount}/${totalCount}`);

      return successCount > 0;
    } catch (error) {
      this.logger.error(`发送股票分析结果失败: ${params.stockCode}`, error);
      return false;
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
      this.logger.log(`开始发送新闻摘要: ${params.title}`);

      // 构建消息内容
      let content = params.content;

      // 添加来源信息
      if (params.source) {
        content += `\n\n---\n📰 来源: ${params.source}`;
      }

      // 添加分类信息
      if (params.category) {
        content += `\n📂 分类: ${params.category}`;
      }

      // 发送消息
      const results = await this.messageService.sendNewsSummary({
        title: params.title,
        content,
        messageType: MessageType.MARKDOWN,
        metadata: {
          ...params.metadata,
          source: params.source,
          category: params.category,
          newsType: 'summary',
          sendTime: new Date().toISOString(),
        },
      });

      // 检查发送结果
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      this.logger.log(`新闻摘要发送完成: ${params.title}, 成功 ${successCount}/${totalCount}`);

      return successCount > 0;
    } catch (error) {
      this.logger.error(`发送新闻摘要失败: ${params.title}`, error);
      return false;
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
      this.logger.log(`开始发送系统通知: ${params.title} [${params.level}]`);

      // 根据级别添加表情符号
      const levelEmoji = this.getLevelEmoji(params.level);
      const title = `${levelEmoji} ${params.title}`;

      // 发送消息
      const results = await this.messageService.sendMessage({
        title,
        content: params.content,
        messageType: MessageType.TEXT,
        metadata: {
          ...params.metadata,
          notificationLevel: params.level,
          notificationType: 'system',
          sendTime: new Date().toISOString(),
        },
      });

      // 检查发送结果
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      this.logger.log(`系统通知发送完成: ${params.title}, 成功 ${successCount}/${totalCount}`);

      return successCount > 0;
    } catch (error) {
      this.logger.error(`发送系统通知失败: ${params.title}`, error);
      return false;
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
      this.logger.log(`开始发送自定义消息: ${params.title}`);

      // 发送消息
      const results = await this.messageService.sendMessage({
        title: params.title,
        content: params.content,
        messageType: params.messageType === 'text' ? MessageType.TEXT : MessageType.MARKDOWN,
        metadata: {
          ...params.metadata,
          messageType: 'custom',
          sendTime: new Date().toISOString(),
        },
      });

      // 检查发送结果
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      this.logger.log(`自定义消息发送完成: ${params.title}, 成功 ${successCount}/${totalCount}`);

      return successCount > 0;
    } catch (error) {
      this.logger.error(`发送自定义消息失败: ${params.title}`, error);
      return false;
    }
  }

  /**
   * 获取风险等级表情符号
   */
  private getRiskEmoji(riskLevel: string): string {
    switch (riskLevel?.toLowerCase()) {
      case 'low':
      case '低':
        return '🟢';
      case 'medium':
      case '中':
        return '🟡';
      case 'high':
      case '高':
        return '🔴';
      default:
        return '⚠️';
    }
  }

  /**
   * 获取通知级别表情符号
   */
  private getLevelEmoji(level: string): string {
    switch (level) {
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'success':
        return '✅';
      default:
        return '📢';
    }
  }
}