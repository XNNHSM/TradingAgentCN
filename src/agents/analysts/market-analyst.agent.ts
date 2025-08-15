import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent } from '../base/base-agent';
import { AgentType, AgentContext, AgentConfig } from '../interfaces/agent.interface';
import { LLMService } from '../services/llm.service';

/**
 * 市场分析师智能体 - 专门进行技术分析
 */
@Injectable()
export class MarketAnalystAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>('MARKET_ANALYST_MODEL', configService.get<string>('DASHSCOPE_STANDARD_MODEL', 'qwen-plus')),
      temperature: configService.get<number>('MARKET_ANALYST_TEMPERATURE', configService.get<number>('LLM_DEFAULT_TEMPERATURE', 0.7)),
      maxTokens: configService.get<number>('MARKET_ANALYST_MAX_TOKENS', configService.get<number>('LLM_DEFAULT_MAX_TOKENS', 2500)),
      timeout: configService.get<number>('MARKET_ANALYST_TIMEOUT', configService.get<number>('LLM_DEFAULT_TIMEOUT', 45)),
      retryCount: configService.get<number>('MARKET_ANALYST_RETRY_COUNT', configService.get<number>('LLM_MAX_RETRIES', 3)),
      systemPrompt: `您是一位专业的中文市场分析师，专门分析股票市场技术指标。您的任务是从以下指标列表中选择最相关的指标（最多8个），为特定的市场条件或交易策略提供分析。

技术指标分类：

📈 移动平均线类：
- close_50_sma: 50日简单移动平均线 - 中期趋势指标，用于识别趋势方向和动态支撑阻力
- close_200_sma: 200日简单移动平均线 - 长期趋势基准，确认整体市场趋势和金叉死叉设置
- close_10_ema: 10日指数移动平均线 - 短期趋势响应，捕捉快速动量变化和潜在入场点

📊 MACD相关指标：
- macd: MACD主线 - 通过EMA差值计算动量，寻找交叉和背离作为趋势变化信号
- macds: MACD信号线 - MACD线的EMA平滑，与MACD线交叉触发交易信号
- macdh: MACD柱状图 - 显示MACD线与信号线的差距，可视化动量强度和早期背离

⚡ 动量指标：
- rsi: 相对强弱指数 - 测量动量以标记超买超卖条件，应用70/30阈值并观察背离

📏 波动率指标：
- boll: 布林带中轨 - 20日SMA作为布林带基础，充当价格运动的动态基准
- boll_ub: 布林带上轨 - 通常为中轨上方2个标准差，信号潜在超买条件和突破区域
- boll_lb: 布林带下轨 - 通常为中轨下方2个标准差，指示潜在超卖条件
- atr: 平均真实波幅 - 测量波动率，用于设置止损水平和根据当前市场波动调整仓位

📊 成交量指标：
- vwma: 成交量加权移动平均线 - 结合价格行为和成交量数据确认趋势

分析要求：
1. 选择提供多样化和互补信息的指标，避免冗余
2. 简要解释为什么这些指标适合给定的市场环境
3. 撰写详细且细致的趋势观察报告，避免简单地说"趋势混合"
4. 在报告末尾添加Markdown表格来组织关键要点，使其有条理且易于阅读
5. 必须给出明确的评分（0-100分）和交易建议

请用中文提供专业、详细的市场分析。`,
    };

    super(
      '市场分析师',
      AgentType.MARKET_ANALYST,
      '专业的技术分析师，专注于股票市场技术指标分析',
      llmService,
      config
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    const { stockCode, stockName, timeRange, historicalData } = context;
    
    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 进行全面的技术分析。\n\n`;

    // 添加时间范围信息
    if (timeRange) {
      prompt += `分析时间范围: ${timeRange.startDate.toLocaleDateString()} 到 ${timeRange.endDate.toLocaleDateString()}\n\n`;
    }

    // 添加历史数据信息
    if (historicalData) {
      prompt += `历史数据概要:\n`;
      if (historicalData.priceData) {
        prompt += `- 价格数据: 最新价格 ${historicalData.priceData.current}，变动 ${historicalData.priceData.change}\n`;
      }
      if (historicalData.volume) {
        prompt += `- 成交量: ${historicalData.volume}\n`;
      }
      if (historicalData.technicalIndicators) {
        prompt += `- 技术指标: ${JSON.stringify(historicalData.technicalIndicators, null, 2)}\n`;
      }
      prompt += `\n`;
    }

    prompt += `请按照以下结构进行分析:

## 技术分析报告

### 1. 趋势分析
- 短期趋势(5-20日)
- 中期趋势(20-60日) 
- 长期趋势(60日以上)

### 2. 技术指标分析
请选择最相关的8个技术指标进行分析:
- 移动平均线分析
- MACD动量分析
- RSI超买超卖分析
- 布林带波动率分析
- 成交量确认分析

### 3. 关键支撑阻力位
- 重要支撑位
- 重要阻力位
- 突破概率分析

### 4. 交易信号
- 买入信号强度
- 卖出信号强度
- 持有建议

### 5. 风险评估
- 技术面风险点
- 止损建议
- 仓位管理建议

### 6. 综合评估
- **技术面评分**: [0-100分]
- **短期建议**: [强烈买入/买入/持有/卖出/强烈卖出]
- **目标价位**: [具体价格]
- **止损价位**: [具体价格]

### 7. 关键要点总结表格

| 项目 | 评估 | 说明 |
|------|------|------|
| 趋势方向 | | |
| 动量强度 | | |
| 超买超卖 | | |
| 成交量确认 | | |
| 风险等级 | | |

请提供详细、专业的技术分析，确保分析深度和实用性。`;

    return prompt;
  }

  protected async preprocessContext(context: AgentContext): Promise<AgentContext> {
    // 确保有基本的时间范围
    if (!context.timeRange) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 60); // 默认60天
      
      context.timeRange = { startDate, endDate };
    }

    return context;
  }
}