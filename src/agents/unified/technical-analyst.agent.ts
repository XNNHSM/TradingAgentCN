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
      systemPrompt: `您是资深技术分析师，专注于股票技术面深度分析，特别擅长精确的趋势预测和可操作的交易策略制定。

🎯 **核心职责**:
- **深度趋势预测**: 基于技术指标综合分析，提供未来3-5个交易日的具体走势预测
- **精确交易策略**: 制定包含具体价格点位、仓位管理、止损止盈的完整交易方案
- **关键位识别**: 精确计算支撑位、阻力位、止损位、止盈位等关键价格水平
- **风险评估**: 量化分析技术面风险，提供具体的风险控制措施

📊 **专业分析框架**:
- **多时间维度分析**: 结合日线、周线技术形态
- **指标相互验证**: MACD、RSI、KDJ、均线系统、布林带综合分析
- **量价关系分析**: 成交量验证价格趋势的有效性
- **形态识别**: K线形态、图表模式的技术意义解读

📋 **输出标准格式**:
**技术面评分**: 0-100分，基于综合技术指标分析
**明确交易建议**: 强买入/买入/持有/卖出/强卖出
**未来3-5个交易日趋势预测**: 
- 具体的趋势方向（上升/下降/震荡）
- 预期的目标价位区间
- 关键的时间节点和转折点预期
**具体交易策略表**:
| 操作类型 | 价格区间 | 仓位比例 | 止损位 | 止盈位 | 操作理由 |
|---------|---------|---------|--------|--------|----------|
**风险控制措施**: 具体的止损策略和仓位管理方案
**技术面置信度**: 70-90%区间，基于指标一致性评估

请提供专业、具体、可操作的技术分析报告。`,
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
        tradingStrategy: this.extractTradingStrategy(analysis),
        futurePrediction: this.extractFuturePrediction(analysis),
        riskManagement: this.extractRiskManagement(analysis),
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
    prompt += ` 进行技术分析，重点提供趋势预测和交易策略。\n\n`;

    // 从context中获取分析数据
    const analysisData = context.metadata?.analysisData;
    const historicalData = analysisData?.historicalData;
    const technicalIndicators = analysisData?.technicalIndicators;

    // 添加历史数据（简化格式）
    if (historicalData) {
      prompt += `**历史价格数据**:\n${JSON.stringify(historicalData.slice(-10), null, 2)}\n\n`;
    }

    // 添加技术指标（简化格式）
    if (technicalIndicators) {
      prompt += `**技术指标**:\n${JSON.stringify(technicalIndicators, null, 2)}\n\n`;
    }

    // 添加其他智能体的分析结果作为参考
    if (context.previousResults && context.previousResults.length > 0) {
      prompt += `**参考信息**:\n`;
      context.previousResults.forEach((result, index) => {
        prompt += `${index + 1}. ${result.agentName}: ${result.analysis.substring(0, 200)}...\n`;
      });
      prompt += `\n`;
    }

    prompt += `请基于以上数据进行深度技术分析，严格按照以下格式输出：

## 🔍 技术面深度分析

### 📊 技术指标综合分析
**MACD分析**: 详细分析DIF、DEA线位置，MACD柱状线强度，金叉死叉信号，背离现象
**RSI/KDJ分析**: 当前超买超卖区间，指标交叉信号，背离情况
**均线系统**: 5日、10日、20日、60日均线排列，价格与均线关系
**布林带分析**: 布林带开口收口状态，价格在轨道中的位置
**成交量分析**: 量价配合情况，资金流向判断

### 📈 未来3-5个交易日趋势预测
**趋势方向**: 明确预测上升/下降/震荡趋势
**目标价位**: 具体的预期目标价格区间
**时间节点**: 关键的转折点预期时间
**突破/回调**: 预期的突破或回调价格点位
**市场情绪**: 基于技术形态的情绪判断

### 🎯 具体交易策略表
| 操作类型 | 价格区间 | 仓位比例 | 止损位 | 止盈位 | 操作理由 |
|---------|---------|---------|--------|--------|----------|
| 买入/卖出/观望 | 具体价格 | XX% | 具体价格 | 具体价格 | 详细理由 |

### 🛡️ 风险控制措施
**止损策略**: 具体的止损位设置和调整方案
**仓位管理**: 总仓位控制建议，分批建仓/减仓策略
**应对预案**: 不同市场情况的应对措施

### 📋 技术面总结
**技术面评分**: XX/100分
**交易建议**: 强买入/买入/持有/卖出/强卖出
**置信度**: XX%（基于技术指标一致性）
**主要风险**: 具体的技术面风险点

请提供专业、具体、可操作的技术分析报告。`;

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

  /**
   * 提取交易策略信息
   */
  private extractTradingStrategy(analysis: string): any {
    const strategyInfo: any = {
      shortTerm: { strategy: "未明确", timeframe: "1-5个交易日" },
      mediumTerm: { strategy: "未明确", timeframe: "1-3周" },
      entryPoints: [],
      exitPoints: [],
      positionSize: "未明确"
    };

    // 提取短期策略
    if (analysis.includes("短期") || analysis.includes("1-5")) {
      const shortTermMatch = analysis.match(/短期[：:]*\s*([^。]+)/);
      if (shortTermMatch) {
        strategyInfo.shortTerm.strategy = shortTermMatch[1].trim();
      }
    }

    // 提取中期策略
    if (analysis.includes("中期") || analysis.includes("1-3周")) {
      const mediumTermMatch = analysis.match(/中期[：:]*\s*([^。]+)/);
      if (mediumTermMatch) {
        strategyInfo.mediumTerm.strategy = mediumTermMatch[1].trim();
      }
    }

    // 提取买入点位
    const buyPatterns = [/买入点位[：:]*\s*([0-9.]+)/, /买入[：:]*\s*([0-9.]+)/];
    buyPatterns.forEach(pattern => {
      const match = analysis.match(pattern);
      if (match) strategyInfo.entryPoints.push({ type: "买入", price: match[1] });
    });

    // 提取卖出点位
    const sellPatterns = [/卖出点位[：:]*\s*([0-9.]+)/, /卖出[：:]*\s*([0-9.]+)/];
    sellPatterns.forEach(pattern => {
      const match = analysis.match(pattern);
      if (match) strategyInfo.exitPoints.push({ type: "卖出", price: match[1] });
    });

    // 提取仓位建议
    const positionPatterns = [/仓位[：:]*\s*([^。]+)/, /轻仓|半仓|重仓|全仓/];
    positionPatterns.forEach(pattern => {
      const match = analysis.match(pattern);
      if (match) strategyInfo.positionSize = match[0].trim();
    });

    return strategyInfo;
  }

  /**
   * 提取未来预测信息
   */
  private extractFuturePrediction(analysis: string): any {
    const prediction: any = {
      timeframe: "3-5个交易日",
      trend: "未明确",
      keyEvents: [],
      confidence: "中等"
    };

    // 提取趋势预测
    const predictionKeywords = ["预计", "预期", "预测", "可能", "有望"];
    const sentences = analysis.split(/[。！？]/);
    
    for (const sentence of sentences) {
      if (predictionKeywords.some(keyword => sentence.includes(keyword)) && 
          (sentence.includes("上涨") || sentence.includes("下跌") || sentence.includes("震荡"))) {
        prediction.trend = sentence.trim();
        break;
      }
    }

    // 提取关键事件
    const eventPatterns = [/突破[：:]*\s*([^。]+)/, /回调[：:]*\s*([^。]+)/, /反转[：:]*\s*([^。]+)/];
    eventPatterns.forEach(pattern => {
      const match = analysis.match(pattern);
      if (match) prediction.keyEvents.push(match[0].trim());
    });

    // 提取置信度
    if (analysis.includes("高置信度") || analysis.includes("高度确定")) {
      prediction.confidence = "高";
    } else if (analysis.includes("低置信度") || analysis.includes("不确定性")) {
      prediction.confidence = "低";
    }

    return prediction;
  }

  /**
   * 提取风险管理信息
   */
  private extractRiskManagement(analysis: string): any {
    const riskManagement: any = {
      stopLoss: "未设定",
      takeProfit: "未设定",
      riskLevel: "中等",
      riskMeasures: []
    };

    // 提取止损位
    const stopLossPatterns = [/止损位[：:]*\s*([0-9.]+)/, /止损[：:]*\s*([0-9.]+)/];
    stopLossPatterns.forEach(pattern => {
      const match = analysis.match(pattern);
      if (match) riskManagement.stopLoss = match[1];
    });

    // 提取止盈位
    const takeProfitPatterns = [/止盈位[：:]*\s*([0-9.]+)/, /止盈[：:]*\s*([0-9.]+)/];
    takeProfitPatterns.forEach(pattern => {
      const match = analysis.match(pattern);
      if (match) riskManagement.takeProfit = match[1];
    });

    // 提取风险等级
    if (analysis.includes("高风险")) {
      riskManagement.riskLevel = "高";
    } else if (analysis.includes("低风险")) {
      riskManagement.riskLevel = "低";
    }

    // 提取风险控制措施
    const riskKeywords = ["风险控制", "资金管理", "仓位控制", "分散投资"];
    const sentences = analysis.split(/[。！？]/);
    
    sentences.forEach(sentence => {
      if (riskKeywords.some(keyword => sentence.includes(keyword)) && sentence.trim().length > 10) {
        riskManagement.riskMeasures.push(sentence.trim());
      }
    });

    return riskManagement;
  }
}