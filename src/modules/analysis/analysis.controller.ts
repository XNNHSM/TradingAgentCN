import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { AnalysisService } from "./analysis.service";
import {
  CreateAnalysisDto,
  GetAnalysisRecordsDto,
  GetAnalysisDetailDto,
} from "./dto/create-analysis.dto";
import { Result, PaginatedResult } from "../../common/dto/result.dto";
import { AnalysisRecord } from "./entities/analysis-record.entity";

/**
 * 分析控制器 - 智能体分析接口
 */
@ApiTags("智能体分析")
@Controller("api/v1/analysis")
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * 创建分析任务
   */
  @Post("create")
  @ApiOperation({
    summary: "创建分析任务",
    description: "基于多智能体协作对指定股票进行分析",
  })
  @ApiResponse({
    status: 201,
    description: "分析任务创建成功",
    type: Result<AnalysisRecord>,
  })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 500, description: "服务器内部错误" })
  async createAnalysis(
    @Body() dto: CreateAnalysisDto,
  ): Promise<Result<AnalysisRecord>> {
    return await this.analysisService.createAnalysis(dto);
  }

  /**
   * 获取分析记录列表
   */
  @Post("list")
  @ApiOperation({
    summary: "获取分析记录列表",
    description: "分页获取历史分析记录",
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: Result<PaginatedResult<AnalysisRecord>>,
  })
  async getAnalysisRecords(
    @Body() dto: GetAnalysisRecordsDto,
  ): Promise<Result<PaginatedResult<AnalysisRecord>>> {
    return await this.analysisService.getAnalysisRecords(dto);
  }

  /**
   * 获取分析记录详情
   */
  @Post("detail")
  @ApiOperation({
    summary: "获取分析记录详情",
    description: "获取指定分析记录的完整详情",
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: Result<AnalysisRecord>,
  })
  @ApiResponse({ status: 404, description: "分析记录不存在" })
  async getAnalysisDetail(
    @Body() dto: GetAnalysisDetailDto,
  ): Promise<Result<AnalysisRecord>> {
    return await this.analysisService.getAnalysisDetail(parseInt(dto.id));
  }

  /**
   * 删除分析记录
   */
  @Post("delete")
  @ApiOperation({
    summary: "删除分析记录",
    description: "软删除指定的分析记录",
  })
  @ApiResponse({
    status: 200,
    description: "删除成功",
    type: Result<null>,
  })
  @ApiResponse({ status: 404, description: "分析记录不存在" })
  async deleteAnalysis(
    @Body() dto: GetAnalysisDetailDto,
  ): Promise<Result<null>> {
    return await this.analysisService.deleteAnalysis(parseInt(dto.id));
  }

  /**
   * 获取股票最新分析
   */
  @Post("latest")
  @ApiOperation({
    summary: "获取股票最新分析",
    description: "获取指定股票的最新分析记录",
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: Result<AnalysisRecord>,
  })
  async getLatestAnalysis(
    @Body() body: { stockCode: string },
  ): Promise<Result<AnalysisRecord | null>> {
    return await this.analysisService.getLatestAnalysis(body.stockCode);
  }

  /**
   * 获取分析统计信息
   */
  @Post("stats")
  @ApiOperation({
    summary: "获取分析统计信息",
    description: "获取系统分析的整体统计数据",
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: Result,
  })
  async getAnalysisStats(): Promise<Result<any>> {
    return await this.analysisService.getAnalysisStats();
  }

  /**
   * 快速分析接口 - 便捷方式
   */
  @Post("quick")
  @ApiOperation({
    summary: "快速分析",
    description: "对指定股票执行快速分析（仅核心分析师）",
  })
  @ApiResponse({
    status: 201,
    description: "快速分析完成",
    type: Result<AnalysisRecord>,
  })
  async quickAnalysis(
    @Body() body: { stockCode: string; stockName?: string },
  ): Promise<Result<AnalysisRecord>> {
    const dto: CreateAnalysisDto = {
      stockCode: body.stockCode,
      stockName: body.stockName,
      analysisType: "quick",
    };
    return await this.analysisService.createAnalysis(dto);
  }

  /**
   * 完整分析接口 - 便捷方式
   */
  @Post("full")
  @ApiOperation({
    summary: "完整分析",
    description: "对指定股票执行完整的多智能体协作分析",
  })
  @ApiResponse({
    status: 201,
    description: "完整分析完成",
    type: Result<AnalysisRecord>,
  })
  async fullAnalysis(
    @Body() body: { stockCode: string; stockName?: string },
  ): Promise<Result<AnalysisRecord>> {
    const dto: CreateAnalysisDto = {
      stockCode: body.stockCode,
      stockName: body.stockName,
      analysisType: "full",
    };
    return await this.analysisService.createAnalysis(dto);
  }
}
