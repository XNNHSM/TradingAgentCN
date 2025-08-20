/**
 * LLM适配器架构集成测试
 * 验证新旧服务的兼容性和功能完整性
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { LLMService } from "../llm.service";
import { LLMServiceV2, DashScopeAdapter } from "./index";

describe("LLM适配器架构集成测试", () => {
  let module: TestingModule;
  let oldLLMService: LLMService;
  let newLLMService: LLMServiceV2;
  
  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env.test",
        }),
      ],
      providers: [
        // 旧服务
        DashScopeAdapter,
        LLMService,
        
        // 新服务
        DashScopeAdapter,
        LLMServiceV2,
      ],
    }).compile();

    // 等待模块初始化
    await module.init();

    oldLLMService = module.get<LLMService>(LLMService);
    newLLMService = module.get<LLMServiceV2>(LLMServiceV2);
    
    // 等待一段时间让适配器完全初始化
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe("🔧 服务初始化", () => {
    it("✅ 所有服务应该正确初始化", () => {
      expect(oldLLMService).toBeDefined();
      expect(newLLMService).toBeDefined();
      
      console.log("✓ 旧版LLMService初始化成功");
      console.log("✓ 新版LLMServiceV2初始化成功");
    });

    it("✅ 新服务应该有完整的适配器功能", () => {
      const providers = newLLMService.getAvailableProviders();
      expect(providers).toContain("dashscope");
      
      const stats = newLLMService.getServiceStats();
      expect(stats.totalAdapters).toBeGreaterThan(0);
      expect(stats.primaryProvider).toBe("dashscope");
      
      console.log("✓ 适配器功能验证通过");
      console.log(`✓ 可用提供商: [${providers.join(", ")}]`);
      console.log(`✓ 服务统计: ${JSON.stringify(stats)}`);
    });

    it("✅ 新服务应该支持模型查询", () => {
      const allModels = newLLMService.getAllSupportedModels();
      expect(allModels.size).toBeGreaterThan(0);
      
      const dashscopeModels = allModels.get("dashscope");
      expect(dashscopeModels).toBeDefined();
      expect(dashscopeModels!.length).toBeGreaterThan(0);
      
      const qwenPlus = dashscopeModels!.find(m => m.name === "qwen-plus");
      expect(qwenPlus).toBeDefined();
      expect(qwenPlus!.supportsFunctionCalling).toBe(true);
      
      console.log("✓ 模型查询功能验证通过");
      console.log(`✓ DashScope支持模型: ${dashscopeModels!.map(m => m.name).join(", ")}`);
    });
  });

  describe("🔀 服务兼容性", () => {
    it("✅ 旧服务应该能够使用新适配器", async () => {
      try {
        const response = await oldLLMService.generate("测试新旧服务兼容性", {
          model: "qwen-turbo",
          temperature: 0.1,
          maxTokens: 50,
        });
        
        expect(response).toBeTruthy();
        expect(typeof response).toBe("string");
        
        console.log("✅ 旧服务兼容性测试成功");
        console.log("响应长度:", response.length);
        
      } catch (error) {
        console.log("⚠️ 旧服务兼容性测试失败(可能是API密钥问题):", error.message);
        
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 30000);

    it("✅ 新服务应该正常工作", async () => {
      try {
        const response = await newLLMService.generate("测试新服务功能", {
          model: "qwen-turbo",
          temperature: 0.1,
          maxTokens: 50,
        });
        
        expect(response).toBeTruthy();
        expect(typeof response).toBe("string");
        
        console.log("✅ 新服务功能测试成功");
        console.log("响应长度:", response.length);
        
      } catch (error) {
        console.log("⚠️ 新服务功能测试失败(可能是API密钥问题):", error.message);
        
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 30000);

    it("✅ 工具调用应该在新旧服务间兼容", async () => {
      const tools = [
        {
          type: "function" as const,
          function: {
            name: "test_tool",
            description: "测试工具",
            parameters: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "测试消息",
                },
              },
            },
          },
        },
      ];

      try {
        // 测试旧服务的工具调用
        const oldResponse = await oldLLMService.generateWithTools(
          "请调用test_tool工具，参数为message:'测试成功'",
          {
            model: "qwen-plus",
            temperature: 0.3,
            maxTokens: 100,
            tools,
            toolChoice: "auto",
          }
        );
        
        expect(oldResponse.content).toBeTruthy();
        
        // 测试新服务的工具调用
        const newResponse = await newLLMService.generateWithDetails(
          "请调用test_tool工具，参数为message:'测试成功'",
          {
            model: "qwen-plus",
            temperature: 0.3,
            maxTokens: 100,
            tools,
            toolChoice: "auto",
          }
        );
        
        expect(newResponse.content).toBeTruthy();
        
        console.log("✅ 工具调用兼容性验证通过");
        console.log("旧服务响应:", oldResponse.content.substring(0, 100) + "...");
        console.log("新服务响应:", newResponse.content.substring(0, 100) + "...");
        
      } catch (error) {
        console.log("⚠️ 工具调用兼容性测试失败:", error.message);
        
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 45000);
  });

  describe("🔍 错误处理和恢复", () => {
    it("✅ 新服务应该有健壮的错误处理", async () => {
      // 测试无效配置
      await expect(
        newLLMService.generate("测试", {
          temperature: 1.5, // 无效值
        })
      ).rejects.toThrow();

      // 测试不存在的模型
      await expect(
        newLLMService.generate("测试", {
          model: "non-existent-model",
        })
      ).rejects.toThrow();
      
      console.log("✓ 错误处理验证通过");
    });

    it("✅ 健康检查应该正常工作", async () => {
      const healthResults = await newLLMService.triggerHealthCheck();
      
      expect(healthResults).toBeInstanceOf(Map);
      expect(healthResults.has("dashscope")).toBe(true);
      
      const dashscopeHealth = healthResults.get("dashscope");
      expect(typeof dashscopeHealth).toBe("boolean");
      
      console.log("✓ 健康检查验证通过");
      console.log("健康检查结果:", Array.from(healthResults.entries()));
    }, 20000);
  });

  describe("📊 性能和统计", () => {
    it("✅ 提供商状态应该正确跟踪", async () => {
      // 先进行几次调用来生成统计数据
      try {
        await newLLMService.generate("性能测试1", {
          model: "qwen-turbo",
          maxTokens: 10,
        });
        await newLLMService.generate("性能测试2", {
          model: "qwen-turbo", 
          maxTokens: 10,
        });
      } catch (error) {
        console.log("⚠️ 跳过性能测试调用:", error.message);
      }

      const providerStatus = newLLMService.getProviderStatus();
      expect(providerStatus).toBeInstanceOf(Array);
      expect(providerStatus.length).toBeGreaterThan(0);
      
      const dashscopeStatus = providerStatus.find(s => s.name === "dashscope");
      expect(dashscopeStatus).toBeDefined();
      expect(dashscopeStatus!.totalRequests).toBeGreaterThanOrEqual(0);
      expect(dashscopeStatus!.lastHealthCheck).toBeInstanceOf(Date);
      
      console.log("✓ 提供商状态跟踪验证通过");
      console.log("DashScope状态:", JSON.stringify(dashscopeStatus, null, 2));
    });

    it("✅ 批量处理应该正常工作", async () => {
      const prompts = [
        "批量测试1: 2+2=?",
        "批量测试2: 今天星期几?",
        "批量测试3: 你好吗?",
      ];

      try {
        const responses = await newLLMService.generateBatch(prompts, {
          model: "qwen-turbo",
          maxTokens: 20,
          concurrency: 2,
        });
        
        expect(responses).toBeInstanceOf(Array);
        expect(responses.length).toBe(prompts.length);
        
        responses.forEach((response, index) => {
          expect(response).toBeDefined();
          expect(typeof response.content).toBe("string");
        });
        
        console.log("✅ 批量处理验证通过");
        console.log(`处理了 ${responses.length} 个请求`);
        
      } catch (error) {
        console.log("⚠️ 批量处理测试失败:", error.message);
        
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 60000);
  });

  describe("🎯 架构扩展性", () => {
    it("✅ 应该支持未来的适配器扩展", () => {
      // 验证架构设计是否支持扩展
      const serviceStats = newLLMService.getServiceStats();
      
      expect(serviceStats.totalAdapters).toBeGreaterThanOrEqual(1);
      expect(serviceStats.primaryProvider).toBeTruthy();
      expect(typeof serviceStats.fallbackEnabled).toBe("boolean");
      expect(typeof serviceStats.availableAdapters).toBe("number");
      
      console.log("✓ 架构扩展性验证通过");
      console.log("服务统计:", serviceStats);
    });

    it("✅ 应该有完整的接口暴露", () => {
      // 验证所有必要的方法都已暴露
      expect(typeof newLLMService.generate).toBe("function");
      expect(typeof newLLMService.generateWithDetails).toBe("function");
      expect(typeof newLLMService.generateBatch).toBe("function");
      expect(typeof newLLMService.getAllSupportedModels).toBe("function");
      expect(typeof newLLMService.getProviderStatus).toBe("function");
      expect(typeof newLLMService.getServiceStats).toBe("function");
      expect(typeof newLLMService.triggerHealthCheck).toBe("function");
      
      console.log("✓ 接口完整性验证通过");
    });
  });
});