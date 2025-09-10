import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {BaseAgent} from '../base/base-agent';
import {LLMService} from '../services/llm.service';
import {AgentExecutionRecordService} from '../services/agent-execution-record.service';
import {AgentConfig, AgentContext, AgentResult, AgentType, TradingRecommendation} from '../interfaces/agent.interface';
import {BusinessLogger} from '../../common/utils/business-logger.util';

/**
 * 行业分析智能体
 * 专门负责分析股票所在行业的发展前景、政策环境、竞争格局等
 */
@Injectable()
export class IndustryAnalystAgent extends BaseAgent {
  private readonly businessLogger = new BusinessLogger(IndustryAnalystAgent.name);

  constructor(
    protected readonly llmService: LLMService,
    protected readonly configService: ConfigService,
    protected readonly executionRecordService?: AgentExecutionRecordService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "INDUSTRY_ANALYST_MODEL",
        configService.get<string>("LLM_DEFAULT_MODEL", "qwen-plus"),
      ),
      temperature: configService.get<number>(
        "INDUSTRY_ANALYST_TEMPERATURE", 
        0.6,
      ),
      maxTokens: configService.get<number>(
        "INDUSTRY_ANALYST_MAX_TOKENS",
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 3000),
      ),
      timeout: configService.get<number>(
        "INDUSTRY_ANALYST_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 120),
      ),
      retryCount: configService.get<number>(
        "INDUSTRY_ANALYST_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
      systemPrompt: `您是资深的行业分析师，专门负责股票所在行业的深度分析。您具备丰富的行业研究经验和政策解读能力，能够准确判断行业发展趋势和投资价值。

🎯 **核心职责**:
- **行业前景分析**: 深度分析行业的发展阶段、成长空间和未来趋势
- **政策环境解读**: 分析相关政策法规对行业发展的影响
- **竞争格局研究**: 评估行业内的竞争态势和集中度变化
- **风险因素识别**: 识别行业发展面临的潜在风险和挑战

📊 **分析框架**:
- **行业生命周期**: 判断行业所处的发展阶段（初创期/成长期/成熟期/衰退期）
- **市场规模**: 评估行业当前规模和未来增长潜力
- **政策影响**: 分析产业政策、监管环境的变化影响
- **技术趋势**: 评估技术创新对行业发展的推动作用
- **产业链分析**: 分析上下游产业链的协同发展情况

📋 **输出要求**:
- 行业前景评分（0-100分）
- 明确的行业投资建议（看好/中性/谨慎）
- 行业发展趋势预测（1-3年）
- 主要投资机会和风险点
- 政策环境影响评估

请用中文提供专业、深入的行业分析报告。`,
    };

    super(
      "行业分析智能体",
      AgentType.INDUSTRY_ANALYST,
      "专门负责股票所在行业的发展前景、政策环境、竞争格局分析",
      llmService,
      undefined,
      config,
      executionRecordService,
    );
  }

  /**
   * 准备上下文 - 验证和准备行业分析所需的上下文数据
   */
  protected async prepareContext(context: AgentContext): Promise<AgentContext> {
    const analysisData = context.metadata?.analysisData;
    
    if (!analysisData?.basicInfo) {
      throw new Error('行业分析需要基础信息数据');
    }

    return {
      ...context,
      metadata: {
        ...context.metadata,
        analysisData: {
          ...analysisData,
          analysisType: 'industry_analysis'
        }
      }
    };
  }

  /**
   * 执行行业分析 - 调用LLM进行分析
   */
  protected async executeAnalysis(context: AgentContext): Promise<string> {
    // 构建行业分析提示词
    const analysisPrompt = this.buildIndustryAnalysisPrompt(context);

    // 调用LLM进行行业分析
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
      score: this.extractIndustryScore(analysis),
      recommendation: this.extractIndustryRecommendation(analysis),
      confidence: this.calculateIndustryConfidence(analysis),
      keyInsights: this.extractIndustryInsights(analysis),
      risks: this.identifyIndustryRisks(analysis),
      supportingData: {
        analysisType: 'industry_analysis',
        basicInfo: analysisData?.basicInfo,
        marketOverview: analysisData?.marketOverview,
        policyAnalysis: analysisData?.policyAnalysis,
        industryTrend: this.extractIndustryTrend(analysis),
        policyImpact: this.extractPolicyImpact(analysis),
        competitionStatus: this.extractCompetitionStatus(analysis),
      },
      timestamp: new Date(),
    };
  }

  /**
   * 实现抽象方法：构建分析提示词
   */
  protected async buildPrompt(context: AgentContext): Promise<string> {
    return `请对股票 ${context.stockCode} 所在行业进行分析。`;
  }

  /**
   * 构建行业分析提示词
   */
  private buildIndustryAnalysisPrompt(context: AgentContext): string {
    const { stockCode, stockName } = context;
    const analysisData = context.metadata?.analysisData;
    
    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += `（${stockName}）`;
    }
    prompt += ` 所在行业进行深度分析。\n\n`;

    // 添加基础信息
    if (analysisData?.basicInfo) {
      prompt += `**公司基础信息**:\n`;
      prompt += `- 所属行业: ${analysisData.basicInfo.industry || '未知'}\n`;
      prompt += `- 主营业务: ${analysisData.basicInfo.mainBusiness || '未知'}\n`;
      prompt += `- 公司简介: ${analysisData.basicInfo.companyProfile || '未知'}\n\n`;
    }

    // 添加市场概况
    if (analysisData?.marketOverview) {
      prompt += `**市场概况**:\n${JSON.stringify(analysisData.marketOverview, null, 2)}\n\n`;
    }

    // 添加政策分析
    if (analysisData?.policyAnalysis) {
      prompt += `**政策环境**:\n${JSON.stringify(analysisData.policyAnalysis, null, 2)}\n\n`;
    }

    // 添加其他智能体的分析结果作为参考
    if (context.previousResults && context.previousResults.length > 0) {
      prompt += `**参考信息**:\n`;
      context.previousResults.forEach((result, index) => {
        prompt += `${index + 1}. ${result.agentName}: ${result.analysis.substring(0, 200)}...\n`;
      });
      prompt += `\n`;
    }

    prompt += `请基于以上数据进行行业深度分析，重点包含以下内容：

## 🔍 行业分析框架

### 📊 行业基本情况
**行业定位**: 该行业在国民经济中的地位和作用
**生命周期**: 判断行业所处的发展阶段和特征
**市场规模**: 当前市场规模和增长速度分析

### 🏛️ 政策环境分析
**产业政策**: 相关支持政策和监管要求
**政策影响**: 政策变化对行业发展的正面/负面影响
**法规环境**: 行业准入条件和技术标准

### 📈 发展趋势预测
**短期趋势**: 未来1-2年的行业发展方向
**长期趋势**: 未来3-5年的行业变革预期
**技术驱动**: 技术创新对行业发展的影响

### 🎯 投资价值评估
**投资机会**: 行业内的主要投资机会点
**风险因素**: 行业发展面临的主要风险
**竞争格局**: 行业内的竞争态势和集中度

### 📋 分析总结
**行业前景评分**: 0-100分
**投资建议**: 看好/中性/谨慎
**核心观点**: 对行业投资价值的核心判断

请提供专业、深入的行业分析报告。`;

    return prompt;
  }

  /**
   * 提取行业评分
   */
  private extractIndustryScore(analysis: string): number {
    // 尝试从分析中提取行业评分
    const scorePatterns = [
      /行业评分[：:]?\s*(\d+(?:\.\d+)?)/i,
      /行业前景评分[：:]?\s*(\d+(?:\.\d+)?)/i,
      /行业得分[：:]?\s*(\d+(?:\.\d+)?)/i,
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
    if (lowerAnalysis.includes("高增长") || lowerAnalysis.includes("快速成长")) score += 20;
    if (lowerAnalysis.includes("政策支持") || lowerAnalysis.includes("产业扶持")) score += 15;
    if (lowerAnalysis.includes("技术领先") || lowerAnalysis.includes("创新驱动")) score += 15;
    if (lowerAnalysis.includes("市场空间大") || lowerAnalysis.includes("需求旺盛")) score += 10;

    // 消极信号
    if (lowerAnalysis.includes("产能过剩") || lowerAnalysis.includes("供过于求")) score -= 20;
    if (lowerAnalysis.includes("政策限制") || lowerAnalysis.includes("监管收紧")) score -= 15;
    if (lowerAnalysis.includes("竞争激烈") || lowerAnalysis.includes("同质化严重")) score -= 10;
    if (lowerAnalysis.includes("技术落后") || lowerAnalysis.includes("转型升级")) score -= 10;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * 提取行业投资建议
   */
  private extractIndustryRecommendation(analysis: string): TradingRecommendation {
    const lowerAnalysis = analysis.toLowerCase();

    // 强烈信号
    if (lowerAnalysis.includes("强烈看好") || lowerAnalysis.includes("高度推荐")) {
      return TradingRecommendation.STRONG_BUY;
    }
    if (lowerAnalysis.includes("谨慎回避") || lowerAnalysis.includes("不看好")) {
      return TradingRecommendation.STRONG_SELL;
    }

    // 一般信号
    if (lowerAnalysis.includes("看好") || lowerAnalysis.includes("推荐")) {
      return TradingRecommendation.BUY;
    }
    if (lowerAnalysis.includes("谨慎") || lowerAnalysis.includes("风险较大")) {
      return TradingRecommendation.SELL;
    }

    return TradingRecommendation.HOLD; // 默认中性
  }

  /**
   * 计算行业分析置信度
   */
  private calculateIndustryConfidence(analysis: string): number {
    let confidence = 0.6; // 基础置信度

    // 基于分析内容的质量评估置信度
    const qualityKeywords = ["政策", "市场", "技术", "竞争", "趋势", "风险"];
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
   * 提取行业洞察
   */
  private extractIndustryInsights(analysis: string): string[] {
    const insights: string[] = [];
    
    const industryKeywords = [
      "政策", "市场", "技术", "竞争", "趋势", "风险", "机会", "挑战"
    ];

    const sentences = analysis.split(/[。！？]/);
    sentences.forEach(sentence => {
      industryKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 15) {
          insights.push(sentence.trim());
        }
      });
    });

    return insights.slice(0, 6);
  }

  /**
   * 识别行业风险
   */
  private identifyIndustryRisks(analysis: string): string[] {
    const risks: string[] = [];
    
    const riskKeywords = ["风险", "挑战", "压力", "威胁", "不确定性", "限制"];
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
   * 提取行业趋势
   */
  private extractIndustryTrend(analysis: string): string {
    const trendKeywords = ["上升趋势", "下降趋势", "稳定增长", "快速发展", "转型升级"];
    
    for (const keyword of trendKeywords) {
      if (analysis.includes(keyword)) {
        const sentences = analysis.split(/[。！？]/);
        for (const sentence of sentences) {
          if (sentence.includes(keyword)) {
            return sentence.trim();
          }
        }
      }
    }
    
    return "行业趋势判断不明确";
  }

  /**
   * 提取政策影响
   */
  private extractPolicyImpact(analysis: string): string {
    const policyKeywords = ["政策影响", "政策支持", "政策限制", "监管", "法规"];
    
    for (const keyword of policyKeywords) {
      if (analysis.includes(keyword)) {
        const sentences = analysis.split(/[。！？]/);
        for (const sentence of sentences) {
          if (sentence.includes(keyword)) {
            return sentence.trim();
          }
        }
      }
    }
    
    return "政策影响评估不明确";
  }

  /**
   * 提取竞争状况
   */
  private extractCompetitionStatus(analysis: string): string {
    const competitionKeywords = ["竞争格局", "市场竞争", "集中度", "同质化", "差异化"];
    
    for (const keyword of competitionKeywords) {
      if (analysis.includes(keyword)) {
        const sentences = analysis.split(/[。！？]/);
        for (const sentence of sentences) {
          if (sentence.includes(keyword)) {
            return sentence.trim();
          }
        }
      }
    }
    
    return "竞争状况分析不明确";
  }
}