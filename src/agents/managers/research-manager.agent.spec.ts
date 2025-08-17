import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ResearchManagerAgent } from "./research-manager.agent";
import { LLMService, DashScopeProvider } from "../services/llm.service";
import {
  AgentType,
  AgentStatus,
  AgentContext,
  TradingRecommendation,
  AgentResult,
} from "../interfaces/agent.interface";

describe("ResearchManagerAgent - 真实LLM测试", () => {
  let agent: ResearchManagerAgent;
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
        score: 72,
        recommendation: TradingRecommendation.BUY,
        confidence: 0.8,
        analysis: "技术指标显示股票处于上升趋势，成交量放大确认",
        keyInsights: ["技术突破", "成交量放大"],
        timestamp: new Date(),
        processingTime: 5000,
      },
      {
        agentName: "基本面分析师",
        agentType: AgentType.FUNDAMENTAL_ANALYST,
        score: 68,
        recommendation: TradingRecommendation.HOLD,
        confidence: 0.75,
        analysis: "公司财务状况稳健，但估值偏高",
        keyInsights: ["财务稳健", "估值偏高"],
        timestamp: new Date(),
        processingTime: 6000,
      },
      {
        agentName: "多头研究员",
        agentType: AgentType.BULL_RESEARCHER,
        score: 78,
        recommendation: TradingRecommendation.STRONG_BUY,
        confidence: 0.85,
        analysis: "看好公司长期增长潜力和竞争优势",
        keyInsights: ["增长潜力", "竞争优势"],
        timestamp: new Date(),
        processingTime: 4500,
      },
      {
        agentName: "空头研究员",
        agentType: AgentType.BEAR_RESEARCHER,
        score: 45,
        recommendation: TradingRecommendation.SELL,
        confidence: 0.7,
        analysis: "担心行业竞争加剧和估值过高风险",
        risks: ["行业竞争", "估值风险"],
        timestamp: new Date(),
        processingTime: 5200,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResearchManagerAgent,
        LLMService,
        DashScopeProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  RESEARCH_MANAGER_MODEL: "qwen-max",
                  RESEARCH_MANAGER_TEMPERATURE: 0.7,
                  RESEARCH_MANAGER_MAX_TOKENS: 3000,
                  RESEARCH_MANAGER_TIMEOUT: 60,
                  RESEARCH_MANAGER_RETRY_COUNT: 3,
                  DASHSCOPE_PREMIUM_MODEL: "qwen-max",
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

    agent = module.get<ResearchManagerAgent>(ResearchManagerAgent);
    llmService = module.get<LLMService>(LLMService);
    configService = module.get<ConfigService>(ConfigService);
  }, 60000);

  it("should be defined", () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe("研究管理员");
    expect(agent.type).toBe(AgentType.RESEARCH_MANAGER);
    expect(agent.role).toBe("专业的投资组合经理和辩论协调员，负责评估多空辩论并制定投资计划");
  });

  describe("构造函数配置", () => {
    it("应该使用环境变量配置或默认值", () => {
      expect(configService.get).toHaveBeenCalledWith(
        "RESEARCH_MANAGER_MODEL",
        "qwen-max",
      );
      expect(configService.get).toHaveBeenCalledWith(
        "RESEARCH_MANAGER_TEMPERATURE",
        0.7,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "RESEARCH_MANAGER_MAX_TOKENS",
        3000,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "RESEARCH_MANAGER_TIMEOUT",
        60,
      );
    });

    it("应该包含专业的系统提示词", () => {
      const systemPrompt = agent["config"].systemPrompt;

      expect(systemPrompt).toContain("投资组合经理");
      expect(systemPrompt).toContain("辩论协调员");
      expect(systemPrompt).toContain("看跌分析师");
      expect(systemPrompt).toContain("看涨分析师");
      expect(systemPrompt).toContain("买入、卖出或持有");
      expect(systemPrompt).toContain("投资计划");
    });
  });

  describe("buildPrompt", () => {
    it("应该构建包含股票信息的完整提示词", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("请对股票 000001 (平安银行) 的多空辩论进行评估和决策");
      expect(prompt).toContain("## 分析师报告汇总");
    });

    it("应该包含各类分析师报告", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("### 市场研究报告");
      expect(prompt).toContain("### 基本面报告");
      expect(prompt).toContain("### 多头观点");
      expect(prompt).toContain("### 空头观点");
    });

    it("应该包含决策任务框架", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("## 决策任务");
      expect(prompt).toContain("### 1. 📊 辩论评估");
      expect(prompt).toContain("### 2. 🎯 投资决策");
      expect(prompt).toContain("### 3. 📋 投资计划制定");
      expect(prompt).toContain("### 4. 🔄 经验学习");
    });

    it("应该包含明确的决策要求", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("买入/持有/卖出（必须选择其一）");
      expect(prompt).toContain("避免因为双方都有道理就默认选择\"持有\"");
      expect(prompt).toContain("基于最强有力的证据做出果断决定");
    });

    it("应该处理没有分析师结果的情况", async () => {
      const contextWithoutResults = {
        ...testContext,
        previousResults: undefined,
      };

      const prompt = await agent["buildPrompt"](contextWithoutResults);

      expect(prompt).toContain("请对股票 000001");
      expect(prompt).toContain("## 决策任务");
    });
  });

  describe("preprocessContext", () => {
    it("应该为没有时间范围的上下文添加默认时间范围", async () => {
      const contextWithoutTimeRange = {
        stockCode: "000001",
        stockName: "平安银行",
        previousResults: testContext.previousResults,
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
      const result = await agent["preprocessContext"](testContext);
      expect(result.timeRange).toEqual(testContext.timeRange);
    });
  });

  describe("analyze 真实LLM集成测试", () => {
    it("应该成功执行完整的研究管理分析流程(使用真实LLM)", async () => {
      console.log("开始进行真实LLM研究管理分析测试...");
      
      try {
        const result = await agent.analyze(testContext);
        
        console.log("✅ 真实LLM研究管理分析完成");
        console.log("分析结果摘要:", {
          agentName: result.agentName,
          score: result.score,
          confidence: result.confidence,
          recommendation: result.recommendation,
          analysisLength: result.analysis?.length || 0,
          keyInsightsCount: result.keyInsights?.length || 0,
        });

        // 验证基本信息
        expect(result.agentName).toBe("研究管理员");
        expect(result.agentType).toBe(AgentType.RESEARCH_MANAGER);
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
        
        // 验证智能体状态
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 真实LLM研究管理分析测试失败(可能是API密钥或网络问题):", error.message);
        
        // 如果是API密钥问题，验证错误处理是否正确
        if (error.message.includes("API") || error.message.includes("密钥")) {
          expect(agent.getStatus()).toBe(AgentStatus.ERROR);
        } else {
          throw error;
        }
      }
    }, 120000);

    it("应该正确处理各种输入场景", async () => {
      console.log("测试研究管理分析不同输入场景的处理能力...");
      
      // 测试最小输入
      const minimalContext: AgentContext = {
        stockCode: "000001",
        stockName: "平安银行",
        previousResults: testContext.previousResults,
      };
      
      try {
        const result = await agent.analyze(minimalContext);
        
        console.log("✅ 研究管理分析最小输入场景处理成功");
        expect(result.agentName).toBe("研究管理员");
        expect(result.analysis).toBeTruthy();
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 研究管理分析最小输入测试失败:", error.message);
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 60000);

    it("应该验证提示词构建的完整性", async () => {
      console.log("验证研究管理分析提示词构建逻辑...");
      
      const prompt = await agent["buildPrompt"](testContext);
      
      console.log("提示词长度:", prompt.length);
      console.log("提示词开头:", prompt.substring(0, 300) + "...");
      
      // 验证提示词包含关键信息
      expect(prompt).toContain("000001");
      expect(prompt).toContain("平安银行");
      expect(prompt).toContain("多空辩论");
      expect(prompt).toContain("投资决策");
      expect(prompt).toContain("投资计划");
      expect(prompt.length).toBeGreaterThan(1500);
    });

    it("应该正确管理智能体状态", async () => {
      console.log("验证研究管理分析智能体状态管理...");
      
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
        
        console.log("✅ 研究管理分析智能体状态管理正确, 最终状态:", finalStatus);
      } catch (error) {
        console.log("⚠️ 研究管理分析过程出错:", error.message);
        expect(agent.getStatus()).toBe(AgentStatus.ERROR);
      }
    }, 90000);
  });

  describe("配置验证", () => {
    it("应该正确设置研究管理员特定的配置", () => {
      expect(agent["config"].model).toBe("qwen-max");
      expect(agent["config"].temperature).toBe(0.7);
      expect(agent["config"].maxTokens).toBe(3000);
      expect(agent["config"].timeout).toBe(60);
      expect(agent["config"].retryCount).toBe(3);
    });

    it("应该有专业的系统提示词配置", () => {
      const systemPrompt = agent["config"].systemPrompt;

      // 验证提示词内容的专业性
      expect(systemPrompt).toContain("投资组合经理");
      expect(systemPrompt).toContain("辩论协调员");
      expect(systemPrompt).toContain("明确的决定");
      
      // 验证决策指导原则
      expect(systemPrompt).toContain("最令人信服的证据");
      expect(systemPrompt).toContain("可操作");
      expect(systemPrompt).toContain("投资计划");
      expect(systemPrompt).toContain("战略行动");
    });
  });

  describe("分析师结果整合", () => {
    it("应该正确整合不同类型分析师的结果", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      // 验证包含所有分析师类型
      expect(prompt).toContain("市场研究报告");
      expect(prompt).toContain("基本面报告");
      expect(prompt).toContain("多头观点");
      expect(prompt).toContain("空头观点");
      
      // 验证包含具体分析内容
      expect(prompt).toContain("技术指标显示股票处于上升趋势");
      expect(prompt).toContain("公司财务状况稳健");
      expect(prompt).toContain("看好公司长期增长潜力");
      expect(prompt).toContain("担心行业竞争加剧");
    });

    it("应该处理缺少某些分析师结果的情况", async () => {
      const partialResults: AgentContext = {
        ...testContext,
        previousResults: testContext.previousResults!.slice(0, 2), // 只保留前两个结果
      };
      
      const prompt = await agent["buildPrompt"](partialResults);
      
      expect(prompt).toContain("市场研究报告");
      expect(prompt).toContain("基本面报告");
      expect(prompt).toContain("## 决策任务");
    });
  });
});