/**
 * 通用摘要生成服务
 * 支持多种内容类型的智能摘要生成
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  SummaryGenerationInput, 
  SummaryGenerationResult, 
  ContentType, 
  LLMModelConfig,
  ISummaryGenerator
} from '../../common/interfaces/summary-generation.interface';
import { buildCompletePrompt } from '../../common/prompts/summary-generation.prompts';
import { BusinessLogger } from '../../common/utils/business-logger.util';
import { SummaryGenerationAgent } from '../../agents/unified/summary-generation.agent';
import { AgentExecutionRecordService } from '../../agents/services/agent-execution-record.service';

/**
 * 轻量级摘要生成器实现
 * 使用 qwen-turbo 模型，成本较低，适合大规模处理
 * 现在委托给 SummaryGenerationAgent 执行实际的摘要生成任务
 */
@Injectable()
export class SummaryGenerationService implements ISummaryGenerator {
  private readonly businessLogger = new BusinessLogger(SummaryGenerationService.name);

  // 默认模型配置（轻量级，成本较低）
  private readonly defaultModelConfig: LLMModelConfig = {
    provider: 'dashscope',
    model: 'qwen-turbo',
    maxTokens: 500,
    temperature: 0.3,
    topP: 0.8,
    costPer1kTokens: 0.002 // qwen-turbo 的成本
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly summaryGenerationAgent: SummaryGenerationAgent
  ) {}

  /**
   * 生成摘要 - 委托给 SummaryGenerationAgent 执行
   */
  async generate(input: SummaryGenerationInput): Promise<SummaryGenerationResult> {
    const startTime = Date.now();
    const { content, contentType, title, source, publishTime } = input;

    try {
      this.businessLogger.serviceInfo('开始生成摘要', {
        contentType,
        title: title || '无标题',
        contentLength: content.length,
        source,
        publishTime
      });

      // 1. 内容预处理和清理
      const cleanedContent = this.preprocessContent(content, contentType);
      
      // 2. 构建增强的输入
      const enhancedInput: SummaryGenerationInput = {
        ...input,
        content: cleanedContent
      };

      // 3. 委托给 SummaryGenerationAgent 执行摘要生成
      const agentResult = await this.summaryGenerationAgent.generateSummary(enhancedInput);

      const processingTime = Date.now() - startTime;

      this.businessLogger.serviceInfo('摘要生成完成', {
        contentType,
        processingTime,
        summaryLength: agentResult.summary?.length || 0,
        tokenUsage: agentResult.tokenUsage
      });

      return {
        ...agentResult,
        processingTime, // 使用服务层的处理时间
        message: agentResult.message || '摘要生成成功'
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.businessLogger.serviceError('摘要生成失败', error, {
        contentType,
        title,
        processingTime
      });

      return {
        success: false,
        summary: '',
        processingTime,
        message: '摘要生成失败',
        error: errorMessage
      };
    }
  }

  /**
   * 检查是否支持指定的内容类型
   */
  isSupported(contentType: ContentType): boolean {
    return Object.values(ContentType).includes(contentType);
  }

  /**
   * 内容预处理和清理
   */
  private preprocessContent(content: string, contentType: ContentType): string {
    let cleanedContent = content.trim();

    // 移除多余的空白字符
    cleanedContent = cleanedContent.replace(/\s+/g, ' ');
    
    // 移除HTML标签（如果有）
    cleanedContent = cleanedContent.replace(/<[^>]*>/g, '');
    
    // 根据内容类型进行特殊处理
    switch (contentType) {
      case ContentType.NEWS:
        // 新闻内容：保留关键信息结构
        cleanedContent = this.cleanNewsContent(cleanedContent);
        break;
      case ContentType.POLICY:
        // 政策内容：保留条款结构
        cleanedContent = this.cleanPolicyContent(cleanedContent);
        break;
      case ContentType.HOT_SEARCH:
        // 热搜内容：精简描述
        cleanedContent = this.cleanHotSearchContent(cleanedContent);
        break;
      default:
        // 默认处理：限制长度，保留核心内容
        cleanedContent = cleanedContent.length > 8000 
          ? cleanedContent.substring(0, 8000) + '...' 
          : cleanedContent;
    }

    return cleanedContent;
  }

  /**
   * 清理新闻内容
   */
  private cleanNewsContent(content: string): string {
    // 移除常见的新闻模板文本
    const noisePatterns = [
      /本文来源：.*?记者.*?报道/g,
      /责任编辑：.*$/g,
      /【更多详情，请点击.*?】/g,
      /（完）/g,
      /编辑：.*$/g
    ];

    let cleaned = content;
    noisePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    return cleaned.trim();
  }

  /**
   * 清理政策内容
   */
  private cleanPolicyContent(content: string): string {
    // 保留政策文件的结构化信息
    const cleaned = content
      .replace(/第[一二三四五六七八九十\d]+条[：:]/g, '\n$&')
      .replace(/（[一二三四五六七八九十\d]+）[：:]/g, '\n$&')
      .replace(/[一二三四五六七八九十\d]+[、．.]/g, '\n$&');

    return cleaned.trim();
  }

  /**
   * 清理热搜内容
   */
  private cleanHotSearchContent(content: string): string {
    // 移除热搜特有噪音
    const cleaned = content
      .replace(/#.*?#/g, '') // 移除话题标签
      .replace(/@.*?\s/g, ' ') // 移除@提及
      .replace(/【.*?】/g, '') // 移除方括号内容
      .replace(/\[.*?\]/g, ''); // 移除方括号内容

    return cleaned.trim();
  }

  /**
   * 选择合适的模型
   */
  private selectModel(contentType: ContentType, promptConfig: any): LLMModelConfig {
    // 对于简单内容类型，使用轻量级模型
    const simpleTypes = [ContentType.NEWS, ContentType.HOT_SEARCH, ContentType.ANNOUNCEMENT];
    
    if (simpleTypes.includes(contentType)) {
      return {
        ...this.defaultModelConfig,
        model: 'qwen-turbo',
        maxTokens: promptConfig.maxOutputTokens
      };
    }

    // 对于复杂内容类型，使用标准模型
    const complexTypes = [ContentType.POLICY, ContentType.REPORT, ContentType.ARTICLE];
    
    if (complexTypes.includes(contentType)) {
      return {
        ...this.defaultModelConfig,
        model: 'qwen-plus',
        maxTokens: promptConfig.maxOutputTokens,
        costPer1kTokens: 0.005 // qwen-plus 的成本
      };
    }

    // 默认使用轻量级模型
    return {
      ...this.defaultModelConfig,
      maxTokens: promptConfig.maxOutputTokens
    };
  }
}