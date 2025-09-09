import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { MessageSendRecord } from '@/modules/message/entities/message-send-record.entity';
import { MessageContent, MessageSendResult, IWebhookProvider } from '@/modules/message/interfaces/message-provider.interface';
import { WebhookConfigDto } from '@/modules/message/dtos/message.dto';
// import { BusinessLogger, LogCategory } from '@/common/utils/business-logger.util';
import { MessageType } from '@/modules/message/dtos/message.dto';
import * as crypto from 'crypto';

/**
 * 简化的Webhook消息提供者基类
 */
@Injectable()
export abstract class SimpleWebhookProvider implements IWebhookProvider {
  protected readonly logger = new Logger(SimpleWebhookProvider.name);
  protected webhookConfig: WebhookConfigDto;
  protected readonly providerName: string;

  constructor(
    @InjectRepository(MessageSendRecord)
    protected readonly repository: Repository<MessageSendRecord>,
    protected readonly httpService: HttpService,
    providerName: string
  ) {
    this.providerName = providerName;
  }

  /**
   * 初始化Webhook配置
   */
  initWebhook(config: WebhookConfigDto): void {
    this.webhookConfig = config;
    this.logger.log(`Webhook provider ${this.providerName} initialized`);
  }

  /**
   * 发送Webhook请求
   */
  async sendWebhook(webhookUrl: string, payload: any): Promise<MessageSendResult> {
    const startTime = Date.now();
    
    try {
      // 添加签名（如果配置了密钥）
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': `${this.providerName}-Webhook/1.0`
      };

      if (this.webhookConfig.secret) {
        headers['X-Webhook-Signature'] = this.generateSignature(payload, this.webhookConfig.secret);
      }

      const response = await this.httpService.post(webhookUrl, payload, {
        headers,
        timeout: this.webhookConfig.timeout || 5000
      }).toPromise();

      const executionTime = Date.now() - startTime;

      return {
        success: response.status >= 200 && response.status < 300,
        messageId: response.data?.id,
        response: response.data,
        timestamp: new Date()
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error('Webhook发送失败', error, { 
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
   * 重试机制
   */
  protected async sendWithRetry(
    webhookUrl: string, 
    payload: any, 
    maxRetries: number = 3
  ): Promise<MessageSendResult> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.sendWebhook(webhookUrl, payload);
        if (result.success) {
          return result;
        }
        
        lastError = new Error(result.error || 'Unknown error');
        
        // 如果不是最后一次重试，等待一段时间
        if (attempt < maxRetries) {
          await this.delay(this.getRetryDelay(attempt));
        }
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          await this.delay(this.getRetryDelay(attempt));
        }
      }
    }

    return {
      success: false,
      error: lastError.message,
      timestamp: new Date()
    };
  }

  /**
   * 生成签名
   */
  protected generateSignature(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * 获取重试延迟时间
   */
  protected getRetryDelay(attempt: number): number {
    // 指数退避策略
    return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  }

  /**
   * 延迟函数
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 创建发送记录
   */
  protected async createSendRecord(
    content: MessageContent,
    target: string,
    requestParams?: Record<string, any>
  ): Promise<MessageSendRecord> {
    const record = this.repository.create({
      provider: this.providerName,
      target,
      title: content.title,
      content: content.content,
      messageType: content.messageType || MessageType.TEXT,
      requestParams,
      status: 'pending',
      startTime: new Date(),
      executionTime: 0,
      metadata: content.metadata
    } as any);

    const savedRecord = await this.repository.save(record);
    return Array.isArray(savedRecord) ? savedRecord[0] : savedRecord;
  }

  /**
   * 更新发送记录
   */
  protected async updateSendRecord(
    recordId: number,
    result: MessageSendResult,
    executionTime: number
  ): Promise<void> {
    const updateData: Partial<MessageSendRecord> = {
      status: result.success ? 'success' : 'failed',
      executionTime,
      endTime: new Date(),
      response: result.response
    };

    if (result.messageId) {
      updateData.messageId = result.messageId;
    }

    if (result.error) {
      updateData.errorMessage = result.error;
    }

    await this.repository.update(recordId, updateData);
  }

  /**
   * 格式化Webhook消息（子类必须实现）
   */
  protected abstract formatWebhookMessage(content: MessageContent): any;

  /**
   * 发送消息（实现抽象方法）
   */
  async send(content: MessageContent, target?: string): Promise<MessageSendResult> {
    if (!target) {
      throw new Error('Webhook target URL is required');
    }

    const startTime = Date.now();
    
    try {
      // 创建发送记录
      const record = await this.createSendRecord(content, target, { webhookUrl: target });

      // 格式化消息
      const payload = this.formatWebhookMessage(content);

      // 发送Webhook
      const result = await this.sendWithRetry(
        target, 
        payload, 
        this.webhookConfig?.retryTimes || 3
      );

      const executionTime = Date.now() - startTime;

      // 更新发送记录
      await this.updateSendRecord(record.id, result, executionTime);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error('发送Webhook消息失败', error, { 
        target, 
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
   * 批量发送消息
   */
  async sendBatch(content: MessageContent, targets: string[]): Promise<MessageSendResult[]> {
    const results: MessageSendResult[] = [];
    
    for (const target of targets) {
      try {
        const result = await this.send(content, target);
        results.push(result);
      } catch (error) {
        this.logger.error('批量发送消息失败', error, { target, provider: this.providerName });
        results.push({
          success: false,
          error: error.message,
          timestamp: new Date()
        });
      }
    }
    
    return results;
  }

  /**
   * 验证配置（子类可重写）
   */
  validateConfig(): boolean {
    return !!(this.webhookConfig && this.webhookConfig.webhookUrl);
  }

  /**
   * 获取提供者名称
   */
  getName(): string {
    return this.providerName;
  }
}