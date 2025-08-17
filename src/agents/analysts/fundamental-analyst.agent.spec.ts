import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { FundamentalAnalystAgent } from "./fundamental-analyst.agent";
import { LLMService, DashScopeProvider } from "../services/llm.service";
import { DataToolkitService } from "../services/data-toolkit.service";
import {
  AgentType,
  AgentStatus,
  AgentContext,
  TradingRecommendation,
} from "../interfaces/agent.interface";

describe("FundamentalAnalystAgent - 真实LLM测试", () => {
  let agent: FundamentalAnalystAgent;
  let llmService: LLMService;
  let dataToolkit: DataToolkitService;
  let configService: ConfigService;

  const testContext: AgentContext = {
    stockCode: "000001",
    stockName: "平安银行",
    timeRange: {
      startDate: new Date("2025-05-01"),
      endDate: new Date("2025-08-15"),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FundamentalAnalystAgent,
        LLMService,
        DashScopeProvider,
        {
          provide: DataToolkitService,
          useValue: {
            getToolDefinitions: jest.fn().mockReturnValue([
              {
                name: "get_china_stock_data",
                description: "获取中国股票数据",
                parameters: { type: "object", properties: {} },
              },
              {
                name: "get_financial_data",
                description: "获取财务数据",
                parameters: { type: "object", properties: {} },
              },
            ]),
            executeTool: jest.fn().mockResolvedValue("模拟财务数据返回"),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  FUNDAMENTAL_ANALYST_MODEL: "qwen-max",
                  FUNDAMENTAL_ANALYST_TEMPERATURE: 0.6,
                  FUNDAMENTAL_ANALYST_MAX_TOKENS: 3000,
                  FUNDAMENTAL_ANALYST_TIMEOUT: 60,
                  FUNDAMENTAL_ANALYST_RETRY_COUNT: 3,
                  DASHSCOPE_PREMIUM_MODEL: "qwen-max",
                  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || "test-api-key",
                  LLM_PRIMARY_PROVIDER: "dashscope",
                  LLM_MAX_RETRIES: 3,
                };
                return config[key] ?? defaultValue;
              }),
          },
        },
      ],
    }).compile();

    agent = module.get<FundamentalAnalystAgent>(FundamentalAnalystAgent);
    llmService = module.get<LLMService>(LLMService);
    dataToolkit = module.get<DataToolkitService>(DataToolkitService);
    configService = module.get<ConfigService>(ConfigService);
  }, 60000);

  it("should be defined", () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe("基本面分析师");
    expect(agent.type).toBe(AgentType.FUNDAMENTAL_ANALYST);
    expect(agent.role).toBe("专业的基本面分析师，专注于公司财务和基本面研究");
  });

  describe("构造函数配置", () => {
    it("应该使用环境变量配置或默认值", () => {
      expect(configService.get).toHaveBeenCalledWith(
        "FUNDAMENTAL_ANALYST_MODEL",
        "qwen-max",
      );
      expect(configService.get).toHaveBeenCalledWith(
        "FUNDAMENTAL_ANALYST_TEMPERATURE",
        0.6,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "FUNDAMENTAL_ANALYST_MAX_TOKENS",
        3000,
      );
      expect(configService.get).toHaveBeenCalledWith(
        "FUNDAMENTAL_ANALYST_TIMEOUT",
        60,
      );
    });

    it("应该包含专业的系统提示词", () => {
      const systemPrompt = agent["config"].systemPrompt;

      expect(systemPrompt).toContain("基本面研究分析师");
      expect(systemPrompt).toContain("财务文档分析");
      expect(systemPrompt).toContain("资产负债表");
      expect(systemPrompt).toContain("利润表");
      expect(systemPrompt).toContain("现金流量表");
      expect(systemPrompt).toContain("PE、PB、ROE、ROA");
      expect(systemPrompt).toContain("内部人士情绪");
    });
  });

  describe("buildPrompt", () => {
    it("应该构建包含股票信息的完整提示词", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("请对股票 000001 (平安银行) 进行全面的基本面分析");
      expect(prompt).toContain("分析时间范围: 5/1/2025 到 8/15/2025");
      expect(prompt).toContain("第一步：数据收集");
      expect(prompt).toContain("get_china_stock_data");
      expect(prompt).toContain("get_financial_data");
      expect(prompt).toContain("get_company_info");
      expect(prompt).toContain("get_industry_data");
    });

    it("应该包含基本面分析框架", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("🏢 公司基本面分析");
      expect(prompt).toContain("业务模式与竞争优势");
      expect(prompt).toContain("财务健康度评估");
      expect(prompt).toContain("估值水平分析");
      expect(prompt).toContain("📈 行业与市场环境");
      expect(prompt).toContain("🔍 风险识别与评估");
      expect(prompt).toContain("🎯 投资评估结论");
    });

    it("应该包含评分和建议要求", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("**基本面评分**: [0-100分，必须给出具体分数]");
      expect(prompt).toContain("**投资建议**: [强烈买入/买入/持有/卖出/强烈卖出]");
      expect(prompt).toContain("**关键投资逻辑**: [3-5个核心论证点]");
      expect(prompt).toContain("**目标价位**: [基于估值分析的合理价位区间]");
    });

    it("应该包含关键指标汇总表格", async () => {
      const prompt = await agent["buildPrompt"](testContext);

      expect(prompt).toContain("📋 关键指标汇总表");
      expect(prompt).toContain("| 核心指标 | 数值 | 行业均值 | 评级 | 说明 |");
      expect(prompt).toContain("| 营收增长率 |");
      expect(prompt).toContain("| ROE |");
      expect(prompt).toContain("| PE 市盈率 |");
      expect(prompt).toContain("| 资产负债率 |");
    });

    it("应该处理没有股票名称的情况", async () => {
      const contextWithoutName = {
        ...testContext,
        stockName: undefined,
      };

      const prompt = await agent["buildPrompt"](contextWithoutName);

      expect(prompt).toContain("请对股票 000001 进行全面的基本面分析");
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

      // 验证时间范围是3个月
      const daysDiff = Math.floor(
        (result.timeRange!.endDate.getTime() -
          result.timeRange!.startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBeGreaterThanOrEqual(85); // 约3个月
      expect(daysDiff).toBeLessThanOrEqual(95);
    });

    it("应该保留已有的时间范围", async () => {
      const originalTimeRange = {
        startDate: new Date("2025-05-01"),
        endDate: new Date("2025-08-15"),
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
    it("应该成功执行完整的基本面分析流程(使用真实LLM)", async () => {
      console.log("开始进行真实LLM基本面分析测试...");
      
      try {
        const result = await agent.analyze(testContext);
        
        console.log("✅ 真实LLM基本面分析完成");
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
        expect(result.agentName).toBe("基本面分析师");
        expect(result.agentType).toBe(AgentType.FUNDAMENTAL_ANALYST);
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
        console.log("⚠️ 真实LLM基本面分析测试失败(可能是API密钥或网络问题):", error.message);
        
        // 如果是API密钥问题，验证错误处理是否正确
        if (error.message.includes("API") || error.message.includes("密钥")) {
          expect(agent.getStatus()).toBe(AgentStatus.ERROR);
        } else {
          throw error;
        }
      }
    }, 120000); // 基本面分析需要更长时间

    it("应该正确处理各种输入场景", async () => {
      console.log("测试基本面分析不同输入场景的处理能力...");
      
      // 测试最小输入
      const minimalContext: AgentContext = {
        stockCode: "000001",
        stockName: "平安银行",
      };
      
      try {
        const result = await agent.analyze(minimalContext);
        
        console.log("✅ 基本面分析最小输入场景处理成功");
        expect(result.agentName).toBe("基本面分析师");
        expect(result.analysis).toBeTruthy();
        expect(agent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ 基本面分析最小输入测试失败:", error.message);
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 60000);

    it("应该验证提示词构建的完整性", async () => {
      console.log("验证基本面分析提示词构建逻辑...");
      
      const prompt = await agent["buildPrompt"](testContext);
      
      console.log("提示词长度:", prompt.length);
      console.log("提示词开头:", prompt.substring(0, 300) + "...");
      
      // 验证提示词包含关键信息
      expect(prompt).toContain("000001");
      expect(prompt).toContain("平安银行");
      expect(prompt).toContain("基本面分析");
      expect(prompt).toContain("财务健康度评估");
      expect(prompt).toContain("估值水平分析");
      expect(prompt.length).toBeGreaterThan(2000); // 基本面分析提示词应该更详细
    });

    it("应该正确管理智能体状态", async () => {
      console.log("验证基本面分析智能体状态管理...");
      
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
        
        console.log("✅ 基本面分析智能体状态管理正确, 最终状态:", finalStatus);
      } catch (error) {
        console.log("⚠️ 基本面分析过程出错:", error.message);
        expect(agent.getStatus()).toBe(AgentStatus.ERROR);
      }
    }, 90000);
  });

  describe("配置验证", () => {
    it("应该正确设置分析师特定的配置", () => {
      expect(agent["config"].model).toBe("qwen-max");
      expect(agent["config"].temperature).toBe(0.6);
      expect(agent["config"].maxTokens).toBe(3000);
      expect(agent["config"].timeout).toBe(60);
      expect(agent["config"].retryCount).toBe(3);
    });

    it("应该有专业的系统提示词配置", () => {
      const systemPrompt = agent["config"].systemPrompt;

      // 验证提示词内容的专业性
      expect(systemPrompt).toContain("基本面研究分析师");
      expect(systemPrompt).toContain("财务文档分析");
      expect(systemPrompt).toContain("资产负债表");
      expect(systemPrompt).toContain("利润表");
      expect(systemPrompt).toContain("现金流量表");
      expect(systemPrompt).toContain("内部人士交易");
      
      // 验证分析要求
      expect(systemPrompt).toContain("明确的评分（0-100分）");
      expect(systemPrompt).toContain("交易建议");
      expect(systemPrompt).toContain("**买入/持有/卖出**");
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

      expect(daysDiff).toBeGreaterThanOrEqual(85); // 约3个月
      expect(daysDiff).toBeLessThanOrEqual(95);
      expect(endDate.getTime()).toBeLessThanOrEqual(now.getTime());
    });
  });
});