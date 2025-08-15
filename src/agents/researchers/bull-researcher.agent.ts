import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent } from '../base/base-agent';
import { AgentType, AgentContext, AgentConfig, AgentResult } from '../interfaces/agent.interface';
import { LLMService } from '../services/llm.service';

/**
 * 多头研究员智能体 - 专门构建看涨论据
 */
@Injectable()
export class BullResearcherAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>('BULL_RESEARCHER_MODEL', configService.get<string>('DASHSCOPE_STANDARD_MODEL', 'qwen-plus')),
      temperature: configService.get<number>('BULL_RESEARCHER_TEMPERATURE', 0.8),
      maxTokens: configService.get<number>('BULL_RESEARCHER_MAX_TOKENS', 2500),
      timeout: configService.get<number>('BULL_RESEARCHER_TIMEOUT', configService.get<number>('LLM_DEFAULT_TIMEOUT', 45)),
      retryCount: configService.get<number>('BULL_RESEARCHER_RETRY_COUNT', configService.get<number>('LLM_MAX_RETRIES', 3)),
      systemPrompt: `您是一位专业的多头分析师，负责为投资该股票建立强有力的论证。您的任务是构建一个基于证据的强有力案例，强调增长潜力、竞争优势和积极的市场指标。

🎯 重点关注领域：

📈 增长潜力：
- 突出公司的市场机会、收入预测和可扩展性
- 分析新产品、新市场、新技术的增长驱动因素
- 评估管理层的执行能力和战略规划

🏆 竞争优势：
- 强调独特产品、强势品牌或主导市场地位等因素
- 分析护城河：技术壁垒、网络效应、规模经济
- 评估公司在行业中的相对竞争地位

📊 积极指标：
- 使用财务健康状况、行业趋势和最新正面新闻作为证据
- 分析估值吸引力和上涨空间
- 识别催化剂事件和积极因素

🛡️ 反驳空头观点：
- 用具体数据和合理推理批判性分析空头论点
- 彻底解决担忧并展示为什么多头观点具有更强的优势
- 提供替代解释和风险缓解措施

💬 辩论风格：
- 以对话式风格呈现论点，直接与空头分析师的观点交锋
- 有效辩论而不仅仅是列举数据
- 保持专业但有说服力的语调

您需要构建一个基于证据的强有力案例，强调增长潜力、竞争优势和积极的市场指标。用具体数据和合理推理批判性分析空头论点，彻底解决担忧并展示为什么多头观点具有更强的优势。

请用中文进行专业、有说服力的多头分析和辩论。`,
    };

    super(
      '多头研究员',
      AgentType.BULL_RESEARCHER,
      '专业的多头研究员，专注于挖掘投资机会和看涨因素',
      llmService,
      undefined, // dataToolkit 暂时不需要
      config
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    const { stockCode, stockName, previousResults } = context;
    
    let prompt = `作为专业的多头研究员，请为股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 构建强有力的看涨投资论据。\n\n`;

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
        prompt += `\n`;
      });
    }

    prompt += `请按照以下结构构建多头投资论据:

## 多头投资研究报告

### 1. 投资亮点总览
请突出该股票最具吸引力的投资亮点，包括：
- 核心竞争优势
- 独特价值主张
- 关键增长驱动因素
- 估值吸引力

### 2. 增长潜力深度分析

#### 2.1 业务增长驱动因素
- 市场扩张机会
- 产品创新能力
- 新业务板块潜力
- 技术领先优势

#### 2.2 财务增长预期
- 收入增长预测
- 利润率改善空间
- 现金流增长潜力
- ROE提升预期

#### 2.3 市场机会评估
- 行业增长前景
- 市场份额提升空间
- 新兴市场机会
- 政策支持利好

### 3. 竞争优势分析

#### 3.1 护城河分析
- 技术壁垒
- 品牌价值
- 网络效应
- 规模经济
- 成本优势

#### 3.2 行业地位
- 市场领导地位
- 竞争格局优势
- 差异化竞争策略
- 客户粘性

### 4. 催化剂因素识别
- 即将到来的积极事件
- 政策利好预期
- 产品发布计划
- 业绩拐点预期
- 估值修复机会

### 5. 风险缓解论证
针对可能的空头观点和风险因素：
- 宏观风险应对能力
- 行业风险缓解措施
- 公司特定风险管理
- 估值风险分析

### 6. 估值吸引力分析

#### 6.1 绝对估值分析
- DCF模型合理性
- 资产价值评估
- 成长性价值体现

#### 6.2 相对估值优势
- 与同行业比较
- 历史估值水平
- 国际对标分析

### 7. 投资逻辑总结
- **多头评分**: [60-100分，体现乐观预期]
- **投资建议**: [买入/强烈买入]
- **目标价位**: [具体价格]
- **投资期限**: [短期/中期/长期]
- **核心投资逻辑**: [3-5个最强有力的理由]

### 8. 多头要点总结表格

| 投资要点 | 当前状况 | 发展潜力 | 竞争优势 | 风险缓解 |
|----------|----------|----------|----------|----------|
| 增长驱动 | | | | |
| 盈利能力 | | | | |
| 市场地位 | | | | |
| 技术实力 | | | | |
| 管理能力 | | | | |

### 9. 积极因素清单
- 列出所有支持看涨观点的因素
- 优先级排序
- 实现概率评估
- 影响程度分析

请基于全面分析提供令人信服的多头投资论据，重点突出投资机会和上涨潜力。`;

    return prompt;
  }

  protected async postprocessResult(analysis: string, context: AgentContext): Promise<AgentResult> {
    const result = await super.postprocessResult(analysis, context);
    
    // 多头研究员的评分倾向于乐观，但基于事实
    if (result.score && result.score < 60) {
      result.score = Math.max(60, result.score + 10); // 适度提升评分以体现乐观倾向
    }
    
    // 提升置信度如果分析详细
    if (result.confidence && analysis.length > 1000) {
      result.confidence = Math.min(0.95, result.confidence + 0.1);
    }

    return result;
  }
}