/**
 * LLM适配器基础接口和抽象类
 * 参考Python版本实现，提供统一的LLM调用接口
 */

import {Logger} from "@nestjs/common";

/**
 * LLM使用统计信息
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost?: number; // 可选的成本信息
}

/**
 * LLM响应结果接口
 */
export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason?: string;
  usage?: TokenUsage;
  model?: string;
  id?: string;
}

/**
 * 工具调用接口
 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 消息接口
 */
export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string; // 用于工具调用响应
  toolCallId?: string; // 工具调用ID
}

/**
 * LLM配置接口
 */
export interface LLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeout?: number;
  maxRetries?: number; // 最大重试次数
  stream?: boolean;
  tools?: ToolDefinition[]; // Function calling 工具定义
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  stop?: string[];
  
  // 内容分段处理配置
  enableSegmentation?: boolean;
  segmentationStrategy?: 'semantic' | 'size' | 'hybrid';
  maxSegments?: number;
  preserveContext?: boolean;
  sessionId?: string; // 用于token追踪
  analysisType?: string; // 分析类型
  [key: string]: any; // 允许其他自定义参数
}

/**
 * 工具定义接口
 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

/**
 * LLM模型信息
 */
export interface ModelInfo {
  name: string;
  description: string;
  contextLength: number;
  supportsFunctionCalling: boolean;
  costPer1kInputTokens?: number;
  costPer1kOutputTokens?: number;
  recommendedFor: string[];
}

/**
 * 供应商特定的长度限制配置
 */
export interface ProviderLengthLimits {
  maxInputLength: number;
  recommendedMaxInputLength: number;
  chunkOverlap: number;
  chunkSize: number;
}

/**
 * 内容管理策略接口
 */
export interface ContentManagementStrategy {
  canHandle(content: string | LLMMessage[], model: string): boolean;
  process(content: string | LLMMessage[], model: string, config?: LLMConfig): Promise<string | LLMMessage[]>;
  getEstimatedTokens(content: string | LLMMessage[]): number;
}

/**
 * 内容管理结果
 */
export interface ContentManagementResult {
  processedContent: string | LLMMessage[];
  strategy: string;
  compressionRatio?: number;
  segmentCount?: number;
  originalTokens: number;
  processedTokens: number;
}

/**
 * 分片信息接口
 */
export interface ChunkInfo {
  id: string;
  content: string;
  index: number;
  totalChunks: number;
  isLastChunk: boolean;
  overlapWithNext?: string;
}

/**
 * 分片管理结果
 */
export interface ChunkManagementResult {
  strategy: string;
  chunks: ChunkInfo[];
  totalChunks: number;
  originalLength: number;
  averageChunkLength: number;
  overlapRate: number;
}

/**
 * LLM适配器抽象基类
 */
export abstract class BaseLLMAdapter {
  protected readonly logger: Logger;
  protected readonly providerName: string;
  protected initialized = false;
  
  // 内容管理策略注册表
  protected contentStrategies: Map<string, ContentManagementStrategy> = new Map();

  constructor(providerName: string) {
    this.providerName = providerName;
    this.logger = new Logger(`${this.constructor.name}`);
    
    // 注册默认的内容管理策略
    this.registerDefaultStrategies();
  }

  /**
   * 适配器名称
   */
  get name(): string {
    return this.providerName;
  }

  /**
   * 初始化适配器
   */
  abstract initialize(): Promise<void>;

  /**
   * 检查适配器是否可用
   */
  abstract isAvailable(): boolean;

  /**
   * 生成文本（简单接口）
   */
  async generate(
    prompt: string | LLMMessage[],
    config?: LLMConfig,
  ): Promise<string> {
    const response = await this.generateWithDetails(prompt, config);
    return response.content;
  }

  /**
   * 生成文本（详细响应）
   */
  abstract generateWithDetails(
    prompt: string | LLMMessage[],
    config?: LLMConfig,
  ): Promise<LLMResponse>;

  /**
   * 生成文本（支持分段处理）
   * 当内容过长时自动分段处理并整合结果
   */
  async generateWithSegmentation(
    prompt: string | LLMMessage[],
    config?: LLMConfig,
  ): Promise<LLMResponse> {
    // 如果没有启用分段处理，直接调用原始方法
    if (!config?.enableSegmentation) {
      return this.generateWithDetails(prompt, config);
    }

    const promptText = typeof prompt === 'string' ? prompt : this.formatMessages(prompt);
    const estimatedTokens = this.calculateTokenEstimate(promptText);
    
    // 检查是否需要分段处理
    const maxTokens = this.getMaxInputTokens(config);
    if (estimatedTokens <= maxTokens * 0.9) { // 留10%安全边距
      return this.generateWithDetails(prompt, config);
    }

    this.logger.debug(`内容过长(${estimatedTokens} tokens)，启用分段处理`, {
      maxTokens,
      strategy: config.segmentationStrategy || 'hybrid'
    });

    // 执行分段处理
    return this.executeSegmentedGeneration(prompt, config);
  }

