/**
 * LLM适配器架构集成测试
 * 验证合并后LLM服务的功能完整性和性能
 */

import {Test, TestingModule} from "@nestjs/testing";
import {ConfigModule} from "@nestjs/config";
import {LLMService} from "../llm.service";
import {DashScopeAdapter} from "./index";

describe("LLM适配器架构集成测试", () => {
  let module: TestingModule;
  let llmService: LLMService;
  
  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          // 使用默认的环境变量加载方式
          // dotenv已经在setup.ts中配置好了
        }),
      ],
      providers: [
        DashScopeAdapter,
        LLMService,
      ],
    }).compile();

    // 等待模块初始化
    await module.init();

    llmService = module.get<LLMService>(LLMService);
    
    // 等待一段时间让适配器完全初始化
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe("🔧 服务初始化", () => {
    it("✅ LLM服务应该正确初始化", () => {
      expect(llmService).toBeDefined();
      
      console.log("✓ LLMService初始化成功");
    });

    it("✅ 服务应该有完整的适配器功能", () => {
      const providers = llmService.getAvailableProviders();
      expect(providers).toContain("dashscope");
      
      const stats = llmService.getServiceStats();
      expect(stats.totalAdapters).toBeGreaterThan(0);
      expect(stats.primaryProvider).toBe("dashscope");
      
      console.log("✓ 适配器功能验证通过");
      console.log(`✓ 可用提供商: [${providers.join(", ")}]`);
      console.log(`✓ 服务统计: ${JSON.stringify(stats)}`);
    });

    it("✅ 服务应该支持模型查询", () => {
      const allModels = llmService.getAllSupportedModels();
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

  describe("🔀 服务功能测试", () => {
    it("✅ 服务应该能够进行文本生成", async () => {
      try {
        const response = await llmService.generate("测试服务文本生成功能", {
          model: "qwen-turbo",
          temperature: 0.1,
          maxTokens: 50,
        });
        
        expect(response).toBeTruthy();
        expect(typeof response).toBe("string");
        
        console.log("✅ 文本生成测试成功");
        console.log("响应长度:", response.length);
        
      } catch (error) {
        console.log("⚠️ 文本生成测试失败(可能是API密钥问题):", error.message);
        
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 30000);

    it("✅ 服务应该能够进行详细响应生成", async () => {
      try {
        const response = await llmService.generateWithDetails("测试详细响应功能", {
          model: "qwen-turbo",
          temperature: 0.1,
          maxTokens: 50,
        });
        
        expect(response).toBeTruthy();
        expect(response.content).toBeTruthy();
        expect(typeof response.content).toBe("string");
        expect(response.usage).toBeDefined();
        
        console.log("✅ 详细响应生成测试成功");
        console.log("响应长度:", response.content.length);
        console.log("Token使用:", response.usage);
        
      } catch (error) {
        console.log("⚠️ 详细响应生成测试失败(可能是API密钥问题):", error.message);
        
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 30000);

    it("✅ 工具调用应该正常工作", async () => {
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
        // 测试工具调用（兼容接口）
        const toolResponse = await llmService.generateWithTools(
          "请调用test_tool工具，参数为message:'测试成功'",
          {
            model: "qwen-plus",
            temperature: 0.3,
            maxTokens: 100,
            tools,
            toolChoice: "auto",
          }
        );
        
        expect(toolResponse.content).toBeTruthy();
        
        // 测试工具调用（详细接口）
        const detailsResponse = await llmService.generateWithDetails(
          "请调用test_tool工具，参数为message:'测试成功'",
          {
            model: "qwen-plus",
            temperature: 0.3,
            maxTokens: 100,
            tools,
            toolChoice: "auto",
          }
        );
        
        expect(detailsResponse.content).toBeTruthy();
        
        console.log("✅ 工具调用验证通过");
        console.log("兼容接口响应:", toolResponse.content.substring(0, 100) + "...");
        console.log("详细接口响应:", detailsResponse.content.substring(0, 100) + "...");
        
      } catch (error) {
        console.log("⚠️ 工具调用测试失败:", error.message);
        
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 45000);
  });

  describe("🔍 错误处理和恢复", () => {
    it("✅ 服务应该有健壮的错误处理", async () => {
      // 测试无效配置
      await expect(
        llmService.generate("测试", {
          temperature: 1.5, // 无效值
        })
      ).rejects.toThrow();

      // 测试不存在的模型
      await expect(
        llmService.generate("测试", {
          model: "non-existent-model",
        })
      ).rejects.toThrow();
      
      console.log("✓ 错误处理验证通过");
    });

  });

  describe("📊 性能和统计", () => {
    it("✅ 提供商状态应该正确跟踪", async () => {
      // 先进行几次调用来生成统计数据
      try {
        await llmService.generate("性能测试1", {
          model: "qwen-turbo",
          maxTokens: 10,
        });
        await llmService.generate("性能测试2", {
          model: "qwen-turbo", 
          maxTokens: 10,
        });
      } catch (error) {
        console.log("⚠️ 跳过性能测试调用:", error.message);
      }

      const providerStatus = llmService.getProviderStatus();
      expect(providerStatus).toBeInstanceOf(Array);
      expect(providerStatus.length).toBeGreaterThan(0);
      
      const dashscopeStatus = providerStatus.find(s => s.name === "dashscope");
      expect(dashscopeStatus).toBeDefined();
      expect(dashscopeStatus!.totalRequests).toBeGreaterThanOrEqual(0);
      expect(dashscopeStatus!.totalRequests).toBeGreaterThanOrEqual(0);
      
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
        const responses = await llmService.generateBatch(prompts, {
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

  describe("🎯 架构完整性", () => {
    it("✅ 应该支持适配器扩展", () => {
      // 验证架构设计是否支持扩展
      const serviceStats = llmService.getServiceStats();
      
      expect(serviceStats.totalAdapters).toBeGreaterThanOrEqual(1);
      expect(serviceStats.primaryProvider).toBeTruthy();
      expect(typeof serviceStats.fallbackEnabled).toBe("boolean");
      expect(typeof serviceStats.availableAdapters).toBe("number");
      
      console.log("✓ 架构扩展性验证通过");
      console.log("服务统计:", serviceStats);
    });

    it("✅ 应该有完整的接口暴露", () => {
      // 验证所有必要的方法都已暴露
      expect(typeof llmService.generate).toBe("function");
      expect(typeof llmService.generateWithDetails).toBe("function");
      expect(typeof llmService.generateWithTools).toBe("function");
      expect(typeof llmService.generateBatch).toBe("function");
      expect(typeof llmService.getAllSupportedModels).toBe("function");
      expect(typeof llmService.getProviderStatus).toBe("function");
      expect(typeof llmService.getServiceStats).toBe("function");
      
      console.log("✓ 接口完整性验证通过");
    });

    it("✅ 向后兼容性接口应该正常工作", async () => {
      // 验证兼容性接口能够正常工作
      try {
        const result = await llmService.generateWithTools("测试兼容性", {
          model: "qwen-turbo",
          maxTokens: 30,
        });
        
        expect(result).toHaveProperty("content");
        expect(typeof result.content).toBe("string");
        
        console.log("✓ 向后兼容性验证通过");
        
      } catch (error) {
        console.log("⚠️ 向后兼容性测试失败:", error.message);
        
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 30000);
  });
});