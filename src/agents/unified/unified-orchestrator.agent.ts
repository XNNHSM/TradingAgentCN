import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {BaseAgent} from "../base/base-agent";
import {AgentConfig, AgentContext, AgentResult, AgentType, TradingRecommendation,} from "../interfaces/agent.interface";
import {LLMService} from "../services/llm.service";
import {AgentExecutionRecordService} from "../services/agent-execution-record.service";

/**
 * 统一协调器智能体
 * 整合所有智能体的分析结果，生成最终的投资决策和建议
 * 负责智能体协调、结果整合和最终决策生成
 */
@Injectable()
export class UnifiedOrchestratorAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
    executionRecordService: AgentExecutionRecordService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "UNIFIED_ORCHESTRATOR_MODEL",
        configService.get<string>("LLM_DEFAULT_MODEL", "qwen-max"), // 最终决策需要强模型
      ),
      temperature: configService.get<number>(
        "UNIFIED_ORCHESTRATOR_TEMPERATURE",
        0.4, // 较低温度确保决策稳定性
      ),
      maxTokens: configService.get<number>(
        "UNIFIED_ORCHESTRATOR_MAX_TOKENS",
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 4500),
      ),
      timeout: configService.get<number>(
        "UNIFIED_ORCHESTRATOR_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 120), // 更长超时
      ),
      retryCount: configService.get<number>(
        "UNIFIED_ORCHESTRATOR_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
      systemPrompt: `您是一位资深的投资决策协调专家，负责整合所有分析师的观点并生成最终的投资决策。您具备以下核心能力：

🎯 **核心职责**:
1. **多维度整合**: 综合技术、基本面、情绪、宏观等多个维度的分析
2. **权重分配**: 根据市场环境和股票特性动态调整各分析的权重
3. **风险平衡**: 在收益机会和风险控制之间找到最佳平衡点
4. **决策生成**: 形成明确、可操作的投资建议和执行策略

📊 **分析框架**:

**基础权重配置**:
- 综合分析师（技术+基本面+新闻）: 40%
- 交易策略师（交易策略+风险管控）: 30%
- 量化交易员（数据驱动决策）: 20%
- 宏观经济分析师（宏观环境分析）: 15%
- 社交媒体分析师（情绪分析）: 10%

**动态权重调整原则**:
- 高波动市场：提高量化分析和风险管控权重
- 政策密集期：提高宏观分析权重
- 财报季：提高基本面分析权重
- 情绪极端时：适当考虑社交媒体分析

🔍 **决策流程**:
1. **观点整理**: 梳理各智能体的核心观点和建议
2. **一致性分析**: 识别观点的一致性和分歧点
3. **权重计算**: 基于当前环境动态调整权重
4. **风险评估**: 综合评估各类风险和不确定性
5. **决策生成**: 形成最终的投资建议和执行方案
6. **执行策略**: 提供具体的买卖点位和仓位管理建议

💡 **输出要求**:
- **执行摘要**: 简洁明了的投资建议概述
- **综合评分**: 0-100分的量化评分
- **投资建议**: 明确的买入/持有/卖出建议
- **关键逻辑**: 支撑决策的核心逻辑链条
- **风险提示**: 主要风险点和应对措施
- **执行策略**: 具体的操作建议（价位、仓位、止损等）
- **监控要点**: 后续需要重点关注的指标和事件

⚙️ **决策原则**:
1. **数据驱动**: 基于客观数据和分析结果决策
2. **风险优先**: 在追求收益的同时严格控制风险
3. **动态调整**: 根据市场变化和新信息及时调整
4. **可执行性**: 提供具体可操作的投资指导
5. **透明度**: 清晰说明决策逻辑和依据

⚠️ **重要提醒**:
- 必须整合所有提供的分析结果
- 对分歧观点要明确说明如何处理
- 所有建议都要有具体的数据支撑
- 必须提供风险控制措施
- 必须以'**最终投资决策: 买入/持有/卖出**'结束回应

请用中文提供专业、全面的投资决策分析。`,
    };

    super(
      "统一协调器",
      AgentType.UNIFIED_ORCHESTRATOR,
      "资深投资决策协调专家，整合所有分析并生成最终投资决策",
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
    // 验证是否有其他智能体的分析结果
    if (!context.previousResults || context.previousResults.length === 0) {
      throw new Error('需要至少一个其他分析师的分析结果才能进行协调');
    }

    return {
      ...context,
      metadata: {
        ...context.metadata,
        analysisData: {
          previousResults: context.previousResults,
          analysisType: context.metadata?.analysisType || 'orchestration_analysis'
        }
      }
    };
  }

  /**
   * 执行协调分析 - 调用LLM进行分析
   */
  protected async executeAnalysis(context: AgentContext): Promise<string> {
    // 构建协调分析提示词
    const analysisPrompt = this.buildOrchestrationPrompt(context);

    // 调用LLM进行协调分析
    return await this.callLLM(analysisPrompt);
  }

  /**
   * 处理结果 - 将分析结果转换为AgentResult格式
   */
  protected async processResult(analysis: string, context: AgentContext): Promise<AgentResult> {
    // 从协调结果中提取评分和建议
    const score = this.extractFinalScore(analysis);
    const recommendation = this.extractFinalRecommendation(analysis);

    return {
      agentName: this.name,
      agentType: this.type,
      analysis,
      score,
      recommendation,
      confidence: this.calculateOrchestrationConfidence(context, analysis),
      keyInsights: this.extractOrchestrationInsights(analysis),
      risks: this.identifyOrchestrationRisks(analysis),
      supportingData: {
        orchestrationWeights: {
          comprehensive_analyst: "40%",
          trading_strategist: "30%", 
          quantitative_trader: "20%",
          macro_economist: "15%",
          social_media_analyst: "10%"
        },
        inputAgents: context.previousResults?.map(r => r.agentType) || [],
        decisionFramework: [
          "观点整理", "一致性分析", "权重计算", 
          "风险评估", "决策生成", "执行策略"
        ],
        timeRange: context.timeRange,
      },
      timestamp: new Date(),
    };
  }

  /**
   * 实现抽象方法：构建分析提示词
   */
  protected async buildPrompt(context: AgentContext): Promise<string> {
    return this.buildOrchestrationPrompt(context);
  }

  /**
   * 构建协调分析提示词
   */
  private buildOrchestrationPrompt(context: AgentContext): string {
    const { stockCode, stockName } = context;

    let prompt = `请作为统一协调器，整合所有分析师的观点，对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 生成最终的投资决策。\n\n`;

    // 验证是否有足够的分析结果
    if (!context.previousResults || context.previousResults.length === 0) {
      prompt += `⚠️ **注意**: 当前没有其他分析师的输入，请基于可用信息进行基础分析。\n\n`;
    } else {
      prompt += `**各分析师观点汇总**:\n`;
      
      // 按智能体类型组织分析结果
      const resultsByType: Record<string, AgentResult[]> = {};
      context.previousResults.forEach(result => {
        if (!resultsByType[result.agentType]) {
          resultsByType[result.agentType] = [];
        }
        resultsByType[result.agentType].push(result);
      });

      // 详细展示每个分析师的观点
      Object.entries(resultsByType).forEach(([agentType, results]) => {
        results.forEach((result, index) => {
          prompt += `\n### ${result.agentName} (${agentType})\n`;
          prompt += `- **分析**: ${result.analysis}\n`;
          prompt += `- **评分**: ${result.score || 'N/A'}\n`;
          prompt += `- **建议**: ${result.recommendation || 'N/A'}\n`;
          prompt += `- **置信度**: ${result.confidence ? (result.confidence * 100).toFixed(1) + '%' : 'N/A'}\n`;
          if (result.keyInsights && result.keyInsights.length > 0) {
            prompt += `- **关键洞察**: ${result.keyInsights.join('; ')}\n`;
          }
          if (result.risks && result.risks.length > 0) {
            prompt += `- **风险提示**: ${result.risks.join('; ')}\n`;
          }
        });
      });
    }

    prompt += `\n**请按照以下步骤进行协调分析**:\n\n`;

    prompt += `1. **观点分析**:
   - 识别各分析师观点的一致性和分歧点
   - 分析不同观点的合理性和可信度
   - 评估各分析师的专业强项和局限性

2. **权重分配**:
   - 基于当前市场环境动态调整各分析的权重
   - 考虑各智能体分析质量和置信度
   - 说明权重调整的具体原因

3. **风险综合评估**:
   - 整合各分析师识别的风险点
   - 评估风险的概率和影响程度
   - 提出相应的风险控制措施

4. **最终决策**:
   - 综合所有信息形成最终投资建议
   - 提供具体的执行策略（买入价位、仓位比例、止损点等）
   - 设定监控指标和调整条件

请确保决策逻辑清晰、依据充分，并提供可执行的投资指导。`;

    return prompt;
  }

  /**
   * 提取最终评分
   */
  private extractFinalScore(analysis: string): number {
    // 尝试从分析中提取最终评分
    const scorePatterns = [
      /最终评分[：:]\s*(\d+(?:\.\d+)?)/i,
      /综合评分[：:]\s*(\d+(?:\.\d+)?)/i,
      /总体得分[：:]\s*(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*分/
    ];

    for (const pattern of scorePatterns) {
      const match = analysis.match(pattern);
      if (match) {
        const score = parseFloat(match[1]);
        return Math.min(Math.max(score, 0), 100);
      }
    }

    // 基于建议关键词估算评分
    const lowerAnalysis = analysis.toLowerCase();
    if (lowerAnalysis.includes("强买入") || lowerAnalysis.includes("strong buy")) {
      return 85;
    } else if (lowerAnalysis.includes("买入") || lowerAnalysis.includes("buy")) {
      return 70;
    } else if (lowerAnalysis.includes("强卖出") || lowerAnalysis.includes("strong sell")) {
      return 15;
    } else if (lowerAnalysis.includes("卖出") || lowerAnalysis.includes("sell")) {
      return 30;
    } else {
      return 50; // 持有
    }
  }

  /**
   * 提取最终交易建议
   */
  private extractFinalRecommendation(analysis: string): TradingRecommendation {
    const lowerAnalysis = analysis.toLowerCase();

    // 查找明确的决策语句
    if (lowerAnalysis.includes("最终投资决策") || lowerAnalysis.includes("最终决策")) {
      if (lowerAnalysis.includes("强买入")) return TradingRecommendation.STRONG_BUY;
      if (lowerAnalysis.includes("买入")) return TradingRecommendation.BUY;
      if (lowerAnalysis.includes("强卖出")) return TradingRecommendation.STRONG_SELL;
      if (lowerAnalysis.includes("卖出")) return TradingRecommendation.SELL;
      if (lowerAnalysis.includes("持有")) return TradingRecommendation.HOLD;
    }

    // 基于整体语调判断
    if (lowerAnalysis.includes("强烈推荐") || lowerAnalysis.includes("积极买入")) {
      return TradingRecommendation.STRONG_BUY;
    } else if (lowerAnalysis.includes("推荐买入") || lowerAnalysis.includes("建议买入")) {
      return TradingRecommendation.BUY;
    } else if (lowerAnalysis.includes("强烈卖出") || lowerAnalysis.includes("积极减持")) {
      return TradingRecommendation.STRONG_SELL;
    } else if (lowerAnalysis.includes("建议卖出") || lowerAnalysis.includes("减持")) {
      return TradingRecommendation.SELL;
    }

    return TradingRecommendation.HOLD; // 默认持有
  }

  /**
   * 计算协调分析置信度
   */
  private calculateOrchestrationConfidence(context: AgentContext, analysis: string): number {
    let confidence = 0.6; // 基础置信度

    // 输入数据质量对置信度的影响
    const inputCount = context.previousResults?.length || 0;
    confidence += Math.min(inputCount * 0.1, 0.3); // 每个输入+0.1，最多+0.3

    // 输入置信度的平均值
    if (context.previousResults && context.previousResults.length > 0) {
      const avgInputConfidence = context.previousResults
        .filter(r => r.confidence)
        .reduce((sum, r) => sum + (r.confidence || 0), 0) / context.previousResults.length;
      confidence += avgInputConfidence * 0.2; // 输入置信度的20%权重
    }

    // 分析质量对置信度的影响
    if (analysis.includes("权重") || analysis.includes("整合")) confidence += 0.05;
    if (analysis.includes("风险控制") || analysis.includes("执行策略")) confidence += 0.05;
    if (analysis.includes("具体") || analysis.includes("明确")) confidence += 0.05;

    // 协调分析通常比单一分析更可靠
    confidence += 0.1;

    return Math.min(confidence, 0.95); // 最高95%置信度
  }

  /**
   * 提取协调洞察
   */
  private extractOrchestrationInsights(analysis: string): string[] {
    const insights: string[] = [];

    // 协调分析关键词
    const orchestrationKeywords = [
      "一致性", "分歧", "整合", "权重", "平衡",
      "综合", "协调", "决策", "策略", "执行",
      "监控", "调整", "风险控制", "机会"
    ];

    const sentences = analysis.split(/[。！？]/);
    sentences.forEach(sentence => {
      orchestrationKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 15) {
          insights.push(sentence.trim());
        }
      });
    });

    return insights.slice(0, 8); // 最多返回8个协调洞察
  }

  /**
   * 识别协调风险
   */
  private identifyOrchestrationRisks(analysis: string): string[] {
    const risks: string[] = [];

    // 协调决策常见风险
    const commonOrchestrationRisks = [
      "多重分析可能存在信息偏差叠加",
      "权重分配可能不适应市场快速变化",
      "综合决策可能模糊具体操作时机",
      "不同维度分析的时间滞后性不同"
    ];

    // 从分析中提取风险相关内容
    const riskKeywords = [
      "风险", "不确定", "分歧", "局限", "偏差",
      "变化", "调整", "监控", "控制", "应对"
    ];

    const sentences = analysis.split(/[。！？]/);
    sentences.forEach(sentence => {
      riskKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 10) {
          risks.push(sentence.trim());
        }
      });
    });

    // 如果没有从分析中提取到风险，添加通用协调风险
    if (risks.length === 0) {
      risks.push(...commonOrchestrationRisks.slice(0, 3));
    }

    return risks.slice(0, 5); // 最多返回5个风险点
  }
}