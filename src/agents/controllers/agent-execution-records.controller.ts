import { Controller, Post, Body, Get, Query, Param, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AgentExecutionRecordService, QueryLLMExecutionRecordDto } from '../services/agent-execution-record.service';
import { Result } from '../../common/dto/result.dto';
import { BusinessLogger, LogCategory } from '../../common/utils/business-logger.util';

/**
 * LLM调用记录管理控制器
 * 提供LLM调用记录的查询和统计功能
 */
@ApiTags('LLM调用记录')
@Controller('api/v1/agents/execution-records')
export class AgentExecutionRecordsController {
  private readonly businessLogger = new BusinessLogger(AgentExecutionRecordsController.name);

  constructor(
    private readonly executionRecordService: AgentExecutionRecordService,
  ) {}

  @Post('query')
  @ApiOperation({ summary: '查询LLM调用记录' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async queryExecutionRecords(
    @Body() queryDto: QueryLLMExecutionRecordDto
  ): Promise<Result<any>> {
    this.businessLogger.httpRequest('POST', '/api/v1/agents/execution-records/query', queryDto);

    try {
      const records = await this.executionRecordService.query(queryDto);
      
      this.businessLogger.serviceInfo(
        `查询LLM调用记录成功: 共${records.length}条记录`
      );

      return Result.success(records);
    } catch (error) {
      this.businessLogger.businessError('查询LLM调用记录', error, queryDto);
      return Result.error(`查询LLM调用记录失败: ${error.message}`);
    }
  }

  @Get('session/:sessionId')
  @ApiOperation({ summary: '根据会话ID获取LLM调用记录' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getRecordsBySessionId(
    @Param('sessionId') sessionId: string
  ): Promise<Result<any>> {
    this.businessLogger.httpRequest('GET', `/api/v1/agents/execution-records/session/${sessionId}`);

    try {
      const records = await this.executionRecordService.getRecordsBySessionId(sessionId);
      
      this.businessLogger.serviceInfo(
        `获取会话记录成功: 会话${sessionId} - 共${records.length}条记录`
      );

      return Result.success({
        sessionId,
        recordCount: records.length,
        records: records.map(record => ({
          id: record.id,
          agentType: record.agentType,
          agentName: record.agentName,
          executionPhase: record.executionPhase,
          llmProvider: record.llmProvider,
          llmModel: record.llmModel,
          status: record.status,
          executionTimeMs: record.executionTimeMs,
          createdAt: record.createdAt,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          totalTokens: record.totalTokens,
          metadata: record.metadata,
        })),
      });
    } catch (error) {
      this.businessLogger.businessError('获取会话记录', error, { sessionId });
      return Result.error(`获取会话记录失败: ${error.message}`);
    }
  }

  @Get('agent/:agentType/history')
  @ApiOperation({ summary: '获取指定智能体的调用历史' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getAgentCallHistory(
    @Param('agentType') agentType: string,
    @Query('limit') limit?: number
  ): Promise<Result<any>> {
    this.businessLogger.httpRequest('GET', `/api/v1/agents/execution-records/agent/${agentType}/history`);

    try {
      const records = await this.executionRecordService.getAgentCallHistory(
        agentType,
        limit ? parseInt(limit.toString()) : 50
      );
      
      this.businessLogger.serviceInfo(
        `获取智能体调用历史成功: ${agentType} - 共${records.length}条记录`
      );

      // 按模型分组统计
      const modelStats = records.reduce((acc, record) => {
        if (!acc[record.llmModel]) {
          acc[record.llmModel] = {
            count: 0,
            avgExecutionTime: 0,
            totalTokens: 0,
            successCount: 0,
          };
        }
        acc[record.llmModel].count++;
        acc[record.llmModel].avgExecutionTime += record.executionTimeMs || 0;
        acc[record.llmModel].totalTokens += record.totalTokens || 0;
        if (record.status === 'success') {
          acc[record.llmModel].successCount++;
        }
        return acc;
      }, {} as Record<string, any>);

      // 计算平均值和成功率
      Object.keys(modelStats).forEach(model => {
        const stats = modelStats[model];
        stats.avgExecutionTime = stats.count > 0 ? stats.avgExecutionTime / stats.count : 0;
        stats.successRate = stats.count > 0 ? stats.successCount / stats.count : 0;
        delete stats.successCount;
      });

      return Result.success({
        agentType,
        totalCalls: records.length,
        modelStats,
        recentRecords: records.slice(0, 10).map(record => ({
          id: record.id,
          llmModel: record.llmModel,
          status: record.status,
          executionTimeMs: record.executionTimeMs,
          totalTokens: record.totalTokens,
          createdAt: record.createdAt,
        })),
      });
    } catch (error) {
      this.businessLogger.businessError('获取智能体调用历史', error, { agentType });
      return Result.error(`获取智能体调用历史失败: ${error.message}`);
    }
  }

  @Post('stats')
  @ApiOperation({ summary: '获取LLM调用统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getExecutionStats(
    @Body() queryDto: QueryLLMExecutionRecordDto
  ): Promise<Result<any>> {
    this.businessLogger.httpRequest('POST', '/api/v1/agents/execution-records/stats', queryDto);

    try {
      const stats = await this.executionRecordService.getStats(queryDto);
      
      this.businessLogger.serviceInfo(
        `获取LLM调用统计成功: 共${stats.totalExecutions}条记录`
      );

      return Result.success(stats);
    } catch (error) {
      this.businessLogger.businessError('获取LLM调用统计', error, queryDto);
      return Result.error(`获取LLM调用统计失败: ${error.message}`);
    }
  }

  @Get('dashboard')
  @ApiOperation({ summary: '获取仪表板数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getDashboardData(): Promise<Result<any>> {
    this.businessLogger.httpRequest('GET', '/api/v1/agents/execution-records/dashboard');

    try {
      // 获取最近7天的统计
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats = await this.executionRecordService.getStats({
        dateRange: { start: startDate, end: endDate },
        limit: 1000,
      });

      // 获取最近的记录
      const recentRecords = await this.executionRecordService.query({
        limit: 20,
        orderBy: 'createdAt',
        orderDirection: 'DESC',
      });

      this.businessLogger.serviceInfo('获取仪表板数据成功');

      return Result.success({
        summary: {
          totalExecutions: stats.totalExecutions,
          successRate: stats.successRate,
          avgExecutionTime: stats.avgExecutionTime,
          totalTokens: stats.tokenUsage.totalTokens,
        },
        byAgentType: stats.byAgentType,
        byLLMModel: stats.byLLMModel,
        byDate: stats.byDate,
        recentRecords: recentRecords.map(record => ({
          id: record.id,
          agentType: record.agentType,
          agentName: record.agentName,
          llmModel: record.llmModel,
          status: record.status,
          executionTimeMs: record.executionTimeMs,
          totalTokens: record.totalTokens,
          createdAt: record.createdAt,
        })),
      });
    } catch (error) {
      this.businessLogger.businessError('获取仪表板数据', error);
      return Result.error(`获取仪表板数据失败: ${error.message}`);
    }
  }
}