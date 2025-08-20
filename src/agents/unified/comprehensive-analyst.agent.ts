import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseAgent } from "../base/base-agent";
import {
  AgentType,
  AgentContext,
  AgentConfig,
} from "../interfaces/agent.interface";
import { LLMService } from "../services/llm.service";
import { MCPClientService } from "../services/mcp-client.service";

/**
 * 综合分析师智能体
 * 整合了原有的市场分析师、基本面分析师和新闻分析师的功能
 * 使用MCP协议获取数据，提供全面的股票分析
 */
@Injectable()
export class ComprehensiveAnalystAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
    private readonly mcpClient: MCPClientService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "COMPREHENSIVE_ANALYST_MODEL",
        configService.get<string>("DASHSCOPE_STANDARD_MODEL", "qwen-plus"),
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

🔧 **可用工具**
您可以调用以下MCP工具获取数据：
- get_stock_basic_info: 获取股票基本信息
- get_stock_realtime_data: 获取实时行情数据
- get_stock_historical_data: 获取历史价格数据
- get_stock_technical_indicators: 获取技术指标数据
- get_stock_financial_data: 获取财务数据
- get_market_overview: 获取市场概览
- get_stock_news: 获取相关新闻
- search_stocks: 搜索股票信息

📊 **分析框架**
1. **数据收集**: 主动调用工具获取全面数据
2. **多维度分析**: 技术面 + 基本面 + 消息面
3. **风险评估**: 识别关键风险点和机会
4. **投资建议**: 给出明确的买入/持有/卖出建议
5. **目标价格**: 提供具体的价格预期

📋 **输出要求**
- 必须使用MCP工具获取实时数据
- 分析要详细、专业、有条理
- 必须给出0-100分的综合评分
- 必须提供明确的投资建议
- 包含风险提示和止损建议
- 使用表格总结关键要点

🚨 **重要提醒**
- 分析前必须调用相关工具获取最新数据
- 基于真实数据进行分析，避免空洞的泛泛而谈
- 给出的建议要有数据支撑和逻辑依据
- 重视风险控制，不盲目乐观或悲观`,
    };

    super(
      "综合分析师",
      AgentType.COMPREHENSIVE_ANALYST,
      "集技术分析、基本面分析、新闻分析于一体的全能分析师",
      llmService,
      undefined, // 不使用旧的dataToolkit
      config,
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
请按照以下步骤进行全面分析：

## 第一步：数据收集
请使用以下工具获取必要数据：
1. 调用 get_stock_basic_info 获取股票基本信息
2. 调用 get_stock_realtime_data 获取最新行情数据
3. 调用 get_stock_historical_data 获取历史数据（最近60天）
4. 调用 get_stock_technical_indicators 获取技术指标
5. 调用 get_stock_financial_data 获取财务数据
6. 调用 get_stock_news 获取相关新闻（关键词使用股票名称或行业）
7. 调用 get_market_overview 获取市场整体情况

## 第二步：综合分析报告

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
- 请确保分析基于获取的实时数据
- 所有建议要有数据支撑和逻辑依据  
- 评分要客观公正，避免极端化
- 风险提示要充分，投资需谨慎

请开始您的专业分析！`;

    return prompt;
  }

  protected async preprocessContext(
    context: AgentContext,
  ): Promise<AgentContext> {
    // 确保MCP客户端已初始化
    if (!this.mcpClient.isConnectedToMCP()) {
      await this.mcpClient.initialize();
    }

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
   * 重写工具调用方法，使用MCP客户端
   */
  protected async callLLMWithTools(
    prompt: string,
    _tools: any[],
  ): Promise<any> {
    // 获取MCP工具定义
    const mcpTools = this.mcpClient.getToolDefinitions();
    
    const fullPrompt = this.config.systemPrompt
      ? `${this.config.systemPrompt}\n\n${prompt}`
      : prompt;

    const llmConfig = {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      timeout: this.config.timeout * 1000,
      tools: mcpTools,
      toolChoice: "auto",
    };

    this.logger.debug(
      "开始MCP工具调用，支持以下工具：",
      mcpTools.map((t) => t.function?.name || "未知工具"),
    );

    return await this.llmService.generateWithTools(fullPrompt, llmConfig);
  }

  /**
   * 重写工具调用处理方法，使用MCP客户端执行
   */
  protected async processToolCalls(
    llmResponse: any,
    _context: AgentContext,
  ): Promise<any> {
    if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
      return llmResponse;
    }

    this.logger.debug(`处理 ${llmResponse.toolCalls.length} 个MCP工具调用`);

    let enhancedContent = llmResponse.content;

    // 执行所有MCP工具调用
    for (const toolCall of llmResponse.toolCalls) {
      try {
        const functionName = toolCall.function.name;
        const arguments_ = JSON.parse(toolCall.function.arguments);

        this.logger.debug(`执行MCP工具: ${functionName}`, arguments_);

        // 使用MCP客户端执行工具调用
        const toolResult = await this.mcpClient.callTool(
          functionName,
          arguments_,
        );

        // 将工具结果添加到内容中
        enhancedContent += `\n\n## MCP数据获取结果 - ${functionName}\n\n${toolResult}`;
      } catch (error) {
        this.logger.error(`MCP工具调用失败: ${toolCall.function.name}`, error);
        enhancedContent += `\n\nMCP工具调用失败 (${toolCall.function.name}): ${error.message}`;
      }
    }

    return {
      ...llmResponse,
      content: enhancedContent,
    };
  }
}