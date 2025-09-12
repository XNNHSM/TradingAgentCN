import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MessageSendActivitiesRegistration } from '../../workflows/message/message-send-activities.registration';
import { TemporalWorkerManager } from '../../managers/worker.manager';

/**
 * 消息发送 Worker 服务
 * 负责消息发送相关的 Temporal Worker 管理
 */
@Injectable()
export class MessageSendWorkerService implements OnModuleInit {
  private readonly logger = new Logger(MessageSendWorkerService.name);

  constructor(
    private readonly messageSendActivitiesRegistration: MessageSendActivitiesRegistration,
    private readonly temporalWorkerManager: TemporalWorkerManager,
  ) {}

  async onModuleInit() {
    await this.initializeWorker();
  }

  /**
   * 初始化消息发送 Worker
   */
  private async initializeWorker(): Promise<void> {
    try {
      this.logger.log('正在初始化消息发送 Worker...');

      // 注册消息发送 Activities
      this.messageSendActivitiesRegistration.onModuleInit();

      // 创建消息发送 Worker，使用单个工作流文件
      await this.temporalWorkerManager.createWorker({
        taskQueue: 'message-send',
        workflowsPath: require.resolve('../../workflows/message/send-message.workflow'),
        activities: MessageSendActivitiesRegistration.getActivities(),
      });

      this.logger.log('消息发送 Worker 初始化完成');
    } catch (error) {
      this.logger.error('消息发送 Worker 初始化失败', error);
      throw error;
    }
  }
}