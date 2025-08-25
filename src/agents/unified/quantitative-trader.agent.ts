import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseAgent } from "../base/base-agent";
import {
  AgentType,
  AgentContext,
  AgentConfig,
  AgentResult,
  TradingRecommendation,
  AgentStatus,
} from "../interfaces/agent.interface";
import { LLMService } from "../services/llm.service";
import { AgentExecutionRecordService } from "../services/agent-execution-record.service";

/**
 * 量化交易员智能体
 * 基于数据和模型进行系统化投资决策
 * 基于 prompt_templates.md 中的量化交易员模板
 */
@Injectable()
export class QuantitativeTraderAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
    executionRecordService: AgentExecutionRecordService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "QUANTITATIVE_TRADER_MODEL",
        configService.get<string>("LLM_DEFAULT_MODEL", "qwen-max"), // 量化需要强模型
      ),
      temperature: configService.get<number>(
        "QUANTITATIVE_TRADER_TEMPERATURE",
        0.3, // 量化分析需要较低温度保证一致性
      ),
      maxTokens: configService.get<number>(
        "QUANTITATIVE_TRADER_MAX_TOKENS",
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 3500),
      ),
      timeout: configService.get<number>(
        "QUANTITATIVE_TRADER_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 60),
      ),
      retryCount: configService.get<number>(
        "QUANTITATIVE_TRADER_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
      systemPrompt: `您是一位专业的量化交易智能体，基于数据和模型进行系统化投资决策。您依赖客观的量化指标和统计分析来做出交易决策。

📊 **量化分析框架**:
1. **技术指标量化**: RSI、MACD、布林带等指标的数值分析
2. **统计套利**: 价格偏离均值的统计显著性
3. **动量因子**: 价格和成交量动量的量化测量
4. **风险模型**: VaR、夏普比率、最大回撤等风险指标

🔢 **决策模型**:
- **多因子评分模型**: 技术面(40%) + 基本面(30%) + 情绪面(20%) + 宏观面(10%)
- **信号强度**: 强买入(>80分) | 买入(60-80分) | 持有(40-60分) | 卖出(20-40分) | 强卖出(<20分)
- **置信度**: 基于历史回测和统计显著性

📈 **量化指标权重**:

**技术指标**:
- RSI背离 (权重: 15%)
- MACD金叉死叉 (权重: 15%)
- 布林带突破 (权重: 10%)

**基本面指标**:
- PE/PB相对估值 (权重: 15%)
- 盈利增长趋势 (权重: 15%)

**市场情绪**:
- 社交媒体情绪得分 (权重: 10%)
- 机构资金流向 (权重: 10%)

**宏观因素**:
- 行业轮动信号 (权重: 5%)
- 市场整体趋势 (权重: 5%)

📋 **输出要求**:
- **综合评分**（0-100分）
- **各因子得分明细**
- **统计置信度**
- **量化风险指标**
- **历史回测表现参考**

💡 **分析流程**:
1. **数据预处理**: 清洗和标准化输入数据
2. **因子计算**: 计算各类量化因子得分
3. **模型评分**: 应用多因子评分模型
4. **风险评估**: 计算风险调整后的收益预期
5. **信号生成**: 基于评分生成明确的交易信号
6. **置信度评估**: 基于模型可靠性评估置信度

⚠️ **重要提醒**:
- 必须提供具体的数值计算过程
- 所有判断都要有量化依据
- 明确标注模型的局限性和假设条件
- 必须以 '**最终交易建议: 买入/持有/卖出**' 结束回应

请用中文提供专业、量化的交易决策分析。`,
    };

    super(
      "量化交易员",
      AgentType.QUANTITATIVE_TRADER,
      "专业的量化交易智能体，基于数据和模型进行系统化投资决策",
      llmService,
      undefined, // dataToolkit (已废弃)
      config,
      executionRecordService,
    );
  }

  /**
   * 执行量化分析
   */
  async analyze(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    this.status = AgentStatus.ANALYZING;

    try {
      // 构建量化分析上下文
      const analysisPrompt = this.buildQuantitativePrompt(context);

      // 调用LLM进行量化分析
      const analysisResult = await this.llmService.generate(analysisPrompt, {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        timeout: this.config.timeout * 1000,
      });

      const processingTime = Date.now() - startTime;

      // 从分析结果中提取评分和建议
      const score = this.extractQuantScore(analysisResult);
      const recommendation = this.extractQuantRecommendation(analysisResult);
      
      const result: AgentResult = {
        agentName: this.name,
        agentType: this.type,
        analysis: analysisResult,
        score,
        recommendation,
        confidence: this.calculateQuantitativeConfidence(context, analysisResult, score),
        keyInsights: this.extractQuantitativeInsights(analysisResult),
        risks: this.identifyQuantitativeRisks(analysisResult),
        supportingData: {
          modelComponents: {
            technical: "40%",
            fundamental: "30%", 
            sentiment: "20%",
            macro: "10%"
          },
          quantitativeMetrics: [
            "RSI背离", "MACD信号", "布林带突破",
            "PE/PB估值", "盈利增长", "情绪得分",
            "资金流向", "行业轮动", "市场趋势"
          ],
          riskMetrics: ["VaR", "夏普比率", "最大回撤", "波动率"],
          timeRange: context.timeRange,
        },
        timestamp: new Date(),
        processingTime,
      };

      this.status = AgentStatus.COMPLETED;
      return result;
    } catch (error) {
      this.status = AgentStatus.ERROR;
      throw error;
    }
  }

  /**
   * 实现抽象方法：构建分析提示词
   */
  protected async buildPrompt(context: AgentContext): Promise<string> {
    return this.buildQuantitativePrompt(context);
  }

  /**
   * 构建量化分析提示词
   */
  private buildQuantitativePrompt(context: AgentContext): string {
    const { stockCode, stockName, timeRange } = context;

    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 进行量化交易分析。\n\n`;

    // 添加时间范围
    if (timeRange) {
      prompt += `分析时间范围: ${timeRange.startDate.toISOString().split('T')[0]} 至 ${timeRange.endDate.toISOString().split('T')[0]}\n\n`;
    }

    // 添加历史数据进行量化计算
    if (context.historicalData) {
      prompt += `**历史价格和技术指标数据**:\n${JSON.stringify(context.historicalData, null, 2)}\n\n`;
    }

    // 添加财务数据进行基本面量化
    if (context.financialData) {
      prompt += `**财务数据**:\n${JSON.stringify(context.financialData, null, 2)}\n\n`;
    }

    // 添加其他智能体的分析结果作为情绪和宏观因子
    if (context.previousResults && context.previousResults.length > 0) {
      prompt += `**其他分析师观点和情绪数据**:\n`;
      context.previousResults.forEach((result, index) => {
        prompt += `${index + 1}. ${result.agentName} (${result.agentType}):\n`;
        prompt += `   - 分析: ${result.analysis}\n`;
        prompt += `   - 评分: ${result.score || 'N/A'}\n`;
        prompt += `   - 建议: ${result.recommendation || 'N/A'}\n`;
        prompt += `   - 置信度: ${result.confidence || 'N/A'}\n\n`;
      });
    }

    prompt += `
请严格按照量化模型进行分析：

1. **技术面分析 (40%权重)**:
   - RSI背离情况 (15%): 计算RSI值，识别背离信号
   - MACD金叉死叉 (15%): 分析MACD线与信号线关系
   - 布林带突破 (10%): 价格相对布林带位置分析

2. **基本面分析 (30%权重)**:
   - PE/PB相对估值 (15%): 与历史均值和行业均值对比
   - 盈利增长趋势 (15%): 计算盈利增长率和趋势斜率

3. **情绪面分析 (20%权重)**:
   - 社交媒体情绪得分 (10%): 基于其他智能体的情绪分析结果
   - 机构资金流向 (10%): 分析机构持仓和资金流向

4. **宏观面分析 (10%权重)**:
   - 行业轮动信号 (5%): 行业相对表现分析
   - 市场整体趋势 (5%): 大盘走势对个股的影响

请为每个因子提供具体的数值评分（0-100分），并计算加权总分。最后基于总分给出明确的交易建议。`;

    return prompt;
  }

  /**
   * 从分析结果中提取评分
   */
  private extractQuantScore(analysis: string): number {
    // 尝试从分析中提取综合评分
    const scoreMatch = analysis.match(/综合评?分[：:]\s*(\d+(?:\.\d+)?)/i) || 
                      analysis.match(/总分[：:]\s*(\d+(?:\.\d+)?)/i) ||
                      analysis.match(/(\d+(?:\.\d+)?)\s*分/);
    
    if (scoreMatch) {
      const score = parseFloat(scoreMatch[1]);
      return Math.min(Math.max(score, 0), 100); // 确保分数在0-100范围内
    }
    
    // 如果无法提取，基于关键词估算
    let estimatedScore = 50;
    
    if (analysis.includes("强买入") || analysis.includes("强烈推荐")) {
      estimatedScore = 85;
    } else if (analysis.includes("买入") || analysis.includes("推荐")) {
      estimatedScore = 70;
    } else if (analysis.includes("持有") || analysis.includes("中性")) {
      estimatedScore = 50;
    } else if (analysis.includes("卖出") || analysis.includes("减持")) {
      estimatedScore = 30;
    } else if (analysis.includes("强卖出") || analysis.includes("强烈卖出")) {
      estimatedScore = 15;
    }
    
    return estimatedScore;
  }

  /**
   * 从分析结果中提取交易建议
   */
  private extractQuantRecommendation(analysis: string): TradingRecommendation {
    const lowerAnalysis = analysis.toLowerCase();
    
    if (lowerAnalysis.includes("强买入") || lowerAnalysis.includes("strong_buy")) {
      return TradingRecommendation.STRONG_BUY;
    } else if (lowerAnalysis.includes("买入") || lowerAnalysis.includes("buy")) {
      return TradingRecommendation.BUY;
    } else if (lowerAnalysis.includes("强卖出") || lowerAnalysis.includes("strong_sell")) {
      return TradingRecommendation.STRONG_SELL;
    } else if (lowerAnalysis.includes("卖出") || lowerAnalysis.includes("sell")) {
      return TradingRecommendation.SELL;
    } else {
      return TradingRecommendation.HOLD;
    }
  }

  /**
   * 计算量化分析置信度
   */
  private calculateQuantitativeConfidence(context: AgentContext, analysis: string, score: number): number {
    let confidence = 0.5; // 基础置信度

    // 数据完整性对置信度的影响
    if (context.historicalData) confidence += 0.15;
    if (context.financialData) confidence += 0.15;
    if (context.previousResults && context.previousResults.length > 0) confidence += 0.1;

    // 分析质量对置信度的影响
    if (analysis.includes("具体数值") || analysis.includes("计算")) confidence += 0.1;
    if (analysis.includes("统计") || analysis.includes("量化")) confidence += 0.1;
    if (analysis.includes("回测") || analysis.includes("历史")) confidence += 0.05;

    // 评分的极端值会降低置信度（可能过于武断）
    if (score > 80 || score < 20) {
      confidence -= 0.1;
    }

    return Math.min(Math.max(confidence, 0.1), 0.95); // 确保在合理范围内
  }

  /**
   * 提取量化洞察
   */
  private extractQuantitativeInsights(analysis: string): string[] {
    const insights: string[] = [];

    // 量化相关关键词
    const quantKeywords = [
      "技术指标", "RSI", "MACD", "布林带", 
      "估值", "PE", "PB", "盈利增长",
      "统计", "量化", "模型", "回测",
      "风险", "收益", "概率"
    ];

    const sentences = analysis.split(/[。！？]/);
    sentences.forEach(sentence => {
      quantKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 15) {
          insights.push(sentence.trim());
        }
      });
    });

    return insights.slice(0, 6); // 最多返回6个量化洞察
  }

  /**
   * 识别量化风险
   */
  private identifyQuantitativeRisks(analysis: string): string[] {
    const risks: string[] = [];

    // 量化模型常见风险
    const commonQuantRisks = [
      "模型基于历史数据，未来表现可能不同",
      "市场极端情况下模型可能失效", 
      "量化指标存在滞后性",
      "模型假设条件可能发生变化"
    ];

    // 从分析中提取风险相关内容
    const riskKeywords = ["风险", "局限", "假设", "不确定", "波动", "回撤", "失效"];
    const sentences = analysis.split(/[。！？]/);
    
    sentences.forEach(sentence => {
      riskKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 10) {
          risks.push(sentence.trim());
        }
      });
    });

    // 如果没有从分析中提取到风险，添加通用量化风险
    if (risks.length === 0) {
      risks.push(...commonQuantRisks.slice(0, 3));
    }

    return risks.slice(0, 5); // 最多返回5个风险点
  }
}