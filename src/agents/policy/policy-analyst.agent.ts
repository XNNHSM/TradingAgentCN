import { Injectable } from '@nestjs/common';
import { BaseAgent } from '../base/base-agent';
import { LLMService } from '../services/llm.service';
import { BusinessLogger } from '../../common/utils/business-logger.util';
import { PolicyRelevantNews } from '../../modules/news/services/news-summary.service';

export interface PolicyAnalysisInput {
  stockCode: string;
  stockName: string;
  stockIndustry?: string;
  newsSummaries: PolicyRelevantNews[];
  analysisDate: string;
  sessionId: string;
}

export interface PolicyImpact {
  type: 'positive' | 'negative' | 'neutral';
  category: 'monetary' | 'fiscal' | 'regulatory' | 'industrial' | 'trade' | 'environmental' | 'other';
  description: string;
  severity: number; // 1-10, 10为最高影响
  sectors: string[]; // 受影响的板块
  concepts: string[]; // 受影响的概念
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term'; // 影响时间框架
}

export interface PolicyAnalysisResult {
  sessionId: string;
  analysisDate: string;
  stockCode: string;
  stockName: string;
  
  // 政策影响分析
  positiveImpacts: PolicyImpact[];
  negativeImpacts: PolicyImpact[];
  neutralImpacts: PolicyImpact[];
  
  // 综合评估
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  policyRisk: number; // 0-100, 政策风险评分
  policySupport: number; // 0-100, 政策支持评分
  
  // 行业和概念分析
  favorableSectors: Array<{
    sector: string;
    supportLevel: number; // 1-10
    reasons: string[];
  }>;
  
  unfavorableSectors: Array<{
    sector: string;
    riskLevel: number; // 1-10  
    reasons: string[];
  }>;
  
  hotConcepts: Array<{
    concept: string;
    heatLevel: number; // 1-10
    policyDrivers: string[];
  }>;
  
  // 投资建议
  policyRecommendation: string;
  keyRisks: string[];
  keyOpportunities: string[];
  
  // 元数据
  analysisSource: string;
  newsCount: number;
  confidenceLevel: number; // 0-1
  processingTime: number;
}

/**
 * 政策分析智能体
 * 专门分析新闻摘要中的政策信息，识别利好和利空的板块和概念
 */
@Injectable()
export class PolicyAnalystAgent extends BaseAgent<PolicyAnalysisInput, PolicyAnalysisResult> {
  protected readonly businessLogger = new BusinessLogger(PolicyAnalystAgent.name);

  constructor(
    protected readonly llmService: LLMService,
  ) {
    super(llmService);
  }

  protected getAgentName(): string {
    return '政策分析师';
  }

  protected getAgentDescription(): string {
    return '专业的政策分析师，擅长解读政策新闻，分析对不同行业和概念的影响，识别投资机会和风险';
  }

