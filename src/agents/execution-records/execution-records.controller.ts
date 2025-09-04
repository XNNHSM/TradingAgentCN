import { Controller, Post, Body, Query, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AgentExecutionRecordService, QueryLLMExecutionRecordDto } from '../services/agent-execution-record.service';
import { Result } from '../../common/dto/result.dto';
import { PaginatedResult } from '../../common/dto/paginated-result.dto';

/**
 * 查询LLM调用记录请求DTO
 */
export class QueryLLMRecordsRequestDto {
  agentType?: string;
  agentName?: string;
  sessionId?: string;
  llmProvider?: string;
  llmModel?: string;
  status?: string;
  dateRange?: {
    start: string; // ISO日期字符串
    end: string;   // ISO日期字符串
  };
  limit?: number;
  offset?: number;
}

/**
 * 统计查询请求DTO
 */
export class StatisticsRequestDto {
  agentType?: string;
  llmProvider?: string;
  llmModel?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

@ApiTags('执行记录管理')
@Controller('api/v1/execution-records')
export class ExecutionRecordsController {
  constructor(
    private readonly executionRecordService: AgentExecutionRecordService,
  ) {}

  @Post('query')
  @ApiOperation({ summary: '分页查询LLM调用记录' })
  @ApiResponse({ 
    status: 200, 
    description: '查询成功',
    type: PaginatedResult,
  })
  async queryExecutionRecords(
    @Body() request: QueryLLMRecordsRequestDto
  ): Promise<Result<PaginatedResult<any>>> {
    try {
      const queryDto: QueryLLMExecutionRecordDto = {
        agentType: request.agentType,
        agentName: request.agentName,
        sessionId: request.sessionId,
        llmProvider: request.llmProvider,
        llmModel: request.llmModel,
        status: request.status,
        dateRange: request.dateRange ? {
          start: new Date(request.dateRange.start),
          end: new Date(request.dateRange.end)
        } : undefined,
        limit: request.limit || 50,
        offset: request.offset || 0,
        orderBy: 'createdAt',
        orderDirection: 'DESC',
      };

      const records = await this.executionRecordService.query(queryDto);
      
      const paginatedResult: PaginatedResult<any> = {
        items: records.map(record => ({
          id: record.id,
          sessionId: record.sessionId,
          agentType: record.agentType,
          agentName: record.agentName,
          executionPhase: record.executionPhase,
          llmProvider: record.llmProvider,
          llmModel: record.llmModel,
          status: record.status,
          executionTimeMs: record.executionTimeMs,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          totalTokens: record.totalTokens,
          createdAt: record.createdAt,
          errorMessage: record.errorMessage,
        })),
        total: records.length, // 注意：这里简化了，实际应该查询总数
        page: Math.floor((request.offset || 0) / (request.limit || 50)) + 1,
        limit: request.limit || 50,
        totalPages: Math.ceil(records.length / (request.limit || 50)),
        hasNext: records.length === (request.limit || 50),
        hasPrev: (request.offset || 0) > 0,
      };

      return Result.success(paginatedResult, '获取执行记录成功');
    } catch (error) {
      return Result.error(`查询LLM调用记录失败: ${error.message}`);
    }
  }

  @Get('agent/:agentType')
  @ApiOperation({ summary: '获取指定智能体的调用历史' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getAgentHistory(
    @Param('agentType') agentType: string,
    @Query('limit') limit?: string
  ): Promise<Result<any>> {
    try {
      const records = await this.executionRecordService.getAgentCallHistory(
        agentType,
        limit ? parseInt(limit) : 50
      );

      return Result.success({
        agentType,
        totalRecords: records.length,
        records: records.map(record => ({
          id: record.id,
          sessionId: record.sessionId,
          llmModel: record.llmModel,
          status: record.status,
          executionTimeMs: record.executionTimeMs,
          totalTokens: record.totalTokens,
          createdAt: record.createdAt,
        })),
      }, '获取智能体历史成功');
    } catch (error) {
      return Result.error(`获取智能体历史失败: ${error.message}`);
    }
  }

  @Post('statistics')
  @ApiOperation({ summary: '获取执行统计信息' })
  @ApiResponse({ status: 200, description: '统计成功' })
  async getStatistics(@Body() request: StatisticsRequestDto): Promise<Result<any>> {
    try {
      const queryDto: QueryLLMExecutionRecordDto = {
        agentType: request.agentType,
        llmProvider: request.llmProvider,
        llmModel: request.llmModel,
        dateRange: request.dateRange ? {
          start: new Date(request.dateRange.start),
          end: new Date(request.dateRange.end)
        } : undefined,
        limit: 10000, // 统计数据限制
      };

      const stats = await this.executionRecordService.getStats(queryDto);
      
      return Result.success(stats, '获取统计信息成功');
    } catch (error) {
      return Result.error(`获取统计信息失败: ${error.message}`);
    }
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: '获取仪表板摘要信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getDashboardSummary(): Promise<Result<any>> {
    try {
      // 获取最近24小时的统计
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

      const stats = await this.executionRecordService.getStats({
        dateRange: { start: startDate, end: endDate },
        limit: 5000,
      });

      return Result.success({
        period: '最近24小时',
        totalExecutions: stats.totalExecutions,
        successRate: stats.successRate,
        avgExecutionTime: stats.avgExecutionTime,
        tokenUsage: stats.tokenUsage,
        topAgentTypes: Object.entries(stats.byAgentType)
          .sort(([,a], [,b]) => (b as any).count - (a as any).count)
          .slice(0, 5),
        topLLMModels: Object.entries(stats.byLLMModel)
          .sort(([,a], [,b]) => (b as any).count - (a as any).count)
          .slice(0, 5),
      }, '获取仪表板摘要成功');
    } catch (error) {
      return Result.error(`获取仪表板摘要失败: ${error.message}`);
    }
  }
}