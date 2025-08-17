import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { BaseAgent } from "./base-agent";
import {
  IAgent,
  AgentType,
  AgentStatus,
  AgentContext,
  AgentResult,
  AgentConfig,
  TradingRecommendation,
} from "../interfaces/agent.interface";
import { LLMService, LLMResponse, DashScopeProvider } from "../services/llm.service";
import { DataToolkitService } from "../services/data-toolkit.service";
import { ConfigService } from "@nestjs/config";

// 创建具体的测试智能体类
class TestAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    dataToolkit?: DataToolkitService,
    config: Partial<AgentConfig> = {},
  ) {
    super(
      "测试智能体",
      AgentType.MARKET_ANALYST,
      "用于单元测试的智能体",
      llmService,
      dataToolkit,
      config,
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    return `请分析股票 ${context.stockCode} (${context.stockName || "未知"})`;
  }

  // 暴露受保护的方法用于测试
  public async testCallLLM(prompt: string): Promise<string> {
    return this.callLLM(prompt);
  }

  public async testCallLLMWithTools(
    prompt: string,
    tools: any[],
  ): Promise<LLMResponse> {
    return this.callLLMWithTools(prompt, tools);
  }

  public async testProcessToolCalls(
    llmResponse: LLMResponse,
    context: AgentContext,
  ): Promise<LLMResponse> {
    return this.processToolCalls(llmResponse, context);
  }

  public testExtractScore(analysis: string): number {
    return this.extractScore(analysis);
  }

  public testExtractConfidence(analysis: string): number {
    return this.extractConfidence(analysis);
  }

  public testExtractRecommendation(analysis: string): TradingRecommendation {
    return this.extractRecommendation(analysis);
  }

  public testExtractKeyInsights(analysis: string): string[] {
    return this.extractKeyInsights(analysis);
  }

  public testExtractRisks(analysis: string): string[] {
    return this.extractRisks(analysis);
  }

  public testValidateResult(result: AgentResult): boolean {
    return this.validateResult(result);
  }

  public testFormatResult(result: AgentResult): string {
    return this.formatResult(result);
  }
}

