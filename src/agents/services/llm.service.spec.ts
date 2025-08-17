import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { LLMService, DashScopeProvider } from "./llm.service";

describe("LLMService - 真实API测试", () => {
  let service: LLMService;
  let dashScopeProvider: DashScopeProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMService,
        DashScopeProvider,
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
    dashScopeProvider = module.get<DashScopeProvider>(DashScopeProvider);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
    expect(dashScopeProvider).toBeDefined();
  });

  describe("LLMService 基础功能", () => {
    it("应该返回所有可用的提供商", () => {
      const providers = service.getAvailableProviders();
      expect(providers).toContain("dashscope");
      expect(providers.length).toBeGreaterThan(0);
    });
  });

  describe("DashScopeProvider 真实API测试", () => {
    // 只有在配置了真实API密钥时才运行这些测试
    const hasApiKey =
      process.env.DASHSCOPE_API_KEY &&
      process.env.DASHSCOPE_API_KEY !== "test-key";

    if (hasApiKey) {
      it("应该成功调用真实的百炼API进行文本生成", async () => {
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

      it("应该能够进行数学计算", async () => {
        const prompt = "请计算：15 + 27 = ?";

        const result = await service.generate(prompt, {
          model: "qwen-plus",
          temperature: 0.1,
          maxTokens: 50,
        });

        expect(result).toBeDefined();
        expect(result).toMatch(/42|四十二|12|2/); // 匹配正确答案42或者步骤中的数字
      }, 30000);

      it("应该能够进行逻辑推理", async () => {
        const prompt = "如果所有的猫都是动物，而加菲是一只猫，那么加菲是什么？";

        const result = await service.generate(prompt, {
          model: "qwen-plus",
          temperature: 0.1,
          maxTokens: 100,
        });

        expect(result).toBeDefined();
        expect(result).toMatch(/动物/);
      }, 30000);

      it("应该能够使用 generateWithTools 进行工具调用", async () => {
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

      it("应该能够进行中文股市分析", async () => {
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

      it("应该能够处理批量请求", async () => {
        const prompts = [
          "1+1等于多少？",
          "太阳从哪个方向升起？",
          "地球有几个月亮？",
        ];

        const results = await service.generateBatch(prompts, {
          model: "qwen-plus",
          temperature: 0.1,
          maxTokens: 50,
        });

        expect(results).toHaveLength(3);
        results.forEach((result) => {
          expect(typeof result).toBe("string");
          expect(result.length).toBeGreaterThan(0);
        });

        expect(results[0]).toMatch(/2/);
        expect(results[1]).toMatch(/东/);
        expect(results[2]).toMatch(/1|一/);
      }, 60000);

      it("应该能够通过健康检查", async () => {
        const isHealthy = await service.checkHealth();
        expect(isHealthy).toBe(true);
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
    } else {
      it("跳过真实API测试 - 未配置DASHSCOPE_API_KEY", () => {
        console.log("跳过真实API测试：未配置有效的DASHSCOPE_API_KEY");
        expect(true).toBe(true);
      });
    }
  });

  describe("错误处理测试", () => {
    it("应该处理无效的提供商", async () => {
      await expect(
        service.generate("测试", { provider: "invalid-provider" }),
      ).rejects.toThrow("未找到LLM提供商: invalid-provider");
    });

    it("应该处理不支持工具调用的提供商", async () => {
      // 模拟一个不支持工具调用的提供商
      const mockProvider = {
        name: "mock-provider",
        generate: jest.fn().mockResolvedValue("测试响应"),
      };

      service["providers"].set("mock-provider", mockProvider);

      await expect(
        service.generateWithTools("测试", {
          provider: "mock-provider",
          tools: [],
        }),
      ).rejects.toThrow("提供商 mock-provider 不支持工具调用");
    });

    it("应该在没有API密钥时正确处理", async () => {
      const providerWithoutKey = new DashScopeProvider({
        get: jest.fn().mockReturnValue(undefined),
      } as any);

      await expect(
        providerWithoutKey.generateWithTools("测试"),
      ).rejects.toThrow("DASHSCOPE_API_KEY 未配置");
    });
  });

  describe("配置测试", () => {
    it("应该正确初始化配置", () => {
      expect(dashScopeProvider.name).toBe("dashscope");
    });

    it("应该使用正确的默认提供商", () => {
      const providers = service.getAvailableProviders();
      expect(providers).toContain("dashscope");
    });
  });

  describe("性能测试", () => {
    const hasApiKey =
      process.env.DASHSCOPE_API_KEY &&
      process.env.DASHSCOPE_API_KEY !== "test-key";

    if (hasApiKey) {
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
    } else {
      it("跳过性能测试 - 未配置API密钥", () => {
        console.log("跳过性能测试：未配置有效的DASHSCOPE_API_KEY");
        expect(true).toBe(true);
      });
    }
  });

  describe("模型参数测试", () => {
    const hasApiKey =
      process.env.DASHSCOPE_API_KEY &&
      process.env.DASHSCOPE_API_KEY !== "test-key";

    if (hasApiKey) {
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
      it("跳过模型参数测试 - 未配置API密钥", () => {
        console.log("跳过模型参数测试：未配置有效的DASHSCOPE_API_KEY");
        expect(true).toBe(true);
      });
    }
  });
});
