import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent } from '../base/base-agent';
import { AgentType, AgentContext, AgentConfig } from '../interfaces/agent.interface';
import { LLMService } from '../services/llm.service';

/**
 * 基本面分析师智能体 - 专门进行基本面分析
 */
@Injectable()
export class FundamentalAnalystAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>('FUNDAMENTAL_ANALYST_MODEL', configService.get<string>('DASHSCOPE_PREMIUM_MODEL', 'qwen-max')),
      temperature: configService.get<number>('FUNDAMENTAL_ANALYST_TEMPERATURE', 0.6),
      maxTokens: configService.get<number>('FUNDAMENTAL_ANALYST_MAX_TOKENS', 3000),
      timeout: configService.get<number>('FUNDAMENTAL_ANALYST_TIMEOUT', 60),
      retryCount: configService.get<number>('FUNDAMENTAL_ANALYST_RETRY_COUNT', configService.get<number>('LLM_MAX_RETRIES', 3)),
      systemPrompt: `您是一位专业的基本面研究分析师，专门分析公司的基本面信息。您的任务是撰写一份关于公司过去一周基本面信息的综合报告。

分析范围包括：
📊 财务文档分析：资产负债表、利润表、现金流量表
🏢 公司概况：业务模式、竞争优势、管理层质量
💰 基本财务指标：PE、PB、ROE、ROA、毛利率、净利率
📈 财务历史趋势：收入增长、利润增长、债务水平变化
👥 内部人士情绪：管理层和内部人士的买卖行为
💼 内部人士交易：重要股东和高管的交易记录

分析要求：
1. 提供尽可能详细的信息，帮助交易者做出明智决策
2. 不要简单地说"趋势混合"，要提供详细和细致的分析洞察
3. 重点关注可能影响股价的关键财务指标变化
4. 分析内部人士行为的潜在含义
5. 评估公司的财务健康状况和未来前景
6. 在报告末尾添加Markdown表格来组织关键要点，使其有条理且易于阅读
7. 必须给出明确的评分（0-100分）和投资建议

请用中文撰写专业、全面的基本面分析报告。`,
    };

    super(
      '基本面分析师',
      AgentType.FUNDAMENTAL_ANALYST,
      '专业的基本面分析师，专注于公司财务和基本面研究',
      llmService,
      config
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    const { stockCode, stockName, financialData, timeRange } = context;
    
    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 进行全面的基本面分析。\n\n`;

    // 添加分析时间范围
    if (timeRange) {
      prompt += `分析时间范围: ${timeRange.startDate.toLocaleDateString()} 到 ${timeRange.endDate.toLocaleDateString()}\n\n`;
    }

    // 添加财务数据信息
    if (financialData) {
      prompt += `财务数据概要:\n`;
      if (financialData.financialRatios) {
        prompt += `- 财务比率: ${JSON.stringify(financialData.financialRatios, null, 2)}\n`;
      }
      if (financialData.incomeStatement) {
        prompt += `- 利润表摘要: ${JSON.stringify(financialData.incomeStatement, null, 2)}\n`;
      }
      if (financialData.balanceSheet) {
        prompt += `- 资产负债表摘要: ${JSON.stringify(financialData.balanceSheet, null, 2)}\n`;
      }
      if (financialData.cashFlow) {
        prompt += `- 现金流量表摘要: ${JSON.stringify(financialData.cashFlow, null, 2)}\n`;
      }
      prompt += `\n`;
    }

    prompt += `请按照以下结构进行基本面分析:

## 基本面分析报告

### 1. 公司概况分析
- 主营业务分析
- 行业地位评估
- 竞争优势识别
- 商业模式评价

### 2. 财务状况分析

#### 2.1 盈利能力分析
- 营业收入趋势
- 净利润变化
- 毛利率分析
- 净利率分析
- ROE (净资产收益率)
- ROA (总资产收益率)

#### 2.2 财务健康度分析
- 资产负债结构
- 流动比率
- 速动比率
- 资产负债率
- 现金流状况

#### 2.3 成长性分析
- 收入增长率
- 利润增长率
- 资产增长率
- 研发投入情况

#### 2.4 估值分析
- PE市盈率分析
- PB市净率分析
- PS市销率分析
- PEG增长率调整市盈率
- 与行业平均比较

### 3. 重大事件影响
- 最新财报解读
- 重大公告影响
- 政策影响分析
- 行业趋势影响

### 4. 内部人士交易分析
- 高管增减持情况
- 机构投资者变化
- 股东结构分析

### 5. 未来前景评估
- 业务发展前景
- 行业增长潜力
- 风险因素识别
- 催化剂因素

### 6. 综合评估
- **基本面评分**: [0-100分]
- **投资建议**: [强烈买入/买入/持有/卖出/强烈卖出]
- **目标价格**: [具体价格]
- **投资理由**: [3-5个核心理由]

### 7. 关键财务指标总结表格

| 财务指标 | 当前值 | 行业平均 | 评估 | 趋势 |
|----------|--------|----------|------|------|
| PE市盈率 | | | | |
| PB市净率 | | | | |
| ROE | | | | |
| ROA | | | | |
| 毛利率 | | | | |
| 净利率 | | | | |
| 资产负债率 | | | | |
| 流动比率 | | | | |

### 8. 风险提示
- 主要风险因素
- 不确定性分析
- 投资注意事项

请提供深入、专业的基本面分析，重点关注影响股价的核心基本面因素。`;

    return prompt;
  }

  protected async preprocessContext(context: AgentContext): Promise<AgentContext> {
    // 确保有基本的时间范围
    if (!context.timeRange) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(endDate.getMonth() - 3); // 默认3个月
      
      context.timeRange = { startDate, endDate };
    }

    return context;
  }
}