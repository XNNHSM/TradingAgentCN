import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { LLMService } from "./llm.service";
import { LLMServiceV2, DashScopeAdapter } from "./llm-adapters";

describe("LLMService - 向后兼容性测试", () => {
  let service: LLMService;
  let llmServiceV2: LLMServiceV2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMService,
        DashScopeAdapter,
        LLMServiceV2,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                // 使用 .env 中的配置
                const envConfig: Record<string, any> = {
                  DASHSCOPE_API_KEY:
                    process.env.DASHSCOPE_API_KEY || "test-key",
                  DASHSCOPE_BASE_URL:
                    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
                  DASHSCOPE_STANDARD_MODEL: "qwen-plus",
                  LLM_DEFAULT_TEMPERATURE: 0.1, // 降低温度以提高一致性
                  LLM_DEFAULT_MAX_TOKENS: 1000,
                  LLM_DEFAULT_TIMEOUT: 30,
                  LLM_PRIMARY_PROVIDER: "dashscope",
                  LLM_MAX_RETRIES: 2,
                };
                return envConfig[key] ?? defaultValue;
              }),
          },
        },
      ],
    }).compile();

    service = module.get<LLMService>(LLMService);
    llmServiceV2 = module.get<LLMServiceV2>(LLMServiceV2);
    
    // 重要：初始化 LLMServiceV2，这样适配器才会被注册和初始化
    await llmServiceV2.onModuleInit();
  });

  afterEach(() => {
    // 清理定时器以避免Jest警告
    if (llmServiceV2 && (llmServiceV2 as any).healthCheckTimer) {
      clearInterval((llmServiceV2 as any).healthCheckTimer);
    }
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
    expect(llmServiceV2).toBeDefined();
  });

  describe("向后兼容性测试", () => {
    // 只有在配置了真实API密钥时才运行这些测试
    const hasApiKey =
      process.env.DASHSCOPE_API_KEY &&
      process.env.DASHSCOPE_API_KEY !== "test-key";

    if (hasApiKey) {
      it("应该通过旧接口成功调用新服务进行文本生成", async () => {
        const prompt = "请用中文简要回答：北京是中国的什么？";

        const result = await service.generate(prompt, {
          model: "qwen-plus",
          temperature: 0.1,
          maxTokens: 100,
        });

        expect(result).toBeDefined();
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
        expect(result).toMatch(/首都|都城|政治|中心/);
      }, 30000);

      it("应该通过旧接口成功调用新服务进行工具调用", async () => {
        const tools = [
          {
            type: "function",
            function: {
              name: "get_stock_price",
              description: "获取股票价格",
              parameters: {
                type: "object",
                properties: {
                  symbol: {
                    type: "string",
                    description: "股票代码",
                  },
                },
                required: ["symbol"],
              },
            },
          },
        ];

        const prompt = "请帮我查询平安银行（股票代码000001）的价格";

        const result = await service.generateWithTools(prompt, {
          model: "qwen-plus",
          temperature: 0.1,
          maxTokens: 500,
          tools,
          toolChoice: "auto",
        });

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(typeof result.content).toBe("string");

        // 检查是否触发了工具调用
        if (result.toolCalls && result.toolCalls.length > 0) {
          expect(result.toolCalls[0]).toHaveProperty("function");
          expect(result.toolCalls[0].function).toHaveProperty("name");
          expect(result.toolCalls[0].function).toHaveProperty("arguments");
        }
      }, 30000);

      it("应该能够处理中文股市分析", async () => {
        const prompt = `
请分析以下股票情况：
股票名称：平安银行
股票代码：000001
当前价格：12.50元
涨跌幅：+2.5%
成交量：150万手

请给出简要的投资建议，不超过100字。
`;

        const result = await service.generate(prompt, {
          model: "qwen-plus",
          temperature: 0.3,
          maxTokens: 200,
        });

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(20);
        expect(result).toMatch(/平安银行|股票|投资|建议|风险/);
      }, 30000);

      it("应该能够处理复杂的投资分析请求", async () => {
        const prompt = `
作为专业的股票分析师，请分析以下技术指标：
- RSI: 65
- MACD: 0.15 (金叉)
- MA5: 12.50
- MA20: 12.30
- 成交量: 放大至150%

基于这些指标，给出技术面评分（0-100分）和简要建议。
`;

        const result = await service.generate(prompt, {
          model: "qwen-plus",
          temperature: 0.2,
          maxTokens: 300,
        });

        expect(result).toBeDefined();
        expect(result).toMatch(/评分|建议|技术|指标/);
        // 检查是否包含数字评分
        expect(result).toMatch(/\d{1,3}[分点]?/);
      }, 30000);

      it("应该在合理时间内完成请求", async () => {
        const startTime = Date.now();

        await service.generate("简单测试", {
          model: "qwen-plus",
          temperature: 0.1,
          maxTokens: 50,
        });

        const duration = Date.now() - startTime;

        // API调用应该在30秒内完成
        expect(duration).toBeLessThan(30000);
      }, 35000);

      it("应该能够处理并发请求", async () => {
        const promises = [
          service.generate("测试1", { maxTokens: 20 }),
          service.generate("测试2", { maxTokens: 20 }),
          service.generate("测试3", { maxTokens: 20 }),
        ];

        const results = await Promise.all(promises);

        results.forEach((result) => {
          expect(result).toBeDefined();
          expect(typeof result).toBe("string");
        });
      }, 45000);

      it("应该能够使用不同的温度参数", async () => {
        const prompt = "描述一下春天的景色";

        const lowTempResult = await service.generate(prompt, {
          temperature: 0.1,
          maxTokens: 100,
        });

        const highTempResult = await service.generate(prompt, {
          temperature: 0.9,
          maxTokens: 100,
        });

        expect(lowTempResult).toBeDefined();
        expect(highTempResult).toBeDefined();
        expect(typeof lowTempResult).toBe("string");
        expect(typeof highTempResult).toBe("string");
      }, 45000);

      it("应该能够限制输出长度", async () => {
        const prompt = "请详细介绍一下人工智能的发展历史和未来趋势";

        const shortResult = await service.generate(prompt, {
          maxTokens: 50,
        });

        const longResult = await service.generate(prompt, {
          maxTokens: 200,
        });

        expect(shortResult.length).toBeLessThan(longResult.length * 1.5);
      }, 45000);
    } else {
      it("跳过真实API测试 - 未配置DASHSCOPE_API_KEY", () => {
        console.log("跳过真实API测试：未配置有效的DASHSCOPE_API_KEY");
        expect(true).toBe(true);
      });
    }
  });

  describe("错误处理测试", () => {
    it("应该在LLMServiceV2不可用时抛出错误", async () => {
      // 创建一个没有LLMServiceV2的服务实例
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LLMService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue("test-value"),
            },
          },
        ],
      }).compile();

      const serviceWithoutV2 = module.get<LLMService>(LLMService);

      await expect(
        serviceWithoutV2.generate("测试"),
      ).rejects.toThrow("LLMServiceV2 不可用，请检查配置");

      await expect(
        serviceWithoutV2.generateWithTools("测试", { tools: [] }),
      ).rejects.toThrow("LLMServiceV2 不可用，请检查配置");
    });
  });

  describe("配置测试", () => {
    it("应该正确初始化并显示配置状态", () => {
      // 检查服务是否正确初始化
      expect(service).toBeDefined();
      expect(llmServiceV2).toBeDefined();
    });
  });

  describe("接口兼容性测试", () => {
    const hasApiKey =
      process.env.DASHSCOPE_API_KEY &&
      process.env.DASHSCOPE_API_KEY !== "test-key";

    if (hasApiKey) {
      it("应该保持工具调用响应格式的兼容性", async () => {
        const tools = [
          {
            type: "function",
            function: {
              name: "test_function",
              description: "测试函数",
              parameters: {
                type: "object",
                properties: {
                  input: { type: "string" },
                },
              },
            },
          },
        ];

        const result = await service.generateWithTools(
          "调用测试函数，参数是hello",
          {
            tools,
            toolChoice: "auto",
            maxTokens: 100,
          },
        );

        // 验证响应格式符合旧接口标准
        expect(result).toHaveProperty("content");
        expect(typeof result.content).toBe("string");
        
        if (result.toolCalls) {
          expect(Array.isArray(result.toolCalls)).toBe(true);
          if (result.toolCalls.length > 0) {
            expect(result.toolCalls[0]).toHaveProperty("function");
            expect(result.toolCalls[0].function).toHaveProperty("name");
            expect(result.toolCalls[0].function).toHaveProperty("arguments");
          }
        }
      }, 30000);
    } else {
      it("跳过接口兼容性测试 - 未配置API密钥", () => {
        console.log("跳过接口兼容性测试：未配置有效的DASHSCOPE_API_KEY");
        expect(true).toBe(true);
      });
    }
  });
});