import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AgentExecutionRecordService, CreateAgentExecutionRecordDto } from '../services/agent-execution-record.service';
import { AgentType, AgentContext, AgentResult } from '../interfaces/agent.interface';
import { LLMResponse } from '../services/llm.service';

/**
 * 智能体执行记录拦截器
 * 自动记录每次LLM调用的执行信息到对应的分表中
 */
@Injectable()
export class AgentExecutionRecorderInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AgentExecutionRecorderInterceptor.name);

  constructor(
    private readonly executionRecordService: AgentExecutionRecordService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = new Date();
    const executionContext = this.extractExecutionContext(context);

    return next.handle().pipe(
      tap(async (result) => {
        const endTime = new Date();
        
        // 只有当方法返回AgentResult时才记录
        if (this.isAgentResult(result) && executionContext) {
          await this.recordExecution(executionContext, result, startTime, endTime);
        }
      }),
      catchError(async (error) => {
        const endTime = new Date();
        
        if (executionContext) {
          await this.recordExecutionError(executionContext, error, startTime, endTime);
        }
        
        return throwError(() => error);
      })
    );
  }

  /**
   * 从执行上下文中提取必要信息
   */
  private extractExecutionContext(context: ExecutionContext): AgentExecutionContext | null {
    try {
      const request = context.switchToHttp().getRequest();
      const className = context.getClass().name;
      const methodName = context.getHandler().name;
      
      // 从请求参数或类名推断Agent信息
      const agentInfo = this.inferAgentInfo(className, methodName, request);
      
      if (!agentInfo) {
        return null;
      }

      // 从请求中提取会话ID和股票信息
      const body = request.body || {};
      const query = request.query || {};
      const params = request.params || {};
      
      const sessionId = body.sessionId || query.sessionId || params.sessionId || this.generateSessionId();
      const stockCode = body.stockCode || query.stockCode || params.stockCode;
      const stockName = body.stockName || query.stockName || params.stockName;

      return {
        agentType: agentInfo.agentType,
        agentName: agentInfo.agentName,
        agentRole: agentInfo.agentRole,
        sessionId,
        stockCode,
        stockName,
        analysisType: body.analysisType || 'single',
        userAgent: request.headers['user-agent'],
        className,
        methodName,
        requestBody: body,
      };
    } catch (error) {
      this.logger.warn(`提取执行上下文失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 根据类名和方法名推断Agent信息
   */
  private inferAgentInfo(className: string, methodName: string, request: any): {
    agentType: AgentType;
    agentName: string;
    agentRole: string;
  } | null {
    // 智能体类名到类型的映射
    const agentMapping: Record<string, { type: AgentType; name: string; role: string }> = {
      'BasicDataAgent': {
        type: AgentType.BASIC_DATA_AGENT,
        name: '基础数据智能体',
        role: '获取和分析股票基础信息、实时数据'
      },
      'TechnicalAnalystAgent': {
        type: AgentType.TECHNICAL_ANALYST_NEW,
        name: '技术分析师',
        role: '进行技术指标分析和市场趋势判断'
      },
      'FundamentalAnalystAgent': {
        type: AgentType.FUNDAMENTAL_ANALYST_NEW,
        name: '基本面分析师',
        role: '分析财务数据和公司基本面'
      },
      'NewsAnalystAgent': {
        type: AgentType.NEWS_ANALYST_NEW,
        name: '新闻分析师',
        role: '分析新闻情绪和市场反应'
      },
      'SocialMediaAnalystAgent': {
        type: AgentType.SOCIAL_MEDIA_ANALYST,
        name: '社交媒体分析师',
        role: '分析社交媒体情绪和讨论热点'
      },
      'QuantitativeTraderAgent': {
        type: AgentType.QUANTITATIVE_TRADER,
        name: '量化交易员',
        role: '基于数据驱动的量化交易策略'
      },
      'MacroEconomistAgent': {
        type: AgentType.MACRO_ECONOMIST,
        name: '宏观经济分析师',
        role: '分析宏观经济环境和政策影响'
      },
      'PolicyAnalystAgent': {
        type: AgentType.POLICY_ANALYST,
        name: '政策分析师',
        role: '政策解读和影响评估'
      },
      'UnifiedOrchestratorAgent': {
        type: AgentType.UNIFIED_ORCHESTRATOR,
        name: '统一协调器',
        role: '整合所有分析结果并生成最终投资建议'
      },
    };

    for (const [classKey, agentInfo] of Object.entries(agentMapping)) {
      if (className.includes(classKey)) {
        return {
          agentType: agentInfo.type,
          agentName: agentInfo.name,
          agentRole: agentInfo.role
        };
      }
    }

    // 如果从请求体中可以获取agentType
    if (request?.body?.agentType && Object.values(AgentType).includes(request.body.agentType)) {
      const type = request.body.agentType as AgentType;
      const mapping = Object.values(agentMapping).find(m => m.type === type);
      if (mapping) {
        return {
          agentType: type,
          agentName: mapping.name,
          agentRole: mapping.role
        };
      }
    }

    this.logger.debug(`无法推断Agent信息: ${className}.${methodName}`);
    return null;
  }

  /**
   * 检查返回值是否为AgentResult
   */
  private isAgentResult(result: any): boolean {
    return result &&
           typeof result === 'object' &&
           result.agentType &&
           result.agentName &&
           result.analysis &&
           typeof result.score === 'number';
  }

  /**
   * 记录成功的执行
   */
  private async recordExecution(
    executionContext: AgentExecutionContext,
    result: AgentResult,
    startTime: Date,
    endTime: Date
  ): Promise<void> {
    try {
      // 提取LLM响应信息 (从result中获取，如果有的话)
      const llmResponse: LLMResponse = this.extractLLMResponse(result);
      
      const recordDto: CreateAgentExecutionRecordDto = {
        sessionId: executionContext.sessionId,
        agentType: executionContext.agentType,
        agentName: executionContext.agentName,
        agentRole: executionContext.agentRole,
        stockCode: executionContext.stockCode,
        stockName: executionContext.stockName,
        context: this.buildAgentContext(executionContext, result),
        llmModel: llmResponse.model || 'unknown',
        inputPrompt: result.supportingData?.inputPrompt || '未记录的输入提示词',
        llmResponse,
        result,
        startTime,
        endTime,
        toolCalls: llmResponse.toolCalls,
        toolResults: result.supportingData?.toolResults,
        analysisType: executionContext.analysisType,
        environment: process.env.NODE_ENV || 'development',
      };

      await this.executionRecordService.createExecutionRecord(recordDto);
      
      this.logger.debug(
        `执行记录已保存: ${executionContext.agentName} - ${executionContext.stockCode} - 耗时${endTime.getTime() - startTime.getTime()}ms`
      );

    } catch (error) {
      this.logger.error(`保存执行记录失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 记录失败的执行
   */
  private async recordExecutionError(
    executionContext: AgentExecutionContext,
    error: any,
    startTime: Date,
    endTime: Date
  ): Promise<void> {
    try {
      // 创建错误结果
      const errorResult: AgentResult = {
        agentType: executionContext.agentType,
        agentName: executionContext.agentName,
        analysis: `执行失败: ${error.message}`,
        timestamp: endTime,
        score: 0,
        recommendation: null,
        confidence: 0,
        keyInsights: [],
        risks: [`执行错误: ${error.message}`],
        supportingData: {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        }
      };

      const errorLLMResponse: LLMResponse = {
        content: `执行失败: ${error.message}`,
        finishReason: 'error',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cost: 0
        },
        model: 'unknown'
      };

      const recordDto: CreateAgentExecutionRecordDto = {
        sessionId: executionContext.sessionId,
        agentType: executionContext.agentType,
        agentName: executionContext.agentName,
        agentRole: executionContext.agentRole,
        stockCode: executionContext.stockCode,
        stockName: executionContext.stockName,
        context: this.buildAgentContext(executionContext, errorResult),
        llmModel: 'unknown',
        inputPrompt: '执行失败，未生成输入提示词',
        llmResponse: errorLLMResponse,
        result: errorResult,
        startTime,
        endTime,
        analysisType: executionContext.analysisType,
        environment: process.env.NODE_ENV || 'development',
        errorMessage: error.message,
        errorStack: error.stack,
      };

      await this.executionRecordService.createExecutionRecord(recordDto);
      
      this.logger.warn(
        `错误执行记录已保存: ${executionContext.agentName} - ${error.message}`
      );

    } catch (recordError) {
      this.logger.error(`保存错误执行记录失败: ${recordError.message}`, recordError.stack);
    }
  }

  /**
   * 从结果中提取LLM响应信息
   */
  private extractLLMResponse(result: AgentResult): LLMResponse {
    // 如果结果中包含LLM响应信息，直接使用
    if (result.supportingData?.llmResponse) {
      return result.supportingData.llmResponse as LLMResponse;
    }

    // 否则根据结果构造基本的LLM响应信息
    return {
      content: result.analysis,
      finishReason: 'stop',
      usage: {
        inputTokens: this.estimateTokens(result.supportingData?.inputPrompt || ''),
        outputTokens: this.estimateTokens(result.analysis),
        totalTokens: this.estimateTokens((result.supportingData?.inputPrompt || '') + result.analysis),
        cost: 0 // 无法准确估算，设为0
      },
      model: 'unknown'
    };
  }

  /**
   * 构建Agent上下文
   */
  private buildAgentContext(executionContext: AgentExecutionContext, result: AgentResult): AgentContext {
    return {
      stockCode: executionContext.stockCode,
      stockName: executionContext.stockName,
      timeRange: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 默认30天前
        endDate: new Date()
      },
      metadata: {
        className: executionContext.className,
        methodName: executionContext.methodName,
        requestBody: executionContext.requestBody,
        userAgent: executionContext.userAgent,
        analysisType: executionContext.analysisType,
      },
      previousResults: [] // 这里可以考虑从会话中获取之前的结果
    };
  }

  /**
   * 简单的Token数量估算 (粗略估计: 1个Token ≈ 0.75个英文单词 ≈ 1个中文字符)
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;
    
    // 中文字符数 + 英文单词数的估算
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = text.split(/\s+/).filter(word => /[a-zA-Z]/.test(word)).length;
    
    return Math.ceil(chineseChars + englishWords * 0.75);
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}

/**
 * 智能体执行上下文接口
 */
interface AgentExecutionContext {
  agentType: AgentType;
  agentName: string;
  agentRole: string;
  sessionId: string;
  stockCode: string;
  stockName?: string;
  analysisType: string;
  userAgent?: string;
  className: string;
  methodName: string;
  requestBody: any;
}