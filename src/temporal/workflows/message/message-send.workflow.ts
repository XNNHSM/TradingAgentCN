/**
 * 消息发送子工作流
 * 
 * 作为其他工作流的子工作流，负责消息的发送和重试
 * 利用Temporal的工作流机制实现消息发送的可靠性和重试
 */

import * as workflow from '@temporalio/workflow';
import type { MessageSendActivities } from './message-send.activities';

// 工作流输入类型
export interface MessageSendInput {
  messageType: 'stock-analysis' | 'news-summary' | 'system-notification' | 'custom';
  title: string;
  content: string;
  targets?: string[];
  metadata?: Record<string, any>;
  retryPolicy?: {
    maximumAttempts: number;
    initialInterval: string;
    backoffCoefficient: number;
    maximumInterval: string;
  };
}

// 消息发送结果
export interface MessageSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
  providerResults: Array<{
    provider: string;
    success: boolean;
    error?: string;
  }>;
}

// 工作流接口
export interface MessageSendWorkflow {
  send(input: MessageSendInput): Promise<MessageSendResult>;
}

const { sendToAllProviders } = workflow.proxyActivities<MessageSendActivities>({
  taskQueue: 'message-send',
  startToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '30 seconds',
    maximumAttempts: 3,
  },
});

export async function messageSendWorkflow(input: MessageSendInput): Promise<MessageSendResult> {
  console.log(`消息发送工作流开始: ${input.title}`);
  
  try {
    // 调用Activity发送消息到所有配置的提供者
    const providerResults = await sendToAllProviders({
      messageType: input.messageType,
      title: input.title,
      content: input.content,
      targets: input.targets,
      metadata: input.metadata,
    });
    
    // 检查发送结果
    const successCount = providerResults.filter(r => r.success).length;
    const totalCount = providerResults.length;
    
    console.log(`消息发送完成: ${input.title}, 成功 ${successCount}/${totalCount}`);
    
    return {
      success: successCount > 0,
      messageId: workflow.uuid4(),
      timestamp: new Date(),
      providerResults,
    };
    
  } catch (error) {
    console.error(`消息发送失败: ${input.title}`, error);
    
    return {
      success: false,
      error: error.message,
      timestamp: new Date(),
      providerResults: [],
    };
  }
}