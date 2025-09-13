import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  Inject,
  Optional,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { AnalysisService } from "./analysis.service";
import { CreateAnalysisDto, AnalysisPriority } from "./dto/create-analysis.dto";
import { Result } from "../../common/dto/result.dto";
import { HybridWorkflowService } from "../../agents/langgraph/integration/hybrid-workflow.service";
import { WorkflowBridgeService } from "../../agents/langgraph/integration/workflow-bridge";
import { PerformanceMonitorService } from "../../agents/langgraph/monitoring/performance-monitor";

/**
 * 分析控制器 - 智能体分析接口
 * 集成 LangGraphJS 混合工作流架构，提供智能的工作流选择和执行
 */
@ApiTags("智能体分析")
@Controller("/analysis")
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    @Optional() private readonly hybridWorkflowService?: HybridWorkflowService,
    @Optional() private readonly workflowBridgeService?: WorkflowBridgeService,
    @Optional() private readonly performanceMonitorService?: PerformanceMonitorService,
  ) {}

  /**
   * 股票分析接口 - 根据股票代码启动增强版分析工作流
   */
  @Post("analyze")
  @ApiOperation({
    summary: "股票分析",
    description: "根据股票代码启动三阶段智能体分析工作流（数据收集 -> 专业分析 -> 决策整合），立即返回工作流信息，分析在后台执行",
  })
  @ApiResponse({
    status: 201,
    description: "分析工作流已启动或已有分析报告已发送",
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 0 },
        data: {
          oneOf: [
            {
              type: 'object',
              properties: {
                workflowId: { type: 'string', example: 'stock-analysis-000001-2024-08-26' },
                sessionId: { type: 'string', example: 'analysis_session_1724654321000' },
                message: { type: 'string', example: '股票 000001 的分析工作流已启动，正在执行三阶段智能体分析' },
                existingAnalysis: { type: 'boolean', example: false }
              }
            },
            {
              type: 'object',
              properties: {
                message: { type: 'string', example: '股票 000001 的已有分析报告已发送到消息渠道 (2/2)' },
                existingAnalysis: { type: 'boolean', example: true }
              }
            }
          ]
        },
        message: { type: 'string', example: '分析工作流已启动' },
        timestamp: { type: 'string', example: '2024-08-26T10:30:00.000Z' }
      }
    }
  })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 500, description: "服务器内部错误" })
  async analyzeStock(
    @Body() body: { stockCode: string; stockName?: string },
  ): Promise<Result<{ workflowId?: string; sessionId?: string; message: string; existingAnalysis?: boolean }>> {
    const dto: CreateAnalysisDto = {
      stockCode: body.stockCode,
      stockName: body.stockName,
    };
    return await this.analysisService.createAnalysis(dto);
  }

  /**
   * 股票分析接口 - 使用三阶段智能体工作流
   */
  @Post("analyze-enhanced")
  @ApiOperation({
    summary: "股票分析",
    description: "使用三阶段智能体工作流进行股票分析：数据收集 -> 专业分析 -> 决策整合",
  })
  @ApiResponse({
    status: 201,
    description: "分析工作流已启动或已有分析报告已发送",
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 0 },
        data: {
          oneOf: [
            {
              type: 'object',
              properties: {
                workflowId: { type: 'string', example: 'stock-analysis-000001-2024-08-26' },
                sessionId: { type: 'string', example: 'analysis_session_1724654321000' },
                message: { type: 'string', example: '股票 000001 的分析工作流已启动' },
                analysisType: { type: 'string', example: 'comprehensive' },
                executionMode: { type: 'string', example: 'hybrid' },
                existingAnalysis: { type: 'boolean', example: false }
              }
            },
            {
              type: 'object',
              properties: {
                message: { type: 'string', example: '股票 000001 的已有分析报告已发送到消息渠道 (2/2)' },
                analysisType: { type: 'string', example: 'comprehensive' },
                executionMode: { type: 'string', example: 'existing_analysis' },
                existingAnalysis: { type: 'boolean', example: true }
              }
            }
          ]
        },
        message: { type: 'string', example: '分析工作流已启动' },
        timestamp: { type: 'string', example: '2024-08-26T10:30:00.000Z' }
      }
    }
  })
  async analyzeStockEnhanced(
    @Body() body: { stockCode: string; stockName?: string },
  ): Promise<Result<{ workflowId?: string; sessionId?: string; message: string; analysisType?: string; executionMode?: string; existingAnalysis?: boolean }>> {
    const dto: CreateAnalysisDto = {
      stockCode: body.stockCode,
      stockName: body.stockName,
    };
    return await this.analysisService.createEnhancedAnalysis(dto);
  }

  /**
   * 混合工作流股票分析接口 - 支持高级配置选项
   */
  @Post("analyze-hybrid")
  @ApiOperation({
    summary: "混合工作流股票分析",
    description: "使用LangGraphJS混合工作流进行智能股票分析，支持优先级、实时性要求等高级配置",
  })
  @ApiResponse({
    status: 201,
    description: "混合工作流分析已启动",
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 0 },
        data: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', example: 'hybrid-analysis-000001-2024-08-26' },
            sessionId: { type: 'string', example: 'analysis_session_1724654321000' },
            message: { type: 'string', example: '股票 000001 的混合工作流分析已启动，执行模式: hybrid' },
            executionMode: { type: 'string', example: 'hybrid' },
            existingAnalysis: { type: 'boolean', example: false }
          }
        },
        message: { type: 'string', example: '混合工作流分析已启动' },
        timestamp: { type: 'string', example: '2024-08-26T10:30:00.000Z' }
      }
    }
  })
  async analyzeStockHybrid(
    @Body() dto: CreateAnalysisDto,
  ): Promise<Result<{ workflowId?: string; sessionId?: string; message: string; executionMode?: string; existingAnalysis?: boolean }>> {
    return await this.analysisService.createEnhancedAnalysis(dto);
  }

  /**
   * 获取混合工作流系统状态
   */
  @Get("hybrid-status")
  @ApiOperation({
    summary: "获取混合工作流系统状态",
    description: "查看LangGraphJS和Temporal系统的可用性、性能统计和配置信息",
  })
  @ApiResponse({
    status: 200,
    description: "系统状态信息",
  })
  async getHybridWorkflowStatus() {
    if (!this.workflowBridgeService || !this.hybridWorkflowService) {
      return Result.error('混合工作流服务未启用');
    }

    try {
      const systemStatus = await this.workflowBridgeService.getSystemStatus();
      const performanceReport = this.hybridWorkflowService.getPerformanceReport();

      return Result.success({
        systemStatus,
        performanceReport,
        timestamp: new Date().toISOString(),
      }, '获取混合工作流状态成功');
    } catch (error) {
      return Result.error(`获取状态失败: ${error.message}`);
    }
  }

  /**
   * 获取工作流性能统计
   */
  @Get("performance-stats")
  @ApiOperation({
    summary: "获取工作流性能统计",
    description: "查看各种工作流模式的执行性能和成功率统计",
  })
  @ApiResponse({
    status: 200,
    description: "性能统计信息",
  })
  async getPerformanceStats() {
    if (!this.hybridWorkflowService) {
      return Result.error('混合工作流服务未启用');
    }

    try {
      const stats = this.hybridWorkflowService.getPerformanceReport();
      return Result.success(stats, '获取性能统计成功');
    } catch (error) {
      return Result.error(`获取性能统计失败: ${error.message}`);
    }
  }

  /**
   * 优化混合工作流配置
   */
  @Post("optimize-config")
  @ApiOperation({
    summary: "优化混合工作流配置",
    description: "基于历史性能数据自动优化工作流配置参数",
  })
  @ApiResponse({
    status: 200,
    description: "配置优化建议",
  })
  async optimizeHybridConfig() {
    if (!this.hybridWorkflowService) {
      return Result.error('混合工作流服务未启用');
    }

    try {
      const optimizations = await this.hybridWorkflowService.optimizeConfiguration();
      return Result.success(optimizations, '配置优化建议生成成功');
    } catch (error) {
      return Result.error(`配置优化失败: ${error.message}`);
    }
  }

  /**
   * 重置性能统计
   */
  @Post("reset-stats")
  @ApiOperation({
    summary: "重置性能统计",
    description: "清空所有工作流的性能统计数据",
  })
  @ApiResponse({
    status: 200,
    description: "重置成功",
  })
  async resetPerformanceStats() {
    if (!this.hybridWorkflowService) {
      return Result.error('混合工作流服务未启用');
    }

    try {
      this.hybridWorkflowService.resetPerformanceStats();
      return Result.success(null, '性能统计已重置');
    } catch (error) {
      return Result.error(`重置失败: ${error.message}`);
    }
  }

  /**
   * 获取增强的性能监控报告
   */
  @Get("enhanced-performance-report")
  @ApiOperation({
    summary: "获取增强性能监控报告",
    description: "获取包含混合工作流、性能监控、系统健康状态、预测和告警的综合报告",
  })
  @ApiResponse({
    status: 200,
    description: "增强性能监控报告",
  })
  async getEnhancedPerformanceReport() {
    if (!this.hybridWorkflowService || !this.performanceMonitorService) {
      return Result.error('性能监控服务未启用');
    }

    try {
      const report = await this.hybridWorkflowService.getEnhancedPerformanceReport();
      return Result.success(report, '获取增强性能监控报告成功');
    } catch (error) {
      return Result.error(`获取增强性能监控报告失败: ${error.message}`);
    }
  }

  /**
   * 获取实时监控数据
   */
  @Get("real-time-monitoring")
  @ApiOperation({
    summary: "获取实时监控数据",
    description: "获取当前系统性能指标、健康状态、活跃工作流和近期告警信息",
  })
  @ApiResponse({
    status: 200,
    description: "实时监控数据",
  })
  async getRealTimeMonitoring() {
    if (!this.hybridWorkflowService) {
      return Result.error('实时监控服务未启用');
    }

    try {
      const monitoring = await this.hybridWorkflowService.getRealTimeMonitoring();
      return Result.success(monitoring, '获取实时监控数据成功');
    } catch (error) {
      return Result.error(`获取实时监控数据失败: ${error.message}`);
    }
  }

  /**
   * 获取趋势分析
   */
  @Get("trend-analysis")
  @ApiOperation({
    summary: "获取趋势分析",
    description: "分析指定时间范围内的性能趋势、错误趋势和工作负载趋势",
  })
  @ApiResponse({
    status: 200,
    description: "趋势分析报告",
  })
  async getTrendAnalysis(
    @Query() query: { timeRange?: string }
  ) {
    if (!this.hybridWorkflowService) {
      return Result.error('趋势分析服务未启用');
    }

    try {
      const timeRange = query.timeRange || '24h';
      const analysis = await this.hybridWorkflowService.getTrendAnalysis(timeRange);
      return Result.success(analysis, '获取趋势分析成功');
    } catch (error) {
      return Result.error(`获取趋势分析失败: ${error.message}`);
    }
  }

  /**
   * 导出性能数据
   */
  @Get("export-performance-data")
  @ApiOperation({
    summary: "导出性能数据",
    description: "导出指定格式和条件的性能监控数据",
  })
  @ApiResponse({
    status: 200,
    description: "性能数据导出结果",
  })
  async exportPerformanceData(
    @Query() query: {
      format?: 'json' | 'csv';
      stockCode?: string;
      mode?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    if (!this.hybridWorkflowService) {
      return Result.error('性能监控服务未启用');
    }

    try {
      const format = query.format || 'json';
      const filters: any = {};
      
      if (query.stockCode) filters.stockCode = query.stockCode;
      if (query.mode) filters.mode = query.mode;
      if (query.startDate) filters.startDate = new Date(query.startDate);
      if (query.endDate) filters.endDate = new Date(query.endDate);

      const exportedData = await this.hybridWorkflowService.exportPerformanceData(format, filters);
      
      return Result.success({
        format,
        data: exportedData,
        filters,
        exportedAt: new Date().toISOString(),
      }, '性能数据导出成功');
    } catch (error) {
      return Result.error(`导出性能数据失败: ${error.message}`);
    }
  }

  /**
   * 获取系统健康状态
   */
  @Get("system-health")
  @ApiOperation({
    summary: "获取系统健康状态",
    description: "获取CPU、内存、工作流状态等系统健康信息",
  })
  @ApiResponse({
    status: 200,
    description: "系统健康状态",
  })
  async getSystemHealth() {
    if (!this.performanceMonitorService) {
      return Result.error('性能监控服务未启用');
    }

    try {
      const health = await this.performanceMonitorService.getSystemHealthStatus();
      return Result.success(health, '获取系统健康状态成功');
    } catch (error) {
      return Result.error(`获取系统健康状态失败: ${error.message}`);
    }
  }

  /**
   * 获取性能预测
   */
  @Get("performance-predictions")
  @ApiOperation({
    summary: "获取性能预测",
    description: "基于历史数据预测未来性能趋势和潜在问题",
  })
  @ApiResponse({
    status: 200,
    description: "性能预测结果",
  })
  async getPerformancePredictions() {
    if (!this.performanceMonitorService) {
      return Result.error('性能监控服务未启用');
    }

    try {
      const predictions = await this.performanceMonitorService.getPredictions();
      return Result.success(predictions, '获取性能预测成功');
    } catch (error) {
      return Result.error(`获取性能预测失败: ${error.message}`);
    }
  }

  /**
   * 获取股票性能指标
   */
  @Get("stock-performance/:stockCode")
  @ApiOperation({
    summary: "获取股票性能指标",
    description: "获取指定股票的详细性能指标和历史数据",
  })
  @ApiResponse({
    status: 200,
    description: "股票性能指标",
  })
  async getStockPerformance(
    @Param() params: { stockCode: string },
    @Query() query: { days?: number }
  ) {
    if (!this.performanceMonitorService) {
      return Result.error('性能监控服务未启用');
    }

    try {
      const days = query.days || 7;
      const metrics = await this.performanceMonitorService.getMetricsByStock(params.stockCode, days);
      const stats = await this.performanceMonitorService.getPerformanceStatsByStock(params.stockCode);

      return Result.success({
        stockCode: params.stockCode,
        metrics,
        stats,
        period: `${days}天`,
        retrievedAt: new Date().toISOString(),
      }, '获取股票性能指标成功');
    } catch (error) {
      return Result.error(`获取股票性能指标失败: ${error.message}`);
    }
  }

  /**
   * 清理历史性能数据
   */
  @Post("cleanup-performance-data")
  @ApiOperation({
    summary: "清理历史性能数据",
    description: "清理指定天数之前的历史性能数据",
  })
  @ApiResponse({
    status: 200,
    description: "清理结果",
  })
  async cleanupPerformanceData(
    @Body() body: { daysToKeep: number }
  ) {
    if (!this.performanceMonitorService) {
      return Result.error('性能监控服务未启用');
    }

    try {
      const daysToKeep = body.daysToKeep || 30;
      const result = await this.performanceMonitorService.cleanupOldData(daysToKeep);
      
      return Result.success({
        cleanedRecords: result.cleanedCount,
        daysToKeep,
        cleanupTime: new Date().toISOString(),
      }, `已清理 ${result.cleanedCount} 条历史性能数据`);
    } catch (error) {
      return Result.error(`清理性能数据失败: ${error.message}`);
    }
  }
}
