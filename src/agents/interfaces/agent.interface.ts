/**
 * 智能体基础接口定义
 */
export interface IAgent {
  /** 智能体名称 */
  name: string;
  
  /** 智能体类型 */
  type: AgentType;
  
  /** 智能体角色描述 */
  role: string;
  
  /** 执行分析任务 */
  analyze(context: AgentContext): Promise<AgentResult>;
  
  /** 获取智能体状态 */
  getStatus(): AgentStatus;
}

/**
 * 智能体类型枚举
 */
export enum AgentType {
  MARKET_ANALYST = 'market_analyst',        // 市场分析师
  FUNDAMENTAL_ANALYST = 'fundamental_analyst', // 基本面分析师
  NEWS_ANALYST = 'news_analyst',            // 新闻分析师
  BULL_RESEARCHER = 'bull_researcher',      // 多头研究员
  BEAR_RESEARCHER = 'bear_researcher',      // 空头研究员
  TRADER = 'trader',                        // 交易员
  RISK_MANAGER = 'risk_manager',           // 风险管理员
  REFLECTION_AGENT = 'reflection_agent',    // 反思智能体
}

/**
 * 智能体状态
 */
export enum AgentStatus {
  IDLE = 'idle',
  ANALYZING = 'analyzing',
  COMPLETED = 'completed',
  ERROR = 'error',
}

/**
 * 智能体上下文信息
 */
export interface AgentContext {
  /** 股票代码 */
  stockCode: string;
  
  /** 股票名称 */
  stockName?: string;
  
  /** 分析时间范围 */
  timeRange?: {
    startDate: Date;
    endDate: Date;
  };
  
  /** 历史数据 */
  historicalData?: any;
  
  /** 新闻数据 */
  newsData?: any;
  
  /** 财务数据 */
  financialData?: any;
  
  /** 其他智能体的分析结果 */
  previousResults?: AgentResult[];
  
  /** 扩展参数 */
  metadata?: Record<string, any>;
}

/**
 * 智能体分析结果
 */
export interface AgentResult {
  /** 智能体名称 */
  agentName: string;
  
  /** 智能体类型 */
  agentType: AgentType;
  
  /** 分析结果 */
  analysis: string;
  
  /** 评分 (0-100) */
  score?: number;
  
  /** 建议操作 */
  recommendation?: TradingRecommendation;
  
  /** 置信度 (0-1) */
  confidence?: number;
  
  /** 关键洞察 */
  keyInsights?: string[];
  
  /** 风险提示 */
  risks?: string[];
  
  /** 支撑数据 */
  supportingData?: Record<string, any>;
  
  /** 分析时间戳 */
  timestamp: Date;
  
  /** 处理时长(毫秒) */
  processingTime?: number;
}

/**
 * 交易建议枚举
 */
export enum TradingRecommendation {
  STRONG_BUY = 'strong_buy',   // 强烈买入
  BUY = 'buy',                 // 买入
  HOLD = 'hold',               // 持有
  SELL = 'sell',               // 卖出
  STRONG_SELL = 'strong_sell', // 强烈卖出
}

/**
 * 智能体配置接口
 */
export interface AgentConfig {
  /** LLM模型配置 */
  model: string;
  
  /** 温度参数 */
  temperature?: number;
  
  /** 最大token数 */
  maxTokens?: number;
  
  /** 系统提示词 */
  systemPrompt: string;
  
  /** 超时时间(秒) */
  timeout?: number;
  
  /** 重试次数 */
  retryCount?: number;
}