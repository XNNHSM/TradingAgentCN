import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseAgent } from "../base/base-agent";
import {
  AgentType,
  AgentContext,
  AgentConfig,
  AgentResult,
  AgentStatus,
} from "../interfaces/agent.interface";
import { LLMService } from "../services/llm.service";
import { AgentExecutionRecordService } from "../services/agent-execution-record.service";

/**
 * 宏观经济分析师智能体
 * 专门分析宏观经济环境、政策影响和市场整体趋势
 * 基于新闻分析师模板扩展，专注于宏观经济层面
 */
@Injectable()
export class MacroEconomistAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
    executionRecordService: AgentExecutionRecordService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "MACRO_ECONOMIST_MODEL",
        configService.get<string>("LLM_DEFAULT_MODEL", "qwen-max"), // 宏观分析需要强模型
      ),
      temperature: configService.get<number>(
        "MACRO_ECONOMIST_TEMPERATURE",
        configService.get<number>("LLM_DEFAULT_TEMPERATURE", 0.6),
      ),
      maxTokens: configService.get<number>(
        "MACRO_ECONOMIST_MAX_TOKENS", 
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 4000),
      ),
      timeout: configService.get<number>(
        "MACRO_ECONOMIST_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 60),
      ),
      retryCount: configService.get<number>(
        "MACRO_ECONOMIST_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
      systemPrompt: `您是一位资深的宏观经济分析师，专门分析宏观经济环境、政策影响和市场整体趋势。您的任务是从宏观经济角度分析对特定股票和整体市场的影响。

🎯 **分析范围**:

🌍 **全球宏观经济**:
- 央行政策：利率决策、货币政策、流动性管理
- 通胀数据：CPI、PPI、核心通胀趋势分析
- 经济增长：GDP增长、就业数据、消费指标
- 贸易环境：国际贸易、汇率变化、贸易政策

🏛️ **政策分析**:
- 货币政策：央行政策对资产价格的影响
- 财政政策：政府支出、税收政策、刺激措施
- 监管政策：金融监管、行业政策变化
- 产业政策：新兴产业扶持、传统产业转型

📈 **市场环境**:
- 流动性环境：市场资金面、投资者情绪
- 风险偏好：避险情绪、风险资产配置
- 资产轮动：股债轮动、行业轮动、风格轮动
- 国际影响：外资流向、全球市场联动

🏭 **行业影响**:
- 政策导向：政府重点扶持的行业方向
- 周期性影响：经济周期对不同行业的影响
- 结构性变化：产业结构调整、技术革新
- 供需关系：宏观经济对供需平衡的影响

📊 **分析框架**:
1. **宏观环境评估**: 当前经济周期位置和发展趋势
2. **政策影响分析**: 货币、财政、产业政策的传导机制
3. **市场影响评估**: 宏观因素对资产价格的影响路径
4. **行业影响分析**: 宏观环境对特定行业的影响
5. **风险机遇识别**: 宏观层面的风险点和投资机会

📋 **输出要求**:
- **宏观环境概览**: 当前经济环境的整体判断
- **政策影响评估**: 关键政策对市场和个股的影响
- **趋势预判**: 基于宏观分析的中短期趋势预测
- **行业影响**: 宏观环境对相关行业的具体影响
- **投资建议**: 基于宏观分析的资产配置建议
- **风险提示**: 宏观层面需要关注的风险点

💡 **分析原则**:
- 关注政策传导机制和时间滞后效应
- 重视经济数据的领先指标意义
- 考虑国内外宏观环境的相互影响
- 结合历史经验和当前特殊性
- 提供前瞻性的趋势判断

⚠️ **注意事项**:
1. 提供详细和细致的分析洞察，避免简单地说"环境复杂"
2. 重点关注可能影响市场的重要宏观事件和政策变化
3. 分析宏观因素的潜在市场影响和投资机会
4. 识别宏观环境变化的信号和趋势
5. 评估宏观经济环境对不同资产类别的影响
6. 在报告末尾添加Markdown表格来组织关键要点

请用中文撰写专业、深入的宏观经济分析报告。`,
    };

    super(
      "宏观经济分析师",
      AgentType.MACRO_ECONOMIST,
      "资深的宏观经济分析师，专门分析宏观经济环境和政策影响",
      llmService,
      undefined, // dataToolkit (已废弃)
      config,
      executionRecordService,
    );
  }

  /**
   * 执行宏观经济分析
   */
  async analyze(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    this.status = AgentStatus.ANALYZING;

    try {
      // 构建宏观分析上下文
      const analysisPrompt = this.buildMacroAnalysisPrompt(context);

      // 调用LLM进行宏观经济分析
      const analysisResult = await this.llmService.generate(analysisPrompt, {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        timeout: this.config.timeout * 1000,
      });

      const processingTime = Date.now() - startTime;

      const result: AgentResult = {
        agentName: this.name,
        agentType: this.type,
        analysis: analysisResult,
        confidence: this.calculateMacroConfidence(context, analysisResult),
        keyInsights: this.extractMacroInsights(analysisResult),
        risks: this.identifyMacroRisks(analysisResult),
        supportingData: {
          analysisFramework: [
            "宏观环境评估",
            "政策影响分析", 
            "市场影响评估",
            "行业影响分析",
            "风险机遇识别"
          ],
          keyFactors: [
            "货币政策", "财政政策", "监管政策",
            "经济增长", "通胀水平", "就业数据",
            "国际环境", "汇率变化", "资金流向"
          ],
          impactChannels: [
            "政策传导", "流动性影响", "估值重估",
            "盈利预期", "风险偏好", "资产配置"
          ],
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
    return this.buildMacroAnalysisPrompt(context);
  }

  /**
   * 构建宏观分析提示词
   */
  private buildMacroAnalysisPrompt(context: AgentContext): string {
    const { stockCode, stockName, timeRange } = context;

    let prompt = `请从宏观经济角度分析股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 以及相关行业和整体市场环境。\n\n`;

    // 添加时间范围
    if (timeRange) {
      prompt += `分析时间范围: ${timeRange.startDate.toISOString().split('T')[0]} 至 ${timeRange.endDate.toISOString().split('T')[0]}\n\n`;
    }

    // 添加新闻数据作为宏观分析依据
    if (context.newsData) {
      prompt += `**相关新闻和宏观信息**:\n${JSON.stringify(context.newsData, null, 2)}\n\n`;
    }

    // 添加财务数据了解公司所处行业
    if (context.financialData) {
      prompt += `**公司财务数据（用于行业判断）**:\n${JSON.stringify(context.financialData, null, 2)}\n\n`;
    }

    // 添加历史数据了解市场表现
    if (context.historicalData) {
      prompt += `**历史表现数据**:\n${JSON.stringify(context.historicalData, null, 2)}\n\n`;
    }

    // 添加其他智能体的分析结果
    if (context.previousResults && context.previousResults.length > 0) {
      prompt += `**其他分析师观点**:\n`;
      context.previousResults.forEach((result, index) => {
        prompt += `${index + 1}. ${result.agentName} (${result.agentType}): ${result.analysis}\n`;
      });
      prompt += `\n`;
    }

    prompt += `
请重点分析以下宏观层面的问题：

1. **当前宏观环境**:
   - 评估当前经济周期位置（复苏、扩张、收缩、衰退）
   - 分析主要经济指标的变化趋势
   - 判断货币政策和财政政策的影响

2. **政策影响分析**:
   - 近期重要政策对该股票所在行业的影响
   - 货币政策对估值和流动性的影响
   - 产业政策和监管政策的结构性影响

3. **市场环境评估**:
   - 整体市场风险偏好和流动性环境
   - 国内外资金流向和投资者情绪
   - 资产配置轮动的影响

4. **行业宏观影响**:
   - 该股票所在行业的宏观敏感性分析
   - 经济周期对行业供需的影响
   - 政策导向对行业发展的影响

5. **前瞻性判断**:
   - 基于宏观分析的中短期趋势预测
   - 可能的政策变化和市场反应
   - 宏观层面的投资机会和风险

请结合具体的宏观数据和政策信息进行分析，避免泛泛而谈。`;

    return prompt;
  }

  /**
   * 计算宏观分析置信度
   */
  private calculateMacroConfidence(context: AgentContext, analysis: string): number {
    let confidence = 0.6; // 基础置信度

    // 根据数据可用性调整置信度
    if (context.newsData) confidence += 0.15; // 新闻数据对宏观分析很重要
    if (context.financialData) confidence += 0.1;
    if (context.previousResults && context.previousResults.length > 0) confidence += 0.1;

    // 根据分析质量调整置信度
    if (analysis.includes("政策") || analysis.includes("央行")) confidence += 0.1;
    if (analysis.includes("经济数据") || analysis.includes("宏观指标")) confidence += 0.1;
    if (analysis.includes("前瞻") || analysis.includes("预期")) confidence += 0.05;
    if (analysis.includes("风险") || analysis.includes("不确定")) confidence += 0.05;

    // 宏观分析的不确定性相对较高
    confidence = Math.min(confidence * 0.9, 0.85); // 降低整体置信度上限

    return Math.max(confidence, 0.3); // 确保最低置信度
  }

  /**
   * 提取宏观洞察
   */
  private extractMacroInsights(analysis: string): string[] {
    const insights: string[] = [];

    // 宏观分析关键词
    const macroKeywords = [
      "政策", "央行", "利率", "流动性", "通胀",
      "经济周期", "GDP", "就业", "消费", "投资",
      "汇率", "贸易", "监管", "改革", "趋势",
      "预期", "风险偏好", "资产配置"
    ];

    const sentences = analysis.split(/[。！？]/);
    sentences.forEach(sentence => {
      macroKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 15) {
          insights.push(sentence.trim());
        }
      });
    });

    return insights.slice(0, 7); // 最多返回7个宏观洞察
  }

  /**
   * 识别宏观风险
   */
  private identifyMacroRisks(analysis: string): string[] {
    const risks: string[] = [];

    // 常见的宏观风险
    const commonMacroRisks = [
      "政策不确定性可能带来市场波动",
      "宏观经济指标变化存在滞后性",
      "国际环境变化可能影响国内政策",
      "经济周期转换可能改变行业格局"
    ];

    // 从分析中提取风险相关内容
    const riskKeywords = [
      "风险", "不确定", "波动", "冲击", "压力",
      "挑战", "变数", "调整", "转换", "影响"
    ];
    
    const sentences = analysis.split(/[。！？]/);
    sentences.forEach(sentence => {
      riskKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 10) {
          risks.push(sentence.trim());
        }
      });
    });

    // 如果没有从分析中提取到风险，添加通用宏观风险
    if (risks.length === 0) {
      risks.push(...commonMacroRisks.slice(0, 3));
    }

    return risks.slice(0, 5); // 最多返回5个风险点
  }
}