import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { SimpleWebhookProvider } from './simple-webhook-provider';
import { MessageContent, MessageSendResult } from '@/modules/message/interfaces/message-provider.interface';
import { MessageSendRecord } from '@/modules/message/entities/message-send-record.entity';
import { Repository } from 'typeorm';
import { DingTalkConfigDto } from '@/modules/message/dtos/message.dto';
// import { BusinessLogger, LogCategory } from '../../../common/utils/business-logger.util';
import * as crypto from 'crypto';

/**
 * 钉钉机器人消息提供者
 */
@Injectable()
export class DingTalkProvider extends SimpleWebhookProvider {
  private config: DingTalkConfigDto;

  constructor(
    @InjectRepository(MessageSendRecord)
    repository: Repository<MessageSendRecord>,
    httpService: HttpService
  ) {
    super(repository, httpService, 'dingtalk');
  }

  /**
   * 初始化钉钉配置
   */
  initDingTalk(config: DingTalkConfigDto): void {
    this.config = config;
    this.initWebhook(config);
  }

  /**
   * 格式化钉钉消息
   */
  protected formatWebhookMessage(content: MessageContent): any {
    const message: any = {
      msgtype: 'text',
      text: {
        content: content.content
      }
    };

    // 如果有标题，添加到消息内容中
    if (content.title) {
      message.text.content = `${content.title}\n\n${content.content}`;
    }

    // 如果是markdown类型，使用markdown格式
    if (content.messageType === 'markdown') {
      message.msgtype = 'markdown';
      message.markdown = {
        title: content.title || '消息通知',
        text: this.formatMarkdown(content)
      };
    }

    return message;
  }

  /**
   * 生成钉钉签名
   */
  protected generateDingTalkSignature(timestamp: number, secret: string): string {
    const stringToSign = `${timestamp}\n${secret}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(stringToSign);
    const signature = hmac.digest('base64');
    return encodeURIComponent(signature);
  }

  /**
   * 构建钉钉Webhook URL
   */
  protected buildDingTalkUrl(): string {
    const timestamp = Date.now();
    let url = `${this.config.webhookUrl}&timestamp=${timestamp}`;
    
    if (this.config.secret) {
      const signature = this.generateDingTalkSignature(timestamp, this.config.secret);
      url += `&sign=${signature}`;
    }
    
    return url;
  }

  /**
   * 发送消息（重写父类方法以使用钉钉URL构建逻辑）
   */
  async send(content: MessageContent, target?: string): Promise<MessageSendResult> {
    if (!this.config) {
      throw new Error('DingTalk provider not initialized');
    }

    const startTime = Date.now();
    const webhookUrl = this.buildDingTalkUrl();
    
    try {
      // 创建发送记录
      const record = await this.createSendRecord(content, webhookUrl, { 
        webhookUrl, 
        accessToken: this.config.accessToken 
      });

      // 格式化消息
      const payload = this.formatWebhookMessage(content);

      // 发送Webhook
      const result = await this.sendWithRetry(
        webhookUrl, 
        payload, 
        this.config.retryTimes || 3
      );

      const executionTime = Date.now() - startTime;

      // 更新发送记录
      await this.updateSendRecord(record.id, result, executionTime);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error('发送钉钉消息失败', error, { 
        webhookUrl, 
        provider: this.providerName 
      });

      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * 发送钉钉特殊消息类型
   */
  async sendMarkdown(title: string, content: string): Promise<MessageSendResult> {
    return this.send({
      title,
      content,
      messageType: 'markdown' as any
    });
  }

  async sendActionCard(title: string, content: string, btnOrientation: '0' | '1' = '0', singleTitle?: string, singleURL?: string): Promise<MessageSendResult> {
    const payload = {
      msgtype: 'actionCard',
      actionCard: {
        title,
        text: content,
        btnOrientation,
        singleTitle,
        singleURL
      }
    };

    const webhookUrl = this.buildDingTalkUrl();
    return this.sendWebhook(webhookUrl, payload);
  }

  async sendFeedCard(links: Array<{ title: string; messageURL: string; picURL: string }>): Promise<MessageSendResult> {
    const payload = {
      msgtype: 'feedCard',
      feedCard: {
        links
      }
    };

    const webhookUrl = this.buildDingTalkUrl();
    return this.sendWebhook(webhookUrl, payload);
  }

  /**
   * 格式化Markdown内容
   */
  private formatMarkdown(content: MessageContent): string {
    let markdownText = content.content;
    
    // 简单的Markdown格式化，可以根据需要扩展
    if (content.title) {
      markdownText = `## ${content.title}\n\n${markdownText}`;
    }
    
    return markdownText;
  }

  /**
   * 验证钉钉配置
   */
  validateConfig(): boolean {
    return !!(this.config && 
           this.config.enabled && 
           this.config.accessToken && 
           this.config.webhookUrl);
  }
}