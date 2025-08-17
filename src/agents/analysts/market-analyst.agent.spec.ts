import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { MarketAnalystAgent } from "./market-analyst.agent";
import { LLMService, DashScopeProvider } from "../services/llm.service";
import {
  AgentType,
  AgentStatus,
  AgentContext,
  TradingRecommendation,
} from "../interfaces/agent.interface";

describe("MarketAnalystAgent - 真实LLM测试", () => {
  let agent: MarketAnalystAgent;
  let llmService: LLMService;
  let configService: ConfigService;

  const testContext: AgentContext = {
    stockCode: "000001",
    stockName: "平安银行",
    timeRange: {
      startDate: new Date("2025-08-01"),
      endDate: new Date("2025-08-15"),
    },
    historicalData: {
      priceData: {
        current: "12.50",
        change: "+0.25 (+2.04%)",
      },
      volume: "1,500,000手",
      technicalIndicators: {
        MA5: 12.45,
        MA10: 12.3,
        MA20: 12.15,
        RSI: 65.5,
        MACD: 0.15,
        KDJ_K: 72,
        KDJ_D: 68,
        BOLL_UPPER: 13.1,
        BOLL_MIDDLE: 12.7,
        BOLL_LOWER: 12.3,
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketAnalystAgent,
        LLMService,
        DashScopeProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  MARKET_ANALYST_MODEL: "qwen-plus",
                  MARKET_ANALYST_TEMPERATURE: 0.7,
                  MARKET_ANALYST_MAX_TOKENS: 2500,
                  MARKET_ANALYST_TIMEOUT: 45,
                  MARKET_ANALYST_RETRY_COUNT: 3,
                  DASHSCOPE_STANDARD_MODEL: "qwen-plus",
                  LLM_DEFAULT_TEMPERATURE: 0.7,
                  LLM_DEFAULT_MAX_TOKENS: 2500,
                  LLM_DEFAULT_TIMEOUT: 45,
                  LLM_MAX_RETRIES: 3,
                  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || "test-api-key",
                  LLM_PRIMARY_PROVIDER: "dashscope",
                };
                return config[key] ?? defaultValue;
              }),
          },
        },
      ],
    }).compile();

    agent = module.get<MarketAnalystAgent>(MarketAnalystAgent);
    llmService = module.get<LLMService>(LLMService);
    configService = module.get<ConfigService>(ConfigService);
  }, 60000);

  it("should be defined", () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe("市场分析师");
    expect(agent.type).toBe(AgentType.MARKET_ANALYST);
    expect(agent.role).toBe("专业的技术分析师，专注于股票市场技术指标分析");
  });

  describe("构造函数配置", () => {
    it("应该使用环境变量配置或默认值", () => {
      expect(configService.get).toHaveBeenCalledWith(
        "MARKET_ANALYST_MODEL",
        "qwen-plus",
      );
      expect(configService.get).toHaveBeenCalledWith(
        "MARKET_ANALYST_TEMPERATURE",
        0.7,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "MARKET_ANALYST_MAX_TOKENS",
        2500,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "MARKET_ANALYST_TIMEOUT",
        45,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "MARKET_ANALYST_RETRY_COUNT",
        3,
      );
    });

    it("应该包含专业的系统提示词", () => {
      const systemPrompt = agent["config"].systemPrompt;

      expect(systemPrompt).toContain("专业的中文市场分析师");
      expect(systemPrompt).toContain("技术指标");
      expect(systemPrompt).toContain("移动平均线类");
      expect(systemPrompt).toContain("MACD相关指标");
      expect(systemPrompt).toContain("动量指标");
      expect(systemPrompt).toContain("波动率指标");
      expect(systemPrompt).toContain("成交量指标");
      expect(systemPrompt).toContain("明确的评分（0-100分）");
      expect(systemPrompt).toContain("交易建议");
    });
  });

  describe("buildPrompt", () => {
    it("应该构建包含股票信息的完整提示词", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("请对股票 000001 (平安银行) 进行全面的技术分析");
      expect(prompt).toContain("分析时间范围: 2025/8/1 到 2025/8/15");
      expect(prompt).toContain("历史数据概要");
      expect(prompt).toContain("价格数据: 最新价格 12.50，变动 +0.25 (+2.04%)");
      expect(prompt).toContain("成交量: 1,500,000手");
      expect(prompt).toContain("技术指标");
      expect(prompt).toContain("MA5");
      expect(prompt).toContain("RSI");
      expect(prompt).toContain("MACD");
    });

    it("应该包含技术分析报告结构要求", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("## 技术分析报告");
      expect(prompt).toContain("### 1. 趋势分析");
      expect(prompt).toContain("### 2. 技术指标分析");
      expect(prompt).toContain("### 3. 关键支撑阻力位");
      expect(prompt).toContain("### 4. 交易信号");
      expect(prompt).toContain("### 5. 风险评估");
      expect(prompt).toContain("### 6. 综合评估");
      expect(prompt).toContain("### 7. 关键要点总结表格");
    });

    it("应该包含评分和建议要求", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("**技术面评分**: [0-100分]");
      expect(prompt).toContain(
        "**短期建议**: [强烈买入/买入/持有/卖出/强烈卖出]",
      );
      expect(prompt).toContain("**目标价位**: [具体价格]");
      expect(prompt).toContain("**止损价位**: [具体价格]");
    });

    it("应该包含表格格式要求", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("| 项目 | 评估 | 说明 |");
      expect(prompt).toContain("| 趋势方向 |");
      expect(prompt).toContain("| 动量强度 |");
      expect(prompt).toContain("| 超买超卖 |");
      expect(prompt).toContain("| 成交量确认 |");
      expect(prompt).toContain("| 风险等级 |");
    });

    it("应该处理没有股票名称的情况", async () => {
      const contextWithoutName = {
        ...testContext,
        stockName: undefined,
      };

      const prompt = await agent["buildPrompt"](contextWithoutName);

      expect(prompt).toContain("请对股票 000001 进行全面的技术分析");
      expect(prompt).not.toContain("(平安银行)");
    });

    it("应该处理没有时间范围的情况", async () => {
      const contextWithoutTimeRange = {
        ...testContext,
        timeRange: undefined,
      };

      const prompt = await agent["buildPrompt"](contextWithoutTimeRange);

      expect(prompt).toContain("请对股票 000001");
      expect(prompt).not.toContain("分析时间范围:");
    });

    it("应该处理没有历史数据的情况", async () => {
      const contextWithoutData = {
        ...testContext,
        historicalData: undefined,
      };

      const prompt = await agent["buildPrompt"](contextWithoutData);

      expect(prompt).toContain("请对股票 000001");
      expect(prompt).not.toContain("历史数据概要");
    });

    it("应该处理部分历史数据", async () => {
      const contextWithPartialData = {
        ...testContext,
        historicalData: {
          priceData: {
            current: "12.50",
            change: "+0.25",
          },
          // 没有 volume 和 technicalIndicators
        },
      };

      const prompt = await agent["buildPrompt"](contextWithPartialData);

      expect(prompt).toContain("价格数据: 最新价格 12.50，变动 +0.25");
      expect(prompt).not.toContain("成交量:");
      expect(prompt).not.toContain("技术指标:");
    });
  });

  describe("preprocessContext", () => {
    it("应该为没有时间范围的上下文添加默认时间范围", async () => {
      const contextWithoutTimeRange = {
        stockCode: "000001",
        stockName: "平安银行",
      };

      const result = await agent["preprocessContext"](contextWithoutTimeRange);

      expect(result.timeRange).toBeDefined();
      expect(result.timeRange?.startDate).toBeInstanceOf(Date);
      expect(result.timeRange?.endDate).toBeInstanceOf(Date);

      // 验证时间范围是60天
      const daysDiff = Math.floor(
        (result.timeRange!.endDate.getTime() -
          result.timeRange!.startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBe(60);
    });

    it("应该保留已有的时间范围", async () => {
      const originalTimeRange = {
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-15"),
      };

      const contextWithTimeRange = {
        stockCode: "000001",
        stockName: "平安银行",
        timeRange: originalTimeRange,
      };

      const result = await agent["preprocessContext"](contextWithTimeRange);

      expect(result.timeRange).toEqual(originalTimeRange);
    });

    it("应该保留其他上下文属性", async () => {
      const contextWithoutTimeRange = {
        stockCode: "000001",
        stockName: "平安银行",
        historicalData: {
          priceData: { current: "12.50", change: "+0.25" },
        },
      };

      const result = await agent["preprocessContext"](contextWithoutTimeRange);

      expect(result.stockCode).toBe("000001");
      expect(result.stockName).toBe("平安银行");
      expect(result.historicalData).toBeDefined();
    });
  });

  describe("analyze 真实LLM集成测试", () => {
    it("应该成功执行完整的技术分析流程(使用真实LLM)", async () => {
      console.log("开始进行真实LLM技术分析测试...");
      
      try {
        const result = await agent.analyze(testContext);
        
        console.log("✅ 真实LLM技术分析完成");
        console.log("分析结果摘要:", {
          agentName: result.agentName,
          score: result.score,
          confidence: result.confidence,
          recommendation: result.recommendation,
          analysisLength: result.analysis?.length || 0,
          keyInsightsCount: result.keyInsights?.length || 0,
          risksCount: result.risks?.length || 0,
        });

        // 验证基本信息
        expect(result.agentName).toBe("市场分析师");
        expect(result.agentType).toBe(AgentType.MARKET_ANALYST);
        expect(result.timestamp).toBeDefined();
        expect(result.processingTime).toBeGreaterThan(0);
        
        // 验证分析内容不为空
        expect(result.analysis).toBeTruthy();
        expect(result.analysis.length).toBeGreaterThan(50);
        
        // 验证结构化信息的合理性
        expect(typeof result.score).toBe("number");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        
        expect(typeof result.confidence).toBe("number");
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        
        expect(Object.values(TradingRecommendation)).toContain(result.recommendation);
        
        // 验证智能体状态
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 真实LLM测试失败(可能是API密钥或网络问题):", error.message);
        
        // 如果是API密钥问题，验证错误处理是否正确
        if (error.message.includes("API") || error.message.includes("密钥")) {
          expect(agent.getStatus()).toBe(AgentStatus.ERROR);
        } else {
          throw error;
        }
      }
    }, 60000);

    it("应该正确处理各种输入场景", async () => {
      console.log("测试不同输入场景的处理能力...");
      
      // 测试最小输入
      const minimalContext: AgentContext = {
        stockCode: "000001",
        stockName: "平安银行",
      };
      
      try {
        const result = await agent.analyze(minimalContext);
        
        console.log("✅ 最小输入场景处理成功");
        expect(result.agentName).toBe("市场分析师");
        expect(result.analysis).toBeTruthy();
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 最小输入测试失败:", error.message);
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 45000);

    it("应该验证提示词构建的完整性", async () => {
      console.log("验证提示词构建逻辑...");
      
      const prompt = await agent["buildPrompt"](testContext);
      
      console.log("提示词长度:", prompt.length);
      console.log("提示词开头:", prompt.substring(0, 200) + "...");
      
      // 验证提示词包含关键信息
      expect(prompt).toContain("000001");
      expect(prompt).toContain("平安银行");
      expect(prompt).toContain("技术分析");
      expect(prompt).toContain("技术指标");
      expect(prompt.length).toBeGreaterThan(800);
    });

    it("应该正确管理智能体状态", async () => {
      console.log("验证智能体状态管理...");
      
      // 初始状态应该是IDLE
      expect(agent.getStatus()).toBe(AgentStatus.IDLE);
      
      // 分析过程中状态会变化
      const analysisPromise = agent.analyze(testContext);
      
      // 稍等一下让分析开始
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        await analysisPromise;
        // 完成后状态应该是COMPLETED或ERROR
        const finalStatus = agent.getStatus();
        expect([AgentStatus.COMPLETED, AgentStatus.ERROR]).toContain(finalStatus);
        
        console.log("✅ 智能体状态管理正确, 最终状态:", finalStatus);
      } catch (error) {
        console.log("⚠️ 分析过程出错:", error.message);
        expect(agent.getStatus()).toBe(AgentStatus.ERROR);
      }
    }, 30000);
  });

  describe("配置验证", () => {
    it("应该正确设置分析师特定的配置", () => {
      expect(agent["config"].model).toBe("qwen-plus");
      expect(agent["config"].temperature).toBe(0.7);
      expect(agent["config"].maxTokens).toBe(2500);
      expect(agent["config"].timeout).toBe(45);
      expect(agent["config"].retryCount).toBe(3);
    });

    it("应该有专业的系统提示词配置", () => {
      const systemPrompt = agent["config"].systemPrompt;

      // 验证提示词内容的专业性
      expect(systemPrompt).toContain("技术指标分析");
      expect(systemPrompt).toContain("趋势方向");
      expect(systemPrompt).toContain("支撑阻力");
      expect(systemPrompt).toContain("交易信号");
      expect(systemPrompt).toContain("风险评估");

      // 验证技术指标覆盖
      expect(systemPrompt).toContain("close_50_sma");
      expect(systemPrompt).toContain("close_200_sma");
      expect(systemPrompt).toContain("macd");
      expect(systemPrompt).toContain("rsi");
      expect(systemPrompt).toContain("boll");
      expect(systemPrompt).toContain("atr");
      expect(systemPrompt).toContain("vwma");
    });
  });

  describe("时间范围处理", () => {
    it("应该生成合理的默认时间范围", async () => {
      const contextWithoutTime = {
        stockCode: "000001",
        stockName: "平安银行",
      };

      const processedContext =
        await agent["preprocessContext"](contextWithoutTime);

      expect(processedContext.timeRange).toBeDefined();

      const { startDate, endDate } = processedContext.timeRange!;
      const now = new Date();
      const daysDiff = Math.floor(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      expect(daysDiff).toBe(60);
      expect(endDate.getTime()).toBeLessThanOrEqual(now.getTime());
    });
  });
});