describe("BaseAgent - 真实LLM测试", () => {
  let agent: TestAgent;
  let llmService: LLMService;
  let dataToolkit: DataToolkitService;

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
        RSI: 65.5,
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMService,
        DashScopeProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || "test-api-key",
                LLM_PRIMARY_PROVIDER: "dashscope",
                DASHSCOPE_STANDARD_MODEL: "qwen-plus",
                LLM_DEFAULT_TEMPERATURE: 0.7,
                LLM_DEFAULT_MAX_TOKENS: 2000,
                LLM_DEFAULT_TIMEOUT: 30,
                LLM_MAX_RETRIES: 3,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: DataToolkitService,
          useValue: {
            getToolDefinitions: jest.fn(),
            executeTool: jest.fn(),
          },
        },
      ],
    }).compile();

    llmService = module.get<LLMService>(LLMService);
    dataToolkit = module.get<DataToolkitService>(DataToolkitService);

    agent = new TestAgent(llmService, dataToolkit);
  }, 60000);

  it("should be defined", () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe("测试智能体");
    expect(agent.type).toBe(AgentType.MARKET_ANALYST);
    expect(agent.role).toBe("用于单元测试的智能体");
  });

  describe("构造函数", () => {
    it("应该正确初始化默认配置", () => {
      const testAgent = new TestAgent(llmService);
      expect(testAgent.getStatus()).toBe(AgentStatus.IDLE);
      expect(testAgent["config"].model).toBe("qwen-plus");
      expect(testAgent["config"].temperature).toBe(0.7);
      expect(testAgent["config"].maxTokens).toBe(2000);
      expect(testAgent["config"].timeout).toBe(30);
      expect(testAgent["config"].retryCount).toBe(3);
    });

    it("应该正确合并自定义配置", () => {
      const customConfig: Partial<AgentConfig> = {
        model: "qwen-max",
        temperature: 0.5,
        maxTokens: 3000,
        systemPrompt: "自定义系统提示词",
      };

      const testAgent = new TestAgent(llmService, undefined, customConfig);
      expect(testAgent["config"].model).toBe("qwen-max");
      expect(testAgent["config"].temperature).toBe(0.5);
      expect(testAgent["config"].maxTokens).toBe(3000);
      expect(testAgent["config"].systemPrompt).toBe("自定义系统提示词");
      expect(testAgent["config"].timeout).toBe(30); // 应该保留默认值
    });
  });

  describe("analyze", () => {
    it("应该成功执行完整的分析流程（使用真实LLM）", async () => {
      console.log("开始BaseAgent真实LLM测试...");
      
      const testAgent = new TestAgent(llmService); // 不传入 dataToolkit

      try {
        const result = await testAgent.analyze(testContext);
        
        console.log("✅ BaseAgent真实LLM分析完成");
        console.log("分析结果摘要:", {
          agentName: result.agentName,
          score: result.score,
          confidence: result.confidence,
          recommendation: result.recommendation,
          analysisLength: result.analysis?.length || 0,
        });

        expect(result.agentName).toBe("测试智能体");
        expect(result.agentType).toBe(AgentType.MARKET_ANALYST);
        expect(result.analysis).toBeTruthy();
        expect(result.analysis.length).toBeGreaterThan(10);
        expect(result.timestamp).toBeDefined();
        expect(result.processingTime).toBeGreaterThan(0);
        expect(testAgent.getStatus()).toBe(AgentStatus.COMPLETED);
        
      } catch (error) {
        console.log("⚠️ BaseAgent真实LLM测试失败(可能是API密钥或网络问题):", error.message);
        
        // 如果是API密钥问题，验证错误处理是否正确
        if (error.message.includes("API") || error.message.includes("密钥")) {
          expect(testAgent.getStatus()).toBe(AgentStatus.ERROR);
        } else {
          throw error;
        }
      }
    }, 60000);

    it("应该成功执行模拟的分析流程（测试流程逻辑）", async () => {
      const testAgent = new TestAgent(llmService); // 不传入 dataToolkit

      jest
        .spyOn(llmService, "generate")
        .mockResolvedValue(
          "技术分析结果：股票表现良好，评分：75分，建议：买入，置信度：0.8",
        );

      const result = await testAgent.analyze(testContext);

      expect(result.agentName).toBe("测试智能体");
      expect(result.agentType).toBe(AgentType.MARKET_ANALYST);
      expect(result.analysis).toContain("技术分析结果");
      expect(result.score).toBe(75);
      expect(result.confidence).toBe(0.8);
      expect(result.recommendation).toBe(TradingRecommendation.BUY);
      expect(result.timestamp).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
      expect(testAgent.getStatus()).toBe(AgentStatus.COMPLETED);
    });

    it("应该成功执行带工具调用的分析流程", async () => {
      const mockTools = [
        {
          type: "function",
          function: {
            name: "get_china_stock_data",
            description: "获取股票数据",
            parameters: {},
          },
        },
      ];

      const mockLLMResponse: LLMResponse = {
        content: "我需要获取股票数据来进行分析",
        toolCalls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "get_china_stock_data",
              arguments:
                '{"stock_code": "000001", "start_date": "2025-08-01", "end_date": "2025-08-15"}',
            },
          },
        ],
      };

      const mockToolResult = "股票数据获取成功：当前价格12.50元，涨幅2.04%";

      jest.spyOn(dataToolkit, "getToolDefinitions").mockReturnValue(mockTools);
      jest
        .spyOn(llmService, "generateWithTools")
        .mockResolvedValue(mockLLMResponse);
      jest.spyOn(dataToolkit, "executeTool").mockResolvedValue(mockToolResult);

      const result = await agent.analyze(testContext);

      expect(result.analysis).toContain("我需要获取股票数据来进行分析");
      expect(result.analysis).toContain("数据获取结果 - get_china_stock_data");
      expect(result.analysis).toContain(mockToolResult);
      expect(dataToolkit.executeTool).toHaveBeenCalledWith(
        "get_china_stock_data",
        {
          stock_code: "000001",
          start_date: "2025-08-01",
          end_date: "2025-08-15",
        },
      );
    });

    it("应该处理分析过程中的错误", async () => {
      jest
        .spyOn(llmService, "generate")
        .mockRejectedValue(new Error("LLM服务不可用"));

      const result = await agent.analyze(testContext);

      expect(result.analysis).toContain("分析过程中发生错误: LLM服务不可用");
      expect(result.score).toBe(0);
      expect(result.confidence).toBe(0);
      expect(result.recommendation).toBe(TradingRecommendation.HOLD);
      expect(result.risks).toContain("系统错误: LLM服务不可用");
      expect(agent.getStatus()).toBe(AgentStatus.ERROR);
    });

    it("应该处理工具调用执行失败", async () => {
      const mockTools = [
        {
          type: "function",
          function: {
            name: "get_china_stock_data",
            description: "获取股票数据",
            parameters: {},
          },
        },
      ];

      const mockLLMResponse: LLMResponse = {
        content: "需要获取股票数据",
        toolCalls: [
          {
            id: "call_456",
            type: "function",
            function: {
              name: "get_china_stock_data",
              arguments: '{"stock_code": "000001"}',
            },
          },
        ],
      };

      jest.spyOn(dataToolkit, "getToolDefinitions").mockReturnValue(mockTools);
      jest
        .spyOn(llmService, "generateWithTools")
        .mockResolvedValue(mockLLMResponse);
      jest
        .spyOn(dataToolkit, "executeTool")
        .mockRejectedValue(new Error("数据获取失败"));

      const result = await agent.analyze(testContext);

      expect(result.analysis).toContain(
        "工具调用失败 (get_china_stock_data): 数据获取失败",
      );
    });
  });

  describe("callLLM with retry logic", () => {
    it("应该在重试后成功", async () => {
      jest
        .spyOn(llmService, "generate")
        .mockRejectedValueOnce(new Error("临时错误"))
        .mockRejectedValueOnce(new Error("再次临时错误"))
        .mockResolvedValueOnce("成功的响应");

      const result = await agent.testCallLLM("测试提示词");

      expect(result).toBe("成功的响应");
      expect(llmService.generate).toHaveBeenCalledTimes(3);
    });

    it("应该在达到最大重试次数后抛出错误", async () => {
      jest
        .spyOn(llmService, "generate")
        .mockRejectedValue(new Error("持续错误"));

      await expect(agent.testCallLLM("测试提示词")).rejects.toThrow("持续错误");

      expect(llmService.generate).toHaveBeenCalledTimes(3); // 默认重试3次
    });

    it("应该使用系统提示词", async () => {
      const agentWithSystemPrompt = new TestAgent(llmService, undefined, {
        systemPrompt: "你是一个专业的分析师",
      });

      jest.spyOn(llmService, "generate").mockResolvedValue("测试响应");

      await agentWithSystemPrompt.testCallLLM("用户提示词");

      expect(llmService.generate).toHaveBeenCalledWith(
        "你是一个专业的分析师\n\n用户提示词",
        expect.any(Object),
      );
    });
  });

  describe("processToolCalls", () => {
    const testContext: AgentContext = {
      stockCode: "000001",
      stockName: "平安银行",
    };

    it("应该处理没有工具调用的响应", async () => {
      const llmResponse: LLMResponse = {
        content: "普通分析结果",
      };

      const result = await agent.testProcessToolCalls(llmResponse, testContext);

      expect(result).toEqual(llmResponse);
    });

    it("应该处理空的工具调用数组", async () => {
      const llmResponse: LLMResponse = {
        content: "分析结果",
        toolCalls: [],
      };

      const result = await agent.testProcessToolCalls(llmResponse, testContext);

      expect(result).toEqual(llmResponse);
    });

    it("应该成功执行工具调用并增强内容", async () => {
      const llmResponse: LLMResponse = {
        content: "需要获取数据",
        toolCalls: [
          {
            id: "call_789",
            type: "function",
            function: {
              name: "get_china_stock_data",
              arguments: '{"stock_code": "000001"}',
            },
          },
        ],
      };

      const mockToolResult = "股票数据：价格12.50元";

      jest.spyOn(dataToolkit, "executeTool").mockResolvedValue(mockToolResult);

      const result = await agent.testProcessToolCalls(llmResponse, testContext);

      expect(result.content).toContain("需要获取数据");
      expect(result.content).toContain("数据获取结果 - get_china_stock_data");
      expect(result.content).toContain(mockToolResult);
    });

    it("应该在没有数据工具包时发出警告", async () => {
      const agentWithoutToolkit = new TestAgent(llmService); // 不传入 dataToolkit
      const loggerSpy = jest.spyOn(agentWithoutToolkit["logger"], "warn");

      const llmResponse: LLMResponse = {
        content: "需要工具调用",
        toolCalls: [
          {
            id: "call_test",
            type: "function",
            function: {
              name: "test_tool",
              arguments: "{}",
            },
          },
        ],
      };

      const result = await agentWithoutToolkit.testProcessToolCalls(
        llmResponse,
        testContext,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        "收到工具调用请求，但数据工具包不可用",
      );
      expect(result).toEqual(llmResponse);
    });

    it("应该处理工具调用参数解析错误", async () => {
      const llmResponse: LLMResponse = {
        content: "工具调用",
        toolCalls: [
          {
            id: "call_invalid",
            type: "function",
            function: {
              name: "test_tool",
              arguments: "无效的JSON",
            },
          },
        ],
      };

      const result = await agent.testProcessToolCalls(llmResponse, testContext);

      expect(result.content).toContain("工具调用失败 (test_tool)");
    });
  });

  describe("提取方法测试", () => {
    describe("extractScore", () => {
      it("应该正确提取评分", () => {
        expect(agent.testExtractScore("技术分析评分: 85分")).toBe(85);
        expect(agent.testExtractScore("得分：75")).toBe(75);
        expect(agent.testExtractScore("评分: 90")).toBe(90);
      });

      it("应该限制评分范围", () => {
        expect(agent.testExtractScore("评分: 150")).toBe(100);
        expect(agent.testExtractScore("评分: -10")).toBe(0);
      });

      it("应该在没有找到评分时返回默认值", () => {
        expect(agent.testExtractScore("没有评分的文本")).toBe(50);
      });
    });

    describe("extractConfidence", () => {
      it("应该正确提取置信度", () => {
        expect(agent.testExtractConfidence("置信度: 0.8")).toBe(0.8);
        expect(agent.testExtractConfidence("可信度：85%")).toBe(0.85);
        expect(agent.testExtractConfidence("置信度: 0.95")).toBe(0.95);
      });

      it("应该限制置信度范围", () => {
        expect(agent.testExtractConfidence("置信度: 1.5")).toBe(1);
        expect(agent.testExtractConfidence("可信度：-10%")).toBe(0);
      });

      it("应该在没有找到置信度时返回默认值", () => {
        expect(agent.testExtractConfidence("没有置信度的文本")).toBe(0.7);
      });
    });

    describe("extractRecommendation", () => {
      it("应该正确提取交易建议", () => {
        expect(agent.testExtractRecommendation("强烈买入推荐")).toBe(
          TradingRecommendation.STRONG_BUY,
        );
        expect(agent.testExtractRecommendation("建议买入")).toBe(
          TradingRecommendation.BUY,
        );
        expect(agent.testExtractRecommendation("建议持有")).toBe(
          TradingRecommendation.HOLD,
        );
        expect(agent.testExtractRecommendation("建议卖出")).toBe(
          TradingRecommendation.SELL,
        );
        expect(agent.testExtractRecommendation("强烈卖出")).toBe(
          TradingRecommendation.STRONG_SELL,
        );
      });

      it("应该在没有明确建议时返回持有", () => {
        expect(agent.testExtractRecommendation("模糊的建议文本")).toBe(
          TradingRecommendation.HOLD,
        );
      });
    });

    describe("extractKeyInsights", () => {
      it("应该正确提取关键洞察", () => {
        const analysis = `
        关键洞察: 股价突破重要阻力位
        核心观点: 成交量显著放大
        • 技术指标向好
        • 基本面改善
        - 行业前景乐观
        `;

        const insights = agent.testExtractKeyInsights(analysis);
        expect(
          insights.some((insight) => insight.includes("股价突破重要阻力位")),
        ).toBe(true);
        expect(
          insights.some((insight) => insight.includes("成交量显著放大")),
        ).toBe(true);
        expect(
          insights.some((insight) => insight.includes("技术指标向好")),
        ).toBe(true);
        expect(insights.some((insight) => insight.includes("基本面改善"))).toBe(
          true,
        );
        expect(
          insights.some((insight) => insight.includes("行业前景乐观")),
        ).toBe(true);
        expect(insights.length).toBeLessThanOrEqual(5);
      });

      it("应该在没有找到洞察时提取要点", () => {
        const analysis = `
        • 第一个要点
        - 第二个要点
        · 第三个要点
        `;

        const insights = agent.testExtractKeyInsights(analysis);
        expect(insights).toContain("第一个要点");
        expect(insights).toContain("第二个要点");
        expect(insights).toContain("第三个要点");
      });
    });

    describe("extractRisks", () => {
      it("应该正确提取风险提示", () => {
        const analysis = `
        风险: 市场波动加大
        注意: 政策变化影响
        风险提示: 行业竞争激烈
        `;

        const risks = agent.testExtractRisks(analysis);
        expect(risks.some((risk) => risk.includes("市场波动加大"))).toBe(true);
        expect(risks.some((risk) => risk.includes("政策变化影响"))).toBe(true);
        expect(risks.some((risk) => risk.includes("行业竞争激烈"))).toBe(true);
        expect(risks.length).toBeLessThanOrEqual(3);
      });

      it("应该在没有风险提示时返回空数组", () => {
        const risks = agent.testExtractRisks("没有风险提示的文本");
        expect(risks).toEqual([]);
      });
    });
  });

  describe("validateResult", () => {
    it("应该验证有效的分析结果", () => {
      const validResult: AgentResult = {
        agentName: "测试智能体",
        agentType: AgentType.MARKET_ANALYST,
        analysis:
          "这是一个详细的分析结果，包含了足够的内容来证明分析的完整性和深度。本分析涵盖了市场趋势、技术指标、基本面数据等多个维度的内容。",
        timestamp: new Date(),
      };

      expect(agent.testValidateResult(validResult)).toBe(true);
    });

    it("应该拒绝空的分析结果", () => {
      const invalidResult: AgentResult = {
        agentName: "测试智能体",
        agentType: AgentType.MARKET_ANALYST,
        analysis: "",
        timestamp: new Date(),
      };

      expect(agent.testValidateResult(invalidResult)).toBe(false);
    });

    it("应该拒绝过短的分析结果", () => {
      const shortResult: AgentResult = {
        agentName: "测试智能体",
        agentType: AgentType.MARKET_ANALYST,
        analysis: "太短",
        timestamp: new Date(),
      };

      expect(agent.testValidateResult(shortResult)).toBe(false);
    });
  });

  describe("formatResult", () => {
    it("应该正确格式化分析结果", () => {
      const result: AgentResult = {
        agentName: "测试智能体",
        agentType: AgentType.MARKET_ANALYST,
        analysis: "详细的分析内容",
        score: 85,
        confidence: 0.8,
        recommendation: TradingRecommendation.BUY,
        keyInsights: ["洞察1", "洞察2"],
        risks: ["风险1", "风险2"],
        timestamp: new Date("2024-01-15T10:00:00Z"),
      };

      const formatted = agent.testFormatResult(result);

      expect(formatted).toContain("## 测试智能体 分析报告");
      expect(formatted).toContain("**评分**: 85");
      expect(formatted).toContain("**置信度**: 80.0%");
      expect(formatted).toMatch(/\*\*建议\*\*:\s*(BUY|buy)/i);
      expect(formatted).toContain("### 关键洞察");
      expect(formatted).toContain("- 洞察1");
      expect(formatted).toContain("- 洞察2");
      expect(formatted).toContain("### 风险提示");
      expect(formatted).toContain("- 风险1");
      expect(formatted).toContain("- 风险2");
    });

    it("应该处理没有洞察和风险的结果", () => {
      const result: AgentResult = {
        agentName: "测试智能体",
        agentType: AgentType.MARKET_ANALYST,
        analysis: "基本分析内容",
        timestamp: new Date(),
      };

      const formatted = agent.testFormatResult(result);

      expect(formatted).toContain("## 测试智能体 分析报告");
      expect(formatted).toContain("基本分析内容");
      expect(formatted).not.toContain("### 关键洞察");
      expect(formatted).not.toContain("### 风险提示");
    });
  });

  describe("getStatus", () => {
    it("应该返回当前状态", () => {
      expect(agent.getStatus()).toBe(AgentStatus.IDLE);
    });
  });

  describe("preprocessContext", () => {
    it("应该返回原始上下文（默认实现）", async () => {
      const result = await agent["preprocessContext"](testContext);
      expect(result).toEqual(testContext);
    });
  });
});
