import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// MCP相关服务
import { MCPClientService } from './services/mcp-client.service';
import { LLMService } from './services/llm.service';
import { DashScopeAdapter } from './services/llm-adapters/dashscope-adapter';

// 新的统一智能体
import { ComprehensiveAnalystAgent } from './unified/comprehensive-analyst.agent';
import { TradingStrategistAgent } from './unified/trading-strategist.agent';
import { UnifiedOrchestratorService } from './unified/unified-orchestrator.service';

// 执行记录相关（保持兼容）
import { AgentExecutionRecord } from './entities/agent-execution-record.entity';
import { AgentExecutionRecordService } from './services/agent-execution-record.service';
import { AgentExecutionShardingService } from './services/agent-execution-sharding.service';

// 执行记录控制器
import { ExecutionRecordsController } from './execution-records/execution-records.controller';

/**
 * 智能体模块
 * 基于阿里云百炼MCP协议的新一代智能体架构
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AgentExecutionRecord]),
  ],
  providers: [
    // LLM适配器
    DashScopeAdapter,
    
    // 核心服务
    MCPClientService,
    LLMService,

    // 统一智能体
    ComprehensiveAnalystAgent,
    TradingStrategistAgent,
    UnifiedOrchestratorService,

    // 执行记录服务
    AgentExecutionRecordService,
    AgentExecutionShardingService,
  ],
  controllers: [
    ExecutionRecordsController,
  ],
  exports: [
    // 对外提供的主要服务
    UnifiedOrchestratorService,
    MCPClientService,
    ComprehensiveAnalystAgent,
    TradingStrategistAgent,
    
    // 兼容性导出
    AgentExecutionRecordService,
    LLMService,
  ],
})
export class AgentsModule {
  constructor(
    private readonly mcpClient: MCPClientService,
  ) {}

  /**
   * 模块初始化时自动连接MCP服务
   */
  async onModuleInit() {
    try {
      await this.mcpClient.initialize();
    } catch (error) {
      console.warn('MCP服务初始化失败，将在首次使用时重试:', error.message);
    }
  }

  /**
   * 模块销毁时断开MCP连接
   */
  async onModuleDestroy() {
    await this.mcpClient.disconnect();
  }
}