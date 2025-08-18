import { Injectable, Logger, Optional, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { 
  LLMServiceV2, 
  LLMResponse as LLMResponseV2, 
  LLMConfig as LLMConfigV2,
  LLMMessage,
  ToolCall as ToolCallV2
} from "./llm-adapters";

/**
 * 向后兼容的LLM响应结果接口
 */
export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason?: string;
}

/**
 * 向后兼容的工具调用接口
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
 * 向后兼容的LLM服务提供商接口
 */
export interface LLMProvider {
  name: string;
  generate(prompt: string, config?: LLMConfig): Promise<string>;
  generateWithTools?(prompt: string, config?: LLMConfig): Promise<LLMResponse>;
}

/**
 * 向后兼容的LLM配置接口
 */
export interface LLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  tools?: any[]; // Function calling 工具定义
  toolChoice?: string; // 工具选择策略
}

/**
 * 阿里云百炼(DashScope)提供商
 */
@Injectable()
export class DashScopeProvider implements LLMProvider {
  name = "dashscope";
  private readonly logger = new Logger(DashScopeProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("DASHSCOPE_API_KEY");
    this.baseUrl = this.configService.get<string>(
      "DASHSCOPE_BASE_URL",
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
    );

    if (!this.apiKey) {
      this.logger.warn("DASHSCOPE_API_KEY 未配置，百炼服务将不可用");
    }
  }

  async generate(prompt: string, config?: LLMConfig): Promise<string> {
    const response = await this.generateWithTools(prompt, config);
    return response.content;
  }

  async generateWithTools(
    prompt: string,
    config?: LLMConfig,
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error("DASHSCOPE_API_KEY 未配置");
    }

