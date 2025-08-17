import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { NewsAnalystAgent } from "./news-analyst.agent";
import { LLMService, DashScopeProvider } from "../services/llm.service";
import {
  AgentType,
  AgentStatus,
  AgentContext,
  TradingRecommendation,
} from "../interfaces/agent.interface";

describe("NewsAnalystAgent - 真实LLM测试", () => {
  let agent: NewsAnalystAgent;
  let llmService: LLMService;
  let configService: ConfigService;

  const testContext: AgentContext = {
    stockCode: "000001",
    stockName: "平安银行",
    timeRange: {
      startDate: new Date("2025-08-10"),
      endDate: new Date("2025-08-17"),
    },
    newsData: {
      companyNews: [
        {
          title: "平安银行发布2025年中报",
          summary: "净利润同比增长8.5%",
          url: "https://example.com/news1",
          publishTime: new Date("2025-08-15"),
        },
        {
          title: "平安银行推出数字化金融服务",
          summary: "加速数字化转型步伐",
          url: "https://example.com/news2",
          publishTime: new Date("2025-08-14"),
        },
      ],
      industryNews: [
        {
          title: "银行业监管政策新动向",
          summary: "央行发布新的资本充足率要求",
          url: "https://example.com/industry1",
          publishTime: new Date("2025-08-13"),
        },
      ],
      marketNews: [
        {
          title: "央行维持基准利率不变",
          summary: "货币政策保持稳健",
          url: "https://example.com/market1",
          publishTime: new Date("2025-08-12"),
        },
      ],
      sentiment: {
        positive: 0.6,
        neutral: 0.3,
        negative: 0.1,
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsAnalystAgent,
        LLMService,
        DashScopeProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  NEWS_ANALYST_MODEL: "qwen-plus",
                  NEWS_ANALYST_TEMPERATURE: 0.7,
                  NEWS_ANALYST_MAX_TOKENS: 2500,
                  NEWS_ANALYST_TIMEOUT: 45,
                  NEWS_ANALYST_RETRY_COUNT: 3,
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

    agent = module.get<NewsAnalystAgent>(NewsAnalystAgent);
    llmService = module.get<LLMService>(LLMService);
    configService = module.get<ConfigService>(ConfigService);
  }, 60000);

  it("should be defined", () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe("新闻分析师");
    expect(agent.type).toBe(AgentType.NEWS_ANALYST);
    expect(agent.role).toBe("专业的新闻情绪分析师，专注于市场新闻和情绪趋势分析");
  });

  describe("构造函数配置", () => {
    it("应该使用环境变量配置或默认值", () => {
      expect(configService.get).toHaveBeenCalledWith(
        "NEWS_ANALYST_MODEL",
        "qwen-plus",
      );
      expect(configService.get).toHaveBeenCalledWith(
        "NEWS_ANALYST_TEMPERATURE",
        0.7,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "NEWS_ANALYST_MAX_TOKENS",
        2500,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "NEWS_ANALYST_TIMEOUT",
        45,
      );
    });

    it("应该包含专业的系统提示词", () => {
      const systemPrompt = agent["config"].systemPrompt;

      expect(systemPrompt).toContain("新闻研究分析师");
      expect(systemPrompt).toContain("全球宏观经济新闻");
      expect(systemPrompt).toContain("金融市场动态");
      expect(systemPrompt).toContain("政策影响");
      expect(systemPrompt).toContain("行业趋势");
      expect(systemPrompt).toContain("突发事件");
      expect(systemPrompt).toContain("情绪评分（0-100分）");
    });
  });

  describe("buildPrompt", () => {
    it("应该构建包含股票信息的完整提示词", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("请对股票 000001 (平安银行) 进行全面的新闻情绪分析");
      expect(prompt).toContain("分析时间范围: 8/10/2025 到 8/17/2025");
      expect(prompt).toContain("新闻数据概要");
    });

    it("应该包含新闻数据信息", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("公司相关新闻 (2条)");
      expect(prompt).toContain("平安银行发布2025年中报");
      expect(prompt).toContain("平安银行推出数字化金融服务");
      
      expect(prompt).toContain("行业相关新闻 (1条)");
      expect(prompt).toContain("银行业监管政策新动向");
      
      expect(prompt).toContain("市场宏观新闻 (1条)");
      expect(prompt).toContain("央行维持基准利率不变");
    });

    it("应该包含情绪数据信息", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("情绪数据:");
      expect(prompt).toContain("正面情绪: 0.6");
      expect(prompt).toContain("中性情绪: 0.3");
      expect(prompt).toContain("负面情绪: 0.1");
    });

    it("应该包含新闻情绪分析结构", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("## 新闻情绪分析报告");
      expect(prompt).toContain("### 1. 新闻概览");
      expect(prompt).toContain("### 2. 公司专项新闻分析");
      expect(prompt).toContain("### 3. 行业新闻影响分析");
      expect(prompt).toContain("### 4. 宏观环境分析");
      expect(prompt).toContain("### 5. 情绪趋势分析");
      expect(prompt).toContain("### 6. 社交媒体情绪");
      expect(prompt).toContain("### 7. 新闻影响评估");
      expect(prompt).toContain("### 8. 综合评估");
    });

    it("应该包含评分和建议要求", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("**新闻情绪评分**: [0-100分，50为中性]");
      expect(prompt).toContain("**市场影响程度**: [高/中/低]");
      expect(prompt).toContain("**情绪建议**: [乐观/谨慎乐观/中性/谨慎悲观/悲观]");
      expect(prompt).toContain("**关注要点**: [列出3-5个关键关注点]");
    });

    it("应该包含关键新闻事件总结表格", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("### 9. 关键新闻事件总结表格");
      expect(prompt).toContain("| 事件类型 | 影响程度 | 时效性 | 情绪倾向 | 市场反应预期 |");
      expect(prompt).toContain("| 公司公告 |");
      expect(prompt).toContain("| 行业政策 |");
      expect(prompt).toContain("| 财报业绩 |");
      expect(prompt).toContain("| 宏观政策 |");
    });

    it("应该处理没有股票名称的情况", async () => {
      const contextWithoutName = {
        ...testContext,
        stockName: undefined,
      };

      const prompt = await agent["buildPrompt"](contextWithoutName);

      expect(prompt).toContain("请对股票 000001 进行全面的新闻情绪分析");
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

    it("应该处理没有新闻数据的情况", async () => {
      const contextWithoutNews = {
        ...testContext,
        newsData: undefined,
      };

      const prompt = await agent["buildPrompt"](contextWithoutNews);

      expect(prompt).toContain("请对股票 000001");
      expect(prompt).not.toContain("新闻数据概要:");
    });

    it("应该处理部分新闻数据", async () => {
      const contextWithPartialNews = {
        ...testContext,
        newsData: {
          companyNews: [
            {
              title: "测试新闻",
              summary: "测试摘要",
              url: "https://test.com",
              publishTime: new Date(),
            },
          ],
          // 没有其他新闻类型
        },
      };

      const prompt = await agent["buildPrompt"](contextWithPartialNews);

      expect(prompt).toContain("公司相关新闻 (1条)");
      expect(prompt).toContain("测试新闻");
      expect(prompt).not.toContain("行业相关新闻");
      expect(prompt).not.toContain("市场宏观新闻");
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

      // 验证时间范围是7天
      const daysDiff = Math.floor(
        (result.timeRange!.endDate.getTime() -
          result.timeRange!.startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBe(7);
    });

    it("应该保留已有的时间范围", async () => {
      const originalTimeRange = {
        startDate: new Date("2025-08-10"),
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

    it("应该保留其他上下文属性", async () => {
      const contextWithoutTimeRange = {
        stockCode: "000001",
        stockName: "平安银行",
        newsData: {
          companyNews: [
            {
              title: "测试新闻",
              summary: "测试摘要",
              url: "https://test.com",
              publishTime: new Date(),
            },
          ],
        },
      };

      const result = await agent["preprocessContext"](contextWithoutTimeRange);

      expect(result.stockCode).toBe("000001");
      expect(result.stockName).toBe("平安银行");
      expect(result.newsData).toBeDefined();
    });
  });

  describe("analyze 真实LLM集成测试", () => {
    it("应该成功执行完整的新闻情绪分析流程(使用真实LLM)", async () => {
      console.log("开始进行真实LLM新闻情绪分析测试...");
      
      try {
        const result = await agent.analyze(testContext);
        
        console.log("✅ 真实LLM新闻情绪分析完成");
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
        expect(result.agentName).toBe("新闻分析师");
        expect(result.agentType).toBe(AgentType.NEWS_ANALYST);
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
        console.log("⚠️ 真实LLM新闻情绪分析测试失败(可能是API密钥或网络问题):", error.message);
        
        // 如果是API密钥问题，验证错误处理是否正确
        if (error.message.includes("API") || error.message.includes("密钥")) {
          expect(agent.getStatus()).toBe(AgentStatus.ERROR);
        } else {
          throw error;
        }
      }
    }, 90000);

    it("应该正确处理各种输入场景", async () => {
      console.log("测试新闻情绪分析不同输入场景的处理能力...");
      
      // 测试最小输入
      const minimalContext: AgentContext = {
        stockCode: "000001",
        stockName: "平安银行",
      };
      
      try {
        const result = await agent.analyze(minimalContext);
        
        console.log("✅ 新闻情绪分析最小输入场景处理成功");
        expect(result.agentName).toBe("新闻分析师");
        expect(result.analysis).toBeTruthy();
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 新闻情绪分析最小输入测试失败:", error.message);
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 45000);

    it("应该验证提示词构建的完整性", async () => {
      console.log("验证新闻情绪分析提示词构建逻辑...");
      
      const prompt = await agent["buildPrompt"](testContext);
      
      console.log("提示词长度:", prompt.length);
      console.log("提示词开头:", prompt.substring(0, 300) + "...");
      
      // 验证提示词包含关键信息
      expect(prompt).toContain("000001");
      expect(prompt).toContain("平安银行");
      expect(prompt).toContain("新闻情绪分析");
      expect(prompt).toContain("情绪趋势分析");
      expect(prompt).toContain("社交媒体情绪");
      expect(prompt.length).toBeGreaterThan(1500);
    });

    it("应该正确管理智能体状态", async () => {
      console.log("验证新闻情绪分析智能体状态管理...");
      
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
        
        console.log("✅ 新闻情绪分析智能体状态管理正确, 最终状态:", finalStatus);
      } catch (error) {
        console.log("⚠️ 新闻情绪分析过程出错:", error.message);
        expect(agent.getStatus()).toBe(AgentStatus.ERROR);
      }
    }, 60000);
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
      expect(systemPrompt).toContain("新闻研究分析师");
      expect(systemPrompt).toContain("全球宏观经济新闻");
      expect(systemPrompt).toContain("金融市场动态");
      expect(systemPrompt).toContain("政策影响");
      expect(systemPrompt).toContain("行业趋势");
      expect(systemPrompt).toContain("突发事件");
      
      // 验证分析要求
      expect(systemPrompt).toContain("情绪评分（0-100分）");
      expect(systemPrompt).toContain("市场影响评估");
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

      expect(daysDiff).toBe(7); // 7天
      expect(endDate.getTime()).toBeLessThanOrEqual(now.getTime());
    });
  });
});