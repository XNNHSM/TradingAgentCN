import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {BaseAgent} from '../base/base-agent';
import {LLMService} from '../services/llm.service';
import {AgentExecutionRecordService} from '../services/agent-execution-record.service';
import {AgentConfig, AgentContext, AgentResult, AgentType, TradingRecommendation} from '../interfaces/agent.interface';
import {BusinessLogger} from '../../common/utils/business-logger.util';

/**
 * 估值分析智能体
 * 专门负责公司的估值水平分析，包括相对估值、绝对估值等
 */
@Injectable()
export class ValuationAnalystAgent extends BaseAgent {
  private readonly businessLogger = new BusinessLogger(ValuationAnalystAgent.name);

  constructor(
    protected readonly llmService: LLMService,
    protected readonly configService: ConfigService,
    protected readonly executionRecordService?: AgentExecutionRecordService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "VALUATION_ANALYST_MODEL",
        configService.get<string>("LLM_DEFAULT_MODEL", "qwen-plus"),
      ),
      temperature: configService.get<number>(
        "VALUATION_ANALYST_TEMPERATURE", 
        0.5,
      ),
      maxTokens: configService.get<number>(
        "VALUATION_ANALYST_MAX_TOKENS",
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 3000),
      ),
      timeout: configService.get<number>(
        "VALUATION_ANALYST_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 120),
      ),
      retryCount: configService.get<number>(
        "VALUATION_ANALYST_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
      systemPrompt: `您是资深的估值分析师，专门负责企业估值分析。您具备丰富的估值经验和财务分析能力，能够准确判断企业的投资价值。

🎯 **核心职责**:
- **相对估值分析**: 使用PE、PB、PS、PEG等相对估值方法进行分析
- **绝对估值分析**: 基于DCF模型的绝对估值计算
- **行业对比**: 与同行业公司进行估值水平对比
- **估值合理性**: 评估当前估值的合理性和投资价值

📊 **分析框架**:
- **相对估值法**: PE、PB、PS、EV/EBITDA等多维度相对估值
- **绝对估值法**: DCF现金流折现估值模型
- **成长性估值**: PEG成长性估值分析
- **行业估值**: 行业平均估值水平和历史估值区间

📋 **输出要求**:
- 估值合理性评分（0-100分）
- 明确的估值建议（低估/合理/高估）
- 具体的估值区间和目标价位
- 估值方法和依据说明
- 投资建议和风险提示

请用中文提供专业、深入的估值分析报告。`,
    };

    super(
      "估值分析智能体",
      AgentType.VALUATION_ANALYST,
      "专门负责公司的估值水平分析，包括相对估值、绝对估值等",
      llmService,
      undefined,
      config,
      executionRecordService,
    );
  }

  /**
   * 准备上下文 - 验证和准备估值分析所需的上下文数据
   */
  protected async prepareContext(context: AgentContext): Promise<AgentContext> {
    const analysisData = context.metadata?.analysisData;
    
    if (!analysisData?.basicInfo) {
      throw new Error('估值分析需要基础信息数据');
    }

    return {
      ...context,
      metadata: {
        ...context.metadata,
        analysisData: {
          ...analysisData,
          analysisType: 'valuation_analysis'
        }
      }
    };
  }

  /**
   * 执行估值分析 - 调用LLM进行分析
   */
  protected async executeAnalysis(context: AgentContext): Promise<string> {
    // 构建估值分析提示词
    const analysisPrompt = this.buildValuationAnalysisPrompt(context);

    // 调用LLM进行估值分析
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
      score: this.extractValuationScore(analysis),
      recommendation: this.extractValuationRecommendation(analysis),
      confidence: this.calculateValuationConfidence(analysis),
      keyInsights: this.extractValuationInsights(analysis),
      risks: this.identifyValuationRisks(analysis),
      supportingData: {
        analysisType: 'valuation_analysis',
        basicInfo: analysisData?.basicInfo,
        financialData: analysisData?.financialData,
        realtimeData: analysisData?.realtimeData,
        valuationMetrics: this.extractValuationMetrics(analysis),
        targetPrice: this.extractTargetPrice(analysis),
        valuationMethod: this.extractValuationMethod(analysis),
        peerComparison: this.extractPeerComparison(analysis),
      },
      timestamp: new Date(),
    };
  }

  /**
   * 实现抽象方法：构建分析提示词
   */
  protected async buildPrompt(context: AgentContext): Promise<string> {
    return `请对股票 ${context.stockCode} 进行估值分析。`;
  }

  /**
   * 构建估值分析提示词
   */
  private buildValuationAnalysisPrompt(context: AgentContext): string {
    const { stockCode, stockName } = context;
    const analysisData = context.metadata?.analysisData;
    
    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += `（${stockName}）`;
    }
    prompt += ` 进行估值水平分析。\n\n`;

    // 添加基础信息
    if (analysisData?.basicInfo) {
      prompt += `**公司基础信息**:\n`;
      prompt += `- 公司名称: ${analysisData.basicInfo.companyName || '未知'}\n`;
      prompt += `- 所属行业: ${analysisData.basicInfo.industry || '未知'}\n`;
      prompt += `- 总股本: ${analysisData.basicInfo.totalShares || '未知'}\n`;
      prompt += `- 每股收益: ${analysisData.basicInfo.eps || '未知'}\n`;
      prompt += `- 每股净资产: ${analysisData.basicInfo.bps || '未知'}\n\n`;
    }

    // 添加财务数据
    if (analysisData?.financialData) {
      prompt += `**财务数据**:\n`;
      if (analysisData.financialData.incomeStatement) {
        prompt += `- 营业收入: ${JSON.stringify(analysisData.financialData.incomeStatement)}\n`;
      }
      if (analysisData.financialData.balanceSheet) {
        prompt += `- 资产负债: ${JSON.stringify(analysisData.financialData.balanceSheet)}\n`;
      }
      if (analysisData.financialData.cashFlow) {
        prompt += `- 现金流量: ${JSON.stringify(analysisData.financialData.cashFlow)}\n`;
      }
      prompt += `\n`;
    }

    // 添加实时数据
    if (analysisData?.realtimeData) {
      prompt += `**实时行情数据**:\n`;
      prompt += `- 当前股价: ${analysisData.realtimeData.price || '未知'}\n`;
      prompt += `- 市盈率(TTM): ${analysisData.realtimeData.pe || '未知'}\n`;
      prompt += `- 市净率: ${analysisData.realtimeData.pb || '未知'}\n`;
      prompt += `- 市销率: ${analysisData.realtimeData.ps || '未知'}\n`;
      prompt += `- 总市值: ${analysisData.realtimeData.marketCap || '未知'}\n\n`;
    }

    // 添加其他智能体的分析结果作为参考
    if (context.previousResults && context.previousResults.length > 0) {
      prompt += `**参考信息**:\n`;
      context.previousResults.forEach((result, index) => {
        prompt += `${index + 1}. ${result.agentName}: ${result.analysis.substring(0, 200)}...\n`;
      });
      prompt += `\n`;
    }

    prompt += `请基于以上数据进行估值深度分析，重点包含以下内容：

## 🔍 估值分析框架

### 📊 相对估值分析
**PE估值**: 市盈率水平、历史PE区间、行业PE对比
**PB估值**: 市净率水平、历史PB区间、行业PB对比
**PS估值**: 市销率水平、适用性分析
**PEG估值**: PEG比率、成长性评估
**EV/EBITDA**: 企业价值倍数分析

### 📈 绝对估值分析
**DCF模型**: 现金流折现估值分析
**增长假设**: 收入增长率和利润率假设
**折现率**: WACC计算和折现率确定
**终值计算**: 永续增长率和终值计算

### 🔬 行业对比分析
**同行业对比**: 与主要竞争对手的估值对比
**历史对比**: 公司历史估值区间分析
**国际对比**: 国际同行业公司估值对比
**估值偏离**: 当前估值与合理估值的偏离程度

### 💰 估值合理性评估
**估值区间**: 合理估值区间计算
**目标价位**: 基于估值的目标价位设定
**安全边际**: 投资安全边际分析
**回报预期**: 潜在投资回报率评估

### 🎯 估值投资建议
**估值判断**: 低估/合理/高估的明确判断
**投资建议**: 基于估值水平的投资建议
**风险提示**: 估值相关风险提示
**操作策略**: 具体的买卖时机建议

### 📊 估值总结
**估值合理性评分**: 0-100分
**估值水平**: 当前估值水平判断
**投资价值**: 基于估值的投资价值评估

请提供专业、深入的估值分析报告。`;

    return prompt;
  }

  /**
   * 提取估值评分
   */
  private extractValuationScore(analysis: string): number {
    // 尝试从分析中提取估值评分
    const scorePatterns = [
      /估值评分[：:]?\s*(\d+(?:\.\d+)?)/i,
      /估值合理性评分[：:]?\s*(\d+(?:\.\d+)?)/i,
      /估值得分[：:]?\s*(\d+(?:\.\d+)?)/i,
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

    // 积极信号（低估）
    if (lowerAnalysis.includes("低估") || lowerAnalysis.includes("被低估")) score += 25;
    if (lowerAnalysis.includes("安全边际") || lowerAnalysis.includes("投资价值")) score += 15;
    if (lowerAnalysis.includes("估值偏低") || lowerAnalysis.includes("相对低估")) score += 10;
    if (lowerAnalysis.includes("增长潜力") || lowerAnalysis.includes("成长性好")) score += 10;

    // 消极信号（高估）
    if (lowerAnalysis.includes("高估") || lowerAnalysis.includes("被高估")) score -= 25;
    if (lowerAnalysis.includes("估值偏高") || lowerAnalysis.includes("相对高估")) score -= 15;
    if (lowerAnalysis.includes("泡沫") || lowerAnalysis.includes("风险较大")) score -= 10;
    if (lowerAnalysis.includes("估值合理") || lowerAnalysis.includes("估值适中")) score += 5;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * 提取估值投资建议
   */
  private extractValuationRecommendation(analysis: string): TradingRecommendation {
    const lowerAnalysis = analysis.toLowerCase();

    // 强烈信号
    if (lowerAnalysis.includes("强烈低估") || lowerAnalysis.includes("显著低估") || lowerAnalysis.includes("强烈推荐买入")) {
      return TradingRecommendation.STRONG_BUY;
    }
    if (lowerAnalysis.includes("严重高估") || lowerAnalysis.includes("泡沫明显") || lowerAnalysis.includes("强烈卖出")) {
      return TradingRecommendation.STRONG_SELL;
    }

    // 一般信号
    if (lowerAnalysis.includes("低估") || lowerAnalysis.includes("建议买入")) {
      return TradingRecommendation.BUY;
    }
    if (lowerAnalysis.includes("高估") || lowerAnalysis.includes("建议卖出")) {
      return TradingRecommendation.SELL;
    }

    return TradingRecommendation.HOLD; // 默认持有
  }

  /**
   * 计算估值分析置信度
   */
  private calculateValuationConfidence(analysis: string): number {
    let confidence = 0.6; // 基础置信度

    // 基于分析内容的质量评估置信度
    const qualityKeywords = ["估值", "PE", "PB", "DCF", "行业对比", "目标价"];
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
   * 提取估值洞察
   */
  private extractValuationInsights(analysis: string): string[] {
    const insights: string[] = [];
    
    const valuationKeywords = [
      "估值", "PE", "PB", "PS", "DCF", "目标价", "安全边际", "投资价值"
    ];

    const sentences = analysis.split(/[。！？]/);
    sentences.forEach(sentence => {
      valuationKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 15) {
          insights.push(sentence.trim());
        }
      });
    });

    return insights.slice(0, 6);
  }

  /**
   * 识别估值风险
   */
  private identifyValuationRisks(analysis: string): string[] {
    const risks: string[] = [];
    
    const riskKeywords = ["估值风险", "市场风险", "流动性风险", "政策风险", "业绩风险"];
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
   * 提取估值指标
   */
  private extractValuationMetrics(analysis: string): any {
    const metrics: any = {};
    
    // 提取PE
    const peMatch = analysis.match(/PE[：:]\s*(\d+(?:\.\d+)?)/i);
    if (peMatch) metrics.pe = parseFloat(peMatch[1]);
    
    // 提取PB
    const pbMatch = analysis.match(/PB[：:]\s*(\d+(?:\.\d+)?)/i);
    if (pbMatch) metrics.pb = parseFloat(pbMatch[1]);
    
    // 提取PS
    const psMatch = analysis.match(/PS[：:]\s*(\d+(?:\.\d+)?)/i);
    if (psMatch) metrics.ps = parseFloat(psMatch[1]);
    
    // 提取PEG
    const pegMatch = analysis.match(/PEG[：:]\s*(\d+(?:\.\d+)?)/i);
    if (pegMatch) metrics.peg = parseFloat(pegMatch[1]);
    
    return metrics;
  }

  /**
   * 提取目标价格
   */
  private extractTargetPrice(analysis: string): string {
    const targetPatterns = [
      /目标价[：:]\s*(\d+(?:\.\d+)?)/i,
      /目标价位[：:]\s*(\d+(?:\.\d+)?)/i,
      /目标价格[：:]\s*(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of targetPatterns) {
      const match = analysis.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    return "目标价位未明确";
  }

  /**
   * 提取估值方法
   */
  private extractValuationMethod(analysis: string): string {
    const methodKeywords = ["相对估值", "绝对估值", "DCF", "PE估值", "PB估值", "PS估值"];
    
    for (const keyword of methodKeywords) {
      if (analysis.includes(keyword)) {
        const sentences = analysis.split(/[。！？]/);
        for (const sentence of sentences) {
          if (sentence.includes(keyword) && sentence.trim().length > 10) {
            return sentence.trim();
          }
        }
      }
    }
    
    return "估值方法未明确";
  }

  /**
   * 提取同行对比
   */
  private extractPeerComparison(analysis: string): string {
    const comparisonKeywords = ["行业对比", "同行对比", "同行业", "竞争对手"];
    
    for (const keyword of comparisonKeywords) {
      if (analysis.includes(keyword)) {
        const sentences = analysis.split(/[。！？]/);
        for (const sentence of sentences) {
          if (sentence.includes(keyword) && sentence.trim().length > 10) {
            return sentence.trim();
          }
        }
      }
    }
    
    return "同行对比分析不明确";
  }
}