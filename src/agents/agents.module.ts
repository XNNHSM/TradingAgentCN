import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// 服务
import { LLMService, DashScopeProvider } from './services/llm.service';
import { AgentOrchestratorService } from './services/agent-orchestrator.service';

// 分析师
import { MarketAnalystAgent } from './analysts/market-analyst.agent';
import { FundamentalAnalystAgent } from './analysts/fundamental-analyst.agent';
import { NewsAnalystAgent } from './analysts/news-analyst.agent';

// 研究员
import { BullResearcherAgent } from './researchers/bull-researcher.agent';
import { BearResearcherAgent } from './researchers/bear-researcher.agent';

// 交易员
import { ConservativeTraderAgent } from './traders/conservative-trader.agent';
import { AggressiveTraderAgent } from './traders/aggressive-trader.agent';

// 反思
import { ReflectionAgent } from './reflection/reflection.agent';

/**
 * 智能体模块 - 集成所有AI智能体
 */
@Module({
  imports: [ConfigModule],
  providers: [
    // 核心服务
    DashScopeProvider,
    LLMService,
    AgentOrchestratorService,
    
    // 分析师团队
    MarketAnalystAgent,
    FundamentalAnalystAgent,
    NewsAnalystAgent,
    
    // 研究员团队
    BullResearcherAgent,
    BearResearcherAgent,
    
    // 交易员团队
    ConservativeTraderAgent,
    AggressiveTraderAgent,
    
    // 反思系统
    ReflectionAgent,
  ],
  exports: [
    // 对外暴露主要服务
    AgentOrchestratorService,
    LLMService,
    
    // 导出所有智能体供其他模块使用
    MarketAnalystAgent,
    FundamentalAnalystAgent,
    NewsAnalystAgent,
    BullResearcherAgent,
    BearResearcherAgent,
    ConservativeTraderAgent,
    AggressiveTraderAgent,
    ReflectionAgent,
  ],
})
export class AgentsModule {}