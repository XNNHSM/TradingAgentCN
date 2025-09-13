/**
 * LangGraphJS 服务管理器
 * 统一管理 LangGraphJS 工作流的创建、执行和监控
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMService } from '../services/llm.service';
import { MCPClientSDKService } from '../services/mcp-client-sdk.service';
import { BaseAgent } from '../base/base-agent';
import { BasicDataAgent } from '../unified/basic-data.agent';
import { TechnicalAnalystAgent } from '../unified/technical-analyst.agent';
import { FundamentalAnalystAgent } from '../unified/fundamental-analyst.agent';
import { NewsAnalystAgent } from '../unified/news-analyst.agent';
import { IndustryAnalystAgent } from '../unified/industry-analyst.agent';
import { CompetitiveAnalystAgent } from '../unified/competitive-analyst.agent';
import { ValuationAnalystAgent } from '../unified/valuation-analyst.agent';
// RiskAnalystAgent not found, using existing agents
import { UnifiedOrchestratorAgent } from '../unified/unified-orchestrator.agent';
import { AgentExecutionRecordService } from '../services/agent-execution-record.service';
import { StockAnalysisGraph } from './stock-analysis.graph';
import { LangGraphAgentAdapter, AgentAdapterFactory } from './agent-adapter';
import { BusinessLogger, LogCategory } from '../../common/utils/business-logger.util';
import { LangGraphWorkflowResult, AnalysisState } from './state-manager';

@Injectable()
export class LangGraphServiceManager implements OnModuleInit {
  private readonly logger: BusinessLogger;
  private stockAnalysisGraph: StockAnalysisGraph | null = null;
  private agentAdapters: Map<string, LangGraphAgentAdapter> = new Map();
  private isInitialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly llmService: LLMService,
    private readonly mcpClientService: MCPClientSDKService,
    private readonly executionRecordService: AgentExecutionRecordService,
  ) {
    this.logger = new BusinessLogger(LangGraphServiceManager.name);
  }

  /**
   * 模块初始化
   */
  async onModuleInit(): Promise<void> {
    const langGraphEnabled = this.configService.get<boolean>('LANGGRAPHJS_ENABLED', false);
    
    if (!langGraphEnabled) {
      this.logger.serviceInfo('LangGraphJS 已禁用，使用传统 Temporal 工作流');
      return;
    }

    try {
      await this.initializeLangGraph();
      this.logger.serviceInfo('LangGraphJS 初始化完成');
    } catch (error) {
      this.logger.serviceError('LangGraphJS 初始化失败', error as Error);
      // 不抛出错误，允许系统使用传统工作流
    }
  }

  /**
   * 初始化 LangGraphJS
   */
  private async initializeLangGraph(): Promise<void> {
    this.logger.serviceInfo('开始初始化 LangGraphJS');

    // 创建所有智能体实例
    const agents = await this.createAllAgents();
    
    // 创建智能体适配器
    this.agentAdapters = AgentAdapterFactory.createAdapters(
      agents,
      this.llmService,
      this.mcpClientService
    );

    // 验证适配器
    const validation = AgentAdapterFactory.validateAdapters(this.agentAdapters);
    if (!validation.valid) {
      this.logger.warn(LogCategory.SERVICE_ERROR, '部分智能体适配器创建失败', undefined, {
        failedAdapters: validation.failedAdapters,
        readyAdapters: validation.readyAdapters,
      });
    }

    // 创建股票分析工作流图
    this.stockAnalysisGraph = new StockAnalysisGraph(
      this.llmService,
      this.mcpClientService,
      this.agentAdapters
    );

    this.isInitialized = true;
    
    this.logger.serviceInfo('LangGraphJS 初始化成功', {
      readyAgents: validation.readyAdapters.length,
      failedAgents: validation.failedAdapters.length,
    });
  }

  /**
   * 创建所有智能体实例
   */
  private async createAllAgents(): Promise<BaseAgent[]> {
    const agents: BaseAgent[] = [];

    try {
      // 基础数据智能体
      agents.push(new BasicDataAgent(
        this.llmService,
        this.configService,
        this.executionRecordService,
      ));

      // 技术分析师
      agents.push(new TechnicalAnalystAgent(
        this.llmService,
        this.configService,
        this.executionRecordService,
      ));

      // 基本面分析师
      agents.push(new FundamentalAnalystAgent(
        this.llmService,
        this.configService,
        this.executionRecordService,
      ));

      // 新闻分析师
      agents.push(new NewsAnalystAgent(
        this.llmService,
        this.configService,
        this.executionRecordService,
      ));

      // 行业分析师
      agents.push(new IndustryAnalystAgent(
        this.llmService,
        this.configService,
        this.executionRecordService,
      ));

      // 竞争优势分析师
      agents.push(new CompetitiveAnalystAgent(
        this.llmService,
        this.configService,
        this.executionRecordService,
      ));

      // 估值分析师
      agents.push(new ValuationAnalystAgent(
        this.llmService,
        this.configService,
        this.executionRecordService,
      ));

      // 风险分析师 - temporarily commented as file doesn't exist
      // agents.push(new RiskAnalystAgent(
      //   this.llmService,
      //   this.configService,
      //   this.executionRecordService,
      // ));

      // 统一协调器
      agents.push(new UnifiedOrchestratorAgent(
        this.llmService,
        this.configService,
        this.executionRecordService,
      ));

      this.logger.serviceInfo('智能体实例创建完成', { count: agents.length });

    } catch (error) {
      this.logger.serviceError('创建智能体实例失败', error as Error);
      throw error;
    }

    return agents;
  }

  /**
   * 执行股票分析工作流
   */
  async executeStockAnalysis(input: {
    stockCode: string;
    stockName?: string;
    sessionId: string;
    workflowId?: string;
    enableMessagePush?: boolean;
    isScheduledRun?: boolean;
    metadata?: Record<string, any>;
  }): Promise<LangGraphWorkflowResult> {
    if (!this.isInitialized || !this.stockAnalysisGraph) {
      throw new Error('LangGraphJS 未初始化');
    }

    this.logger.serviceInfo('开始执行 LangGraphJS 股票分析', {
      stockCode: input.stockCode,
      sessionId: input.sessionId,
    });

    try {
      const result = await this.stockAnalysisGraph.execute(input);
      
      this.logger.serviceInfo('LangGraphJS 股票分析完成', {
        stockCode: input.stockCode,
        sessionId: input.sessionId,
        finalScore: result.finalDecision.overallScore,
        recommendation: result.finalDecision.recommendation,
        processingTime: result.executionStats.totalProcessingTime,
        successfulAgents: result.executionStats.successfulAgents,
        failedAgents: result.executionStats.failedAgents,
      });

      return result;

    } catch (error) {
      this.logger.serviceError('LangGraphJS 股票分析失败', error as Error, {
        stockCode: input.stockCode,
        sessionId: input.sessionId,
      });
      throw error;
    }
  }

  /**
   * 获取工作流可视化信息
   */
  getWorkflowVisualization() {
    if (!this.stockAnalysisGraph) {
      throw new Error('LangGraphJS 未初始化');
    }
    
    return this.stockAnalysisGraph.getWorkflowVisualization();
  }

  /**
   * 获取系统健康状态
   */
  getHealthStatus(): {
    initialized: boolean;
    readyAgents: string[];
    failedAgents: string[];
    workflowReady: boolean;
    version: string;
  } {
    const readyAgents = Array.from(this.agentAdapters.entries())
      .filter(([_, adapter]) => adapter.isReady())
      .map(([name]) => name);

    const failedAgents = Array.from(this.agentAdapters.entries())
      .filter(([_, adapter]) => !adapter.isReady())
      .map(([name]) => name);

    return {
      initialized: this.isInitialized,
      readyAgents,
      failedAgents,
      workflowReady: this.stockAnalysisGraph !== null,
      version: '1.0.0',
    };
  }

  /**
   * 获取智能体状态信息
   */
  getAgentsStatus(): Array<{
    name: string;
    type: string;
    description: string;
    ready: boolean;
  }> {
    return Array.from(this.agentAdapters.values()).map(adapter => adapter.getAgentInfo());
  }

  /**
   * 重置 LangGraphJS 服务
   */
  async reset(): Promise<void> {
    this.logger.serviceInfo('重置 LangGraphJS 服务');

    try {
      // 清理现有资源
      this.agentAdapters.clear();
      this.stockAnalysisGraph = null;
      this.isInitialized = false;

      // 重新初始化
      await this.initializeLangGraph();

      this.logger.serviceInfo('LangGraphJS 服务重置完成');

    } catch (error) {
      this.logger.serviceError('LangGraphJS 服务重置失败', error as Error);
      throw error;
    }
  }

  /**
   * 检查是否可用
   */
  isAvailable(): boolean {
    return this.isInitialized && this.stockAnalysisGraph !== null;
  }

  /**
   * 获取配置信息
   */
  getConfig(): {
    enabled: boolean;
    debug: boolean;
    recursionLimit: number;
    timeout: string;
  } {
    return {
      enabled: this.configService.get<boolean>('LANGGRAPHJS_ENABLED', false),
      debug: this.configService.get<boolean>('LANGGRAPHJS_DEBUG', false),
      recursionLimit: this.configService.get<number>('LANGGRAPHJS_RECURSION_LIMIT', 100),
      timeout: this.configService.get<string>('LANGGRAPHJS_TIMEOUT', '10m'),
    };
  }

  /**
   * 执行健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
    timestamp: Date;
  }> {
    const details: Record<string, any> = {
      initialized: this.isInitialized,
      agentCount: this.agentAdapters.size,
      workflowReady: this.stockAnalysisGraph !== null,
    };

    try {
      if (this.isInitialized) {
        const healthStatus = this.getHealthStatus();
        details.readyAgents = healthStatus.readyAgents.length;
        details.failedAgents = healthStatus.failedAgents.length;
        details.workflowReady = healthStatus.workflowReady;

        const totalAgents = healthStatus.readyAgents.length + healthStatus.failedAgents.length;
        const healthRatio = totalAgents > 0 ? healthStatus.readyAgents.length / totalAgents : 0;

        if (healthRatio >= 0.8) {
          return {
            status: 'healthy',
            details,
            timestamp: new Date(),
          };
        } else if (healthRatio >= 0.5) {
          return {
            status: 'degraded',
            details,
            timestamp: new Date(),
          };
        } else {
          return {
            status: 'unhealthy',
            details,
            timestamp: new Date(),
          };
        }
      } else {
        return {
          status: 'unhealthy',
          details: { ...details, reason: 'Service not initialized' },
          timestamp: new Date(),
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { ...details, error: (error as Error).message },
        timestamp: new Date(),
      };
    }
  }
}