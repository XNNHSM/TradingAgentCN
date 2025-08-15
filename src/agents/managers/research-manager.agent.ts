import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent } from '../base/base-agent';
import { AgentType, AgentContext, AgentConfig } from '../interfaces/agent.interface';
import { LLMService } from '../services/llm.service';

/**
 * 研究管理员智能体 - 协调和评估辩论结果
 */
@Injectable()
export class ResearchManagerAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>('RESEARCH_MANAGER_MODEL', configService.get<string>('DASHSCOPE_PREMIUM_MODEL', 'qwen-max')),
      temperature: configService.get<number>('RESEARCH_MANAGER_TEMPERATURE', 0.7),
      maxTokens: configService.get<number>('RESEARCH_MANAGER_MAX_TOKENS', 3000),
      timeout: configService.get<number>('RESEARCH_MANAGER_TIMEOUT', 60),
      retryCount: configService.get<number>('RESEARCH_MANAGER_RETRY_COUNT', configService.get<number>('LLM_MAX_RETRIES', 3)),
      systemPrompt: `作为投资组合经理和辩论协调员，您的角色是批判性地评估这一轮辩论并做出明确的决定：与看跌分析师保持一致，与看涨分析师保持一致，或者只有在基于所呈现的论据有充分理由的情况下才选择持有。

简洁地总结双方的关键点，重点关注最令人信服的证据或推理。您的建议——买入、卖出或持有——必须明确且可操作。避免仅仅因为双方都有有效观点就默认选择持有；要致力于基于辩论中最有力论据的立场。

此外，为交易员制定详细的投资计划。这应包括：

您的建议：由最具说服力的论据支持的果断立场。
理由：解释为什么这些论据导致您的结论。
战略行动：实施建议的具体步骤。
考虑到您在类似情况下的过去错误。利用这些见解来完善您的决策能力，确保您在学习和改进。以对话方式呈现您的分析，就像自然说话一样，无需特殊格式。

请用中文撰写专业、全面的投资决策分析。`,
    };

    super(
      '研究管理员',
      AgentType.RESEARCH_MANAGER,
      '专业的投资组合经理和辩论协调员，负责评估多空辩论并制定投资计划',
      llmService,
      undefined, // dataToolkit 暂时不需要
      config
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    const { stockCode, stockName, previousResults } = context;
    
    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 的多空辩论进行评估和决策。\n\n`;

    // 添加分析师报告
    if (previousResults && previousResults.length > 0) {
      prompt += `## 分析师报告汇总\n\n`;
      
      // 分类整理各种报告
      const marketReport = previousResults.find(r => r.agentType === AgentType.MARKET_ANALYST)?.analysis || '';
      const fundamentalsReport = previousResults.find(r => r.agentType === AgentType.FUNDAMENTAL_ANALYST)?.analysis || '';
      const newsReport = previousResults.find(r => r.agentType === AgentType.NEWS_ANALYST)?.analysis || '';
      const bullReport = previousResults.find(r => r.agentType === AgentType.BULL_RESEARCHER)?.analysis || '';
      const bearReport = previousResults.find(r => r.agentType === AgentType.BEAR_RESEARCHER)?.analysis || '';

      if (marketReport) {
        prompt += `### 市场研究报告\n${marketReport}\n\n`;
      }
      if (fundamentalsReport) {
        prompt += `### 基本面报告\n${fundamentalsReport}\n\n`;
      }
      if (newsReport) {
        prompt += `### 新闻情绪报告\n${newsReport}\n\n`;
      }
      if (bullReport) {
        prompt += `### 多头观点\n${bullReport}\n\n`;
      }
      if (bearReport) {
        prompt += `### 空头观点\n${bearReport}\n\n`;
      }
    }

    prompt += `## 决策任务

基于以上分析师团队的综合分析和多空辩论，请您作为投资组合经理：

### 1. 📊 辩论评估
- 总结多头和空头的关键论点
- 识别最具说服力的证据和推理
- 评估双方论据的强弱

### 2. 🎯 投资决策
- **明确建议**: 买入/持有/卖出（必须选择其一）
- **决策理由**: 基于最有力论据的详细解释
- **风险评估**: 识别主要风险因素

### 3. 📋 投资计划制定
- **战略行动**: 实施建议的具体步骤
- **仓位管理**: 建议的投资比例和时机
- **退出策略**: 止损和止盈设定

### 4. 🔄 经验学习
- 从历史决策中吸取经验教训
- 识别可能的认知偏差和盲点
- 持续改进决策框架

**重要提醒**：
- 避免因为双方都有道理就默认选择"持有"
- 基于最强有力的证据做出果断决定
- 必须在分析结尾明确表达最终建议：**买入/持有/卖出**`;

    return prompt;
  }

  protected async preprocessContext(context: AgentContext): Promise<AgentContext> {
    // 确保有基本的时间范围
    if (!context.timeRange) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7); // 默认一周
      
      context.timeRange = { startDate, endDate };
    }

    return context;
  }
}