import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseAgent } from "../base/base-agent";
import {
  AgentType,
  AgentContext,
  AgentConfig,
} from "../interfaces/agent.interface";
import { LLMService } from "../services/llm.service";
import { DataToolkitService } from "../services/data-toolkit.service";

/**
 * 基本面分析师智能体 - 专门进行基本面分析
 */
@Injectable()
export class FundamentalAnalystAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
    dataToolkit: DataToolkitService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "FUNDAMENTAL_ANALYST_MODEL",
        configService.get<string>("DASHSCOPE_PREMIUM_MODEL", "qwen-max"),
      ),
      temperature: configService.get<number>(
        "FUNDAMENTAL_ANALYST_TEMPERATURE",
        0.6,
      ),
      maxTokens: configService.get<number>(
        "FUNDAMENTAL_ANALYST_MAX_TOKENS",
        3000,
      ),
      timeout: configService.get<number>("FUNDAMENTAL_ANALYST_TIMEOUT", 60),
      retryCount: configService.get<number>(
        "FUNDAMENTAL_ANALYST_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
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

您是一位乐于助人的AI助手，与其他助手协作。使用提供的工具来逐步回答问题。如果您无法完全回答，没关系；另一位拥有不同工具的助手会从您停下的地方继续。尽您所能来取得进展。如果您或其他任何助手有最终交易建议：**买入/持有/卖出** 或可交付成果，请在您的回复前加上最终交易建议：**买入/持有/卖出**，以便团队知道停止。

请用中文撰写专业、全面的基本面分析报告。`,
    };

    super(
      "基本面分析师",
      AgentType.FUNDAMENTAL_ANALYST,
      "专业的基本面分析师，专注于公司财务和基本面研究",
      llmService,
      dataToolkit,
      config,
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    const { stockCode, stockName, timeRange } = context;

    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 进行全面的基本面分析。\n\n`;

    // 添加分析时间范围
    if (timeRange) {
      prompt += `分析时间范围: ${timeRange.startDate.toLocaleDateString()} 到 ${timeRange.endDate.toLocaleDateString()}\n\n`;
    }

    prompt += `## 分析任务

**第一步：数据收集**
请根据需要主动调用以下工具获取分析所需的数据：
1. \`get_china_stock_data\` - 获取股票历史数据和技术指标
2. \`get_financial_data\` - 获取公司财务报表数据
3. \`get_company_info\` - 获取公司基本信息和业务概况
4. \`get_industry_data\` - 获取行业数据和同行比较
5. \`get_china_market_overview\` - 获取市场整体情况（如需要）

**第二步：深度分析**
基于获取的真实数据，按以下框架进行分析：

### 1. 📊 数据概览
- 展示获取到的关键数据
- 数据质量和完整性评估

### 2. 🏢 公司基本面分析
#### 2.1 业务模式与竞争优势
- 主营业务和商业模式
- 核心竞争优势和护城河
- 行业地位和市场份额

#### 2.2 财务健康度评估
- **盈利能力**：ROE、ROA、毛利率、净利率
- **偿债能力**：资产负债率、流动比率、速动比率
- **营运能力**：应收账款周转率、存货周转率
- **成长能力**：收入增长率、利润增长率

#### 2.3 估值水平分析
- **绝对估值**：PE、PB、PS、PEG分析
- **相对估值**：与行业平均水平和同行企业对比
- **估值合理性**：基于业务前景的估值评估

### 3. 📈 行业与市场环境
- 所处行业发展阶段和前景
- 行业竞争格局和发展趋势
- 宏观经济和政策环境影响

### 4. 🔍 风险识别与评估
- 业务风险（市场、技术、竞争）
- 财务风险（债务、现金流、盈利波动）
- 外部风险（政策、行业、宏观）

### 5. 🎯 投资评估结论
- **基本面评分**: [0-100分，必须给出具体分数]
- **投资建议**: [强烈买入/买入/持有/卖出/强烈卖出]
- **关键投资逻辑**: [3-5个核心论证点]
- **目标价位**: [基于估值分析的合理价位区间]

### 6. 📋 关键指标汇总表

| 核心指标 | 数值 | 行业均值 | 评级 | 说明 |
|----------|------|----------|------|------|
| 营收增长率 | | | | |
| 净利润增长率 | | | | |
| ROE | | | | |
| ROA | | | | |
| PE 市盈率 | | | | |
| PB 市净率 | | | | |
| 毛利率 | | | | |
| 净利率 | | | | |
| 资产负债率 | | | | |

**重要提醒**：
- 请务必先调用工具获取真实数据，再基于数据进行分析
- 避免空泛的描述，要提供具体的数字和比较
- 必须给出明确的评分（0-100分）和投资建议
- 所有结论都要有数据支撑`;

    return prompt;
  }

  protected async preprocessContext(
    context: AgentContext,
  ): Promise<AgentContext> {
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
