/**
 * LangGraphJS 智能体节点适配器
 * 将现有的 BaseAgent 转换为 LangGraphJS 可用的节点
 */

import { BaseAgent } from '../base/base-agent';
import { AgentContext, AgentResult, AgentType } from '../interfaces/agent.interface';
import { AnalysisState, AnalysisError } from './state-manager';
import { BusinessLogger, LogCategory } from '../../common/utils/business-logger.util';

/**
 * 智能体节点适配器
 */
export class LangGraphAgentAdapter {
  private readonly logger: BusinessLogger;
  
  constructor(
    private readonly agent: BaseAgent,
    private readonly llmService: any,
    private readonly mcpClientService: any
  ) {
    this.logger = new BusinessLogger(LangGraphAgentAdapter.name);
  }

  /**
   * 将智能体转换为 LangGraphJS 节点函数
   */
  toNode(): (state: AnalysisState) => Promise<Partial<AnalysisState>> {
    return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
      const startTime = Date.now();
      const nodeName = `${this.agent.name}_node`;
      
      this.logger.info(LogCategory.AGENT_INFO, `开始执行智能体节点: ${nodeName}`, undefined, {
        stockCode: state.stockCode,
        sessionId: state.sessionId,
        currentStage: state.currentStage,
      });

      try {
        // 构建智能体上下文
        const agentContext = this.buildAgentContext(state);
        
        // 执行智能体分析
        const result: AgentResult = await this.executeAgentAnalysis(agentContext);
        
        // 验证结果
        const validatedResult = this.validateAgentResult(result, state);
        
        // 更新状态
        const updatedResults = new Map(state.analysisResults || new Map());
        updatedResults.set(this.agent.name, validatedResult);

        const processingTime = Date.now() - startTime;
        
        this.logger.info(LogCategory.AGENT_INFO, `智能体节点执行完成: ${nodeName}`, undefined, {
          processingTime,
          score: validatedResult.score,
          recommendation: validatedResult.recommendation,
          confidence: validatedResult.confidence,
        });

        return {
          analysisResults: updatedResults,
          currentStage: `${this.agent.name}_completed`,
          processingTime,
        };
        
      } catch (error) {
        return this.handleAgentError(error, state, startTime);
      }
    };
  }

  /**
   * 构建智能体上下文
   */
  private buildAgentContext(state: AnalysisState): AgentContext {
    const previousResults = Array.from(state.analysisResults?.values() || []);
    
    const context: AgentContext = {
      stockCode: state.stockCode,
      stockName: state.stockName,
      sessionId: state.sessionId,
      previousResults,
      metadata: {
        mcpData: state.mcpData,
        currentStage: state.currentStage,
        enableMessagePush: state.enableMessagePush,
        isScheduledRun: state.isScheduledRun,
        ...state.metadata,
      },
    };

    // 根据智能体类型添加特定的上下文信息
    this.enrichContextByAgentType(context, state);

    return context;
  }

  /**
   * 根据智能体类型丰富上下文
   */
  private enrichContextByAgentType(context: AgentContext, state: AnalysisState): void {
    const agentType = this.agent.type;
    const mcpData = state.mcpData;

    switch (agentType) {
      case AgentType.BASIC_DATA_AGENT:
        context.metadata = {
          ...context.metadata,
          mcpData: {
            basicInfo: mcpData.basicInfo,
            realtimeData: mcpData.realtimeData,
          },
        };
        break;

      case AgentType.TECHNICAL_ANALYST_NEW:
        context.metadata = {
          ...context.metadata,
          mcpData: {
            historicalData: mcpData.historicalData,
            technicalIndicators: mcpData.technicalIndicators,
          },
        };
        break;

      case AgentType.FUNDAMENTAL_ANALYST_NEW:
        context.metadata = {
          ...context.metadata,
          mcpData: {
            financialData: mcpData.financialData,
          },
        };
        break;

      case AgentType.INDUSTRY_ANALYST:
        context.metadata = {
          ...context.metadata,
          basicInfo: mcpData.basicInfo,
          marketOverview: mcpData.marketOverview,
        };
        break;

      case AgentType.COMPETITIVE_ANALYST:
        context.metadata = {
          ...context.metadata,
          basicInfo: mcpData.basicInfo,
          financialData: mcpData.financialData,
          marketOverview: mcpData.marketOverview,
        };
        break;

      case AgentType.VALUATION_ANALYST:
        context.metadata = {
          ...context.metadata,
          basicInfo: mcpData.basicInfo,
          financialData: mcpData.financialData,
          realtimeData: mcpData.realtimeData,
        };
        break;

      case AgentType.RISK_ANALYST:
        context.metadata = {
          ...context.metadata,
          allMcpData: mcpData,
        };
        break;

      case AgentType.NEWS_ANALYST_NEW:
        context.metadata = {
          ...context.metadata,
          mcpData: {
            news: mcpData.news,
          },
        };
        break;

      case AgentType.UNIFIED_ORCHESTRATOR:
        // 统一协调器不需要特定的 MCP 数据
        break;

      default:
        this.logger.warn(LogCategory.AGENT_ERROR, `未知的智能体类型: ${agentType}`, undefined, { agentName: this.agent.name });
        break;
    }
  }

  /**
   * 执行智能体分析
   */
  private async executeAgentAnalysis(context: AgentContext): Promise<AgentResult> {
    try {
      return await this.agent.analyze(context);
    } catch (error) {
      this.logger.error(LogCategory.AGENT_ERROR, `智能体分析失败: ${this.agent.name}`, error as Error, undefined, {
        stockCode: context.stockCode,
        sessionId: context.sessionId,
      });
      throw error;
    }
  }

  /**
   * 验证智能体结果
   */
  private validateAgentResult(result: AgentResult, state: AnalysisState): AgentResult {
    const validatedResult = { ...result };

    // 确保基本字段存在
    if (!validatedResult.agentName) {
      validatedResult.agentName = this.agent.name;
    }

    if (!validatedResult.agentType) {
      validatedResult.agentType = this.agent.type;
    }

    if (!validatedResult.timestamp) {
      validatedResult.timestamp = new Date();
    }

    // 验证评分范围
    if (validatedResult.score !== undefined) {
      validatedResult.score = Math.max(0, Math.min(100, validatedResult.score));
    }

    // 验证置信度范围
    if (validatedResult.confidence !== undefined) {
      validatedResult.confidence = Math.max(0, Math.min(1, validatedResult.confidence));
    }

    // 确保股票名称一致性
    if (!validatedResult.stockName && state.stockName) {
      validatedResult.stockName = state.stockName;
    }

    // 确保数组和字段存在
    validatedResult.keyInsights = validatedResult.keyInsights || [];
    validatedResult.risks = validatedResult.risks || [];
    validatedResult.supportingData = validatedResult.supportingData || {};

    return validatedResult;
  }

  /**
   * 处理智能体执行错误
   */
  private handleAgentError(
    error: any, 
    state: AnalysisState, 
    startTime: number
  ): Partial<AnalysisState> {
    const processingTime = Date.now() - startTime;
    const errorMessage = error.message || '未知错误';
    
    this.logger.error(LogCategory.AGENT_ERROR, `智能体节点执行失败: ${this.agent.name}`, error, undefined, {
      stockCode: state.stockCode,
      sessionId: state.sessionId,
      processingTime,
    });

    // 创建错误记录
    const analysisError: AnalysisError = {
      agentName: this.agent.name,
      error: errorMessage,
      type: this.getErrorType(error),
      timestamp: new Date(),
      retryable: this.isRetryableError(error),
    };

    // 创建默认结果
    const defaultResult: AgentResult = {
      agentName: this.agent.name,
      agentType: this.agent.type,
      analysis: `${this.agent.name}分析失败: ${errorMessage}`,
      score: 50,
      recommendation: 'HOLD' as any,
      confidence: 0.1,
      keyInsights: ['数据获取异常', '建议人工核实'],
      risks: ['分析可能不准确', '建议获取更多信息'],
      supportingData: {
        error: errorMessage,
        errorType: analysisError.type,
        retryable: analysisError.retryable,
      },
      timestamp: new Date(),
      success: false,
      processingTime,
    };

    // 更新状态
    const updatedResults = new Map(state.analysisResults || new Map());
    updatedResults.set(this.agent.name, defaultResult);

    return {
      analysisResults: updatedResults,
      currentStage: `${this.agent.name}_failed`,
      errors: [...(state.errors || []), analysisError],
      processingTime,
    };
  }

  /**
   * 获取错误类型
   */
  private getErrorType(error: any): AnalysisError['type'] {
    const errorMessage = error.message || '';
    const errorType = error.type || '';

    if (errorMessage.includes('timeout') || errorType.includes('TIMEOUT')) {
      return 'TIMEOUT';
    }
    
    if (errorMessage.includes('rate limit') || 
        errorMessage.includes('rate_limit') || 
        errorMessage.includes('429') ||
        errorType.includes('RATE_LIMIT')) {
      return 'RATE_LIMIT';
    }
    
    if (errorMessage.includes('API key') || 
        errorMessage.includes('auth') || 
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('401') ||
        errorType.includes('AUTH_ERROR')) {
      return 'AUTH_ERROR';
    }
    
    if (errorMessage.includes('data') || 
        errorMessage.includes('fetch') || 
        errorMessage.includes('网络') ||
        errorType.includes('DATA_ERROR')) {
      return 'DATA_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: any): boolean {
    const nonRetryableErrors = ['AUTH_ERROR', 'DATA_ERROR'];
    const errorType = this.getErrorType(error);
    return !nonRetryableErrors.includes(errorType);
  }

  /**
   * 获取智能体名称
   */
  getAgentName(): string {
    return this.agent.name;
  }

  /**
   * 获取智能体类型
   */
  getAgentType(): string {
    return this.agent.type;
  }

  /**
   * 检查智能体是否就绪
   */
  isReady(): boolean {
    return this.agent && typeof this.agent.analyze === 'function';
  }

  /**
   * 获取智能体配置信息
   */
  getAgentInfo(): {
    name: string;
    type: string;
    description: string;
    ready: boolean;
  } {
    return {
      name: this.agent.name,
      type: this.agent.type,
      description: '智能体节点适配器',
      ready: this.isReady(),
    };
  }
}

