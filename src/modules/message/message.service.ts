import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DingTalkProvider } from './adapters/webhook/dingtalk.provider';
import { WeChatProvider } from './adapters/webhook/wechat.provider';
import { IMessageProvider, MessageContent, MessageSendResult } from './interfaces/message-provider.interface';
import { MessageSendRecord } from './entities/message-send-record.entity';
import { SendMessageDto, SendBatchMessageDto, ProviderConfigDto, DingTalkConfigDto, WeChatConfigDto } from './dtos/message.dto';
import { BusinessLogger, LogCategory } from '../../common/utils/business-logger.util';

/**
 * 消息服务
 */
@Injectable()
export class MessageService {
  private readonly businessLogger: BusinessLogger;
  private readonly providers: Map<string, IMessageProvider> = new Map();

  constructor(
    @InjectRepository(MessageSendRecord)
    private readonly messageSendRecordRepository: Repository<MessageSendRecord>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly dingTalkProvider: DingTalkProvider,
    private readonly weChatProvider: WeChatProvider
  ) {
    this.businessLogger = new BusinessLogger(MessageService.name);
    this.initializeProviders();
    this.loadConfigurations();
  }

  /**
   * 初始化消息提供者
   */
  private initializeProviders(): void {
    // 注册钉钉提供者
    this.providers.set('dingtalk', this.dingTalkProvider);
    
    // 注册企业微信提供者
    this.providers.set('wechat', this.weChatProvider);
    
    this.businessLogger.serviceInfo('Message providers initialized');
  }

  /**
   * 从环境变量加载配置
   */
  private loadConfigurations(): void {
    // 加载钉钉配置
    const dingTalkEnabled = this.configService.get<boolean>('MESSAGE_DINGTALK_ENABLED', false);
    if (dingTalkEnabled) {
      const dingTalkConfig: DingTalkConfigDto = {
        enabled: true,
        accessToken: this.configService.get<string>('MESSAGE_DINGTALK_ACCESS_TOKEN', ''),
        webhookUrl: this.configService.get<string>('MESSAGE_DINGTALK_WEBHOOK_URL', ''),
        secret: this.configService.get<string>('MESSAGE_DINGTALK_SECRET', ''),
        retryTimes: this.configService.get<number>('MESSAGE_DINGTALK_RETRY_TIMES', 3),
        timeout: this.configService.get<number>('MESSAGE_DINGTALK_TIMEOUT', 5000),
      };
      this.configureProvider({ type: 'dingtalk', config: dingTalkConfig });
      this.businessLogger.serviceInfo('DingTalk provider configured from environment');
    }

    // 加载企业微信配置
    const weChatEnabled = this.configService.get<boolean>('MESSAGE_WECHAT_ENABLED', false);
    if (weChatEnabled) {
      const weChatConfig: WeChatConfigDto = {
        enabled: true,
        webhookUrl: this.configService.get<string>('MESSAGE_WECHAT_WEBHOOK_URL', ''),
        retryTimes: this.configService.get<number>('MESSAGE_WECHAT_RETRY_TIMES', 3),
        timeout: this.configService.get<number>('MESSAGE_WECHAT_TIMEOUT', 5000),
      };
      this.configureProvider({ type: 'wechat', config: weChatConfig });
      this.businessLogger.serviceInfo('WeChat provider configured from environment');
    }

    this.businessLogger.serviceInfo('Message configurations loaded from environment');
  }

  /**
   * 配置提供者
   */
  configureProvider(config: ProviderConfigDto): void {
    const provider = this.providers.get(config.type);
    if (!provider) {
      throw new Error(`Provider ${config.type} not found`);
    }

    switch (config.type) {
      case 'dingtalk':
        this.dingTalkProvider.initDingTalk(config.config as DingTalkConfigDto);
        break;
      case 'wechat':
        this.weChatProvider.initWeChat(config.config as WeChatConfigDto);
        break;
      default:
        throw new Error(`Provider ${config.type} configuration not implemented`);
    }

    this.businessLogger.serviceInfo(`Provider ${config.type} configured`);
  }

