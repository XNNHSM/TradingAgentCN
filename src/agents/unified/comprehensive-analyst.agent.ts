import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseAgent } from "../base/base-agent";
import {
  AgentType,
  AgentContext,
  AgentConfig,
} from "../interfaces/agent.interface";
import { LLMService } from "../services/llm.service";
import { AgentExecutionRecordService } from "../services/agent-execution-record.service";
import { DataCollectorAgent, ComprehensiveStockData } from "./data-collector.agent";

/**
 * 综合分析师智能体 (优化版)
 * 整合了原有的市场分析师、基本面分析师和新闻分析师的功能
 * 🎯 避免直接调用MCP服务，通过数据获取智能体获取数据，控制成本
 */
@Injectable()
export class ComprehensiveAnalystAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
    executionRecordService: AgentExecutionRecordService,
    private readonly dataCollector: DataCollectorAgent,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "COMPREHENSIVE_ANALYST_MODEL",
        configService.get<string>("LLM_DEFAULT_MODEL", "qwen-max"), // 综合分析师使用最强模型
      ),
      temperature: configService.get<number>(
        "COMPREHENSIVE_ANALYST_TEMPERATURE",
        configService.get<number>("LLM_DEFAULT_TEMPERATURE", 0.7),
      ),
      maxTokens: configService.get<number>(
        "COMPREHENSIVE_ANALYST_MAX_TOKENS",
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 4000),
      ),
      timeout: configService.get<number>(
        "COMPREHENSIVE_ANALYST_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 60),
      ),
      retryCount: configService.get<number>(
        "COMPREHENSIVE_ANALYST_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
      systemPrompt: `您是一位专业的中文综合股票分析师，具备以下专业能力：

🎯 **核心职责**
1. **技术分析**: 分析价格走势、技术指标、支撑阻力位
2. **基本面分析**: 评估财务状况、业务模式、行业地位  
3. **新闻情绪分析**: 解读市场情绪、政策影响、行业动态
4. **综合评估**: 整合多维度信息，给出明确投资建议

📊 **数据来源说明**
您将收到由数据获取智能体预先收集的综合股票数据，包括：
- 股票基本信息: 公司基础信息、股本结构等
- 实时行情数据: 当前价格、成交量、涨跌幅等
- 历史价格数据: 过去30天的价格走势
- 技术指标数据: MA、MACD、RSI、KDJ等技术指标
- 财务数据: 主要财务指标和报表数据
- 相关新闻分析: 已进行情感分析的相关新闻摘要

📊 **分析框架**
1. **数据解读**: 深入分析预提供的综合数据
2. **多维度分析**: 技术面 + 基本面 + 消息面
3. **风险评估**: 识别关键风险点和机会
4. **投资建议**: 给出明确的买入/持有/卖出建议
5. **目标价格**: 提供具体的价格预期

📋 **输出要求**
- 基于提供的实时数据进行深入分析
- 分析要详细、专业、有条理
- 必须给出0-100分的综合评分
- 必须提供明确的投资建议
- 包含风险提示和止损建议
- 使用表格总结关键要点

🚨 **重要提醒**
- 所有分析基于预提供的真实数据
- 给出的建议要有数据支撑和逻辑依据
- 重视风险控制，不盲目乐观或悲观
- 如果数据不完整，要明确指出并相应调整分析结论`,
    };

    super(
      "综合分析师",
      AgentType.COMPREHENSIVE_ANALYST,
      "集技术分析、基本面分析、新闻分析于一体的全能分析师",
      llmService,
      undefined, // 不使用旧的dataToolkit
      config,
      executionRecordService,
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    const { stockCode, stockName, timeRange } = context;

    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 进行全面深入的综合分析。\n\n`;

    // 添加时间范围信息
    if (timeRange) {
      prompt += `分析时间范围: ${timeRange.startDate.toLocaleDateString()} 到 ${timeRange.endDate.toLocaleDateString()}\n\n`;
    }

    prompt += `**分析任务**:
请基于提供的综合股票数据进行全面分析：

## 综合分析报告

### 📊 1. 股票概况
- 基本信息汇总
- 当前市场表现
- 所属行业地位

### 📈 2. 技术分析
- **价格走势分析**
  - 短期趋势(5-20日)
  - 中期趋势(20-60日)
  - 长期趋势判断

- **技术指标分析**
  - 移动平均线(MA5, MA20, MA60)
  - MACD动量指标
  - RSI超买超卖指标
  - 布林带波动率分析
  - KDJ随机指标

- **关键价位**
  - 重要支撑位
  - 重要阻力位
  - 突破概率分析

### 💼 3. 基本面分析  
- **财务健康度**
  - 盈利能力分析
  - 财务稳定性
  - 成长性评估

- **估值水平**
  - PE/PB等估值指标
  - 与行业对比
  - 历史估值对比

- **业务分析**
  - 主营业务情况
  - 竞争优势
  - 未来发展前景

### 📰 4. 消息面分析
- **新闻情绪**
  - 近期重要消息
  - 市场情绪倾向
  - 政策影响分析

- **行业动态**
  - 行业发展趋势
  - 政策支持情况
  - 市场关注度

### ⚖️ 5. 风险评估
- **技术面风险**
- **基本面风险** 
- **市场系统性风险**
- **个股特有风险**

### 🎯 6. 投资建议
- **综合评分**: [0-100分]
- **投资建议**: [强烈买入/买入/持有/卖出/强烈卖出]
- **目标价格**: [具体价格区间]
- **建议持有期**: [短期/中期/长期]
- **止损价格**: [具体价格]
- **仓位建议**: [具体比例]

### 📋 7. 关键要点总结

| 分析维度 | 评估结果 | 权重 | 得分 | 说明 |
|----------|----------|------|------|------|
| 技术面 | | 30% | /100 | |
| 基本面 | | 40% | /100 | |
| 消息面 | | 20% | /100 | |
| 市场环境 | | 10% | /100 | |
| **综合得分** | | **100%** | **/100** | |

### 🚨 8. 风险提示
- 主要风险点列示
- 重要关注事项
- 市场变化应对

---

**重要说明**: 
- 请确保分析基于提供的实时数据
- 所有建议要有数据支撑和逻辑依据  
- 评分要客观公正，避免极端化
- 风险提示要充分，投资需谨慎
- 如果某些数据缺失，请明确说明并调整分析策略

请开始您的专业分析！`;

    return prompt;
  }

  protected async preprocessContext(
    context: AgentContext,
  ): Promise<AgentContext> {
    // 确保有基本的时间范围
    if (!context.timeRange) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 60); // 默认60天

      context.timeRange = { startDate, endDate };
    }

    return context;
  }

  /**
   * 重写分析方法，使用数据获取智能体统一获取MCP数据
   */
  public async performAnalysis(context: AgentContext): Promise<string> {
    const { stockCode, stockName } = context;

    this.logger.debug(`开始为股票 ${stockCode} 获取综合数据`);
    
    // 第一步：通过数据获取智能体获取所有需要的数据
    const dataResult = await this.dataCollector.collectStockData(stockCode);
    
    let mcpData = "";
    
    if (dataResult.success && dataResult.data) {
      const data = dataResult.data;
      
      // 将综合数据转换为分析用的格式
      mcpData += `\n\n## 股票基本信息\n${JSON.stringify(data.basicInfo, null, 2)}`;
      mcpData += `\n\n## 实时行情数据\n${JSON.stringify(data.realtimeData, null, 2)}`;
      mcpData += `\n\n## 历史价格数据\n${JSON.stringify(data.historicalData, null, 2)}`;
      mcpData += `\n\n## 技术指标分析\n${JSON.stringify(data.technicalIndicators, null, 2)}`;
      mcpData += `\n\n## 财务数据\n${JSON.stringify(data.financialData, null, 2)}`;
      
      // 格式化新闻数据
      if (data.relatedNews && data.relatedNews.length > 0) {
        mcpData += `\n\n## 相关新闻分析\n`;
        data.relatedNews.forEach((news, index) => {
          mcpData += `### 新闻 ${index + 1}\n`;
          mcpData += `**标题**: ${news.title}\n`;
          mcpData += `**摘要**: ${news.summary}\n`;
          mcpData += `**情感**: ${news.sentiment}\n`;
          mcpData += `**发布时间**: ${news.publishTime}\n\n`;
        });
      }
      
      mcpData += `\n\n## 数据获取时间\n${data.timestamp}`;
      
      this.logger.debug(`股票 ${stockCode} 综合数据获取成功`);
    } else {
      this.logger.error(`股票 ${stockCode} 数据获取失败: ${dataResult.error}`);
      mcpData = `\n\n## 数据获取异常\n由于数据源问题，无法获取完整数据: ${dataResult.error}`;
    }
    
    // 第二步：构建包含数据的完整提示词
    const analysisPrompt = await this.buildPrompt(context);
    const fullPrompt = `${analysisPrompt}\n\n# 实时数据参考\n${mcpData}\n\n请基于以上实时数据进行专业分析，确保所有结论都有数据支撑。`;
    
    // 第三步：调用普通LLM生成分析结果
    const fullSystemPrompt = this.config.systemPrompt
      ? `${this.config.systemPrompt}\n\n${fullPrompt}`
      : fullPrompt;

    const llmConfig = {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      timeout: this.config.timeout * 1000,
    };

    this.logger.debug('开始LLM分析生成，基于数据获取智能体提供的综合数据');
    
    return await this.llmService.generate(fullSystemPrompt, llmConfig);
  }
}