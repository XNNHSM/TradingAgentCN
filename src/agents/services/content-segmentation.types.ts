/**
 * 内容分段处理配置接口
 */
export interface ContentSegmentationConfig {
  // LLM提供商配置
  provider: string;
  model: string;
  
  // 长度限制配置
  maxInputTokens: number;
  maxInputChars: number;
  safetyMargin: number; // 安全边距，默认保留10%
  
  // 分段策略配置
  strategy: 'semantic' | 'size' | 'hybrid';
  maxSegments: number;
  preserveContext: boolean;
  contextOverlap: number; // 上下文重叠字符数
  
  // 内容优先级配置
  contentPriorities: {
    high: string[]; // 高优先级内容类型
    medium: string[]; // 中优先级内容类型
    low: string[]; // 低优先级内容类型
  };
}

/**
 * 内容片段接口
 */
export interface ContentSegment {
  id: string;
  content: string;
  metadata: {
    segmentIndex: number;
    totalSegments: number;
    priority: 'high' | 'medium' | 'low';
    contentType: string;
    charCount: number;
    tokenEstimate: number;
    hasContext: boolean;
    previousSegmentSummary?: string;
  };
}

/**
 * 分段处理结果接口
 */
export interface SegmentationResult {
  segments: ContentSegment[];
  summary: string;
  metadata: {
    totalChars: number;
    totalTokens: number;
    segmentCount: number;
    strategy: string;
    truncationRequired: boolean;
    truncatedContent: string;
  };
}

/**
 * 内容优先级定义
 */
export const CONTENT_PRIORITIES = {
  HIGH: ['analysis_request', 'stock_basic_info', 'key_metrics'],
  MEDIUM: ['financial_data', 'technical_indicators', 'market_trend'],
  LOW: ['detailed_history', 'supplementary_data', 'background_info']
} as const;

/**
 * 默认分段配置
 */
export const DEFAULT_SEGMENTATION_CONFIG: ContentSegmentationConfig = {
  provider: 'dashscope',
  model: 'qwen-max',
  maxInputTokens: 30000, // 30720的安全值
  maxInputChars: 120000, // 粗略估算: 1 token ≈ 4 chars
  safetyMargin: 0.1,
  strategy: 'hybrid',
  maxSegments: 5,
  preserveContext: true,
  contextOverlap: 500,
  contentPriorities: {
    high: [...CONTENT_PRIORITIES.HIGH],
    medium: [...CONTENT_PRIORITIES.MEDIUM],
    low: [...CONTENT_PRIORITIES.LOW]
  }
};