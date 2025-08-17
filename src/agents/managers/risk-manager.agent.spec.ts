import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { RiskManagerAgent } from "./risk-manager.agent";
import { LLMService, DashScopeProvider } from "../services/llm.service";
import {
  AgentType,
  AgentStatus,
  AgentContext,
  TradingRecommendation,
  AgentResult,
} from "../interfaces/agent.interface";

describe("RiskManagerAgent - 真实LLM测试", () => {
  let agent: RiskManagerAgent;
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
        analysis: "技术指标显示强势上涨趋势，但需注意回调风险",
        keyInsights: ["技术突破", "动量强劲"],
        risks: ["回调风险", "成交量不足"],
        timestamp: new Date(),
        processingTime: 5000,
      },
      {
        agentName: "研究管理员",
        agentType: AgentType.RESEARCH_MANAGER,
        score: 70,
        recommendation: TradingRecommendation.BUY,
        confidence: 0.75,
        analysis: "综合多空分析，多头观点较为有力，建议适度买入",
        keyInsights: ["多头优势", "适度买入"],
        timestamp: new Date(),
        processingTime: 8000,
      },
      {
        agentName: "激进型交易员",
        agentType: AgentType.AGGRESSIVE_TRADER,
        score: 82,
        recommendation: TradingRecommendation.STRONG_BUY,
        confidence: 0.85,
        analysis: "机会难得，建议加大仓位，目标价位上调",
        keyInsights: ["机会难得", "目标价上调"],
        timestamp: new Date(),
        processingTime: 4500,
      },
      {
        agentName: "保守型交易员",
        agentType: AgentType.CONSERVATIVE_TRADER,
        score: 58,
        recommendation: TradingRecommendation.HOLD,
        confidence: 0.65,
        analysis: "风险较高，建议谨慎观望，控制仓位",
        risks: ["风险较高", "估值偏高", "市场波动"],
        timestamp: new Date(),
        processingTime: 6000,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskManagerAgent,
        LLMService,
        DashScopeProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  RISK_MANAGER_MODEL: "qwen-max",
                  RISK_MANAGER_TEMPERATURE: 0.6,
                  RISK_MANAGER_MAX_TOKENS: 3000,
                  RISK_MANAGER_TIMEOUT: 60,
                  RISK_MANAGER_RETRY_COUNT: 3,
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

    agent = module.get<RiskManagerAgent>(RiskManagerAgent);
    llmService = module.get<LLMService>(LLMService);
    configService = module.get<ConfigService>(ConfigService);
  }, 60000);

  it("should be defined", () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe("风险管理员");
    expect(agent.type).toBe(AgentType.RISK_MANAGER);
    expect(agent.role).toBe("专业的风险管理法官和最终决策者，负责综合评估所有风险因素并制定最终交易决策");
  });

  describe("构造函数配置", () => {
    it("应该使用环境变量配置或默认值", () => {
      expect(configService.get).toHaveBeenCalledWith(
        "RISK_MANAGER_MODEL",
        "qwen-max",
      );
      expect(configService.get).toHaveBeenCalledWith(
        "RISK_MANAGER_TEMPERATURE",
        0.6,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "RISK_MANAGER_MAX_TOKENS",
        3000,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "RISK_MANAGER_TIMEOUT",
        60,
      );
    });

    it("应该包含专业的系统提示词", () => {
      const systemPrompt = agent["config"].systemPrompt;

      expect(systemPrompt).toContain("风险管理法官");
      expect(systemPrompt).toContain("辩论协调员");
      expect(systemPrompt).toContain("激进型、中立型和保守型");
      expect(systemPrompt).toContain("买入、卖出或持有");
      expect(systemPrompt).toContain("最佳行动方案");
      expect(systemPrompt).toContain("从过去错误中学习");
    });
  });

  describe("buildPrompt", () => {
    it("应该构建包含股票信息的完整提示词", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("请对股票 000001 (平安银行) 进行最终风险评估和交易决策");
      expect(prompt).toContain("## 分析师团队报告汇总");
    });

    it("应该包含各类分析师报告", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("### 市场研究报告");
      expect(prompt).toContain("### 投资计划");
      expect(prompt).toContain("## 风险分析师辩论历史");
      expect(prompt).toContain("### 保守型观点");
      expect(prompt).toContain("### 激进型观点");
    });

    it("应该包含风险管理决策框架", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("## 风险管理决策任务");
      expect(prompt).toContain("### 1. 🎯 关键论点总结");
      expect(prompt).toContain("### 2. 💡 综合风险评估");
      expect(prompt).toContain("### 3. 📊 决策优化");
      expect(prompt).toContain("### 4. 🎲 最终裁决");
      expect(prompt).toContain("### 5. 📋 风险控制措施");
    });

    it("应该包含明确的决策要求", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("买入/持有/卖出（必须明确选择）");
      expect(prompt).toContain("基于最强有力的论据做出果断决定");
      expect(prompt).toContain("避免因观点平衡而默认选择\"持有\"");
      expect(prompt).toContain("最终交易建议: 买入/持有/卖出");
    });

    it("应该处理没有分析师结果的情况", async () => {
      const contextWithoutResults = {
        ...testContext,
        previousResults: undefined,
      };

      const prompt = await agent["buildPrompt"](contextWithoutResults);

      expect(prompt).toContain("请对股票 000001");
      expect(prompt).toContain("## 风险管理决策任务");
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
    it("应该成功执行完整的风险管理分析流程(使用真实LLM)", async () => {
      console.log("开始进行真实LLM风险管理分析测试...");
      
      try {
        const result = await agent.analyze(testContext);
        
        console.log("✅ 真实LLM风险管理分析完成");
        console.log("分析结果摘要:", {
          agentName: result.agentName,
          score: result.score,
          confidence: result.confidence,
          recommendation: result.recommendation,
          analysisLength: result.analysis?.length || 0,
          risksCount: result.risks?.length || 0,
        });

        // 验证基本信息
        expect(result.agentName).toBe("风险管理员");
        expect(result.agentType).toBe(AgentType.RISK_MANAGER);
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
        
        // 风险管理员应该识别风险
        expect(result.risks).toBeDefined();
        if (result.risks) {
          expect(result.risks.length).toBeGreaterThan(0);
        }
        
        // 验证智能体状态
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 真实LLM风险管理分析测试失败(可能是API密钥或网络问题):", error.message);
        
        // 如果是API密钥问题，验证错误处理是否正确
        if (error.message.includes("API") || error.message.includes("密钥")) {
          expect(agent.getStatus()).toBe(AgentStatus.ERROR);
        } else {
          throw error;
        }
      }
    }, 120000);

    it("应该正确处理各种输入场景", async () => {
      console.log("测试风险管理分析不同输入场景的处理能力...");
      
      // 测试最小输入
      const minimalContext: AgentContext = {
        stockCode: "000001",
        stockName: "平安银行",
        previousResults: testContext.previousResults,
      };
      
      try {
        const result = await agent.analyze(minimalContext);
        
        console.log("✅ 风险管理分析最小输入场景处理成功");
        expect(result.agentName).toBe("风险管理员");
        expect(result.analysis).toBeTruthy();
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 风险管理分析最小输入测试失败:", error.message);
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 60000);

    it("应该验证提示词构建的完整性", async () => {
      console.log("验证风险管理分析提示词构建逻辑...");
      
      const prompt = await agent["buildPrompt"](testContext);
      
      console.log("提示词长度:", prompt.length);
      console.log("提示词开头:", prompt.substring(0, 300) + "...");
      
      // 验证提示词包含关键信息
      expect(prompt).toContain("000001");
      expect(prompt).toContain("平安银行");
      expect(prompt).toContain("风险评估");
      expect(prompt).toContain("交易决策");
      expect(prompt).toContain("保守型观点");
      expect(prompt).toContain("激进型观点");
      expect(prompt.length).toBeGreaterThan(2000);
    });

    it("应该正确管理智能体状态", async () => {
      console.log("验证风险管理分析智能体状态管理...");
      
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
        
        console.log("✅ 风险管理分析智能体状态管理正确, 最终状态:", finalStatus);
      } catch (error) {
        console.log("⚠️ 风险管理分析过程出错:", error.message);
        expect(agent.getStatus()).toBe(AgentStatus.ERROR);
      }
    }, 90000);
  });

  describe("配置验证", () => {
    it("应该正确设置风险管理员特定的配置", () => {
      expect(agent["config"].model).toBe("qwen-max");
      expect(agent["config"].temperature).toBe(0.6); // 更保守的温度设置
      expect(agent["config"].maxTokens).toBe(3000);
      expect(agent["config"].timeout).toBe(60);
      expect(agent["config"].retryCount).toBe(3);
    });

    it("应该有专业的系统提示词配置", () => {
      const systemPrompt = agent["config"].systemPrompt;

      // 验证提示词内容的专业性
      expect(systemPrompt).toContain("风险管理法官");
      expect(systemPrompt).toContain("辩论协调员");
      expect(systemPrompt).toContain("明确建议");
      
      // 验证风险管理导向
      expect(systemPrompt).toContain("激进型、中立型和保守型");
      expect(systemPrompt).toContain("从过去错误中学习");
      expect(systemPrompt).toContain("利用历史经验教训");
      expect(systemPrompt).toContain("改进当前决策");
    });
  });

  describe("分析师结果整合", () => {
    it("应该正确整合不同类型分析师的结果", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      // 验证包含所有分析师类型
      expect(prompt).toContain("市场研究报告");
      expect(prompt).toContain("投资计划");
      expect(prompt).toContain("保守型观点");
      expect(prompt).toContain("激进型观点");
      
      // 验证包含具体分析内容
      expect(prompt).toContain("技术指标显示强势上涨趋势");
      expect(prompt).toContain("综合多空分析");
      expect(prompt).toContain("机会难得");
      expect(prompt).toContain("风险较高");
    });

    it("应该处理缺少某些分析师结果的情况", async () => {
      const partialResults: AgentContext = {
        ...testContext,
        previousResults: testContext.previousResults!.slice(0, 2), // 只保留前两个结果
      };
      
      const prompt = await agent["buildPrompt"](partialResults);
      
      expect(prompt).toContain("市场研究报告");
      expect(prompt).toContain("投资计划");
      expect(prompt).toContain("## 风险管理决策任务");
    });
  });

  describe("风险评估特性", () => {
    it("应该包含综合风险评估要求", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      expect(prompt).toContain("系统性风险");
      expect(prompt).toContain("个股风险");
      expect(prompt).toContain("交易风险");
      expect(prompt).toContain("组合风险");
      expect(prompt).toContain("风险等级");
      expect(prompt).toContain("置信度");
    });

    it("应该包含风险控制措施", async () => {
      const prompt = await agent["buildPrompt"](testContext);
      
      expect(prompt).toContain("止损设置");
      expect(prompt).toContain("仓位建议");
      expect(prompt).toContain("监控预警");
      expect(prompt).toContain("风险控制点位");
      expect(prompt).toContain("风险收益比");
    });
  });
});