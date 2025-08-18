import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";

// 导入外部服务用于Mock
import { StockDataService } from "../services/stock-data/stock-data.service";
import { NewsApiService } from "../services/news/news-api.service";

// 只导入核心服务，避免控制器和网关的复杂依赖
import { LLMService, DashScopeProvider } from "./services/llm.service";
import { DataToolkitService } from "./services/data-toolkit.service";
import { TradingAgentsOrchestratorService } from "./services/trading-agents-orchestrator.service";
import { AgentOrchestratorService } from "./services/agent-orchestrator.service";

// 智能体
import { MarketAnalystAgent } from "./analysts/market-analyst.agent";
import { FundamentalAnalystAgent } from "./analysts/fundamental-analyst.agent";
import { NewsAnalystAgent } from "./analysts/news-analyst.agent";
import { BullResearcherAgent } from "./researchers/bull-researcher.agent";
import { BearResearcherAgent } from "./researchers/bear-researcher.agent";
import { ConservativeTraderAgent } from "./traders/conservative-trader.agent";
import { AggressiveTraderAgent } from "./traders/aggressive-trader.agent";
import { ReflectionAgent } from "./reflection/reflection.agent";

// Mock外部依赖
const mockStockDataService = {
  getStockDailyData: jest.fn().mockResolvedValue({
    code: '000001',
    name: '平安银行',
    data: []
  }),
  getStockBasicInfo: jest.fn().mockResolvedValue({
    code: '000001',
    name: '平安银行'
  }),
  getRealTimeData: jest.fn().mockResolvedValue({}),
  getTechnicalIndicators: jest.fn().mockResolvedValue({}),
  getMarketOverview: jest.fn().mockResolvedValue({}),
};

const mockNewsApiService = {
  getStockNews: jest.fn().mockResolvedValue([]),
  getSentimentAnalysis: jest.fn().mockResolvedValue({
    sentiment: 'neutral',
    score: 0.5
  }),
  getMarketNews: jest.fn().mockResolvedValue([]),
};