  /**
   * 发送消息 - 发送到所有已配置的消息通道
   */
  async sendMessage(dto: SendMessageDto): Promise<MessageSendResult[]> {
    const { provider, target, ...content } = dto;
    const results: MessageSendResult[] = [];
    
    let targetProviders: IMessageProvider[] = [];
    
    if (provider) {
      // 指定提供者
      const messageProvider = this.providers.get(provider);
      if (!messageProvider) {
        throw new Error(`Provider ${provider} not found`);
      }
      targetProviders = [messageProvider];
    } else {
      // 发送到所有已配置的提供者
      targetProviders = this.getAvailableProviders();
      if (targetProviders.length === 0) {
        this.businessLogger.serviceInfo('No available message providers configured');
        return [];
      }
    }

    // 并行发送到所有目标提供者
    const sendPromises = targetProviders.map(async (messageProvider) => {
      try {
        this.businessLogger.httpRequest('POST', 'send-message', { 
          provider: messageProvider.getName(), 
          target 
        });

        const result = await messageProvider.send(content, target);
        
        if (result.success) {
          this.businessLogger.serviceInfo('Message sent successfully', { 
            provider: messageProvider.getName(),
            messageId: result.messageId 
          });
        } else {
          this.businessLogger.businessError('Failed to send message', new Error(result.error), { 
            provider: messageProvider.getName(),
            target 
          });
        }

        return result;
      } catch (error) {
        this.businessLogger.businessError('Error sending message', error, { 
          provider: messageProvider.getName(),
          target 
        });
        
        return {
          success: false,
          error: error.message,
          timestamp: new Date()
        };
      }
    });

    return await Promise.all(sendPromises);
  }

  /**
   * 批量发送消息
   */
  async sendBatchMessage(dto: SendBatchMessageDto): Promise<MessageSendResult[]> {
    const { provider, targets, ...content } = dto;
    
    let messageProvider: IMessageProvider;
    
    if (provider) {
      messageProvider = this.providers.get(provider);
      if (!messageProvider) {
        throw new Error(`Provider ${provider} not found`);
      }
    } else {
      messageProvider = this.getFirstAvailableProvider();
      if (!messageProvider) {
        throw new Error('No available message provider');
      }
    }

    try {
      this.businessLogger.httpRequest('POST', 'send-batch-message', { 
        provider: messageProvider.getName(), 
        targetCount: targets.length 
      });

      const results = await messageProvider.sendBatch(content, targets);
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      this.businessLogger.serviceInfo('Batch message sent', { 
        provider: messageProvider.getName(),
        successCount,
        failureCount,
        total: targets.length 
      });

      return results;
    } catch (error) {
      this.businessLogger.businessError('Error sending batch message', error, { 
        provider: messageProvider.getName(),
        targetCount: targets.length 
      });
      
      return targets.map(() => ({
        success: false,
        error: error.message,
        timestamp: new Date()
      }));
    }
  }

  /**
   * 发送钉钉消息
   */
  async sendDingTalkMessage(content: string, title?: string): Promise<MessageSendResult[]> {
    const results = await this.sendMessage({
      content,
      title,
      provider: 'dingtalk'
    });
    return results;
  }

  /**
   * 发送企业微信消息
   */
  async sendWeChatMessage(content: string, title?: string): Promise<MessageSendResult[]> {
    const results = await this.sendMessage({
      content,
      title,
      provider: 'wechat'
    });
    return results;
  }

  /**
   * 发送分析结果消息
   */
  async sendAnalysisResult(analysisResult: any, targets: string[] = []): Promise<MessageSendResult[]> {
    const content = this.formatAnalysisResult(analysisResult);
    
    if (targets.length === 0) {
      // 如果没有指定目标，发送到所有已配置的提供者
      return this.sendMessage({
        content,
        title: '股票分析结果',
        messageType: 'markdown' as any
      });
    }

    // 批量发送到指定目标
    return this.sendBatchMessage({
      content,
      title: '股票分析结果',
      messageType: 'markdown' as any,
      targets
    });
  }

