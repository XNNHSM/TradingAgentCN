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

/**
 * 分析控制器 - 智能体分析接口
 */
@ApiTags("智能体分析")
@Controller("/analysis")
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

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
    description: "分析工作流已启动",
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 0 },
        data: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', example: 'stock-analysis-000001-2024-08-26' },
            sessionId: { type: 'string', example: 'analysis_session_1724654321000' },
            message: { type: 'string', example: '股票 000001 的增强版分析工作流已启动，正在执行三阶段智能体分析' }
          }
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
  ): Promise<Result<{ workflowId: string; sessionId: string; message: string }>> {
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
    description: "分析工作流已启动",
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 0 },
        data: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', example: 'stock-analysis-000001-2024-08-26' },
            sessionId: { type: 'string', example: 'analysis_session_1724654321000' },
            message: { type: 'string', example: '股票 000001 的分析工作流已启动' },
            analysisType: { type: 'string', example: 'comprehensive' }
          }
        },
        message: { type: 'string', example: '分析工作流已启动' },
        timestamp: { type: 'string', example: '2024-08-26T10:30:00.000Z' }
      }
    }
  })
  async analyzeStockEnhanced(
    @Body() body: { stockCode: string; stockName?: string },
  ): Promise<Result<{ workflowId: string; sessionId: string; message: string; analysisType: string }>> {
    const dto: CreateAnalysisDto = {
      stockCode: body.stockCode,
      stockName: body.stockName,
    };
    return await this.analysisService.createEnhancedAnalysis(dto);
  }
}
