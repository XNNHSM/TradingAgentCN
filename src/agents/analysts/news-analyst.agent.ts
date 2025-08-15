import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent } from '../base/base-agent';
import { AgentType, AgentContext, AgentConfig } from '../interfaces/agent.interface';
import { LLMService } from '../services/llm.service';

/**
 * 新闻分析师智能体 - 专门进行新闻和情绪分析
 */
@Injectable()
export class NewsAnalystAgent extends BaseAgent {
  constructor(
    llmService: LLMService,
    configService: ConfigService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>('NEWS_ANALYST_MODEL', configService.get<string>('DASHSCOPE_STANDARD_MODEL', 'qwen-plus')),
      temperature: configService.get<number>('NEWS_ANALYST_TEMPERATURE', 0.7),
      maxTokens: configService.get<number>('NEWS_ANALYST_MAX_TOKENS', 2500),
      timeout: configService.get<number>('NEWS_ANALYST_TIMEOUT', configService.get<number>('LLM_DEFAULT_TIMEOUT', 45)),
      retryCount: configService.get<number>('NEWS_ANALYST_RETRY_COUNT', configService.get<number>('LLM_MAX_RETRIES', 3)),
      systemPrompt: `您是一位专业的新闻研究分析师，专门分析过去一周的新闻和趋势。您的任务是撰写一份关于当前世界状况的综合报告，重点关注与交易和宏观经济相关的内容。

分析范围：
🌍 全球宏观经济新闻：央行政策、通胀数据、GDP增长、就业数据
📈 金融市场动态：股市表现、债券收益率、汇率变化、商品价格
🏛️ 政策影响：货币政策、财政政策、监管变化、贸易政策
🏭 行业趋势：科技、能源、金融、消费、医疗等重点行业动态
⚡ 突发事件：地缘政治事件、自然灾害、重大公司事件

新闻来源：
- 财经新闻数据
- 宏观经济数据
- 社交媒体热点
- 行业动态

分析要求：
1. 提供详细和细致的分析洞察，避免简单地说"趋势混合"
2. 重点关注可能影响市场的重要新闻事件
3. 分析新闻事件的潜在市场影响和交易机会
4. 识别市场情绪的变化趋势
5. 评估宏观经济环境对不同资产类别的影响
6. 在报告末尾添加Markdown表格来组织关键要点，使其有条理且易于阅读
7. 必须给出明确的情绪评分（0-100分）和市场影响评估

请用中文撰写专业、全面的新闻分析报告。`,
    };

    super(
      '新闻分析师',
      AgentType.NEWS_ANALYST,
      '专业的新闻情绪分析师，专注于市场新闻和情绪趋势分析',
      llmService,
      undefined, // dataToolkit 暂时不需要
      config
    );
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    const { stockCode, stockName, newsData, timeRange } = context;
    
    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 进行全面的新闻情绪分析。\n\n`;

    // 添加分析时间范围
    if (timeRange) {
      prompt += `分析时间范围: ${timeRange.startDate.toLocaleDateString()} 到 ${timeRange.endDate.toLocaleDateString()}\n\n`;
    }

    // 添加新闻数据信息
    if (newsData) {
      prompt += `新闻数据概要:\n`;
      if (newsData.companyNews && newsData.companyNews.length > 0) {
        prompt += `\n公司相关新闻 (${newsData.companyNews.length}条):\n`;
        newsData.companyNews.slice(0, 5).forEach((news, index) => {
          prompt += `${index + 1}. ${news.title} - ${news.summary || '暂无摘要'}\n`;
        });
      }
      
      if (newsData.industryNews && newsData.industryNews.length > 0) {
        prompt += `\n行业相关新闻 (${newsData.industryNews.length}条):\n`;
        newsData.industryNews.slice(0, 3).forEach((news, index) => {
          prompt += `${index + 1}. ${news.title} - ${news.summary || '暂无摘要'}\n`;
        });
      }
      
      if (newsData.marketNews && newsData.marketNews.length > 0) {
        prompt += `\n市场宏观新闻 (${newsData.marketNews.length}条):\n`;
        newsData.marketNews.slice(0, 3).forEach((news, index) => {
          prompt += `${index + 1}. ${news.title} - ${news.summary || '暂无摘要'}\n`;
        });
      }
      
      if (newsData.sentiment) {
        prompt += `\n情绪数据:`;
        prompt += `\n- 正面情绪: ${newsData.sentiment.positive || 'N/A'}`;
        prompt += `\n- 中性情绪: ${newsData.sentiment.neutral || 'N/A'}`;
        prompt += `\n- 负面情绪: ${newsData.sentiment.negative || 'N/A'}`;
      }
      
      prompt += `\n\n`;
    }

    prompt += `请按照以下结构进行新闻情绪分析:

## 新闻情绪分析报告

### 1. 新闻概览
- 新闻总量统计
- 重要新闻事件摘要
- 新闻频率变化趋势
- 媒体关注度分析

### 2. 公司专项新闻分析
- 公司重大公告解读
- 业绩相关新闻影响
- 战略动向分析
- 管理层动态
- 投资者关系活动

### 3. 行业新闻影响分析
- 行业政策变化
- 竞争对手动态
- 行业技术发展
- 供应链影响
- 市场需求变化

### 4. 宏观环境分析
- 宏观经济政策影响
- 监管环境变化
- 国际贸易影响
- 汇率政策影响
- 资本市场环境

### 5. 情绪趋势分析

#### 5.1 整体情绪评估
- 市场情绪指数
- 情绪变化趋势
- 情绪极值分析
- 情绪转折点识别

#### 5.2 分类情绪分析
- 基本面相关情绪
- 技术面相关情绪
- 政策相关情绪
- 行业相关情绪

### 6. 社交媒体情绪
- 讨论热度变化
- 投资者情绪倾向
- 关键词热度分析
- 影响力人士观点

### 7. 新闻影响评估
- 短期影响预测(1-3天)
- 中期影响预测(1-2周)
- 长期影响预测(1个月以上)
- 潜在催化剂事件

### 8. 综合评估
- **新闻情绪评分**: [0-100分，50为中性]
- **市场影响程度**: [高/中/低]
- **情绪建议**: [乐观/谨慎乐观/中性/谨慎悲观/悲观]
- **关注要点**: [列出3-5个关键关注点]

### 9. 关键新闻事件总结表格

| 事件类型 | 影响程度 | 时效性 | 情绪倾向 | 市场反应预期 |
|----------|----------|--------|----------|--------------|
| 公司公告 | | | | |
| 行业政策 | | | | |
| 财报业绩 | | | | |
| 宏观政策 | | | | |
| 突发事件 | | | | |

### 10. 风险预警
- 负面新闻风险
- 市场情绪风险
- 信息不对称风险
- 预期差风险

请提供深入、客观的新闻情绪分析，重点关注新闻事件对股价的潜在影响。`;

    return prompt;
  }

  protected async preprocessContext(context: AgentContext): Promise<AgentContext> {
    // 确保有基本的时间范围
    if (!context.timeRange) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7); // 默认7天
      
      context.timeRange = { startDate, endDate };
    }

    return context;
  }
}