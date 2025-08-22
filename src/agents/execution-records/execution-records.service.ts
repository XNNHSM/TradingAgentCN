import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutionRecordService } from '../services/agent-execution-record.service';
import { AgentExecutionShardingService } from '../services/agent-execution-sharding.service';
import { AgentExecutionRecord } from '../entities/agent-execution-record.entity';
import { Result, PaginatedResult } from '../../common/dto/result.dto';

/**
 * 执行记录服务 - 对外提供执行记录管理接口
 * 这是一个包装服务，封装了内部的执行记录管理功能
 */
@Injectable()
export class ExecutionRecordsService {
  private readonly logger = new Logger(ExecutionRecordsService.name);

  constructor(
    private readonly executionRecordService: AgentExecutionRecordService,
    private readonly shardingService: AgentExecutionShardingService,
  ) {}

  /**
   * 根据会话ID获取执行记录
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
   * 根据股票代码获取历史分析记录
   */
  async getStockAnalysisHistory(
    stockCode: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<Result<PaginatedResult<AgentExecutionRecord>>> {
    try {
      const records = await this.executionRecordService.getStockAnalysisHistory(stockCode);
      
      // 简单分页实现
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedRecords = records.slice(startIndex, endIndex);
      
      const paginatedResult = new PaginatedResult(
        paginatedRecords,
        records.length,
        page,
        limit,
      );

      return Result.success(paginatedResult, '获取分析历史成功');
    } catch (error) {
      this.logger.error(`获取股票分析历史失败: ${error.message}`, error.stack);
      return Result.error('获取分析历史失败', 500);
    }
  }

  /**
   * 获取执行统计信息
   */
  async getExecutionStats(filters?: {
    dateRange?: { start: Date; end: Date };
    agentType?: string;
    stockCode?: string;
  }): Promise<Result<any>> {
    try {
      const stats = await this.executionRecordService.getExecutionStats(filters);
      return Result.success(stats, '获取统计信息成功');
    } catch (error) {
      this.logger.error(`获取执行统计失败: ${error.message}`, error.stack);
      return Result.error('获取统计信息失败', 500);
    }
  }

  /**
   * 获取分表统计信息
   */
  async getShardingStats(): Promise<Result<any>> {
    try {
      const stats = await this.shardingService.getShardingStats();
      return Result.success(stats, '获取分表统计成功');
    } catch (error) {
      this.logger.error(`获取分表统计失败: ${error.message}`, error.stack);
      return Result.error('获取分表统计失败', 500);
    }
  }

  /**
   * 清理过期记录
   */
  async cleanExpiredRecords(retentionDays: number = 90): Promise<Result<{ deletedCount: number }>> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      // 这里可以实现具体的清理逻辑
      this.logger.log(`开始清理 ${retentionDays} 天前的执行记录`);
      
      // 暂时返回模拟数据
      const deletedCount = 0;
      
      return Result.success({ deletedCount }, `清理完成，删除 ${deletedCount} 条记录`);
    } catch (error) {
      this.logger.error(`清理执行记录失败: ${error.message}`, error.stack);
      return Result.error('清理执行记录失败', 500);
    }
  }
}