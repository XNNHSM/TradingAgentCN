import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
// import {
//   AgentOrchestratorService,
//   AnalysisResult,
//   QuickAnalysisResult,
// } from "../../agents/services/agent-orchestrator.service";

// Temporary type definitions for missing services
interface AnalysisResult {
  stockCode: string;
  stockName: string;
  executionTime: number;
  timestamp: Date;
  summary?: {
    averageScore?: number;
    finalRecommendation?: any;
    confidence?: number;
    keyInsights?: string[];
    majorRisks?: string[];
  };
}

interface QuickAnalysisResult {
  stockCode: string;
  stockName: string;
  executionTime: number;
  timestamp: Date;
  quickSummary?: {
    averageScore?: number;
    recommendation?: any;
    confidence?: number;
    keyPoints?: string[];
    mainRisks?: string[];
  };
}

interface AgentOrchestratorService {
  executeFullAnalysis(context: any): Promise<AnalysisResult>;
  executeQuickAnalysis(context: any): Promise<QuickAnalysisResult>;
}

import { AgentContext } from "../../agents/interfaces/agent.interface";
import { AnalysisRecord } from "./entities/analysis-record.entity";
import {
  CreateAnalysisDto,
  GetAnalysisRecordsDto,
} from "./dto/create-analysis.dto";
import { Result, PaginatedResult } from "../../common/dto/result.dto";

