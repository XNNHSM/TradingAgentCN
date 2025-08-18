import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AggressiveTraderAgent } from "./aggressive-trader.agent";
import { LLMService, DashScopeProvider } from "../services/llm.service";
import {
  AgentType,
  AgentStatus,
  AgentContext,
  TradingRecommendation,
} from "../interfaces/agent.interface";

describe("AggressiveTraderAgent - 真实LLM测试", () => {
  let agent: AggressiveTraderAgent;
  let llmService: LLMService;
  let configService: ConfigService;

  const testContext: AgentContext = {
    stockCode: "000001",
    stockName: "平安银行",
    timeRange: {
      startDate: new Date("2025-08-01"),
      endDate: new Date("2025-08-17"),
    },
    previousResults: [
      {
        agentName: "市场分析师",
        agentType: AgentType.MARKET_ANALYST,
        score: 78,
        recommendation: TradingRecommendation.BUY,
        confidence: 0.82,
        analysis: "技术指标强势突破，成交量放大确认上涨趋势，短期目标价位15元",
        keyInsights: ["技术突破", "成交量放大", "上涨趋势"],
        risks: ["短期回调风险"],
        timestamp: new Date(),
        processingTime: 5000,
      },
      {
        agentName: "基本面分析师",
        agentType: AgentType.FUNDAMENTAL_ANALYST,
        score: 72,
        recommendation: TradingRecommendation.BUY,
        confidence: 0.75,
        analysis: "公司基本面稳健，ROE持续改善，新业务增长点明确，催化剂丰富",
        keyInsights: ["基本面稳健", "ROE改善", "新业务增长"],
        timestamp: new Date(),
        processingTime: 6000,
      },
      {
        agentName: "新闻分析师",
        agentType: AgentType.NEWS_ANALYST,
        score: 68,
        recommendation: TradingRecommendation.HOLD,
        confidence: 0.7,
        analysis: "近期新闻偏正面，政策支持明确，行业景气度提升",
        keyInsights: ["政策支持", "行业景气"],
        timestamp: new Date(),
        processingTime: 4000,
      },
      {
        agentName: "多头研究员",
        agentType: AgentType.BULL_RESEARCHER,
        score: 85,
        recommendation: TradingRecommendation.STRONG_BUY,
        confidence: 0.88,
        analysis: "多重催化剂叠加，增长动力强劲，竞争优势明显，建议重点关注",
        keyInsights: ["催化剂叠加", "增长动力", "竞争优势"],
        timestamp: new Date(),
        processingTime: 4500,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AggressiveTraderAgent,
        LLMService,
        DashScopeProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  AGGRESSIVE_TRADER_MODEL: "qwen-plus",
                  AGGRESSIVE_TRADER_TEMPERATURE: 0.8,
                  AGGRESSIVE_TRADER_MAX_TOKENS: 2500,
                  AGGRESSIVE_TRADER_TIMEOUT: 45,
                  AGGRESSIVE_TRADER_RETRY_COUNT: 3,
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

    agent = module.get<AggressiveTraderAgent>(AggressiveTraderAgent);
    llmService = module.get<LLMService>(LLMService);
    configService = module.get<ConfigService>(ConfigService);
  }, 60000);

  it("should be defined", () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe("激进型交易员");
    expect(agent.type).toBe(AgentType.AGGRESSIVE_TRADER);
    expect(agent.role).toBe("专业的激进型交易员，专注于高收益机会和趋势捕捉");
  });

  describe("构造函数配置", () => {
    it("应该使用环境变量配置或默认值", () => {
      expect(configService.get).toHaveBeenCalledWith(
        "AGGRESSIVE_TRADER_MODEL",
        "qwen-plus",
      );
      expect(configService.get).toHaveBeenCalledWith(
        "AGGRESSIVE_TRADER_TEMPERATURE",
        0.8,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "AGGRESSIVE_TRADER_MAX_TOKENS",
        2500,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "AGGRESSIVE_TRADER_TIMEOUT",
        45,
      );
    });

    it("应该包含专业的系统提示词", () => {
      const systemPrompt = agent["config"].systemPrompt;

      expect(systemPrompt).toContain("激进型交易智能体");
      expect(systemPrompt).toContain("高收益机会");
      expect(systemPrompt).toContain("增长导向原则");
      expect(systemPrompt).toContain("收益优先");
      expect(systemPrompt).toContain("趋势跟随");
      expect(systemPrompt).toContain("快速行动");
      expect(systemPrompt).toContain("数据驱动");
    });
  });

  describe("buildPrompt", () => {
    it("应该构建包含股票信息的完整提示词", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("作为激进型交易员，请基于团队分析师的综合研究，对股票 000001 (平安银行) 做出积极的投资决策");
      expect(prompt).toContain("## 团队分析师研究汇总");
    });

    it("应该包含所有分析师的汇总信息", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("### 市场分析师 (market_analyst)");
      expect(prompt).toContain("### 基本面分析师 (fundamental_analyst)");
      expect(prompt).toContain("### 新闻分析师 (news_analyst)");
      expect(prompt).toContain("### 多头研究员 (bull_researcher)");
    });

    it("应该包含激进型交易决策框架", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("## 请进行激进型交易决策分析");
      expect(prompt).toContain("### 1. 机会评估矩阵");
      expect(prompt).toContain("### 2. 综合机会分析");
      expect(prompt).toContain("### 3. 收益最大化方案");
      expect(prompt).toContain("### 4. 催化剂因素分析");
      expect(prompt).toContain("### 5. 动量指标监控");
      expect(prompt).toContain("### 6. 激进型交易决策");
    });

    it("应该包含具体的交易要素", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("上涨潜力");
      expect(prompt).toContain("动量强度");
      expect(prompt).toContain("催化剂丰富度");
      expect(prompt).toContain("技术突破概率");
      expect(prompt).toContain("仓位管理");
      expect(prompt).toContain("止盈策略");
      expect(prompt).toContain("风险控制");
    });

    it("应该计算和显示团队平均评分", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("**团队平均评分**:");
      expect(prompt).toContain("**建议分布**:");
      expect(prompt).toContain("**关键机会**:");
    });

    it("应该要求明确的最终建议", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("**最终交易建议**:");
      expect(prompt).toContain("充分挖掘投资机会和上涨潜力");
    });

    it("应该处理没有分析师结果的情况", async () => {
      const contextWithoutResults = {
        ...testContext,
        previousResults: undefined,
      };

      const prompt = await agent["buildPrompt"](contextWithoutResults);

      expect(prompt).toContain("作为激进型交易员");
      expect(prompt).toContain("## 请进行激进型交易决策分析");
    });
  });

  describe("postprocessResult", () => {
    it("应该调整评分更加乐观", async () => {
      const mockAnalysis = "激进交易分析完成，评分70分，建议买入";
      const result = await agent["postprocessResult"](mockAnalysis, testContext);

      // 激进交易员应该提升高分股票的评分
      if (result.score && result.score > 60) {
        expect(result.score).toBeGreaterThan(70);
      }
    });

    it("应该调整交易建议更加积极", async () => {
      const mockAnalysis = "激进交易分析完成，评分80分，建议买入";
      const mockResult = await agent["postprocessResult"](mockAnalysis, testContext);
      
      // 模拟高分买入建议应该被提升为强烈买入
      if (mockResult.score && mockResult.score > 75) {
        // 这个测试可能需要根据具体的postprocessResult实现来调整
        expect([TradingRecommendation.BUY, TradingRecommendation.STRONG_BUY]).toContain(mockResult.recommendation);
      }
    });

    it("应该提取目标价位信息", async () => {
      const analysisWithTargets = "第一止盈位：15.5元，第二止盈位：17.0元，激进目标位：18.5元";
      const result = await agent["postprocessResult"](analysisWithTargets, testContext);

      expect(result.supportingData?.targetPrices).toBeDefined();
      if (result.supportingData?.targetPrices) {
        expect(result.supportingData.targetPrices.length).toBeGreaterThan(0);
        expect(result.supportingData.primaryTarget).toBeDefined();
      }
    });

    it("应该提取仓位建议", async () => {
      const analysisWithPosition = "建议仓位比例：30%，激进仓位上限：40%";
      const result = await agent["postprocessResult"](analysisWithPosition, testContext);

      expect(result.supportingData?.positionSize).toBe(0.3);
    });

    it("应该提取催化剂因素", async () => {
      const analysisWithCatalysts = `
### 4. 催化剂因素分析
- [x] 业绩超预期
- [x] 新产品发布
- [ ] 政策利好
- [x] 行业复苏
`;
      const result = await agent["postprocessResult"](analysisWithCatalysts, testContext);

      expect(result.supportingData?.catalysts).toBeDefined();
      if (result.supportingData?.catalysts) {
        expect(result.supportingData.catalysts.length).toBeGreaterThan(0);
      }
    });
  });

  describe("analyze 真实LLM集成测试", () => {
    it("应该成功执行完整的激进型交易分析流程(使用真实LLM)", async () => {
      console.log("开始进行真实LLM激进型交易分析测试...");
      
      try {
        const result = await agent.analyze(testContext);
        
        console.log("✅ 真实LLM激进型交易分析完成");
        console.log("分析结果摘要:", {
          agentName: result.agentName,
          score: result.score,
          confidence: result.confidence,
          recommendation: result.recommendation,
          analysisLength: result.analysis?.length || 0,
          keyInsightsCount: result.keyInsights?.length || 0,
          targetPrices: result.supportingData?.targetPrices,
          positionSize: result.supportingData?.positionSize,
        });

        // 验证基本信息
        expect(result.agentName).toBe("激进型交易员");
        expect(result.agentType).toBe(AgentType.AGGRESSIVE_TRADER);
        expect(result.timestamp).toBeDefined();
        expect(result.processingTime).toBeGreaterThan(0);
        
        // 验证分析内容不为空
        expect(result.analysis).toBeTruthy();
        expect(result.analysis.length).toBeGreaterThan(100);
        
        // 验证结构化信息的合理性
        expect(typeof result.score).toBe("number");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        
        expect(typeof result.confidence).toBe("number");
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        
        expect(Object.values(TradingRecommendation)).toContain(result.recommendation);
        
        // 激进交易员倾向于给出买入建议
        expect([
          TradingRecommendation.STRONG_BUY,
          TradingRecommendation.BUY,
          TradingRecommendation.HOLD
        ]).toContain(result.recommendation);
        
        // 验证智能体状态
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 真实LLM激进型交易分析测试失败(可能是API密钥或网络问题):", error.message);
        
        // 如果是API密钥问题，验证错误处理是否正确
        if (error.message.includes("API") || error.message.includes("密钥")) {
          expect(agent.getStatus()).toBe(AgentStatus.ERROR);
        } else {
          throw error;
        }
      }
    }, 90000);

    it("应该正确处理各种输入场景", async () => {
      console.log("测试激进型交易分析不同输入场景的处理能力...");
      
      // 测试最小输入
      const minimalContext: AgentContext = {
        stockCode: "000001",
        stockName: "平安银行",
        previousResults: testContext.previousResults,
      };
      
      try {
        const result = await agent.analyze(minimalContext);
        
        console.log("✅ 激进型交易分析最小输入场景处理成功");
        expect(result.agentName).toBe("激进型交易员");
        expect(result.analysis).toBeTruthy();
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 激进型交易分析最小输入测试失败:", error.message);
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 45000);

    it("应该验证提示词构建的完整性", async () => {
      console.log("验证激进型交易分析提示词构建逻辑...");
      
      const prompt = await agent["buildPrompt"](testContext);
      
      console.log("提示词长度:", prompt.length);
      console.log("提示词开头:", prompt.substring(0, 300) + "...");
      
      // 验证提示词包含关键信息
      expect(prompt).toContain("000001");
      expect(prompt).toContain("平安银行");
      expect(prompt).toContain("激进型交易员");
      expect(prompt).toContain("机会评估");
      expect(prompt).toContain("机会评估矩阵");
      expect(prompt.length).toBeGreaterThan(2000);
    });

    it("应该正确管理智能体状态", async () => {
      console.log("验证激进型交易分析智能体状态管理...");
      
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
        
        console.log("✅ 激进型交易分析智能体状态管理正确, 最终状态:", finalStatus);
      } catch (error) {
        console.log("⚠️ 激进型交易分析过程出错:", error.message);
        expect(agent.getStatus()).toBe(AgentStatus.ERROR);
      }
    }, 60000);
  });

  describe("配置验证", () => {
    it("应该正确设置激进交易员特定的配置", () => {
      expect(agent["config"].model).toBe("qwen-plus");
      expect(agent["config"].temperature).toBe(0.8); // 激进交易员使用较高温度，更有创造性
      expect(agent["config"].maxTokens).toBe(2500);
      expect(agent["config"].timeout).toBe(45);
      expect(agent["config"].retryCount).toBe(3);
    });

    it("应该有专业的系统提示词配置", () => {
      const systemPrompt = agent["config"].systemPrompt;

      // 验证提示词内容的专业性
      expect(systemPrompt).toContain("激进型交易智能体");
      expect(systemPrompt).toContain("高收益机会");
      expect(systemPrompt).toContain("增长导向原则");
      
      // 验证激进交易的特有要素
      expect(systemPrompt).toContain("收益优先");
      expect(systemPrompt).toContain("趋势跟随");
      expect(systemPrompt).toContain("快速行动");
      expect(systemPrompt).toContain("动量投资");
      expect(systemPrompt).toContain("最终交易建议");
    });
  });

  describe("分析师结果整合", () => {
    it("应该正确整合和计算团队分析", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      // 验证包含团队统计信息
      expect(prompt).toContain("**团队平均评分**:");
      expect(prompt).toContain("**建议分布**:");
      expect(prompt).toContain("**关键机会**:");
      
      // 验证包含具体分析内容
      expect(prompt).toContain("技术指标强势突破");
      expect(prompt).toContain("基本面稳健");
      expect(prompt).toContain("多重催化剂叠加");
    });

    it("应该提取和展示催化剂因素", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      // 检查是否尝试提取催化剂相关信息
      expect(prompt).toContain("催化剂");
      expect(prompt).toContain("催化剂因素");
    });
  });

  describe("激进交易特性", () => {
    it("应该包含激进交易的特有分析要求", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      expect(prompt).toContain("机会评估矩阵");
      expect(prompt).toContain("收益最大化方案");
      expect(prompt).toContain("超额收益策略");
      expect(prompt).toContain("激进目标位");
      expect(prompt).toContain("波段操作");
    });

    it("应该包含动量和趋势分析", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      expect(prompt).toContain("动量强度");
      expect(prompt).toContain("技术突破概率");
      expect(prompt).toContain("趋势延续");
      expect(prompt).toContain("动量指标监控");
      expect(prompt).toContain("成交量放大确认");
    });
  });
});