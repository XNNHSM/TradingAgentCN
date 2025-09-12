import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DingTalkProvider } from './adapters/webhook/dingtalk.provider';
import { WeChatProvider } from './adapters/webhook/wechat.provider';
import { IMessageProvider, MessageContent, MessageSendResult } from './interfaces/message-provider.interface';
import { MessageSendRecord } from './entities/message-send-record.entity';
import { SendMessageDto, SendBatchMessageDto, ProviderConfigDto, DingTalkConfigDto, WeChatConfigDto, MessageType } from './dtos/message.dto';
import { BusinessLogger, LogCategory } from '../../common/utils/business-logger.util';
import { TradingRecommendation } from '../../agents/interfaces/agent.interface';

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
    
    content += `\n生成时间: ${new Date().toISOString().split('T')[0]}`;
    
    return content;
  }

  /**
   * 发送股票分析报告 - 统一接口
   * 这是所有股票分析消息的统一发送方法，确保格式一致性
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
  }): Promise<MessageSendResult[]> {
    const { stockCode, stockName, finalDecision, currentPrice, summary, metadata } = params;
    
    let content: string;
    let title: string;
    let messageSource = 'stock-analysis';
    
    // 检查是否是每日汇总
    if (metadata?.isDailySummary && metadata?.stockRecords) {
      // 使用每日汇总格式
      content = this.formatDailyStockAnalysisReport(metadata.stockRecords, metadata);
      title = `📊 ${stockName}`;
      messageSource = 'daily-message-scheduler';
    } else {
      // 使用单只股票分析格式
      content = this.formatStockAnalysisReport({
        stockCode,
        stockName,
        finalDecision,
        currentPrice,
        summary
      });
      title = `📈 ${stockName}（${stockCode}）分析报告`;
    }
    
    // 发送到所有配置的消息提供者
    return this.sendMessage({
      content,
      title,
      messageType: MessageType.MARKDOWN,
      metadata: {
        source: messageSource,
        stockCode,
        stockName,
        ...metadata,
        sentAt: new Date().toISOString(),
      }
    });
  }

  /**
   * 格式化股票分析报告 - 统一格式化逻辑
   * 与工作流中的格式保持完全一致
   */
  private formatStockAnalysisReport(params: {
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
  }): string {
    const { stockCode, stockName, finalDecision, currentPrice, summary } = params;
    
    let content = `📈 ${stockName}（${stockCode}）分析报告\n\n`;
    
    // 添加当前价格信息
    if (currentPrice) {
      content += `当前价格: ¥${currentPrice.toFixed(2)}\n\n`;
    }
    
    // 添加详细的分析摘要
    if (summary) {
      content += `📋 分析摘要\n`;
      content += `投资摘要\n`;
      content += `${summary}\n\n`;
    }
    
    // 添加投资决策摘要
    content += `💰 投资决策摘要\n`;
    content += `评级\n`;
    content += `数值\n`;
    content += `指标\n`;
    content += `${this.getScoreGrade(finalDecision.overallScore)}\n`;
    content += `${finalDecision.overallScore}/100\n`;
    content += `综合评分\n`;
    content += `${this.getConfidenceGrade(finalDecision.confidence)}\n`;
    content += `${Math.round(finalDecision.confidence * 100)}%\n`;
    content += `置信度\n`;
    content += `${this.getRiskGradeEmoji(finalDecision)} ${this.getRiskLevelText(finalDecision)}\n`;
    content += `${this.getRiskLevelText(finalDecision)}\n`;
    content += `风险等级\n`;
    
    // 投资建议中文映射
    const recommendationMap = {
      'BUY': '🟢 买入',
      'HOLD': '🟡 持有',
      'SELL': '🔴 卖出'
    };
    const recommendationText = recommendationMap[finalDecision.recommendation] || finalDecision.recommendation;
    content += `最终建议: **${recommendationText.replace(/^🟢 |🟡 |🔴 /, '')}**\n\n`;
    
    // 将来预估
    content += `📈 将来预估\n`;
    content += `短期预期（1-3个月）: ${this.getShortTermExpectation(finalDecision.overallScore, finalDecision.recommendation)}\n`;
    content += `中期预期（3-12个月）: ${this.getMediumTermExpectation(finalDecision.overallScore, finalDecision.confidence)}\n`;
    content += `预估可靠性: ${this.getConfidenceGrade(finalDecision.confidence)} (${Math.round(finalDecision.confidence * 100)}%)\n`;
    content += `关键观察指标:\n`;
    content += `• 技术面：关注成交量变化、关键技术位突破\n`;
    content += `• 基本面：关注${finalDecision.overallScore >= 60 ? '业绩增长' : '业绩改善'}情况\n`;
    content += `• 市场面：关注${finalDecision.confidence >= 0.6 ? '行业政策' : '市场情绪'}变化\n\n`;
    
    // 交易策略
    content += `🎯 交易策略\n`;
    content += `仓位建议:\n`;
    if (finalDecision.recommendation === 'BUY') {
      content += `• 建议仓位: ${finalDecision.overallScore >= 80 ? '20-30%' : finalDecision.overallScore >= 70 ? '15-25%' : '10-20%'}\n`;
      content += `• 分批建仓: 建议${finalDecision.overallScore >= 70 ? '2-3批' : '3-4批'}逐步建仓\n`;
    } else if (finalDecision.recommendation === 'HOLD') {
      content += `• 建议仓位: 维持现有仓位${finalDecision.overallScore >= 50 ? '（可小幅调整）' : '（不建议增仓）'}\n`;
      content += `• 调仓策略: ${finalDecision.overallScore >= 50 ? '逢高适当减仓，逢低小幅补仓' : '以观望为主，减少操作'}\n`;
    } else {
      content += `• 建议仓位: 逐步减仓至${finalDecision.overallScore >= 40 ? '5-10%' : '0-5%'}\n`;
      content += `• 减仓节奏: 建议${finalDecision.confidence >= 0.6 ? '2-3批' : '分批'}逐步减仓\n`;
    }
    
    // 止损止盈策略
    content += `止损止盈策略:\n`;
    if (finalDecision.recommendation === 'BUY') {
      const stopLoss = Math.max(5, 15 - Math.round(finalDecision.overallScore/10));
      const takeProfit = Math.min(25, 10 + Math.round(finalDecision.overallScore/5));
      content += `• 止损位: 建议设置在买入价的${stopLoss}%以下`;
      if (currentPrice) {
        const stopLossPrice = currentPrice * (1 - stopLoss/100);
        content += `（约¥${stopLossPrice.toFixed(2)}）`;
      }
      content += `\n`;
      content += `• 止盈位: 建议设置在买入价的${takeProfit}%以上`;
      if (currentPrice) {
        const takeProfitPrice = currentPrice * (1 + takeProfit/100);
        content += `（约¥${takeProfitPrice.toFixed(2)}）`;
      }
      content += `\n`;
    } else if (finalDecision.recommendation === 'HOLD') {
      const stopLoss = Math.max(8, 20 - Math.round(finalDecision.overallScore/5));
      const takeProfit = Math.min(20, Math.round(finalDecision.overallScore/3));
      content += `• 止损位: 建议设置在当前价位的${stopLoss}%以下`;
      if (currentPrice) {
        const stopLossPrice = currentPrice * (1 - stopLoss/100);
        content += `（约¥${stopLossPrice.toFixed(2)}）`;
      }
      content += `\n`;
      content += `• 止盈位: 建议设置在当前价位的${takeProfit}%以上`;
      if (currentPrice) {
        const takeProfitPrice = currentPrice * (1 + takeProfit/100);
        content += `（约¥${takeProfitPrice.toFixed(2)}）`;
      }
      content += `\n`;
    }
    content += `操作时间框架:\n`;
    content += `• 短线操作: 1-3个月，关注技术面变化\n`;
    content += `• 中线布局: 3-12个月，关注基本面改善\n`;
    content += `• 长线持有: 12个月以上，${finalDecision.confidence >= 0.7 ? '可考虑长线配置' : '建议谨慎长线持有'}\n`;
    
    // 风险控制
    content += `风险控制:\n`;
    content += `• 单只股票仓位: 不超过总资金的${finalDecision.recommendation === 'BUY' ? '30%' : '20%'}\n`;
    content += `• 行业集中度: 同行业股票总仓位不超过${finalDecision.confidence >= 0.6 ? '50%' : '40%'}\n`;
    content += `• 定期回顾: 建议${finalDecision.confidence >= 0.7 ? '每月' : '每季度'}评估投资逻辑\n\n`;
    
    // 关键决策因素
    if (finalDecision.keyDecisionFactors && finalDecision.keyDecisionFactors.length > 0) {
      content += `🔍 关键决策因素\n`;
      finalDecision.keyDecisionFactors.forEach((factor: string, index: number) => {
        content += `${index + 1}. ${factor}\n`;
      });
      content += '\n';
    }
    
    // 风险评估
    if (finalDecision.riskAssessment && finalDecision.riskAssessment.length > 0) {
      content += `⚠️ 风险评估\n`;
      finalDecision.riskAssessment.forEach((risk: string, index: number) => {
        content += `${index + 1}. ${risk}\n`;
      });
      content += '\n';
    }
    
    // 执行计划
    content += `📋 执行计划\n`;
    content += `行动计划: ${finalDecision.actionPlan || '根据分析结果制定投资策略'}\n\n`;
    
    content += `本报告由智能交易代理系统自动生成，仅供参考学习，不构成投资建议 生成时间: ${new Date().toISOString().split('T')[0]}\n`;
    
    return content;
  }

  /**
   * 获取评分等级
   */
  private getScoreGrade(score: number): string {
    if (score >= 80) return '优秀';
    if (score >= 70) return '良好';
    if (score >= 60) return '中等';
    if (score >= 50) return '一般';
    return '较差';
  }

  /**
   * 获取置信度等级
   */
  private getConfidenceGrade(confidence: number): string {
    if (confidence >= 0.8) return '高';
    if (confidence >= 0.6) return '中等';
    if (confidence >= 0.4) return '一般';
    return '低';
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(score: number, confidence: number): string {
    if (score < 40 || confidence < 0.4) return '高';
    if (score < 60 || confidence < 0.6) return '中高';
    if (score < 70 || confidence < 0.8) return '中等';
    return '低';
  }

  /**
   * 获取风险等级文本
   */
  private getRiskLevelText(finalDecision: any): string {
    return this.calculateRiskLevel(finalDecision.overallScore, finalDecision.confidence);
  }

  /**
   * 获取风险等级表情符号
   */
  private getRiskGradeEmoji(finalDecision: any): string {
    const riskLevel = this.calculateRiskLevel(finalDecision.overallScore, finalDecision.confidence);
    const riskEmojis = {
      '高': '🔴',
      '中高': '🟠',
      '中等': '🟡',
      '低': '🟢'
    };
    return riskEmojis[riskLevel] || '⚪';
  }

  /**
   * 获取短期预期
   */
  private getShortTermExpectation(score: number, recommendation?: string): string {
    if (recommendation === 'BUY') {
      return score >= 70 ? '乐观，预期涨幅5-15%' : '谨慎乐观，预期涨幅3-8%';
    } else if (recommendation === 'HOLD') {
      return `震荡整理，波动区间±${Math.round((100-score)/2)}%`;
    } else {
      return `承压下行，支撑位在当前价位的${Math.max(70, 100-score)}%附近`;
    }
  }

  /**
   * 获取中期预期
   */
  private getMediumTermExpectation(score: number, confidence: number): string {
    if (score >= 50) {
      return confidence >= 0.7 ? '有望企稳回升' : '需关注市场环境变化';
    } else {
      return '继续观望，等待明确信号';
    }
  }

  /**
   * 格式化每日股票分析汇总报告
   */
  private formatDailyStockAnalysisReport(stockRecords: any[], metadata?: any): string {
    const date = new Date().toLocaleDateString('zh-CN');
    const messageIndex = metadata?.messageIndex || 1;
    const totalMessages = metadata?.totalMessages || 1;
    
    let content = `## 📊 每日股票分析汇总 (${date})\n\n`;
    
    if (totalMessages > 1) {
      content += `**第 ${messageIndex}/${totalMessages} 条消息**\n\n`;
    }
    
    content += `本次汇总包含 ${stockRecords.length} 只股票的分析结果：\n\n`;

    // 统计概览
    const stats = this.calculateDailyAnalysisStats(stockRecords);
    content += `### 📈 总体概览\n\n`;
    content += `| 指标 | 数值 |\n`;
    content += `|------|------|\n`;
    content += `| **股票总数** | ${stockRecords.length} 只 |\n`;
    content += `| **平均评分** | ${stats.averageScore.toFixed(1)}/100 |\n`;
    content += `| **买入建议** | ${stats.buyCount} 只 (${(stats.buyCount / stockRecords.length * 100).toFixed(1)}%) |\n`;
    content += `| **持有建议** | ${stats.holdCount} 只 (${(stats.holdCount / stockRecords.length * 100).toFixed(1)}%) |\n`;
    content += `| **卖出建议** | ${stats.sellCount} 只 (${(stats.sellCount / stockRecords.length * 100).toFixed(1)}%) |\n`;
    content += `| **平均置信度** | ${(stats.averageConfidence * 100).toFixed(1)}% |\n\n`;

    // 推荐股票（高分买入）
    const topBuys = stockRecords
      .filter(r => r.finalRecommendation === 'BUY')
      .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))
      .slice(0, 3);

    if (topBuys.length > 0) {
      content += `### 🎯 重点推荐买入\n\n`;
      topBuys.forEach((record, index) => {
        content += `${index + 1}. **${record.stockName} (${record.stockCode})** - 评分: ${record.averageScore}/100, 置信度: ${((record.confidence || 0) * 100).toFixed(1)}%\n`;
      });
      content += '\n';
    }

    // 详细分析结果
    content += `### 📋 详细分析结果\n\n`;
    stockRecords.forEach((record, index) => {
      content += this.formatDailySingleStockAnalysis(record, index + 1);
    });

    // 分析时间范围
    if (metadata?.dateRange) {
      const startDate = new Date(metadata.dateRange.start).toLocaleDateString('zh-CN');
      const endDate = new Date(metadata.dateRange.end).toLocaleDateString('zh-CN');
      content += `---\n`;
      content += `*分析时间范围: ${startDate} - ${endDate}*\n`;
    }
    
    content += `*本报告由智能交易代理系统自动生成，仅供参考学习，不构成投资建议*\n`;
    
    return content;
  }

  /**
   * 格式化每日汇总中的单只股票分析
   */
  private formatDailySingleStockAnalysis(record: any, index: number): string {
    const recommendationEmoji = this.getRecommendationEmoji(record.finalRecommendation);
    const score = record.averageScore || 0;
    const confidence = record.confidence || 0;
    
    let content = `#### ${index}. ${recommendationEmoji} ${record.stockName}（${record.stockCode}）分析报告\n\n`;
    
    // 添加分析摘要
    if (record.summary) {
      content += `**分析摘要**: ${record.summary}\n\n`;
    }
    
    // 添加投资决策摘要
    content += `**投资决策摘要**:\n`;
    content += `| 指标 | 数值 | 评级 |\n`;
    content += `|------|------|------|\n`;
    content += `| **综合评分** | ${score.toFixed(2)}/100 | ${this.getScoreGrade(score)} |\n`;
    content += `| **置信度** | ${Math.round(confidence * 100)}% | ${this.getConfidenceGrade(confidence)} |\n`;
    content += `| **风险等级** | ${this.calculateRiskLevel(score, confidence)} | ${this.getRiskGradeEmoji({overallScore: score, confidence})} ${this.calculateRiskLevel(score, confidence)} |\n`;
    
    const recommendationText = this.getRecommendationText(record.finalRecommendation);
    content += `\n**最终建议**: **${recommendationText}**\n\n`;
    
    // 添加将来预估
    content += `**将来预估**:\n`;
    content += `- 短期预期（1-3个月）: ${this.getShortTermExpectation(score, record.finalRecommendation)}\n`;
    content += `- 中期预期（3-12个月）: ${this.getMediumTermExpectation(score, confidence)}\n`;
    content += `- 预估可靠性: ${this.getConfidenceGrade(confidence)} (${Math.round(confidence * 100)}%)\n\n`;
    
    // 添加关键决策因素
    if (record.keyInsights && record.keyInsights.length > 0) {
      content += `**关键决策因素**:\n`;
      record.keyInsights.slice(0, 3).forEach((insight: string, i: number) => {
        content += `${i + 1}. ${insight}\n`;
      });
      content += '\n';
    }
    
    // 添加风险评估
    if (record.majorRisks && record.majorRisks.length > 0) {
      content += `**主要风险**:\n`;
      record.majorRisks.slice(0, 3).forEach((risk: string, i: number) => {
        content += `${i + 1}. ${risk}\n`;
      });
      content += '\n';
    }
    
    content += '\n';
    return content;
  }

  /**
   * 计算每日分析统计信息
   */
  private calculateDailyAnalysisStats(records: any[]): {
    averageScore: number;
    averageConfidence: number;
    buyCount: number;
    holdCount: number;
    sellCount: number;
  } {
    const validScores = records.filter(r => r.averageScore !== undefined);
    const validConfidences = records.filter(r => r.confidence !== undefined);
    
    const averageScore = validScores.length > 0 
      ? validScores.reduce((sum, r) => sum + (r.averageScore || 0), 0) / validScores.length 
      : 0;
    
    const averageConfidence = validConfidences.length > 0 
      ? validConfidences.reduce((sum, r) => sum + (r.confidence || 0), 0) / validConfidences.length 
      : 0;
    
    const buyCount = records.filter(r => r.finalRecommendation === 'BUY').length;
    const holdCount = records.filter(r => r.finalRecommendation === 'HOLD').length;
    const sellCount = records.filter(r => r.finalRecommendation === 'SELL').length;

    return {
      averageScore,
      averageConfidence,
      buyCount,
      holdCount,
      sellCount,
    };
  }

  /**
   * 获取建议文本
   */
  private getRecommendationText(recommendation?: string): string {
    switch (recommendation) {
      case 'BUY':
        return '买入';
      case 'HOLD':
        return '持有';
      case 'SELL':
        return '卖出';
      default:
        return '无建议';
    }
  }

  /**
   * 获取建议表情符号
   */
  private getRecommendationEmoji(recommendation?: string): string {
    switch (recommendation) {
      case 'BUY':
        return '🟢';
      case 'HOLD':
        return '🟡';
      case 'SELL':
        return '🔴';
      default:
        return '⚪';
    }
  }

  }