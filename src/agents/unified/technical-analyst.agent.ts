import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {BaseAgent} from '../base/base-agent';
import {LLMService} from '../services/llm.service';
import {AgentExecutionRecordService} from '../services/agent-execution-record.service';
import {AgentConfig, AgentContext, AgentResult, AgentType, TradingRecommendation} from '../interfaces/agent.interface';
import {BusinessLogger} from '../../common/utils/business-logger.util';

/**
 * 技术分析智能体
 * 专门负责分析来自Activities传递的历史数据和技术指标
 * 按需调用原则: 只有这个智能体负责技术分析相关的分析
 */
@Injectable()
export class TechnicalAnalystAgent extends BaseAgent {
  private readonly businessLogger = new BusinessLogger(TechnicalAnalystAgent.name);

  constructor(
    protected readonly llmService: LLMService,
    protected readonly configService: ConfigService,
    protected readonly executionRecordService?: AgentExecutionRecordService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "TECHNICAL_ANALYST_MODEL",
        configService.get<string>("LLM_DEFAULT_MODEL", "qwen-plus"),
      ),
      temperature: configService.get<number>(
        "TECHNICAL_ANALYST_TEMPERATURE", 
        0.5,
      ),
      maxTokens: configService.get<number>(
        "TECHNICAL_ANALYST_MAX_TOKENS",
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 3000),
      ),
      timeout: configService.get<number>(
        "TECHNICAL_ANALYST_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 120),
      ),
      retryCount: configService.get<number>(
        "TECHNICAL_ANALYST_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
      systemPrompt: `您是一位资深的技术分析师，专门负责股票的技术面分析。您具备深厚的图表分析和技术指标解读能力。

🎯 **核心职责**:
1. **价格趋势分析**: 分析股价的历史走势和趋势方向
2. **技术指标解读**: 深度分析各类技术指标的信号含义
3. **关键位分析**: 识别支撑位、阻力位等关键价格水平
4. **交易信号判断**: 基于技术分析给出明确的交易建议

📊 **分析工具箱**:
- **趋势指标**: 均线系统、MACD、趋势线分析
- **震荡指标**: RSI、KDJ、CCI等超买超卖指标  
- **成交量指标**: 量价关系、成交量变化分析
- **形态分析**: K线形态、图表形态识别

🔍 **技术分析框架**:
1. **趋势判断**: 
   - 主要趋势方向 (上升/下降/横盘)
   - 趋势强度和持续性分析
   - 趋势转换信号识别

2. **关键位识别**:
   - 重要支撑位和阻力位
   - 突破和回调的关键价格
   - 止损和止盈位建议

3. **技术指标综合**:
   - 各指标的当前状态和信号
   - 指标之间的相互验证
   - 背离现象的识别和含义

4. **交易策略建议**:
   - 具体的买入/卖出时机
   - 风险控制和仓位管理
   - 短期和中期操作建议

📋 **输出要求**:
- 提供0-100分的技术面评分
- 给出明确的交易建议 (强买入/买入/持有/卖出/强卖出)
- 标注关键技术位和操作策略
- 评估技术分析的可靠性和风险

请用中文提供专业、深入的技术分析报告。`,
    };

    super(
      "技术分析智能体",
      AgentType.TECHNICAL_ANALYST_NEW,
      "专门负责股票历史数据和技术指标的分析",
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
    // 从context中获取MCP数据（由Activities提供）
    const mcpData = context.metadata?.mcpData;
    const analysisData = context.metadata?.analysisData;
    
    // 根据分析类型获取相应数据
    let historicalData, technicalIndicators;
    
    if (context.metadata?.analysisType === 'risk_analysis' && analysisData) {
      // 风险分析模式：使用所有MCP数据
      historicalData = analysisData.allMcpData?.historicalData;
      technicalIndicators = analysisData.allMcpData?.technicalIndicators;
    } else if (mcpData) {
      // 技术分析模式：使用专门的技术数据
      historicalData = mcpData.historicalData;
      technicalIndicators = mcpData.technicalIndicators;
    }

    if (!historicalData && !technicalIndicators) {
      throw new Error('历史数据和技术指标均未提供');
    }

    return {
      ...context,
      metadata: {
        ...context.metadata,
        analysisData: {
          historicalData,
          technicalIndicators,
          analysisType: context.metadata?.analysisType || 'technical_analysis'
        }
      }
    };
  }

  /**
   * 执行技术分析 - 调用LLM进行分析
   */
  protected async executeAnalysis(context: AgentContext): Promise<string> {
    // 从准备好的上下文中获取分析数据
    const analysisData = context.metadata?.analysisData;
    const historicalData = analysisData?.historicalData;
    const technicalIndicators = analysisData?.technicalIndicators;

    // 构建分析提示词
    const analysisPrompt = this.buildAnalysisPrompt(context);

    // 调用LLM进行技术分析
    return await this.callLLM(analysisPrompt);
  }

  /**
   * 处理结果 - 将分析结果转换为AgentResult格式
   */
  protected async processResult(analysis: string, context: AgentContext): Promise<AgentResult> {
    const analysisData = context.metadata?.analysisData;
    const historicalData = analysisData?.historicalData;
    const technicalIndicators = analysisData?.technicalIndicators;

    // 从分析结果中提取评分和建议
    const score = this.extractTechnicalScore(analysis);
    const recommendation = this.extractTechnicalRecommendation(analysis);

    return {
      agentName: this.name,
      agentType: this.type,
      analysis,
      score,
      recommendation,
      confidence: this.calculateTechnicalConfidence(historicalData, technicalIndicators, analysis),
      keyInsights: this.extractTechnicalInsights(analysis),
      risks: this.identifyTechnicalRisks(analysis),
      supportingData: {
        analysisType: context.metadata?.analysisType || 'technical_analysis',
        dataSource: 'mcp_activities',
        historicalDataPeriod: this.getDataPeriod(historicalData),
        technicalIndicators: this.extractIndicatorSummary(technicalIndicators),
        keyLevels: this.extractKeyLevels(analysis),
        trendAnalysis: this.extractTrendAnalysis(analysis),
        timeRange: context.timeRange,
      },
      timestamp: new Date(),
    };
  }

  /**
   * 实现抽象方法：构建分析提示词
   */
  protected async buildPrompt(context: AgentContext): Promise<string> {
    // 这个方法在 analyze 中通过 buildAnalysisPrompt 实现
    return `请对股票 ${context.stockCode} 进行技术分析。`;
  }

  /**
   * 构建技术分析提示词
   */
  private buildAnalysisPrompt(context: AgentContext): string {
    const { stockCode, stockName } = context;
    
    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 进行专业的技术分析。\n\n`;

    // 从context中获取分析数据
    const analysisData = context.metadata?.analysisData;
    const historicalData = analysisData?.historicalData;
    const technicalIndicators = analysisData?.technicalIndicators;

    // 添加历史数据
    if (historicalData) {
      prompt += `**历史价格数据**:\n${JSON.stringify(historicalData, null, 2)}\n\n`;
    }

    // 添加技术指标
    if (technicalIndicators) {
      prompt += `**技术指标数据**:\n${JSON.stringify(technicalIndicators, null, 2)}\n\n`;
    }

    // 添加其他智能体的分析结果作为参考
    if (context.previousResults && context.previousResults.length > 0) {
      prompt += `**参考信息** (其他分析师观点):\n`;
      context.previousResults.forEach((result, index) => {
        prompt += `${index + 1}. ${result.agentName}: ${result.analysis}\n`;
      });
      prompt += `\n`;
    }

    prompt += `请基于以上数据进行深度的技术分析，包括：

1. **趋势分析** (30分权重):
   - 主要趋势方向判断 (上升/下降/震荡)
   - 趋势强度评估和持续性预判
   - 关键趋势线和通道分析

2. **技术指标分析** (40分权重):
   - MACD指标状态和信号 (金叉死叉、背离等)
   - RSI等震荡指标的超买超卖状况
   - 均线系统排列和价格与均线关系
   - KDJ、布林带等其他指标综合判断

3. **关键位分析** (20分权重):
   - 重要支撑位和阻力位识别
   - 突破或回调的关键价格水平
   - 历史成交密集区分析

4. **量价关系分析** (10分权重):
   - 成交量与价格变化的配合情况
   - 放量突破或缩量调整的意义
   - 异常成交量的技术含义

**输出要求**:
- 提供技术面综合评分 (0-100分)
- 给出明确的技术面交易建议
- 标注关键技术位 (支撑位、阻力位、止损位)
- 评估分析的置信度和主要风险

请提供专业、详细的技术分析报告。`;

    return prompt;
  }

  /**
   * 提取技术面评分
   */
  private extractTechnicalScore(analysis: string): number {
    // 尝试从分析中提取技术面评分
    const scorePatterns = [
      /技术面评分[：:]?\s*(\d+(?:\.\d+)?)/i,
      /综合评分[：:]?\s*(\d+(?:\.\d+)?)/i,
      /技术得分[：:]?\s*(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)分/
    ];

    for (const pattern of scorePatterns) {
      const match = analysis.match(pattern);
      if (match) {
        const score = parseFloat(match[1]);
        return Math.min(Math.max(score, 0), 100);
      }
    }

    // 基于技术分析关键词估算评分
    const lowerAnalysis = analysis.toLowerCase();
    let score = 50; // 基础分数

    // 积极信号
    if (lowerAnalysis.includes("金叉") || lowerAnalysis.includes("突破")) score += 15;
    if (lowerAnalysis.includes("上升趋势") || lowerAnalysis.includes("强势")) score += 10;
    if (lowerAnalysis.includes("放量") && lowerAnalysis.includes("上涨")) score += 10;
    if (lowerAnalysis.includes("支撑") && !lowerAnalysis.includes("跌破")) score += 5;

    // 消极信号
    if (lowerAnalysis.includes("死叉") || lowerAnalysis.includes("跌破")) score -= 15;
    if (lowerAnalysis.includes("下降趋势") || lowerAnalysis.includes("弱势")) score -= 10;
    if (lowerAnalysis.includes("放量") && lowerAnalysis.includes("下跌")) score -= 10;
    if (lowerAnalysis.includes("阻力") && lowerAnalysis.includes("受阻")) score -= 5;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * 提取技术面交易建议
   */
  private extractTechnicalRecommendation(analysis: string): TradingRecommendation {
    const lowerAnalysis = analysis.toLowerCase();

    // 强烈信号
    if (lowerAnalysis.includes("强烈买入") || lowerAnalysis.includes("积极买入")) {
      return TradingRecommendation.STRONG_BUY;
    }
    if (lowerAnalysis.includes("强烈卖出") || lowerAnalysis.includes("积极卖出")) {
      return TradingRecommendation.STRONG_SELL;
    }

    // 一般信号
    if (lowerAnalysis.includes("建议买入") || lowerAnalysis.includes("技术买入")) {
      return TradingRecommendation.BUY;
    }
    if (lowerAnalysis.includes("建议卖出") || lowerAnalysis.includes("技术卖出")) {
      return TradingRecommendation.SELL;
    }

    // 基于技术指标判断
    if (lowerAnalysis.includes("金叉") && lowerAnalysis.includes("突破")) {
      return TradingRecommendation.BUY;
    }
    if (lowerAnalysis.includes("死叉") && lowerAnalysis.includes("跌破")) {
      return TradingRecommendation.SELL;
    }

    return TradingRecommendation.HOLD; // 默认持有
  }

  /**
   * 计算技术分析置信度
   */
  private calculateTechnicalConfidence(historicalData: any, technicalIndicators: any, analysis: string): number {
    let confidence = 0.6; // 基础置信度

    // 数据完整性对置信度的影响
    if (historicalData && Array.isArray(historicalData) && historicalData.length > 30) {
      confidence += 0.15; // 充足的历史数据
    }
    if (technicalIndicators && Object.keys(technicalIndicators).length > 3) {
      confidence += 0.15; // 丰富的技术指标
    }

    // 分析质量对置信度的影响
    const analysisKeywords = ["趋势", "指标", "支撑", "阻力", "突破", "信号"];
    const keywordCount = analysisKeywords.filter(keyword => 
      analysis.includes(keyword)
    ).length;
    confidence += keywordCount * 0.02; // 每个关键词+2%

    // 技术分析相对客观，置信度可以较高
    return Math.min(confidence, 0.90);
  }

  /**
   * 提取技术洞察
   */
  private extractTechnicalInsights(analysis: string): string[] {
    const insights: string[] = [];

    const technicalKeywords = [
      "趋势", "MACD", "RSI", "均线", "突破", "支撑", "阻力",
      "金叉", "死叉", "背离", "形态", "量价", "信号"
    ];

    const sentences = analysis.split(/[。！？]/);
    sentences.forEach(sentence => {
      technicalKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 15) {
          insights.push(sentence.trim());
        }
      });
    });

    return insights.slice(0, 6); // 最多返回6个技术洞察
  }

  /**
   * 识别技术风险
   */
  private identifyTechnicalRisks(analysis: string): string[] {
    const risks: string[] = [];

    // 技术分析常见风险
    const commonTechnicalRisks = [
      "技术指标存在滞后性",
      "市场突发事件可能导致技术形态失效",
      "技术分析需要结合其他分析方法",
      "关键位突破或跌破需要成交量确认"
    ];

    // 从分析中提取风险相关内容
    const riskKeywords = ["风险", "失效", "假突破", "背离", "滞后", "不确定"];
    const sentences = analysis.split(/[。！？]/);
    
    sentences.forEach(sentence => {
      riskKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 10) {
          risks.push(sentence.trim());
        }
      });
    });

    // 如果没有从分析中提取到风险，添加通用技术风险
    if (risks.length === 0) {
      risks.push(...commonTechnicalRisks.slice(0, 3));
    }

    return risks.slice(0, 4); // 最多返回4个风险点
  }

  /**
   * 获取数据周期信息
   */
  private getDataPeriod(historicalData: any): string {
    if (!historicalData || !Array.isArray(historicalData)) {
      return "数据缺失";
    }
    return `${historicalData.length}个交易日数据`;
  }

  /**
   * 提取指标摘要
   */
  private extractIndicatorSummary(technicalIndicators: any): any {
    if (!technicalIndicators || typeof technicalIndicators !== 'object') {
      return "指标数据缺失";
    }
    
    // 提取关键指标
    const summary = {};
    const keyIndicators = ['MACD', 'RSI', 'KDJ', 'MA', 'BOLL'];
    
    keyIndicators.forEach(indicator => {
      if (technicalIndicators[indicator] !== undefined) {
        summary[indicator] = technicalIndicators[indicator];
      }
    });

    return Object.keys(summary).length > 0 ? summary : "关键指标缺失";
  }

  /**
   * 提取关键位信息
   */
  private extractKeyLevels(analysis: string): string[] {
    const levels: string[] = [];
    
    // 查找支撑位和阻力位
    const levelPatterns = [
      /支撑位[：:]\s*([0-9.]+)/gi,
      /阻力位[：:]\s*([0-9.]+)/gi,
      /关键位[：:]\s*([0-9.]+)/gi
    ];

    levelPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(analysis)) !== null) {
        levels.push(match[0]);
      }
    });

    return levels.slice(0, 5); // 最多返回5个关键位
  }

  /**
   * 提取趋势分析
   */
  private extractTrendAnalysis(analysis: string): string {
    const trendKeywords = ["上升趋势", "下降趋势", "震荡", "横盘", "突破", "回调"];
    
    for (const keyword of trendKeywords) {
      if (analysis.includes(keyword)) {
        // 找到包含趋势关键词的句子
        const sentences = analysis.split(/[。！？]/);
        for (const sentence of sentences) {
          if (sentence.includes(keyword)) {
            return sentence.trim();
          }
        }
      }
    }
    
    return "趋势判断不明确";
  }
}