/**
 * 分析服务 - 管理智能体分析流程
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectRepository(AnalysisRecord)
    private readonly analysisRepository: Repository<AnalysisRecord>,
    // private readonly agentOrchestrator: AgentOrchestratorService,
  ) {}

  /**
   * 创建新的分析任务
   */
  async createAnalysis(
    dto: CreateAnalysisDto,
  ): Promise<Result<AnalysisRecord>> {
    this.logger.log(`开始分析股票: ${dto.stockCode} (${dto.analysisType})`);

    try {
      // 构建分析上下文
      const context: AgentContext = {
        stockCode: dto.stockCode,
        stockName: dto.stockName,
        timeRange: this.buildTimeRange(dto.startDate, dto.endDate),
        metadata: dto.metadata || {},
      };

      let analysisResult: AnalysisResult | QuickAnalysisResult;
      let status: "success" | "partial" | "failed" = "success";
      let errorMessage: string | undefined;

      try {
        // 根据分析类型执行不同的分析流程
        // TODO: 重新启用智能体协调器
        throw new Error("智能体协调器暂时不可用，正在重构中");
        // if (dto.analysisType === "full") {
        //   analysisResult =
        //     await this.agentOrchestrator.executeFullAnalysis(context);
        // } else {
        //   analysisResult =
        //     await this.agentOrchestrator.executeQuickAnalysis(context);
        // }
      } catch (error) {
        this.logger.error(`分析执行失败: ${error.message}`, error.stack);
        status = "failed";
        errorMessage = error.message;

        // 创建失败记录
        analysisResult = {
          stockCode: dto.stockCode,
          stockName: dto.stockName,
          executionTime: 0,
          timestamp: new Date(),
        } as any;
      }

      // 保存分析记录
      const record = this.analysisRepository.create({
        stockCode: dto.stockCode,
        stockName: dto.stockName,
        analysisType: dto.analysisType,
        context,
        results: analysisResult,
        averageScore: this.extractAverageScore(analysisResult),
        finalRecommendation: this.extractFinalRecommendation(analysisResult),
        confidence: this.extractConfidence(analysisResult),
        keyInsights: this.extractKeyInsights(analysisResult),
        majorRisks: this.extractMajorRisks(analysisResult),
        executionTime: analysisResult.executionTime,
        status,
        errorMessage,
        metadata: dto.metadata,
      });

      const savedRecord = await this.analysisRepository.save(record);

      if (status === "failed") {
        return Result.error("分析执行失败，请稍后重试", 500, savedRecord);
      } else {
        return Result.success(savedRecord, "分析完成");
      }
    } catch (error) {
      this.logger.error(`创建分析任务失败: ${error.message}`, error.stack);
      throw new BadRequestException(`创建分析任务失败: ${error.message}`);
    }
  }

  /**
   * 获取分析记录列表
   */
  async getAnalysisRecords(
    dto: GetAnalysisRecordsDto,
  ): Promise<Result<PaginatedResult<AnalysisRecord>>> {
    try {
      const queryBuilder =
        this.analysisRepository.createQueryBuilder("analysis");

      // 添加查询条件
      if (dto.stockCode) {
        queryBuilder.andWhere("analysis.stockCode = :stockCode", {
          stockCode: dto.stockCode,
        });
      }

      if (dto.analysisType) {
        queryBuilder.andWhere("analysis.analysisType = :analysisType", {
          analysisType: dto.analysisType,
        });
      }

      if (dto.startDate || dto.endDate) {
        const startDate = dto.startDate
          ? new Date(dto.startDate)
          : new Date("1900-01-01");
        const endDate = dto.endDate ? new Date(dto.endDate) : new Date();
        queryBuilder.andWhere(
          "analysis.createdAt BETWEEN :startDate AND :endDate",
          {
            startDate,
            endDate,
          },
        );
      }

      // 排序和分页
      queryBuilder
        .orderBy("analysis.createdAt", "DESC")
        .skip((dto.page - 1) * dto.limit)
        .take(dto.limit);

      const [records, total] = await queryBuilder.getManyAndCount();

      const paginatedResult = new PaginatedResult(
        records,
        total,
        dto.page,
        dto.limit,
      );
      return Result.success(paginatedResult, "获取分析记录成功");
    } catch (error) {
      this.logger.error(`获取分析记录失败: ${error.message}`, error.stack);
      throw new BadRequestException(`获取分析记录失败: ${error.message}`);
    }
  }

  /**
   * 获取分析记录详情
   */
  async getAnalysisDetail(id: number): Promise<Result<AnalysisRecord>> {
    try {
      const record = await this.analysisRepository.findOne({
        where: { id },
      });

      if (!record) {
        throw new NotFoundException(`分析记录不存在: ${id}`);
      }

      return Result.success(record, "获取分析详情成功");
    } catch (error) {
      this.logger.error(`获取分析详情失败: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`获取分析详情失败: ${error.message}`);
    }
  }

  /**
   * 删除分析记录
   */
  async deleteAnalysis(id: number): Promise<Result<null>> {
    try {
      const record = await this.analysisRepository.findOne({
        where: { id },
      });

      if (!record) {
        throw new NotFoundException(`分析记录不存在: ${id}`);
      }

      await this.analysisRepository.softDelete(id);
      return Result.success(null, "删除分析记录成功");
    } catch (error) {
      this.logger.error(`删除分析记录失败: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`删除分析记录失败: ${error.message}`);
    }
  }

  /**
   * 获取股票的最新分析
   */
  async getLatestAnalysis(
    stockCode: string,
  ): Promise<Result<AnalysisRecord | null>> {
    try {
      const record = await this.analysisRepository.findOne({
        where: { stockCode },
        order: { createdAt: "DESC" },
      });

      return Result.success(
        record,
        record ? "获取最新分析成功" : "暂无分析记录",
      );
    } catch (error) {
      this.logger.error(`获取最新分析失败: ${error.message}`, error.stack);
      throw new BadRequestException(`获取最新分析失败: ${error.message}`);
    }
  }

  /**
   * 获取分析统计信息
   */
  async getAnalysisStats(): Promise<Result<any>> {
    try {
      const totalCount = await this.analysisRepository.count();
      const successCount = await this.analysisRepository.count({
        where: { status: "success" },
      });
      const failedCount = await this.analysisRepository.count({
        where: { status: "failed" },
      });

      // 获取最近7天的分析数量
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentCount = await this.analysisRepository.count({
        where: { createdAt: Between(sevenDaysAgo, new Date()) },
      });

      // 获取平均执行时间
      const avgExecutionTime = await this.analysisRepository
        .createQueryBuilder("analysis")
        .select("AVG(analysis.executionTime)", "avg")
        .getRawOne();

      const stats = {
        totalAnalyses: totalCount,
        successfulAnalyses: successCount,
        failedAnalyses: failedCount,
        successRate:
          totalCount > 0
            ? ((successCount / totalCount) * 100).toFixed(2) + "%"
            : "0%",
        recentAnalyses: recentCount,
        averageExecutionTime: avgExecutionTime?.avg
          ? Math.round(avgExecutionTime.avg) + "ms"
          : "0ms",
      };

      return Result.success(stats, "获取统计信息成功");
    } catch (error) {
      this.logger.error(`获取统计信息失败: ${error.message}`, error.stack);
      throw new BadRequestException(`获取统计信息失败: ${error.message}`);
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

  /**
   * 提取平均评分
   */
  private extractAverageScore(
    result: AnalysisResult | QuickAnalysisResult,
  ): number | undefined {
    if ("summary" in result) {
      return result.summary.averageScore;
    } else if ("quickSummary" in result) {
      return result.quickSummary.averageScore;
    }
    return undefined;
  }

  /**
   * 提取最终建议
   */
  private extractFinalRecommendation(
    result: AnalysisResult | QuickAnalysisResult,
  ): any {
    if ("summary" in result) {
      return result.summary.finalRecommendation;
    } else if ("quickSummary" in result) {
      return result.quickSummary.recommendation;
    }
    return undefined;
  }

  /**
   * 提取置信度
   */
  private extractConfidence(
    result: AnalysisResult | QuickAnalysisResult,
  ): number | undefined {
    if ("summary" in result) {
      return result.summary.confidence;
    } else if ("quickSummary" in result) {
      return result.quickSummary.confidence;
    }
    return undefined;
  }

  /**
   * 提取关键洞察
   */
  private extractKeyInsights(
    result: AnalysisResult | QuickAnalysisResult,
  ): string[] | undefined {
    if ("summary" in result) {
      return result.summary.keyInsights;
    } else if ("quickSummary" in result) {
      return result.quickSummary.keyPoints;
    }
    return undefined;
  }

  /**
   * 提取主要风险
   */
  private extractMajorRisks(
    result: AnalysisResult | QuickAnalysisResult,
  ): string[] | undefined {
    if ("summary" in result) {
      return result.summary.majorRisks;
    } else if ("quickSummary" in result) {
      return result.quickSummary.mainRisks;
    }
    return undefined;
  }
}
