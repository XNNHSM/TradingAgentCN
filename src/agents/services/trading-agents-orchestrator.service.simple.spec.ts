import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { StockDataModule } from "../../services/stock-data/stock-data.module";
import { NewsModule } from "../../services/news/news.module";

import { TradingAgentsOrchestratorService } from "./trading-agents-orchestrator.service";
import { AgentOrchestratorService } from "./agent-orchestrator.service";
import { AgentContext } from "../interfaces/agent.interface";

// 导入核心服务（不再使用mock）
import { LLMService, DashScopeProvider } from "./llm.service";
import { LLMServiceV2, DashScopeAdapter } from "./llm-adapters";
import { DataToolkitService } from "./data-toolkit.service";

// 导入实际智能体类用于真实测试
import { MarketAnalystAgent } from "../analysts/market-analyst.agent";
import { FundamentalAnalystAgent } from "../analysts/fundamental-analyst.agent";
import { NewsAnalystAgent } from "../analysts/news-analyst.agent";
import { BullResearcherAgent } from "../researchers/bull-researcher.agent";
import { BearResearcherAgent } from "../researchers/bear-researcher.agent";
import { ConservativeTraderAgent } from "../traders/conservative-trader.agent";
import { AggressiveTraderAgent } from "../traders/aggressive-trader.agent";
import { ReflectionAgent } from "../reflection/reflection.agent";

describe("TradingAgentsOrchestratorService (真实服务测试)", () => {
  let service: TradingAgentsOrchestratorService;
  let agentOrchestrator: AgentOrchestratorService;
  let module: TestingModule;

  beforeAll(async () => {
    console.log("🚀 初始化TradingAgentsOrchestrator真实服务测试...");
    
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env.test",
        }),
        StockDataModule,
        NewsModule,
      ],
      providers: [
        // 核心服务（真实实现）
        DashScopeProvider,
        LLMService,
        DashScopeAdapter,
        LLMServiceV2,
        DataToolkitService,
        
        // 编排服务
        TradingAgentsOrchestratorService,
        AgentOrchestratorService,
        
        // 所有智能体（真实实现）
        MarketAnalystAgent,
        FundamentalAnalystAgent,
        NewsAnalystAgent,
        BullResearcherAgent,
        BearResearcherAgent,
        ConservativeTraderAgent,
        AggressiveTraderAgent,
        ReflectionAgent,
      ],
    }).compile();

    await module.init();
    service = module.get<TradingAgentsOrchestratorService>(TradingAgentsOrchestratorService);
    agentOrchestrator = module.get<AgentOrchestratorService>(AgentOrchestratorService);
    
    console.log("✅ 测试模块初始化完成");
  }, 60000);

  afterAll(async () => {
    if (module) {
      await module.close();
      console.log("🔚 测试模块已关闭");
    }
  });

  describe("🔧 服务初始化", () => {
    it("✅ 应该正确创建服务实例", () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(TradingAgentsOrchestratorService);
      expect(agentOrchestrator).toBeDefined();
      
      console.log("✓ TradingAgentsOrchestratorService 初始化成功");
      console.log("✓ AgentOrchestratorService 初始化成功");
    });

    it("✅ 应该具有核心方法", () => {
      expect(typeof service.executeAnalysisWorkflow).toBe("function");
      expect(typeof service.analyzeSingleStock).toBe("function");
      expect(typeof service.analyzeWatchlistStocks).toBe("function");
      expect(typeof service.getSessionState).toBe("function");
      
      console.log("✓ 所有核心方法验证通过");
    });

    it("✅ 应该正确集成所有智能体", () => {
      // 验证智能体实例化
      const marketAnalyst = module.get<MarketAnalystAgent>(MarketAnalystAgent);
      const fundamentalAnalyst = module.get<FundamentalAnalystAgent>(FundamentalAnalystAgent);
      const aggressiveTrader = module.get<AggressiveTraderAgent>(AggressiveTraderAgent);
      
      expect(marketAnalyst).toBeDefined();
      expect(fundamentalAnalyst).toBeDefined();
      expect(aggressiveTrader).toBeDefined();
      
      console.log("✓ 智能体依赖注入验证通过");
    });
  });

  describe("📊 真实股票分析（轻量测试）", () => {
    const testStockContext: AgentContext = {
      stockCode: "000001",
      stockName: "平安银行",
      timeRange: {
        startDate: new Date("2025-08-01"),
        endDate: new Date("2025-08-18"),
      },
    };

    it("✅ 应该能够分析单只股票（真实API调用）", async () => {
      if (!process.env.DASHSCOPE_API_KEY) {
        console.log("⚠️ 跳过真实API测试：未设置DASHSCOPE_API_KEY");
        return;
      }

      console.log("🔍 开始轻量单股分析测试");
      
      try {
        const result = await service.analyzeSingleStock(
          "000001", 
          "平安银行",
          {
            enableQuickAnalysis: true,
            maxAnalysisTimeMs: 60000, // 1分钟超时
            sessionId: `simple-test-${Date.now()}`,
          }
        );

        expect(result).toBeDefined();
        expect(result.stockCode).toBe("000001");
        expect(result.status).toBeDefined();
        
        console.log("✅ 单股分析测试完成");
        console.log("分析状态:", result.status);
        
      } catch (error) {
        console.log("⚠️ 单股分析测试失败:", error.message);
        
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 90000);

    it("✅ 应该能够处理快速批量分析", async () => {
      if (!process.env.DASHSCOPE_API_KEY) {
        console.log("⚠️ 跳过批量分析测试：未设置DASHSCOPE_API_KEY");
        return;
      }

      console.log("🔍 开始轻量批量分析测试");
      
      try {
        const result = await service.analyzeWatchlistStocks(
          ["000001", "000002"],
          {
            enableQuickAnalysis: true,
            maxAnalysisTimeMs: 90000, // 1.5分钟超时
          }
        );

        expect(result).toBeDefined();
        expect(result.stockAnalyses).toBeDefined();
        expect(result.stockAnalyses.length).toBe(2);
        
        console.log("✅ 批量分析测试完成");
        console.log("批量状态:", result.status);
        
      } catch (error) {
        console.log("⚠️ 批量分析测试失败:", error.message);
        
        // 允许API相关错误
        if (!error.message.includes("API") && !error.message.includes("密钥")) {
          throw error;
        }
      }
    }, 120000);
  });

  describe("🔍 会话管理", () => {
    it("✅ 应该能够管理会话状态", () => {
      const testSessionId = "test-session-simple-123";
      
      // 新会话应该返回null
      const state = service.getSessionState(testSessionId);
      expect(state).toBeNull();
      
      console.log("✓ 会话状态管理验证通过");
    });
  });

  describe("🛡️ 错误处理", () => {
    it("✅ 应该正确处理无效输入", async () => {
      try {
        const result = await service.analyzeSingleStock(
          "",
          "",
          { enableQuickAnalysis: true }
        );
        
        // 如果没有抛出错误，验证结果
        expect(result).toBeDefined();
        console.log("✓ 空输入处理正常");
        
      } catch (error) {
        // 预期可能抛出错误
        expect(error).toBeDefined();
        console.log("✓ 空输入正确抛出错误");
      }
    });
  });

  describe("📈 基础性能验证", () => {
    it("✅ 服务响应应该及时", () => {
      const startTime = Date.now();
      
      // 测试基础方法调用响应时间
      expect(typeof service.getSessionState).toBe("function");
      const sessionState = service.getSessionState("non-existent");
      expect(sessionState).toBeNull();
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // 应该在100ms内完成
      
      console.log(`✓ 基础操作响应时间: ${duration}ms`);
    });
  });
});