import { Injectable, OnModuleInit } from '@nestjs/common';
import { Context } from '@temporalio/activity';
import { MessageActivityImpl } from '../activities/message.activity';
import { MessageActivities } from '../activities/temporal-message.activities';

/**
 * 消息 Activities 注册服务
 * 负责将消息 Activities 注册到 Temporal Worker
 */
@Injectable()
export class MessageActivitiesRegistration implements OnModuleInit {
  constructor(
    private readonly messageActivity: MessageActivityImpl,
  ) {}

  onModuleInit() {
    this.registerActivities();
  }

  /**
   * 注册消息 Activities 到 Temporal Worker
   */
  private registerActivities(): void {
    // 创建消息 Activities 实例
    const messageActivities = {
      sendStockAnalysisResult: async (params) => {
        return await this.messageActivity.sendStockAnalysisResult(params);
      },
      
      sendNewsSummary: async (params) => {
        return await this.messageActivity.sendNewsSummary(params);
      },
      
      sendSystemNotification: async (params) => {
        return await this.messageActivity.sendSystemNotification(params);
      },
      
      sendCustomMessage: async (params) => {
        return await this.messageActivity.sendCustomMessage(params);
      },
    };

    // 将 Activities 注册到全局，供 Temporal Worker 使用
    (global as any).messageActivities = messageActivities;
    
    console.log('Message activities registered successfully');
  }

  /**
   * 获取消息 Activities 供 Worker 使用
   */
  static getActivities() {
    return (global as any).messageActivities || {};
  }
}