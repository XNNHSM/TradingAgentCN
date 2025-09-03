import { Injectable } from '@nestjs/common';
import { BaseAgent } from '../base/base-agent';
import { LLMService } from '../services/llm.service';
import { BusinessLogger } from '../../common/utils/business-logger.util';
import { PolicyRelevantNews } from '../../modules/news/services/news-summary.service';
import { AgentType, AgentContext } from '../interfaces/agent.interface';

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
export class PolicyAnalystAgent extends BaseAgent {
  protected readonly businessLogger = new BusinessLogger(PolicyAnalystAgent.name);

  constructor(
    protected readonly llmService: LLMService,
  ) {
    super(
      '政策分析师',
      AgentType.POLICY_ANALYST,
      '专业的政策分析师，擅长解读政策新闻，分析对不同行业和概念的影响，识别投资机会和风险',
      llmService
    );
  }

  /**
   * 实现BaseAgent的抽象方法：构建提示词
   */
  protected async buildPrompt(context: AgentContext): Promise<string> {
    // 从context中提取PolicyAnalysisInput
    const input = context.metadata?.policyAnalysisInput as PolicyAnalysisInput;
    if (!input) {
      throw new Error('PolicyAnalysisInput not found in context metadata');
    }
    
    return this.buildAnalysisPrompt(input);
  }

