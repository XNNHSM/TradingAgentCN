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
import { MessageService } from "../../modules/message/message.service";
import { MessageType } from "../../modules/message/dtos/message.dto";
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
    private readonly messageService?: MessageService,
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
   * 发送已有分析记录的消息
   */
  private async sendExistingAnalysisMessage(
    analysisRecord: AnalysisRecord
  ): Promise<Result<{ message: string; existingAnalysis: boolean }>> {
    try {
      if (!this.messageService) {
        return Result.error('消息服务不可用，无法发送分析结果');
      }

      // 格式化分析结果消息
      const messageContent = this.formatAnalysisMessage(analysisRecord);
      
      // 发送消息到所有配置的提供者
      const sendResult = await this.messageService.sendMessage({
        messageType: MessageType.MARKDOWN,
        title: `📈 ${analysisRecord.stockName || analysisRecord.stockCode} 分析报告`,
        content: messageContent,
        metadata: {
          source: 'api-analysis-existing',
          analysisRecordId: analysisRecord.id,
          stockCode: analysisRecord.stockCode,
          stockName: analysisRecord.stockName,
          analysisType: analysisRecord.analysisType,
          averageScore: analysisRecord.averageScore,
          finalRecommendation: analysisRecord.finalRecommendation,
          sentAt: new Date().toISOString(),
        },
      });

      const successCount = sendResult.filter(r => r.success).length;
      const totalCount = sendResult.length;

      this.businessLogger.serviceInfo('已有分析记录消息发送成功', {
        stockCode: analysisRecord.stockCode,
        successCount,
        totalCount,
        averageScore: analysisRecord.averageScore,
        finalRecommendation: analysisRecord.finalRecommendation,
      });

      const result = {
        message: `股票 ${analysisRecord.stockCode} 的已有分析报告已发送到消息渠道 (${successCount}/${totalCount})`,
        existingAnalysis: true
      };

      return Result.success(result, "已有分析报告已发送");
    } catch (error) {
      this.businessLogger.serviceError('发送已有分析记录消息失败', error, {
        stockCode: analysisRecord.stockCode,
        recordId: analysisRecord.id,
      });
      throw new BadRequestException(`发送已有分析记录消息失败: ${error.message}`);
    }
  }

  /**
   * 格式化分析消息内容
   */
  private formatAnalysisMessage(record: AnalysisRecord): string {
    const date = new Date(record.createdAt).toLocaleDateString('zh-CN');
    
    let content = `## 📈 ${record.stockName || record.stockCode} 分析报告\\n\\n`;
    content += `**分析日期**: ${date}\\n\\n`;
    
    if (record.averageScore !== undefined) {
      content += `**综合评分**: ${record.averageScore}/100 (${this.getScoreGrade(record.averageScore)})\\n\\n`;
    }
    
    if (record.finalRecommendation) {
      const recommendationEmoji = this.getRecommendationEmoji(record.finalRecommendation);
      content += `**投资建议**: ${recommendationEmoji} ${this.getRecommendationText(record.finalRecommendation)}\\n\\n`;
    }
    
    if (record.confidence !== undefined) {
      content += `**置信度**: ${(record.confidence * 100).toFixed(1)}%\\n\\n`;
    }
    
    if (record.summary) {
      content += `### 📋 分析摘要\\n${record.summary}\\n\\n`;
    }
    
    if (record.keyInsights && record.keyInsights.length > 0) {
      content += `### 🔍 关键洞察\\n`;
      record.keyInsights.forEach((insight, index) => {
        content += `${index + 1}. ${insight}\\n`;
      });
      content += '\\n';
    }
    
    if (record.majorRisks && record.majorRisks.length > 0) {
      content += `### ⚠️ 主要风险\\n`;
      record.majorRisks.forEach((risk, index) => {
        content += `${index + 1}. ${risk}\\n`;
      });
      content += '\\n';
    }
    
    content += `---\\n`;
    content += `*本报告由智能交易代理系统生成，仅供参考学习，不构成投资建议*\\n`;
    content += `*分析时间: ${new Date(record.createdAt).toLocaleString('zh-CN')}*`;
    
    return content;
  }

  /**
   * 获取建议表情符号
   */
  private getRecommendationEmoji(recommendation?: string): string {
    switch (recommendation) {
      case 'BUY': return '🟢';
      case 'HOLD': return '🟡';
      case 'SELL': return '🔴';
      default: return '⚪';
    }
  }

  /**
   * 获取建议文本
   */
  private getRecommendationText(recommendation?: string): string {
    switch (recommendation) {
      case 'BUY': return '买入';
      case 'HOLD': return '持有';
      case 'SELL': return '卖出';
      default: return '无建议';
    }
  }

  /**
   * 获取评分等级
   */
  private getScoreGrade(score: number): string {
    if (score >= 80) return '优秀';
    if (score >= 70) return '良好';
    if (score >= 60) return '中等';
    if (score >= 50) return '一般';
    return '较差';
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
