/**
 * Temporal统一封装模块
 * 提供Temporal所有功能的模块化封装
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// 管理器
import { TemporalConnectionManager } from './managers/connection.manager';
import { TemporalWorkerManager } from './managers/worker.manager';
import { TemporalWorkflowManager } from './managers/workflow.manager';

// 统一管理器
import { TemporalManager } from './temporal.manager';

// 新闻调度器服务
import { NewsTemporalClientService } from './schedulers/news/news-temporal-client.service';
import { NewsTemporalSchedulerService } from './schedulers/news/news-temporal-scheduler.service';

/**
 * Temporal统一封装模块
 * 标记为全局模块，整个应用都可以使用
 */
@Global()
@Module({
  imports: [
    ConfigModule, // 需要配置服务
  ],
  providers: [
    // 基础管理器
    TemporalConnectionManager,
    TemporalWorkerManager,
    TemporalWorkflowManager,
    
    // 统一入口
    TemporalManager,
    
    // 新闻调度器服务
    NewsTemporalClientService,
    NewsTemporalSchedulerService,
  ],
  exports: [
    // 主要导出统一管理器
    TemporalManager,
    
    // 也导出个别管理器，供高级用法
    TemporalConnectionManager,
    TemporalWorkerManager,
    TemporalWorkflowManager,
    
    // 导出新闻调度器服务
    NewsTemporalClientService,
    NewsTemporalSchedulerService,
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