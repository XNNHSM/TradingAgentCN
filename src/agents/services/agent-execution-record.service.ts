import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {AgentExecutionRecord} from '../entities/agent-execution-record.entity';

/**
 * LLM调用记录创建DTO
 */
export interface CreateLLMExecutionRecordDto {
  sessionId: string;
  agentType: string;
  agentName: string;
  executionPhase?: string;
  llmProvider: string;
  llmModel: string;
  promptTemplate?: string;
  inputMessages: any;
  outputContent?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  executionTimeMs: number;
  status: string;
  errorMessage?: string;
  errorCode?: string;
  metadata?: any;
}

/**
 * LLM调用记录查询DTO
 */
export interface QueryLLMExecutionRecordDto {
  sessionId?: string;
  agentType?: string;
  agentName?: string;
  llmProvider?: string;
  llmModel?: string;
  status?: string;
  dateRange?: { start: Date; end: Date };
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'executionTimeMs' | 'totalTokens';
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * LLM调用记录更新DTO
 */
export interface UpdateLLMExecutionRecordDto {
  outputContent?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  executionTimeMs?: number;
  status?: string;
  errorMessage?: string;
  errorCode?: string;
  metadata?: any;
}

/**
 * LLM调用统计结果DTO
 */
export interface LLMExecutionStatsDto {
  totalExecutions: number;
  successRate: number;
  avgExecutionTime: number;
  tokenUsage: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
  };
  byAgentType: Record<string, {
    count: number;
    successRate: number;
    avgExecutionTime: number;
    totalTokens: number;
  }>;
  byLLMModel: Record<string, {
    count: number;
    successRate: number;
    totalTokens: number;
  }>;
  byDate: Record<string, number>;
}

/**
 * LLM调用执行记录服务
 */
@Injectable()
export class AgentExecutionRecordService {
  private readonly logger = new Logger(AgentExecutionRecordService.name);

  constructor(
    @InjectRepository(AgentExecutionRecord)
    private readonly repository: Repository<AgentExecutionRecord>,
  ) {}

