import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AgentConfig } from "../agents/interfaces/agent.interface";

/**
 * 智能体配置服务
 */
@Injectable()
export class AgentConfigService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取LLM配置
   */
  getLLMConfig() {
    return {
      // 主要提供商
      primaryProvider: this.configService.get<string>(
        "LLM_PRIMARY_PROVIDER",
        "dashscope",
      ),

      // 百炼配置
      dashscope: {
        apiKey: this.configService.get<string>("DASHSCOPE_API_KEY"),
        baseUrl: this.configService.get<string>(
          "DASHSCOPE_BASE_URL",
          "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
        ),
        models: {
          fast: this.configService.get<string>(
            "DASHSCOPE_FAST_MODEL",
            "qwen-turbo",
          ),
          standard: this.configService.get<string>(
            "DASHSCOPE_STANDARD_MODEL",
            "qwen-plus",
          ),
          premium: this.configService.get<string>(
            "DASHSCOPE_PREMIUM_MODEL",
            "qwen-max",
          ),
          longContext: this.configService.get<string>(
            "DASHSCOPE_LONG_CONTEXT_MODEL",
            "qwen-max-longcontext",
          ),
        },
      },

      // OpenAI配置 (备用)
      openai: {
        apiKey: this.configService.get<string>("OPENAI_API_KEY"),
        baseUrl: this.configService.get<string>(
          "OPENAI_BASE_URL",
          "https://api.openai.com/v1",
        ),
        models: {
          fast: this.configService.get<string>(
            "OPENAI_FAST_MODEL",
            "gpt-3.5-turbo",
          ),
          standard: this.configService.get<string>(
            "OPENAI_STANDARD_MODEL",
            "gpt-4",
          ),
          premium: this.configService.get<string>(
            "OPENAI_PREMIUM_MODEL",
            "gpt-4-turbo",
          ),
        },
      },

      // Google配置 (备用)
      google: {
        apiKey: this.configService.get<string>("GOOGLE_API_KEY"),
        baseUrl: this.configService.get<string>(
          "GOOGLE_BASE_URL",
          "https://generativelanguage.googleapis.com/v1beta",
        ),
        models: {
          fast: this.configService.get<string>(
            "GOOGLE_FAST_MODEL",
            "gemini-pro",
          ),
          standard: this.configService.get<string>(
            "GOOGLE_STANDARD_MODEL",
            "gemini-pro",
          ),
          premium: this.configService.get<string>(
            "GOOGLE_PREMIUM_MODEL",
            "gemini-pro",
          ),
        },
      },

      // 默认参数
      defaults: {
        timeout: this.configService.get<number>("LLM_DEFAULT_TIMEOUT", 30),
        maxRetries: this.configService.get<number>("LLM_MAX_RETRIES", 3),
        temperature: this.configService.get<number>(
          "LLM_DEFAULT_TEMPERATURE",
          0.7,
        ),
        maxTokens: this.configService.get<number>(
          "LLM_DEFAULT_MAX_TOKENS",
          2000,
        ),
      },
    };
  }

  /**
   * 获取智能体配置
   */
  getAgentConfigs() {
    const llmConfig = this.getLLMConfig();

    return {
      // 市场分析师配置
      marketAnalyst: this.buildAgentConfig("MARKET_ANALYST", {
        model: llmConfig.dashscope.models.standard,
        temperature: 0.7,
        maxTokens: 2500,
        timeout: 45,
      }),

      // 基本面分析师配置
      fundamentalAnalyst: this.buildAgentConfig("FUNDAMENTAL_ANALYST", {
        model: llmConfig.dashscope.models.premium,
        temperature: 0.6,
        maxTokens: 3000,
        timeout: 60,
      }),

      // 新闻分析师配置
      newsAnalyst: this.buildAgentConfig("NEWS_ANALYST", {
        model: llmConfig.dashscope.models.standard,
        temperature: 0.7,
        maxTokens: 2500,
        timeout: 45,
      }),

      // 多头研究员配置
      bullResearcher: this.buildAgentConfig("BULL_RESEARCHER", {
        model: llmConfig.dashscope.models.standard,
        temperature: 0.8,
        maxTokens: 2500,
        timeout: 45,
      }),

      // 空头研究员配置
      bearResearcher: this.buildAgentConfig("BEAR_RESEARCHER", {
        model: llmConfig.dashscope.models.standard,
        temperature: 0.7,
        maxTokens: 2500,
        timeout: 45,
      }),

      // 保守型交易员配置
      conservativeTrader: this.buildAgentConfig("CONSERVATIVE_TRADER", {
        model: llmConfig.dashscope.models.standard,
        temperature: 0.5,
        maxTokens: 2500,
        timeout: 45,
      }),

      // 激进型交易员配置
      aggressiveTrader: this.buildAgentConfig("AGGRESSIVE_TRADER", {
        model: llmConfig.dashscope.models.standard,
        temperature: 0.8,
        maxTokens: 2500,
        timeout: 45,
      }),

      // 反思智能体配置
      reflectionAgent: this.buildAgentConfig("REFLECTION_AGENT", {
        model: llmConfig.dashscope.models.premium,
        temperature: 0.4,
        maxTokens: 3000,
        timeout: 60,
      }),
    };
  }

  /**
   * 构建智能体配置
   */
  private buildAgentConfig(
    agentType: string,
    defaults: Partial<AgentConfig>,
  ): AgentConfig {
    const llmDefaults = this.getLLMConfig().defaults;

    return {
      model: this.configService.get<string>(
        `${agentType}_MODEL`,
        defaults.model || llmDefaults.temperature.toString(),
      ),
      temperature: this.configService.get<number>(
        `${agentType}_TEMPERATURE`,
        defaults.temperature || llmDefaults.temperature,
      ),
      maxTokens: this.configService.get<number>(
        `${agentType}_MAX_TOKENS`,
        defaults.maxTokens || llmDefaults.maxTokens,
      ),
      timeout: this.configService.get<number>(
        `${agentType}_TIMEOUT`,
        defaults.timeout || llmDefaults.timeout,
      ),
      retryCount: this.configService.get<number>(
        `${agentType}_RETRY_COUNT`,
        defaults.retryCount || llmDefaults.maxRetries,
      ),
      systemPrompt: defaults.systemPrompt || "",
    };
  }

  /**
   * 获取数据源配置
   */
  getDataSourceConfig() {
    return {
      // 股票数据
      stockData: {
        provider: this.configService.get<string>("STOCK_DATA_PROVIDER", "mock"),
        apiUrl: this.configService.get<string>("STOCK_DATA_API_URL"),
        apiKey: this.configService.get<string>("STOCK_DATA_API_KEY"),
        timeout: this.configService.get<number>("STOCK_DATA_TIMEOUT", 10),
        retryCount: this.configService.get<number>("STOCK_DATA_RETRY_COUNT", 3),
      },

      // 新闻数据
      newsData: {
        provider: this.configService.get<string>("NEWS_DATA_PROVIDER", "mock"),
        apiUrl: this.configService.get<string>("NEWS_DATA_API_URL"),
        apiKey: this.configService.get<string>("NEWS_DATA_API_KEY"),
        timeout: this.configService.get<number>("NEWS_DATA_TIMEOUT", 10),
        maxArticles: this.configService.get<number>("NEWS_MAX_ARTICLES", 20),
      },

      // 财务数据
      financialData: {
        provider: this.configService.get<string>(
          "FINANCIAL_DATA_PROVIDER",
          "mock",
        ),
        apiUrl: this.configService.get<string>("FINANCIAL_DATA_API_URL"),
        apiKey: this.configService.get<string>("FINANCIAL_DATA_API_KEY"),
        timeout: this.configService.get<number>("FINANCIAL_DATA_TIMEOUT", 15),
      },
    };
  }

  /**
   * 获取系统配置
   */
  getSystemConfig() {
    return {
      // 并发控制
      maxConcurrentAnalysts: this.configService.get<number>(
        "MAX_CONCURRENT_ANALYSTS",
        3,
      ),
      maxConcurrentResearchers: this.configService.get<number>(
        "MAX_CONCURRENT_RESEARCHERS",
        2,
      ),
      maxConcurrentTraders: this.configService.get<number>(
        "MAX_CONCURRENT_TRADERS",
        2,
      ),

      // 缓存配置
      cacheEnabled: this.configService.get<boolean>("CACHE_ENABLED", true),
      cacheTTL: this.configService.get<number>("CACHE_TTL", 300),

      // 日志配置
      logLevel: this.configService.get<string>("LOG_LEVEL", "info"),
      enableAgentLogs: this.configService.get<boolean>(
        "ENABLE_AGENT_LOGS",
        true,
      ),

      // 性能配置
      enableMetrics: this.configService.get<boolean>("ENABLE_METRICS", true),
      metricsInterval: this.configService.get<number>("METRICS_INTERVAL", 60),
    };
  }

  /**
   * 验证配置完整性
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const llmConfig = this.getLLMConfig();

    // 检查主要LLM提供商配置
    if (
      llmConfig.primaryProvider === "dashscope" &&
      !llmConfig.dashscope.apiKey
    ) {
      errors.push(
        "DASHSCOPE_API_KEY is required when using dashscope as primary provider",
      );
    }

    if (llmConfig.primaryProvider === "openai" && !llmConfig.openai.apiKey) {
      errors.push(
        "OPENAI_API_KEY is required when using openai as primary provider",
      );
    }

    if (llmConfig.primaryProvider === "google" && !llmConfig.google.apiKey) {
      errors.push(
        "GOOGLE_API_KEY is required when using google as primary provider",
      );
    }

    // 检查数据库配置
    const requiredDbConfig = [
      "DB_HOST",
      "DB_PORT",
      "DB_USERNAME",
      "DB_DATABASE",
    ];
    for (const key of requiredDbConfig) {
      if (!this.configService.get(key)) {
        errors.push(`${key} is required for database connection`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取当前使用的模型信息
   */
  getCurrentModels() {
    const configs = this.getAgentConfigs();
    const llmConfig = this.getLLMConfig();

    return {
      provider: llmConfig.primaryProvider,
      models: {
        marketAnalyst: configs.marketAnalyst.model,
        fundamentalAnalyst: configs.fundamentalAnalyst.model,
        newsAnalyst: configs.newsAnalyst.model,
        bullResearcher: configs.bullResearcher.model,
        bearResearcher: configs.bearResearcher.model,
        conservativeTrader: configs.conservativeTrader.model,
        aggressiveTrader: configs.aggressiveTrader.model,
        reflectionAgent: configs.reflectionAgent.model,
      },
    };
  }
}
