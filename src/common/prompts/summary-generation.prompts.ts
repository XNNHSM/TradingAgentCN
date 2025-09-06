/**
 * 摘要生成提示词模板
 * 针对不同内容类型的专业提示词设计
 */

/**
 * 提示词模板配置
 */
export interface PromptTemplateConfig {
  systemPrompt: string;
  userPromptTemplate: string;
  expectedOutputFormat: string;
  maxOutputTokens: number;
  recommendedModel: string;
}

/**
 * 基础提示词构建器
 */
export class PromptBuilder {
  /**
   * 构建系统提示词
   */
  static buildSystemPrompt(contentType: string, config?: Partial<PromptTemplateConfig>): string {
    const baseSystemPrompt = `你是一个专业的中文内容分析师，擅长为各种类型的内容生成简洁、准确、有信息价值的摘要。

你的任务要求：
1. 准确理解原文核心内容，不添加原文没有的信息
2. 保持客观中立的立场，避免主观臆断
3. 提炼关键信息点，便于快速了解内容要点
4. 语言简洁明了，避免冗余表达
5. 适合中文阅读习惯，语句通顺自然

分析原则：
- 重要性：优先保留最重要的信息
- 准确性：确保信息传达准确无误
- 完整性：在简洁的前提下保持信息完整
- 可读性：生成的摘要要易于理解`;

    if (config?.systemPrompt) {
      return `${baseSystemPrompt}\n\n${config.systemPrompt}`;
    }

    return baseSystemPrompt;
  }

  /**
   * 构建用户提示词
   */
  static buildUserPrompt(
    content: string,
    contentType: string,
    options: {
      title?: string;
      maxTokens?: number;
      customPrompt?: string;
      language?: string;
    } = {}
  ): string {
    const { title, maxTokens = 500, customPrompt, language = 'zh' } = options;

    let prompt = '';

    // 添加标题信息
    if (title) {
      prompt += `标题：${title}\n\n`;
    }

    // 添加内容类型说明
    prompt += `内容类型：${contentType}\n\n`;

    // 添加长度要求
    prompt += `摘要要求：${maxTokens}字以内，简洁明了\n\n`;

    // 添加自定义提示词
    if (customPrompt) {
      prompt += `特殊要求：${customPrompt}\n\n`;
    }

    // 添加原文内容
    prompt += `原文内容：\n${content}\n\n`;

    // 添加输出格式要求
    prompt += `请按照以下JSON格式输出结果：
{
  "summary": "生成的摘要内容",
  "keyPoints": ["关键点1", "关键点2", "关键点3"],
  "sentiment": "positive/negative/neutral",
  "category": "内容分类",
  "tags": ["标签1", "标签2"]
}`;

    return prompt;
  }
}

/**
 * 针对不同内容类型的提示词模板
 */
