/**
 * 摘要生成智能体
 * 专门用于为各种内容类型生成智能摘要
 * 继承自BaseAgent，利用其LLM调用和执行记录功能
 */

import { Injectable } from '@nestjs/common';
import { BaseAgent } from '../base/base-agent';
import { AgentType, AgentContext, AgentResult } from '../interfaces/agent.interface';
import { LLMService } from '../services/llm.service';
import { AgentExecutionRecordService } from '../services/agent-execution-record.service';
import { 
  SummaryGenerationInput, 
  SummaryGenerationResult, 
  ContentType 
} from '../../common/interfaces/summary-generation.interface';
import { buildCompletePrompt } from '../../common/prompts/summary-generation.prompts';

/**
 * 摘要生成智能体上下文扩展
 */
export interface SummaryGenerationContext extends AgentContext {
  /** 摘要生成输入 */
  summaryInput: SummaryGenerationInput;
}

/**
 * 摘要生成智能体
 * 专门处理各种内容类型的摘要生成任务
 */
@Injectable()
export class SummaryGenerationAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    executionRecordService?: AgentExecutionRecordService
  ) {
    super(
      'SummaryGenerationAgent',
      AgentType.NEWS_ANALYST_NEW, // 使用新闻分析智能体类型
      '专业的摘要生成专家，能够为各种内容类型生成精炼、准确的摘要',
      llmService,
      undefined, // dataToolkit 不需要
      {
        model: 'qwen-turbo', // 默认使用轻量级模型
        temperature: 0.3,
        maxTokens: 500,
        timeout: 60,
        retryCount: 2,
        systemPrompt: `你是一个专业的摘要生成专家，擅长为各种类型的内容生成精炼、准确的摘要。
你的任务是根据内容类型特点，提取关键信息，生成结构化的摘要输出。

支持的摘要类型：
- 新闻摘要：按照5W1H原则（Who、What、When、Where、Why、How）
- 政策摘要：重点关注政策要点、实施细节和影响分析
- 热搜摘要：快速提取热点信息和用户关注点
- 报告摘要：提炼核心结论和关键数据
- 公告摘要：突出重要信息和时间节点

输出格式要求：
- 内容长度控制在200-300字之间
- 语言简洁明了，避免冗余信息
- 保持客观中立的语调
- 突出内容的独特价值和关键信息`
      },
      executionRecordService
    );
  }

  /**
   * 准备上下文 - 验证和准备摘要生成所需的上下文数据
   */
  protected async prepareContext(context: AgentContext): Promise<AgentContext> {
    const summaryContext = context as SummaryGenerationContext;
    
    if (!summaryContext.summaryInput) {
      throw new Error('摘要生成上下文中缺少summaryInput字段');
    }

    const { content, contentType, title } = summaryContext.summaryInput;
    
    if (!content || content.trim().length === 0) {
      throw new Error('摘要内容不能为空');
    }

    if (!contentType || !Object.values(ContentType).includes(contentType)) {
      throw new Error(`不支持的内容类型: ${contentType}`);
    }

    // 添加内容类型相关的元数据
    summaryContext.metadata = {
      ...summaryContext.metadata,
      contentType,
      title: title || '无标题',
      contentLength: content.length,
      source: summaryContext.summaryInput.source,
      publishTime: summaryContext.summaryInput.publishTime
    };

    this.logger.debug(`摘要生成上下文准备完成: ${contentType}, 内容长度: ${content.length}`);
    return summaryContext;
  }

  /**
   * 执行分析 - 调用LLM生成摘要
   */
  protected async executeAnalysis(context: AgentContext): Promise<string> {
    const summaryContext = context as SummaryGenerationContext;
    const { summaryInput } = summaryContext;
    
    // 构建专门的摘要生成提示词
    const { systemPrompt, userPrompt, config: promptConfig } = buildCompletePrompt({
      content: summaryInput.content,
      title: summaryInput.title,
      contentType: summaryInput.contentType,
      maxTokens: summaryInput.maxTokens,
      customPrompt: summaryInput.customPrompt,
      language: summaryInput.language || 'zh'
    });

    // 根据内容类型动态调整模型配置
    const modelConfig = this.selectModelByContentType(summaryInput.contentType, promptConfig);
    
    // 更新配置
    this.config.model = modelConfig.model;
    this.config.maxTokens = modelConfig.maxTokens;
    this.config.temperature = modelConfig.temperature || 0.3;

    // 使用专门的系统提示词
    const originalSystemPrompt = this.config.systemPrompt;
    this.config.systemPrompt = systemPrompt;

    try {
      this.logger.debug(`开始生成摘要，使用模型: ${modelConfig.model}`);
      
      // 调用LLM生成摘要
      const summary = await this.callLLM(userPrompt);
      
      this.logger.debug(`摘要生成完成，长度: ${summary.length}`);
      return summary;
    } finally {
      // 恢复原始系统提示词
      this.config.systemPrompt = originalSystemPrompt;
    }
  }

  /**
   * 处理结果 - 将LLM响应转换为结构化的摘要结果
   */
  protected async processResult(analysis: string, context: AgentContext): Promise<AgentResult> {
    const summaryContext = context as SummaryGenerationContext;
    
    try {
      // 尝试解析JSON格式的响应
      const parsedResult = this.parseLLMResult(analysis);
      
      const result: AgentResult = {
        agentName: this.name,
        agentType: this.type,
        analysis: parsedResult.summary,
        timestamp: new Date(),
        score: this.calculateSummaryScore(parsedResult),
        confidence: this.calculateSummaryConfidence(parsedResult),
        keyInsights: parsedResult.keyPoints || [],
        supportingData: {
          category: parsedResult.category || '其他',
          sentiment: parsedResult.sentiment || 'neutral',
          tags: parsedResult.tags || [],
          contentType: summaryContext.summaryInput.contentType,
          source: summaryContext.summaryInput.source,
          tokenUsage: parsedResult.tokenUsage
        }
      };

      this.logger.debug(`摘要结果处理完成，评分: ${result.score}, 置信度: ${result.confidence}`);
      return result;
    } catch (error) {
      this.logger.warn(`解析摘要结果失败，使用原始文本: ${error.message}`);
      
      // 如果解析失败，返回基础结果
      return {
        agentName: this.name,
        agentType: this.type,
        analysis: analysis.trim(),
        timestamp: new Date(),
        score: 70, // 默认评分
        confidence: 0.7, // 默认置信度
        supportingData: {
          contentType: summaryContext.summaryInput.contentType,
          source: summaryContext.summaryInput.source
        }
      };
    }
  }

  /**
   * 构建提示词 - 重写以提供专门的摘要生成提示
   */
  protected async buildPrompt(context: AgentContext): Promise<string> {
    const summaryContext = context as SummaryGenerationContext;
    const { summaryInput } = summaryContext;
    
    const { systemPrompt, userPrompt } = buildCompletePrompt({
      content: summaryInput.content,
      title: summaryInput.title,
      contentType: summaryInput.contentType,
      maxTokens: summaryInput.maxTokens,
      customPrompt: summaryInput.customPrompt,
      language: summaryInput.language || 'zh'
    });

    return userPrompt;
  }

  /**
   * 专门的摘要生成方法 - 提供简化的接口
   */
  async generateSummary(input: SummaryGenerationInput): Promise<SummaryGenerationResult> {
    const startTime = Date.now();
    
    try {
      // 构建智能体上下文
      const context: SummaryGenerationContext = {
        stockCode: 'SUMMARY', // 使用虚拟股票代码
        stockName: 'Summary Generation',
        summaryInput: input,
        metadata: {
          analysisType: 'summary_generation',
          sessionId: `summary_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        }
      };

      // 调用智能体分析
      const agentResult = await this.analyze(context);

      // 转换为摘要生成结果格式
      const result: SummaryGenerationResult = {
        success: true,
        summary: agentResult.analysis,
        keyPoints: agentResult.keyInsights || [],
        sentiment: agentResult.supportingData?.sentiment || 'neutral',
        category: agentResult.supportingData?.category || '其他',
        tags: agentResult.supportingData?.tags || [],
        tokenUsage: agentResult.supportingData?.tokenUsage || this.estimateTokenUsage(agentResult.analysis),
        processingTime: agentResult.processingTime || (Date.now() - startTime),
        message: '摘要生成成功'
      };

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('摘要生成失败', error);
      
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
   * 根据内容类型选择合适的模型
   */
  private selectModelByContentType(contentType: ContentType, promptConfig: any): any {
    // 简单内容类型使用轻量级模型
    const simpleTypes = [ContentType.NEWS, ContentType.HOT_SEARCH, ContentType.ANNOUNCEMENT];
    
    if (simpleTypes.includes(contentType)) {
      return {
        model: 'qwen-turbo',
        maxTokens: promptConfig.maxOutputTokens || 500,
        temperature: 0.3
      };
    }

    // 复杂内容类型使用标准模型
    const complexTypes = [ContentType.POLICY, ContentType.REPORT, ContentType.ARTICLE];
    
    if (complexTypes.includes(contentType)) {
      return {
        model: 'qwen-plus',
        maxTokens: promptConfig.maxOutputTokens || 600,
        temperature: 0.3
      };
    }

    // 默认使用轻量级模型
    return {
      model: 'qwen-turbo',
      maxTokens: promptConfig.maxOutputTokens || 500,
      temperature: 0.3
    };
  }

  /**
   * 解析LLM返回结果
   */
  private parseLLMResult(llmResponse: string): any {
    try {
      // 尝试解析JSON格式的响应
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          summary: parsed.summary || llmResponse,
          keyPoints: parsed.keyPoints || [],
          sentiment: parsed.sentiment || 'neutral',
          category: parsed.category || '其他',
          tags: parsed.tags || [],
          tokenUsage: this.estimateTokenUsage(llmResponse)
        };
      }

      // 如果不是JSON格式，提取纯文本摘要
      return {
        summary: llmResponse.trim(),
        keyPoints: this.extractKeyPoints(llmResponse),
        sentiment: this.analyzeSentiment(llmResponse),
        category: '其他',
        tags: [],
        tokenUsage: this.estimateTokenUsage(llmResponse)
      };
    } catch (error) {
      // 解析失败时，返回原始响应
      return {
        summary: llmResponse.trim(),
        tokenUsage: this.estimateTokenUsage(llmResponse)
      };
    }
  }

  /**
   * 提取关键点
   */
  private extractKeyPoints(text: string): string[] {
    const sentences = text.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
    return sentences.slice(0, 3).map(s => s.trim());
  }

  /**
   * 分析情感倾向
   */
  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['增长', '提升', '改善', '成功', '利好', '积极', '发展', '创新'];
    const negativeWords = ['下降', '减少', '恶化', '失败', '利空', '消极', '危机', '风险'];
    
    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * 估算Token使用量
   */
  private estimateTokenUsage(text: string): { input: number; output: number; total: number } {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    
    const tokens = Math.ceil(chineseChars * 1.5 + otherChars * 0.25);
    
    return {
      input: Math.ceil(tokens * 0.7),
      output: tokens,
      total: Math.ceil(tokens * 1.7)
    };
  }

  /**
   * 计算摘要评分
   */
  private calculateSummaryScore(parsedResult: any): number {
    let score = 70; // 基础分

    // 长度评分 (150-300字为最佳)
    const length = parsedResult.summary.length;
    if (length >= 150 && length <= 300) {
      score += 20;
    } else if (length >= 100 && length <= 400) {
      score += 10;
    }

    // 关键点评分
    if (parsedResult.keyPoints && parsedResult.keyPoints.length >= 2) {
      score += 10;
    }

    // 结构化评分
    if (parsedResult.category && parsedResult.sentiment) {
      score += 5;
    }

    return Math.min(100, score);
  }

  /**
   * 计算摘要置信度
   */
  private calculateSummaryConfidence(parsedResult: any): number {
    let confidence = 0.7; // 基础置信度

    // 根据摘要质量调整置信度
    const summary = parsedResult.summary;
    
    // 长度适中
    if (summary.length >= 150 && summary.length <= 300) {
      confidence += 0.1;
    }

    // 包含关键信息
    if (parsedResult.keyPoints && parsedResult.keyPoints.length > 0) {
      confidence += 0.1;
    }

    // 有情感和分类信息
    if (parsedResult.sentiment && parsedResult.category) {
      confidence += 0.05;
    }

    return Math.min(1, confidence);
  }
}