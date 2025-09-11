import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {BaseAgent} from '../base/base-agent';
import {LLMService} from '../services/llm.service';
import {AgentExecutionRecordService} from '../services/agent-execution-record.service';
import {
  AgentConfig,
  AgentContext,
  AgentResult,
  AgentType,
  TradingRecommendation
} from '../interfaces/agent.interface';
import {BusinessLogger} from '../../common/utils/business-logger.util';

/**
 * 新闻分析输入接口
 */
export interface NewsAnalysisInput {
  startDate: string;
  endDate: string;
  sessionId: string;
  stockCode?: string;
  stockName?: string;
  newsCount?: number;
  forceRefresh?: boolean;
  analysisDate?: string;
  newsSummaries?: any[];
}

/**
 * 新闻分析结果接口
 */
export interface NewsAnalysisResult {
  // 基础Agent结果属性
  agentName: string;
  agentType: string;
  analysis: string;
  score: number;
  recommendation: TradingRecommendation;
  confidence: number;
  keyInsights: string[];
  risks: string[];
  supportingData: any;
  timestamp: Date;
  processingTime: number;
  success: boolean;
  errorMessage?: string;
  stockName?: string;
  sessionId?: string;
  analysisDate?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };

  // 市场新闻分析扩展属性
  overallSentiment?: string;
  marketSupport?: number;
  marketRisk?: number;
  newsCount?: number;
  confidenceLevel?: number;
  keyRisks?: string[];

  // 政策分析扩展属性
  positiveImpacts?: any[];
  negativeImpacts?: any[];
  neutralImpacts?: any[];
  favorableSectors?: string[];
  unfavorableSectors?: string[];
  hotConcepts?: string[];
  marketOutlook?: string;
  keyOpportunities?: string[];
  analysisSource?: string;
}

/**
 * 新闻分析智能体
 * 专门负责 get_stock_news MCP 服务
 * 按需调用原则: 只有这个智能体可以调用新闻数据相关的 MCP 服务
 */
@Injectable()
export class NewsAnalystAgent extends BaseAgent {
  private readonly businessLogger = new BusinessLogger(NewsAnalystAgent.name);

