/**
 * 阿里百炼(DashScope) LLM适配器
 * 参考Python版本实现，提供完整的DashScope API适配
 */

import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {BaseLLMAdapter, LLMConfig, LLMMessage, LLMResponse, ModelInfo, TokenUsage, ToolCall,} from "./base-llm-adapter";

/**
 * DashScope API请求体接口
 */
interface DashScopeRequestBody {
  model: string;
  input: {
    messages: DashScopeMessage[];
    tools?: any[];
  };
  parameters: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stop?: string[];
    result_format?: string;
    tool_choice?: string | { type: string; function: { name: string } };
    [key: string]: any;
  };
}

/**
 * DashScope消息格式
 */
interface DashScopeMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
}

/**
 * DashScope响应格式
 */
interface DashScopeResponse {
  output: {
    text?: string;
    finish_reason?: string;
    choices?: Array<{
      message: {
        content: string;
        role: string;
        tool_calls?: Array<{
          id: string;
          type: string;
          function: {
            name: string;
            arguments: string;
          };
        }>;
      };
    }>;
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  request_id: string;
}

/**
 * 支持的DashScope模型配置
 */
const DASHSCOPE_MODELS: ModelInfo[] = [
  {
    name: "qwen-turbo",
    description: "通义千问 Turbo - 快速响应，适合日常对话和简单任务",
    contextLength: 8192,
    supportsFunctionCalling: true,
    costPer1kInputTokens: 0.003,
    costPer1kOutputTokens: 0.006,
    recommendedFor: ["快速任务", "日常对话", "简单分析"],
  },
  {
    name: "qwen-plus",
    description: "通义千问 Plus - 平衡性能和成本，适合复杂分析",
    contextLength: 32768,
    supportsFunctionCalling: true,
    costPer1kInputTokens: 0.008,
    costPer1kOutputTokens: 0.016,
    recommendedFor: ["复杂分析", "专业任务", "深度思考"],
  },
  {
    name: "qwen-max",
    description: "通义千问 Max - 最强性能，适合最复杂的任务",
    contextLength: 32768,
    supportsFunctionCalling: true,
    costPer1kInputTokens: 0.02,
    costPer1kOutputTokens: 0.06,
    recommendedFor: ["最复杂任务", "专业分析", "高质量输出"],
  },
  {
    name: "qwen-max-longcontext",
    description: "通义千问 Max 长文本版 - 支持超长上下文",
    contextLength: 1000000,
    supportsFunctionCalling: false,
    costPer1kInputTokens: 0.02,
    costPer1kOutputTokens: 0.06,
    recommendedFor: ["长文档分析", "大量数据处理", "复杂推理"],
  },
];

@Injectable()
export class DashScopeAdapter extends BaseLLMAdapter {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    super("dashscope");
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.apiKey = this.configService.get<string>("DASHSCOPE_API_KEY", "");
    this.baseUrl = this.configService.get<string>(
      "DASHSCOPE_BASE_URL",
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
    );
    this.defaultModel = this.configService.get<string>(
      "DASHSCOPE_STANDARD_MODEL",
      "qwen-plus",
    );

    if (!this.apiKey) {
      this.logger.warn("DASHSCOPE_API_KEY 未配置，DashScope适配器将不可用");
    } else {
      this.logger.log("DashScope适配器初始化完成");
    }

    this.initialized = true;
  }

  isAvailable(): boolean {
    return this.initialized && !!this.apiKey;
  }

  getSupportedModels(): ModelInfo[] {
    return DASHSCOPE_MODELS;
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  async generateWithDetails(
    prompt: string | LLMMessage[],
    config?: LLMConfig,
  ): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw new Error("DashScope适配器不可用：请检查API密钥配置");
    }

    this.validateConfig(config);

    const messages = this.normalizeMessages(prompt);
    const startTime = Date.now();

