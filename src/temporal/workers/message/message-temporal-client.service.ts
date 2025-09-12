import { Injectable, Logger } from '@nestjs/common';
import { WorkflowClient } from '@temporalio/client';
import { SendMessageInput, SendMessageResult, sendMessageWorkflow } from '../../workflows/message/send-message.workflow';
import { TemporalManager } from '../../temporal.manager';

/**
 * 消息发送Temporal客户端服务
 * 专门用于启动消息发送工作流
 */
@Injectable()
export class MessageTemporalClientService {
  private readonly logger = new Logger(MessageTemporalClientService.name);
  private client: WorkflowClient;

  constructor(private readonly temporalManager: TemporalManager) {
    // 延迟初始化，避免在启动时检查连接状态
  }

  private getClient(): WorkflowClient {
    if (!this.client) {
      const connection = this.temporalManager.getConnection();
      if (!connection) {
        throw new Error('Temporal连接未建立');
      }
      this.client = new WorkflowClient({
        connection,
      });
    }
    return this.client;
  }

  /**
   * 启动消息发送工作流
   */
  async startSendMessageWorkflow(input: SendMessageInput): Promise<{ workflowId: string; runId: string }> {
    try {
      const workflowId = `send-message-${input.analysisRecordId}-${Date.now()}`;
      
      this.logger.log(`启动消息发送工作流`, {
        workflowId,
        analysisRecordId: input.analysisRecordId,
      });

      const handle = await this.getClient().start(sendMessageWorkflow, {
        taskQueue: 'message-send',
        workflowId,
        args: [input],
      });

      this.logger.log(`消息发送工作流已启动`, {
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
      });

      return {
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
      };
    } catch (error) {
      this.logger.error(`启动消息发送工作流失败`, error);
      throw error;
    }
  }

  /**
   * 获取工作流状态
   */
  async getWorkflowStatus(workflowId: string): Promise<SendMessageResult> {
    try {
      const handle = this.getClient().getHandle(workflowId);
      const result: SendMessageResult = await handle.query('getStatus');
      
      return result;
    } catch (error) {
      this.logger.error(`获取工作流状态失败: ${workflowId}`, error);
      return {
        success: false,
        message: '获取工作流状态失败',
        error: error.message,
      };
    }
  }

  }