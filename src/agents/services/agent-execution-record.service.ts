import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutionRecord } from '../entities/agent-execution-record.entity';
import { AgentExecutionShardingService } from './agent-execution-sharding.service';
import { AgentType, AgentContext, AgentResult, TradingRecommendation } from '../interfaces/agent.interface';
import { LLMResponse } from './llm.service';

/**
 * Agent执行记录创建DTO
 */
export interface CreateAgentExecutionRecordDto {
  sessionId: string;
  agentType: AgentType;
  agentName: string;
  agentRole: string;
  stockCode: string;
  stockName?: string;
  context: AgentContext;
  llmModel: string;
  inputPrompt: string;
  llmResponse: LLMResponse;
  result: AgentResult;
  startTime: Date;
  endTime: Date;
  toolCalls?: any[];
  toolResults?: any[];
  analysisType?: string;
  environment?: string;
  errorMessage?: string;
  errorStack?: string;
}

/**
 * Agent执行记录查询DTO
 */
export interface QueryAgentExecutionRecordDto {
  agentTypes?: AgentType[];
  stockCode?: string;
  stockName?: string;
  sessionId?: string;
  executionStatus?: 'success' | 'error' | 'timeout';
  recommendation?: TradingRecommendation;
  dateRange?: { start: Date; end: Date };
  analysisType?: string;
  minScore?: number;
  maxScore?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'executionDate' | 'processingTimeMs' | 'score';
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * 统计结果DTO
 */
export interface AgentExecutionStatsDto {
  totalExecutions: number;
  successRate: number;
  avgProcessingTime: number;
  avgScore: number;
  avgCost: number;
  tokenUsage: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
  };
  recommendations: Record<TradingRecommendation, number>;
  byAgentType: Record<AgentType, {
    count: number;
    successRate: number;
    avgScore: number;
    avgProcessingTime: number;
  }>;
  byDate: Record<string, number>;
}

/**
 * Agent执行记录服务
 */
@Injectable()
export class AgentExecutionRecordService {
  private readonly logger = new Logger(AgentExecutionRecordService.name);

  constructor(
    private readonly shardingService: AgentExecutionShardingService,
  ) {}