    try {
      const requestBody = this.buildRequestBody(messages, config);
      
      this.logger.debug(
        `调用DashScope API: ${requestBody.model}, 消息数: ${messages.length}`,
      );

      const response = await this.callDashScopeAPI(requestBody, config);
      const llmResponse = this.parseResponse(response, requestBody.model);
      
      const duration = Date.now() - startTime;
      this.logApiCall(messages, config, llmResponse, undefined, duration);

      return llmResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      const handledError = this.handleApiError(error, "API调用");
      this.logApiCall(messages, config, undefined, handledError, duration);
      throw handledError;
    }
  }

  /**
   * 构建DashScope API请求体
   */
  private buildRequestBody(
    messages: LLMMessage[],
    config?: LLMConfig,
  ): DashScopeRequestBody {
    const model = config?.model || this.defaultModel;
    
    // 转换消息格式
    const dashScopeMessages: DashScopeMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
      tool_call_id: msg.toolCallId,
    }));

    const requestBody: DashScopeRequestBody = {
      model,
      input: {
        messages: dashScopeMessages,
      },
      parameters: {
        result_format: "message", // 使用新版消息格式
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.maxTokens ?? 2000,
        top_p: config?.topP ?? 0.9,
      },
    };

    // 添加停止词
    if (config?.stop && config.stop.length > 0) {
      requestBody.parameters.stop = config.stop;
    }

    // 添加工具调用支持
    if (config?.tools && config.tools.length > 0) {
      // 转换工具格式为DashScope格式
      requestBody.input.tools = config.tools.map((tool) => ({
        type: tool.type,
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        },
      }));

      // 设置工具选择策略
      if (config.toolChoice) {
        if (typeof config.toolChoice === "string") {
          requestBody.parameters.tool_choice = config.toolChoice;
        } else {
          requestBody.parameters.tool_choice = {
            type: config.toolChoice.type,
            function: {
              name: config.toolChoice.function.name,
            },
          };
        }
      } else {
        requestBody.parameters.tool_choice = "auto";
      }
    }

    return requestBody;
  }

  /**
   * 调用DashScope API (带重试机制)
   */
  private async callDashScopeAPI(
    requestBody: DashScopeRequestBody,
    config?: LLMConfig,
  ): Promise<DashScopeResponse> {
    // 根据模型和消息长度动态设置超时时间
    const baseTimeout = config?.timeout ?? this.calculateTimeout(requestBody);
    const maxRetries = config?.maxRetries ?? 2;
    
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 每次重试增加超时时间
        const currentTimeout = baseTimeout + (attempt * 15000); // 每次重试增加15秒
        
        this.logger.debug(`API调用尝试 ${attempt + 1}/${maxRetries + 1}, 超时: ${currentTimeout}ms`);
        
        const response = await fetch(this.baseUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "X-DashScope-SSE": "disable", // 禁用SSE模式
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(currentTimeout),
        });
        
        // 成功获得响应，进行状态检查
        if (!response.ok) {
          const errorText = await response.text();
          let errorDetails = "";
          
          try {
            const errorJson = JSON.parse(errorText);
            errorDetails = errorJson.message || errorJson.error?.message || errorText;
          } catch {
            errorDetails = errorText;
          }

          throw new Error(
            `DashScope API错误: HTTP ${response.status} - ${errorDetails}`,
          );
        }
        
        const result: DashScopeResponse = await response.json();
        
        if (!result.output) {
          throw new Error(`DashScope API响应格式错误: ${JSON.stringify(result)}`);
        }

        return result;
        
      } catch (error) {
        lastError = error;
        
        // 判断是否应该重试
        const shouldRetry = this.shouldRetryRequest(error, attempt, maxRetries);
        
        if (!shouldRetry) {
          throw error;
        }
        
        // 等待后重试 (指数退避)
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        this.logger.warn(`API调用失败，${waitTime}ms后重试: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw lastError;
  }

  /**
   * 计算合适的超时时间
   */
  private calculateTimeout(requestBody: DashScopeRequestBody): number {
    const messageCount = requestBody.input.messages.length;
    const totalChars = requestBody.input.messages.reduce((sum, msg) => sum + msg.content.length, 0);
    const maxTokens = requestBody.parameters.max_tokens || 2048;
    
    // 基础超时: 120秒
    let timeout = 120000;
    
    // 根据消息数量增加超时
    timeout += messageCount * 2000; // 每条消息增加2秒
    
    // 根据内容长度增加超时
    timeout += Math.ceil(totalChars / 1000) * 1000; // 每1000字符增加1秒
    
    // 根据预期输出长度增加超时
    timeout += Math.ceil(maxTokens / 100) * 1000; // 每100个token增加1秒
    
    // 设置最小和最大超时限制
    return Math.min(Math.max(timeout, 120000), 300000); // 120秒到5分钟之间
  }

  /**
   * 判断是否应该重试请求
   */
  private shouldRetryRequest(error: any, attempt: number, maxRetries: number): boolean {
    // 如果已经达到最大重试次数，不重试
    if (attempt >= maxRetries) {
      return false;
    }
    
    // 超时错误可以重试
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return true;
    }
    
    // 网络错误可以重试
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // 5xx服务器错误可以重试
    if (error.message.includes('HTTP 5')) {
      return true;
    }
    
    // 429 限流错误可以重试
    if (error.message.includes('HTTP 429')) {
      return true;
    }
    
    // 其他错误不重试
    return false;
  }

  /**
   * 解析DashScope响应
   */
  private parseResponse(
    response: DashScopeResponse,
    model: string,
  ): LLMResponse {
    let content = "";
    let toolCalls: ToolCall[] | undefined;
    let finishReason = response.output.finish_reason;

    // 处理不同的响应格式
    if (response.output.choices && response.output.choices.length > 0) {
      // 新版消息格式
      const choice = response.output.choices[0];
      content = choice.message.content || "";
      
      // 处理工具调用
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        toolCalls = choice.message.tool_calls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: {
            name: call.function.name,
            arguments: call.function.arguments,
          },
        }));
      }
    } else if (response.output.text) {
      // 旧版文本格式
      content = response.output.text;
    }

    // 计算token使用量
    const usage: TokenUsage = {
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    };

    // 估算成本
    const modelInfo = this.getSupportedModels().find((m) => m.name === model);
    if (modelInfo) {
      const inputCost = 
        (usage.inputTokens / 1000) * (modelInfo.costPer1kInputTokens || 0);
      const outputCost = 
        (usage.outputTokens / 1000) * (modelInfo.costPer1kOutputTokens || 0);
      usage.cost = inputCost + outputCost;
    }

    const llmResponse: LLMResponse = {
      content,
      toolCalls,
      finishReason,
      usage,
      model,
      id: response.request_id,
    };

    return llmResponse;
  }

  /**
   * 流式生成（如果支持的话）
   */
  async* generateStream(
    prompt: string | LLMMessage[],
    config?: LLMConfig,
  ): AsyncGenerator<string, void, unknown> {
    // DashScope流式实现可以在后续添加
    // 目前先抛出未实现错误
    throw new Error("DashScope流式生成功能尚未实现");
  }

  /**
   * 获取模型详细信息
   */
  getModelInfo(modelName: string): ModelInfo | undefined {
    return this.getSupportedModels().find((model) => model.name === modelName);
  }

  /**
   * 估算请求成本
   */
  estimateCost(
    messages: LLMMessage[],
    config?: LLMConfig,
  ): { estimatedInputTokens: number; estimatedCost: number } {
    // 简单的token估算：中文约1.5字符/token，英文约4字符/token
    let totalChars = 0;
    messages.forEach((msg) => {
      totalChars += msg.content.length;
    });

    // 估算输入token（偏向中文）
    const estimatedInputTokens = Math.ceil(totalChars / 2);
    
    const modelName = config?.model || this.defaultModel;
    const modelInfo = this.getModelInfo(modelName);
    
    let estimatedCost = 0;
    if (modelInfo) {
      // 只计算输入token成本，输出token无法预估
      estimatedCost = 
        (estimatedInputTokens / 1000) * (modelInfo.costPer1kInputTokens || 0);
    }

    return { estimatedInputTokens, estimatedCost };
  }
}