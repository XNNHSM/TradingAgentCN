import {
  Injectable,
  Logger,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AnalysisRecord } from "./entities/analysis-record.entity";
import { CreateAnalysisDto } from "./dto/create-analysis.dto";
import { Result } from "../../common/dto/result.dto";
import { AgentsTemporalClientService } from "../../temporal/workers/agents/agents-temporal-client.service";

/**
 * 分析服务 - 基于MCP统一智能体的股票分析服务
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectRepository(AnalysisRecord)
    private readonly analysisRepository: Repository<AnalysisRecord>,
    @Optional() private readonly agentsTemporalClient?: AgentsTemporalClientService,
  ) {}

  /**
   * 创建股票分析任务 - 基于三阶段智能体工作流
   * 启动工作流后立即返回，不等待工作流完成
   */
  async createAnalysis(
    dto: CreateAnalysisDto,
  ): Promise<Result<{ workflowId: string; sessionId: string; message: string }>> {
    this.logger.log(`开始分析股票: ${dto.stockCode}`);

    try {
      // 检查Temporal客户端是否可用
      if (!this.agentsTemporalClient) {
        return Result.error('Temporal服务暂时不可用，无法启动分析任务');
      }

      // 生成会话ID
      const sessionId = `analysis_session_${Date.now()}`;
      
      // 使用Temporal工作流执行分析
      const workflowHandle = await this.agentsTemporalClient.startStockAnalysisWorkflow({
        stockCode: dto.stockCode,
        stockName: dto.stockName,
        sessionId,
        metadata: {
          ...dto.metadata,
          analysisType: 'comprehensive',
          requestedAt: new Date().toISOString(),
        },
      });
      
      if (!workflowHandle) {
        throw new Error('无法启动股票分析工作流');
      }

      // 工作流将负责创建分析记录，这里记录workflowId用于后续查询
      this.logger.log(`分析工作流已启动，记录将在工作流中创建: ${workflowHandle.workflowId}`);
      
      const result = {
        workflowId: workflowHandle.workflowId,
        sessionId,
        message: `股票 ${dto.stockCode} 的分析工作流已启动，正在执行三阶段智能体分析`
      };

      this.logger.log(`分析工作流已启动: ${workflowHandle.workflowId}`);
      
      return Result.success(result, "分析工作流已启动");
    } catch (error) {
      this.logger.error(`创建分析任务失败: ${error.message}`, error.stack);
      throw new BadRequestException(`创建分析任务失败: ${error.message}`);
    }
  }

  /**
   * 创建股票分析任务 - 基于三阶段智能体工作流
   * 启动工作流后立即返回，不等待工作流完成
   */
  async createEnhancedAnalysis(
    dto: CreateAnalysisDto,
  ): Promise<Result<{ workflowId: string; sessionId: string; message: string; analysisType: string }>> {
    this.logger.log(`开始分析股票: ${dto.stockCode}`);

    try {
      // 检查Temporal客户端是否可用
      if (!this.agentsTemporalClient) {
        return Result.error('Temporal服务暂时不可用，无法启动分析任务');
      }

      // 生成会话ID
      const sessionId = `analysis_session_${Date.now()}`;
      
      // 使用Temporal工作流执行分析
      const workflowHandle = await this.agentsTemporalClient.startStockAnalysisWorkflow({
        stockCode: dto.stockCode,
        stockName: dto.stockName,
        sessionId,
        metadata: {
          ...dto.metadata,
          analysisType: 'comprehensive',
          requestedAt: new Date().toISOString(),
        },
      });
      
      if (!workflowHandle) {
        throw new Error('无法启动股票分析工作流');
      }

      // 工作流将负责创建分析记录，这里记录workflowId用于后续查询
      this.logger.log(`增强版分析工作流已启动，记录将在工作流中创建: ${workflowHandle.workflowId}`);

      const result = {
        workflowId: workflowHandle.workflowId,
        sessionId,
        analysisType: 'comprehensive',
        message: `股票 ${dto.stockCode} 的分析工作流已启动，正在执行三阶段智能体分析`,
      };

      this.logger.log(`增强版分析工作流已启动: ${workflowHandle.workflowId}`);
      return Result.success(result, "分析工作流已启动");
    } catch (error) {
      this.logger.error(`创建增强版分析任务失败: ${error.message}`, error.stack);
      throw new BadRequestException(`创建增强版分析任务失败: ${error.message}`);
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
