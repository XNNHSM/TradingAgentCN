import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { SimpleWebhookProvider } from './simple-webhook-provider';
import { MessageContent, MessageSendResult } from '@/modules/message/interfaces/message-provider.interface';
import { MessageSendRecord } from '@/modules/message/entities/message-send-record.entity';
import { Repository } from 'typeorm';
import { WeChatConfigDto } from '@/modules/message/dtos/message.dto';
// import { BusinessLogger, LogCategory } from '../../../common/utils/business-logger.util';

/**
 * 企业微信机器人消息提供者
 */
@Injectable()
export class WeChatProvider extends SimpleWebhookProvider {
  private config: WeChatConfigDto;

  constructor(
    @InjectRepository(MessageSendRecord)
    repository: Repository<MessageSendRecord>,
    httpService: HttpService
  ) {
    super(repository, httpService, 'wechat');
  }

  /**
   * 初始化企业微信配置
   */
  initWeChat(config: WeChatConfigDto): void {
    this.config = config;
    this.initWebhook(config);
  }

  /**
   * 格式化企业微信消息
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
        content: this.formatMarkdown(content)
      };
    }

    return message;
  }

  /**
   * 发送消息（重写父类方法以使用企业微信URL）
   */
  async send(content: MessageContent, target?: string): Promise<MessageSendResult> {
    if (!this.config) {
      throw new Error('WeChat provider not initialized');
    }

    const startTime = Date.now();
    const webhookUrl = this.config.webhookUrl;
    
    try {
      // 创建发送记录
      const record = await this.createSendRecord(content, webhookUrl, { 
        webhookUrl 
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
      this.logger.error('发送企业微信消息失败', error, { 
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
   * 发送企业微信特殊消息类型
   */
  async sendMarkdown(title: string, content: string): Promise<MessageSendResult> {
    return this.send({
      title,
      content,
      messageType: 'markdown' as any
    });
  }

  async sendImage(base64: string, md5: string): Promise<MessageSendResult> {
    const payload = {
      msgtype: 'image',
      image: {
        base64,
        md5
      }
    };

    return this.sendWebhook(this.config.webhookUrl, payload);
  }

  async sendNews(articles: Array<{ title: string; description: string; url: string; picurl?: string }>): Promise<MessageSendResult> {
    const payload = {
      msgtype: 'news',
      news: {
        articles
      }
    };

    return this.sendWebhook(this.config.webhookUrl, payload);
  }

  async sendFile(media_id: string): Promise<MessageSendResult> {
    const payload = {
      msgtype: 'file',
      file: {
        media_id
      }
    };

    return this.sendWebhook(this.config.webhookUrl, payload);
  }

  /**
   * 发送图文消息（markdown格式）
   */
  async sendNewsMarkdown(title: string, description: string, url: string, imageUrl?: string): Promise<MessageSendResult> {
    let content = `## ${title}\n\n`;
    content += `${description}\n\n`;
    content += `[查看详情](${url})`;
    
    if (imageUrl) {
      content = `![${title}](${imageUrl})\n\n${content}`;
    }

    return this.send({
      title,
      content,
      messageType: 'markdown' as any
    });
  }

  /**
   * 发送卡片消息
   */
  async sendCard(title: string, description: string, url: string, btnTxt: string = '详情'): Promise<MessageSendResult> {
    const content = `${title}\n\n${description}\n\n[${btnTxt}](${url})`;
    
    return this.send({
      title,
      content,
      messageType: 'markdown' as any
    });
  }

  /**
   * 格式化Markdown内容
   */
  private formatMarkdown(content: MessageContent): string {
    let markdownText = content.content;
    
    // 企业微信支持的Markdown格式
    if (content.title) {
      markdownText = `## ${content.title}\n\n${markdownText}`;
    }
    
    // 支持加粗
    markdownText = markdownText.replace(/\*\*(.*?)\*\*/g, '**$1**');
    
    return markdownText;
  }

  /**
   * 验证企业微信配置
   */
  validateConfig(): boolean {
    return !!(this.config && 
           this.config.enabled && 
           this.config.webhookUrl &&
           this.config.webhookUrl !== 'your_wechat_webhook_url_here' &&
           this.config.webhookUrl.startsWith('https://'));
  }
}