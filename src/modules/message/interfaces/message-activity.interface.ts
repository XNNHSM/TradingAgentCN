/**
 * 消息发送 Activity 接口
 */
export interface SendMessageActivity {
  /**
   * 发送股票分析结果
   */
  sendStockAnalysisResult(params: {
    stockCode: string;
    stockName: string;
    analysisResult: any;
    summary?: string;
    recommendation?: string;
    riskLevel?: string;
    metadata?: Record<string, any>;
  }): Promise<boolean>;

  /**
   * 发送新闻摘要
   */
  sendNewsSummary(params: {
    title: string;
    content: string;
    source?: string;
    category?: string;
    metadata?: Record<string, any>;
  }): Promise<boolean>;

  /**
   * 发送系统通知
   */
  sendSystemNotification(params: {
    title: string;
    content: string;
    level: 'info' | 'warning' | 'error' | 'success';
    metadata?: Record<string, any>;
  }): Promise<boolean>;

  /**
   * 发送自定义消息
   */
  sendCustomMessage(params: {
    title: string;
    content: string;
    messageType: 'text' | 'markdown';
    targets?: string[];
    metadata?: Record<string, any>;
  }): Promise<boolean>;
}