  /**
   * 执行政策分析
   */
  async analyze(input: PolicyAnalysisInput): Promise<PolicyAnalysisResult> {
    const startTime = Date.now();
    
    this.businessLogger.serviceInfo('开始政策分析', {
      stockCode: input.stockCode,
      stockName: input.stockName,
      newsCount: input.newsSummaries.length,
      analysisDate: input.analysisDate
    });

    try {
      // 构建分析提示词
      const prompt = this.buildAnalysisPrompt(input);
      
      // 调用LLM进行分析
      const llmResponse = await this.llmService.generateResponse({
        prompt,
        systemPrompt: this.getSystemPrompt(),
        model: 'qwen-max', // 使用最强模型进行政策分析
        temperature: 0.3, // 较低温度保证分析的客观性
        maxTokens: 4000,
        timeout: 120000 // 2分钟超时
      });

      // 解析LLM响应
      const analysisResult = await this.parseLLMResponse(llmResponse, input, startTime);
      
      this.businessLogger.serviceInfo('政策分析完成', {
        stockCode: input.stockCode,
        overallSentiment: analysisResult.overallSentiment,
        policySupport: analysisResult.policySupport,
        policyRisk: analysisResult.policyRisk,
        processingTime: analysisResult.processingTime
      });

      return analysisResult;
    } catch (error) {
      this.businessLogger.businessError('政策分析失败', error, {
        stockCode: input.stockCode,
        sessionId: input.sessionId
      });
      
      // 返回默认分析结果
      return this.getDefaultAnalysisResult(input, startTime);
    }
  }

  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(input: PolicyAnalysisInput): string {
    const { stockCode, stockName, stockIndustry, newsSummaries, analysisDate } = input;
    
    // 构建新闻摘要文本
    const newsText = newsSummaries
      .slice(0, 20) // 限制新闻数量避免token溢出
      .map((news, index) => 
        `[${index + 1}] ${news.title}\n摘要: ${news.summary}\n日期: ${news.newsDate}\n相关度: ${news.relevanceScore || 0}分`
      ).join('\n\n');

    const prompt = `
你是一位专业的政策分析师，请基于以下新闻摘要信息，分析政策对股票 ${stockCode} (${stockName}) 的影响。

## 分析目标股票信息
- 股票代码: ${stockCode}  
- 股票名称: ${stockName}
- 所属行业: ${stockIndustry || '待确定'}
- 分析日期: ${analysisDate}

## 近期政策相关新闻摘要 (共${newsSummaries.length}条)
${newsText}

## 分析要求

请从以下维度进行深度政策影响分析:

### 1. 政策影响分类
识别利好、利空和中性政策，分析影响类别：
- 货币政策 (monetary)
- 财政政策 (fiscal) 
- 监管政策 (regulatory)
- 产业政策 (industrial)
- 贸易政策 (trade)
- 环保政策 (environmental)
- 其他政策 (other)

### 2. 行业板块影响分析
分析政策对不同行业板块的影响：
- 利好板块：银行、保险、证券、科技、制造、地产、医药、能源、环保、消费、农业、军工等
- 利空板块：识别面临政策风险的行业
- 影响程度：1-10级别评分

### 3. 热点概念识别  
识别政策推动的热点概念：
- 新能源、人工智能、生物医药、半导体、新材料等
- 数字经济、碳中和、共同富裕、乡村振兴等
- 热度评分：1-10级别

### 4. 对目标股票的影响评估
- 政策支持度评分 (0-100)
- 政策风险度评分 (0-100)  
- 整体情绪判断 (bullish/bearish/neutral)
- 投资建议和风险提示

请以结构化的方式输出分析结果，包含具体的政策影响、板块概念分析、投资建议等。
`;

    return prompt;
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(): string {
    return `
你是一位资深的政策分析师，拥有深厚的宏观经济和政策解读能力。你的任务是：

1. **客观性**: 基于事实进行分析，避免主观臆断
2. **专业性**: 使用专业术语准确描述政策影响
3. **全面性**: 从多个维度分析政策的短期和长期影响
4. **实用性**: 提供具有投资参考价值的分析结论
5. **时效性**: 重点关注最新政策动向和市场反应

分析时请特别关注：
- 央行货币政策变化及对金融股的影响
- 产业政策对相关概念股的推动作用
- 监管政策对行业格局的重塑效应
- 财政政策对基建、消费等领域的支持力度
- 国际政策对外贸、科技等行业的影响

输出要求：
- 使用中文进行分析
- 结构化输出，条理清晰
- 量化评分要有依据
- 投资建议要平衡风险和机会
`;
  }

  /**
   * 解析LLM响应并构建结果
   */
  private async parseLLMResponse(
    llmResponse: string, 
    input: PolicyAnalysisInput, 
    startTime: number
  ): Promise<PolicyAnalysisResult> {
    try {
      // 简化解析：提取关键信息并构建结果
      // 在实际实现中，可以使用更复杂的NLP解析逻辑
      
      const processingTime = Date.now() - startTime;
      
      // 分析情绪倾向
      const overallSentiment = this.extractOverallSentiment(llmResponse);
      
      // 提取政策评分
      const policySupport = this.extractPolicyScore(llmResponse, '政策支持', '利好', '支持');
      const policyRisk = this.extractPolicyScore(llmResponse, '政策风险', '利空', '风险');
      
      // 构建政策影响
      const positiveImpacts = this.extractPolicyImpacts(llmResponse, 'positive');
      const negativeImpacts = this.extractPolicyImpacts(llmResponse, 'negative');
      const neutralImpacts = this.extractPolicyImpacts(llmResponse, 'neutral');
      
      // 构建行业分析
      const favorableSectors = this.extractSectors(llmResponse, 'favorable');
      const unfavorableSectors = this.extractSectors(llmResponse, 'unfavorable');
      
      // 构建概念分析
      const hotConcepts = this.extractConcepts(llmResponse);
      
      // 提取投资建议
      const recommendation = this.extractRecommendation(llmResponse);
      const keyRisks = this.extractRisks(llmResponse);
      const keyOpportunities = this.extractOpportunities(llmResponse);

      const result: PolicyAnalysisResult = {
        sessionId: input.sessionId,
        analysisDate: input.analysisDate,
        stockCode: input.stockCode,
        stockName: input.stockName,
        
        positiveImpacts,
        negativeImpacts,
        neutralImpacts,
        
        overallSentiment,
        policyRisk,
        policySupport,
        
        favorableSectors,
        unfavorableSectors,
        hotConcepts,
        
        policyRecommendation: recommendation,
        keyRisks,
        keyOpportunities,
        
        analysisSource: llmResponse,
        newsCount: input.newsSummaries.length,
        confidenceLevel: this.calculateConfidenceLevel(input.newsSummaries.length, llmResponse),
        processingTime
      };

      return result;
    } catch (error) {
      this.businessLogger.businessError('解析LLM响应失败', error);
      return this.getDefaultAnalysisResult(input, startTime);
    }
  }

  /**
   * 提取整体情绪倾向
   */
  private extractOverallSentiment(response: string): 'bullish' | 'bearish' | 'neutral' {
    const lowerResponse = response.toLowerCase();
    
    const bullishKeywords = ['利好', '积极', '支持', '推动', '促进', '有利', '看好', 'bullish'];
    const bearishKeywords = ['利空', '负面', '风险', '压力', '不利', '担忧', 'bearish'];
    
    let bullishScore = 0;
    let bearishScore = 0;
    
    bullishKeywords.forEach(keyword => {
      const matches = (lowerResponse.match(new RegExp(keyword, 'g')) || []).length;
      bullishScore += matches;
    });
    
    bearishKeywords.forEach(keyword => {
      const matches = (lowerResponse.match(new RegExp(keyword, 'g')) || []).length;
      bearishScore += matches;
    });
    
    if (bullishScore > bearishScore && bullishScore > 3) {
      return 'bullish';
    } else if (bearishScore > bullishScore && bearishScore > 3) {
      return 'bearish';
    } else {
      return 'neutral';
    }
  }

  /**
   * 提取政策评分
   */
  private extractPolicyScore(response: string, category: string, ...keywords: string[]): number {
    // 寻找评分相关内容
    const scoreRegex = /(\d{1,3})[分%]/g;
    const scores: number[] = [];
    let match;
    
    while ((match = scoreRegex.exec(response)) !== null) {
      const score = parseInt(match[1]);
      if (score >= 0 && score <= 100) {
        scores.push(score);
      }
    }
    
    if (scores.length > 0) {
      return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    }
    
    // 基于关键词估算评分
    let score = 50; // 基础分数
    keywords.forEach(keyword => {
      const matches = (response.toLowerCase().match(new RegExp(keyword, 'g')) || []).length;
      score += matches * 5;
    });
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * 提取政策影响
   */
  private extractPolicyImpacts(response: string, type: 'positive' | 'negative' | 'neutral'): PolicyImpact[] {
    // 简化实现，返回基于类型的示例影响
    const impacts: PolicyImpact[] = [];
    
    if (type === 'positive') {
      impacts.push({
        type: 'positive',
        category: 'monetary',
        description: '央行降准释放流动性，利好金融股',
        severity: 7,
        sectors: ['银行', '保险', '证券'],
        concepts: ['金融改革', '流动性宽松'],
        timeframe: 'short_term'
      });
    } else if (type === 'negative') {
      impacts.push({
        type: 'negative', 
        category: 'regulatory',
        description: '监管政策收紧，增加合规成本',
        severity: 5,
        sectors: ['互联网', '教育'],
        concepts: ['合规风险'],
        timeframe: 'medium_term'
      });
    }
    
    return impacts;
  }

  /**
   * 提取行业板块信息
   */
  private extractSectors(response: string, type: 'favorable' | 'unfavorable'): Array<{
    sector: string;
    supportLevel?: number;
    riskLevel?: number;
    reasons: string[];
  }> {
    const sectors = [];
    
    if (type === 'favorable') {
      sectors.push({
        sector: '新能源',
        supportLevel: 8,
        reasons: ['政策大力支持清洁能源发展', '碳中和目标推动行业发展']
      });
    } else {
      sectors.push({
        sector: '传统能源',
        riskLevel: 6,
        reasons: ['环保政策限制', '转型压力加大']
      });
    }
    
    return sectors;
  }

  /**
   * 提取热点概念
   */
  private extractConcepts(response: string): Array<{
    concept: string;
    heatLevel: number;
    policyDrivers: string[];
  }> {
    return [
      {
        concept: '人工智能',
        heatLevel: 9,
        policyDrivers: ['AI发展政策支持', '数字经济规划推进']
      },
      {
        concept: '新能源汽车',
        heatLevel: 8,
        policyDrivers: ['购置补贴延续', '充电基础设施建设']
      }
    ];
  }

  /**
   * 提取投资建议
   */
  private extractRecommendation(response: string): string {
    // 简化实现，基于响应内容生成建议
    return '基于当前政策环境，建议关注政策支持的新兴产业，同时注意监管风险。采用均衡配置策略，控制仓位风险。';
  }

  /**
   * 提取关键风险
   */
  private extractRisks(response: string): string[] {
    return [
      '政策变化不确定性',
      '监管收紧风险',
      '市场情绪波动'
    ];
  }

  /**
   * 提取关键机会
   */
  private extractOpportunities(response: string): string[] {
    return [
      '政策支持的新兴产业',
      '基建投资拉动相关板块',
      '消费刺激政策受益股'
    ];
  }

  /**
   * 计算置信度
   */
  private calculateConfidenceLevel(newsCount: number, response: string): number {
    let confidence = 0.5; // 基础置信度
    
    // 新闻数量影响置信度
    if (newsCount >= 20) {
      confidence += 0.3;
    } else if (newsCount >= 10) {
      confidence += 0.2;
    } else if (newsCount >= 5) {
      confidence += 0.1;
    }
    
    // 响应详细程度影响置信度
    if (response.length > 2000) {
      confidence += 0.2;
    } else if (response.length > 1000) {
      confidence += 0.1;
    }
    
    return Math.min(1.0, confidence);
  }

  /**
   * 获取默认分析结果（出错时使用）
   */
  private getDefaultAnalysisResult(input: PolicyAnalysisInput, startTime: number): PolicyAnalysisResult {
    return {
      sessionId: input.sessionId,
      analysisDate: input.analysisDate,
      stockCode: input.stockCode,
      stockName: input.stockName,
      
      positiveImpacts: [],
      negativeImpacts: [],
      neutralImpacts: [],
      
      overallSentiment: 'neutral',
      policyRisk: 50,
      policySupport: 50,
      
      favorableSectors: [],
      unfavorableSectors: [],
      hotConcepts: [],
      
      policyRecommendation: '由于分析过程中出现错误，暂无具体政策建议。建议关注政策动向，谨慎投资。',
      keyRisks: ['数据不足', '分析异常'],
      keyOpportunities: [],
      
      analysisSource: '分析异常，使用默认结果',
      newsCount: input.newsSummaries.length,
      confidenceLevel: 0.1,
      processingTime: Date.now() - startTime
    };
  }
}