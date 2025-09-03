import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Temporal统一封装模块
import { TemporalModule } from '../common/temporal/temporal.module';

// 新闻模块（为政策分析提供数据支持）
import { NewsModule } from '../modules/news/news.module';

// MCP相关服务
import { MCPClientService } from './services/mcp-client.service';
import { MCPClientSDKService } from './services/mcp-client-sdk.service';
import { LLMService } from './services/llm.service';
import { DashScopeAdapter } from './services/llm-adapters/dashscope-adapter';

// 智能体模块专属Temporal服务
import { AgentsTemporalClientService } from './temporal/agents-temporal-client.service';
import { AgentsWorkerService } from './temporal/agents-worker.service';

// 新的按需调用智能体架构
import { BasicDataAgent } from './unified/basic-data.agent';
import { TechnicalAnalystAgent } from './unified/technical-analyst.agent';
import { FundamentalAnalystAgent } from './unified/fundamental-analyst.agent';
import { NewsAnalystAgent } from './unified/news-analyst.agent';
import { SocialMediaAnalystAgent } from './unified/social-media-analyst.agent';
import { QuantitativeTraderAgent } from './unified/quantitative-trader.agent';
import { MacroEconomistAgent } from './unified/macro-economist.agent';
import { UnifiedOrchestratorAgent } from './unified/unified-orchestrator.agent';
import { PolicyAnalystAgent } from './policy/policy-analyst.agent';

// 执行记录相关（保持兼容）
import { AgentExecutionRecord } from './entities/agent-execution-record.entity';
import { AgentExecutionRecordService } from './services/agent-execution-record.service';
import { AgentExecutionShardingService } from './services/agent-execution-sharding.service';

// 执行记录控制器
import { ExecutionRecordsController } from './execution-records/execution-records.controller';

/**
 * 智能体模块
 * 基于阿里云百炼MCP协议的按需调用智能体架构
 * 每个智能体专注于特定的MCP服务调用，避免重复调用
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AgentExecutionRecord]),
    TemporalModule, // 导入Temporal统一封装模块
    NewsModule, // 导入新闻模块，提供政策分析数据支持
  ],
  providers: [
    // LLM适配器
    DashScopeAdapter,
    
    // 核心服务
    MCPClientService,
    MCPClientSDKService,
    LLMService,
    
    // 智能体模块专属Temporal服务
    AgentsTemporalClientService,
    AgentsWorkerService,

    // 按需调用智能体架构
    BasicDataAgent,
    TechnicalAnalystAgent,
    FundamentalAnalystAgent,
    NewsAnalystAgent,
    SocialMediaAnalystAgent,
    QuantitativeTraderAgent,
    MacroEconomistAgent,
    PolicyAnalystAgent,
    UnifiedOrchestratorAgent,

    // 执行记录服务
    AgentExecutionRecordService,
    AgentExecutionShardingService,
  ],
  controllers: [
    ExecutionRecordsController,
  ],
  exports: [
    // 对外提供的主要服务
    MCPClientService,
    
    // 按需调用智能体架构
    BasicDataAgent,
    TechnicalAnalystAgent,
    FundamentalAnalystAgent,
    NewsAnalystAgent,
    SocialMediaAnalystAgent,
    QuantitativeTraderAgent,
    MacroEconomistAgent,
    PolicyAnalystAgent,
    UnifiedOrchestratorAgent,
    
    // Temporal服务导出
    AgentsTemporalClientService,
    AgentsWorkerService,
    
    // 兼容性导出
    AgentExecutionRecordService,
    LLMService,
  ],
})
export class AgentsModule {
  constructor(
    private readonly mcpClient: MCPClientService,
    private readonly agentsWorkerService: AgentsWorkerService,
  ) {}

  /**
   * 模块初始化时自动连接MCP服务和启动Temporal Workers
   */
  async onModuleInit() {
    try {
      // 初始化MCP服务
      await this.mcpClient.initialize();
      
      // 启动智能体模块专属的Temporal Workers
      await this.agentsWorkerService.startWorkers();
    } catch (error) {
      console.warn('模块初始化部分失败，将在使用时重试:', error.message);
    }
  }

  /**
   * 模块销毁时断开MCP连接和停止Temporal Workers
   */
  async onModuleDestroy() {
    // 停止Temporal Workers
    await this.agentsWorkerService.shutdown();
    
    // 断开MCP连接
    await this.mcpClient.disconnect();
  }
}