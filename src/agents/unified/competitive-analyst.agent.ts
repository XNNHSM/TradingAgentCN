import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {BaseAgent} from '../base/base-agent';
import {LLMService} from '../services/llm.service';
import {AgentExecutionRecordService} from '../services/agent-execution-record.service';
import {AgentConfig, AgentContext, AgentResult, AgentType, TradingRecommendation} from '../interfaces/agent.interface';
import {BusinessLogger} from '../../common/utils/business-logger.util';

/**
 * 竞争分析智能体
 * 专门负责分析公司的竞争优势、市场地位、核心竞争力等
 */
@Injectable()
export class CompetitiveAnalystAgent extends BaseAgent {
  private readonly businessLogger = new BusinessLogger(CompetitiveAnalystAgent.name);

  constructor(
    protected readonly llmService: LLMService,
    protected readonly configService: ConfigService,
    protected readonly executionRecordService?: AgentExecutionRecordService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "COMPETITIVE_ANALYST_MODEL",
        configService.get<string>("LLM_DEFAULT_MODEL", "qwen-plus"),
      ),
      temperature: configService.get<number>(
        "COMPETITIVE_ANALYST_TEMPERATURE", 
        0.6,
      ),
      maxTokens: configService.get<number>(
        "COMPETITIVE_ANALYST_MAX_TOKENS",
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 3000),
      ),
      timeout: configService.get<number>(
        "COMPETITIVE_ANALYST_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 120),
      ),
      retryCount: configService.get<number>(
        "COMPETITIVE_ANALYST_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
      systemPrompt: `您是资深的竞争分析专家，专门负责评估企业的竞争优势和市场地位。您具备深厚的商业分析能力和行业洞察力，能够准确识别企业的核心竞争力。

🎯 **核心职责**:
- **竞争优势识别**: 深度分析企业的核心竞争力和可持续竞争优势
- **市场地位评估**: 评估企业在行业中的市场地位和影响力
- **竞争策略分析**: 分析企业的竞争策略和商业模式
- **护城河评估**: 评估企业的竞争护城河和可持续性

📊 **分析框架**:
- **SWOT分析**: 优势、劣势、机会、威胁的全面评估
- **波特五力**: 供应商议价能力、买方议价能力、新进入者威胁、替代品威胁、同业竞争
- **价值链分析**: 企业价值链各环节的竞争优势分析
- **财务表现**: 通过财务数据验证竞争优势的可持续性

📋 **输出要求**:
- 竞争优势评分（0-100分）
- 明确的竞争地位评估（领先/跟随/挑战）
- 核心竞争优势识别
- 主要竞争风险和挑战
- 竞争策略建议

请用中文提供专业、深入的竞争分析报告。`,
    };

    super(
      "竞争分析智能体",
      AgentType.COMPETITIVE_ANALYST,
      "专门负责公司的竞争优势、市场地位、核心竞争力分析",
      llmService,
      undefined,
      config,
      executionRecordService,
    );
  }

  /**
   * 准备上下文 - 验证和准备竞争分析所需的上下文数据
   */
  protected async prepareContext(context: AgentContext): Promise<AgentContext> {
    const analysisData = context.metadata?.analysisData;
    
    if (!analysisData?.basicInfo) {
      throw new Error('竞争分析需要基础信息数据');
    }

    return {
      ...context,
      metadata: {
        ...context.metadata,
        analysisData: {
          ...analysisData,
          analysisType: 'competitive_analysis'
        }
      }
    };
  }

  /**
   * 执行竞争分析 - 调用LLM进行分析
   */
  protected async executeAnalysis(context: AgentContext): Promise<string> {
    // 构建竞争分析提示词
    const analysisPrompt = this.buildCompetitiveAnalysisPrompt(context);

    // 调用LLM进行竞争分析
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
      score: this.extractCompetitiveScore(analysis),
      recommendation: this.extractCompetitiveRecommendation(analysis),
      confidence: this.calculateCompetitiveConfidence(analysis),
      keyInsights: this.extractCompetitiveInsights(analysis),
      risks: this.identifyCompetitiveRisks(analysis),
      supportingData: {
        analysisType: 'competitive_analysis',
        basicInfo: analysisData?.basicInfo,
        financialData: analysisData?.financialData,
        marketOverview: analysisData?.marketOverview,
        competitiveAdvantages: this.extractCompetitiveAdvantages(analysis),
        marketPosition: this.extractMarketPosition(analysis),
        swotAnalysis: this.extractSWOTAnalysis(analysis),
      },
      timestamp: new Date(),
    };
  }

  /**
   * 实现抽象方法：构建分析提示词
   */
  protected async buildPrompt(context: AgentContext): Promise<string> {
    return `请对股票 ${context.stockCode} 的竞争优势进行分析。`;
  }

  /**
   * 构建竞争分析提示词
   */
  private buildCompetitiveAnalysisPrompt(context: AgentContext): string {
    const { stockCode, stockName } = context;
    const analysisData = context.metadata?.analysisData;
    
    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += `（${stockName}）`;
    }
    prompt += ` 的竞争优势和市场地位进行深度分析。\n\n`;

    // 添加基础信息
    if (analysisData?.basicInfo) {
      prompt += `**公司基础信息**:\n`;
      prompt += `- 公司名称: ${analysisData.basicInfo.companyName || '未知'}\n`;
      prompt += `- 所属行业: ${analysisData.basicInfo.industry || '未知'}\n`;
      prompt += `- 主营业务: ${analysisData.basicInfo.mainBusiness || '未知'}\n`;
      prompt += `- 公司简介: ${analysisData.basicInfo.companyProfile || '未知'}\n\n`;
    }

    // 添加财务数据
    if (analysisData?.financialData) {
      prompt += `**财务表现**:\n`;
      if (analysisData.financialData.revenue) {
        prompt += `- 营收情况: ${JSON.stringify(analysisData.financialData.revenue)}\n`;
      }
      if (analysisData.financialData.profit) {
        prompt += `- 盈利情况: ${JSON.stringify(analysisData.financialData.profit)}\n`;
      }
      prompt += `\n`;
    }

    // 添加市场概况
    if (analysisData?.marketOverview) {
      prompt += `**市场环境**:\n${JSON.stringify(analysisData.marketOverview, null, 2)}\n\n`;
    }

    // 添加其他智能体的分析结果作为参考
    if (context.previousResults && context.previousResults.length > 0) {
      prompt += `**参考信息**:\n`;
      context.previousResults.forEach((result, index) => {
        prompt += `${index + 1}. ${result.agentName}: ${result.analysis.substring(0, 200)}...\n`;
      });
      prompt += `\n`;
    }

    prompt += `请基于以上数据进行竞争深度分析，重点包含以下内容：

## 🔍 竞争优势分析框架

### 📊 公司基本情况
**市场定位**: 公司在行业中的定位和目标市场
**业务模式**: 主要的商业模式和收入来源
**规模优势**: 公司规模效应和市场占有率

### 🏆 核心竞争优势
**技术壁垒**: 核心技术优势和技术研发能力
**品牌价值**: 品牌影响力和市场认可度
**成本优势**: 成本控制能力和规模效应
**渠道优势**: 销售渠道网络和客户资源
**管理团队**: 管理团队的经验和能力

### 📈 市场地位评估
**市场份额**: 在行业中的市场占有率
**竞争排名**: 相对于主要竞争对手的位置
**增长潜力**: 未来市场扩张的潜力
**行业影响力**: 对行业发展的影响力

### 🎯 SWOT分析
**优势(Strengths)**: 公司的主要优势点
**劣势(Weaknesses)**: 公司的主要劣势和不足
**机会(Opportunities)**: 面临的市场机会
**威胁(Threats)**: 面临的外部威胁和挑战

### 🛡️ 竞争护城河
**护城河类型**: 技术护城河、品牌护城河、成本护城河等
**护城河深度**: 竞争优势的可持续性
**护城河宽度**: 竞争优势的覆盖范围

### 📋 竞争策略建议
**竞争策略**: 建议的竞争策略方向
**风险防范**: 主要竞争风险的防范措施
**发展建议**: 提升竞争优势的建议

### 📊 分析总结
**竞争优势评分**: 0-100分
**竞争地位**: 领先者/跟随者/挑战者
**投资价值评估**: 基于竞争优势的投资价值判断

请提供专业、深入的竞争分析报告。`;

    return prompt;
  }

  /**
   * 提取竞争优势评分
   */
  private extractCompetitiveScore(analysis: string): number {
    // 尝试从分析中提取竞争优势评分
    const scorePatterns = [
      /竞争优势评分[：:]?\s*(\d+(?:\.\d+)?)/i,
      /竞争评分[：:]?\s*(\d+(?:\.\d+)?)/i,
      /竞争力得分[：:]?\s*(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of scorePatterns) {
      const match = analysis.match(pattern);
      if (match) {
        const score = parseFloat(match[1]);
        return Math.min(Math.max(score, 0), 100);
      }
    }

    // 基于关键词估算评分
    const lowerAnalysis = analysis.toLowerCase();
    let score = 50; // 基础分数

    // 积极信号
    if (lowerAnalysis.includes("领先") || lowerAnalysis.includes("龙头")) score += 20;
    if (lowerAnalysis.includes("技术壁垒") || lowerAnalysis.includes("专利")) score += 15;
    if (lowerAnalysis.includes("品牌优势") || lowerAnalysis.includes("知名度")) score += 15;
    if (lowerAnalysis.includes("市场份额高") || lowerAnalysis.includes("市场占有率高")) score += 10;
    if (lowerAnalysis.includes("管理团队优秀") || lowerAnalysis.includes("管理能力强")) score += 10;

    // 消极信号
    if (lowerAnalysis.includes("竞争激烈") || lowerAnalysis.includes("同质化")) score -= 15;
    if (lowerAnalysis.includes("技术落后") || lowerAnalysis.includes("创新不足")) score -= 15;
    if (lowerAnalysis.includes("成本劣势") || lowerAnalysis.includes("效率低下")) score -= 10;
    if (lowerAnalysis.includes("品牌影响力弱") || lowerAnalysis.includes("知名度低")) score -= 10;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * 提取竞争投资建议
   */
  private extractCompetitiveRecommendation(analysis: string): TradingRecommendation {
    const lowerAnalysis = analysis.toLowerCase();

    // 强烈信号
    if (lowerAnalysis.includes("强烈推荐") || lowerAnalysis.includes("竞争优势显著")) {
      return TradingRecommendation.STRONG_BUY;
    }
    if (lowerAnalysis.includes("竞争劣势明显") || lowerAnalysis.includes("谨慎回避")) {
      return TradingRecommendation.STRONG_SELL;
    }

    // 一般信号
    if (lowerAnalysis.includes("竞争优势") || lowerAnalysis.includes("推荐")) {
      return TradingRecommendation.BUY;
    }
    if (lowerAnalysis.includes("竞争压力") || lowerAnalysis.includes("风险较大")) {
      return TradingRecommendation.SELL;
    }

    return TradingRecommendation.HOLD; // 默认中性
  }

  /**
   * 计算竞争分析置信度
   */
  private calculateCompetitiveConfidence(analysis: string): number {
    let confidence = 0.6; // 基础置信度

    // 基于分析内容的质量评估置信度
    const qualityKeywords = ["竞争优势", "市场地位", "技术", "品牌", "管理", "财务"];
    const keywordCount = qualityKeywords.filter(keyword => 
      analysis.includes(keyword)
    ).length;
    confidence += keywordCount * 0.05;

    // 基于分析详细程度
    if (analysis.length > 1000) confidence += 0.1;
    if (analysis.length > 2000) confidence += 0.1;

    return Math.min(confidence, 0.9);
  }

  /**
   * 提取竞争洞察
   */
  private extractCompetitiveInsights(analysis: string): string[] {
    const insights: string[] = [];
    
    const competitiveKeywords = [
      "竞争优势", "市场地位", "技术壁垒", "品牌价值", "成本优势", "管理团队"
    ];

    const sentences = analysis.split(/[。！？]/);
    sentences.forEach(sentence => {
      competitiveKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 15) {
          insights.push(sentence.trim());
        }
      });
    });

    return insights.slice(0, 6);
  }

  /**
   * 识别竞争风险
   */
  private identifyCompetitiveRisks(analysis: string): string[] {
    const risks: string[] = [];
    
    const riskKeywords = ["竞争风险", "市场风险", "技术风险", "管理风险", "财务风险"];
    const sentences = analysis.split(/[。！？]/);
    
    sentences.forEach(sentence => {
      riskKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 10) {
          risks.push(sentence.trim());
        }
      });
    });

    return risks.slice(0, 4);
  }

  /**
   * 提取竞争优势
   */
  private extractCompetitiveAdvantages(analysis: string): string[] {
    const advantages: string[] = [];
    
    const advantageKeywords = ["优势", "领先", "壁垒", "专利", "品牌", "渠道"];
    const sentences = analysis.split(/[。！？]/);
    
    sentences.forEach(sentence => {
      advantageKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 10) {
          advantages.push(sentence.trim());
        }
      });
    });

    return advantages.slice(0, 5);
  }

  /**
   * 提取市场地位
   */
  private extractMarketPosition(analysis: string): string {
    const positionKeywords = ["市场地位", "市场份额", "竞争排名", "行业地位"];
    
    for (const keyword of positionKeywords) {
      if (analysis.includes(keyword)) {
        const sentences = analysis.split(/[。！？]/);
        for (const sentence of sentences) {
          if (sentence.includes(keyword)) {
            return sentence.trim();
          }
        }
      }
    }
    
    return "市场地位分析不明确";
  }

  /**
   * 提取SWOT分析
   */
  private extractSWOTAnalysis(analysis: string): any {
    const swot: any = {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: []
    };

    const sentences = analysis.split(/[。！？]/);
    
    sentences.forEach(sentence => {
      if (sentence.includes("优势") && sentence.trim().length > 10) {
        swot.strengths.push(sentence.trim());
      } else if (sentence.includes("劣势") && sentence.trim().length > 10) {
        swot.weaknesses.push(sentence.trim());
      } else if (sentence.includes("机会") && sentence.trim().length > 10) {
        swot.opportunities.push(sentence.trim());
      } else if (sentence.includes("威胁") && sentence.trim().length > 10) {
        swot.threats.push(sentence.trim());
      }
    });

    return swot;
  }
}