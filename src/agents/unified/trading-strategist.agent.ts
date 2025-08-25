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
 * 交易策略师智能体 (优化版)
 * 整合了原有的多头研究员、空头研究员、交易员和风险管理员的功能
 * 专注于制定具体的交易策略和风险管控方案
 * 🎯 避免直接调用MCP服务，接收综合分析师提供的共享数据，控制成本
 */
@Injectable()
export class TradingStrategistAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
    executionRecordService: AgentExecutionRecordService,
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

📊 **数据来源说明**
您将接收由综合分析师提供的完整股票分析数据，包括：
- 综合分析师的专业分析报告和评分
- 技术面、基本面、消息面的详细分析
- 股票基础数据、行情数据、技术指标数据
- 财务数据和相关新闻的情感分析

📊 **策略框架**
1. **多空对比分析**: 基于综合分析结果，客观分析多空双方观点
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
- 使用图表和表格清晰展示策略要点
- 基于综合分析师的数据和结论进行策略制定`,
    };

    super(
      "交易策略师",
      AgentType.TRADING_STRATEGIST,
      "专业的交易策略制定者，整合多空观点，制定实用交易方案",
      llmService,
      undefined,
      config,
      executionRecordService,
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

请基于综合分析师提供的专业分析报告制定交易策略：

## 制定综合交易策略

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
   * 制定交易策略，基于综合分析师提供的分析报告
   */
  async analyzeWithComprehensiveData(context: AgentContext, comprehensiveAnalysis: string): Promise<string> {
    const { stockCode } = context;

    this.logger.debug(`开始为股票 ${stockCode} 制定交易策略`);
    
    // 构建策略制定提示词
    const strategyPrompt = await this.buildPrompt(context);
    const fullPrompt = `${strategyPrompt}\n\n# 综合分析师报告\n${comprehensiveAnalysis}\n\n请基于以上综合分析报告制定专业的交易策略，确保所有建议都有分析支撑。`;
    
    // 调用LLM生成交易策略
    const fullSystemPrompt = this.config.systemPrompt
      ? `${this.config.systemPrompt}\n\n${fullPrompt}`
      : fullPrompt;

    const llmConfig = {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      timeout: this.config.timeout * 1000,
    };

    this.logger.debug('开始生成交易策略，基于综合分析师报告');
    
    return await this.llmService.generate(fullSystemPrompt, llmConfig);
  }

  /**
   * 保留原有的performAnalysis方法以维持兼容性，但不再直接调用MCP服务
   */
  protected async performAnalysis(context: AgentContext): Promise<string> {
    // 交易策略师现在需要依赖外部提供的综合分析数据
    // 这个方法通常不会被直接调用，而是通过analyzeWithComprehensiveData方法
    const { stockCode } = context;
    
    this.logger.warn(`交易策略师 performAnalysis 被直接调用，股票: ${stockCode}，建议使用 analyzeWithComprehensiveData 方法`);
    
    const strategyPrompt = await this.buildPrompt(context);
    const fullPrompt = `${strategyPrompt}\n\n# 注意\n由于缺少综合分析师的分析报告，请基于一般市场知识制定交易策略框架。\n\n请制定通用的交易策略框架。`;
    
    const fullSystemPrompt = this.config.systemPrompt
      ? `${this.config.systemPrompt}\n\n${fullPrompt}`
      : fullPrompt;

    const llmConfig = {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      timeout: this.config.timeout * 1000,
    };
    
    return await this.llmService.generate(fullSystemPrompt, llmConfig);
  }
}