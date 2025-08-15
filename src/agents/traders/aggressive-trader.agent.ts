import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent } from '../base/base-agent';
import { AgentType, AgentContext, AgentConfig, AgentResult, TradingRecommendation } from '../interfaces/agent.interface';
import { LLMService } from '../services/llm.service';

/**
 * 激进型交易员智能体 - 专注于捕捉高收益机会
 */
@Injectable()
export class AggressiveTraderAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>('AGGRESSIVE_TRADER_MODEL', configService.get<string>('DASHSCOPE_STANDARD_MODEL', 'qwen-plus')),
      temperature: configService.get<number>('AGGRESSIVE_TRADER_TEMPERATURE', 0.8),
      maxTokens: configService.get<number>('AGGRESSIVE_TRADER_MAX_TOKENS', 2500),
      timeout: configService.get<number>('AGGRESSIVE_TRADER_TIMEOUT', configService.get<number>('LLM_DEFAULT_TIMEOUT', 45)),
      retryCount: configService.get<number>('AGGRESSIVE_TRADER_RETRY_COUNT', configService.get<number>('LLM_MAX_RETRIES', 3)),
      systemPrompt: `您是一位专业的激进型交易智能体，专注于捕捉高收益机会。基于团队分析师的综合分析，您需要做出积极的投资决策。

🚀 增长导向原则：
1. 收益优先，适度风险 - 追求高收益机会，接受相应风险
2. 趋势跟随，动量投资 - 识别并跟随强势趋势
3. 快速行动，抓住机会 - 在机会窗口内果断行动
4. 数据驱动，灵活调整 - 基于市场变化快速调整策略

📈 决策框架：
1. 机会识别：寻找高收益潜力的投资机会
2. 动量分析：评估价格和成交量动量
3. 催化剂评估：识别可能推动股价的因素
4. 时机把握：选择最佳的进入和退出时机

📋 必须包含的要素：
- 收益潜力评估（保守/乐观/激进）
- 关键催化剂因素
- 建议的目标价位
- 动量确认信号

💭 决策考虑因素：
- 技术突破和动量信号
- 基本面改善的催化剂
- 市场情绪和资金流向
- 行业轮动和主题投资机会

请基于综合分析提供积极的投资建议，必须以'最终交易建议: **买入/持有/卖出**'结束您的回应，以确认您的建议。

请用中文提供专业、积极的交易决策分析。`,
    };

    super(
      '激进型交易员',
      AgentType.TRADER,
      '专业的激进型交易员，专注于高收益机会和趋势捕捉',
      llmService,
      config
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    const { stockCode, stockName, previousResults } = context;
    
    let prompt = `作为激进型交易员，请基于团队分析师的综合研究，对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 做出积极的投资决策。\n\n`;

    // 整合所有分析师的结果
    if (previousResults && previousResults.length > 0) {
      prompt += `## 团队分析师研究汇总\n\n`;
      
      let totalScore = 0;
      let scoreCount = 0;
      const recommendations: string[] = [];
      const allInsights: string[] = [];
      const catalysts: string[] = [];

      previousResults.forEach((result) => {
        prompt += `### ${result.agentName} (${result.agentType})\n`;
        prompt += `- **评分**: ${result.score || 'N/A'}\n`;
        prompt += `- **建议**: ${result.recommendation || 'N/A'}\n`;
        prompt += `- **置信度**: ${result.confidence ? (result.confidence * 100).toFixed(1) + '%' : 'N/A'}\n`;
        
        if (result.keyInsights && result.keyInsights.length > 0) {
          prompt += `- **关键洞察**: ${result.keyInsights.join(', ')}\n`;
          allInsights.push(...result.keyInsights);
        }
        
        prompt += `- **分析亮点**: ${result.analysis.substring(0, 150)}...\n\n`;

        // 收集评分和建议
        if (result.score) {
          totalScore += result.score;
          scoreCount++;
        }
        if (result.recommendation) {
          recommendations.push(result.recommendation);
        }

        // 提取催化剂因素
        if (result.analysis.includes('催化剂') || result.analysis.includes('驱动因素')) {
          const catalystMatches = result.analysis.match(/(?:催化剂|驱动因素)[:：][^。]*[。]/g);
          if (catalystMatches) {
            catalysts.push(...catalystMatches);
          }
        }
      });

      // 计算平均评分
      const avgScore = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : 'N/A';
      prompt += `**团队平均评分**: ${avgScore}\n`;
      prompt += `**建议分布**: ${recommendations.join(', ')}\n`;
      prompt += `**关键机会**: ${allInsights.slice(0, 5).join(', ')}\n\n`;
    }

    prompt += `## 请进行激进型交易决策分析

基于以上团队分析师的研究，请从激进交易员的角度进行机会评估：

### 1. 机会评估矩阵
请对以下机会维度进行评估（低/中/高）：
- **上涨潜力**: 
- **动量强度**: 
- **催化剂丰富度**: 
- **技术突破概率**: 
- **资金关注度**: 
- **市场热度**: 

### 2. 综合机会分析

#### 2.1 多方观点优化整合
- 分析师积极观点的可信度
- 乐观预期的实现概率
- 超预期因素的可能性

#### 2.2 激进策略考量
- 最佳情况下的收益潜力
- 快速获利的可能性
- 趋势延续的概率评估

#### 2.3 时机选择分析
- 当前是否为最佳入场时机
- 错过机会的成本评估
- 快速建仓的合理性

### 3. 收益最大化方案

#### 3.1 仓位管理
- **建议仓位比例**: [具体百分比]
- **激进仓位上限**: [具体百分比]
- **快速建仓策略**: [如适用]

#### 3.2 止盈策略
- **第一止盈位**: [具体价格，保守目标]
- **第二止盈位**: [具体价格，乐观目标]
- **激进目标位**: [具体价格，最佳情况]
- **分批止盈计划**: [具体方案]

#### 3.3 风险控制
- **动量止损位**: [具体价格]
- **趋势止损位**: [具体价格]
- **时间止损**: [如适用]

### 4. 催化剂因素分析
请识别可能推动股价上涨的积极因素：
- [ ] 业绩超预期
- [ ] 新产品发布
- [ ] 政策利好
- [ ] 行业复苏
- [ ] 技术突破
- [ ] 市场重估

### 5. 动量指标监控
投资后需要密切关注的动量信号：
- 成交量放大确认
- 技术指标强势确认
- 资金流入监控
- 市场情绪指标

### 6. 激进型交易决策

#### 6.1 综合评估
- **收益潜力评分**: [0-100分]
- **动量强度**: [强/中/弱]
- **机会确定性**: [高/中/低]
- **时机紧迫性**: [紧迫/一般/不急]

#### 6.2 具体建议
- **主要建议**: [强烈买入/买入/持有]
- **建议理由**: [核心机会逻辑]
- **加仓条件**: [触发加仓的条件]

#### 6.3 执行计划
- **执行时机**: [立即/等待确认/分批]
- **预期收益**: [保守/乐观/激进估计]
- **监控频率**: [实时/日内/每日]

### 7. 机会评估总结表格

| 评估维度 | 评级 | 说明 | 执行策略 |
|----------|------|------|----------|
| 上涨空间 | | | |
| 动量强度 | | | |
| 催化剂 | | | |
| 确定性 | | | |

### 8. 超额收益策略
- 如何在趋势中获得超额收益
- 波段操作的可能性
- 杠杆使用的考虑（如适用）

**最终交易建议**: [在此明确说明最终建议]

请确保分析积极但现实，充分挖掘投资机会和上涨潜力。`;

    return prompt;
  }

  protected async postprocessResult(analysis: string, context: AgentContext): Promise<AgentResult> {
    const result = await super.postprocessResult(analysis, context);
    
    // 激进交易员的特殊处理
    
    // 1. 调整评分 - 更加乐观
    if (result.score) {
      if (result.score > 60) {
        result.score = Math.min(95, result.score + 10); // 高分时进一步提升
      } else if (result.score < 40) {
        result.score = Math.max(30, result.score); // 低分时保持相对乐观
      }
    }

    // 2. 调整交易建议 - 倾向于积极
    if (result.recommendation === TradingRecommendation.BUY && result.score && result.score > 75) {
      result.recommendation = TradingRecommendation.STRONG_BUY;
    } else if (result.recommendation === TradingRecommendation.HOLD && result.score && result.score > 65) {
      result.recommendation = TradingRecommendation.BUY;
    }

    // 3. 提升置信度对于积极机会
    if (result.confidence && result.score && result.score > 70) {
      result.confidence = Math.min(0.95, result.confidence + 0.1);
    }

    // 4. 提取交易相关信息
    result.supportingData = result.supportingData || {};
    
    // 提取目标价位
    const targetMatches = analysis.match(/目标位?[:：]\s*([0-9.]+)/gi);
    if (targetMatches && targetMatches.length > 0) {
      const targets = targetMatches.map(match => {
        const price = match.match(/([0-9.]+)/);
        return price ? parseFloat(price[1]) : null;
      }).filter(Boolean);
      
      if (targets.length > 0) {
        result.supportingData.targetPrices = targets;
        result.supportingData.primaryTarget = Math.max(...targets);
      }
    }

    // 提取仓位建议
    const positionMatch = analysis.match(/仓位比例[:：]\s*([0-9.]+)%/i);
    if (positionMatch) {
      result.supportingData.positionSize = parseFloat(positionMatch[1]) / 100;
    }

    // 提取催化剂因素
    const catalystSection = analysis.match(/催化剂因素[^#]*?(?=#|$)/i);
    if (catalystSection) {
      const catalysts = catalystSection[0].match(/- \[[x ]\] ([^\\n]+)/g);
      if (catalysts) {
        result.supportingData.catalysts = catalysts.map(c => c.replace(/- \[[x ]\] /, ''));
      }
    }

    return result;
  }
}