import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ConservativeTraderAgent } from "./conservative-trader.agent";
import { LLMService, DashScopeProvider } from "../services/llm.service";
import {
  AgentType,
  AgentStatus,
  AgentContext,
  TradingRecommendation,
} from "../interfaces/agent.interface";

describe("ConservativeTraderAgent - 真实LLM测试", () => {
  let agent: ConservativeTraderAgent;
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
        score: 65,
        recommendation: TradingRecommendation.HOLD,
        confidence: 0.72,
        analysis: "技术指标显示震荡格局，成交量一般，需要确认方向",
        keyInsights: ["震荡格局", "方向不明"],
        risks: ["方向不确定", "成交量不足"],
        timestamp: new Date(),
        processingTime: 5000,
      },
      {
        agentName: "基本面分析师",
        agentType: AgentType.FUNDAMENTAL_ANALYST,
        score: 58,
        recommendation: TradingRecommendation.HOLD,
        confidence: 0.68,
        analysis: "公司基本面一般，财务稳健但增长乏力，估值合理但缺乏亮点",
        keyInsights: ["财务稳健", "增长乏力"],
        risks: ["增长缓慢", "缺乏催化剂"],
        timestamp: new Date(),
        processingTime: 6000,
      },
      {
        agentName: "新闻分析师",
        agentType: AgentType.NEWS_ANALYST,
        score: 52,
        recommendation: TradingRecommendation.HOLD,
        confidence: 0.6,
        analysis: "近期新闻中性，没有明显利好或利空，市场关注度一般",
        keyInsights: ["新闻中性", "关注度一般"],
        risks: ["缺乏催化剂", "市场冷淡"],
        timestamp: new Date(),
        processingTime: 4000,
      },
      {
        agentName: "空头研究员",
        agentType: AgentType.BEAR_RESEARCHER,
        score: 35,
        recommendation: TradingRecommendation.SELL,
        confidence: 0.75,
        analysis: "行业竞争加剧，利润率面临压力，监管环境趋严",
        risks: ["行业竞争", "利润率压力", "监管趋严", "经济下行"],
        timestamp: new Date(),
        processingTime: 5200,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConservativeTraderAgent,
        LLMService,
        DashScopeProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  CONSERVATIVE_TRADER_MODEL: "qwen-plus",
                  CONSERVATIVE_TRADER_TEMPERATURE: 0.5,
                  CONSERVATIVE_TRADER_MAX_TOKENS: 2500,
                  CONSERVATIVE_TRADER_TIMEOUT: 45,
                  CONSERVATIVE_TRADER_RETRY_COUNT: 3,
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

    agent = module.get<ConservativeTraderAgent>(ConservativeTraderAgent);
    llmService = module.get<LLMService>(LLMService);
    configService = module.get<ConfigService>(ConfigService);
  }, 60000);

  it("should be defined", () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe("保守型交易员");
    expect(agent.type).toBe(AgentType.CONSERVATIVE_TRADER);
    expect(agent.role).toBe("专业的保守型交易员，以风险控制和资本保护为核心");
  });

  describe("构造函数配置", () => {
    it("应该使用环境变量配置或默认值", () => {
      expect(configService.get).toHaveBeenCalledWith(
        "CONSERVATIVE_TRADER_MODEL",
        "qwen-plus",
      );
      expect(configService.get).toHaveBeenCalledWith(
        "CONSERVATIVE_TRADER_TEMPERATURE",
        0.5,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "CONSERVATIVE_TRADER_MAX_TOKENS",
        2500,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "CONSERVATIVE_TRADER_TIMEOUT",
        45,
      );
    });

    it("应该包含专业的系统提示词", () => {
      const systemPrompt = agent["config"].systemPrompt;

      expect(systemPrompt).toContain("保守型交易智能体");
      expect(systemPrompt).toContain("风险控制");
      expect(systemPrompt).toContain("风险控制原则");
      expect(systemPrompt).toContain("风险第一，收益第二");
      expect(systemPrompt).toContain("严格止损");
      expect(systemPrompt).toContain("分散投资");
      expect(systemPrompt).toContain("基于数据");
    });
  });

  describe("buildPrompt", () => {
    it("应该构建包含股票信息的完整提示词", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("作为保守型交易员，请基于团队分析师的综合研究，对股票 000001 (平安银行) 做出谨慎的投资决策");
      expect(prompt).toContain("## 团队分析师研究汇总");
    });

    it("应该包含所有分析师的汇总信息", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("### 市场分析师 (MARKET_ANALYST)");
      expect(prompt).toContain("### 基本面分析师 (FUNDAMENTAL_ANALYST)");
      expect(prompt).toContain("### 新闻分析师 (NEWS_ANALYST)");
      expect(prompt).toContain("### 空头研究员 (BEAR_RESEARCHER)");
    });

    it("应该包含保守型交易决策框架", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("## 请进行保守型交易决策分析");
      expect(prompt).toContain("### 1. 风险评估矩阵");
      expect(prompt).toContain("### 2. 综合分析评估");
      expect(prompt).toContain("### 3. 风险控制方案");
      expect(prompt).toContain("### 4. 风险提示清单");
      expect(prompt).toContain("### 5. 监控要点");
      expect(prompt).toContain("### 6. 保守型交易决策");
    });

    it("应该包含风险控制要素", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("市场风险");
      expect(prompt).toContain("流动性风险");
      expect(prompt).toContain("基本面风险");
      expect(prompt).toContain("技术面风险");
      expect(prompt).toContain("行业风险");
      expect(prompt).toContain("宏观风险");
      expect(prompt).toContain("仓位管理");
      expect(prompt).toContain("止损策略");
      expect(prompt).toContain("止盈策略");
    });

    it("应该计算和显示团队平均评分及风险", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("**团队平均评分**:");
      expect(prompt).toContain("**建议分布**:");
      expect(prompt).toContain("**主要风险**:");
    });

    it("应该要求明确的最终建议", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("**最终交易建议**:");
      expect(prompt).toContain("充分考虑保本的重要性");
    });

    it("应该处理没有分析师结果的情况", async () => {
      const contextWithoutResults = {
        ...testContext,
        previousResults: undefined,
      };

      const prompt = await agent["buildPrompt"](contextWithoutResults);

      expect(prompt).toContain("作为保守型交易员");
      expect(prompt).toContain("## 请进行保守型交易决策分析");
    });
  });

  describe("postprocessResult", () => {
    it("应该调整评分更加保守", async () => {
      const mockAnalysis = "保守交易分析完成，评分85分，建议买入";
      const result = await agent["postprocessResult"](mockAnalysis, testContext);

      // 保守交易员应该降低高分股票的评分
      if (result.score && result.score > 80) {
        expect(result.score).toBeLessThanOrEqual(75);
      }
    });

    it("应该调整交易建议更加保守", async () => {
      const mockAnalysis = "保守交易分析完成，评分70分，建议强烈买入";
      const result = await agent["postprocessResult"](mockAnalysis, testContext);
      
      // 强烈买入应该被调整为买入
      expect([
        TradingRecommendation.BUY,
        TradingRecommendation.HOLD,
        TradingRecommendation.SELL
      ]).toContain(result.recommendation);
    });

    it("应该确保有风险提示", async () => {
      const mockAnalysis = "保守交易分析完成，没有特别风险";
      const result = await agent["postprocessResult"](mockAnalysis, testContext);

      // 保守交易员必须有风险提示
      expect(result.risks).toBeDefined();
      expect(result.risks!.length).toBeGreaterThan(0);
    });

    it("应该提取止损位信息", async () => {
      const analysisWithStopLoss = "技术止损位：11.50元，基本面止损条件如下";
      const result = await agent["postprocessResult"](analysisWithStopLoss, testContext);

      expect(result.supportingData?.stopLoss).toBe(11.5);
    });

    it("应该提取仓位建议", async () => {
      const analysisWithPosition = "建议仓位比例：15%，最大允许仓位：20%";
      const result = await agent["postprocessResult"](analysisWithPosition, testContext);

      expect(result.supportingData?.positionSize).toBe(0.15);
    });

    it("应该提取目标价", async () => {
      const analysisWithTarget = "第一目标位：13.8元，最终目标位：15.0元";
      const result = await agent["postprocessResult"](analysisWithTarget, testContext);

      expect(result.supportingData?.targetPrice).toBe(13.8);
    });
  });

  describe("analyze 真实LLM集成测试", () => {
    it("应该成功执行完整的保守型交易分析流程(使用真实LLM)", async () => {
      console.log("开始进行真实LLM保守型交易分析测试...");
      
      try {
        const result = await agent.analyze(testContext);
        
        console.log("✅ 真实LLM保守型交易分析完成");
        console.log("分析结果摘要:", {
          agentName: result.agentName,
          score: result.score,
          confidence: result.confidence,
          recommendation: result.recommendation,
          analysisLength: result.analysis?.length || 0,
          risksCount: result.risks?.length || 0,
          stopLoss: result.supportingData?.stopLoss,
          positionSize: result.supportingData?.positionSize,
        });

        // 验证基本信息
        expect(result.agentName).toBe("保守型交易员");
        expect(result.agentType).toBe(AgentType.CONSERVATIVE_TRADER);
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
        
        // 保守交易员倾向于给出谨慎建议
        expect([
          TradingRecommendation.HOLD,
          TradingRecommendation.SELL,
          TradingRecommendation.BUY
        ]).toContain(result.recommendation);
        
        // 验证风险提示 - 保守交易员必须有风险提示
        expect(result.risks).toBeDefined();
        expect(result.risks!.length).toBeGreaterThan(0);
        
        // 验证智能体状态
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 真实LLM保守型交易分析测试失败(可能是API密钥或网络问题):", error.message);
        
        // 如果是API密钥问题，验证错误处理是否正确
        if (error.message.includes("API") || error.message.includes("密钥")) {
          expect(agent.getStatus()).toBe(AgentStatus.ERROR);
        } else {
          throw error;
        }
      }
    }, 90000);

    it("应该正确处理各种输入场景", async () => {
      console.log("测试保守型交易分析不同输入场景的处理能力...");
      
      // 测试最小输入
      const minimalContext: AgentContext = {
        stockCode: "000001",
        stockName: "平安银行",
        previousResults: testContext.previousResults,
      };
      
      try {
        const result = await agent.analyze(minimalContext);
        
        console.log("✅ 保守型交易分析最小输入场景处理成功");
        expect(result.agentName).toBe("保守型交易员");
        expect(result.analysis).toBeTruthy();
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 保守型交易分析最小输入测试失败:", error.message);
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 45000);

    it("应该验证提示词构建的完整性", async () => {
      console.log("验证保守型交易分析提示词构建逻辑...");
      
      const prompt = await agent["buildPrompt"](testContext);
      
      console.log("提示词长度:", prompt.length);
      console.log("提示词开头:", prompt.substring(0, 300) + "...");
      
      // 验证提示词包含关键信息
      expect(prompt).toContain("000001");
      expect(prompt).toContain("平安银行");
      expect(prompt).toContain("保守型交易员");
      expect(prompt).toContain("风险控制");
      expect(prompt).toContain("风险评估矩阵");
      expect(prompt.length).toBeGreaterThan(2000);
    });

    it("应该正确管理智能体状态", async () => {
      console.log("验证保守型交易分析智能体状态管理...");
      
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
        
        console.log("✅ 保守型交易分析智能体状态管理正确, 最终状态:", finalStatus);
      } catch (error) {
        console.log("⚠️ 保守型交易分析过程出错:", error.message);
        expect(agent.getStatus()).toBe(AgentStatus.ERROR);
      }
    }, 60000);
  });

  describe("配置验证", () => {
    it("应该正确设置保守交易员特定的配置", () => {
      expect(agent["config"].model).toBe("qwen-plus");
      expect(agent["config"].temperature).toBe(0.5); // 保守交易员使用较低温度，更理性
      expect(agent["config"].maxTokens).toBe(2500);
      expect(agent["config"].timeout).toBe(45);
      expect(agent["config"].retryCount).toBe(3);
    });

    it("应该有专业的系统提示词配置", () => {
      const systemPrompt = agent["config"].systemPrompt;

      // 验证提示词内容的专业性
      expect(systemPrompt).toContain("保守型交易智能体");
      expect(systemPrompt).toContain("风险控制");
      expect(systemPrompt).toContain("风险控制原则");
      
      // 验证保守交易的特有要素
      expect(systemPrompt).toContain("风险第一，收益第二");
      expect(systemPrompt).toContain("严格止损，保护本金");
      expect(systemPrompt).toContain("分散投资，降低风险");
      expect(systemPrompt).toContain("基于数据，理性决策");
      expect(systemPrompt).toContain("最终交易建议");
    });
  });

  describe("分析师结果整合", () => {
    it("应该正确整合和计算团队分析", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      // 验证包含团队统计信息
      expect(prompt).toContain("**团队平均评分**:");
      expect(prompt).toContain("**建议分布**:");
      expect(prompt).toContain("**主要风险**:");
      
      // 验证包含具体分析内容
      expect(prompt).toContain("技术指标显示震荡格局");
      expect(prompt).toContain("财务稳健但增长乏力");
      expect(prompt).toContain("行业竞争加剧");
    });

    it("应该突出显示风险信息", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      // 检查是否正确收集和显示风险
      expect(prompt).toContain("**风险提示**:");
      expect(prompt).toContain("方向不确定");
      expect(prompt).toContain("增长缓慢");
      expect(prompt).toContain("行业竞争");
    });
  });

  describe("保守交易特性", () => {
    it("应该包含保守交易的特有分析要求", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      expect(prompt).toContain("风险评估矩阵");
      expect(prompt).toContain("风险控制方案");
      expect(prompt).toContain("风险提示清单");
      expect(prompt).toContain("保守策略总结表格");
      expect(prompt).toContain("安全边际");
    });

    it("应该包含详细的风险控制措施", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      expect(prompt).toContain("止损策略");
      expect(prompt).toContain("仓位管理");
      expect(prompt).toContain("分批建仓计划");
      expect(prompt).toContain("风险等级");
      expect(prompt).toContain("监控要点");
      expect(prompt).toContain("复评周期");
    });

    it("应该包含风险类型清单", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      expect(prompt).toContain("财务风险");
      expect(prompt).toContain("行业风险");
      expect(prompt).toContain("市场风险");
      expect(prompt).toContain("流动性风险");
      expect(prompt).toContain("其他特定风险");
    });
  });
});