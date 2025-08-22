/**
 * LLM适配器基础接口和抽象类
 * 参考Python版本实现，提供统一的LLM调用接口
 */

import { Logger } from "@nestjs/common";

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
 * LLM适配器抽象基类
 */
export abstract class BaseLLMAdapter {
  protected readonly logger: Logger;
  protected readonly providerName: string;
  protected initialized = false;

  constructor(providerName: string) {
    this.providerName = providerName;
    this.logger = new Logger(`${this.constructor.name}`);
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