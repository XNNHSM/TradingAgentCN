import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent } from '../base/base-agent';
import { AgentType, AgentContext, AgentConfig, AgentResult, TradingRecommendation } from '../interfaces/agent.interface';
import { LLMService } from '../services/llm.service';

/**
 * 反思智能体 - 专门进行质量控制和综合评估
 */
@Injectable()
export class ReflectionAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>('REFLECTION_AGENT_MODEL', configService.get<string>('DASHSCOPE_STANDARD_MODEL', 'qwen-plus')),
      temperature: configService.get<number>('REFLECTION_AGENT_TEMPERATURE', 0.4),
      maxTokens: configService.get<number>('REFLECTION_AGENT_MAX_TOKENS', 3000),
      timeout: configService.get<number>('REFLECTION_AGENT_TIMEOUT', configService.get<number>('LLM_DEFAULT_TIMEOUT', 60)),
      retryCount: configService.get<number>('REFLECTION_AGENT_RETRY_COUNT', configService.get<number>('LLM_MAX_RETRIES', 3)),
      systemPrompt: `您是一位专业的金融分析专家，负责审查交易决策/分析并提供全面的逐步分析。
您的目标是对投资决策提供详细洞察，并突出改进机会，严格遵循以下准则：

🔍 1. 推理分析：
   - 对于每个交易决策，判断其是否正确。正确的决策会带来收益增加，错误的决策则相反
   - 分析每个成功或错误的贡献因素，考虑：
     * 市场情报质量和准确性
     * 技术指标的有效性和时机
     * 技术信号的强度和确认
     * 价格走势分析的准确性
     * 整体市场数据分析的深度
     * 新闻分析的相关性和影响评估
     * 社交媒体和情绪分析的可靠性
     * 基本面数据分析的全面性
     * 在决策过程中各因素的权重分配

📈 2. 改进建议：
   - 对于任何错误决策，提出修正方案以最大化收益
   - 提供详细的纠正措施或改进清单，包括具体建议
   - 例如：在特定日期将决策从持有改为买入

📚 3. 经验总结：
   - 总结从成功和失败中学到的经验教训
   - 突出这些经验如何适用于未来的交易场景
   - 在相似情况之间建立联系，以应用所获得的知识

🎯 4. 关键洞察提取：
   - 将总结中的关键洞察提取为不超过1000个token的简洁句子
   - 确保浓缩的句子捕捉到经验教训和推理的精髓，便于参考

严格遵循这些指示，确保您的输出详细、准确且可操作。您还将获得市场的客观描述，从价格走势、技术指标、新闻和情绪角度为您的分析提供更多背景。

请用中文提供专业、深入的反思分析。`,
    };

    super(
      '反思智能体',
      AgentType.REFLECTION_AGENT,
      '专业的反思分析师，负责质量控制和决策优化',
      llmService,
      config
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    const { stockCode, stockName, previousResults } = context;
    
    let prompt = `作为反思智能体，请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 的团队分析进行全面的质量控制和反思评估。\n\n`;

    // 分析所有前序结果
    if (previousResults && previousResults.length > 0) {
      prompt += `## 团队分析师完整报告\n\n`;
      
      const analysisTypes = {
        market_analyst: '市场分析师',
        fundamental_analyst: '基本面分析师', 
        news_analyst: '新闻分析师',
        bull_researcher: '多头研究员',
        bear_researcher: '空头研究员',
        trader: '交易员'
      };

      previousResults.forEach((result, index) => {
        const typeName = analysisTypes[result.agentType] || result.agentName;
        
        prompt += `### ${index + 1}. ${typeName}报告\n`;
        prompt += `**评分**: ${result.score || 'N/A'}\n`;
        prompt += `**建议**: ${result.recommendation || 'N/A'}\n`;
        prompt += `**置信度**: ${result.confidence ? (result.confidence * 100).toFixed(1) + '%' : 'N/A'}\n`;
        prompt += `**处理时间**: ${result.processingTime || 'N/A'}ms\n`;
        
        if (result.keyInsights && result.keyInsights.length > 0) {
          prompt += `**关键洞察**:\n${result.keyInsights.map(insight => `- ${insight}`).join('\n')}\n`;
        }
        
        if (result.risks && result.risks.length > 0) {
          prompt += `**风险提示**:\n${result.risks.map(risk => `- ${risk}`).join('\n')}\n`;
        }
        
        prompt += `**完整分析**:\n${result.analysis}\n\n`;
        
        if (result.supportingData && Object.keys(result.supportingData).length > 0) {
          prompt += `**支撑数据**: ${JSON.stringify(result.supportingData, null, 2)}\n\n`;
        }
        
        prompt += `---\n\n`;
      });
    }

    prompt += `## 请进行全面的反思分析

基于以上所有分析师的报告，请按照以下结构进行深度反思：

### 1. 分析质量评估

#### 1.1 个体分析师评估
对每位分析师的表现进行评估：
- **市场分析师**: 技术分析的准确性和深度
- **基本面分析师**: 财务分析的全面性和前瞻性
- **新闻分析师**: 信息整合和影响评估的有效性
- **多头研究员**: 机会识别和论证的说服力
- **空头研究员**: 风险识别和谨慎评估的合理性
- **交易员**: 决策逻辑和风险控制的实用性

#### 1.2 团队协作效果
- 不同观点的互补性
- 信息覆盖的完整性
- 分析深度的一致性
- 结论一致性程度

### 2. 逻辑一致性检查

#### 2.1 内部逻辑检验
- 各分析师结论之间的逻辑关系
- 评分与建议的匹配度
- 风险评估与机会评估的平衡性
- 短期和长期观点的一致性

#### 2.2 数据支撑检验
- 分析结论是否有充分数据支撑
- 假设前提是否合理
- 推理过程是否严密
- 关键因素是否遗漏

### 3. 决策质量分析

#### 3.1 多维度评估
请对以下维度进行评估(1-10分)：
- **分析全面性**: 是否覆盖了所有重要方面
- **逻辑严密性**: 推理过程是否严密
- **数据可靠性**: 支撑数据是否可信
- **风险识别**: 是否充分识别了风险
- **机会把握**: 是否准确识别了机会
- **时机判断**: 投资时机选择是否合适
- **实操性**: 建议是否具有可操作性

#### 3.2 决策偏差识别
- 是否存在过度乐观或悲观
- 是否存在确认偏差
- 是否存在锚定效应
- 是否存在群体思维

### 4. 关键分歧点分析

#### 4.1 主要分歧识别
- 多空双方的核心分歧点
- 不同时间维度的观点差异
- 风险偏好导致的建议差异

#### 4.2 分歧合理性评估
- 哪些分歧是合理的不确定性
- 哪些分歧可能存在认知偏差
- 如何协调不同观点

### 5. 改进建议

#### 5.1 分析质量改进
- 数据收集方面的改进建议
- 分析方法的优化建议
- 团队协作的改进方向

#### 5.2 决策流程优化
- 权重分配的优化建议
- 风险控制的加强措施
- 执行策略的细化建议

### 6. 综合评估与建议

#### 6.1 团队综合表现评估
- **整体评分**: [0-100分]
- **分析可信度**: [高/中/低]
- **决策合理性**: [合理/基本合理/存在问题]
- **执行难度**: [低/中/高]

#### 6.2 最终投资建议整合
基于全面反思，提供最终建议：
- **反思后评分**: [综合所有因素的最终评分]
- **反思后建议**: [买入/持有/卖出]
- **置信度**: [对最终建议的置信程度]
- **关键依据**: [最核心的3-5个决策依据]

#### 6.3 风险控制建议
- **主要风险点**: [需要重点关注的风险]
- **风险缓解措施**: [具体的风险管理建议]
- **止损策略**: [明确的止损条件]

### 7. 经验教训总结

#### 7.1 成功要素识别
- 本次分析中的成功之处
- 可复制的分析方法
- 值得推广的决策逻辑

#### 7.2 改进空间分析
- 分析中的不足之处
- 可以优化的环节
- 未来需要加强的能力

### 8. 反思总结表格

| 评估维度 | 得分 | 优势 | 不足 | 改进建议 |
|----------|------|------|------|----------|
| 技术分析 | | | | |
| 基本面分析 | | | | |
| 新闻分析 | | | | |
| 风险评估 | | | | |
| 机会识别 | | | | |
| 决策执行 | | | | |

### 9. 关键洞察提取
请提取本次分析的核心洞察(不超过5条)：
1. [核心洞察1]
2. [核心洞察2]
3. [核心洞察3]
4. [核心洞察4]
5. [核心洞察5]

### 10. 未来监控要点
基于本次分析，列出需要持续关注的关键指标和事件：
- 技术指标监控点
- 基本面变化监控点
- 新闻事件关注点
- 市场情绪跟踪点

请确保反思分析客观、深入，既要肯定团队的优秀表现，也要指出可以改进的地方。`;

    return prompt;
  }

  protected async postprocessResult(analysis: string, context: AgentContext): Promise<AgentResult> {
    const result = await super.postprocessResult(analysis, context);
    
    // 反思智能体的特殊处理
    
    // 1. 提取团队整体评分
    const teamScoreMatch = analysis.match(/(?:整体评分|团队评分)[:：]\s*([0-9.]+)/i);
    if (teamScoreMatch) {
      result.supportingData = result.supportingData || {};
      result.supportingData.teamScore = parseFloat(teamScoreMatch[1]);
    }

    // 2. 提取反思后的最终建议
    const finalRecommendationMatch = analysis.match(/反思后建议[:：]\s*([^\\n]+)/i);
    if (finalRecommendationMatch) {
      const recommendation = finalRecommendationMatch[1].trim();
      if (recommendation.includes('买入')) {
        result.recommendation = TradingRecommendation.BUY;
      } else if (recommendation.includes('卖出')) {
        result.recommendation = TradingRecommendation.SELL;
      } else {
        result.recommendation = TradingRecommendation.HOLD;
      }
    }

    // 3. 提取关键洞察
    const insightsSection = analysis.match(/关键洞察提取[^#]*?(?=#|$)/is);
    if (insightsSection) {
      const insights = insightsSection[0].match(/\d+\.\s*\[([^\]]+)\]/g);
      if (insights) {
        result.keyInsights = insights.map(insight => 
          insight.replace(/\d+\.\s*\[([^\]]+)\]/, '$1')
        );
      }
    }

    // 4. 提取改进建议作为风险提示
    const improvementSection = analysis.match(/改进建议[^#]*?(?=#|$)/is);
    if (improvementSection) {
      const improvements = improvementSection[0].match(/[-•]\s*([^\\n]+)/g);
      if (improvements) {
        result.risks = improvements.slice(0, 3).map(item => 
          item.replace(/[-•]\s*/, '').trim()
        );
      }
    }

    // 5. 计算综合置信度（基于团队一致性）
    if (context.previousResults && context.previousResults.length > 0) {
      const recommendations = context.previousResults
        .map(r => r.recommendation)
        .filter(Boolean);
      
      const scores = context.previousResults
        .map(r => r.score)
        .filter(Boolean);

      // 基于建议一致性计算置信度
      const mostCommonRecommendation = this.getMostCommon(recommendations);
      const consistencyRatio = recommendations.filter(r => r === mostCommonRecommendation).length / recommendations.length;
      
      // 基于评分标准差计算一致性
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);
      const scoreConsistency = Math.max(0, 1 - stdDev / 50); // 标准差越小，一致性越高

      result.confidence = (consistencyRatio * 0.6 + scoreConsistency * 0.4);
      result.supportingData = result.supportingData || {};
      result.supportingData.teamConsistency = {
        recommendationConsistency: consistencyRatio,
        scoreConsistency: scoreConsistency,
        avgScore: avgScore,
        scoreStdDev: stdDev
      };
    }

    return result;
  }

  /**
   * 获取数组中最常出现的元素
   */
  private getMostCommon<T>(arr: T[]): T {
    const counts = arr.reduce((acc, val) => {
      acc[val as string] = (acc[val as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b) as T;
  }
}