  constructor(
    protected readonly llmService: LLMService,
    protected readonly configService: ConfigService,
    protected readonly executionRecordService?: AgentExecutionRecordService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "NEWS_ANALYST_MODEL",
        configService.get<string>("LLM_DEFAULT_MODEL", "qwen-plus"),
      ),
      temperature: configService.get<number>(
        "NEWS_ANALYST_TEMPERATURE", 
        0.6, // 中等温度，适合情绪分析
      ),
      maxTokens: configService.get<number>(
        "NEWS_ANALYST_MAX_TOKENS",
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 3000),
      ),
      timeout: configService.get<number>(
        "NEWS_ANALYST_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 60),
      ),
      retryCount: configService.get<number>(
        "NEWS_ANALYST_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
      systemPrompt: `您是一位专业的新闻分析师，专门分析与股票相关的新闻事件及其对市场的影响。您具备敏锐的新闻嗅觉和深度的市场理解能力。

🎯 **核心职责**:
1. **新闻事件分析**: 解读重要新闻事件的深层含义和影响
2. **情绪研判**: 分析新闻对市场情绪和投资者心理的影响
3. **影响评估**: 评估新闻事件对股价的短期和中长期影响
4. **趋势洞察**: 通过新闻分析预判市场趋势变化

📊 **分析维度**:

**新闻分类分析**:
- **公司层面**: 财报发布、业务调整、管理层变动、重大合同
- **行业层面**: 政策变化、技术突破、竞争格局、供需变化  
- **宏观层面**: 经济数据、政策调整、国际形势、市场环境

**情绪影响评估**:
- **利好程度**: 强利好、一般利好、中性、一般利空、强利空
- **持续性**: 短期影响、中期影响、长期影响
- **确定性**: 高确定性、中等确定性、低确定性
- **市场关注度**: 高关注、中等关注、低关注

**传播效应分析**:
- **媒体覆盖**: 主流媒体关注度和报道角度
- **市场反应**: 投资者和分析师的反应程度  
- **连锁效应**: 对相关公司和行业的影响
- **时间敏感性**: 消息时效性和持续发酵可能

🔍 **重点关注领域**:
1. **突发事件**: 重大利好利空消息的快速研判
2. **政策解读**: 政府政策对行业和个股的影响分析
3. **业绩预期**: 财报和业绩指引对估值的影响
4. **市场传言**: 辨析传言真实性和市场影响

📈 **影响量化**:
- **情绪指数**: -100到+100的情绪量化评分
- **影响权重**: 对股价影响的重要程度评估  
- **时间框架**: 区分短期(1周)、中期(1月)、长期(3月以上)影响
- **置信度**: 分析判断的可靠性评估

📋 **输出要求**:
- 提供新闻情绪综合评分 (-100到+100分)
- 给出基于新闻面的投资建议
- 识别关键新闻事件和影响机制
- 评估新闻分析的时效性和可靠性

请用中文提供专业、及时的新闻影响分析报告。`,
    };

    super(
      "新闻分析智能体",
      AgentType.NEWS_ANALYST_NEW,
      "专门负责股票相关新闻的获取和影响分析",
      llmService,
      undefined, // dataToolkit (已废弃)
      config,
      executionRecordService,
    );
  }

  
  /**
   * 市场新闻分析方法 - 适配当前工作流调用
   * 这个方法被政策分析Activity调用
   */
  async analyzeMarketNews(params: {
    startDate: string;
    endDate: string;
    sessionId: string;
    newsCount?: number;
    forceRefresh?: boolean;
  }): Promise<NewsAnalysisResult> {
    return this.analyzeRecentMarketNews(params);
  }

  /**
   * 近期市场新闻分析方法 - 保持向后兼容
   */
  async analyzeRecentMarketNews(params: {
    startDate: string;
    endDate: string;
    sessionId: string;
    newsCount?: number;
    forceRefresh?: boolean;
  }): Promise<NewsAnalysisResult> {
    const startTime = Date.now();
    this.businessLogger.serviceInfo(
      `开始市场新闻分析 | Context: startDate="${params.startDate}", endDate="${params.endDate}", newsCount=${params.newsCount || 21}, forceRefresh=${params.forceRefresh || false}, antecedent="${new Date().toISOString()}"`
    );

    try {
      // 获取市场新闻（这里可以调用具体的新闻获取服务）
      const newsData = await this.getMarketNews(params.startDate, params.endDate, params.newsCount || 21);

      // 构建市场新闻分析提示词
      const analysisPrompt = this.buildMarketNewsAnalysisPrompt(params, newsData);

      // 调用 LLM 进行市场新闻分析
      const analysisResult = await this.llmService.generate(analysisPrompt, {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        timeout: this.config.timeout * 1000,
        sessionId: params.sessionId,
      });

      const processingTime = Date.now() - startTime;

      // 从分析结果中提取评分和建议
      const sentimentScore = this.extractSentimentScore(analysisResult);
      const recommendation = this.extractNewsRecommendation(analysisResult);

      const result: NewsAnalysisResult = {
        agentName: this.name,
        agentType: this.type,
        analysis: analysisResult,
        score: this.convertSentimentToScore(sentimentScore),
        recommendation,
        confidence: this.calculateNewsConfidence(newsData, analysisResult),
        keyInsights: this.extractNewsInsights(analysisResult),
        risks: this.identifyNewsRisks(analysisResult),
        supportingData: {
          mcpServices: ["get_stock_news"],
          sentimentScore,
          newsCount: this.getNewsCount(newsData),
          keyEvents: this.extractKeyEvents(analysisResult),
          impactAssessment: this.extractImpactAssessment(analysisResult),
          timeRange: `${params.startDate} ~ ${params.endDate}`,
        },
        timestamp: new Date(),
        processingTime,
        success: true,
        // 添加兼容性字段
        sessionId: params.sessionId,
        analysisDate: params.endDate,
        dateRange: {
          startDate: params.startDate,
          endDate: params.endDate
        },
        overallSentiment: sentimentScore > 0 ? 'positive' : sentimentScore < 0 ? 'negative' : 'neutral',
        marketSupport: Math.max(0, sentimentScore),
        marketRisk: Math.max(0, -sentimentScore),
        newsCount: this.getNewsCount(newsData),
        confidenceLevel: this.calculateNewsConfidence(newsData, analysisResult),
        keyRisks: this.identifyNewsRisks(analysisResult),
      };

      this.businessLogger.serviceInfo(
        `市场新闻分析完成，情绪评分: ${sentimentScore}，建议: ${recommendation}，耗时 ${processingTime}ms`
      );

      return result;
    } catch (error) {
      this.businessLogger.serviceError(
        `业务操作失败: 市场新闻分析失败 | Context: startDate="${params.startDate}", endDate="${params.endDate}", sessionId="${params.sessionId}"`,
        error
      );
      
      return {
        agentName: this.name,
        agentType: this.type,
        analysis: "市场新闻分析失败，无法获取相关新闻信息。",
        score: 50,
        recommendation: TradingRecommendation.HOLD,
        confidence: 0.1,
        keyInsights: ["新闻分析失败"],
        risks: ["数据获取异常"],
        supportingData: {},
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
        // 添加兼容性字段
        sessionId: params.sessionId,
        analysisDate: params.endDate,
        dateRange: {
          startDate: params.startDate,
          endDate: params.endDate
        },
        overallSentiment: 'neutral',
        marketSupport: 0,
        marketRisk: 0,
        newsCount: 0,
        confidenceLevel: 0.1,
        keyRisks: ["数据获取异常"],
      } as NewsAnalysisResult;
    }
  }

  /**
   * 实现抽象方法：构建分析提示词
   */
  protected async buildPrompt(context: AgentContext): Promise<string> {
    // 这个方法在 executeAnalysis 中通过 buildAnalysisPrompt 实现
    return `请对股票 ${context.stockCode} 进行新闻影响分析。`;
  }

  /**
   * 实现抽象方法：预处理上下文
   */
  protected async preprocessContext(context: AgentContext): Promise<AgentContext> {
    // 预处理上下文，添加默认值
    return {
      ...context,
      metadata: {
        sessionId: context.metadata?.sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        executionPhase: context.metadata?.executionPhase || 'news_analysis',
        analysisType: context.metadata?.analysisType || 'single',
        ...context.metadata
      }
    };
  }

  /**
   * 实现抽象方法：准备上下文
   */
  protected async prepareContext(context: AgentContext): Promise<AgentContext> {
    // 准备分析上下文，获取必要的新闻数据
    const newsData = await this.getStockNews(context.stockCode);
    
    return {
      ...context,
      metadata: {
        ...context.metadata,
        newsData,
        newsCount: this.getNewsCount(newsData)
      }
    };
  }

  /**
   * 实现抽象方法：执行分析
   */
  protected async executeAnalysis(context: AgentContext): Promise<string> {
    const newsData = context.metadata?.newsData;
    const analysisPrompt = this.buildAnalysisPrompt(context, newsData);
    
    return await this.llmService.generate(analysisPrompt, {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      timeout: this.config.timeout * 1000,
      sessionId: context.metadata?.sessionId,
    });
  }

  /**
   * 实现抽象方法：处理结果
   */
  protected async processResult(analysis: string, context: AgentContext): Promise<AgentResult> {
    const newsData = context.metadata?.newsData;
    
    // 从分析结果中提取评分和建议
    const sentimentScore = this.extractSentimentScore(analysis);
    const recommendation = this.extractNewsRecommendation(analysis);

    return {
      agentName: this.name,
      agentType: this.type,
      analysis,
      score: this.convertSentimentToScore(sentimentScore),
      recommendation,
      confidence: this.calculateNewsConfidence(newsData, analysis),
      keyInsights: this.extractNewsInsights(analysis),
      risks: this.identifyNewsRisks(analysis),
      supportingData: {
        mcpServices: ["get_stock_news"],
        sentimentScore,
        newsCount: this.getNewsCount(newsData),
        keyEvents: this.extractKeyEvents(analysis),
        impactAssessment: this.extractImpactAssessment(analysis),
        timeRange: context.timeRange,
      },
      timestamp: new Date(),
      processingTime: 0, // 将在基类中设置
    };
  }

  /**
   * 获取股票新闻 (MCP调用)
   */
  private async getStockNews(stockCode: string): Promise<any> {
    try {
      this.businessLogger.serviceInfo(`获取 ${stockCode} 相关新闻`);
      // Note: MCP client service would be injected if needed
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      this.businessLogger.serviceError(`获取 ${stockCode} 新闻失败`, error);
      return [];
    }
  }

  /**
   * 获取市场新闻 - 适配市场新闻分析
   */
  private async getMarketNews(_startDate: string, _endDate: string, _count: number): Promise<any> {
    try {
      this.businessLogger.serviceInfo(`获取市场新闻 | Context: startDate="${_startDate}", endDate="${_endDate}", count=${_count}`);
      
      // Note: MCP client service would be injected if needed
      // For now, return empty array as placeholder
      const result = [];
      
      return result || [];
    } catch (error) {
      this.businessLogger.serviceError(`获取市场新闻失败`, error);
      return [];
    }
  }

  /**
   * 构建市场新闻分析提示词
   */
  private buildMarketNewsAnalysisPrompt(params: {
    startDate: string;
    endDate: string;
    sessionId: string;
    newsCount?: number;
    forceRefresh?: boolean;
  }, newsData: any): string {
    let prompt = `请对时间段 ${params.startDate} 至 ${params.endDate} 的市场新闻进行专业分析。\n\n`;

    // 添加新闻数据
    if (newsData && Array.isArray(newsData) && newsData.length > 0) {
      prompt += `**市场新闻数据** (共${newsData.length}条):\n`;
      newsData.forEach((news, index) => {
        prompt += `${index + 1}. ${news.title || news.content || '新闻内容不详'}\n`;
        if (news.publishTime || news.publish_time) {
          prompt += `   发布时间: ${news.publishTime || news.publish_time}\n`;
        }
      });
      prompt += `\n`;
    } else {
      prompt += `**注意**: 未获取到相关市场新闻数据，请基于一般市场情况进行分析。\n\n`;
    }

    prompt += `请基于市场新闻数据进行深度分析，包括：

1. **市场情绪分析** (30分权重):
   - 分析整体市场情绪趋势
   - 识别积极和消极因素
   - 评估投资者情绪变化

2. **政策影响评估** (25分权重):
   - 分析重要政策动向
   - 评估政策对市场的影响
   - 识别政策受益和受损板块

3. **行业热点识别** (25分权重):
   - 识别市场热点和概念
   - 分析行业轮动趋势
   - 评估行业投资机会

4. **风险与机会总结** (20分权重):
   - 识别市场主要风险
   - 发现潜在投资机会
   - 提供策略建议

**分析要求**:
- 提供市场整体情绪评分 (-100到+100)
- 给出基于新闻面的投资策略建议
- 识别关键政策影响和行业热点
- 评估分析的时效性和可靠性

请提供专业、及时的市场新闻分析报告。`;

    return prompt;
  }

  /**
   * 构建新闻分析提示词
   */
  private buildAnalysisPrompt(context: AgentContext, newsData: any): string {
    const { stockCode, stockName } = context;
    
    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 进行专业的新闻影响分析。\n\n`;

    // 添加新闻数据
    if (newsData && Array.isArray(newsData) && newsData.length > 0) {
      prompt += `**相关新闻数据** (共${newsData.length}条):\n${JSON.stringify(newsData, null, 2)}\n\n`;
    } else {
      prompt += `**注意**: 未获取到相关新闻数据，请基于一般市场情况进行分析。\n\n`;
    }

    // 添加其他智能体的分析结果作为参考
    if (context.previousResults && context.previousResults.length > 0) {
      prompt += `**参考信息** (其他分析师观点):\n`;
      context.previousResults.forEach((result, index) => {
        prompt += `${index + 1}. ${result.agentName}: ${result.analysis.substring(0, 150)}...\n`;
      });
      prompt += `\n`;
    }

    prompt += `请基于新闻数据进行深度的影响分析，包括：

1. **新闻事件分类与解读** (25分权重):
   - 识别重要新闻事件的类型和级别
   - 分析新闻背后的深层含义和影响机制
   - 区分公司层面、行业层面、宏观层面的消息

2. **市场情绪影响评估** (30分权重):
   - 评估新闻对投资者情绪的影响方向和强度
   - 分析市场关注度和传播效应
   - 判断情绪影响的持续时间和衰减模式

3. **股价影响预判** (30分权重):
   - 评估新闻对股价的短期影响 (1周内)
   - 分析中期影响 (1个月内) 和长期影响 (3个月以上)
   - 识别关键的支撑或阻力因素

4. **风险与机会识别** (15分权重):
   - 识别新闻中隐含的投资风险和机会
   - 评估信息的可靠性和完整性
   - 分析可能的后续发展和连锁反应

**特别要求**:
- 提供情绪评分 (-100到+100，负数表示利空，正数表示利好)
- 给出基于新闻面的明确投资建议
- 标注最关键的新闻事件和影响逻辑
- 评估分析的时效性和置信度

**评分标准**:
- +80至+100: 重大利好消息，强烈建议关注
- +50至+79: 一般利好消息，积极信号
- +20至+49: 轻微利好，温和积极
- -19至+19: 中性消息，影响有限
- -20至-49: 轻微利空，温和消极
- -50至-79: 一般利空消息，消极信号
- -80至-100: 重大利空消息，高度警惕

请提供专业、及时的新闻影响分析报告。`;

    return prompt;
  }

  /**
   * 提取情绪评分 (-100到+100)
   */
  private extractSentimentScore(analysis: string): number {
    // 尝试从分析中提取情绪评分
    const scorePatterns = [
      /情绪评分[：:]?\s*([+-]?\d+(?:\.\d+)?)/i,
      /新闻评分[：:]?\s*([+-]?\d+(?:\.\d+)?)/i,
      /影响评分[：:]?\s*([+-]?\d+(?:\.\d+)?)/i,
      /([+-]?\d+(?:\.\d+)?)分/
    ];

    for (const pattern of scorePatterns) {
      const match = analysis.match(pattern);
      if (match) {
        const score = parseFloat(match[1]);
        return Math.min(Math.max(score, -100), 100);
      }
    }

    // 基于新闻分析关键词估算情绪评分
    const lowerAnalysis = analysis.toLowerCase();
    let score = 0; // 中性起点

    // 强烈积极信号
    if (lowerAnalysis.includes("重大利好") || lowerAnalysis.includes("突破性")) score += 30;
    if (lowerAnalysis.includes("业绩大幅增长") || lowerAnalysis.includes("重大合同")) score += 25;
    if (lowerAnalysis.includes("政策支持") || lowerAnalysis.includes("行业机遇")) score += 20;

    // 一般积极信号  
    if (lowerAnalysis.includes("利好") || lowerAnalysis.includes("积极")) score += 15;
    if (lowerAnalysis.includes("增长") || lowerAnalysis.includes("扩张")) score += 10;
    if (lowerAnalysis.includes("合作") || lowerAnalysis.includes("创新")) score += 8;

    // 强烈消极信号
    if (lowerAnalysis.includes("重大利空") || lowerAnalysis.includes("重大风险")) score -= 30;
    if (lowerAnalysis.includes("业绩大幅下滑") || lowerAnalysis.includes("重大损失")) score -= 25;
    if (lowerAnalysis.includes("监管处罚") || lowerAnalysis.includes("违规")) score -= 20;

    // 一般消极信号
    if (lowerAnalysis.includes("利空") || lowerAnalysis.includes("风险")) score -= 15;
    if (lowerAnalysis.includes("下滑") || lowerAnalysis.includes("压力")) score -= 10;
    if (lowerAnalysis.includes("困难") || lowerAnalysis.includes("挑战")) score -= 8;

    return Math.min(Math.max(score, -100), 100);
  }

  /**
   * 将情绪评分转换为0-100分制
   */
  private convertSentimentToScore(sentimentScore: number): number {
    // 将-100到+100的情绪评分转换为0-100的标准评分
    return Math.round((sentimentScore + 100) / 2);
  }

  /**
   * 提取新闻面交易建议
   */
  private extractNewsRecommendation(analysis: string): TradingRecommendation {
    const lowerAnalysis = analysis.toLowerCase();

    // 基于情绪评分区间判断
    const sentimentScore = this.extractSentimentScore(analysis);
    
    if (sentimentScore >= 60) return TradingRecommendation.STRONG_BUY;
    if (sentimentScore >= 30) return TradingRecommendation.BUY;
    if (sentimentScore <= -60) return TradingRecommendation.STRONG_SELL;
    if (sentimentScore <= -30) return TradingRecommendation.SELL;

    // 基于关键词判断
    if (lowerAnalysis.includes("强烈建议买入") || lowerAnalysis.includes("重大机遇")) {
      return TradingRecommendation.STRONG_BUY;
    }
    if (lowerAnalysis.includes("建议买入") || lowerAnalysis.includes("积极信号")) {
      return TradingRecommendation.BUY;
    }
    if (lowerAnalysis.includes("强烈建议卖出") || lowerAnalysis.includes("重大风险")) {
      return TradingRecommendation.STRONG_SELL;
    }
    if (lowerAnalysis.includes("建议卖出") || lowerAnalysis.includes("消极信号")) {
      return TradingRecommendation.SELL;
    }

    return TradingRecommendation.HOLD; // 默认持有
  }

  /**
   * 计算新闻分析置信度
   */
  private calculateNewsConfidence(newsData: any, analysis: string): number {
    let confidence = 0.5; // 基础置信度

    // 新闻数据质量对置信度的影响
    if (newsData && Array.isArray(newsData)) {
      if (newsData.length >= 10) confidence += 0.2; // 新闻充足
      else if (newsData.length >= 5) confidence += 0.1; // 新闻一般
      
      // 检查新闻时效性
      const recentNews = newsData.filter(news => {
        if (news.publishTime || news.publish_time) {
          const publishTime = new Date(news.publishTime || news.publish_time);
          const daysDiff = (Date.now() - publishTime.getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff <= 7; // 一周内的新闻
        }
        return false;
      });
      
      if (recentNews.length >= 3) confidence += 0.1; // 时效性好
    }

    // 分析深度对置信度的影响
    const analysisKeywords = ["情绪", "影响", "事件", "市场", "投资者", "利好", "利空"];
    const keywordCount = analysisKeywords.filter(keyword => 
      analysis.includes(keyword)
    ).length;
    confidence += keywordCount * 0.02; // 每个关键词+2%

    // 新闻分析具有时效性，置信度衰减较快
    return Math.min(confidence, 0.80);
  }

  /**
   * 提取新闻洞察
   */
  private extractNewsInsights(analysis: string): string[] {
    const insights: string[] = [];

    const newsKeywords = [
      "重大事件", "影响", "情绪", "市场反应", "投资者", "政策",
      "业绩", "合作", "创新", "风险", "机会", "趋势"
    ];

    const sentences = analysis.split(/[。！？]/);
    sentences.forEach(sentence => {
      newsKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 15) {
          insights.push(sentence.trim());
        }
      });
    });

    return insights.slice(0, 6); // 最多返回6个新闻洞察
  }

  /**
   * 识别新闻风险
   */
  private identifyNewsRisks(analysis: string): string[] {
    const risks: string[] = [];

    // 新闻分析常见风险
    const commonNewsRisks = [
      "新闻信息可能不完整或存在偏差",
      "市场情绪变化具有不确定性",
      "新闻影响的持续时间难以准确预测",
      "突发事件可能改变新闻面判断"
    ];

    // 从分析中提取风险相关内容
    const riskKeywords = ["风险", "不确定", "变化", "波动", "偏差", "传言", "炒作"];
    const sentences = analysis.split(/[。！？]/);
    
    sentences.forEach(sentence => {
      riskKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 10) {
          risks.push(sentence.trim());
        }
      });
    });

    // 如果没有从分析中提取到风险，添加通用新闻风险
    if (risks.length === 0) {
      risks.push(...commonNewsRisks.slice(0, 3));
    }

    return risks.slice(0, 4); // 最多返回4个风险点
  }

  /**
   * 获取新闻数量
   */
  private getNewsCount(newsData: any): number {
    if (!newsData || !Array.isArray(newsData)) return 0;
    return newsData.length;
  }

  /**
   * 提取关键事件
   */
  private extractKeyEvents(analysis: string): string[] {
    const events: string[] = [];
    
    // 查找关键事件描述
    const eventPatterns = [
      /重大[^。！？]*事件[^。！？]*/gi,
      /重要[^。！？]*消息[^。！？]*/gi,
      /关键[^。！？]*新闻[^。！？]*/gi
    ];

    eventPatterns.forEach(pattern => {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(analysis)) !== null) {
        if (match[0].length > 10) {
          events.push(match[0].trim());
        }
      }
    });

    return events.slice(0, 3); // 最多返回3个关键事件
  }

  /**
   * 提取影响评估
   */
  private extractImpactAssessment(analysis: string): string {
    // 查找影响评估相关的句子
    const sentences = analysis.split(/[。！？]/);
    const impactSentences = sentences.filter(sentence => 
      sentence.includes("影响") && (
        sentence.includes("短期") || 
        sentence.includes("中期") || 
        sentence.includes("长期") ||
        sentence.includes("股价")
      )
    );

    if (impactSentences.length > 0) {
      return impactSentences[0].trim();
    }

    return "影响评估需要更多信息";
  }
}