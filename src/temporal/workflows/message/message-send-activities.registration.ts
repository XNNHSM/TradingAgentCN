import { Injectable, OnModuleInit } from '@nestjs/common';
import { MessageService } from '../../../modules/message/message.service';
import { MessageSendActivities } from './message-send.activities';

/**
 * 消息发送 Activities 注册服务
 * 负责将消息发送 Activities 注册到 Temporal Worker
 */
@Injectable()
export class MessageSendActivitiesRegistration implements OnModuleInit {
  constructor(
    private readonly messageService: MessageService,
  ) {}

  onModuleInit() {
    this.registerActivities();
  }

  /**
   * 注册消息发送 Activities 到 Temporal Worker
   */
  private registerActivities(): void {
    // 注册消息服务到全局
    (global as any).messageService = this.messageService;
    
    // 创建消息发送 Activities 实例
    const messageSendActivitiesInstance = new MessageSendActivities();
    
    const messageSendActivities = {
      sendToAllProviders: async (params) => {
        return await messageSendActivitiesInstance.sendToAllProviders(params);
      },
      
      sendToProvider: async (params) => {
        return await messageSendActivitiesInstance.sendToProvider(params);
      },

      getAnalysisRecord: async (analysisRecordId: number) => {
        return await messageSendActivitiesInstance.getAnalysisRecord(analysisRecordId);
      },

      sendStockAnalysisReport: async (params) => {
        return await messageSendActivitiesInstance.sendStockAnalysisReport(params);
      },
    };

    // 将 Activities 注册到全局，供 Temporal Worker 使用
    (global as any).messageSendActivities = messageSendActivities;
    
    console.log('Message send activities registered successfully');
  }

  /**
   * 获取消息发送 Activities 供 Worker 使用
   */
  static getActivities() {
    return (global as any).messageSendActivities || {};
  }
}