import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { StockDataModule } from "../services/stock-data/stock-data.module";
import { NewsModule } from "../services/news/news.module";

// 服务
import { LLMService, DashScopeProvider } from "./services/llm.service";
import { AgentOrchestratorService } from "./services/agent-orchestrator.service";
import { TradingAgentsOrchestratorService } from "./services/trading-agents-orchestrator.service";
import { DataToolkitService } from "./services/data-toolkit.service";

// 新的LLM适配器
import { LLMServiceV2, DashScopeAdapter } from "./services/llm-adapters";

// 分析师
import { MarketAnalystAgent } from "./analysts/market-analyst.agent";
import { FundamentalAnalystAgent } from "./analysts/fundamental-analyst.agent";
import { NewsAnalystAgent } from "./analysts/news-analyst.agent";

// 研究员
import { BullResearcherAgent } from "./researchers/bull-researcher.agent";
import { BearResearcherAgent } from "./researchers/bear-researcher.agent";

// 管理员
import { ResearchManagerAgent } from "./managers/research-manager.agent";
import { RiskManagerAgent } from "./managers/risk-manager.agent";

// 交易员
import { ConservativeTraderAgent } from "./traders/conservative-trader.agent";
import { AggressiveTraderAgent } from "./traders/aggressive-trader.agent";

// 反思
import { ReflectionAgent } from "./reflection/reflection.agent";

/**
 * 智能体模块 - 集成所有AI智能体
 */
@Module({
  imports: [
    ConfigModule, 
    StockDataModule, 
    NewsModule,
  ],
  providers: [
    // 核心服务（旧版本，向后兼容）
    DashScopeProvider,
    LLMService,
    DataToolkitService,
    
    // 新的LLM适配器服务
    DashScopeAdapter,
    LLMServiceV2,
    
    // 编排服务
    AgentOrchestratorService,
    TradingAgentsOrchestratorService,

    // 分析师团队
    MarketAnalystAgent,
    FundamentalAnalystAgent,
    NewsAnalystAgent,

    // 研究员团队
    BullResearcherAgent,
    BearResearcherAgent,

    // 管理员团队
    ResearchManagerAgent,
    RiskManagerAgent,

    // 交易员团队
    ConservativeTraderAgent,
    AggressiveTraderAgent,

    // 反思系统
    ReflectionAgent,
  ],
  exports: [
    // 对外暴露主要服务
    AgentOrchestratorService,
    TradingAgentsOrchestratorService,
    LLMService,
    LLMServiceV2, // 导出新的LLM服务供其他模块使用
    DataToolkitService,

    // 导出所有智能体供其他模块使用
    MarketAnalystAgent,
    FundamentalAnalystAgent,
    NewsAnalystAgent,
    BullResearcherAgent,
    BearResearcherAgent,
    ResearchManagerAgent,
    RiskManagerAgent,
    ConservativeTraderAgent,
    AggressiveTraderAgent,
    ReflectionAgent,
  ],
})
export class AgentsModule {}
