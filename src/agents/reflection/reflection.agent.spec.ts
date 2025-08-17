import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ReflectionAgent } from "./reflection.agent";
import { LLMService, DashScopeProvider } from "../services/llm.service";
import {
  AgentType,
  AgentStatus,
  AgentContext,
  TradingRecommendation,
  AgentResult,
} from "../interfaces/agent.interface";

describe("ReflectionAgent - 真实LLM测试", () => {
  let agent: ReflectionAgent;
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
        score: 75,
        recommendation: TradingRecommendation.BUY,
        confidence: 0.8,
        analysis: "技术指标显示股票处于强势上涨趋势，MACD金叉确认，成交量放大支撑价格上涨。建议短期内保持看多态度，但需关注阻力位。",
        keyInsights: ["技术突破", "成交量放大", "MACD金叉"],
        risks: ["阻力位压力", "短期回调"],
        timestamp: new Date(),
        processingTime: 5000,
        supportingData: {
          technicalScore: 82,
          trendStrength: "strong",
        },
      },
      {
        agentName: "基本面分析师",
        agentType: AgentType.FUNDAMENTAL_ANALYST,
        score: 68,
        recommendation: TradingRecommendation.HOLD,
        confidence: 0.75,
        analysis: "公司财务状况稳健，资产质量良好，但当前估值略显偏高。ROE稳定在合理水平，负债率控制良好，现金流充足。",
        keyInsights: ["财务稳健", "资产质量良好", "现金流充足"],
        risks: ["估值偏高", "行业竞争"],
        timestamp: new Date(),
        processingTime: 6000,
        supportingData: {
          fundamentalScore: 72,
          valuationRisk: "moderate",
        },
      },
      {
        agentName: "新闻分析师",
        agentType: AgentType.NEWS_ANALYST,
        score: 65,
        recommendation: TradingRecommendation.HOLD,
        confidence: 0.7,
        analysis: "近期新闻整体中性偏正面，监管政策稳定，但需关注行业整体环境变化和竞争格局调整的影响。",
        keyInsights: ["政策稳定", "整体中性"],
        risks: ["行业环境变化", "竞争格局调整"],
        timestamp: new Date(),
        processingTime: 4000,
      },
      {
        agentName: "多头研究员",
        agentType: AgentType.BULL_RESEARCHER,
        score: 78,
        recommendation: TradingRecommendation.STRONG_BUY,
        confidence: 0.85,
        analysis: "看好公司在数字化转型中的领先优势，新业务增长点明确，管理层执行力强，未来3年成长空间广阔。",
        keyInsights: ["数字化转型", "新业务增长", "管理层执行力"],
        timestamp: new Date(),
        processingTime: 4500,
      },
      {
        agentName: "空头研究员",
        agentType: AgentType.BEAR_RESEARCHER,
        score: 42,
        recommendation: TradingRecommendation.SELL,
        confidence: 0.7,
        analysis: "担心监管收紧对银行业务的影响，净息差压缩风险较大，资产质量在经济下行周期面临考验。",
        risks: ["监管收紧", "净息差压缩", "资产质量压力", "经济下行"],
        timestamp: new Date(),
        processingTime: 5200,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReflectionAgent,
        LLMService,
        DashScopeProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  REFLECTION_AGENT_MODEL: "qwen-plus",
                  REFLECTION_AGENT_TEMPERATURE: 0.4,
                  REFLECTION_AGENT_MAX_TOKENS: 3000,
                  REFLECTION_AGENT_TIMEOUT: 60,
                  REFLECTION_AGENT_RETRY_COUNT: 3,
                  DASHSCOPE_STANDARD_MODEL: "qwen-plus",
                  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || "test-api-key",
                  LLM_DEFAULT_TIMEOUT: 60,
                  LLM_PRIMARY_PROVIDER: "dashscope",
                  LLM_MAX_RETRIES: 3,
                };
                return config[key] ?? defaultValue;
              }),
          },
        },
      ],
    }).compile();

    agent = module.get<ReflectionAgent>(ReflectionAgent);
    llmService = module.get<LLMService>(LLMService);
    configService = module.get<ConfigService>(ConfigService);
  }, 60000);

  it("should be defined", () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe("反思智能体");
    expect(agent.type).toBe(AgentType.REFLECTION_AGENT);
    expect(agent.role).toBe("专业的反思分析师，负责质量控制和决策优化");
  });

  describe("构造函数配置", () => {
    it("应该使用环境变量配置或默认值", () => {
      expect(configService.get).toHaveBeenCalledWith(
        "REFLECTION_AGENT_MODEL",
        "qwen-plus",
      );
      expect(configService.get).toHaveBeenCalledWith(
        "REFLECTION_AGENT_TEMPERATURE",
        0.4,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "REFLECTION_AGENT_MAX_TOKENS",
        3000,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "REFLECTION_AGENT_TIMEOUT",
        60,
      );
    });

    it("应该包含专业的系统提示词", () => {
      const systemPrompt = agent["config"].systemPrompt;

      expect(systemPrompt).toContain("金融分析专家");
      expect(systemPrompt).toContain("交易决策");
      expect(systemPrompt).toContain("逐步分析");
      expect(systemPrompt).toContain("推理分析");
      expect(systemPrompt).toContain("改进建议");
      expect(systemPrompt).toContain("经验总结");
      expect(systemPrompt).toContain("关键洞察提取");
    });
  });

  describe("buildPrompt", () => {
    it("应该构建包含股票信息的完整提示词", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("作为反思智能体，请对股票 000001 (平安银行) 的团队分析进行全面的质量控制和反思评估");
      expect(prompt).toContain("## 团队分析师完整报告");
    });

    it("应该包含所有分析师的详细报告", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("### 1. 市场分析师报告");
      expect(prompt).toContain("### 2. 基本面分析师报告");
      expect(prompt).toContain("### 3. 新闻分析师报告");
      expect(prompt).toContain("### 4. 多头研究员报告");
      expect(prompt).toContain("### 5. 空头研究员报告");
    });

    it("应该包含反思分析框架", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("## 请进行全面的反思分析");
      expect(prompt).toContain("### 1. 分析质量评估");
      expect(prompt).toContain("### 2. 逻辑一致性检查");
      expect(prompt).toContain("### 3. 决策质量分析");
      expect(prompt).toContain("### 4. 关键分歧点分析");
      expect(prompt).toContain("### 5. 改进建议");
      expect(prompt).toContain("### 6. 综合评估与建议");
      expect(prompt).toContain("### 7. 经验教训总结");
    });

    it("应该包含详细的评估维度", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("分析全面性");
      expect(prompt).toContain("逻辑严密性");
      expect(prompt).toContain("数据可靠性");
      expect(prompt).toContain("风险识别");
      expect(prompt).toContain("机会把握");
      expect(prompt).toContain("时机判断");
      expect(prompt).toContain("实操性");
    });

    it("应该包含支撑数据的展示", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("**支撑数据**: {");
      expect(prompt).toContain("technicalScore");
      expect(prompt).toContain("fundamentalScore");
    });

    it("应该处理没有分析师结果的情况", async () => {
      const contextWithoutResults = {
        ...testContext,
        previousResults: undefined,
      };

      const prompt = await agent["buildPrompt"](contextWithoutResults);

      expect(prompt).toContain("作为反思智能体");
      expect(prompt).toContain("## 请进行全面的反思分析");
    });
  });

  describe("postprocessResult", () => {
    it("应该正确提取团队评分", async () => {
      const analysisWithTeamScore = `
团队分析完成，整体评分：78分。
基于综合分析，团队表现良好。
`;
      
      const result = await agent["postprocessResult"](
        analysisWithTeamScore,
        testContext,
      );
      
      expect(result.supportingData?.teamScore).toBe(78);
    });

    it("应该正确提取反思后的最终建议", async () => {
      const analysisWithRecommendation = `
经过反思分析，反思后建议：买入
理由充分，建议可行。
`;
      
      const result = await agent["postprocessResult"](
        analysisWithRecommendation,
        testContext,
      );
      
      expect(result.recommendation).toBe(TradingRecommendation.BUY);
    });

    it("应该正确提取关键洞察", async () => {
      const analysisWithInsights = `
### 9. 关键洞察提取
1. [技术面分析准确度高]
2. [基本面估值需谨慎]
3. [团队协作效果良好]
`;
      
      const result = await agent["postprocessResult"](
        analysisWithInsights,
        testContext,
      );
      
      expect(result.keyInsights).toContain("技术面分析准确度高");
      expect(result.keyInsights).toContain("基本面估值需谨慎");
      expect(result.keyInsights).toContain("团队协作效果良好");
    });

    it("应该计算团队一致性和置信度", async () => {
      const result = await agent["postprocessResult"](
        "反思分析完成",
        testContext,
      );
      
      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      
      expect(result.supportingData?.teamConsistency).toBeDefined();
      expect(result.supportingData?.teamConsistency.recommendationConsistency).toBeDefined();
      expect(result.supportingData?.teamConsistency.scoreConsistency).toBeDefined();
    });
  });

  describe("analyze 真实LLM集成测试", () => {
    it("应该成功执行完整的反思分析流程(使用真实LLM)", async () => {
      console.log("开始进行真实LLM反思分析测试...");
      
      try {
        const result = await agent.analyze(testContext);
        
        console.log("✅ 真实LLM反思分析完成");
        console.log("分析结果摘要:", {
          agentName: result.agentName,
          score: result.score,
          confidence: result.confidence,
          recommendation: result.recommendation,
          analysisLength: result.analysis?.length || 0,
          keyInsightsCount: result.keyInsights?.length || 0,
          teamScore: result.supportingData?.teamScore,
        });

        // 验证基本信息
        expect(result.agentName).toBe("反思智能体");
        expect(result.agentType).toBe(AgentType.REFLECTION_AGENT);
        expect(result.timestamp).toBeDefined();
        expect(result.processingTime).toBeGreaterThan(0);
        
        // 验证分析内容不为空
        expect(result.analysis).toBeTruthy();
        expect(result.analysis.length).toBeGreaterThan(200);
        
        // 验证结构化信息的合理性
        expect(typeof result.score).toBe("number");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        
        expect(typeof result.confidence).toBe("number");
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        
        expect(Object.values(TradingRecommendation)).toContain(result.recommendation);
        
        // 验证反思特有的输出
        expect(result.keyInsights).toBeDefined();
        if (result.keyInsights) {
          expect(result.keyInsights.length).toBeGreaterThan(0);
        }
        
        // 验证团队一致性分析
        expect(result.supportingData?.teamConsistency).toBeDefined();
        
        // 验证智能体状态
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 真实LLM反思分析测试失败(可能是API密钥或网络问题):", error.message);
        
        // 如果是API密钥问题，验证错误处理是否正确
        if (error.message.includes("API") || error.message.includes("密钥")) {
          expect(agent.getStatus()).toBe(AgentStatus.ERROR);
        } else {
          throw error;
        }
      }
    }, 120000);

    it("应该正确处理各种输入场景", async () => {
      console.log("测试反思分析不同输入场景的处理能力...");
      
      // 测试最小输入
      const minimalContext: AgentContext = {
        stockCode: "000001",
        stockName: "平安银行",
        previousResults: testContext.previousResults,
      };
      
      try {
        const result = await agent.analyze(minimalContext);
        
        console.log("✅ 反思分析最小输入场景处理成功");
        expect(result.agentName).toBe("反思智能体");
        expect(result.analysis).toBeTruthy();
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 反思分析最小输入测试失败:", error.message);
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 60000);

    it("应该验证提示词构建的完整性", async () => {
      console.log("验证反思分析提示词构建逻辑...");
      
      const prompt = await agent["buildPrompt"](testContext);
      
      console.log("提示词长度:", prompt.length);
      console.log("提示词开头:", prompt.substring(0, 300) + "...");
      
      // 验证提示词包含关键信息
      expect(prompt).toContain("000001");
      expect(prompt).toContain("平安银行");
      expect(prompt).toContain("反思智能体");
      expect(prompt).toContain("质量控制");
      expect(prompt).toContain("分析质量评估");
      expect(prompt).toContain("逻辑一致性检查");
      expect(prompt.length).toBeGreaterThan(5000);
    });

    it("应该正确管理智能体状态", async () => {
      console.log("验证反思分析智能体状态管理...");
      
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
        
        console.log("✅ 反思分析智能体状态管理正确, 最终状态:", finalStatus);
      } catch (error) {
        console.log("⚠️ 反思分析过程出错:", error.message);
        expect(agent.getStatus()).toBe(AgentStatus.ERROR);
      }
    }, 90000);
  });

  describe("配置验证", () => {
    it("应该正确设置反思智能体特定的配置", () => {
      expect(agent["config"].model).toBe("qwen-plus");
      expect(agent["config"].temperature).toBe(0.4); // 反思需要更理性和客观
      expect(agent["config"].maxTokens).toBe(3000);
      expect(agent["config"].timeout).toBe(60);
      expect(agent["config"].retryCount).toBe(3);
    });

    it("应该有专业的系统提示词配置", () => {
      const systemPrompt = agent["config"].systemPrompt;

      // 验证提示词内容的专业性
      expect(systemPrompt).toContain("金融分析专家");
      expect(systemPrompt).toContain("交易决策");
      expect(systemPrompt).toContain("质量控制");
      
      // 验证反思分析的关键要素
      expect(systemPrompt).toContain("推理分析");
      expect(systemPrompt).toContain("改进建议");
      expect(systemPrompt).toContain("经验总结");
      expect(systemPrompt).toContain("关键洞察提取");
      expect(systemPrompt).toContain("1000个token");
    });
  });

  describe("团队分析整合", () => {
    it("应该正确整合所有分析师的详细报告", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      // 验证包含所有分析师的详细信息
      expect(prompt).toContain("**评分**: 75");
      expect(prompt).toContain("**建议**: STRONG_BUY");
      expect(prompt).toContain("**置信度**: 85.0%");
      expect(prompt).toContain("**处理时间**: 5000ms");
      
      // 验证包含关键洞察和风险提示
      expect(prompt).toContain("**关键洞察**:");
      expect(prompt).toContain("**风险提示**:");
      
      // 验证包含支撑数据
      expect(prompt).toContain("**支撑数据**: {");
    });

    it("应该处理部分分析师结果缺失的情况", async () => {
      const partialResults: AgentContext = {
        ...testContext,
        previousResults: testContext.previousResults!.slice(0, 3), // 只保留前三个结果
      };
      
      const prompt = await agent["buildPrompt"](partialResults);
      
      expect(prompt).toContain("### 1. 市场分析师报告");
      expect(prompt).toContain("### 2. 基本面分析师报告");
      expect(prompt).toContain("### 3. 新闻分析师报告");
      expect(prompt).toContain("## 请进行全面的反思分析");
    });
  });

  describe("getMostCommon 工具方法", () => {
    it("应该正确识别最常出现的元素", () => {
      const testArray = ["BUY", "HOLD", "BUY", "SELL", "BUY"];
      const result = agent["getMostCommon"](testArray);
      expect(result).toBe("BUY");
    });

    it("应该处理空数组", () => {
      const testArray: string[] = [];
      expect(() => agent["getMostCommon"](testArray)).not.toThrow();
    });

    it("应该处理单个元素", () => {
      const testArray = ["BUY"];
      const result = agent["getMostCommon"](testArray);
      expect(result).toBe("BUY");
    });
  });
});