  /**
   * 执行分段生成
   */
  private async executeSegmentedGeneration(
    prompt: string | LLMMessage[],
    config: LLMConfig,
  ): Promise<LLMResponse> {
    // 导入内容分段服务
    const { ContentSegmentationService } = await import('../content-segmentation.service');
    const segmentationService = new ContentSegmentationService();
    
    const promptText = typeof prompt === 'string' ? prompt : this.formatMessages(prompt);
    
    // 执行内容分段
    const segmentationResult = await segmentationService.segmentContent(promptText, {
      provider: this.providerName,
      model: config.model || this.getDefaultModel(),
      maxInputTokens: this.getMaxInputTokens(config),
      strategy: config.segmentationStrategy || 'hybrid',
      maxSegments: config.maxSegments || 5,
      preserveContext: config.preserveContext ?? true
    });

    // 逐段处理
    const segmentResponses: LLMResponse[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let i = 0; i < segmentationResult.segments.length; i++) {
      const segment = segmentationResult.segments[i];
      
      this.logger.debug(`处理分段 ${i + 1}/${segmentationResult.segments.length}`, {
        segmentId: segment.id,
        tokenEstimate: segment.metadata.tokenEstimate
      });

      // 构建分段提示词
      const segmentPrompt = this.buildSegmentPrompt(
        segment,
        i,
        segmentationResult.segments.length,
        prompt,
        config
      );

      try {
        const segmentResponse = await this.generateWithDetails(segmentPrompt, {
          ...config,
          // 分段处理时禁用嵌套分段
          enableSegmentation: false
        });

        segmentResponses.push(segmentResponse);
        totalInputTokens += segmentResponse.usage?.inputTokens || 0;
        totalOutputTokens += segmentResponse.usage?.outputTokens || 0;

        this.logger.debug(`分段 ${i + 1} 处理完成`, {
          inputTokens: segmentResponse.usage?.inputTokens,
          outputTokens: segmentResponse.usage?.outputTokens
        });
      } catch (error) {
        this.logger.error(`分段 ${i + 1} 处理失败`, error);
        // 继续处理其他分段，不要因为单个分段失败而中断整个流程
        segmentResponses.push({
          content: `分段 ${i + 1} 处理失败: ${error.message}`,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
        });
      }
    }

    // 整合分段结果
    const integratedResponse = this.integrateSegmentResponses(
      segmentResponses,
      segmentationResult,
      config
    );

    // 更新token统计
    integratedResponse.usage = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens
    };

