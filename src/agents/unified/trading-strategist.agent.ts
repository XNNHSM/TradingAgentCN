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
 * 交易策略师智能体
 * 整合了原有的多头研究员、空头研究员、交易员和风险管理员的功能
 * 专注于制定具体的交易策略和风险管控方案
 */
@Injectable()
export class TradingStrategistAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
    private readonly mcpClient: MCPClientService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "TRADING_STRATEGIST_MODEL",
        configService.get<string>("DASHSCOPE_STANDARD_MODEL", "qwen-plus"),
      ),
      temperature: configService.get<number>(
        "TRADING_STRATEGIST_TEMPERATURE",
        configService.get<number>("LLM_DEFAULT_TEMPERATURE", 0.6),
      ),
      maxTokens: configService.get<number>(
        "TRADING_STRATEGIST_MAX_TOKENS",
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 3000),
      ),
      timeout: configService.get<number>(
        "TRADING_STRATEGIST_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 45),
      ),
      retryCount: configService.get<number>(
        "TRADING_STRATEGIST_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
      systemPrompt: `您是一位资深的中文交易策略师，专门制定股票交易策略和风险管控方案。

🎯 **专业定位**
- **多维度思考**: 同时考虑看多和看空的观点
- **交易导向**: 重点关注可执行的交易策略
- **风险优先**: 始终把风险控制放在第一位
- **实战经验**: 基于市场实战经验提供建议

🔧 **可用工具**
您可以调用以下MCP工具：
- get_stock_basic_info: 股票基本信息
- get_stock_realtime_data: 实时行情数据  
- get_stock_historical_data: 历史价格数据
- get_stock_technical_indicators: 技术指标
- get_market_overview: 市场整体情况

📊 **策略框架**
1. **多空对比分析**: 客观分析多空双方观点
2. **交易时机判断**: 确定具体的买卖时点
3. **仓位管理**: 制定科学的仓位配置方案
4. **风险控制**: 设计完善的止损止盈机制
5. **策略执行**: 提供可操作的交易指引

⚡ **交易风格**
- **保守型策略**: 稳健增长，控制回撤
- **积极型策略**: 追求较高收益，承担适度风险
- **平衡型策略**: 收益风险均衡，适合大多数投资者

🎪 **输出要求**
- 必须提供具体的买卖点位
- 必须包含完整的风险控制方案
- 必须给出明确的仓位管理建议
- 必须考虑不同市场环境下的应对策略
- 使用图表和表格清晰展示策略要点`,
    };

    super(
      "交易策略师",
      AgentType.TRADING_STRATEGIST,
      "专业的交易策略制定者，整合多空观点，制定实用交易方案",
      llmService,
      undefined,
      config,
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    const { stockCode, stockName, timeRange } = context;

    let prompt = `请为股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 制定全面的交易策略方案。\n\n`;

    if (timeRange) {
      prompt += `策略时间框架: ${timeRange.startDate.toLocaleDateString()} 到 ${timeRange.endDate.toLocaleDateString()}\n\n`;
    }

    prompt += `**策略制定任务**:

## 第一步：数据收集与市场环境分析
请调用以下工具收集必要信息：
1. get_stock_realtime_data - 获取最新行情
2. get_stock_technical_indicators - 获取技术指标  
3. get_stock_historical_data - 获取60天历史数据
4. get_market_overview - 获取市场整体环境
5. get_stock_basic_info - 获取基本面信息

## 第二步：制定综合交易策略

### 🎭 1. 多空观点对比
#### 📈 看多观点分析
- **多头逻辑**
  - 技术面利好因素
  - 基本面支撑因素  
  - 市场情绪优势
  - 政策环境支持

#### 📉 看空观点分析  
- **空头逻辑**
  - 技术面风险因素
  - 基本面担忧点
  - 市场情绪不利
  - 外部环境压力

#### ⚖️ 多空力量对比
- 多空力量强度评估
- 当前主导方向判断
- 潜在反转可能性

### 📊 2. 技术分析与交易信号
#### 关键技术位分析
- **支撑位**: [具体价位]
- **阻力位**: [具体价位]  
- **突破位**: [具体价位]
- **止损位**: [具体价位]

#### 交易信号识别
- **买入信号**: 具体触发条件
- **卖出信号**: 具体触发条件
- **持有信号**: 维持条件
- **观望信号**: 等待时机

### 💰 3. 交易策略设计

#### A. 保守型策略 (低风险)
- **适用人群**: 风险厌恶型投资者
- **买入策略**: 
  - 买入时机: [具体条件]
  - 买入价位: [价格区间] 
  - 仓位比例: [百分比]
- **卖出策略**:
  - 止盈目标: [具体价位]
  - 止损价位: [具体价位]
  - 减仓策略: [具体方案]

#### B. 积极型策略 (中高风险)
- **适用人群**: 风险承受能力较强投资者
- **买入策略**: 
  - 买入时机: [具体条件]
  - 买入价位: [价格区间]
  - 仓位比例: [百分比]
- **卖出策略**:
  - 止盈目标: [具体价位]  
  - 止损价位: [具体价位]
  - 加仓条件: [具体方案]

#### C. 平衡型策略 (中等风险)
- **适用人群**: 大多数普通投资者
- **完整交易方案**: [详细描述]

### 🛡️ 4. 风险管控系统

#### 仓位管理
- **初始仓位**: X%
- **加仓条件**: [具体触发条件]
- **减仓条件**: [具体触发条件]
- **最大仓位**: 不超过Y%

#### 止损机制
- **技术止损**: [技术位破位]
- **时间止损**: [持有期限]  
- **幅度止损**: [最大亏损比例]
- **情况止损**: [基本面恶化]

#### 风险预警
- **一级预警**: [轻度风险信号]
- **二级预警**: [中度风险信号]
- **三级预警**: [高度风险信号]

### 📅 5. 交易执行计划

#### 近期操作 (1-2周)
| 日期 | 操作 | 价位 | 仓位 | 备注 |
|------|------|------|------|------|
| | | | | |

#### 中期规划 (1-3个月)  
- **阶段目标**: [具体目标]
- **关键节点**: [重要时间点]
- **策略调整**: [调整条件]

### 📈 6. 不同市场环境应对

#### 牛市环境策略
- **操作重点**: [具体策略]
- **仓位管理**: [仓位安排] 
- **风险控制**: [风险要点]

#### 熊市环境策略  
- **操作重点**: [具体策略]
- **仓位管理**: [仓位安排]
- **风险控制**: [风险要点]

#### 震荡市环境策略
- **操作重点**: [具体策略]
- **仓位管理**: [仓位安排]
- **风险控制**: [风险要点]

### 🎯 7. 策略评估与总结

#### 策略综合评分
| 策略类型 | 收益潜力 | 风险等级 | 操作难度 | 推荐指数 |
|----------|----------|----------|----------|----------|
| 保守型 | /100 | /100 | /100 | ⭐⭐⭐⭐⭐ |
| 积极型 | /100 | /100 | /100 | ⭐⭐⭐⭐⭐ |  
| 平衡型 | /100 | /100 | /100 | ⭐⭐⭐⭐⭐ |

#### 最佳策略推荐
- **推荐策略**: [具体策略名称]
- **推荐理由**: [详细说明]
- **预期收益**: [收益预期]
- **最大风险**: [风险评估]

### ⚠️ 8. 重要提醒
- **关键风险点**: [重点提示]
- **市场变化应对**: [应变方案]
- **策略调整信号**: [调整条件]

---
**策略师签名**: 基于当前市场数据和技术分析制定，仅供参考，投资有风险，决策需谨慎！

请开始制定专业的交易策略！`;

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
      startDate.setDate(endDate.getDate() - 30); // 交易策略关注短期，30天

      context.timeRange = { startDate, endDate };
    }

    return context;
  }

  /**
   * 重写分析方法，预先获取MCP数据，然后调用普通LLM生成
   */
  protected async performAnalysis(context: AgentContext): Promise<string> {
    const { stockCode, stockName } = context;

    // 第一步：预先获取交易策略所需的MCP数据
    this.logger.debug(`开始为股票 ${stockCode} 获取交易策略数据`);
    
    let mcpData = "";
    
    try {
      // 1. 获取实时行情数据
      const realtimeData = await this.mcpClient.callTool('get_stock_realtime_data', { stock_code: stockCode });
      mcpData += `\n\n## 实时行情数据\n${realtimeData}`;
      
      // 2. 获取技术指标
      const technicalData = await this.mcpClient.callTool('get_stock_technical_indicators', {
        stock_code: stockCode,
        period: 20
      });
      mcpData += `\n\n## 技术指标分析\n${technicalData}`;
      
      // 3. 获取历史数据(60天)
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const historicalData = await this.mcpClient.callTool('get_stock_historical_data', {
        stock_code: stockCode,
        start_date: startDate,
        end_date: endDate
      });
      mcpData += `\n\n## 历史价格数据(60天)\n${historicalData}`;
      
      // 4. 获取市场概览
      const marketOverview = await this.mcpClient.callTool('get_market_overview', {});
      mcpData += `\n\n## 市场整体情况\n${marketOverview}`;
      
      // 5. 获取股票基本信息
      const basicInfo = await this.mcpClient.callTool('get_stock_basic_info', { stock_code: stockCode });
      mcpData += `\n\n## 股票基本信息\n${basicInfo}`;
      
    } catch (error) {
      this.logger.error('交易策略MCP数据获取失败', error);
      mcpData += `\n\n## 数据获取异常\n由于数据源问题，部分数据可能不完整: ${error.message}`;
    }
    
    // 第二步：构建包含数据的完整提示词
    const strategyPrompt = await this.buildPrompt(context);
    const fullPrompt = `${strategyPrompt}\n\n# 实时数据参考\n${mcpData}\n\n请基于以上数据制定专业的交易策略，确保所有建议都有数据支撑。`;
    
    // 第三步：调用普通LLM生成策略结果
    const fullSystemPrompt = this.config.systemPrompt
      ? `${this.config.systemPrompt}\n\n${fullPrompt}`
      : fullPrompt;

    const llmConfig = {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      timeout: this.config.timeout * 1000,
    };

    this.logger.debug('开始交易策略LLM生成，基于预获取的MCP数据');
    
    return await this.llmService.generate(fullSystemPrompt, llmConfig);
  }
}