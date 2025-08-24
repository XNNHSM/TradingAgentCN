import {
  Injectable,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AgentContext } from "../../agents/interfaces/agent.interface";
import { AnalysisRecord } from "./entities/analysis-record.entity";
import { CreateAnalysisDto } from "./dto/create-analysis.dto";
import { Result } from "../../common/dto/result.dto";
import { AgentsTemporalClientService } from "../../agents/temporal/agents-temporal-client.service";

/**
 * 分析服务 - 基于MCP统一智能体的股票分析服务
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectRepository(AnalysisRecord)
    private readonly analysisRepository: Repository<AnalysisRecord>,
    private readonly agentsTemporalClient: AgentsTemporalClientService,
  ) {}

  /**
   * 创建股票分析任务 - 基于MCP统一智能体架构
   */
  async createAnalysis(
    dto: CreateAnalysisDto,
  ): Promise<Result<AnalysisRecord>> {
    this.logger.log(`开始分析股票: ${dto.stockCode}`);

    try {
      // 构建分析上下文
      const context: AgentContext = {
        stockCode: dto.stockCode,
        stockName: dto.stockName,
        timeRange: this.buildTimeRange(dto.startDate, dto.endDate),
        metadata: dto.metadata || {},
      };

      let status: "success" | "partial" | "failed" = "success";
      let errorMessage: string | undefined;
      let analysisResult: any;
      const startTime = Date.now();

      try {
        // 生成会话ID
        const sessionId = `analysis_session_${Date.now()}`;
        
        // 使用Temporal工作流执行分析
        const workflowHandle = await this.agentsTemporalClient.startStockAnalysisWorkflow({
          stockCode: dto.stockCode,
          stockName: dto.stockName,
          sessionId,
          metadata: dto.metadata || {},
        });
        
        if (!workflowHandle) {
          throw new Error('无法启动股票分析工作流');
        }
        
        // 等待工作流完成
        const workflowResult = await workflowHandle.result();
        
        // 转换为AnalysisService期望的格式
        analysisResult = {
          stockCode: dto.stockCode,
          stockName: dto.stockName,
          executionTime: workflowResult.processingTime,
          timestamp: new Date(),
          sessionId: workflowResult.sessionId,
          finalScore: workflowResult.finalRecommendation.score,
          finalRecommendation: workflowResult.finalRecommendation.recommendation,
          confidence: workflowResult.finalRecommendation.confidence,
          keyInsights: workflowResult.finalRecommendation.keyInsights,
          majorRisks: workflowResult.finalRecommendation.risks,
          comprehensiveAnalysis: workflowResult.results[0]?.analysis,
          tradingStrategy: workflowResult.results[1]?.analysis,
          fullReport: workflowResult.finalRecommendation.analysis,
        };
      } catch (error) {
        this.logger.error(`分析执行失败: ${error.message}`, error.stack);
        status = "failed";
        errorMessage = error.message;
        analysisResult = {
          stockCode: dto.stockCode,
          stockName: dto.stockName,
          executionTime: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      // 保存分析记录
      const record = this.analysisRepository.create({
        stockCode: dto.stockCode,
        stockName: dto.stockName,
        analysisType: "full", // 统一使用完整分析
        context,
        results: analysisResult,
        averageScore: analysisResult.finalScore,
        finalRecommendation: analysisResult.finalRecommendation,
        confidence: analysisResult.confidence,
        keyInsights: analysisResult.keyInsights,
        majorRisks: analysisResult.majorRisks,
        executionTime: analysisResult.executionTime || Date.now() - startTime,
        status,
        errorMessage,
        metadata: dto.metadata,
      });

      const savedRecord = await this.analysisRepository.save(record);

      if (status === "failed") {
        return Result.error("分析执行失败，请稍后重试", 500, savedRecord);
      } else {
        return Result.success(savedRecord, "股票分析完成");
      }
    } catch (error) {
      this.logger.error(`创建分析任务失败: ${error.message}`, error.stack);
      throw new BadRequestException(`创建分析任务失败: ${error.message}`);
    }
  }


  /**
   * 构建时间范围
   */
  private buildTimeRange(
    startDate?: string,
    endDate?: string,
  ): { startDate: Date; endDate: Date } {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 默认30天前

    return { startDate: start, endDate: end };
  }
}
