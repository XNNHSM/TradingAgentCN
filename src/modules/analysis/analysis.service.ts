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
import { MessageTemporalClientService } from "../../temporal/workers/message/message-temporal-client.service";
import { BusinessLogger } from "../../common/utils/business-logger.util";

/**
 * 分析服务 - 基于MCP统一智能体的股票分析服务
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly businessLogger = new BusinessLogger(AnalysisService.name);

  constructor(
    @InjectRepository(AnalysisRecord)
    private readonly analysisRepository: Repository<AnalysisRecord>,
    @Optional() private readonly agentsTemporalClient?: AgentsTemporalClientService,
    @Optional() private readonly messageTemporalClient?: MessageTemporalClientService,
  ) {
    this.logger.log(`AnalysisService initialized - agentsTemporalClient: ${this.agentsTemporalClient ? 'available' : 'NOT available'}`);
  }

  /**
   * 创建股票分析任务 - 基于三阶段智能体工作流
   * 启动工作流后立即返回，不等待工作流完成
   * 如果当天已有分析记录，则直接发送消息
   */
  async createAnalysis(
    dto: CreateAnalysisDto,
  ): Promise<Result<{ workflowId?: string; sessionId?: string; message: string; existingAnalysis?: boolean }>> {
    this.logger.log(`开始分析股票: ${dto.stockCode}`);

    try {
      // 检查当天是否已有成功的分析记录
      const todayAnalysis = await this.checkTodayAnalysisExists(dto.stockCode);
      
      if (todayAnalysis) {
        this.logger.log(`股票 ${dto.stockCode} 当天已有分析记录，直接发送消息`);
        return await this.sendExistingAnalysisMessage(todayAnalysis);
      }

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
        enableMessagePush: true, // API调用启用消息推送
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
        message: `股票 ${dto.stockCode} 的分析工作流已启动，正在执行三阶段智能体分析`,
        existingAnalysis: false
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
   * 如果当天已有分析记录，则直接发送消息
   */
  async createEnhancedAnalysis(
    dto: CreateAnalysisDto,
  ): Promise<Result<{ workflowId?: string; sessionId?: string; message: string; analysisType?: string; existingAnalysis?: boolean }>> {
    this.logger.log(`开始分析股票: ${dto.stockCode}`);

    try {
      // 检查当天是否已有成功的分析记录
      const todayAnalysis = await this.checkTodayAnalysisExists(dto.stockCode);
      
      if (todayAnalysis) {
        this.logger.log(`股票 ${dto.stockCode} 当天已有分析记录，直接发送消息`);
        const messageResult = await this.sendExistingAnalysisMessage(todayAnalysis);
        return Result.success({
          ...messageResult.data,
          analysisType: 'comprehensive'
        }, messageResult.message);
      }

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
        enableMessagePush: true, // API调用启用消息推送
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
        existingAnalysis: false
      };

      this.logger.log(`增强版分析工作流已启动: ${workflowHandle.workflowId}`);
      return Result.success(result, "分析工作流已启动");
    } catch (error) {
      this.logger.error(`创建增强版分析任务失败: ${error.message}`, error.stack);
      throw new BadRequestException(`创建增强版分析任务失败: ${error.message}`);
    }
  }

  

  /**
   * 检查当天是否已有成功的分析记录
   */
  private async checkTodayAnalysisExists(stockCode: string): Promise<AnalysisRecord | null> {
    try {
      // 获取今天的开始和结束时间
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 查询当天成功的分析记录
      const analysisRecord = await this.analysisRepository
        .createQueryBuilder('record')
        .where('record.stockCode = :stockCode', { stockCode })
        .andWhere('record.status = :status', { status: 'success' })
        .andWhere('record.createdAt >= :startDate', { startDate: today })
        .andWhere('record.createdAt < :endDate', { endDate: tomorrow })
        .orderBy('record.createdAt', 'DESC')
        .getOne();

      if (analysisRecord) {
        this.businessLogger.serviceInfo('找到当天分析记录', {
          stockCode,
          recordId: analysisRecord.id,
          averageScore: analysisRecord.averageScore,
          finalRecommendation: analysisRecord.finalRecommendation
        });
      }

      return analysisRecord;
    } catch (error) {
      this.businessLogger.serviceError('检查当天分析记录失败', error, { stockCode });
      return null;
    }
  }

  /**
   * 发送已有分析记录的消息 - 启动消息发送工作流
   */
  private async sendExistingAnalysisMessage(
    analysisRecord: AnalysisRecord
  ): Promise<Result<{ workflowId?: string; message: string; existingAnalysis: boolean }>> {
    try {
      // 检查消息发送Temporal客户端是否可用
      if (!this.messageTemporalClient) {
        return Result.error('消息发送Temporal服务暂时不可用，无法启动消息发送任务');
      }

      // 启动消息发送工作流
      const workflowHandle = await this.messageTemporalClient.startSendMessageWorkflow({
        analysisRecordId: analysisRecord.id,
        sessionId: `send_message_${Date.now()}`,
        metadata: {
          source: 'api-analysis-existing',
          analysisType: analysisRecord.analysisType,
          averageScore: analysisRecord.averageScore,
          finalRecommendation: analysisRecord.finalRecommendation,
          requestedAt: new Date().toISOString(),
        },
      });

      this.businessLogger.serviceInfo('已有分析记录消息发送工作流已启动', {
        stockCode: analysisRecord.stockCode,
        recordId: analysisRecord.id,
        workflowId: workflowHandle.workflowId,
      });

      const result = {
        workflowId: workflowHandle.workflowId,
        message: `股票 ${analysisRecord.stockCode} 的已有分析报告消息发送工作流已启动`,
        existingAnalysis: true
      };

      return Result.success(result, "消息发送工作流已启动");
    } catch (error) {
      this.businessLogger.serviceError('启动消息发送工作流失败', error, {
        stockCode: analysisRecord.stockCode,
        recordId: analysisRecord.id,
      });
      throw new BadRequestException(`启动消息发送工作流失败: ${error.message}`);
    }
  }

  
  /**
   * 根据ID查找分析记录
   */
  async findById(id: number): Promise<AnalysisRecord | null> {
    try {
      this.businessLogger.serviceInfo('根据ID查找分析记录', { id });
      
      const analysisRecord = await this.analysisRepository.findOne({
        where: { id },
      });

      if (analysisRecord) {
        this.businessLogger.serviceInfo('找到分析记录', {
          id,
          stockCode: analysisRecord.stockCode,
          stockName: analysisRecord.stockName,
          status: analysisRecord.status,
        });
      } else {
        this.businessLogger.serviceInfo('未找到分析记录', { id });
      }

      return analysisRecord;
    } catch (error) {
      this.businessLogger.serviceError('查找分析记录失败', error, { id });
      throw error;
    }
  }

  }