  /**
   * 创建LLM调用记录
   */
  async create(dto: CreateLLMExecutionRecordDto): Promise<AgentExecutionRecord> {
    try {
      const record = this.repository.create({
        sessionId: dto.sessionId,
        agentType: dto.agentType,
        agentName: dto.agentName,
        executionPhase: dto.executionPhase,
        llmProvider: dto.llmProvider,
        llmModel: dto.llmModel,
        promptTemplate: dto.promptTemplate,
        inputMessages: dto.inputMessages,
        outputContent: dto.outputContent,
        inputTokens: dto.inputTokens,
        outputTokens: dto.outputTokens,
        totalTokens: dto.totalTokens,
        executionTimeMs: dto.executionTimeMs,
        status: dto.status,
        errorMessage: dto.errorMessage,
        errorCode: dto.errorCode,
        metadata: dto.metadata,
      });
      
      const savedRecord = await this.repository.save(record);
      
      this.logger.debug(`LLM调用记录已保存: ${savedRecord.id} (${dto.agentType})`);
      return savedRecord;
      
    } catch (error) {
      this.logger.error(`保存LLM调用记录失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 查询LLM调用记录
   */
  async query(dto: QueryLLMExecutionRecordDto): Promise<AgentExecutionRecord[]> {
    try {
      const queryBuilder = this.repository.createQueryBuilder('record')
        .where('record.deletedAt IS NULL');
      
      if (dto.sessionId) {
        queryBuilder.andWhere('record.sessionId = :sessionId', { sessionId: dto.sessionId });
      }
      
      if (dto.agentType) {
        queryBuilder.andWhere('record.agentType = :agentType', { agentType: dto.agentType });
      }
      
      if (dto.agentName) {
        queryBuilder.andWhere('record.agentName = :agentName', { agentName: dto.agentName });
      }
      
      if (dto.llmProvider) {
        queryBuilder.andWhere('record.llmProvider = :llmProvider', { llmProvider: dto.llmProvider });
      }
      
      if (dto.llmModel) {
        queryBuilder.andWhere('record.llmModel = :llmModel', { llmModel: dto.llmModel });
      }
      
      if (dto.status) {
        queryBuilder.andWhere('record.status = :status', { status: dto.status });
      }
      
      if (dto.dateRange) {
        queryBuilder.andWhere('record.createdAt BETWEEN :start AND :end', {
          start: dto.dateRange.start,
          end: dto.dateRange.end,
        });
      }
      
      const orderBy = dto.orderBy || 'createdAt';
      const orderDirection = dto.orderDirection || 'DESC';
      queryBuilder.orderBy(`record.${orderBy}`, orderDirection);
      
      if (dto.limit) {
        queryBuilder.limit(dto.limit);
      }
      
      if (dto.offset) {
        queryBuilder.offset(dto.offset);
      }
      
      return await queryBuilder.getMany();
      
    } catch (error) {
      this.logger.error(`查询LLM调用记录失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 根据会话ID获取所有LLM调用记录
   */
  async getRecordsBySessionId(sessionId: string): Promise<AgentExecutionRecord[]> {
    return this.query({ sessionId });
  }

  /**
   * 获取指定智能体的调用历史
   */
  async getAgentCallHistory(
    agentType: string,
    limit: number = 50
  ): Promise<AgentExecutionRecord[]> {
    return this.query({
      agentType,
      limit,
      orderBy: 'createdAt',
      orderDirection: 'DESC',
    });
  }

  /**
   * 获取LLM调用统计
   */
  async getStats(dto: QueryLLMExecutionRecordDto): Promise<LLMExecutionStatsDto> {
    try {
      const records = await this.query({
        ...dto,
        limit: 10000, // 限制统计数据量
      });

      const totalExecutions = records.length;
      const successfulExecutions = records.filter(r => r.status === 'success');
      
      const stats: LLMExecutionStatsDto = {
        totalExecutions,
        successRate: totalExecutions > 0 ? successfulExecutions.length / totalExecutions : 0,
        avgExecutionTime: this.calculateAverage(records, 'executionTimeMs'),
        tokenUsage: {
          totalInputTokens: records.reduce((sum, r) => sum + (r.inputTokens || 0), 0),
          totalOutputTokens: records.reduce((sum, r) => sum + (r.outputTokens || 0), 0),
          totalTokens: records.reduce((sum, r) => sum + (r.totalTokens || 0), 0),
        },
        byAgentType: this.groupByAgentType(records),
        byLLMModel: this.groupByLLMModel(records),
        byDate: this.groupByDate(records),
      };

      return stats;
      
    } catch (error) {
      this.logger.error(`获取LLM调用统计失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 更新LLM调用记录
   */
  async update(recordId: number, updateDto: UpdateLLMExecutionRecordDto): Promise<AgentExecutionRecord | null> {
    try {
      const result = await this.repository.update(
        { id: recordId },
        {
          ...updateDto,
          updatedAt: new Date()
        }
      );
      
      if (result.affected === 0) {
        this.logger.warn(`未找到ID为 ${recordId} 的LLM调用记录`);
        return null;
      }

      // 返回更新后的记录
      const updatedRecord = await this.repository.findOne({
        where: { id: recordId }
      });
      
      this.logger.debug(`成功更新LLM调用记录: ${recordId}`);
      return updatedRecord;
      
    } catch (error) {
      this.logger.error(`更新LLM调用记录失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 软删除调用记录
   */
  async delete(recordId: number): Promise<boolean> {
    try {
      const result = await this.repository.update(
        { id: recordId },
        { deletedAt: new Date() }
      );
      
      return result.affected > 0;
      
    } catch (error) {
      this.logger.error(`删除LLM调用记录失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  // === 私有辅助方法 ===
  
  private calculateAverage(records: AgentExecutionRecord[], field: keyof AgentExecutionRecord): number {
    if (records.length === 0) return 0;
    
    const values = records.map(r => Number(r[field])).filter(v => !isNaN(v));
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private groupByAgentType(records: AgentExecutionRecord[]): Record<string, any> {
    const groups: Record<string, any> = {};
    
    records.forEach(record => {
      const agentType = record.agentType;
      if (!groups[agentType]) {
        groups[agentType] = {
          count: 0,
          successCount: 0,
          totalExecutionTime: 0,
          totalTokens: 0,
        };
      }
      
      groups[agentType].count++;
      if (record.status === 'success') {
        groups[agentType].successCount++;
      }
      groups[agentType].totalExecutionTime += record.executionTimeMs || 0;
      groups[agentType].totalTokens += record.totalTokens || 0;
    });
    
    // 计算平均值
    Object.keys(groups).forEach(agentType => {
      const group = groups[agentType];
      group.successRate = group.count > 0 ? group.successCount / group.count : 0;
      group.avgExecutionTime = group.count > 0 ? group.totalExecutionTime / group.count : 0;
      delete group.successCount;
      delete group.totalExecutionTime;
    });
    
    return groups;
  }
  
  private groupByLLMModel(records: AgentExecutionRecord[]): Record<string, any> {
    const groups: Record<string, any> = {};
    
    records.forEach(record => {
      const model = record.llmModel;
      if (!groups[model]) {
        groups[model] = {
          count: 0,
          successCount: 0,
          totalTokens: 0,
        };
      }
      
      groups[model].count++;
      if (record.status === 'success') {
        groups[model].successCount++;
      }
      groups[model].totalTokens += record.totalTokens || 0;
    });
    
    // 计算成功率
    Object.keys(groups).forEach(model => {
      const group = groups[model];
      group.successRate = group.count > 0 ? group.successCount / group.count : 0;
      delete group.successCount;
    });
    
    return groups;
  }

  private groupByDate(records: AgentExecutionRecord[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    records.forEach(record => {
      const date = record.createdAt.toISOString().split('T')[0];
      groups[date] = (groups[date] || 0) + 1;
    });
    
    return groups;
  }
}