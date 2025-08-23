import {
  Controller,
  Post,
  Body,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { AnalysisService } from "./analysis.service";
import { CreateAnalysisDto } from "./dto/create-analysis.dto";
import { Result } from "../../common/dto/result.dto";
import { AnalysisRecord } from "./entities/analysis-record.entity";

/**
 * 分析控制器 - 智能体分析接口
 */
@ApiTags("智能体分析")
@Controller("api/v1/analysis")
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * 股票分析接口 - 根据股票代码调用分析工作流
   */
  @Post("analyze")
  @ApiOperation({
    summary: "股票分析",
    description: "根据股票代码调用MCP统一智能体分析工作流，生成综合投资建议",
  })
  @ApiResponse({
    status: 201,
    description: "分析完成",
    type: Result<AnalysisRecord>,
  })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 500, description: "服务器内部错误" })
  async analyzeStock(
    @Body() body: { stockCode: string; stockName?: string },
  ): Promise<Result<AnalysisRecord>> {
    const dto: CreateAnalysisDto = {
      stockCode: body.stockCode,
      stockName: body.stockName,
    };
    return await this.analysisService.createAnalysis(dto);
  }
}
