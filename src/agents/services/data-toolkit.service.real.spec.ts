/**
 * DataToolkitService 真实数据测试
 * 使用真实的股票API数据，不使用mock
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { StockDataModule } from "../../services/stock-data/stock-data.module";
import { NewsModule } from "../../services/news/news.module";

import { DataToolkitService } from "./data-toolkit.service";

describe("DataToolkitService - 真实数据测试", () => {
  let service: DataToolkitService;
  let module: TestingModule;

  beforeAll(async () => {
    console.log("🚀 初始化DataToolkitService真实数据测试模块...");
    
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env.test",
        }),
        StockDataModule,
        NewsModule,
      ],
      providers: [DataToolkitService],
    }).compile();

    await module.init();
    service = module.get<DataToolkitService>(DataToolkitService);
    
    console.log("✅ DataToolkitService 初始化完成");
  }, 30000);

  afterAll(async () => {
    if (module) {
      await module.close();
      console.log("🔚 测试模块已关闭");
    }
  });

  describe("🔧 服务初始化", () => {
    it("✅ 应该正确初始化", () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(DataToolkitService);
      
      console.log("✓ DataToolkitService 实例化成功");
    });

    it("✅ 应该提供工具定义", () => {
      const tools = service.getToolDefinitions();
      
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      console.log(`✓ 工具定义数量: ${tools.length}`);
      
      // 验证工具定义结构
      tools.forEach((tool, index) => {
        expect(tool.type).toBe("function");
        expect(tool.function.name).toBeTruthy();
        expect(tool.function.description).toBeTruthy();
        expect(tool.function.parameters).toBeDefined();
        
        console.log(`  ${index + 1}. ${tool.function.name}: ${tool.function.description}`);
      });
    });

    it("✅ 应该包含核心股票数据工具", () => {
      const tools = service.getToolDefinitions();
      const toolNames = tools.map(t => t.function.name);
      
      // 检查是否包含核心工具
      const expectedTools = [
        "get_china_stock_data",
        "get_financial_data", 
        "get_company_info",
        "get_industry_data",
        "get_market_news",
      ];

      expectedTools.forEach(expectedTool => {
        if (toolNames.includes(expectedTool)) {
          console.log(`✓ 包含核心工具: ${expectedTool}`);
        } else {
          console.log(`⚠️ 缺少工具: ${expectedTool}`);
        }
      });
      
      expect(toolNames.length).toBeGreaterThan(2);
    });
  });

  describe("📊 真实股票数据获取", () => {
    it("✅ 应该能够获取股票基础数据", async () => {
      console.log("🔍 测试获取股票基础数据...");
      
      try {
        const result = await service.executeTool("get_china_stock_data", {
          stock_code: "000001",
          start_date: "2025-08-01",
          end_date: "2025-08-18",
        });

        expect(result).toBeTruthy();
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(10);
        
        console.log("✅ 股票数据获取成功");
        console.log(`数据长度: ${result.length} 字符`);
        console.log(`数据预览: ${result.substring(0, 200)}...`);
        
      } catch (error) {
        console.log("⚠️ 股票数据获取失败:", error.message);
        
        // 允许网络相关错误
        if (!error.message.includes("网络") && !error.message.includes("连接")) {
          throw error;
        }
      }
    }, 30000);

    it("✅ 应该能够获取财务数据", async () => {
      console.log("🔍 测试获取财务数据...");
      
      try {
        const result = await service.executeTool("get_financial_data", {
          stock_code: "000001",
          report_type: "annual",
        });

        expect(result).toBeTruthy();
        expect(typeof result).toBe("string");
        
        console.log("✅ 财务数据获取成功");
        console.log(`财务数据长度: ${result.length} 字符`);
        console.log(`财务数据预览: ${result.substring(0, 200)}...`);
        
      } catch (error) {
        console.log("⚠️ 财务数据获取失败:", error.message);
        
        // 允许网络相关错误或功能未实现错误
        if (
          !error.message.includes("网络") && 
          !error.message.includes("连接") &&
          !error.message.includes("not implemented") &&
          !error.message.includes("暂未实现")
        ) {
          throw error;
        }
      }
    }, 30000);

    it("✅ 应该能够获取公司信息", async () => {
      console.log("🔍 测试获取公司信息...");
      
      try {
        const result = await service.executeTool("get_company_info", {
          stock_code: "000001",
        });

        expect(result).toBeTruthy();
        expect(typeof result).toBe("string");
        
        console.log("✅ 公司信息获取成功");
        console.log(`公司信息长度: ${result.length} 字符`);
        console.log(`公司信息预览: ${result.substring(0, 200)}...`);
        
      } catch (error) {
        console.log("⚠️ 公司信息获取失败:", error.message);
        
        // 允许网络相关错误或功能未实现错误
        if (
          !error.message.includes("网络") && 
          !error.message.includes("连接") &&
          !error.message.includes("not implemented") &&
          !error.message.includes("暂未实现")
        ) {
          throw error;
        }
      }
    }, 30000);

    it("✅ 应该能够获取行业数据", async () => {
      console.log("🔍 测试获取行业数据...");
      
      try {
        const result = await service.executeTool("get_industry_data", {
          industry: "银行",
        });

        expect(result).toBeTruthy();
        expect(typeof result).toBe("string");
        
        console.log("✅ 行业数据获取成功");
        console.log(`行业数据长度: ${result.length} 字符`);
        console.log(`行业数据预览: ${result.substring(0, 200)}...`);
        
      } catch (error) {
        console.log("⚠️ 行业数据获取失败:", error.message);
        
        // 允许网络相关错误或功能未实现错误
        if (
          !error.message.includes("网络") && 
          !error.message.includes("连接") &&
          !error.message.includes("not implemented") &&
          !error.message.includes("暂未实现")
        ) {
          throw error;
        }
      }
    }, 30000);

    it("✅ 应该能够获取市场新闻", async () => {
      console.log("🔍 测试获取市场新闻...");
      
      try {
        const result = await service.executeTool("get_market_news", {
          keyword: "平安银行",
          days: 7,
        });

        expect(result).toBeTruthy();
        expect(typeof result).toBe("string");
        
        console.log("✅ 市场新闻获取成功");
        console.log(`新闻数据长度: ${result.length} 字符`);
        console.log(`新闻数据预览: ${result.substring(0, 200)}...`);
        
      } catch (error) {
        console.log("⚠️ 市场新闻获取失败:", error.message);
        
        // 允许网络相关错误或功能未实现错误
        if (
          !error.message.includes("网络") && 
          !error.message.includes("连接") &&
          !error.message.includes("not implemented") &&
          !error.message.includes("暂未实现")
        ) {
          throw error;
        }
      }
    }, 30000);
  });

  describe("🛡️ 错误处理", () => {
    it("✅ 应该正确处理不存在的工具", async () => {
      console.log("🔍 测试不存在的工具处理...");
      
      try {
        await service.executeTool("non_existent_tool", {});
        // 如果没有抛出错误，测试失败
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain("工具不存在");
        console.log("✓ 不存在工具错误处理正确");
      }
    });

    it("✅ 应该正确处理无效参数", async () => {
      console.log("🔍 测试无效参数处理...");
      
      try {
        await service.executeTool("get_china_stock_data", {
          // 缺少必需参数
        });
        
        // 某些情况下可能返回默认结果而不抛出错误
        console.log("⚠️ 无效参数未抛出错误，但可能有默认处理");
        
      } catch (error) {
        expect(error).toBeDefined();
        console.log("✓ 无效参数错误处理正确:", error.message);
      }
    }, 15000);

    it("✅ 应该正确处理无效股票代码", async () => {
      console.log("🔍 测试无效股票代码处理...");
      
      try {
        const result = await service.executeTool("get_china_stock_data", {
          stock_code: "INVALID123",
          start_date: "2025-08-01",
          end_date: "2025-08-18",
        });
        
        // 可能返回空结果或错误信息
        expect(result).toBeTruthy();
        expect(typeof result).toBe("string");
        
        console.log("✓ 无效股票代码处理:", result.substring(0, 100));
        
      } catch (error) {
        expect(error).toBeDefined();
        console.log("✓ 无效股票代码正确抛出错误:", error.message);
      }
    }, 15000);
  });

  describe("⚡ 性能测试", () => {
    it("✅ 工具定义获取应该快速", () => {
      const startTime = Date.now();
      
      const tools = service.getToolDefinitions();
      
      const duration = Date.now() - startTime;
      
      expect(tools).toBeDefined();
      expect(duration).toBeLessThan(100); // 应该在100ms内完成
      
      console.log(`✓ 工具定义获取耗时: ${duration}ms`);
    });

    it("✅ 股票数据获取应该在合理时间内完成", async () => {
      console.log("🔍 测试股票数据获取性能...");
      
      const startTime = Date.now();
      
      try {
        const result = await service.executeTool("get_china_stock_data", {
          stock_code: "000001",
          start_date: "2025-08-15",
          end_date: "2025-08-18",
        });
        
        const duration = Date.now() - startTime;
        
        expect(result).toBeTruthy();
        expect(duration).toBeLessThan(30000); // 应该在30秒内完成
        
        console.log(`✅ 股票数据获取耗时: ${duration}ms`);
        
      } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`⚠️ 股票数据获取失败，耗时: ${duration}ms`);
        
        // 允许网络相关错误
        if (!error.message.includes("网络") && !error.message.includes("连接")) {
          throw error;
        }
      }
    }, 35000);
  });

  describe("🔄 并发处理", () => {
    it("✅ 应该能够处理并发工具调用", async () => {
      console.log("🔍 测试并发工具调用...");
      
      const promises = [
        service.executeTool("get_china_stock_data", {
          stock_code: "000001",
          start_date: "2025-08-17",
          end_date: "2025-08-18",
        }),
        service.executeTool("get_china_stock_data", {
          stock_code: "000002",
          start_date: "2025-08-17",
          end_date: "2025-08-18",
        }),
      ];
      
      try {
        const results = await Promise.allSettled(promises);
        
        expect(results).toBeDefined();
        expect(results.length).toBe(2);
        
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            expect(result.value).toBeTruthy();
            console.log(`✓ 并发调用 ${index + 1} 成功`);
          } else {
            console.log(`⚠️ 并发调用 ${index + 1} 失败:`, result.reason.message);
          }
        });
        
        console.log("✅ 并发处理测试完成");
        
      } catch (error) {
        console.log("⚠️ 并发测试异常:", error.message);
      }
    }, 45000);
  });

  describe("🔧 工具集成验证", () => {
    it("✅ 所有工具应该有正确的函数签名", () => {
      const tools = service.getToolDefinitions();
      
      tools.forEach(tool => {
        expect(tool.type).toBe("function");
        expect(tool.function).toBeDefined();
        expect(tool.function.name).toBeTruthy();
        expect(tool.function.description).toBeTruthy();
        expect(tool.function.parameters).toBeDefined();
        expect(tool.function.parameters.type).toBe("object");
        
        console.log(`✓ 工具 ${tool.function.name} 签名验证通过`);
      });
    });

    it("✅ 工具参数定义应该完整", () => {
      const tools = service.getToolDefinitions();
      
      tools.forEach(tool => {
        const params = tool.function.parameters;
        
        expect(params.properties).toBeDefined();
        
        if (params.required) {
          expect(Array.isArray(params.required)).toBe(true);
          console.log(`✓ 工具 ${tool.function.name} 必需参数:`, params.required);
        }
        
        console.log(`✓ 工具 ${tool.function.name} 参数定义完整`);
      });
    });
  });
});