    return integratedResponse;
  }

  /**
   * 构建分段提示词
   */
  private buildSegmentPrompt(
    segment: any,
    segmentIndex: number,
    totalSegments: number,
    originalPrompt: string | LLMMessage[],
    config: LLMConfig
  ): string | LLMMessage[] {
    const segmentPrompt = `
这是第 ${segmentIndex + 1}/${totalSegments} 个内容分段。

【分段内容】
${segment.content}

【处理要求】
1. 请仔细分析上述分段内容
2. ${segmentIndex < totalSegments - 1 ? '提供初步分析结果，并为后续分段保留上下文' : '提供最终的综合分析结论'}
3. 保持分析的一致性和连贯性
4. ${config.sessionId ? `会话ID: ${config.sessionId}` : ''}

【原始任务】
${typeof originalPrompt === 'string' ? originalPrompt : this.formatMessages(originalPrompt)}
`;

    if (typeof originalPrompt === 'string') {
      return segmentPrompt;
    } else {
      // 如果是消息数组格式，添加分段信息作为系统消息
      return [
        { role: 'system', content: segmentPrompt },
        ...originalPrompt.filter(msg => msg.role !== 'system')
      ];
    }
  }

  /**
   * 整合分段响应结果
   */
  private integrateSegmentResponses(
    responses: LLMResponse[],
    segmentationResult: any,
    config: LLMConfig
  ): LLMResponse {
    if (responses.length === 1) {
      return responses[0];
    }

    // 构建整合后的内容
    let integratedContent = '';
    
    if (config.preserveContext !== false) {
      integratedContent += `内容分段处理结果（共${responses.length}个分段）：\n\n`;
    }

    responses.forEach((response, index) => {
      integratedContent += `【分段 ${index + 1} 分析】\n${response.content}\n\n`;
    });

    // 添加综合分析提示
    integratedContent += `【综合分析】
请基于以上${responses.length}个分段的分析结果，提供完整的综合分析结论。
注意：确保分析的完整性和连贯性，避免重复信息。
`;

    return {
      content: integratedContent,
      toolCalls: responses.some(r => r.toolCalls && r.toolCalls.length > 0) ? 
        responses.flatMap(r => r.toolCalls || []) : undefined,
      finishReason: responses[responses.length - 1]?.finishReason,
      model: responses[0]?.model
    };
  }

  /**
   * 格式化消息数组为文本
   */
  private formatMessages(messages: LLMMessage[]): string {
    return messages.map(msg => `[${msg.role}]: ${msg.content}`).join('\n');
  }

  
  /**
   * 计算token估算（用于分段处理）
   */
  private calculateTokenEstimate(text: string): number {
    // 简单估算：中文字符按1.5 token，英文按0.25 token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    const otherChars = text.length - chineseChars - englishChars;
    
    return Math.ceil(chineseChars * 1.5 + englishChars * 0.25 + otherChars * 0.5);
  }

  /**
   * 获取最大输入token限制
   */
  private getMaxInputTokens(config?: LLMConfig): number {
    // 根据提供商和模型返回相应的token限制
    const modelLimits: Record<string, number> = {
      'qwen-max': 30000,
      'qwen-plus': 30000,
      'qwen-turbo': 8000,
      'gpt-4': 8000,
      'gpt-4-turbo': 128000,
      'gpt-3.5-turbo': 16000
    };

    const modelName = config?.model || this.getDefaultModel();
    return modelLimits[modelName] || 30000; // 默认30K
  }

  /**
   * 生成流式文本
   */
  abstract generateStream?(
    prompt: string | LLMMessage[],
    config?: LLMConfig,
  ): AsyncGenerator<string, void, unknown>;

  /**
   * 获取支持的模型列表
   */
  abstract getSupportedModels(): ModelInfo[];

  /**
   * 获取默认模型
   */
  abstract getDefaultModel(): string;

  /**
   * 检查模型是否支持工具调用
   */
  supportsTools(model?: string): boolean {
    const modelInfo = this.getSupportedModels().find(
      (m) => m.name === (model || this.getDefaultModel()),
    );
    return modelInfo?.supportsFunctionCalling || false;
  }

  /**
   * 注册内容管理策略
   */
  protected registerContentStrategy(name: string, strategy: ContentManagementStrategy): void {
    this.contentStrategies.set(name, strategy);
    this.logger.debug(`已注册内容管理策略: ${name}`);
  }

  /**
   * 执行内容管理
   */
  protected async manageContent(
    content: string | LLMMessage[],
    model: string,
    config?: LLMConfig
  ): Promise<ContentManagementResult> {
    const originalTokens = this.estimateTokens(content);
    const modelInfo = this.getSupportedModels().find(m => m.name === model);
    
    if (!modelInfo) {
      throw new Error(`不支持的模型: ${model}`);
    }

    // 检查是否需要内容管理
    if (originalTokens <= modelInfo.contextLength * 0.9) {
      return {
        processedContent: content,
        strategy: "none",
        originalTokens,
        processedTokens: originalTokens
      };
    }

    // 尝试各个策略
    for (const [strategyName, strategy] of this.contentStrategies) {
      try {
        if (strategy.canHandle(content, model)) {
          this.logger.debug(`使用内容管理策略: ${strategyName}`);
          const processedContent = await strategy.process(content, model, config);
          const processedTokens = this.estimateTokens(processedContent);
          
          return {
            processedContent,
            strategy: strategyName,
            compressionRatio: originalTokens > 0 ? processedTokens / originalTokens : 1,
            originalTokens,
            processedTokens
          };
        }
      } catch (error) {
        this.logger.warn(`内容管理策略 ${strategyName} 失败: ${error.message}`);
      }
    }

    // 如果所有策略都失败，尝试分片策略
    this.logger.debug(`尝试使用分片策略处理长文本 (${originalTokens} tokens)`);
    const chunkingResult = this.handleChunking(content, model, config);
    
    if (chunkingResult) {
      return chunkingResult;
    }

    // 如果所有策略都失败，抛出错误
    throw new Error(`内容过长 (${originalTokens} tokens)，超过模型上下文限制 (${modelInfo.contextLength} tokens)，且无法通过现有策略处理`);
  }

  /**
   * 估算内容token数量
   */
  protected estimateTokens(content: string | LLMMessage[]): number {
    if (typeof content === "string") {
      return this.calculateTokenEstimate(content);
    }
    
    // 对于消息数组，计算所有内容的总长度
    const totalText = content.reduce((sum, message) => sum + message.content, '');
    return this.calculateTokenEstimate(totalText);
  }

  /**
   * 注册默认的内容管理策略
   */
  protected abstract registerDefaultStrategies(): void;

  /**
   * 获取供应商特定的长度限制配置
   */
  protected abstract getProviderLengthLimits(model: string): ProviderLengthLimits;

  /**
   * 获取供应商特定的长度限制配置
   */
  protected getDefaultLengthLimits(): ProviderLengthLimits {
    return {
      maxInputLength: 30720,
      recommendedMaxInputLength: 28000,
      chunkOverlap: 200,
      chunkSize: 4000
    };
  }

  /**
   * 智能分片策略
   */
  protected intelligentChunking(
    content: string,
    model: string,
    config?: LLMConfig
  ): ChunkManagementResult {
    const lengthLimits = this.getProviderLengthLimits(model);
    const chunkSize = config?.chunkSize || lengthLimits.chunkSize;
    const chunkOverlap = config?.chunkOverlap || lengthLimits.chunkOverlap;
    
    // 检查是否需要分片
    if (content.length <= lengthLimits.recommendedMaxInputLength) {
      return {
        strategy: "none",
        chunks: [{
          id: "single-chunk",
          content,
          index: 0,
          totalChunks: 1,
          isLastChunk: true
        }],
        totalChunks: 1,
        originalLength: content.length,
        averageChunkLength: content.length,
        overlapRate: 0
      };
    }

    // 执行智能分片
    const chunks: ChunkInfo[] = [];
    const totalLength = content.length;
    let currentPosition = 0;
    let chunkIndex = 0;

    while (currentPosition < totalLength) {
      const endPosition = Math.min(currentPosition + chunkSize, totalLength);
      let chunkContent = content.substring(currentPosition, endPosition);
      
      // 如果不是最后一个chunk，尝试在句子边界结束
      if (endPosition < totalLength && chunkSize < 1000) {
        // 如果chunk很小，尝试在句子边界分割
        const lastSentenceEnd = this.findLastSentenceEnd(chunkContent);
        if (lastSentenceEnd > 0 && lastSentenceEnd < chunkContent.length - 50) {
          chunkContent = chunkContent.substring(0, lastSentenceEnd);
        }
      }
      
      const chunkId = `chunk-${chunkIndex.toString().padStart(3, '0')}`;
      const isLastChunk = endPosition >= totalLength;
      
      chunks.push({
        id: chunkId,
        content: chunkContent,
        index: chunkIndex,
        totalChunks: Math.ceil(totalLength / chunkSize),
        isLastChunk,
        overlapWithNext: isLastChunk ? undefined : chunkContent.substring(Math.max(0, chunkContent.length - chunkOverlap))
      });

      currentPosition = endPosition;
      chunkIndex++;
    }

    return {
      strategy: "intelligent-chunking",
      chunks,
      totalChunks: chunks.length,
      originalLength: totalLength,
      averageChunkLength: chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length,
      overlapRate: chunkOverlap / chunkSize
    };
  }

  /**
   * 查找最后一个句子结束位置
   */
  private findLastSentenceEnd(text: string): number {
    const sentenceEndings = ['。', '！', '？', '.', '!', '?', ';', '；', '\n'];
    let lastEnd = -1;
    
    for (let i = text.length - 1; i >= 0; i--) {
      if (sentenceEndings.includes(text[i])) {
        // 检查是否是真正的句子结束（后面没有跟随英文小写字母）
        if (i < text.length - 1 && /[a-z]/.test(text[i + 1])) {
          continue;
        }
        lastEnd = i + 1;
        break;
      }
    }
    
    return lastEnd;
  }

  /**
   * 重建分片响应
   */
  protected reconstructChunkedResponses(
    responses: string[],
    chunkInfo: ChunkManagementResult
  ): string {
    if (responses.length === 1) {
      return responses[0];
    }

    // 简单的拼接策略，可以根据需要改进
    let reconstructed = responses[0];
    
    for (let i = 1; i < responses.length; i++) {
      // 移除重叠部分
      const overlap = chunkInfo.chunks[i - 1].overlapWithNext;
      if (overlap && responses[i].startsWith(overlap)) {
        reconstructed += responses[i].substring(overlap.length);
      } else {
        reconstructed += responses[i];
      }
    }

    return reconstructed;
  }

  /**
   * 处理分片逻辑
   */
  protected handleChunking(
    content: string | LLMMessage[],
    model: string,
    config?: LLMConfig
  ): ContentManagementResult | null {
    if (typeof content !== 'string') {
      this.logger.warn('分片策略仅支持字符串内容');
      return null;
    }

    const chunkingResult = this.intelligentChunking(content, model, config);
    
    return {
      processedContent: this.createChunkedPrompt(chunkingResult, content),
      strategy: "chunking",
      compressionRatio: 1,
      segmentCount: chunkingResult.totalChunks,
      originalTokens: this.estimateTokens(content),
      processedTokens: this.estimateTokens(this.createChunkedPrompt(chunkingResult, content))
    };
  }

  /**
   * 创建分片后的提示
   */
  protected createChunkedPrompt(chunkingResult: ChunkManagementResult, originalContent: string): LLMMessage[] {
    const messages: LLMMessage[] = [];
    
    // 添加系统提示说明
    messages.push({
      role: "system",
      content: `您正在处理一个长文档的片段。这是第 ${chunkingResult.chunks[0].index + 1} 片段，共 ${chunkingResult.chunks[0].totalChunks} 个片段。请专注于当前片段的内容，并保持您的回答的连贯性和完整性。`
    });

    // 添加当前片段内容
    messages.push({
      role: "user",
      content: chunkingResult.chunks[0].content
    });

    // 如果有前一片段的重叠部分，提供上下文
    if (chunkingResult.chunks[0].overlapWithNext) {
      messages.push({
        role: "system",
        content: `请注意，您的回答应该与后续片段保持连贯。后续片段的开始部分将是：${chunkingResult.chunks[0].overlapWithNext.substring(0, 100)}...`
      });
    }

    return messages;
  }

  /**
   * 处理分片响应的抽象方法
   */
  protected abstract processChunkedResponse(
    responses: string[],
    chunkingResult: ChunkManagementResult
  ): Promise<LLMResponse>;

  /**
   * 检查内容是否需要分片
   */
  protected needsChunking(
    content: string | LLMMessage[],
    model: string
  ): boolean {
    const lengthLimits = this.getProviderLengthLimits(model);
    const estimatedTokens = this.estimateTokens(content);
    
    return estimatedTokens > lengthLimits.recommendedMaxInputLength;
  }

  /**
   * 标准化消息格式
   */
  protected normalizeMessages(
    prompt: string | LLMMessage[],
  ): LLMMessage[] {
    if (typeof prompt === "string") {
      return [{ role: "user", content: prompt }];
    }
    return prompt;
  }

  /**
   * 验证配置参数
   */
  protected validateConfig(config?: LLMConfig): void {
    if (!config) return;

    if (config.temperature !== undefined) {
      if (config.temperature < 0 || config.temperature > 1) {
        throw new Error("temperature 参数必须在 0-1 之间");
      }
    }

    if (config.maxTokens !== undefined) {
      if (config.maxTokens <= 0) {
        throw new Error("maxTokens 参数必须大于 0");
      }
    }

    if (config.topP !== undefined) {
      if (config.topP < 0 || config.topP > 1) {
        throw new Error("topP 参数必须在 0-1 之间");
      }
    }
  }

  /**
   * 记录API调用
   */
  protected logApiCall(
    messages: LLMMessage[],
    config?: LLMConfig,
    response?: LLMResponse,
    error?: Error,
    duration?: number,
  ): void {
    const logData = {
      category: error ? "LLM_ERROR" : "LLM_SUCCESS",
      message: JSON.stringify({
        provider: this.providerName,
        model: config?.model || this.getDefaultModel(),
        messageCount: messages.length,
        hasTools: (config?.tools?.length || 0) > 0,
        duration: duration ? `${duration}ms` : undefined,
        inputTokens: response?.usage?.inputTokens,
        outputTokens: response?.usage?.outputTokens,
        error: error?.message,
      }),
    };

    if (error) {
      this.logger.error(JSON.stringify(logData));
    } else {
      this.logger.log(JSON.stringify(logData));
    }
  }

  /**
   * 处理API错误
   */
  protected handleApiError(error: any, context: string): Error {
    let errorMessage = `${this.providerName} ${context} 失败`;

    if (error.response) {
      // HTTP错误
      errorMessage += `: HTTP ${error.response.status} - ${error.response.statusText}`;
      if (error.response.data) {
        errorMessage += `, 详情: ${JSON.stringify(error.response.data)}`;
      }
    } else if (error.code) {
      // 网络或其他系统错误
      errorMessage += `: ${error.code} - ${error.message}`;
    } else {
      errorMessage += `: ${error.message || "未知错误"}`;
    }

    return new Error(errorMessage);
  }
}