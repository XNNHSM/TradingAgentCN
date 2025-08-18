/**
 * DashScope适配器测试
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { DashScopeAdapter } from "./dashscope-adapter";

describe("DashScopeAdapter", () => {
  let adapter: DashScopeAdapter;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashScopeAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || "test-api-key",
                DASHSCOPE_BASE_URL: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
                DASHSCOPE_STANDARD_MODEL: "qwen-plus",
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<DashScopeAdapter>(DashScopeAdapter);
    configService = module.get<ConfigService>(ConfigService);
    
    await adapter.initialize();
  });

  it("应该正确初始化", () => {
    expect(adapter).toBeDefined();
    expect(adapter.name).toBe("dashscope");
  });

  it("应该返回支持的模型列表", () => {
    const models = adapter.getSupportedModels();
    expect(models).toBeInstanceOf(Array);
    expect(models.length).toBeGreaterThan(0);
    
    const qwenPlus = models.find(m => m.name === "qwen-plus");
    expect(qwenPlus).toBeDefined();
    expect(qwenPlus?.supportsFunctionCalling).toBe(true);
    expect(qwenPlus?.contextLength).toBeGreaterThan(0);
  });

  it("应该返回默认模型", () => {
    const defaultModel = adapter.getDefaultModel();
    expect(defaultModel).toBe("qwen-plus");
  });

  it("应该正确检查模型工具调用支持", () => {
    expect(adapter.supportsTools("qwen-plus")).toBe(true);
    expect(adapter.supportsTools("qwen-max-longcontext")).toBe(false);
  });

  it("应该正确估算请求成本", () => {
    const messages = [
      { role: "user" as const, content: "这是一个测试消息，用于计算token成本" },
    ];
    
    const { estimatedInputTokens, estimatedCost } = adapter.estimateCost(messages);
    expect(estimatedInputTokens).toBeGreaterThan(0);
    expect(estimatedCost).toBeGreaterThanOrEqual(0);
  });

  it("应该获取模型详细信息", () => {
    const modelInfo = adapter.getModelInfo("qwen-plus");
    expect(modelInfo).toBeDefined();
    expect(modelInfo?.name).toBe("qwen-plus");
    expect(modelInfo?.description).toContain("Plus");
    expect(modelInfo?.contextLength).toBe(32768);
  });

  describe("真实API调用测试", () => {
    it("应该成功生成简单文本", async () => {
      if (!process.env.DASHSCOPE_API_KEY) {
        console.log("⚠️ 跳过真实API测试：未设置DASHSCOPE_API_KEY");
        return;
      }

      try {
        const response = await adapter.generateWithDetails("你好，请回复'测试成功'", {
          model: "qwen-turbo",
          temperature: 0.1,
          maxTokens: 20,
        });

        console.log("✅ DashScope适配器真实API测试成功");
        console.log("响应内容:", response.content);
        console.log("Token使用:", response.usage);

        expect(response.content).toBeTruthy();
        expect(response.usage).toBeDefined();
        expect(response.usage?.totalTokens).toBeGreaterThan(0);
        expect(response.model).toBe("qwen-turbo");
      } catch (error) {
        console.log("⚠️ 真实API测试失败(可能是网络或API密钥问题):", error.message);
        // 允许API相关错误，不影响其他测试
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 30000);

    it("应该正确处理工具调用", async () => {
      if (!process.env.DASHSCOPE_API_KEY) {
        console.log("⚠️ 跳过工具调用测试：未设置DASHSCOPE_API_KEY");
        return;
      }

      const tools = [
        {
          type: "function" as const,
          function: {
            name: "get_weather",
            description: "获取天气信息",
            parameters: {
              type: "object",
              properties: {
                city: {
                  type: "string",
                  description: "城市名称",
                },
              },
              required: ["city"],
            },
          },
        },
      ];

      try {
        const response = await adapter.generateWithDetails(
          "北京今天天气怎么样？",
          {
            model: "qwen-plus",
            temperature: 0.3,
            maxTokens: 100,
            tools,
            toolChoice: "auto",
          }
        );

        console.log("✅ DashScope工具调用测试完成");
        console.log("响应内容:", response.content);
        console.log("工具调用:", response.toolCalls);

        expect(response.content).toBeTruthy();
        // 注意：不一定会调用工具，取决于模型的判断
        if (response.toolCalls) {
          expect(response.toolCalls.length).toBeGreaterThan(0);
          expect(response.toolCalls[0].function.name).toBe("get_weather");
        }
      } catch (error) {
        console.log("⚠️ 工具调用测试失败:", error.message);
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 45000);
  });

  describe("错误处理", () => {
    it("应该正确处理配置验证错误", async () => {
      await expect(
        adapter.generateWithDetails("测试", {
          temperature: 1.5, // 无效值
        })
      ).rejects.toThrow("temperature 参数必须在 0-1 之间");

      await expect(
        adapter.generateWithDetails("测试", {
          maxTokens: -1, // 无效值
        })
      ).rejects.toThrow("maxTokens 参数必须大于 0");

      await expect(
        adapter.generateWithDetails("测试", {
          topP: 1.5, // 无效值
        })
      ).rejects.toThrow("topP 参数必须在 0-1 之间");
    });

    it("应该正确处理API不可用的情况", async () => {
      const adapterWithoutKey = new DashScopeAdapter({
        get: () => "", // 返回空的API密钥
      } as any);
      
      await adapterWithoutKey.initialize();

      expect(adapterWithoutKey.isAvailable()).toBe(false);
      
      await expect(
        adapterWithoutKey.generateWithDetails("测试")
      ).rejects.toThrow("DashScope适配器不可用");
    });
  });

  describe("健康检查", () => {
    it("应该正确执行健康检查", async () => {
      if (!process.env.DASHSCOPE_API_KEY) {
        console.log("⚠️ 跳过健康检查测试：未设置DASHSCOPE_API_KEY");
        return;
      }

      const isHealthy = await adapter.healthCheck();
      console.log("健康检查结果:", isHealthy);

      // 健康检查结果取决于API可用性
      expect(typeof isHealthy).toBe("boolean");
    }, 15000);
  });
});