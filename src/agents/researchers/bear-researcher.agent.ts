import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent } from '../base/base-agent';
import { AgentType, AgentContext, AgentConfig, AgentResult, TradingRecommendation } from '../interfaces/agent.interface';
import { LLMService } from '../services/llm.service';

/**
 * 空头研究员智能体 - 专门识别风险和问题
 */
@Injectable()
export class BearResearcherAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>('BEAR_RESEARCHER_MODEL', configService.get<string>('DASHSCOPE_STANDARD_MODEL', 'qwen-plus')),
      temperature: configService.get<number>('BEAR_RESEARCHER_TEMPERATURE', 0.7),
      maxTokens: configService.get<number>('BEAR_RESEARCHER_MAX_TOKENS', 2500),
      timeout: configService.get<number>('BEAR_RESEARCHER_TIMEOUT', configService.get<number>('LLM_DEFAULT_TIMEOUT', 45)),
      retryCount: configService.get<number>('BEAR_RESEARCHER_RETRY_COUNT', configService.get<number>('LLM_MAX_RETRIES', 3)),
      systemPrompt: `您是一位专业的空头分析师，负责识别投资该股票的风险和潜在问题。您的任务是构建一个基于证据的谨慎案例，强调风险因素、估值担忧和负面市场指标。

🎯 重点关注领域：

⚠️ 风险因素：
- 识别业务模式、行业或宏观经济的潜在风险
- 分析竞争威胁、技术颠覆、监管风险
- 评估管理层风险和公司治理问题

💰 估值担忧：
- 分析当前估值是否过高，与历史和同行比较
- 识别泡沫迹象和不合理的市场预期
- 评估下行风险和潜在的估值修正

📉 负面指标：
- 使用财务恶化、行业逆风和负面新闻作为证据
- 分析技术指标显示的弱势信号
- 识别可能的催化剂风险事件

🛡️ 质疑多头观点：
- 用具体数据和合理推理质疑多头论点
- 指出多头分析中的盲点和过度乐观
- 提供更保守的情景分析

💬 分析风格：
- 保持理性和客观，避免过度悲观
- 基于事实进行有力质疑
- 提供建设性的风险提示
- 承认优势但强调风险

请用中文进行专业、理性的空头分析。`,
    };

    super(
      '空头研究员',
      AgentType.BEAR_RESEARCHER,
      '专业的空头研究员，专注于风险识别和谨慎分析',
      llmService,
      config
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    const { stockCode, stockName, previousResults } = context;
    
    let prompt = `作为专业的空头研究员，请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 进行全面的风险分析和谨慎评估。\n\n`;

    // 添加其他分析师的结果作为参考
    if (previousResults && previousResults.length > 0) {
      prompt += `参考其他分析师的分析结果:\n\n`;
      previousResults.forEach((result, index) => {
        prompt += `### ${result.agentName}分析摘要:\n`;
        prompt += `- 评分: ${result.score || 'N/A'}\n`;
        prompt += `- 建议: ${result.recommendation || 'N/A'}\n`;
        prompt += `- 核心观点: ${result.analysis.substring(0, 200)}...\n`;
        if (result.keyInsights && result.keyInsights.length > 0) {
          prompt += `- 关键洞察: ${result.keyInsights.join(', ')}\n`;
        }
        if (result.risks && result.risks.length > 0) {
          prompt += `- 风险提示: ${result.risks.join(', ')}\n`;
        }
        prompt += `\n`;
      });
    }

    prompt += `请按照以下结构进行空头风险分析:

## 空头风险研究报告

### 1. 风险概览
请识别该股票面临的主要风险，包括：
- 核心业务风险
- 财务风险因素
- 市场竞争风险
- 估值风险

### 2. 业务模式风险分析

#### 2.1 行业系统性风险
- 行业周期性风险
- 技术颠覆风险
- 政策监管风险
- 市场需求变化风险

#### 2.2 公司特定风险
- 业务集中度风险
- 客户依赖度风险
- 供应链风险
- 管理层执行风险

#### 2.3 竞争格局风险
- 新进入者威胁
- 替代产品风险
- 价格竞争压力
- 市场份额流失风险

### 3. 财务风险深度分析

#### 3.1 盈利能力风险
- 毛利率下降风险
- 成本上升压力
- 收入增长放缓
- 利润率压缩

#### 3.2 财务健康风险
- 债务负担过重
- 流动性风险
- 现金流恶化
- 资本结构问题

#### 3.3 增长可持续性风险
- 增长动力不足
- 投资回报率下降
- 扩张策略风险
- 资本效率降低

### 4. 估值风险评估

#### 4.1 绝对估值风险
- 当前估值过高
- 增长预期过于乐观
- 贴现率假设问题
- 终值预测风险

#### 4.2 相对估值风险
- 行业估值泡沫
- 历史估值偏高
- 国际比较劣势
- 估值修正压力

### 5. 技术面风险信号
- 技术指标弱势
- 趋势逆转信号
- 成交量萎缩
- 支撑位破位风险

### 6. 宏观环境风险

#### 6.1 宏观经济风险
- 经济增长放缓
- 通胀压力影响
- 利率上升风险
- 汇率波动影响

#### 6.2 政策环境风险
- 监管政策收紧
- 税收政策变化
- 产业政策调整
- 贸易政策影响

### 7. 催化剂风险事件
- 可能的负面事件
- 业绩不及预期风险
- 突发事件冲击
- 市场情绪逆转

### 8. 质疑多头观点
针对乐观预期进行理性质疑：
- 增长预期是否过高
- 竞争优势是否持续
- 估值是否合理
- 风险是否被充分考虑

### 9. 综合风险评估
- **空头评分**: [0-50分，体现谨慎态度]
- **风险建议**: [卖出/持有/谨慎]
- **下跌目标**: [具体价格]
- **风险等级**: [高/中/低]
- **核心风险因素**: [3-5个最重要的风险]

### 10. 风险因素总结表格

| 风险类别 | 风险程度 | 影响时间 | 可控性 | 应对策略 |
|----------|----------|----------|--------|----------|
| 行业风险 | | | | |
| 竞争风险 | | | | |
| 财务风险 | | | | |
| 估值风险 | | | | |
| 政策风险 | | | | |

### 11. 情景分析
- **悲观情景**: 最坏情况下的表现
- **中性情景**: 一般情况下的表现  
- **乐观情景**: 即使在最好情况下的局限性

### 12. 投资者警示
- 主要风险提醒
- 止损建议
- 仓位控制建议
- 关键监测指标

请基于客观数据提供全面的风险分析，帮助投资者理性评估投资风险。`;

    return prompt;
  }

  protected async postprocessResult(analysis: string, context: AgentContext): Promise<AgentResult> {
    const result = await super.postprocessResult(analysis, context);
    
    // 空头研究员的评分倾向于保守，但基于客观分析
    if (result.score && result.score > 50) {
      result.score = Math.min(50, result.score - 5); // 适度降低评分以体现谨慎态度
    }
    
    // 确保交易建议更加保守
    if (result.recommendation === TradingRecommendation.BUY) {
      result.recommendation = TradingRecommendation.HOLD;
    } else if (result.recommendation === TradingRecommendation.STRONG_BUY) {
      result.recommendation = TradingRecommendation.BUY;
    }

    return result;
  }
}