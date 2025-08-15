import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent } from '../base/base-agent';
import { AgentType, AgentContext, AgentConfig, AgentResult, TradingRecommendation } from '../interfaces/agent.interface';
import { LLMService } from '../services/llm.service';

/**
 * 保守型交易员智能体 - 以风险控制为第一要务
 */
@Injectable()
export class ConservativeTraderAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>('CONSERVATIVE_TRADER_MODEL', configService.get<string>('DASHSCOPE_STANDARD_MODEL', 'qwen-plus')),
      temperature: configService.get<number>('CONSERVATIVE_TRADER_TEMPERATURE', 0.5),
      maxTokens: configService.get<number>('CONSERVATIVE_TRADER_MAX_TOKENS', 2500),
      timeout: configService.get<number>('CONSERVATIVE_TRADER_TIMEOUT', configService.get<number>('LLM_DEFAULT_TIMEOUT', 45)),
      retryCount: configService.get<number>('CONSERVATIVE_TRADER_RETRY_COUNT', configService.get<number>('LLM_MAX_RETRIES', 3)),
      systemPrompt: `您是一位专业的保守型交易智能体，以风险控制为第一要务。基于团队分析师的综合分析，您需要做出谨慎的投资决策。

🛡️ 风险控制原则：
1. 风险第一，收益第二 - 永远不要冒险超过可承受的损失
2. 严格止损，保护本金 - 设定明确的止损点并严格执行
3. 分散投资，降低风险 - 避免过度集中在单一投资
4. 基于数据，理性决策 - 依据客观分析而非情绪

📊 决策框架：
1. 风险评估：评估潜在损失和概率
2. 收益分析：计算风险调整后的预期收益
3. 仓位管理：确定合适的投资比例
4. 退出策略：设定止损和止盈点

📋 必须包含的要素：
- 风险等级评估（低/中/高）
- 具体的止损点位
- 建议的最大仓位比例
- 详细的风险提示

💭 决策考虑因素：
- 当前市场环境和波动性
- 公司基本面的稳定性
- 技术指标的确认信号
- 宏观经济和行业风险

请基于综合分析提供谨慎的投资建议，必须以'最终交易建议: **买入/持有/卖出**'结束您的回应，以确认您的建议。

请用中文提供专业、谨慎的交易决策分析。`,
    };

    super(
      '保守型交易员',
      AgentType.CONSERVATIVE_TRADER,
      '专业的保守型交易员，以风险控制和资本保护为核心',
      llmService,
      undefined, // dataToolkit 暂时不需要
      config
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    const { stockCode, stockName, previousResults } = context;
    
    let prompt = `作为保守型交易员，请基于团队分析师的综合研究，对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 做出谨慎的投资决策。\n\n`;

    // 整合所有分析师的结果
    if (previousResults && previousResults.length > 0) {
      prompt += `## 团队分析师研究汇总\n\n`;
      
      let totalScore = 0;
      let scoreCount = 0;
      const recommendations: string[] = [];
      const allRisks: string[] = [];
      const allInsights: string[] = [];

      previousResults.forEach((result) => {
        prompt += `### ${result.agentName} (${result.agentType})\n`;
        prompt += `- **评分**: ${result.score || 'N/A'}\n`;
        prompt += `- **建议**: ${result.recommendation || 'N/A'}\n`;
        prompt += `- **置信度**: ${result.confidence ? (result.confidence * 100).toFixed(1) + '%' : 'N/A'}\n`;
        
        if (result.keyInsights && result.keyInsights.length > 0) {
          prompt += `- **关键洞察**: ${result.keyInsights.join(', ')}\n`;
          allInsights.push(...result.keyInsights);
        }
        
        if (result.risks && result.risks.length > 0) {
          prompt += `- **风险提示**: ${result.risks.join(', ')}\n`;
          allRisks.push(...result.risks);
        }
        
        prompt += `- **分析摘要**: ${result.analysis.substring(0, 150)}...\n\n`;

        // 收集评分和建议
        if (result.score) {
          totalScore += result.score;
          scoreCount++;
        }
        if (result.recommendation) {
          recommendations.push(result.recommendation);
        }
      });

      // 计算平均评分
      const avgScore = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : 'N/A';
      prompt += `**团队平均评分**: ${avgScore}\n`;
      prompt += `**建议分布**: ${recommendations.join(', ')}\n`;
      prompt += `**主要风险**: ${allRisks.slice(0, 5).join(', ')}\n\n`;
    }

    prompt += `## 请进行保守型交易决策分析

基于以上团队分析师的研究，请从保守交易员的角度进行综合评估：

### 1. 风险评估矩阵
请对以下风险维度进行评估（低/中/高）：
- **市场风险**: 
- **流动性风险**: 
- **基本面风险**: 
- **技术面风险**: 
- **行业风险**: 
- **宏观风险**: 

### 2. 综合分析评估

#### 2.1 多方观点整合
- 分析师观点的一致性程度
- 分歧点的合理性评估
- 关键分歧的风险影响

#### 2.2 保守策略考量
- 最坏情况下的风险承受能力
- 不确定性因素的影响评估
- 安全边际的充足性

#### 2.3 时机选择分析
- 当前是否为合适的入场时机
- 等待更好时机的必要性
- 分批建仓的可行性

### 3. 风险控制方案

#### 3.1 仓位管理
- **建议仓位比例**: [具体百分比]
- **最大允许仓位**: [具体百分比]
- **分批建仓计划**: [如适用]

#### 3.2 止损策略
- **技术止损位**: [具体价格]
- **基本面止损条件**: [具体条件]
- **时间止损**: [如适用]

#### 3.3 止盈策略
- **第一目标位**: [具体价格]
- **最终目标位**: [具体价格]
- **分批止盈计划**: [如适用]

### 4. 风险提示清单
请详细列出投资该股票需要关注的风险：
- [ ] 财务风险
- [ ] 行业风险
- [ ] 市场风险
- [ ] 流动性风险
- [ ] 其他特定风险

### 5. 监控要点
投资后需要密切关注的指标和事件：
- 关键财务指标变化
- 重要新闻事件
- 技术指标信号
- 市场情绪变化

### 6. 保守型交易决策

#### 6.1 综合评估
- **风险调整后评分**: [0-100分]
- **风险等级**: [低/中/高]
- **投资确定性**: [高/中/低]
- **时机合适性**: [合适/一般/不合适]

#### 6.2 具体建议
- **主要建议**: [买入/持有/卖出]
- **建议理由**: [核心逻辑]
- **替代方案**: [如主要方案不可行]

#### 6.3 执行计划
- **执行时机**: [立即/等待/分批]
- **预期持有期**: [短期/中期/长期]
- **复评周期**: [每日/每周/每月]

### 7. 保守策略总结表格

| 评估维度 | 评级 | 说明 | 应对策略 |
|----------|------|------|----------|
| 总体风险 | | | |
| 收益潜力 | | | |
| 确定性 | | | |
| 时机性 | | | |

**最终交易建议**: [在此明确说明最终建议]

请确保分析客观、谨慎，充分考虑保本的重要性。`;

    return prompt;
  }

  protected async postprocessResult(analysis: string, context: AgentContext): Promise<AgentResult> {
    const result = await super.postprocessResult(analysis, context);
    
    // 保守交易员的特殊处理
    
    // 1. 调整评分 - 更加保守
    if (result.score) {
      if (result.score > 80) {
        result.score = Math.min(75, result.score - 5); // 高分时适度降低
      } else if (result.score < 30) {
        result.score = Math.max(20, result.score - 5); // 低分时进一步降低
      }
    }

    // 2. 调整交易建议 - 倾向于保守
    if (result.recommendation === TradingRecommendation.STRONG_BUY) {
      result.recommendation = TradingRecommendation.BUY;
    } else if (result.recommendation === TradingRecommendation.STRONG_SELL) {
      result.recommendation = TradingRecommendation.SELL;
    }

    // 3. 确保有风险提示
    if (!result.risks || result.risks.length === 0) {
      result.risks = ['市场波动风险', '流动性风险', '基本面变化风险'];
    }

    // 4. 提取止损和仓位信息
    result.supportingData = result.supportingData || {};
    
    // 提取止损位
    const stopLossMatch = analysis.match(/止损位?[:：]\s*([0-9.]+)/i);
    if (stopLossMatch) {
      result.supportingData.stopLoss = parseFloat(stopLossMatch[1]);
    }

    // 提取仓位建议
    const positionMatch = analysis.match(/仓位比例[:：]\s*([0-9.]+)%/i);
    if (positionMatch) {
      result.supportingData.positionSize = parseFloat(positionMatch[1]) / 100;
    }

    // 提取目标价
    const targetMatch = analysis.match(/目标价?[:：]\s*([0-9.]+)/i);
    if (targetMatch) {
      result.supportingData.targetPrice = parseFloat(targetMatch[1]);
    }

    return result;
  }
}