  /**
   * 创建执行记录
   */
  async createExecutionRecord(dto: CreateAgentExecutionRecordDto): Promise<AgentExecutionRecord> {
    try {
      const repository = await this.shardingService.getRepository(dto.agentType);
      
      const record = new AgentExecutionRecord();
      
      // 基础信息
      record.sessionId = dto.sessionId;
      record.agentType = dto.agentType;
      record.agentName = dto.agentName;
      record.agentRole = dto.agentRole;
      
      // 股票信息
      record.stockCode = dto.stockCode;
      record.stockName = dto.stockName;
      
      // 执行信息
      record.executionDate = dto.startTime;
      record.startTime = dto.startTime;
      record.endTime = dto.endTime;
      record.processingTimeMs = dto.endTime.getTime() - dto.startTime.getTime();
      record.executionStatus = dto.errorMessage ? 'error' : 'success';
      
      // LLM调用信息
      record.llmModel = dto.llmModel;
      record.inputPrompt = dto.inputPrompt;
      record.inputTokens = dto.llmResponse.usage?.inputTokens;
      record.outputTokens = dto.llmResponse.usage?.outputTokens;
      record.totalTokens = dto.llmResponse.usage?.totalTokens;
      record.estimatedCost = dto.llmResponse.usage?.cost;
      
      // 分析结果
      record.analysisResult = dto.result.analysis;
      record.structuredResult = {
        agentResult: dto.result,
        llmResponse: {
          content: dto.llmResponse.content,
          finishReason: dto.llmResponse.finishReason,
          toolCalls: dto.llmResponse.toolCalls,
        }
      };
      record.score = dto.result.score;
      record.recommendation = dto.result.recommendation;
      record.confidence = dto.result.confidence;
      record.keyInsights = dto.result.keyInsights;
      record.risks = dto.result.risks;
      record.supportingData = dto.result.supportingData;
      
      // 工具调用信息
      record.toolCalls = dto.toolCalls;
      record.toolResults = dto.toolResults;
      
      // 上下文信息
      record.contextData = {
        timeRange: dto.context.timeRange,
        metadata: dto.context.metadata,
      };
      record.previousResults = dto.context.previousResults?.map(r => ({
        agentType: r.agentType,
        agentName: r.agentName,
        analysis: r.analysis.substring(0, 500), // 截取前500字符
        score: r.score,
        recommendation: r.recommendation,
        confidence: r.confidence,
      }));
      
      // 扩展信息
      record.analysisType = dto.analysisType;
      record.environment = dto.environment || process.env.NODE_ENV || 'development';
      
      // 错误信息
      record.errorMessage = dto.errorMessage;
      record.errorStack = dto.errorStack;
      
      const savedRecord = await repository.save(record);
      
      this.logger.debug(`执行记录已保存: ${savedRecord.id} (${dto.agentType} - ${dto.stockCode})`);
      return savedRecord;
      
    } catch (error) {
      this.logger.error(`保存执行记录失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 查询执行记录
   */
  async queryExecutionRecords(dto: QueryAgentExecutionRecordDto): Promise<AgentExecutionRecord[]> {
    try {
      const agentTypes = dto.agentTypes || Object.values(AgentType);
      
      return await this.shardingService.queryAcrossShards(agentTypes, {
        stockCode: dto.stockCode,
        sessionId: dto.sessionId,
        dateRange: dto.dateRange,
        limit: dto.limit,
        offset: dto.offset,
      });
      
    } catch (error) {
      this.logger.error(`查询执行记录失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 根据会话ID获取所有Agent的执行记录
   */
  async getRecordsBySessionId(sessionId: string): Promise<AgentExecutionRecord[]> {
    return this.queryExecutionRecords({ sessionId });
  }

  /**
   * 获取指定股票的执行历史
   */
  async getStockAnalysisHistory(
    stockCode: string,
    agentType?: AgentType,
    limit: number = 50
  ): Promise<AgentExecutionRecord[]> {
    const agentTypes = agentType ? [agentType] : undefined;
    
    return this.queryExecutionRecords({
      stockCode,
      agentTypes,
      limit,
      orderBy: 'executionDate',
      orderDirection: 'DESC',
    });
  }

  /**
   * 获取执行统计
   */
  async getExecutionStats(dto: QueryAgentExecutionRecordDto): Promise<AgentExecutionStatsDto> {
    try {
      const records = await this.queryExecutionRecords({
        ...dto,
        limit: 10000, // 限制统计数据量
      });

      const totalExecutions = records.length;
      const successfulExecutions = records.filter(r => r.executionStatus === 'success');
      
      const stats: AgentExecutionStatsDto = {
        totalExecutions,
        successRate: totalExecutions > 0 ? successfulExecutions.length / totalExecutions : 0,
        avgProcessingTime: this.calculateAverage(records, 'processingTimeMs'),
        avgScore: this.calculateAverage(records.filter(r => r.score), 'score'),
        avgCost: this.calculateAverage(records.filter(r => r.estimatedCost), 'estimatedCost'),
        tokenUsage: {
          totalInputTokens: records.reduce((sum, r) => sum + (r.inputTokens || 0), 0),
          totalOutputTokens: records.reduce((sum, r) => sum + (r.outputTokens || 0), 0),
          totalTokens: records.reduce((sum, r) => sum + (r.totalTokens || 0), 0),
        },
        recommendations: this.groupByRecommendation(records),
        byAgentType: this.groupByAgentType(records),
        byDate: this.groupByDate(records),
      };

      return stats;
      
    } catch (error) {
      this.logger.error(`获取执行统计失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 删除执行记录
   */
  async deleteExecutionRecord(agentType: AgentType, recordId: number): Promise<boolean> {
    try {
      const repository = await this.shardingService.getRepository(agentType);
      
      const result = await repository.update(
        { id: recordId },
        { deletedAt: new Date() }
      );
      
      return result.affected > 0;
      
    } catch (error) {
      this.logger.error(`删除执行记录失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  // === 私有辅助方法 ===
  
  private calculateAverage(records: AgentExecutionRecord[], field: keyof AgentExecutionRecord): number {
    if (records.length === 0) return 0;
    
    const values = records.map(r => Number(r[field])).filter(v => !isNaN(v));
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private groupByRecommendation(records: AgentExecutionRecord[]): Record<TradingRecommendation, number> {
    const groups: Record<TradingRecommendation, number> = {
      [TradingRecommendation.STRONG_BUY]: 0,
      [TradingRecommendation.BUY]: 0,
      [TradingRecommendation.HOLD]: 0,
      [TradingRecommendation.SELL]: 0,
      [TradingRecommendation.STRONG_SELL]: 0,
    };
    
    records.forEach(record => {
      if (record.recommendation) {
        groups[record.recommendation]++;
      }
    });
    
    return groups;
  }

  private groupByAgentType(records: AgentExecutionRecord[]): Record<AgentType, any> {
    const groups: Record<string, any> = {};
    
    for (const agentType of Object.values(AgentType)) {
      const typeRecords = records.filter(r => r.agentType === agentType);
      const successfulRecords = typeRecords.filter(r => r.executionStatus === 'success');
      
      groups[agentType] = {
        count: typeRecords.length,
        successRate: typeRecords.length > 0 ? successfulRecords.length / typeRecords.length : 0,
        avgScore: this.calculateAverage(typeRecords.filter(r => r.score), 'score'),
        avgProcessingTime: this.calculateAverage(typeRecords, 'processingTimeMs'),
      };
    }
    
    return groups as Record<AgentType, any>;
  }

  private groupByDate(records: AgentExecutionRecord[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    records.forEach(record => {
      const date = record.executionDate.toISOString().split('T')[0];
      groups[date] = (groups[date] || 0) + 1;
    });
    
    return groups;
  }
}