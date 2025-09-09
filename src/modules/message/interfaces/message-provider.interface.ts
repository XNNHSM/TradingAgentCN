/**
 * 消息内容接口
 */
export interface MessageContent {
  /**
   * 消息标题
   */
  title?: string;
  
  /**
   * 消息内容
   */
  content: string;
  
  /**
   * 消息类型
   */
  messageType?: 'text' | 'markdown' | 'html';
  
  /**
   * 附加数据
   */
  metadata?: Record<string, any>;
}

/**
 * 消息发送结果
 */
export interface MessageSendResult {
  /**
   * 是否发送成功
   */
  success: boolean;
  
  /**
   * 消息ID（如果支持）
   */
  messageId?: string;
  
  /**
   * 响应数据
   */
  response?: any;
  
  /**
   * 错误信息
   */
  error?: string;
  
  /**
   * 发送时间戳
   */
  timestamp: Date;
}

/**
 * 消息提供者配置接口
 */
export interface MessageProviderConfig {
  /**
   * 提供者名称
   */
  name: string;
  
  /**
   * 是否启用
   */
  enabled: boolean;
  
  /**
   * 配置参数
   */
  config: Record<string, any>;
}

/**
 * 消息提供者接口
 */
export interface IMessageProvider {
  /**
   * 发送消息
   * @param content 消息内容
   * @param target 目标标识
   * @returns 发送结果
   */
  send(content: MessageContent, target?: string): Promise<MessageSendResult>;
  
  /**
   * 批量发送消息
   * @param content 消息内容
   * @param targets 目标标识列表
   * @returns 发送结果列表
   */
  sendBatch(content: MessageContent, targets: string[]): Promise<MessageSendResult[]>;
  
  /**
   * 验证配置
   * @returns 是否有效
   */
  validateConfig(): boolean;
  
  /**
   * 获取提供者名称
   */
  getName(): string;
}

/**
 * Webhook消息提供者接口
 */
export interface IWebhookProvider extends IMessageProvider {
  /**
   * 发送Webhook请求
   * @param webhookUrl Webhook URL
   * @param payload 请求负载
   * @returns 发送结果
   */
  sendWebhook(webhookUrl: string, payload: any): Promise<MessageSendResult>;
}