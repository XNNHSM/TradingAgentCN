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
  // === MCP 按需调用架构（当前架构）===
  
  // 🆕 第一层: 数据获取和基础分析智能体 (直接调用MCP服务)
  BASIC_DATA_AGENT = "basic_data_agent", // 基础数据智能体 - 基本信息和实时数据
  TECHNICAL_ANALYST_NEW = "technical_analyst_new", // 技术分析智能体 - 历史数据和技术指标
  FUNDAMENTAL_ANALYST_NEW = "fundamental_analyst_new", // 基本面分析智能体 - 财务数据
  NEWS_ANALYST_NEW = "news_analyst_new", // 新闻分析智能体 - 新闻数据
  
  // 🆕 第二层: 高级分析智能体 (基于第一层结果)
  SOCIAL_MEDIA_ANALYST = "social_media_analyst", // 社交媒体分析师（情绪分析+讨论热点）
  QUANTITATIVE_TRADER = "quantitative_trader", // 量化交易员（数据驱动+统计模型）
  MACRO_ECONOMIST = "macro_economist", // 宏观经济分析师（政策+经济环境分析）
  
  // 🆕 第三层: 决策协调智能体
  UNIFIED_ORCHESTRATOR = "unified_orchestrator", // 统一协调器（智能体协调+决策整合）
}

/**
 * 智能体状态
 */
export enum AgentStatus {
  IDLE = "idle",
  ANALYZING = "analyzing",
  COMPLETED = "completed",
  ERROR = "error",
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
  STRONG_BUY = "strong_buy", // 强烈买入
  BUY = "buy", // 买入
  HOLD = "hold", // 持有
  SELL = "sell", // 卖出
  STRONG_SELL = "strong_sell", // 强烈卖出
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
