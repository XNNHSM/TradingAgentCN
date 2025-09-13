/**
 * LangGraphJS 智能体节点适配器
 * 将现有的 BaseAgent 转换为 LangGraphJS 可用的节点
 */

import { BaseAgent } from '../base/base-agent';
import { AgentContext, AgentResult } from '../interfaces/agent.interface';
import { AgentNodeContext, AnalysisState, AnalysisError } from './analysis-state.interface';

export class LangGraphAgentAdapter {
  constructor(
    private readonly agent: BaseAgent,
    private readonly llmService: any,
    private readonly mcpClientService: any
  ) {}

  /**
   * 将智能体转换为 LangGraphJS 节点函数
   */
  toNode(): (state: AnalysisState) => Promise<Partial<AnalysisState>> {
    return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
      const startTime = Date.now();
      
      try {
        // 构建智能体上下文
        const agentContext: AgentContext = {
          stockCode: state.stockCode,
          stockName: state.stockName,
          sessionId: state.sessionId,
          previousResults: Array.from(state.analysisResults?.values() || []),
          metadata: {
            mcpData: state.mcpData,
            currentStage: state.currentStage,
            ...state.metadata
          }
        };

        // 执行智能体分析
        const result: AgentResult = await this.agent.analyze(agentContext);
        
        // 更新状态
        const updatedResults = new Map(state.analysisResults || new Map());
        updatedResults.set(this.agent.name, result);

        return {
          analysisResults: updatedResults,
          currentStage: `${this.agent.name}_completed`,
          processingTime: Date.now() - startTime,
        };
        
      } catch (error) {
        // 创建错误记录
        const analysisError: AnalysisError = {
          agentName: this.agent.name,
          error: error.message,
          type: this.getErrorType(error),
          timestamp: new Date(),
          retryable: this.isRetryableError(error)
        };

        return {
          errors: [...(state.errors || []), analysisError],
          currentStage: `${this.agent.name}_failed`,
          processingTime: Date.now() - startTime,
        };
      }
    };
  }

  /**
   * 获取错误类型
   */
  private getErrorType(error: Error): AnalysisError['type'] {
    if (error.message.includes('timeout')) return 'TIMEOUT';
    if (error.message.includes('rate limit')) return 'RATE_LIMIT';
    if (error.message.includes('API key') || error.message.includes('auth')) return 'AUTH_ERROR';
    if (error.message.includes('data') || error.message.includes('fetch')) return 'DATA_ERROR';
    return 'UNKNOWN_ERROR';
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: Error): boolean {
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
}