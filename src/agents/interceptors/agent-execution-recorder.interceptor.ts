import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AgentExecutionRecordService, CreateLLMExecutionRecordDto } from '../services/agent-execution-record.service';

/**
 * LLM调用记录拦截器
 * 自动记录LLM调用的执行信息（简化版，主要由BaseAgent内部处理）
 */
@Injectable()
export class AgentExecutionRecorderInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AgentExecutionRecorderInterceptor.name);

  constructor(
    private readonly executionRecordService: AgentExecutionRecordService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = new Date();

    return next.handle().pipe(
      tap(async (result) => {
        // 由于记录逻辑已经移到BaseAgent中，这里只做简单的日志记录
        if (result && typeof result === 'object') {
          const endTime = new Date();
          const processingTime = endTime.getTime() - startTime.getTime();
          
          this.logger.debug(`API调用完成，耗时: ${processingTime}ms`);
        }
      }),
      catchError((error) => {
        const endTime = new Date();
        const processingTime = endTime.getTime() - startTime.getTime();
        
        this.logger.error(`API调用失败，耗时: ${processingTime}ms，错误: ${error.message}`);
        
        return throwError(() => error);
      }),
    );
  }

  /**
   * 手动记录LLM调用（当需要在非BaseAgent环境中记录时）
   */
  async recordLLMCall(
    sessionId: string,
    agentType: string,
    agentName: string,
    llmProvider: string,
    llmModel: string,
    inputMessages: any,
    outputContent: string,
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
    executionTimeMs: number,
    status: 'success' | 'failed' = 'success',
    errorMessage?: string,
    errorCode?: string,
    metadata?: any,
  ): Promise<void> {
    try {
      const recordDto: CreateLLMExecutionRecordDto = {
        sessionId,
        agentType,
        agentName,
        llmProvider,
        llmModel,
        inputMessages,
        outputContent,
        inputTokens,
        outputTokens,
        totalTokens,
        executionTimeMs,
        status,
        errorMessage,
        errorCode,
        metadata,
      };

      await this.executionRecordService.create(recordDto);
    } catch (error) {
      this.logger.error(`记录LLM调用失败: ${error.message}`, error.stack);
      // 不抛出错误，避免影响主要业务流程
    }
  }
}