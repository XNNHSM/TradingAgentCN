import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {BaseAgent} from "../base/base-agent";
import {AgentConfig, AgentContext, AgentResult, AgentType,} from "../interfaces/agent.interface";
import {LLMService} from "../services/llm.service";
import {AgentExecutionRecordService} from "../services/agent-execution-record.service";

/**
 * 社交媒体分析师智能体
 * 专门分析社交媒体平台上的投资者情绪和讨论热点
 * 基于 prompt_templates.md 中的社交媒体分析师模板
 */
@Injectable()
export class SocialMediaAnalystAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
    executionRecordService: AgentExecutionRecordService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "SOCIAL_MEDIA_ANALYST_MODEL",
        configService.get<string>("LLM_DEFAULT_MODEL", "qwen-plus"),
      ),
      temperature: configService.get<number>(
        "SOCIAL_MEDIA_ANALYST_TEMPERATURE",
        configService.get<number>("LLM_DEFAULT_TEMPERATURE", 0.7),
      ),
      maxTokens: configService.get<number>(
        "SOCIAL_MEDIA_ANALYST_MAX_TOKENS",
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 3000),
      ),
      timeout: configService.get<number>(
        "SOCIAL_MEDIA_ANALYST_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 120),
      ),
      retryCount: configService.get<number>(
        "SOCIAL_MEDIA_ANALYST_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
      systemPrompt: `您是一位专业的社交媒体情绪分析师，专门分析社交媒体平台上的投资者情绪和讨论热点。您的任务是撰写一份关于特定股票在社交媒体上情绪和讨论的综合报告。

🎯 **分析范围**:
📱 **社交媒体平台**: Reddit、Twitter、StockTwits、雪球等
💭 **情绪分析**: 正面、负面、中性情绪的分布和变化趋势
🔥 **热门话题**: 最受关注的讨论主题和关键词
👥 **用户行为**: 散户投资者的观点和行为模式
📊 **情绪指标**: 恐惧贪婪指数、看涨看跌比例、讨论量变化

🔍 **重点关注**:
- 投资者对公司基本面的看法
- 对最新财报和新闻的反应
- 技术分析观点和价格预测
- 风险因素和担忧点
- 机构投资者vs散户投资者的观点差异

📋 **分析要求**:
1. 量化情绪变化趋势，提供具体的数据支持
2. 识别可能影响股价的关键情绪转折点
3. 分析社交媒体情绪与实际股价表现的相关性
4. 不要简单地说"情绪混合"，要提供详细的情绪分析
5. 评估社交媒体情绪的可靠性和潜在偏差
6. 在报告末尾添加Markdown表格来组织关键要点，使其有条理且易于阅读

💡 **输出格式**:
请按照以下结构进行分析:
- **情绪概览**: 整体情绪倾向和强度
- **热点话题**: 最受关注的讨论主题
- **情绪指标**: 具体的量化指标和变化趋势
- **关键洞察**: 可能影响交易的重要发现
- **风险提示**: 情绪分析的局限性和风险
- **总结表格**: 关键指标和建议的Markdown表格

请用中文撰写专业、深入的社交媒体情绪分析报告。`,
    };

    super(
      "社交媒体分析师",
      AgentType.SOCIAL_MEDIA_ANALYST,
      "专业的社交媒体情绪分析师，专门分析投资者情绪和讨论热点",
      llmService,
      undefined, // dataToolkit (已废弃)
      config,
      executionRecordService,
    );
  }

  /**
   * 准备上下文 - 验证和准备分析所需的上下文数据
   */
  protected async prepareContext(context: AgentContext): Promise<AgentContext> {
    // 检查必需的数据
    const newsData = context.newsData;
    const historicalData = context.historicalData;

    if (!newsData && !historicalData) {
      throw new Error('新闻数据或历史数据至少需要提供一种');
    }

    // 返回包含可用数据的上下文
    return {
      ...context,
      metadata: {
        ...context.metadata,
        analysisData: {
          newsData,
          historicalData,
          previousResults: context.previousResults,
          analysisType: context.metadata?.analysisType || 'social_media_analysis'
        }
      }
    };
  }

  /**
   * 执行社交媒体情绪分析 - 调用LLM进行分析
   */
  protected async executeAnalysis(context: AgentContext): Promise<string> {
    // 构建分析提示词
    const analysisPrompt = this.buildAnalysisPrompt(context);

    // 调用LLM进行社交媒体情绪分析
    return await this.callLLM(analysisPrompt);
  }

  /**
   * 处理结果 - 将分析结果转换为AgentResult格式
   */
  protected async processResult(analysis: string, context: AgentContext): Promise<AgentResult> {
    const analysisData = context.metadata?.analysisData;

    return {
      agentName: this.name,
      agentType: this.type,
      analysis,
      confidence: this.calculateConfidence(context, analysis),
      keyInsights: this.extractSocialInsights(analysis),
      risks: this.identifyRisks(analysis),
      supportingData: {
        socialMediaSources: ["Reddit", "Twitter", "StockTwits", "雪球"],
        analysisMetrics: ["情绪倾向", "讨论热度", "关键词频率", "用户行为模式"],
        analysisData: {
          hasNewsData: !!analysisData?.newsData,
          hasHistoricalData: !!analysisData?.historicalData,
          hasPreviousResults: !!(analysisData?.previousResults?.length),
        },
        timeRange: context.timeRange,
      },
      timestamp: new Date(),
    };
  }

  /**
   * 实现抽象方法：构建分析提示词
   */
  protected async buildPrompt(context: AgentContext): Promise<string> {
    return this.buildAnalysisPrompt(context);
  }

  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(context: AgentContext): string {
    const { stockCode, stockName, timeRange } = context;

    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 进行社交媒体情绪分析。\n\n`;

    // 添加时间范围
    if (timeRange) {
      prompt += `分析时间范围: ${timeRange.startDate.toISOString().split('T')[0]} 至 ${timeRange.endDate.toISOString().split('T')[0]}\n\n`;
    }

    // 添加历史数据（如果可用）
    if (context.historicalData) {
      prompt += `**历史价格数据**:\n${JSON.stringify(context.historicalData, null, 2)}\n\n`;
    }

    // 添加新闻数据（如果可用）
    if (context.newsData) {
      prompt += `**相关新闻信息**:\n${JSON.stringify(context.newsData, null, 2)}\n\n`;
    }

    // 添加其他智能体的分析结果
    if (context.previousResults && context.previousResults.length > 0) {
      prompt += `**其他分析师观点**:\n`;
      context.previousResults.forEach((result, index) => {
        prompt += `${index + 1}. ${result.agentName} (${result.agentType}): ${result.analysis}\n`;
      });
      prompt += `\n`;
    }

    prompt += `请基于以上信息进行专业的社交媒体情绪分析，重点关注投资者情绪变化、讨论热点和潜在的市场影响。`;

    return prompt;
  }

  /**
   * 计算分析置信度
   */
  private calculateConfidence(context: AgentContext, analysis: string): number {
    let confidence = 0.6; // 基础置信度

    // 根据数据可用性调整置信度
    if (context.newsData) confidence += 0.1;
    if (context.historicalData) confidence += 0.1;
    if (context.previousResults && context.previousResults.length > 0) confidence += 0.1;

    // 根据分析内容质量调整置信度
    if (analysis.includes("具体数据") || analysis.includes("量化")) confidence += 0.1;
    if (analysis.includes("风险") || analysis.includes("局限性")) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }

  /**
   * 提取关键洞察
   */
  private extractSocialInsights(analysis: string): string[] {
    const insights: string[] = [];

    // 通过关键词识别洞察
    const insightKeywords = [
      "情绪转折",
      "讨论热度",
      "关键话题",
      "用户行为",
      "情绪指标",
      "社交媒体影响"
    ];

    const sentences = analysis.split(/[。！？]/);
    sentences.forEach(sentence => {
      insightKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 10) {
          insights.push(sentence.trim());
        }
      });
    });

    return insights.slice(0, 5); // 最多返回5个关键洞察
  }

  /**
   * 识别风险因素
   */
  private identifyRisks(analysis: string): string[] {
    const risks: string[] = [];

    // 常见的社交媒体分析风险
    const commonRisks = [
      "社交媒体情绪可能存在偏差和噪音",
      "散户情绪与机构行为可能存在差异",
      "情绪分析的时效性有限",
      "社交媒体数据的代表性可能不足"
    ];

    // 从分析中提取风险相关内容
    const riskKeywords = ["风险", "局限", "偏差", "不确定", "波动"];
    const sentences = analysis.split(/[。！？]/);
    
    sentences.forEach(sentence => {
      riskKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 10) {
          risks.push(sentence.trim());
        }
      });
    });

    // 如果没有从分析中提取到风险，添加通用风险
    if (risks.length === 0) {
      risks.push(...commonRisks.slice(0, 2));
    }

    return risks.slice(0, 4); // 最多返回4个风险点
  }
}