/**
 * 智能体适配器工厂
 */
export class AgentAdapterFactory {
  /**
   * 创建智能体适配器
   */
  static createAdapter(
    agent: BaseAgent,
    llmService: any,
    mcpClientService: any
  ): LangGraphAgentAdapter {
    if (!agent || typeof agent.analyze !== 'function') {
      throw new Error('无效的智能体对象，必须实现 analyze 方法');
    }

    return new LangGraphAgentAdapter(agent, llmService, mcpClientService);
  }

  /**
   * 批量创建适配器
   */
  static createAdapters(
    agents: BaseAgent[],
    llmService: any,
    mcpClientService: any
  ): Map<string, LangGraphAgentAdapter> {
    const adapters = new Map<string, LangGraphAgentAdapter>();

    for (const agent of agents) {
      try {
        const adapter = this.createAdapter(agent, llmService, mcpClientService);
        adapters.set(agent.name, adapter);
      } catch (error) {
        console.error(`创建智能体适配器失败: ${agent.name}`, error);
      }
    }

    return adapters;
  }

  /**
   * 验证适配器组
   */
  static validateAdapters(adapters: Map<string, LangGraphAgentAdapter>): {
    valid: boolean;
    readyAdapters: string[];
    failedAdapters: string[];
  } {
    const readyAdapters: string[] = [];
    const failedAdapters: string[] = [];

    for (const [name, adapter] of adapters) {
      if (adapter.isReady()) {
        readyAdapters.push(name);
      } else {
        failedAdapters.push(name);
      }
    }

    return {
      valid: failedAdapters.length === 0,
      readyAdapters,
      failedAdapters,
    };
  }
}