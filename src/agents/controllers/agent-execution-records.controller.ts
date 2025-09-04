import { Controller, Post, Body, Get, Query, Param, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AgentExecutionRecordService, QueryAgentExecutionRecordDto } from '../services/agent-execution-record.service';
import { AgentExecutionShardingService } from '../services/agent-execution-sharding.service';
import { AgentExecutionRecorderInterceptor } from '../interceptors/agent-execution-recorder.interceptor';
import { AgentType } from '../interfaces/agent.interface';
import { Result } from '../../common/dto/result.dto';
import { BusinessLogger, LogCategory } from '../../common/utils/business-logger.util';

/**
 * Agent执行记录管理控制器
 * 提供水平分表的执行记录查询和统计功能
 */
@ApiTags('智能体执行记录')
@Controller('api/v1/agents/execution-records')
@UseInterceptors(AgentExecutionRecorderInterceptor)
export class AgentExecutionRecordsController {
  private readonly businessLogger = new BusinessLogger(AgentExecutionRecordsController.name);

  constructor(
    private readonly executionRecordService: AgentExecutionRecordService,
    private readonly shardingService: AgentExecutionShardingService,
  ) {}

  @Post('query')
  @ApiOperation({ summary: '查询智能体执行记录' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async queryExecutionRecords(
    @Body() queryDto: QueryAgentExecutionRecordDto
  ): Promise<Result<any>> {
    this.businessLogger.httpRequest('POST', '/api/v1/agents/execution-records/query', queryDto);

    try {
      const records = await this.executionRecordService.queryExecutionRecords(queryDto);
      
      this.businessLogger.serviceInfo(
        `查询执行记录成功: 共${records.length}条记录`
      );

      return Result.success(records);
    } catch (error) {
      this.businessLogger.businessError('查询执行记录', error, queryDto);
      return Result.error(`查询执行记录失败: ${error.message}`);
    }
  }

  @Get('session/:sessionId')
  @ApiOperation({ summary: '根据会话ID获取执行记录' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getRecordsBySessionId(
    @Param('sessionId') sessionId: string
  ): Promise<Result<any>> {
    this.businessLogger.httpRequest('GET', `/api/v1/agents/execution-records/session/${sessionId}`);

    try {
      const records = await this.executionRecordService.getRecordsBySessionId(sessionId);
      
      this.businessLogger.serviceInfo(
        `获取会话记录成功: ${sessionId} - 共${records.length}条记录`
      );

      return Result.success({
        sessionId,
        recordCount: records.length,
        records: records.map(record => ({
          id: record.id,
          agentType: record.agentType,
          agentName: record.agentName,
          stockCode: record.stockCode,
          stockName: record.stockName,
          executionStatus: record.executionStatus,
          score: record.score,
          recommendation: record.recommendation,
          confidence: record.confidence,
          processingTimeMs: record.processingTimeMs,
          executionDate: record.executionDate,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          estimatedCost: record.estimatedCost,
        })),
      });
    } catch (error) {
      this.businessLogger.businessError('获取会话记录', error, { sessionId });
      return Result.error(`获取会话记录失败: ${error.message}`);
    }
  }

  @Get('stock/:stockCode/history')
  @ApiOperation({ summary: '获取指定股票的分析历史' })
  @ApiQuery({ name: 'agentType', required: false, enum: AgentType })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getStockAnalysisHistory(
    @Param('stockCode') stockCode: string,
    @Query('agentType') agentType?: AgentType,
    @Query('limit') limit?: number
  ): Promise<Result<any>> {
    this.businessLogger.httpRequest('GET', `/api/v1/agents/execution-records/stock/${stockCode}/history`);

    try {
      const records = await this.executionRecordService.getStockAnalysisHistory(
        stockCode,
        agentType,
        limit ? parseInt(limit.toString()) : 50
      );
      
      this.businessLogger.serviceInfo(
        `获取股票分析历史成功: ${stockCode} - 共${records.length}条记录`
      );

      // 按Agent类型分组统计
      const agentStats = records.reduce((acc, record) => {
        if (!acc[record.agentType]) {
          acc[record.agentType] = {
            count: 0,
            avgScore: 0,
            avgProcessingTime: 0,
            latestAnalysis: null,
          };
        }
        acc[record.agentType].count++;
        acc[record.agentType].avgScore += record.score || 0;
        acc[record.agentType].avgProcessingTime += record.processingTimeMs || 0;
        if (!acc[record.agentType].latestAnalysis || 
            record.executionDate > acc[record.agentType].latestAnalysis.executionDate) {
          acc[record.agentType].latestAnalysis = {
            executionDate: record.executionDate,
            score: record.score,
            recommendation: record.recommendation,
            confidence: record.confidence,
          };
        }
        return acc;
      }, {} as any);

      // 计算平均值
      Object.keys(agentStats).forEach(agentType => {
        const stats = agentStats[agentType];
        stats.avgScore = stats.count > 0 ? Math.round(stats.avgScore / stats.count) : 0;
        stats.avgProcessingTime = stats.count > 0 ? Math.round(stats.avgProcessingTime / stats.count) : 0;
      });

      return Result.success({
        stockCode,
        totalRecords: records.length,
        agentTypeStats: agentStats,
        recentRecords: records.slice(0, 10).map(record => ({
          id: record.id,
          agentType: record.agentType,
          agentName: record.agentName,
          executionDate: record.executionDate,
          score: record.score,
          recommendation: record.recommendation,
          confidence: record.confidence,
          processingTimeMs: record.processingTimeMs,
          analysis: record.analysisResult.substring(0, 200) + (record.analysisResult.length > 200 ? '...' : ''),
        }))
      });
    } catch (error) {
      this.businessLogger.businessError('获取股票分析历史', error, { stockCode, agentType, limit });
      return Result.error(`获取股票分析历史失败: ${error.message}`);
    }
  }

  @Post('statistics')
  @ApiOperation({ summary: '获取执行统计信息' })
  @ApiResponse({ status: 200, description: '统计成功' })
  async getExecutionStatistics(
    @Body() queryDto: QueryAgentExecutionRecordDto
  ): Promise<Result<any>> {
    this.businessLogger.httpRequest('POST', '/api/v1/agents/execution-records/statistics', queryDto);

    try {
      const stats = await this.executionRecordService.getExecutionStats(queryDto);
      
      this.businessLogger.serviceInfo(
        `获取执行统计成功: 总执行次数${stats.totalExecutions}, 成功率${(stats.successRate * 100).toFixed(1)}%`
      );

      return Result.success(stats);
    } catch (error) {
      this.businessLogger.businessError('获取执行统计', error, queryDto);
      return Result.error(`获取执行统计失败: ${error.message}`);
    }
  }

  @Get('sharding/stats')
  @ApiOperation({ summary: '获取分表统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getShardingStats(): Promise<Result<any>> {
    this.businessLogger.httpRequest('GET', '/api/v1/agents/execution-records/sharding/stats');

    try {
      const stats = await this.shardingService.getShardingStats();
      const sizes = await this.shardingService.getTableSizes();
      
      this.businessLogger.serviceInfo(
        `获取分表统计成功: 共${stats.totalTables}张分表`
      );

      return Result.success({
        ...stats,
        tableSizes: sizes,
      });
    } catch (error) {
      this.businessLogger.businessError('获取分表统计', error);
      return Result.error(`获取分表统计失败: ${error.message}`);
    }
  }

  @Post('cleanup')
  @ApiOperation({ summary: '清理过期记录' })
  @ApiResponse({ status: 200, description: '清理成功' })
  async cleanupExpiredRecords(
    @Body() body: { retentionDays?: number }
  ): Promise<Result<any>> {
    this.businessLogger.httpRequest('POST', '/api/v1/agents/execution-records/cleanup', body);

    try {
      const retentionDays = body.retentionDays || 90;
      await this.shardingService.cleanupOldRecords(retentionDays);
      
      this.businessLogger.serviceInfo(
        `清理过期记录成功: 保留${retentionDays}天内的记录`
      );

      return Result.success({
        message: `成功清理${retentionDays}天前的记录`,
        retentionDays,
      });
    } catch (error) {
      this.businessLogger.businessError('清理过期记录', error, body);
      return Result.error(`清理过期记录失败: ${error.message}`);
    }
  }

  @Post('create-tables')
  @ApiOperation({ summary: '创建所有分表' })
  @ApiResponse({ status: 200, description: '创建成功' })
  async createAllShardTables(): Promise<Result<any>> {
    this.businessLogger.httpRequest('POST', '/api/v1/agents/execution-records/create-tables');

    try {
      await this.shardingService.createAllShardTables();
      
      this.businessLogger.serviceInfo('创建所有分表成功');

      return Result.success({
        message: '所有智能体分表创建成功',
        agentTypes: Object.values(AgentType),
      });
    } catch (error) {
      this.businessLogger.businessError('创建分表', error);
      return Result.error(`创建分表失败: ${error.message}`);
    }
  }

  @Get('agent-types/:agentType/performance')
  @ApiOperation({ summary: '获取特定智能体类型的性能指标' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: '统计天数，默认30天' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getAgentPerformanceMetrics(
    @Param('agentType') agentType: AgentType,
    @Query('days') days?: number
  ): Promise<Result<any>> {
    this.businessLogger.httpRequest('GET', `/api/v1/agents/execution-records/agent-types/${agentType}/performance`);

    try {
      const statsDays = days ? parseInt(days.toString()) : 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - statsDays);

      const records = await this.executionRecordService.queryExecutionRecords({
        agentTypes: [agentType],
        dateRange: { start: startDate, end: endDate },
      });

      // 计算性能指标
      const totalExecutions = records.length;
      const successfulExecutions = records.filter(r => r.executionStatus === 'success');
      const failedExecutions = records.filter(r => r.executionStatus === 'error');
      
      const metrics = {
        totalExecutions,
        successRate: totalExecutions > 0 ? (successfulExecutions.length / totalExecutions) * 100 : 0,
        avgProcessingTime: records.length > 0 ? records.reduce((sum, r) => sum + (r.processingTimeMs || 0), 0) / records.length : 0,
        avgScore: successfulExecutions.length > 0 ? successfulExecutions.reduce((sum, r) => sum + (r.score || 0), 0) / successfulExecutions.length : 0,
        totalTokensUsed: records.reduce((sum, r) => sum + (r.totalTokens || 0), 0),
        totalCost: records.reduce((sum, r) => sum + Number(r.estimatedCost || 0), 0),
        errorRate: totalExecutions > 0 ? (failedExecutions.length / totalExecutions) * 100 : 0,
        avgConfidence: successfulExecutions.length > 0 ? successfulExecutions.reduce((sum, r) => sum + (r.confidence || 0), 0) / successfulExecutions.length : 0,
      };

      // 按日期统计
      const dailyStats = records.reduce((acc, record) => {
        const date = record.executionDate.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { executions: 0, successes: 0, totalTime: 0, totalTokens: 0 };
        }
        acc[date].executions++;
        if (record.executionStatus === 'success') acc[date].successes++;
        acc[date].totalTime += record.processingTimeMs || 0;
        acc[date].totalTokens += record.totalTokens || 0;
        return acc;
      }, {} as any);

      this.businessLogger.serviceInfo(
        `获取${agentType}性能指标成功: ${statsDays}天内共${totalExecutions}次执行`
      );

      return Result.success({
        agentType,
        period: `${statsDays}天`,
        metrics,
        dailyStats,
      });
    } catch (error) {
      this.businessLogger.businessError('获取智能体性能指标', error, { agentType, days });
      return Result.error(`获取性能指标失败: ${error.message}`);
    }
  }
}