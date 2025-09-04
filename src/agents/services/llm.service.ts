/**
 * LLM服务管理器
 * 支持多适配器架构，具备更好的扩展性和错误处理
 */

import {Injectable, OnModuleInit} from "@nestjs/common";
import {BusinessLogger} from "../../common/utils/business-logger.util";
import {ConfigService} from "@nestjs/config";
import {BaseLLMAdapter, LLMConfig, LLMMessage, LLMResponse, ModelInfo,} from "./llm-adapters/base-llm-adapter";
import {DashScopeAdapter} from "./llm-adapters/dashscope-adapter";

// 重新导出类型以保持兼容性
export { LLMConfig, LLMMessage, LLMResponse, ModelInfo } from "./llm-adapters/base-llm-adapter";

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
 * LLM服务配置接口
 */
interface LLMServiceConfig {
  primaryProvider: string;
  fallbackProviders: string[];
  enableFallback: boolean;
  maxRetries: number;
  retryDelay: number;
}

/**
 * 提供商状态信息
 */
interface ProviderStatus {
  name: string;
  available: boolean;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
  averageResponseTime: number;
}

@Injectable()
export class LLMService implements OnModuleInit {
  private readonly businessLogger = new BusinessLogger(LLMService.name);
  private adapters = new Map<string, BaseLLMAdapter>();
  private providerStats = new Map<string, ProviderStatus>();
  private config: LLMServiceConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly dashScopeAdapter: DashScopeAdapter,
  ) {
    this.loadConfiguration();
  }

  async onModuleInit(): Promise<void> {
    await this.initializeAdapters();
  }

  /**
   * 加载配置
   */
  private loadConfiguration(): void {
    this.config = {
      primaryProvider: this.configService.get<string>(
        "LLM_PRIMARY_PROVIDER",
        "dashscope",
      ),
      fallbackProviders: this.configService
        .get<string>("LLM_FALLBACK_PROVIDERS", "")
        .split(",")
        .filter(Boolean),
      enableFallback: this.configService.get<boolean>(
        "LLM_ENABLE_FALLBACK",
        true,
      ),
      maxRetries: this.configService.get<number>("LLM_MAX_RETRIES", 3),
      retryDelay: this.configService.get<number>("LLM_RETRY_DELAY", 1000),
    };

    this.businessLogger.serviceInfo(
      `LLM服务配置: 主提供商=${this.config.primaryProvider}, ` +
        `后备提供商=[${this.config.fallbackProviders.join(",")}], ` +
        `启用后备=${this.config.enableFallback}`
    );
  }

  /**
   * 初始化所有适配器
   */
  private async initializeAdapters(): Promise<void> {
    const adapters = [this.dashScopeAdapter];
    // 后续可以添加其他适配器：openaiAdapter, geminiAdapter等

    for (const adapter of adapters) {
      try {
        await adapter.initialize();
        this.registerAdapter(adapter);
      } catch (error) {
        this.businessLogger.serviceError(
          `适配器 ${adapter.name} 初始化失败`,
          error
        );
      }
    }

    this.businessLogger.serviceInfo(`已注册 ${this.adapters.size} 个LLM适配器`);
  }

  /**
   * 注册适配器
   */
  private registerAdapter(adapter: BaseLLMAdapter): void {
    this.adapters.set(adapter.name, adapter);
    this.providerStats.set(adapter.name, {
      name: adapter.name,
      available: adapter.isAvailable(),
      consecutiveFailures: 0,
      totalRequests: 0,
      totalFailures: 0,
      averageResponseTime: 0,
    });

    this.businessLogger.serviceInfo(
      `已注册LLM适配器: ${adapter.name} (可用: ${adapter.isAvailable()})`
    );
  }

  /**
   * 生成文本（简单接口）
   */
  async generate(
    prompt: string | LLMMessage[],
    config?: LLMConfig & { provider?: string },
  ): Promise<string> {
    const response = await this.generateWithDetails(prompt, config);
    return response.content;
  }

  /**
   * 使用工具生成文本（向后兼容接口）
   */
  async generateWithTools(
    prompt: string,
    config?: LLMConfig & { provider?: string; tools?: any[]; toolChoice?: string },
  ): Promise<{
    content: string;
    toolCalls?: ToolCall[];
    finishReason?: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cost?: number;
    };
  }> {
    // 转换工具配置格式
    const newConfig: LLMConfig = {
      ...config,
      tools: config?.tools?.map(tool => ({
        type: "function" as const,
        function: {
          name: tool.function?.name || (tool as any).name,
          description: tool.function?.description || (tool as any).description,
          parameters: tool.function?.parameters || (tool as any).parameters,
        },
      })),
      toolChoice: config?.toolChoice === "auto" ? "auto" : 
                  config?.toolChoice === "none" ? "none" : undefined,
    };
    
    const response = await this.generateWithDetails(prompt, newConfig);
    
    // 转换响应格式以保持兼容性
    return {
      content: response.content,
      toolCalls: response.toolCalls,
      finishReason: response.finishReason,
      usage: response.usage,
    };
  }

  /**
   * 生成文本（详细响应）
   */
  async generateWithDetails(
    prompt: string | LLMMessage[],
    config?: LLMConfig & { provider?: string },
  ): Promise<LLMResponse> {
    const providers = this.getProviderOrder(config?.provider);
    
    let lastError: Error | undefined;

    for (const providerName of providers) {
      const adapter = this.adapters.get(providerName);
      if (!adapter || !adapter.isAvailable()) {
        continue;
      }

      try {
        const startTime = Date.now();
        const response = await this.executeWithRetry(
          adapter,
          prompt,
          config,
        );
        
        // 更新统计信息
        this.updateProviderStats(providerName, Date.now() - startTime, false);
        
        return response;
      } catch (error) {
        lastError = error;
        this.updateProviderStats(providerName, 0, true);
        
        this.businessLogger.warn(
          `提供商 ${providerName} 调用失败: ${error.message}`
        );

        // 如果不是主提供商且启用了后备，继续尝试下一个
        if (
          providerName !== this.config.primaryProvider &&
          this.config.enableFallback
        ) {
          continue;
        }
      }
    }

    // 所有提供商都失败了
    throw new Error(
      `所有LLM提供商都不可用。最后错误: ${lastError?.message || "未知错误"}`,
    );
  }

  /**
   * 使用重试机制执行请求
   */
  private async executeWithRetry(
    adapter: BaseLLMAdapter,
    prompt: string | LLMMessage[],
    config?: LLMConfig,
  ): Promise<LLMResponse> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await adapter.generateWithDetails(prompt, config);
      } catch (error) {
        lastError = error;
        
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          this.businessLogger.debug(
            `${adapter.name} 重试 ${attempt}/${this.config.maxRetries}，等待 ${delay}ms`
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * 获取提供商调用顺序
   */
  private getProviderOrder(preferredProvider?: string): string[] {
    if (preferredProvider && this.adapters.has(preferredProvider)) {
      return [preferredProvider];
    }

    const order = [this.config.primaryProvider];
    
    if (this.config.enableFallback) {
      order.push(...this.config.fallbackProviders);
    }

    return order.filter((name) => this.adapters.has(name));
  }

  /**
   * 更新提供商统计信息
   */
  private updateProviderStats(
    providerName: string,
    responseTime: number,
    failed: boolean,
  ): void {
    const stats = this.providerStats.get(providerName);
    if (!stats) return;

    stats.totalRequests++;
    
    if (failed) {
      stats.totalFailures++;
      stats.consecutiveFailures++;
    } else {
      stats.consecutiveFailures = 0;
      // 更新平均响应时间（简单移动平均）
      stats.averageResponseTime = 
        (stats.averageResponseTime * 0.9) + (responseTime * 0.1);
    }
  }


  /**
   * 批量生成文本
   */
  async generateBatch(
    prompts: (string | LLMMessage[])[],
    config?: LLMConfig & { provider?: string; concurrency?: number },
  ): Promise<LLMResponse[]> {
    const concurrency = config?.concurrency || 5;
    const results: LLMResponse[] = [];
    
    for (let i = 0; i < prompts.length; i += concurrency) {
      const batch = prompts.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((prompt) => this.generateWithDetails(prompt, config)),
      );

      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          this.businessLogger.serviceError(
            `批量生成第 ${i + index} 个请求失败`,
            result.reason
          );
          // 添加错误响应
          results.push({
            content: "",
            finishReason: "error",
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          });
        }
      });
    }

    return results;
  }

  /**
   * 获取所有支持的模型
   */
  getAllSupportedModels(): Map<string, ModelInfo[]> {
    const models = new Map<string, ModelInfo[]>();
    
    this.adapters.forEach((adapter, name) => {
      models.set(name, adapter.getSupportedModels());
    });

    return models;
  }

  /**
   * 获取提供商状态
   */
  getProviderStatus(): ProviderStatus[] {
    return Array.from(this.providerStats.values());
  }

  /**
   * 获取可用提供商列表
   */
  getAvailableProviders(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * 获取服务统计信息
   */
  getServiceStats(): {
    totalAdapters: number;
    availableAdapters: number;
    primaryProvider: string;
    fallbackEnabled: boolean;
  } {
    const availableAdapters = Array.from(this.providerStats.values()).filter(
      (stats) => stats.available,
    ).length;

    return {
      totalAdapters: this.adapters.size,
      availableAdapters,
      primaryProvider: this.config.primaryProvider,
      fallbackEnabled: this.config.enableFallback,
    };
  }

  /**
   * 清理资源
   */
  async onModuleDestroy(): Promise<void> {
    // 清理其他资源
  }

  /**
   * 工具方法：睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}