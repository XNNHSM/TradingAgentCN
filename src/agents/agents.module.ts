import {Module} from '@nestjs/common';
import {forwardRef} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {TypeOrmModule} from '@nestjs/typeorm';

// Temporal统一封装模块
import {TemporalModule} from '../temporal/temporal.module';


// 分析模块（为分析记录提供支持）- 使用forwardRef避免循环依赖
import {AnalysisModule} from '../modules/analysis/analysis.module';

// Agents模块专属Temporal Worker服务
import {AgentsWorkerService} from '../temporal/workers/agents/agents-worker.service';

// MCP相关服务
import {MCPClientSDKService} from './services/mcp-client-sdk.service';
import {MCPClientFallbackService} from './services/mcp-client-fallback.service';
import {LLMService} from './services/llm.service';
import {DashScopeAdapter} from './services/llm-adapters/dashscope-adapter';
import {WorkflowStateService} from './services/workflow-state.service';

// 智能体模块专属Temporal服务 - 从统一Temporal模块导入

// 新的按需调用智能体架构
import {BasicDataAgent} from './unified/basic-data.agent';
import {TechnicalAnalystAgent} from './unified/technical-analyst.agent';
import {FundamentalAnalystAgent} from './unified/fundamental-analyst.agent';
import {NewsAnalystAgent} from './unified/news-analyst.agent';
import {SocialMediaAnalystAgent} from './unified/social-media-analyst.agent';
import {QuantitativeTraderAgent} from './unified/quantitative-trader.agent';
import {MacroEconomistAgent} from './unified/macro-economist.agent';
import {UnifiedOrchestratorAgent} from './unified/unified-orchestrator.agent';
import {SummaryGenerationAgent} from './unified/summary-generation.agent';


// 执行记录相关（保持兼容）
import {AgentExecutionRecord} from './entities/agent-execution-record.entity';
import {AgentExecutionRecordService} from './services/agent-execution-record.service';
import {AgentExecutionShardingService} from './services/agent-execution-sharding.service';

// 执行记录控制器
import {ExecutionRecordsController} from './execution-records/execution-records.controller';
import {AgentExecutionRecordsController} from './controllers/agent-execution-records.controller';
import {AgentExecutionRecorderInterceptor} from './interceptors/agent-execution-recorder.interceptor';

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
    forwardRef(() => AnalysisModule), // 导入分析模块，提供分析记录功能
  ],
  providers: [
    // LLM适配器
    DashScopeAdapter,

    // 核心服务
    MCPClientSDKService,
    MCPClientFallbackService,
    LLMService,
    WorkflowStateService,
    
    // 智能体模块专属Temporal Worker服务
    AgentsWorkerService,
    
    // 按需调用智能体架构
    BasicDataAgent,
    TechnicalAnalystAgent,
    FundamentalAnalystAgent,
    NewsAnalystAgent,
    SocialMediaAnalystAgent,
    QuantitativeTraderAgent,
    MacroEconomistAgent,
    UnifiedOrchestratorAgent,
    SummaryGenerationAgent,

    
    // 执行记录服务
    AgentExecutionRecordService,
    AgentExecutionShardingService,
    
    // 拦截器
    AgentExecutionRecorderInterceptor,
  ],
  controllers: [
    ExecutionRecordsController,
    AgentExecutionRecordsController,
  ],
  exports: [
    // 对外提供的主要服务
    MCPClientSDKService,
    
    // 按需调用智能体架构
    BasicDataAgent,
    TechnicalAnalystAgent,
    FundamentalAnalystAgent,
    NewsAnalystAgent,
    SocialMediaAnalystAgent,
    QuantitativeTraderAgent,
    MacroEconomistAgent,
    UnifiedOrchestratorAgent,
    SummaryGenerationAgent,
    
        
    // Temporal服务导出 - 现在从TemporalModule统一管理
    
    // 兼容性导出
    AgentExecutionRecordService,
    LLMService,
  ],
})
export class AgentsModule {
  constructor(
    private readonly mcpClient: MCPClientSDKService,
  ) {}

  /**
   * 模块初始化时自动连接MCP服务
   */
  async onModuleInit() {
    try {
      // 初始化MCP服务
      await this.mcpClient.initialize();
    } catch (error) {
      console.error('模块初始化失败:', error.message);
      console.error('错误堆栈:', error.stack);
      // 重新抛出错误以确保问题被注意到
      throw error;
    }
  }

  /**
   * 模块销毁时断开MCP连接
   */
  async onModuleDestroy() {
    // 断开MCP连接
    await this.mcpClient.disconnect();
  }
}