export const PromptTemplates: Record<string, PromptTemplateConfig> = {
  // 新闻类内容
  news: {
    systemPrompt: `你是一个专业的新闻分析师，擅长为新闻内容生成客观、准确的摘要。

新闻摘要要点：
1. 5W1H原则：Who（人物）、What（事件）、When（时间）、Where（地点）、Why（原因）、How（方式）
2. 时间线索：明确事件发生的时间顺序
3. 事实优先：以客观事实为主，避免主观评价
4. 重要性排序：最重要的信息放在前面
5. 背景补充：适当提供必要的背景信息`,
    userPromptTemplate: `请为以下新闻内容生成专业摘要：`,
    expectedOutputFormat: '包含核心事实、时间地点、事件结果的摘要',
    maxOutputTokens: 500,
    recommendedModel: 'qwen-turbo'
  },

  // 政策类内容
  policy: {
    systemPrompt: `你是一个政策解读专家，擅长为政策文件生成准确、清晰的摘要。

政策摘要要点：
1. 政策主体：明确发布机构和政策名称
2. 政策目标：阐述政策的核心目标和意图
3. 主要措施：列出具体的政策措施和要求
4. 影响范围：说明政策适用的对象和范围
5. 时间节点：明确政策实施时间和重要时间点
6. 预期效果：分析政策可能产生的影响`,
    userPromptTemplate: `请为以下政策内容生成专业解读摘要：`,
    expectedOutputFormat: '包含政策主体、核心措施、影响范围、时间节点的摘要',
    maxOutputTokens: 600,
    recommendedModel: 'qwen-turbo'
  },

  // 热搜类内容
  hot_search: {
    systemPrompt: `你是一个热点事件分析师，擅长为热搜话题生成简洁、有吸引力的摘要。

热搜摘要要点：
1. 事件核心：快速抓住事件的核心内容
2. 关注点：突出公众最关心的方面
3. 背景信息：提供必要的背景介绍
4. 社会反响：反映事件的社会影响
5. 发展趋势：分析事件可能的后续发展`,
    userPromptTemplate: `请为以下热搜话题生成吸引人的摘要：`,
    expectedOutputFormat: '包含事件核心、关注焦点、社会反响的摘要',
    maxOutputTokens: 400,
    recommendedModel: 'qwen-turbo'
  },

  // 报告类内容
  report: {
    systemPrompt: `你是一个专业报告分析师，擅长为各类报告生成结构化的摘要。

报告摘要要点：
1. 报告目的：明确报告的主要目的和背景
2. 研究方法：说明采用的研究方法和数据来源
3. 主要发现：列出最重要的研究发现和数据
4. 结论建议：提供基于研究发现的主要结论和建议
5. 实践意义：分析报告的实践应用价值`,
    userPromptTemplate: `请为以下报告内容生成专业摘要：`,
    expectedOutputFormat: '包含研究目的、主要发现、结论建议的结构化摘要',
    maxOutputTokens: 700,
    recommendedModel: 'qwen-plus'
  },

  // 公告类内容
  announcement: {
    systemPrompt: `你是一个公告解读专家，擅长为各类公告生成清晰、准确的摘要。

公告摘要要点：
1. 公告主体：明确发布公告的机构或个人
2. 公告事项：清楚说明公告的具体内容
3. 生效时间：明确公告的生效时间和重要时间节点
4. 影响对象：说明公告影响的群体或范围
5. 注意事项：提醒相关方需要注意的重要事项`,
    userPromptTemplate: `请为以下公告内容生成清晰摘要：`,
    expectedOutputFormat: '包含公告主体、核心事项、生效时间、影响对象的摘要',
    maxOutputTokens: 500,
    recommendedModel: 'qwen-turbo'
  },

  // 文章类内容
  article: {
    systemPrompt: `你是一个文章分析师，擅长为各类文章生成深度摘要。

文章摘要要点：
1. 核心观点：提炼文章的主要观点和论点
2. 论证逻辑：梳理文章的论证结构和逻辑
3. 重要论据：列出支持观点的重要论据
4. 作者立场：分析作者的立场和态度
5. 启示意义：总结文章的启示和思考价值`,
    userPromptTemplate: `请为以下文章内容生成深度摘要：`,
    expectedOutputFormat: '包含核心观点、论证逻辑、重要论据的深度摘要',
    maxOutputTokens: 600,
    recommendedModel: 'qwen-plus'
  },

  // 默认模板
  default: {
    systemPrompt: '',
    userPromptTemplate: '请为以下内容生成简洁摘要：',
    expectedOutputFormat: '简洁明了的内容摘要',
    maxOutputTokens: 500,
    recommendedModel: 'qwen-turbo'
  }
};

/**
 * 获取对应内容类型的提示词模板
 */
export function getPromptTemplate(contentType: string): PromptTemplateConfig {
  return PromptTemplates[contentType] || PromptTemplates.default;
}

/**
 * 构建完整的提示词
 */
export function buildCompletePrompt(
  input: {
    content: string;
    title?: string;
    contentType: string;
    maxTokens?: number;
    customPrompt?: string;
    language?: string;
  }
): {
  systemPrompt: string;
  userPrompt: string;
  config: PromptTemplateConfig;
} {
  const { content, title, contentType, maxTokens, customPrompt, language } = input;
  const config = getPromptTemplate(contentType);

  const systemPrompt = PromptBuilder.buildSystemPrompt(contentType, { systemPrompt: config.systemPrompt });
  const userPrompt = PromptBuilder.buildUserPrompt(content, contentType, {
    title,
    maxTokens,
    customPrompt: customPrompt || config.userPromptTemplate,
    language
  });

  return { systemPrompt, userPrompt, config };
}