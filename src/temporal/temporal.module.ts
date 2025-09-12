/**
 * Temporal统一封装模块
 * 提供Temporal所有功能的模块化封装
 */

import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageModule } from '../modules/message/message.module';
import { WatchlistModule } from '../modules/watchlist/watchlist.module';
import { AnalysisModule } from '../modules/analysis/analysis.module';
import { AnalysisRecord } from '../modules/analysis/entities/analysis-record.entity';

// 管理器
import { TemporalConnectionManager } from './managers/connection.manager';
import { TemporalWorkerManager } from './managers/worker.manager';
import { TemporalWorkflowManager } from './managers/workflow.manager';

// 统一管理器
import { TemporalManager } from './temporal.manager';


// 智能体调度器服务
import { AgentsTemporalClientService } from './workers/agents/agents-temporal-client.service';

// 消息发送Worker服务
import { MessageSendWorkerService } from './workers/message/message-send-worker.service';
import { MessageSendActivitiesRegistration } from './workflows/message/message-send-activities.registration';
import { MessageTemporalClientService } from './workers/message/message-temporal-client.service';

// 调度器服务
import { DailyStockAnalysisSchedulerService } from './schedulers/daily-stock-analysis-scheduler.service';
import { DailyStockAnalysisMessageSchedulerService } from './schedulers/daily-stock-analysis-message-scheduler.service';
import { TemporalSchedulersController } from './schedulers/temporal-schedulers.controller';

/**
 * Temporal统一封装模块
 * 标记为全局模块，整个应用都可以使用
 */
@Global()
@Module({
  imports: [
    ConfigModule, // 需要配置服务
    TypeOrmModule.forFeature([AnalysisRecord]), // 需要分析记录实体
    MessageModule, // 需要消息模块
    WatchlistModule, // 需要自选股模块
    forwardRef(() => AnalysisModule), // 需要分析模块（解决循环依赖）
  ],
  providers: [
    // 基础管理器
    TemporalConnectionManager,
    TemporalWorkerManager,
    TemporalWorkflowManager,
    
    // 统一入口
    TemporalManager,
    
    // 智能体调度器服务
    AgentsTemporalClientService,
    
    // 消息发送Worker服务
    MessageSendWorkerService,
    MessageSendActivitiesRegistration,
    MessageTemporalClientService,
    
    // 调度器服务
    DailyStockAnalysisSchedulerService,
    DailyStockAnalysisMessageSchedulerService,
    
    // 调度器控制器
    TemporalSchedulersController,
  ],
  exports: [
    // 主要导出统一管理器
    TemporalManager,
    
    // 也导出个别管理器，供高级用法
    TemporalConnectionManager,
    TemporalWorkerManager,
    TemporalWorkflowManager,
    
        
    // 导出智能体调度器服务
    AgentsTemporalClientService,
    
    // 导出消息发送Worker服务
    MessageSendWorkerService,
    MessageSendActivitiesRegistration,
    MessageTemporalClientService,
    
    // 导出调度器服务
    DailyStockAnalysisSchedulerService,
  ],
})
export class TemporalModule {
  constructor(private readonly temporalManager: TemporalManager) {
    // 在模块初始化时自动初始化TemporalManager
    this.initializeManager();
  }

  /**
   * 异步初始化管理器
   */
  private async initializeManager(): Promise<void> {
    try {
      await this.temporalManager.initialize();
    } catch (error) {
      console.warn('Temporal模块初始化失败，将在使用时重试:', error.message);
    }
  }
}