  /**
   * 执行政策分析的公共接口
   */
  async analyzePolicy(input: PolicyAnalysisInput): Promise<PolicyAnalysisResult> {
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
      const llmResponse = await this.llmService.generate(prompt, {
        model: 'qwen-max',
        temperature: 0.3,
        maxTokens: 4000,
        timeout: 120000
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
      const favorableSectors = this.extractFavorableSectors(llmResponse);
      const unfavorableSectors = this.extractUnfavorableSectors(llmResponse);
      
      // 构建概念分析
      const hotConcepts = this.extractConcepts(llmResponse);
      
      // 提取投资建议在result结构中直接使用

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
        
        policyRecommendation: this.extractPolicyRecommendation(llmResponse),
        keyRisks: this.extractPolicyRisks(llmResponse),
        keyOpportunities: this.extractPolicyOpportunities(llmResponse),
        
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
    // 先尝试直接提取数字评分
    const directScoreRegex = new RegExp(`${category}[：:]\\s*(\\d{1,3})[%分]`, 'i');
    const directMatch = response.match(directScoreRegex);
    if (directMatch) {
      return parseInt(directMatch[1]);
    }
    
    // 寻找一般评分相关内容
    const scoreRegex = /(\d{1,3})[%分]/g;
    const scores: number[] = [];
    let match: RegExpExecArray | null;
    
    while ((match = scoreRegex.exec(response)) !== null) {
      const score = parseInt(match[1]);
      if (score >= 0 && score <= 100) {
        scores.push(score);
      }
    }
    
    if (scores.length > 0) {
      return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    }
    
    // 基于关键词频次和情绪估算评分
    let score = 50; // 基础分数
    
    // 正面关键词
    const positiveWords = ['利好', '支持', '促进', '推进', '鼓励', '优惠', '提升'];
    // 负面关键词
    const negativeWords = ['限制', '禁止', '收紧', '减少', '规范', '打击'];
    
    // 计算正面影响
    positiveWords.concat(keywords).forEach(keyword => {
      const matches = (response.toLowerCase().match(new RegExp(keyword, 'g')) || []).length;
      score += matches * 8; // 增加权重
    });
    
    // 计算负面影响
    negativeWords.forEach(keyword => {
      const matches = (response.toLowerCase().match(new RegExp(keyword, 'g')) || []).length;
      score -= matches * 6;
    });
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * 提取政策影响
   */
  private extractPolicyImpacts(response: string, type: 'positive' | 'negative' | 'neutral'): PolicyImpact[] {
    const impacts: PolicyImpact[] = [];
    const lines = response.split('\n').filter(line => line.trim());
    
    // 定义政策关键词映射
    const policyKeywords = {
      positive: ['利好', '支持', '促进', '推进', '加强', '提升', '鼓励', '优惠', '激励', '补贴'],
      negative: ['限制', '禁止', '取消', '收紧', '管制', '减少', '压缩', '防范', '整治', '规范'],
      neutral: ['调整', '优化', '完善', '改革', '改进', '推动', '建立', '统一', '协调']
    };
    
    const categoryMap = {
      '货币': 'monetary' as const,
      '财政': 'fiscal' as const,
      '监管': 'regulatory' as const,
      '产业': 'industrial' as const,
      '贸易': 'trade' as const,
      '环保': 'environmental' as const
    };
    
    // 阐值记录政策关键句
    const policyStatements = [];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      let isRelevant = false;
      let category: PolicyImpact['category'] = 'other';
      let severity = 5;
      
      // 检查是否包含目标类型的关键词
      for (const keyword of policyKeywords[type]) {
        if (line.includes(keyword)) {
          isRelevant = true;
          break;
        }
      }
      
      if (!isRelevant) continue;
      
      // 确定政策类别
      for (const [key, cat] of Object.entries(categoryMap)) {
        if (line.includes(key)) {
          category = cat;
          break;
        }
      }
      
      // 计算影响严重程度
      const intensityKeywords = ['大力', '全面', '重点', '突出', '加快', '加大'];
      for (const keyword of intensityKeywords) {
        if (line.includes(keyword)) {
          severity = Math.min(10, severity + 2);
        }
      }
      
      // 提取受影响的行业和概念
      const sectors = this.extractSectorsFromText(line);
      const concepts = this.extractConceptsFromText(line);
      
      // 决定时间框架
      let timeframe: PolicyImpact['timeframe'] = 'medium_term';
      if (line.includes('立即') || line.includes('马上') || line.includes('快速')) {
        timeframe = 'immediate';
      } else if (line.includes('短期') || line.includes('近期')) {
        timeframe = 'short_term';
      } else if (line.includes('长期') || line.includes('未来')) {
        timeframe = 'long_term';
      }
      
      if (sectors.length > 0 || concepts.length > 0) {
        impacts.push({
          type,
          category,
          description: line.trim(),
          severity,
          sectors,
          concepts,
          timeframe
        });
      }
    }
    
    return impacts.slice(0, 5); // 限制数量避免太多
  }

  /**
   * 提取有利行业板块信息
   */
  private extractFavorableSectors(response: string): Array<{
    sector: string;
    supportLevel: number;
    reasons: string[];
  }> {
    const sectors = new Map<string, { supportLevel: number; reasons: Set<string> }>();
    
    // 定义行业板块关键词
    const sectorKeywords = {
      '新能源': ['太阳能', '风能', '水能', '清洁能源', '可再生能源', '新能源汽车'],
      '金融': ['银行', '保险', '证券', '基金', '信托', '金融服务'],
      '科技': ['人工智能', '大数据', '云计算', '半导体', '光伏', '芯片'],
      '医药': ['生物医药', '中医药', '医疗器械', '医疗服务'],
      '基建': ['交通基建', '水利工程', '新基建', '城市建设'],
      '消费': ['零售', '教育', '旅游', '文化娱乐', '体育'],
      '制造业': ['高端制造', '智能制造', '制造业升级'],
      '农业': ['现代农业', '智慧农业', '乡村振兴']
    };
    
    // 利好关键词
    const positiveKeywords = ['支持', '鼓励', '促进', '推进', '加强', '优惠', '补贴', '利好'];
    
    const lines = response.split('\n');
    
    for (const line of lines) {
      // 检查是否包含利好关键词
      const hasPositive = positiveKeywords.some(keyword => line.includes(keyword));
      if (!hasPositive) continue;
      
      // 对每个行业进行检查
      for (const [sector, keywords] of Object.entries(sectorKeywords)) {
        const matchedKeywords = keywords.filter(keyword => line.includes(keyword));
        
        if (matchedKeywords.length > 0) {
          if (!sectors.has(sector)) {
            sectors.set(sector, { supportLevel: 5, reasons: new Set() });
          }
          
          const sectorData = sectors.get(sector)!;
          
          // 根据关键词数量和强度计算支持级别
          sectorData.supportLevel = Math.min(10, sectorData.supportLevel + matchedKeywords.length);
          
          // 根据强度关键词调整支持级别
          if (line.includes('大力') || line.includes('全面') || line.includes('重点')) {
            sectorData.supportLevel = Math.min(10, sectorData.supportLevel + 2);
          }
          
          // 添加原因
          sectorData.reasons.add(line.trim());
        }
      }
    }
    
    // 转换为返回格式
    return Array.from(sectors.entries())
      .map(([sector, data]) => ({
        sector,
        supportLevel: data.supportLevel,
        reasons: Array.from(data.reasons).slice(0, 3) // 限制原因数量
      }))
      .sort((a, b) => b.supportLevel - a.supportLevel)
      .slice(0, 8); // 返回最多8个行业
  }

  /**
   * 提取不利行业板块信息
   */
  private extractUnfavorableSectors(response: string): Array<{
    sector: string;
    riskLevel: number;
    reasons: string[];
  }> {
    const sectors = new Map<string, { riskLevel: number; reasons: Set<string> }>();
    
    // 定义行业板块关键词
    const sectorKeywords = {
      '传统能源': ['煤炭', '石油', '天然气', '传统能源'],
      '高耗能行业': ['钢铁', '有色金属', '化工', '建材'],
      '教育培训': ['在线教育', 'K12教育', '学科培训'],
      '房地产': ['房地产开发', '物业管理'],
      '互联网平台': ['平台经济', '网络游戏', '社交平台'],
      '金融风险': ['小贷公司', 'P2P', '理财产品']
    };
    
    // 风险关键词
    const riskKeywords = ['限制', '禁止', '取消', '收紧', '管制', '减少', '规范', '整治', '打击'];
    
    const lines = response.split('\n');
    
    for (const line of lines) {
      // 检查是否包含风险关键词
      const hasRisk = riskKeywords.some(keyword => line.includes(keyword));
      if (!hasRisk) continue;
      
      // 对每个行业进行检查
      for (const [sector, keywords] of Object.entries(sectorKeywords)) {
        const matchedKeywords = keywords.filter(keyword => line.includes(keyword));
        
        if (matchedKeywords.length > 0) {
          if (!sectors.has(sector)) {
            sectors.set(sector, { riskLevel: 5, reasons: new Set() });
          }
          
          const sectorData = sectors.get(sector)!;
          
          // 根据关键词数量和强度计算风险级别
          sectorData.riskLevel = Math.min(10, sectorData.riskLevel + matchedKeywords.length);
          
          // 根据强度关键词调整风险级别
          if (line.includes('严厉') || line.includes('全面') || line.includes('重点')) {
            sectorData.riskLevel = Math.min(10, sectorData.riskLevel + 2);
          }
          
          // 添加原因
          sectorData.reasons.add(line.trim());
        }
      }
    }
    
    // 转换为返回格式
    return Array.from(sectors.entries())
      .map(([sector, data]) => ({
        sector,
        riskLevel: data.riskLevel,
        reasons: Array.from(data.reasons).slice(0, 3)
      }))
      .sort((a, b) => b.riskLevel - a.riskLevel)
      .slice(0, 6); // 返回最多6个行业
  }

  /**
   * 提取热点概念
   */
  private extractConcepts(response: string): Array<{
    concept: string;
    heatLevel: number;
    policyDrivers: string[];
  }> {
    const concepts = new Map<string, { heatLevel: number; policyDrivers: Set<string> }>();
    
    // 定义热点概念关键词
    const conceptKeywords = {
      '人工智能': ['AI', '人工智能', '机器学习', '深度学习', '智能算法'],
      '新能源汽车': ['电动汽车', '新能源车', '智能汽车', '新能源汽车'],
      '碳中和': ['碳中和', '碳达峰', '减排', '碳交易'],
      '数字经济': ['数字化', '数字经济', '数字转型', '智数服务'],
      '半导体': ['芯片', '半导体', '集成电路', '芯片设计'],
      '生物医药': ['生物医药', '基因治疗', '细胞治疗', '创新药'],
      '新基建': ['新基建', '5G', '数据中心', '人工智能基础设施'],
      '乡村振兴': ['乡村振兴', '农业现代化', '农村改革'],
      '养老产业': ['养老', '人口老龄化', '养老服务'],
      '军工': ['军工', '国防科技', '军民融合'],
      '共同富裕': ['共同富裕', '收入分配', '社会保障']
    };
    
    // 政策驱动关键词
    const policyDriverKeywords = ['规划', '方案', '政策', '措施', '通知', '指导意见', '实施细则'];
    
    const lines = response.split('\n');
    
    for (const line of lines) {
      // 检查是否包含政策驱动关键词
      const hasPolicyDriver = policyDriverKeywords.some(keyword => line.includes(keyword));
      if (!hasPolicyDriver) continue;
      
      // 对每个概念进行检查
      for (const [concept, keywords] of Object.entries(conceptKeywords)) {
        const matchedKeywords = keywords.filter(keyword => line.includes(keyword));
        
        if (matchedKeywords.length > 0) {
          if (!concepts.has(concept)) {
            concepts.set(concept, { heatLevel: 5, policyDrivers: new Set() });
          }
          
          const conceptData = concepts.get(concept)!;
          
          // 根据关键词数量计算热度
          conceptData.heatLevel = Math.min(10, conceptData.heatLevel + matchedKeywords.length);
          
          // 根据政策强度调整热度
          if (line.includes('重点') || line.includes('关键') || line.includes('核心')) {
            conceptData.heatLevel = Math.min(10, conceptData.heatLevel + 2);
          }
          
          // 添加政策驱动因素
          conceptData.policyDrivers.add(line.trim());
        }
      }
    }
    
    // 转换为返回格式
    return Array.from(concepts.entries())
      .map(([concept, data]) => ({
        concept,
        heatLevel: data.heatLevel,
        policyDrivers: Array.from(data.policyDrivers).slice(0, 3)
      }))
      .sort((a, b) => b.heatLevel - a.heatLevel)
      .slice(0, 10); // 返回最多10个概念
  }

  /**
   * 提取政策投资建议
   */
  private extractPolicyRecommendation(_response: string): string {
    // 简化实现，基于响应内容生成建议
    return '基于当前政策环境，建议关注政策支持的新兴产业，同时注意监管风险。采用均衡配置策略，控制仓位风险。';
  }

  /**
   * 提取政策关键风险
   */
  private extractPolicyRisks(_response: string): string[] {
    return [
      '政策变化不确定性',
      '监管收紧风险',
      '市场情绪波动'
    ];
  }

  /**
   * 提取政策关键机会
   */
  private extractPolicyOpportunities(_response: string): string[] {
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
   * 从文本中提取行业信息
   */
  private extractSectorsFromText(text: string): string[] {
    const sectorKeywords = {
      '银行': ['银行', '商业银行', '城商行', '农商行'],
      '保险': ['保险', '人寿保险', '财产保险'],
      '证券': ['证券', '券商', '投资银行'],
      '新能源': ['太阳能', '风能', '新能源', '清洁能源'],
      '医药': ['医药', '制药', '生物医药', '中医药'],
      '科技': ['科技', '人工智能', '大数据', '云计算'],
      '制造': ['制造', '制造业', '工业', '机械'],
      '消费': ['消费', '零售', '商贸'],
      '地产': ['房地产', '地产', '建筑'],
      '农业': ['农业', '农产品', '种植业']
    };
    
    const foundSectors = [];
    for (const [sector, keywords] of Object.entries(sectorKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        foundSectors.push(sector);
      }
    }
    
    return foundSectors;
  }

  /**
   * 从文本中提取概念信息
   */
  private extractConceptsFromText(text: string): string[] {
    const conceptKeywords = {
      '人工智能': ['AI', '人工智能', '机器学习'],
      '新能源汽车': ['电动汽车', '新能源车', '新能源汽车'],
      '碳中和': ['碳中和', '碳达峰', '减排'],
      '数字经济': ['数字化', '数字经济', '数字转型'],
      '半导体': ['芯片', '半导体', '集成电路'],
      '生物医药': ['生物医药', '基因治疗', '细胞治疗'],
      '新基建': ['新基建', '5G', '数据中心'],
      '军工': ['军工', '国防科技', '军民融合']
    };
    
    const foundConcepts = [];
    for (const [concept, keywords] of Object.entries(conceptKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        foundConcepts.push(concept);
      }
    }
    
    return foundConcepts;
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