    const requestConfig = {
      model:
        config?.model ||
        this.configService.get<string>("DASHSCOPE_STANDARD_MODEL", "qwen-plus"),
      temperature:
        config?.temperature ||
        this.configService.get<number>("LLM_DEFAULT_TEMPERATURE", 0.7),
      max_tokens:
        config?.maxTokens ||
        this.configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 2000),
      ...config,
    };

    const requestBody: any = {
      model: requestConfig.model,
      input: {
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      },
      parameters: {
        temperature: requestConfig.temperature,
        max_tokens: requestConfig.max_tokens,
      },
    };

    // 添加工具调用支持
    if (config?.tools && config.tools.length > 0) {
      requestBody.input.tools = config.tools;
      if (config.toolChoice) {
        requestBody.parameters.tool_choice = config.toolChoice;
      }
    }

    try {
      this.logger.debug(`发送请求到百炼API: ${requestConfig.model}`);

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(
          config?.timeout ||
            this.configService.get<number>("LLM_DEFAULT_TIMEOUT", 30) * 1000,
        ),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`百炼API请求失败: ${response.status} ${errorText}`);
      }

      const result = await response.json();

      if (result.output) {
        this.logger.debug("百炼API响应成功");

        const llmResponse: LLMResponse = {
          content: result.output.text || "",
          finishReason: result.output.finish_reason,
        };

        // 处理工具调用
        if (result.output.tool_calls && result.output.tool_calls.length > 0) {
          llmResponse.toolCalls = result.output.tool_calls.map((call: any) => ({
            id: call.id || `call_${Date.now()}`,
            type: "function",
            function: {
              name: call.function?.name || "",
              arguments: call.function?.arguments || "{}",
            },
          }));
        }

        return llmResponse;
      } else {
        throw new Error(`百炼API响应格式错误: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      this.logger.error(`百炼API调用失败: ${error.message}`);
      throw error;
    }
  }
}

/**
 * LLM服务管理器（向后兼容版本）
 * 内部使用新的LLMServiceV2，但保持旧接口以确保兼容性
 */
@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProvider: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dashScopeProvider: DashScopeProvider,
    @Optional() private readonly llmServiceV2?: LLMServiceV2, // 可选依赖
  ) {
    // 注册可用的LLM提供商（保持向后兼容）
    this.registerProvider(dashScopeProvider);

    // 从环境变量获取默认提供商
    this.defaultProvider = this.configService.get<string>(
      "LLM_PRIMARY_PROVIDER",
      "dashscope",
    );

    if (this.llmServiceV2) {
      this.logger.log("LLM服务已初始化，支持新旧两套接口");
    } else {
      this.logger.log("LLM服务已初始化，使用传统接口");
    }
  }

  /**
   * 注册LLM提供商
   */
  private registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
    this.logger.log(`已注册LLM提供商: ${provider.name}`);
  }

  /**
   * 获取指定提供商
   */
  private getProvider(providerName?: string): LLMProvider {
    const name = providerName || this.defaultProvider;
    const provider = this.providers.get(name);

    if (!provider) {
      throw new Error(`未找到LLM提供商: ${name}`);
    }

    return provider;
  }

  /**
   * 生成文本（优先使用新服务，保持向后兼容）
   */
  async generate(
    prompt: string,
    config?: LLMConfig & { provider?: string },
  ): Promise<string> {
    // 如果有新服务，优先使用
    if (this.llmServiceV2) {
      try {
        const newConfig: LLMConfigV2 = {
          ...config,
          toolChoice: config?.toolChoice === "auto" ? "auto" : config?.toolChoice === "none" ? "none" : undefined,
        };
        
        return await this.llmServiceV2.generate(prompt, newConfig);
      } catch (error) {
        this.logger.warn(`新服务调用失败，回退到旧服务: ${error.message}`);
      }
    }
    
    // 使用旧的实现
    const provider = this.getProvider(config?.provider);
    const startTime = Date.now();

    try {
      const result = await provider.generate(prompt, config);
      const duration = Date.now() - startTime;
      this.logger.debug(`文本生成完成，耗时: ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `文本生成失败，耗时: ${duration}ms, 错误: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 使用工具生成文本（优先使用新服务，保持向后兼容）
   */
  async generateWithTools(
    prompt: string,
    config?: LLMConfig & { provider?: string },
  ): Promise<LLMResponse> {
    // 如果有新服务，优先使用
    if (this.llmServiceV2) {
      try {
        const newConfig: LLMConfigV2 = {
          ...config,
          tools: config?.tools?.map(tool => ({
            type: "function" as const,
            function: {
              name: tool.function?.name || tool.name,
              description: tool.function?.description || tool.description,
              parameters: tool.function?.parameters || tool.parameters,
            },
          })),
          toolChoice: config?.toolChoice === "auto" ? "auto" : config?.toolChoice === "none" ? "none" : undefined,
        };
        
        const response = await this.llmServiceV2.generateWithDetails(prompt, newConfig);
        
        // 转换响应格式以保持兼容性
        return {
          content: response.content,
          toolCalls: response.toolCalls,
          finishReason: response.finishReason,
        };
      } catch (error) {
        this.logger.warn(`新服务调用失败，回退到旧服务: ${error.message}`);
      }
    }
    
    // 使用旧的实现
    const provider = this.getProvider(config?.provider);

    if (!provider.generateWithTools) {
      throw new Error(`提供商 ${provider.name} 不支持工具调用`);
    }

    const startTime = Date.now();

    try {
      const result = await provider.generateWithTools(prompt, config);
      const duration = Date.now() - startTime;
      this.logger.debug(`文本生成完成，耗时: ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `文本生成失败，耗时: ${duration}ms, 错误: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 批量生成文本
   */
  async generateBatch(
    prompts: string[],
    config?: LLMConfig & { provider?: string },
  ): Promise<string[]> {
    const provider = this.getProvider(config?.provider);

    this.logger.debug(`批量生成 ${prompts.length} 个文本...`);

    const results = await Promise.allSettled(
      prompts.map((prompt) => provider.generate(prompt, config)),
    );

    const successResults: string[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successResults.push(result.value);
      } else {
        errors.push(`Prompt ${index}: ${result.reason}`);
        successResults.push(""); // 保持数组长度一致
      }
    });

    if (errors.length > 0) {
      this.logger.warn(
        `批量生成中有 ${errors.length} 个失败: ${errors.join("; ")}`,
      );
    }

    return successResults;
  }

  /**
   * 检查提供商可用性
   */
  async checkHealth(providerName?: string): Promise<boolean> {
    try {
      const testPrompt = '你好，请回复"测试成功"';
      const result = await this.generate(testPrompt, {
        provider: providerName,
        maxTokens: 10,
        temperature: 0.1,
      });

      return result.includes("测试") || result.includes("成功");
    } catch (error) {
      this.logger.error(`LLM健康检查失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取所有可用提供商
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
