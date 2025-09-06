/**
 * 通用摘要生成接口定义
 * 支持多种内容类型的摘要生成
 */

/**
 * 内容类型枚举
 */
export enum ContentType {
  NEWS = 'news',           // 新闻
  POLICY = 'policy',       // 政策
  HOT_SEARCH = 'hot_search', // 热搜
  REPORT = 'report',       // 报告
  ANNOUNCEMENT = 'announcement', // 公告
  ARTICLE = 'article',     // 文章
  OTHER = 'other'          // 其他
}

/**
 * 摘要生成输入参数
 */
export interface SummaryGenerationInput {
  content: string;         // 原始内容
  title?: string;          // 标题（可选）
  contentType: ContentType; // 内容类型
  source?: string;         // 来源（可选）
  publishTime?: string;    // 发布时间（可选）
  maxTokens?: number;      // 最大token数（可选，默认500）
  language?: string;       // 语言（可选，默认zh）
  customPrompt?: string;   // 自定义提示词（可选）
}

/**
 * 摘要生成结果
 */
export interface SummaryGenerationResult {
  success: boolean;
  summary: string;         // 生成的摘要
  keyPoints?: string[];    // 关键点（可选）
  sentiment?: 'positive' | 'negative' | 'neutral'; // 情感倾向（可选）
  category?: string;       // 分类（可选）
  tags?: string[];         // 标签（可选）
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };                      // Token使用情况（可选）
  processingTime: number;  // 处理时间（毫秒）
  message: string;         // 结果消息
  error?: string;          // 错误信息（如果有）
}

/**
 * LLM模型配置
 */
export interface LLMModelConfig {
  provider: string;        // 提供商（openai, qwen, etc.）
  model: string;           // 模型名称
  maxTokens?: number;      // 最大输出token数
  temperature?: number;    // 温度参数
  topP?: number;          // topP参数
  costPer1kTokens?: number; // 每1k token成本（可选）
}

/**
 * 摘要生成器接口
 */
export interface ISummaryGenerator {
  generate(input: SummaryGenerationInput): Promise<SummaryGenerationResult>;
  isSupported(contentType: ContentType): boolean;
}

/**
 * 内容解析器接口
 */
export interface IContentParser {
  parse(content: string, contentType: ContentType): Promise<{
    cleanedContent: string;
    metadata?: Record<string, any>;
  }>;
}