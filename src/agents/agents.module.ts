import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// MCP相关服务
import { MCPClientService } from './services/mcp-client.service';
import { LLMService } from './services/llm.service';
import { DashScopeAdapter } from './services/llm-adapters/dashscope-adapter';

// 智能体模块专属Temporal服务
import { AgentsTemporalClientService } from './temporal/agents-temporal-client.service';
import { AgentsWorkerService } from './temporal/agents-worker.service';

// 新的统一智能体
import { ComprehensiveAnalystAgent } from './unified/comprehensive-analyst.agent';
import { TradingStrategistAgent } from './unified/trading-strategist.agent';

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
    
    // 智能体模块专属Temporal服务
    AgentsTemporalClientService,
    AgentsWorkerService,

    // 统一智能体
    ComprehensiveAnalystAgent,
    TradingStrategistAgent,

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
    ComprehensiveAnalystAgent,
    TradingStrategistAgent,
    
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