/**
 * 每日股票分析消息推送调度器服务
 * 负责每天上午9点推送已生成的股票分析结果
 */

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Optional } from '@nestjs/common';
import { BusinessLogger } from '../../common/utils/business-logger.util';
import { TemporalManager } from '../temporal.manager';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalysisRecord } from '../../modules/analysis/entities/analysis-record.entity';
import { MessageTemporalClientService } from '../workers/message/message-temporal-client.service';
import { MessageType } from '../../modules/message/dtos/message.dto';
import { TradingRecommendation } from '../../agents/interfaces/agent.interface';

/**
 * 调度器配置接口
 */
interface MessageSchedulerConfig {
  enabled: boolean;
  scheduleHour: number;
  scheduleMinute: number;
  timezone: string;
  lookbackDays: number; // 查找多少天内已完成的股票分析
  maxStocksPerMessage: number; // 单条消息最多包含多少只股票
}

/**
 * 每日股票分析消息推送调度器
 */
@Injectable()
export class DailyStockAnalysisMessageSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new BusinessLogger(DailyStockAnalysisMessageSchedulerService.name);
  private scheduleHandle: any = null; // 简化处理，不使用具体类型
  private config: MessageSchedulerConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly temporalManager: TemporalManager,
    @InjectRepository(AnalysisRecord)
    private readonly analysisRepository: Repository<AnalysisRecord>,
    @Optional() private readonly messageTemporalClient?: MessageTemporalClientService,
  ) {
    // 读取调度器配置
    this.config = {
      enabled: this.configService.get('DAILY_STOCK_ANALYSIS_MESSAGE_SCHEDULER_ENABLED', false),
      scheduleHour: this.configService.get('DAILY_STOCK_ANALYSIS_MESSAGE_SCHEDULER_HOUR', 9),
      scheduleMinute: this.configService.get('DAILY_STOCK_ANALYSIS_MESSAGE_SCHEDULER_MINUTE', 0),
      timezone: this.configService.get('DAILY_STOCK_ANALYSIS_MESSAGE_SCHEDULER_TIMEZONE', 'Asia/Shanghai'),
      lookbackDays: this.configService.get('DAILY_STOCK_ANALYSIS_MESSAGE_LOOKBACK_DAYS', 1), // 查找昨天的分析结果
      maxStocksPerMessage: this.configService.get('DAILY_STOCK_ANALYSIS_MESSAGE_MAX_STOCKS', 10), // 单条消息最多10只股票
    };
  }

  /**
   * 模块初始化时启动调度器
   */
  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.serviceInfo('每日股票分析消息推送调度器已禁用');
      return;
    }

    try {
      await this.startScheduler();
    } catch (error) {
      this.logger.serviceError('启动每日股票分析消息推送调度器失败', error);
      // 调度器启动失败不应该影响应用启动
    }
  }

  /**
   * 启动调度器
   */
  async startScheduler(): Promise<void> {
    try {
      // 简化实现：使用 setInterval 代替 Temporal Schedule
      this.scheduleMessageSending();
      
      this.logger.serviceInfo('每日股票分析消息推送调度器已启动', {
        scheduleTime: `${this.config.scheduleHour}:${this.config.scheduleMinute}`,
        timezone: this.config.timezone,
        lookbackDays: this.config.lookbackDays,
        maxStocksPerMessage: this.config.maxStocksPerMessage,
      });
    } catch (error) {
      this.logger.serviceError('创建每日股票分析消息推送调度器失败', error);
      throw error;
    }
  }

  /**
   * 设置定时执行
   */
  private scheduleMessageSending(): void {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(this.config.scheduleHour, this.config.scheduleMinute, 0, 0);
    
    // 如果当前时间已经超过了今天的调度时间，则调度到明天
    if (now > scheduledTime) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const delay = scheduledTime.getTime() - now.getTime();
    
    this.logger.serviceInfo('设置每日股票分析消息推送定时任务', {
      scheduledTime: scheduledTime.toISOString(),
      delay: `${delay}ms`,
    });
    
    // 首次执行
    setTimeout(() => {
      this.sendDailyAnalysisMessages();
      // 然后设置每天重复执行
      setInterval(() => {
        this.sendDailyAnalysisMessages();
      }, 24 * 60 * 60 * 1000); // 24小时
    }, delay);
  }

  /**
   * 停止调度器
   */
  async stopScheduler(): Promise<void> {
    this.logger.serviceInfo('每日股票分析消息推送调度器已停止（定时器会在应用关闭时自动清理）');
    this.scheduleHandle = null;
  }

  /**
   * 模块销毁时停止调度器
   */
  async onModuleDestroy(): Promise<void> {
    await this.stopScheduler();
  }

  /**
   * 手动触发每日股票分析消息推送
   */
  async triggerMessageSending(): Promise<void> {
    this.logger.serviceInfo('手动触发每日股票分析消息推送');
    
    try {
      await this.sendDailyAnalysisMessages();
    } catch (error) {
      this.logger.serviceError('手动触发每日股票分析消息推送失败', error);
      throw error;
    }
  }

  /**
   * 获取调度器状态
   */
  async getSchedulerStatus(): Promise<{
    enabled: boolean;
    running: boolean;
    scheduleTime: string;
    timezone: string;
    nextRun?: Date;
    lookbackDays: number;
    maxStocksPerMessage: number;
  }> {
    // 计算下次运行时间
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(this.config.scheduleHour, this.config.scheduleMinute, 0, 0);
    
    // 如果当前时间已经超过了今天的调度时间，则下次运行时间是明天
    if (now > nextRun) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return {
      enabled: this.config.enabled,
      running: this.scheduleHandle !== null,
      scheduleTime: `${this.config.scheduleHour}:${this.config.scheduleMinute}`,
      timezone: this.config.timezone,
      nextRun,
      lookbackDays: this.config.lookbackDays,
      maxStocksPerMessage: this.config.maxStocksPerMessage,
    };
  }

  /**
   * 发送每日股票分析消息
   * 获取已完成的股票分析记录并发送消息
   */
  private async sendDailyAnalysisMessages(): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.serviceInfo('开始发送每日股票分析消息');

      // 计算查询时间范围
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - this.config.lookbackDays);

      // 查找指定时间范围内已完成的股票分析记录
      const analysisRecords = await this.analysisRepository
        .createQueryBuilder('record')
        .where('record.status = :status', { status: 'success' })
        .andWhere('record.startTime >= :startDate', { startDate })
        .andWhere('record.endTime <= :endDate', { endDate })
        .orderBy('record.averageScore', 'DESC')
        .getMany();

      if (analysisRecords.length === 0) {
        this.logger.serviceInfo('没有找到已完成的股票分析记录，跳过消息推送');
        return;
      }

      this.logger.serviceInfo(`找到 ${analysisRecords.length} 条已完成的股票分析记录`);

      // 将分析记录分组发送（避免单条消息过长）
      const messageGroups = this.groupAnalysisRecords(analysisRecords);
      
      // 为每组记录发送消息 - 使用消息发送 workflow
      const sendPromises = messageGroups.map(async (group, index) => {
        try {
          // 检查消息发送Temporal客户端是否可用
          if (!this.messageTemporalClient) {
            throw new Error('消息发送Temporal服务暂时不可用，无法启动消息发送任务');
          }

          // 为每个分析记录启动消息发送工作流
          const workflowPromises = group.map(async (record) => {
            const workflowHandle = await this.messageTemporalClient.startSendMessageWorkflow({
              analysisRecordId: record.id,
              sessionId: `daily_summary_${Date.now()}_${record.stockCode}`,
              metadata: {
                source: 'daily-message-scheduler',
                scheduledAt: new Date().toISOString(),
                messageIndex: index + 1,
                totalMessages: messageGroups.length,
                stockCount: group.length,
                dateRange: {
                  start: startDate.toISOString(),
                  end: endDate.toISOString(),
                },
                isDailySummary: true,
                workflowType: 'daily-stock-analysis-message-scheduler'
              },
            });

            return {
              stockCode: record.stockCode,
              workflowId: workflowHandle.workflowId,
              success: true
            };
          });

          // 并行启动所有工作流
          const workflowResults = await Promise.all(workflowPromises);

          this.logger.serviceInfo('股票分析汇总消息发送工作流启动成功', {
            messageIndex: index + 1,
            stockCount: group.length,
            successCount: workflowResults.filter(r => r.success).length,
            totalCount: workflowResults.length,
          });

          return {
            groupIndex: index,
            stockCount: group.length,
            success: true,
            workflowResults,
          };
        } catch (error) {
          this.logger.serviceError('发送股票分析汇总消息失败', error, {
            groupIndex: index,
            stockCount: group.length,
          });

          return {
            groupIndex: index,
            stockCount: group.length,
            success: false,
            error: error.message,
          };
        }
      });

      // 并行发送所有消息
      const results = await Promise.all(sendPromises);

      // 统计结果
      const successfulGroups = results.filter(r => r.success).length;
      const failedGroups = results.filter(r => !r.success).length;
      
      // 统计工作流总数
      const totalWorkflows = results.reduce((acc, r) => 
        acc + (r.workflowResults ? r.workflowResults.length : 0), 0);
      const successfulWorkflows = results.reduce((acc, r) => 
        acc + (r.workflowResults ? r.workflowResults.filter(w => w.success).length : 0), 0);

      const executionTime = Date.now() - startTime;

      this.logger.serviceInfo('每日股票分析消息推送完成', {
        totalStocks: analysisRecords.length,
        totalMessages: messageGroups.length,
        successfulGroups,
        failedGroups,
        totalWorkflows,
        successfulWorkflows,
        executionTime: `${executionTime}ms`,
      });

      // 如果有失败的，记录详细信息
      if (failedGroups > 0) {
        const failedResults = results.filter(r => !r.success);
        this.logger.serviceInfo('失败的消息推送组', {
          failedGroups,
          failedGroupDetails: failedResults.map(r => ({
            groupIndex: r.groupIndex,
            stockCount: r.stockCount,
            error: r.error,
          })),
        });
      }

      // 记录成功启动的工作流信息
      if (successfulGroups > 0) {
        const successfulResults = results.filter(r => r.success);
        this.logger.serviceInfo('成功启动的消息发送工作流', {
          successfulGroups,
          workflowDetails: successfulResults.map(r => ({
            groupIndex: r.groupIndex,
            stockCount: r.stockCount,
            workflows: r.workflowResults?.map(w => ({
              stockCode: w.stockCode,
              workflowId: w.workflowId,
              success: w.success
            }))
          }))
        });
      }
    } catch (error) {
      this.logger.serviceError('发送每日股票分析消息失败', error);
      throw error;
    }
  }

  /**
   * 将分析记录分组（避免单条消息过长）
   */
  private groupAnalysisRecords(records: AnalysisRecord[]): AnalysisRecord[][] {
    const groups: AnalysisRecord[][] = [];
    let currentGroup: AnalysisRecord[] = [];

    for (const record of records) {
      currentGroup.push(record);
      
      // 如果当前组达到最大数量，创建新组
      if (currentGroup.length >= this.config.maxStocksPerMessage) {
        groups.push(currentGroup);
        currentGroup = [];
      }
    }

    // 添加最后一组
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }
}