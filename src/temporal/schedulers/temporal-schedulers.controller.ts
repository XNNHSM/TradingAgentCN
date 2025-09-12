/**
 * 调度器管理控制器
 * 提供调度器状态查询和手动触发功能
 */

import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Result } from '../../common/dto/result.dto';
import { DailyStockAnalysisSchedulerService } from '../schedulers/daily-stock-analysis-scheduler.service';
import { DailyStockAnalysisMessageSchedulerService } from '../schedulers/daily-stock-analysis-message-scheduler.service';

@ApiTags('temporal-schedulers')
@Controller('api/v1/temporal/schedulers')
export class TemporalSchedulersController {
  constructor(
    private readonly dailyStockAnalysisScheduler: DailyStockAnalysisSchedulerService,
    private readonly dailyStockAnalysisMessageScheduler: DailyStockAnalysisMessageSchedulerService,
  ) {}

  /**
   * 获取每日股票分析调度器状态
   */
  @Get('daily-stock-analysis/status')
  @ApiOperation({ summary: '获取每日股票分析调度器状态' })
  @ApiResponse({ status: 200, description: '成功获取调度器状态' })
  async getDailyStockAnalysisStatus(): Promise<Result<any>> {
    try {
      const status = await this.dailyStockAnalysisScheduler.getSchedulerStatus();
      return Result.success(status);
    } catch (error) {
      return Result.error(`获取调度器状态失败: ${error.message}`);
    }
  }

  /**
   * 手动触发每日股票分析
   */
  @Post('daily-stock-analysis/trigger')
  @ApiOperation({ summary: '手动触发每日股票分析' })
  @ApiResponse({ status: 200, description: '成功触发每日股票分析' })
  async triggerDailyStockAnalysis(): Promise<Result<any>> {
    try {
      await this.dailyStockAnalysisScheduler.triggerDailyAnalysis();
      return Result.success({ message: '每日股票分析已手动触发' });
    } catch (error) {
      return Result.error(`触发每日股票分析失败: ${error.message}`);
    }
  }

  /**
   * 启动每日股票分析调度器
   */
  @Post('daily-stock-analysis/start')
  @ApiOperation({ summary: '启动每日股票分析调度器' })
  @ApiResponse({ status: 200, description: '成功启动调度器' })
  async startDailyStockAnalysisScheduler(): Promise<Result<any>> {
    try {
      await this.dailyStockAnalysisScheduler.startScheduler();
      return Result.success({ message: '每日股票分析调度器已启动' });
    } catch (error) {
      return Result.error(`启动调度器失败: ${error.message}`);
    }
  }

  /**
   * 停止每日股票分析调度器
   */
  @Post('daily-stock-analysis/stop')
  @ApiOperation({ summary: '停止每日股票分析调度器' })
  @ApiResponse({ status: 200, description: '成功停止调度器' })
  async stopDailyStockAnalysisScheduler(): Promise<Result<any>> {
    try {
      await this.dailyStockAnalysisScheduler.stopScheduler();
      return Result.success({ message: '每日股票分析调度器已停止' });
    } catch (error) {
      return Result.error(`停止调度器失败: ${error.message}`);
    }
  }

  // ============ 每日股票分析消息推送调度器 ============

  /**
   * 获取每日股票分析消息推送调度器状态
   */
  @Get('daily-stock-analysis-message/status')
  @ApiOperation({ summary: '获取每日股票分析消息推送调度器状态' })
  @ApiResponse({ status: 200, description: '成功获取调度器状态' })
  async getDailyStockAnalysisMessageStatus(): Promise<Result<any>> {
    try {
      const status = await this.dailyStockAnalysisMessageScheduler.getSchedulerStatus();
      return Result.success(status);
    } catch (error) {
      return Result.error(`获取调度器状态失败: ${error.message}`);
    }
  }

  /**
   * 手动触发每日股票分析消息推送
   */
  @Post('daily-stock-analysis-message/trigger')
  @ApiOperation({ summary: '手动触发每日股票分析消息推送' })
  @ApiResponse({ status: 200, description: '成功触发消息推送' })
  async triggerDailyStockAnalysisMessage(): Promise<Result<any>> {
    try {
      await this.dailyStockAnalysisMessageScheduler.triggerMessageSending();
      return Result.success({ message: '每日股票分析消息推送已手动触发' });
    } catch (error) {
      return Result.error(`触发消息推送失败: ${error.message}`);
    }
  }

  /**
   * 启动每日股票分析消息推送调度器
   */
  @Post('daily-stock-analysis-message/start')
  @ApiOperation({ summary: '启动每日股票分析消息推送调度器' })
  @ApiResponse({ status: 200, description: '成功启动调度器' })
  async startDailyStockAnalysisMessageScheduler(): Promise<Result<any>> {
    try {
      await this.dailyStockAnalysisMessageScheduler.startScheduler();
      return Result.success({ message: '每日股票分析消息推送调度器已启动' });
    } catch (error) {
      return Result.error(`启动调度器失败: ${error.message}`);
    }
  }

  /**
   * 停止每日股票分析消息推送调度器
   */
  @Post('daily-stock-analysis-message/stop')
  @ApiOperation({ summary: '停止每日股票分析消息推送调度器' })
  @ApiResponse({ status: 200, description: '成功停止调度器' })
  async stopDailyStockAnalysisMessageScheduler(): Promise<Result<any>> {
    try {
      await this.dailyStockAnalysisMessageScheduler.stopScheduler();
      return Result.success({ message: '每日股票分析消息推送调度器已停止' });
    } catch (error) {
      return Result.error(`停止调度器失败: ${error.message}`);
    }
  }
}