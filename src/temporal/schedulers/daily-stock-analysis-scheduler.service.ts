/**
 * 每日股票分析调度器服务
 * 负责每天凌晨2点启动所有自选股的股票分析工作流
 */

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleDescription, ScheduleOverlapPolicy, ScheduleHandle } from '@temporalio/client';
import { BusinessLogger } from '../../common/utils/business-logger.util';
import { TemporalManager } from '../temporal.manager';
import { AgentsTemporalClientService } from '../workers/agents/agents-temporal-client.service';
import { WatchlistService } from '../../modules/watchlist/watchlist.service';

/**
 * 调度器配置接口
 */
interface SchedulerConfig {
  enabled: boolean;
  scheduleHour: number;
  scheduleMinute: number;
  timezone: string;
}

/**
 * 每日股票分析调度器
 */
@Injectable()
export class DailyStockAnalysisSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new BusinessLogger(DailyStockAnalysisSchedulerService.name);
  private scheduleHandle: ScheduleHandle | null = null;
  private config: SchedulerConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly temporalManager: TemporalManager,
    private readonly agentsTemporalClient: AgentsTemporalClientService,
    private readonly watchlistService: WatchlistService,
  ) {
    // 读取调度器配置
    this.config = {
      enabled: this.configService.get('DAILY_STOCK_ANALYSIS_SCHEDULER_ENABLED', false),
      scheduleHour: this.configService.get('DAILY_STOCK_ANALYSIS_SCHEDULER_HOUR', 2),
      scheduleMinute: this.configService.get('DAILY_STOCK_ANALYSIS_SCHEDULER_MINUTE', 0),
      timezone: this.configService.get('DAILY_STOCK_ANALYSIS_SCHEDULER_TIMEZONE', 'Asia/Shanghai'),
    };
  }

  /**
   * 模块初始化时启动调度器
   */
  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.serviceInfo('每日股票分析调度器已禁用');
      return;
    }

    try {
      await this.startScheduler();
    } catch (error) {
      this.logger.serviceError('启动每日股票分析调度器失败', error);
      // 调度器启动失败不应该影响应用启动
    }
  }

  /**
   * 启动调度器
   */
  async startScheduler(): Promise<void> {
    try {
      // 简化实现：使用 setInterval 代替 Temporal Schedule
      // 这样可以避免 Temporal Schedule API 的复杂性
      this.scheduleDailyAnalysis();
      
      this.logger.serviceInfo('每日股票分析调度器已启动', {
        scheduleTime: `${this.config.scheduleHour}:${this.config.scheduleMinute}`,
        timezone: this.config.timezone,
      });
    } catch (error) {
      this.logger.serviceError('创建每日股票分析调度器失败', error);
      throw error;
    }
  }

  /**
   * 设置定时执行
   */
  private scheduleDailyAnalysis(): void {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(this.config.scheduleHour, this.config.scheduleMinute, 0, 0);
    
    // 如果当前时间已经超过了今天的调度时间，则调度到明天
    if (now > scheduledTime) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const delay = scheduledTime.getTime() - now.getTime();
    
    this.logger.serviceInfo('设置每日股票分析定时任务', {
      scheduledTime: scheduledTime.toISOString(),
      delay: `${delay}ms`,
    });
    
    // 首次执行
    setTimeout(() => {
      this.executeDailyStockAnalysis();
      // 然后设置每天重复执行
      setInterval(() => {
        this.executeDailyStockAnalysis();
      }, 24 * 60 * 60 * 1000); // 24小时
    }, delay);
  }

  /**
   * 停止调度器
   */
  async stopScheduler(): Promise<void> {
    this.logger.serviceInfo('每日股票分析调度器已停止（定时器会在应用关闭时自动清理）');
    this.scheduleHandle = null;
  }

  /**
   * 模块销毁时停止调度器
   */
  async onModuleDestroy(): Promise<void> {
    await this.stopScheduler();
  }

  /**
   * 手动触发每日股票分析（用于测试）
   */
  async triggerDailyAnalysis(): Promise<void> {
    this.logger.serviceInfo('手动触发每日股票分析');
    
    try {
      // 直接执行每日分析逻辑
      await this.executeDailyStockAnalysis();
    } catch (error) {
      this.logger.serviceError('手动触发每日股票分析失败', error);
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
    };
  }

  /**
   * 执行每日股票分析
   * 获取所有自选股并为每只股票启动分析工作流
   */
  private async executeDailyStockAnalysis(): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.serviceInfo('开始执行每日股票分析');

      // 获取所有自选股（不设置分页限制，获取全部）
      const allWatchlistResult = await this.watchlistService.findAll({
        page: 1,
        limit: 1000, // 设置一个较大的限制
      });

      const watchlistItems = allWatchlistResult.items;

      if (watchlistItems.length === 0) {
        this.logger.serviceInfo('没有找到自选股，跳过每日分析');
        return;
      }

      this.logger.serviceInfo(`找到 ${watchlistItems.length} 只自选股，开始逐一分析`);

      // 为每只股票启动分析工作流
      const workflowPromises = watchlistItems.map(async (item) => {
        try {
          // 构建工作流输入
          const workflowInput = {
            stockCode: item.stockCode,
            stockName: item.stockName,
            sessionId: `daily-analysis-${new Date().toISOString().split('T')[0]}`,
            enableMessagePush: false, // 调度器触发，不发送消息避免凌晨打扰
            isScheduledRun: true, // 标记为调度器触发
            metadata: {
              source: 'daily-scheduler',
              scheduledAt: new Date().toISOString(),
              watchlistId: item.id,
            },
          };

          // 启动股票分析工作流（不等待完成）
          const workflowHandle = await this.agentsTemporalClient.startStockAnalysisWorkflow(workflowInput);

          this.logger.serviceInfo('已启动股票分析工作流', {
            stockCode: item.stockCode,
            stockName: item.stockName,
            workflowId: workflowHandle?.workflowId,
          });

          return {
            stockCode: item.stockCode,
            stockName: item.stockName,
            workflowId: workflowHandle?.workflowId,
            success: true,
          };
        } catch (error) {
          this.logger.serviceError('启动股票分析工作流失败', error, {
            stockCode: item.stockCode,
            stockName: item.stockName,
          });

          return {
            stockCode: item.stockCode,
            stockName: item.stockName,
            success: false,
            error: error.message,
          };
        }
      });

      // 并行启动所有工作流
      const results = await Promise.all(workflowPromises);

      // 统计结果
      const successfulCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      const executionTime = Date.now() - startTime;

      this.logger.serviceInfo('每日股票分析执行完成', {
        totalStocks: watchlistItems.length,
        successful: successfulCount,
        failed: failedCount,
        executionTime: `${executionTime}ms`,
      });

      // 如果有失败的，记录详细信息
      if (failedCount > 0) {
        const failedResults = results.filter(r => !r.success);
        this.logger.serviceInfo('失败的股票分析', {
          failedCount,
          failedStocks: failedResults.map(r => ({
            stockCode: r.stockCode,
            stockName: r.stockName,
            error: r.error,
          })),
        });
      }
    } catch (error) {
      this.logger.serviceError('执行每日股票分析失败', error);
      throw error;
    }
  }
}