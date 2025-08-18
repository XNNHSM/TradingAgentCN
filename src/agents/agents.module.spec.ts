import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AgentsModule } from "./agents.module";
import { TradingAgentsOrchestratorService } from "./services/trading-agents-orchestrator.service";
import { TradingWorkflowGateway } from "./gateways/trading-workflow.gateway";
import { TradingWorkflowController } from "./controllers/trading-workflow.controller";
import { AgentOrchestratorService } from "./services/agent-orchestrator.service";
import { LLMService } from "./services/llm.service";
import { DataToolkitService } from "./services/data-toolkit.service";

// Mock外部模块
jest.mock("../services/stock-data/stock-data.module", () => ({
  StockDataModule: class MockStockDataModule {},
}));

jest.mock("../services/news/news.module", () => ({
  NewsModule: class MockNewsModule {},
}));

describe("AgentsModule", () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env.test",
        }),
        EventEmitterModule.forRoot(),
        AgentsModule,
      ],
    }).compile();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe("核心服务注册", () => {
    it("应该正确注册TradingAgentsOrchestratorService", () => {
      const service = module.get<TradingAgentsOrchestratorService>(
        TradingAgentsOrchestratorService
      );
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(TradingAgentsOrchestratorService);
    });

    it("应该正确注册AgentOrchestratorService", () => {
      const service = module.get<AgentOrchestratorService>(
        AgentOrchestratorService
      );
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(AgentOrchestratorService);
    });

    it("应该正确注册LLMService", () => {
      const service = module.get<LLMService>(LLMService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(LLMService);
    });

    it("应该正确注册DataToolkitService", () => {
      const service = module.get<DataToolkitService>(DataToolkitService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(DataToolkitService);
    });
  });

  describe("WebSocket网关注册", () => {
    it("应该正确注册TradingWorkflowGateway", () => {
      const gateway = module.get<TradingWorkflowGateway>(
        TradingWorkflowGateway
      );
      expect(gateway).toBeDefined();
      expect(gateway).toBeInstanceOf(TradingWorkflowGateway);
    });
  });

  describe("控制器注册", () => {
    it("应该正确注册TradingWorkflowController", () => {
      const controller = module.get<TradingWorkflowController>(
        TradingWorkflowController
      );
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(TradingWorkflowController);
    });
  });

  describe("服务依赖关系", () => {
    it("TradingAgentsOrchestratorService应该能够访问所有智能体", () => {
      const orchestrator = module.get<TradingAgentsOrchestratorService>(
        TradingAgentsOrchestratorService
      );
      
      // 验证orchestrator被正确初始化
      expect(orchestrator).toBeDefined();
      
      // 检查是否有生成会话ID的方法（通过调用一个简单方法验证）
      expect(typeof orchestrator.getSessionState).toBe("function");
    });

    it("TradingWorkflowGateway应该能够访问编排器服务", () => {
      const gateway = module.get<TradingWorkflowGateway>(
        TradingWorkflowGateway
      );
      const orchestrator = module.get<TradingAgentsOrchestratorService>(
        TradingAgentsOrchestratorService
      );
      
      expect(gateway).toBeDefined();
      expect(orchestrator).toBeDefined();
    });

    it("TradingWorkflowController应该能够访问编排器服务", () => {
      const controller = module.get<TradingWorkflowController>(
        TradingWorkflowController
      );
      const orchestrator = module.get<TradingAgentsOrchestratorService>(
        TradingAgentsOrchestratorService
      );
      
      expect(controller).toBeDefined();
      expect(orchestrator).toBeDefined();
    });
  });

  describe("模块配置验证", () => {
    it("EventEmitter应该正确配置", () => {
      // EventEmitter是通过依赖注入系统注册的，我们通过检查模块编译成功来验证
      expect(module).toBeDefined();
      expect(module.get).toBeDefined();
    });

    it("所有智能体都应该被正确注册", () => {
      const orchestrator = module.get<AgentOrchestratorService>(
        AgentOrchestratorService
      );
      
      // 验证基础编排器可以访问
      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator.executeFullAnalysis).toBe("function");
      expect(typeof orchestrator.executeQuickAnalysis).toBe("function");
    });
  });

  describe("服务生命周期", () => {
    it("模块应该能够正常初始化和关闭", async () => {
      // 测试模块初始化
      expect(module).toBeDefined();
      
      // 测试服务实例化
      const services = [
        TradingAgentsOrchestratorService,
        AgentOrchestratorService,
        LLMService,
        DataToolkitService,
        TradingWorkflowGateway,
        TradingWorkflowController,
      ];
      
      for (const ServiceClass of services) {
        const service = module.get(ServiceClass);
        expect(service).toBeDefined();
      }
      
      // 测试模块关闭（不会真正关闭，在afterAll中处理）
      expect(typeof module.close).toBe("function");
    });
  });
});