  /**
   * 发送新闻摘要消息
   */
  async sendNewsSummary(newsSummary: any, targets: string[] = []): Promise<MessageSendResult[]> {
    const content = this.formatNewsSummary(newsSummary);
    
    if (targets.length === 0) {
      // 发送到所有已配置的提供者
      return this.sendMessage({
        content,
        title: '新闻摘要',
        messageType: 'markdown' as any
      });
    }

    return this.sendBatchMessage({
      content,
      title: '新闻摘要',
      messageType: 'markdown' as any,
      targets
    });
  }

  /**
   * 获取消息发送记录
   */
  async getMessageSendRecords(
    page: number = 1,
    limit: number = 20,
    provider?: string,
    status?: string
  ): Promise<{ items: MessageSendRecord[]; total: number }> {
    const queryBuilder = this.messageSendRecordRepository.createQueryBuilder('record')
      .orderBy('record.createdAt', 'DESC');

    if (provider) {
      queryBuilder.andWhere('record.provider = :provider', { provider });
    }

    if (status) {
      queryBuilder.andWhere('record.status = :status', { status });
    }

    const total = await queryBuilder.getCount();
    const items = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items, total };
  }

  /**
   * 获取第一个可用的提供者
   */
  private getFirstAvailableProvider(): IMessageProvider | null {
    for (const [name, provider] of this.providers) {
      if (provider.validateConfig()) {
        return provider;
      }
    }
    return null;
  }

  /**
   * 获取所有已配置的提供者
   */
  private getAvailableProviders(): IMessageProvider[] {
    const availableProviders: IMessageProvider[] = [];
    
    for (const [name, provider] of this.providers) {
      if (provider.validateConfig()) {
        availableProviders.push(provider);
      }
    }
    
    return availableProviders;
  }

  /**
   * 格式化分析结果
   */
  private formatAnalysisResult(analysisResult: any): string {
    let content = `## ${analysisResult.stockName || analysisResult.stockCode} 分析结果\n\n`;
    
    if (analysisResult.finalRecommendation) {
      content += `**投资建议**: ${analysisResult.finalRecommendation}\n\n`;
    }
    
    if (analysisResult.averageScore) {
      content += `**综合评分**: ${analysisResult.averageScore}/100\n\n`;
    }
    
    if (analysisResult.keyInsights && analysisResult.keyInsights.length > 0) {
      content += `**关键洞察**:\n`;
      analysisResult.keyInsights.forEach((insight: string, index: number) => {
        content += `${index + 1}. ${insight}\n`;
      });
      content += '\n';
    }
    
    if (analysisResult.majorRisks && analysisResult.majorRisks.length > 0) {
      content += `**主要风险**:\n`;
      analysisResult.majorRisks.forEach((risk: string, index: number) => {
        content += `${index + 1}. ${risk}\n`;
      });
      content += '\n';
    }
    
    if (analysisResult.confidence) {
      content += `**置信度**: ${(analysisResult.confidence * 100).toFixed(1)}%\n\n`;
    }
    
    content += `\n分析时间: ${new Date().toLocaleString()}`;
    
    return content;
  }

  /**
   * 格式化新闻摘要
   */
  private formatNewsSummary(newsSummary: any): string {
    let content = `## ${newsSummary.title || '新闻摘要'}\n\n`;
    
    if (newsSummary.summary) {
      content += `${newsSummary.summary}\n\n`;
    }
    
    if (newsSummary.source) {
      content += `**来源**: ${newsSummary.source}\n`;
    }
    
    if (newsSummary.publishTime) {
      content += `**发布时间**: ${new Date(newsSummary.publishTime).toLocaleString()}\n`;
    }
    
    if (newsSummary.url) {
      content += `**原文链接**: [查看原文](${newsSummary.url})\n`;
    }
    
    content += `\n生成时间: ${new Date().toLocaleString()}`;
    
    return content;
  }
}