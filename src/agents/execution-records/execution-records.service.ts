import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutionRecordService } from '../services/agent-execution-record.service';
import { AgentExecutionRecord } from '../entities/agent-execution-record.entity';
import { Result, PaginatedResult } from '../../common/dto/result.dto';

/**
 * 执行记录服务 - 对外提供LLM调用记录管理接口
 * 这是一个包装服务，封装了内部的LLM调用记录管理功能
 */
@Injectable()
export class ExecutionRecordsService {
  private readonly logger = new Logger(ExecutionRecordsService.name);

  constructor(
    private readonly executionRecordService: AgentExecutionRecordService,
  ) {}

  /**
   * 根据会话ID获取LLM调用记录
   */
  async getRecordsBySessionId(sessionId: string): Promise<AgentExecutionRecord[]> {
    try {
      return await this.executionRecordService.getRecordsBySessionId(sessionId);
    } catch (error) {
      this.logger.error(`获取会话记录失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 根据智能体类型获取调用历史记录
   */
  async getAgentCallHistory(
    agentType: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<Result<PaginatedResult<AgentExecutionRecord>>> {
    try {
      const records = await this.executionRecordService.getAgentCallHistory(agentType, limit * page);
      
      // 简单分页实现
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedRecords = records.slice(startIndex, endIndex);
      
      const paginatedResult: PaginatedResult<AgentExecutionRecord> = {
        items: paginatedRecords,
        total: records.length,
        page: page,
        limit: limit,
        totalPages: Math.ceil(records.length / limit),
        hasNext: endIndex < records.length,
        hasPrev: page > 1,
      };

      return Result.success(paginatedResult, '获取智能体调用历史成功');
    } catch (error) {
      this.logger.error(`获取智能体调用历史失败: ${error.message}`, error.stack);
      return Result.error(`获取智能体调用历史失败: ${error.message}`);
    }
  }

  /**
   * 获取执行统计
   */
  async getExecutionStats(filters: any): Promise<Result<any>> {
    try {
      const stats = await this.executionRecordService.getStats(filters);
      return Result.success(stats, '获取执行统计成功');
    } catch (error) {
      this.logger.error(`获取执行统计失败: ${error.message}`, error.stack);
      return Result.error(`获取执行统计失败: ${error.message}`);
    }
  }

  /**
   * 获取热门智能体统计
   */
  async getPopularAgents(): Promise<Result<any>> {
    try {
      // 获取最近7天的统计
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats = await this.executionRecordService.getStats({
        dateRange: { start: startDate, end: endDate },
        limit: 1000,
      });

      const popularAgents = Object.entries(stats.byAgentType)
        .sort(([,a], [,b]) => (b as any).count - (a as any).count)
        .slice(0, 10)
        .map(([agentType, stats]) => ({
          agentType,
          ...stats,
        }));

      return Result.success({
        period: '最近7天',
        popularAgents,
        totalExecutions: stats.totalExecutions,
        successRate: stats.successRate,
      }, '获取热门智能体统计成功');
    } catch (error) {
      this.logger.error(`获取热门智能体统计失败: ${error.message}`, error.stack);
      return Result.error(`获取热门智能体统计失败: ${error.message}`);
    }
  }

  /**
   * 获取Token使用统计
   */
  async getTokenUsageStats(): Promise<Result<any>> {
    try {
      // 获取最近30天的统计
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = await this.executionRecordService.getStats({
        dateRange: { start: startDate, end: endDate },
        limit: 10000,
      });

      return Result.success({
        period: '最近30天',
        totalTokens: stats.tokenUsage.totalTokens,
        totalInputTokens: stats.tokenUsage.totalInputTokens,
        totalOutputTokens: stats.tokenUsage.totalOutputTokens,
        avgTokensPerCall: stats.totalExecutions > 0 
          ? stats.tokenUsage.totalTokens / stats.totalExecutions 
          : 0,
        byLLMModel: stats.byLLMModel,
        dailyUsage: stats.byDate,
      }, '获取Token使用统计成功');
    } catch (error) {
      this.logger.error(`获取Token使用统计失败: ${error.message}`, error.stack);
      return Result.error(`获取Token使用统计失败: ${error.message}`);
    }
  }
}