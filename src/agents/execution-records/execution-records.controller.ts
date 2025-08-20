import { Controller, Post, Body, Query, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AgentExecutionRecordService, QueryAgentExecutionRecordDto } from '../services/agent-execution-record.service';
import { AgentExecutionShardingService } from '../services/agent-execution-sharding.service';
import { AgentType } from '../interfaces/agent.interface';
import { Result } from '../../common/dto/result.dto';

/**
 * 查询执行记录请求DTO
 */
export class QueryExecutionRecordsRequestDto {
  agentTypes?: AgentType[];
  stockCode?: string;
  stockName?: string;
  sessionId?: string;
  executionStatus?: 'success' | 'error' | 'timeout';
  dateRange?: {
    start: string; // ISO日期字符串
    end: string;   // ISO日期字符串
  };
  analysisType?: string;
  minScore?: number;
  maxScore?: number;
  limit?: number;
  offset?: number;
}

/**
 * 统计查询请求DTO
 */
export class StatisticsRequestDto {
  agentTypes?: AgentType[];
  stockCode?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  analysisType?: string;
}

/**
 * Agent执行记录控制器
 */
@ApiTags('Agent执行记录')
@Controller('agent-execution-records')
export class ExecutionRecordsController {
  constructor(
    private readonly executionRecordService: AgentExecutionRecordService,
    private readonly shardingService: AgentExecutionShardingService,
  ) {}

  /**
   * 查询执行记录
   */
  @Post('query')
  @ApiOperation({ summary: '查询Agent执行记录' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async queryRecords(@Body() requestDto: QueryExecutionRecordsRequestDto): Promise<Result<any>> {
    try {
      // 转换日期格式
      const queryDto: QueryAgentExecutionRecordDto = {
        ...requestDto,
        dateRange: requestDto.dateRange ? {
          start: new Date(requestDto.dateRange.start),
          end: new Date(requestDto.dateRange.end),
        } : undefined,
      };

      const records = await this.executionRecordService.queryExecutionRecords(queryDto);

      return Result.success(records, '查询成功');
    } catch (error) {
      return Result.error(`查询失败: ${error.message}`);
    }
  }

  /**
   * 获取会话记录
   */
  @Get('session/:sessionId')
  @ApiOperation({ summary: '获取指定会话的所有Agent执行记录' })
  async getSessionRecords(@Param('sessionId') sessionId: string): Promise<Result<any>> {
    try {
      const records = await this.executionRecordService.getRecordsBySessionId(sessionId);
      
      return Result.success({
        sessionId,
        recordCount: records.length,
        records,
      }, '获取成功');
    } catch (error) {
      return Result.error(`获取会话记录失败: ${error.message}`);
    }
  }

  /**
   * 获取股票分析历史
   */
  @Get('stock/:stockCode/history')
  @ApiOperation({ summary: '获取指定股票的分析历史' })
  async getStockHistory(
    @Param('stockCode') stockCode: string,
    @Query('agentType') agentType?: AgentType,
    @Query('limit') limit?: number,
  ): Promise<Result<any>> {
    try {
      const records = await this.executionRecordService.getStockAnalysisHistory(
        stockCode,
        agentType,
        limit ? parseInt(limit.toString()) : 50
      );

      return Result.success({
        stockCode,
        agentType: agentType || 'all',
        recordCount: records.length,
        records,
      }, '获取成功');
    } catch (error) {
      return Result.error(`获取股票历史失败: ${error.message}`);
    }
  }

  /**
   * 获取执行统计
   */
  @Post('statistics')
  @ApiOperation({ summary: '获取Agent执行统计数据' })
  async getStatistics(@Body() requestDto: StatisticsRequestDto): Promise<Result<any>> {
    try {
      const queryDto: QueryAgentExecutionRecordDto = {
        agentTypes: requestDto.agentTypes,
        stockCode: requestDto.stockCode,
        analysisType: requestDto.analysisType,
        dateRange: requestDto.dateRange ? {
          start: new Date(requestDto.dateRange.start),
          end: new Date(requestDto.dateRange.end),
        } : undefined,
      };

      const stats = await this.executionRecordService.getExecutionStats(queryDto);

      return Result.success(stats, '统计数据获取成功');
    } catch (error) {
      return Result.error(`获取统计数据失败: ${error.message}`);
    }
  }

  /**
   * 获取分表信息
   */
  @Get('sharding/info')
  @ApiOperation({ summary: '获取分表统计信息' })
  async getShardingInfo(): Promise<Result<any>> {
    try {
      const [stats, sizes] = await Promise.all([
        this.shardingService.getShardingStats(),
        this.shardingService.getTableSizes(),
      ]);

      return Result.success({
        shardingStats: stats,
        tableSizes: sizes,
      }, '分表信息获取成功');
    } catch (error) {
      return Result.error(`获取分表信息失败: ${error.message}`);
    }
  }

  /**
   * 创建所有分表
   */
  @Post('sharding/create-tables')
  @ApiOperation({ summary: '创建所有Agent类型的分表' })
  async createShardTables(): Promise<Result<any>> {
    try {
      await this.shardingService.createAllShardTables();
      
      return Result.success(null, '所有分表创建成功');
    } catch (error) {
      return Result.error(`创建分表失败: ${error.message}`);
    }
  }

  /**
   * 数据清理
   */
  @Post('cleanup')
  @ApiOperation({ summary: '清理过期的执行记录' })
  async cleanupRecords(
    @Body('retentionDays') retentionDays: number = 90
  ): Promise<Result<any>> {
    try {
      await this.shardingService.cleanupOldRecords(retentionDays);
      
      return Result.success(null, `清理${retentionDays}天前的记录成功`);
    } catch (error) {
      return Result.error(`数据清理失败: ${error.message}`);
    }
  }

  /**
   * Agent性能报告
   */
  @Get('performance/report')
  @ApiOperation({ summary: '获取Agent性能报告' })
  async getPerformanceReport(
    @Query('days') days: number = 7
  ): Promise<Result<any>> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await this.executionRecordService.getExecutionStats({
        dateRange: { start: startDate, end: endDate },
      });

      const report = {
        period: `${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`,
        summary: {
          totalExecutions: stats.totalExecutions,
          successRate: Math.round(stats.successRate * 100),
          avgProcessingTime: Math.round(stats.avgProcessingTime),
          avgScore: Math.round(stats.avgScore * 10) / 10,
          estimatedCost: Math.round(stats.avgCost * 100) / 100,
        },
        tokenUsage: stats.tokenUsage,
        agentPerformance: stats.byAgentType,
        dailyActivity: stats.byDate,
        recommendations: stats.recommendations,
      };

      return Result.success(report, '性能报告生成成功');
    } catch (error) {
      return Result.error(`生成性能报告失败: ${error.message}`);
    }
  }
}