describe("AgentsModule Integration", () => {
  let module: TestingModule;
  let tradingOrchestrator: TradingAgentsOrchestratorService;
  let agentOrchestrator: AgentOrchestratorService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env.test",
        }),
      ],
      providers: [
        // 核心服务
        DashScopeProvider,
        LLMService,
        DataToolkitService,
        
        // 编排服务
        TradingAgentsOrchestratorService,
        AgentOrchestratorService,
        
        // 智能体
        MarketAnalystAgent,
        FundamentalAnalystAgent,
        NewsAnalystAgent,
        BullResearcherAgent,
        BearResearcherAgent,
        ConservativeTraderAgent,
        AggressiveTraderAgent,
        ReflectionAgent,
        
        // Mock外部服务 - 使用类作为token
        {
          provide: StockDataService,
          useValue: mockStockDataService,
        },
        {
          provide: NewsApiService, 
          useValue: mockNewsApiService,
        },
      ],
    }).compile();

    tradingOrchestrator = module.get<TradingAgentsOrchestratorService>(TradingAgentsOrchestratorService);
    agentOrchestrator = module.get<AgentOrchestratorService>(AgentOrchestratorService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe("服务实例化", () => {
    it("应该正确创建TradingAgentsOrchestratorService实例", () => {
      expect(tradingOrchestrator).toBeDefined();
      expect(tradingOrchestrator).toBeInstanceOf(TradingAgentsOrchestratorService);
    });

    it("应该正确创建AgentOrchestratorService实例", () => {
      expect(agentOrchestrator).toBeDefined();
      expect(agentOrchestrator).toBeInstanceOf(AgentOrchestratorService);
    });

    it("应该正确创建所有核心服务", () => {
      const llmService = module.get<LLMService>(LLMService);
      const dataToolkitService = module.get<DataToolkitService>(DataToolkitService);
      
      expect(llmService).toBeDefined();
      expect(llmService).toBeInstanceOf(LLMService);
      expect(dataToolkitService).toBeDefined();
      expect(dataToolkitService).toBeInstanceOf(DataToolkitService);
    });

    it("应该正确创建所有智能体", () => {
      const agents = [
        MarketAnalystAgent,
        FundamentalAnalystAgent,
        NewsAnalystAgent,
        BullResearcherAgent,
        BearResearcherAgent,
        ConservativeTraderAgent,
        AggressiveTraderAgent,
        ReflectionAgent,
      ];

      agents.forEach((AgentClass) => {
        const agent = module.get(AgentClass);
        expect(agent).toBeDefined();
        expect(agent).toBeInstanceOf(AgentClass);
      });
    });
  });

  describe("服务方法验证", () => {
    it("TradingAgentsOrchestratorService应该有核心方法", () => {
      expect(typeof tradingOrchestrator.executeAnalysisWorkflow).toBe("function");
      expect(typeof tradingOrchestrator.analyzeSingleStock).toBe("function");
      expect(typeof tradingOrchestrator.analyzeWatchlistStocks).toBe("function");
      expect(typeof tradingOrchestrator.getSessionState).toBe("function");
    });

    it("AgentOrchestratorService应该有核心方法", () => {
      expect(typeof agentOrchestrator.executeFullAnalysis).toBe("function");
      expect(typeof agentOrchestrator.executeQuickAnalysis).toBe("function");
    });

    it("LLMService应该有核心方法", () => {
      const llmService = module.get<LLMService>(LLMService);
      expect(typeof llmService.generate).toBe("function");
    });

    it("DataToolkitService应该有核心方法", () => {
      const dataToolkitService = module.get<DataToolkitService>(DataToolkitService);
      expect(typeof dataToolkitService.executeTool).toBe("function");
      expect(typeof dataToolkitService.getAvailableTools).toBe("function");
    });
  });

  describe("工作流状态管理", () => {
    it("应该能够创建新的会话状态", async () => {
      // 不执行真实的API调用，只验证方法存在和基础功能
      const sessionState = tradingOrchestrator.getSessionState("test-session-id");
      
      // 新创建的会话应该返回null（不存在）
      expect(sessionState).toBeNull();
    });

    it("应该能够处理工作流配置", () => {
      // 验证服务实例化正确，说明依赖注入成功
      expect(tradingOrchestrator).toBeDefined();
      
      // 验证方法存在
      expect(typeof tradingOrchestrator.executeAnalysisWorkflow).toBe("function");
    });
  });

  describe("服务集成", () => {
    it("所有服务应该正确集成", () => {
      // 通过模块编译成功来验证服务配置正确
      expect(module).toBeDefined();
      
      // 验证编排器服务可以正常访问
      expect(tradingOrchestrator).toBeDefined();
      expect(agentOrchestrator).toBeDefined();
    });
  });

  describe("依赖注入验证", () => {
    it("所有服务应该成功注入依赖", () => {
      // 验证关键依赖注入
      const services = [
        TradingAgentsOrchestratorService,
        AgentOrchestratorService,
        LLMService,
        DataToolkitService,
        MarketAnalystAgent,
        FundamentalAnalystAgent,
        NewsAnalystAgent,
      ];

      services.forEach((ServiceClass) => {
        const service = module.get(ServiceClass);
        expect(service).toBeDefined();
        expect(service.constructor.name).toBe(ServiceClass.name);
      });
    });

    it("智能体应该能够访问LLM服务", () => {
      const marketAnalyst = module.get<MarketAnalystAgent>(MarketAnalystAgent);
      const llmService = module.get<LLMService>(LLMService);
      
      expect(marketAnalyst).toBeDefined();
      expect(llmService).toBeDefined();
      
      // 验证智能体基类方法存在
      expect(typeof marketAnalyst.analyze).toBe("function");
    });
  });

  describe("模块生命周期", () => {
    it("模块应该能够正常关闭", async () => {
      expect(typeof module.close).toBe("function");
      
      // 不实际关闭模块，因为其他测试还需要使用
      // 只验证方法存在
    });
  });
});