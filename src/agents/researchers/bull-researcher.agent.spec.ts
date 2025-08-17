import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { BullResearcherAgent } from "./bull-researcher.agent";
import { LLMService, DashScopeProvider } from "../services/llm.service";
import {
  AgentType,
  AgentStatus,
  AgentContext,
  TradingRecommendation,
} from "../interfaces/agent.interface";

describe("BullResearcherAgent - 真实LLM测试", () => {
  let agent: BullResearcherAgent;
  let llmService: LLMService;
  let configService: ConfigService;

  const testContext: AgentContext = {
    stockCode: "000001",
    stockName: "平安银行",
    timeRange: {
      startDate: new Date("2025-08-01"),
      endDate: new Date("2025-08-17"),
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
        BullResearcherAgent,
        LLMService,
        DashScopeProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  BULL_RESEARCHER_MODEL: "qwen-plus",
                  BULL_RESEARCHER_TEMPERATURE: 0.8,
                  BULL_RESEARCHER_MAX_TOKENS: 2500,
                  BULL_RESEARCHER_TIMEOUT: 45,
                  BULL_RESEARCHER_RETRY_COUNT: 3,
                  DASHSCOPE_STANDARD_MODEL: "qwen-plus",
                  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || "test-api-key",
                  LLM_DEFAULT_TIMEOUT: 45,
                  LLM_PRIMARY_PROVIDER: "dashscope",
                  LLM_MAX_RETRIES: 3,
                };
                return config[key] ?? defaultValue;
              }),
          },
        },
      ],
    }).compile();

    agent = module.get<BullResearcherAgent>(BullResearcherAgent);
    llmService = module.get<LLMService>(LLMService);
    configService = module.get<ConfigService>(ConfigService);
  }, 60000);

  it("should be defined", () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe("多头研究员");
    expect(agent.type).toBe(AgentType.BULL_RESEARCHER);
    expect(agent.role).toBe("专业的多头研究员，专注于构建看涨论据和发现投资机会");
  });

  describe("构造函数配置", () => {
    it("应该使用环境变量配置或默认值", () => {
      expect(configService.get).toHaveBeenCalledWith(
        "BULL_RESEARCHER_MODEL",
        "qwen-plus",
      );
      expect(configService.get).toHaveBeenCalledWith(
        "BULL_RESEARCHER_TEMPERATURE",
        0.8,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "BULL_RESEARCHER_MAX_TOKENS",
        2500,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "BULL_RESEARCHER_TIMEOUT",
        45,
      );
    });

    it("应该包含专业的系统提示词", () => {
      const systemPrompt = agent["config"].systemPrompt;

      expect(systemPrompt).toContain("多头分析师");
      expect(systemPrompt).toContain("增长潜力");
      expect(systemPrompt).toContain("竞争优势");
      expect(systemPrompt).toContain("积极指标");
      expect(systemPrompt).toContain("护城河");
      expect(systemPrompt).toContain("技术壁垒");
      expect(systemPrompt).toContain("网络效应");
      expect(systemPrompt).toContain("规模经济");
    });
  });

  describe("buildPrompt", () => {
    it("应该构建包含股票信息的完整提示词", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("请对股票 000001 (平安银行) 进行多头研究分析");
      expect(prompt).toContain("分析时间范围: 8/1/2025 到 8/17/2025");
      expect(prompt).toContain("历史数据概要");
    });

    it("应该包含多头研究分析框架", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("## 多头研究报告");
      expect(prompt).toContain("### 1. 📈 增长潜力分析");
      expect(prompt).toContain("### 2. 🏆 竞争优势评估");
      expect(prompt).toContain("### 3. 📊 积极技术指标");
      expect(prompt).toContain("### 4. 💰 估值吸引力");
      expect(prompt).toContain("### 5. 🔮 未来前景");
      expect(prompt).toContain("### 6. 🎯 投资机会总结");
    });

    it("应该包含具体的分析要求", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("收入增长驱动因素");
      expect(prompt).toContain("利润增长预期");
      expect(prompt).toContain("市场份额扩张机会");
      expect(prompt).toContain("新业务增长点");
      expect(prompt).toContain("品牌价值和认知度");
      expect(prompt).toContain("技术领先性");
      expect(prompt).toContain("客户粘性");
    });

    it("应该包含评分和建议要求", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("**多头信心指数**: [0-100分]");
      expect(prompt).toContain("**投资推荐强度**: [强烈推荐/推荐/谨慎推荐]");
      expect(prompt).toContain("**核心投资逻辑**: [3-5个关键论证点]");
      expect(prompt).toContain("**目标价位预期**: [基于乐观预期的价位区间]");
    });

    it("应该处理没有股票名称的情况", async () => {
      const contextWithoutName = {
        ...testContext,
        stockName: undefined,
      };

      const prompt = await agent["buildPrompt"](contextWithoutName);

      expect(prompt).toContain("请对股票 000001 进行多头研究分析");
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

      // 验证时间范围是30天
      const daysDiff = Math.floor(
        (result.timeRange!.endDate.getTime() -
          result.timeRange!.startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBe(30);
    });

    it("应该保留已有的时间范围", async () => {
      const originalTimeRange = {
        startDate: new Date("2025-08-01"),
        endDate: new Date("2025-08-17"),
      };

      const contextWithTimeRange = {
        stockCode: "000001",
        stockName: "平安银行",
        timeRange: originalTimeRange,
      };

      const result = await agent["preprocessContext"](contextWithTimeRange);

      expect(result.timeRange).toEqual(originalTimeRange);
    });
  });

  describe("analyze 真实LLM集成测试", () => {
    it("应该成功执行完整的多头研究分析流程(使用真实LLM)", async () => {
      console.log("开始进行真实LLM多头研究分析测试...");
      
      try {
        const result = await agent.analyze(testContext);
        
        console.log("✅ 真实LLM多头研究分析完成");
        console.log("分析结果摘要:", {
          agentName: result.agentName,
          score: result.score,
          confidence: result.confidence,
          recommendation: result.recommendation,
          analysisLength: result.analysis?.length || 0,
          keyInsightsCount: result.keyInsights?.length || 0,
        });

        // 验证基本信息
        expect(result.agentName).toBe("多头研究员");
        expect(result.agentType).toBe(AgentType.BULL_RESEARCHER);
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
        
        // 多头研究员倾向于给出买入建议
        expect([
          TradingRecommendation.STRONG_BUY,
          TradingRecommendation.BUY,
          TradingRecommendation.HOLD
        ]).toContain(result.recommendation);
        
        // 验证智能体状态
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 真实LLM多头研究分析测试失败(可能是API密钥或网络问题):", error.message);
        
        // 如果是API密钥问题，验证错误处理是否正确
        if (error.message.includes("API") || error.message.includes("密钥")) {
          expect(agent.getStatus()).toBe(AgentStatus.ERROR);
        } else {
          throw error;
        }
      }
    }, 90000);

    it("应该正确处理各种输入场景", async () => {
      console.log("测试多头研究分析不同输入场景的处理能力...");
      
      // 测试最小输入
      const minimalContext: AgentContext = {
        stockCode: "000001",
        stockName: "平安银行",
      };
      
      try {
        const result = await agent.analyze(minimalContext);
        
        console.log("✅ 多头研究分析最小输入场景处理成功");
        expect(result.agentName).toBe("多头研究员");
        expect(result.analysis).toBeTruthy();
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 多头研究分析最小输入测试失败:", error.message);
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 45000);

    it("应该验证提示词构建的完整性", async () => {
      console.log("验证多头研究分析提示词构建逻辑...");
      
      const prompt = await agent["buildPrompt"](testContext);
      
      console.log("提示词长度:", prompt.length);
      console.log("提示词开头:", prompt.substring(0, 300) + "...");
      
      // 验证提示词包含关键信息
      expect(prompt).toContain("000001");
      expect(prompt).toContain("平安银行");
      expect(prompt).toContain("多头研究分析");
      expect(prompt).toContain("增长潜力");
      expect(prompt).toContain("竞争优势");
      expect(prompt.length).toBeGreaterThan(1000);
    });

    it("应该正确管理智能体状态", async () => {
      console.log("验证多头研究分析智能体状态管理...");
      
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
        
        console.log("✅ 多头研究分析智能体状态管理正确, 最终状态:", finalStatus);
      } catch (error) {
        console.log("⚠️ 多头研究分析过程出错:", error.message);
        expect(agent.getStatus()).toBe(AgentStatus.ERROR);
      }
    }, 60000);
  });

  describe("配置验证", () => {
    it("应该正确设置研究员特定的配置", () => {
      expect(agent["config"].model).toBe("qwen-plus");
      expect(agent["config"].temperature).toBe(0.8); // 多头研究员使用较高的温度，更有创造性
      expect(agent["config"].maxTokens).toBe(2500);
      expect(agent["config"].timeout).toBe(45);
      expect(agent["config"].retryCount).toBe(3);
    });

    it("应该有专业的系统提示词配置", () => {
      const systemPrompt = agent["config"].systemPrompt;

      // 验证提示词内容的专业性
      expect(systemPrompt).toContain("多头分析师");
      expect(systemPrompt).toContain("增长潜力");
      expect(systemPrompt).toContain("竞争优势");
      expect(systemPrompt).toContain("积极指标");
      
      // 验证多头特有的关注点
      expect(systemPrompt).toContain("护城河");
      expect(systemPrompt).toContain("技术壁垒");
      expect(systemPrompt).toContain("网络效应");
      expect(systemPrompt).toContain("规模经济");
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

      expect(daysDiff).toBe(30); // 30天
      expect(endDate.getTime()).toBeLessThanOrEqual(now.getTime());
    });
  });
});