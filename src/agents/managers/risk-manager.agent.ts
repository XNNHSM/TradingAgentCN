import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseAgent } from "../base/base-agent";
import {
  AgentType,
  AgentContext,
  AgentConfig,
} from "../interfaces/agent.interface";
import { LLMService } from "../services/llm.service";

/**
 * 风险管理员智能体 - 最终风险评估和交易决策
 */
@Injectable()
export class RiskManagerAgent extends BaseAgent {
  constructor(llmService: LLMService, configService: ConfigService) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "RISK_MANAGER_MODEL",
        configService.get<string>("DASHSCOPE_PREMIUM_MODEL", "qwen-max"),
      ),
      temperature: configService.get<number>("RISK_MANAGER_TEMPERATURE", 0.6),
      maxTokens: configService.get<number>("RISK_MANAGER_MAX_TOKENS", 3000),
      timeout: configService.get<number>("RISK_MANAGER_TIMEOUT", 60),
      retryCount: configService.get<number>(
        "RISK_MANAGER_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
      systemPrompt: `您是风险管理法官和辩论协调员，您的目标是评估三位风险分析师（激进型、中立型和保守型）之间的辩论，并为交易员确定最佳行动方案。您的决策必须得出明确建议：买入、卖出或持有。只有在特定论据强有力地支持下才选择"持有"，而不是在所有观点看似合理时作为默认选项。力求清晰果断。

决策指南：
1. **总结关键论点**：提取每位分析师最有力的观点，重点关注与情境的相关性。
2. **提供理由支撑**：用辩论中的直接引述和反驳来支持您的建议。
3. **优化交易员计划**：从交易员原始计划出发，根据分析师的见解进行调整。
4. **从过去错误中学习**：利用历史经验教训，解决之前的误判，改进当前决策，确保不会做出导致亏损的错误买卖/持有决定。

交付内容：
- 明确可行的建议：买入、卖出或持有。
- 基于辩论和过往反思的详细推理。

专注于可操作的见解和持续改进。借鉴过去的经验，批判性评估所有视角，确保每项决策都能带来更好的结果。

请用中文撰写专业、全面的风险管理决策分析。`,
    };

    super(
      "风险管理员",
      AgentType.RISK_MANAGER,
      "专业的风险管理法官和最终决策者，负责综合评估所有风险因素并制定最终交易决策",
      llmService,
      undefined, // dataToolkit 暂时不需要
      config,
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    const { stockCode, stockName, previousResults } = context;

    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 进行最终风险评估和交易决策。\n\n`;

    // 添加前期分析结果
    if (previousResults && previousResults.length > 0) {
      prompt += `## 分析师团队报告汇总\n\n`;

      // 整理各种报告
      const reports = {
        market:
          previousResults.find((r) => r.agentType === AgentType.MARKET_ANALYST)
            ?.analysis || "",
        fundamentals:
          previousResults.find(
            (r) => r.agentType === AgentType.FUNDAMENTAL_ANALYST,
          )?.analysis || "",
        news:
          previousResults.find((r) => r.agentType === AgentType.NEWS_ANALYST)
            ?.analysis || "",
        investmentPlan:
          previousResults.find(
            (r) =>
              r.agentType === "research_manager" ||
              r.agentName === "研究管理员",
          )?.analysis || "",
        traderPlan:
          previousResults.find((r) => r.agentType === AgentType.TRADER)
            ?.analysis || "",
        conservativeView:
          previousResults.find((r) => r.agentName === "保守型交易员")
            ?.analysis || "",
        aggressiveView:
          previousResults.find((r) => r.agentName === "激进型交易员")
            ?.analysis || "",
      };

      if (reports.market) {
        prompt += `### 市场研究报告\n${reports.market}\n\n`;
      }
      if (reports.fundamentals) {
        prompt += `### 基本面报告\n${reports.fundamentals}\n\n`;
      }
      if (reports.news) {
        prompt += `### 新闻情绪报告\n${reports.news}\n\n`;
      }
      if (reports.investmentPlan) {
        prompt += `### 投资计划\n${reports.investmentPlan}\n\n`;
      }
      if (reports.traderPlan) {
        prompt += `### 交易员原始计划\n${reports.traderPlan}\n\n`;
      }

      // 风险辩论历史
      if (reports.conservativeView || reports.aggressiveView) {
        prompt += `## 风险分析师辩论历史\n\n`;
        if (reports.conservativeView) {
          prompt += `### 保守型观点\n${reports.conservativeView}\n\n`;
        }
        if (reports.aggressiveView) {
          prompt += `### 激进型观点\n${reports.aggressiveView}\n\n`;
        }
      }
    }

    prompt += `## 风险管理决策任务

作为最终的风险管理法官，请您基于以上所有分析和辩论：

### 1. 🎯 关键论点总结
- **保守派观点**: 总结风险控制的核心论据
- **激进派观点**: 总结机会获取的核心论据
- **中立派观点**: 总结平衡策略的核心论据
- **最有说服力的证据**: 识别决定性的关键因素

### 2. 💡 综合风险评估
- **系统性风险**: 宏观经济、政策、行业风险
- **个股风险**: 公司基本面、技术面、估值风险
- **交易风险**: 流动性、波动性、时机风险
- **组合风险**: 仓位管理、分散化程度

### 3. 📊 决策优化
- **交易员计划评估**: 分析原始计划的优缺点
- **风险调整**: 基于辩论见解的改进建议
- **执行策略**: 具体的实施路径和时间安排

### 4. 🎲 最终裁决
- **明确建议**: 买入/持有/卖出（必须明确选择）
- **风险评级**: 高/中/低风险等级
- **置信度**: 决策的确信程度（0-100%）
- **关键指标**: 需要监控的重要指标

### 5. 📋 风险控制措施
- **止损设置**: 明确的风险控制点位
- **仓位建议**: 具体的投资比例
- **监控预警**: 需要持续关注的风险信号

**决策原则**：
- 基于最强有力的论据做出果断决定
- 避免因观点平衡而默认选择"持有"
- 确保风险收益比合理
- 考虑历史经验教训，避免重复错误

请最终以 **"最终交易建议: 买入/持有/卖出"** 结束您的分析。`;

    return prompt;
  }

  protected async preprocessContext(
    context: AgentContext,
  ): Promise<AgentContext> {
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
