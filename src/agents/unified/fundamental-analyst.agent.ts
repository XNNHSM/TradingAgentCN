import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent } from '../base/base-agent';
import { MCPClientService } from '../services/mcp-client.service';
import { LLMService } from '../services/llm.service';
import { AgentExecutionRecordService } from '../services/agent-execution-record.service';
import { 
  AgentConfig, 
  AgentType, 
  AgentContext, 
  AgentResult, 
  AgentStatus,
  TradingRecommendation 
} from '../interfaces/agent.interface';
import { BusinessLogger } from '../../common/utils/business-logger.util';

/**
 * 基本面分析智能体
 * 专门负责 get_stock_financial_data MCP 服务
 * 按需调用原则: 只有这个智能体可以调用财务数据相关的 MCP 服务
 */
@Injectable()
export class FundamentalAnalystAgent extends BaseAgent {
  private readonly businessLogger = new BusinessLogger(FundamentalAnalystAgent.name);

  constructor(
    protected readonly llmService: LLMService,
    protected readonly configService: ConfigService,
    protected readonly executionRecordService: AgentExecutionRecordService,
    protected readonly mcpClientService: MCPClientService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "FUNDAMENTAL_ANALYST_MODEL",
        configService.get<string>("LLM_DEFAULT_MODEL", "qwen-max"), // 基本面分析需要强模型
      ),
      temperature: configService.get<number>(
        "FUNDAMENTAL_ANALYST_TEMPERATURE", 
        0.4, // 较低温度，更稳定的财务分析
      ),
      maxTokens: configService.get<number>(
        "FUNDAMENTAL_ANALYST_MAX_TOKENS",
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 3500),
      ),
      timeout: configService.get<number>(
        "FUNDAMENTAL_ANALYST_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 75),
      ),
      retryCount: configService.get<number>(
        "FUNDAMENTAL_ANALYST_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 3),
      ),
      systemPrompt: `您是一位资深的基本面分析师，专门负责上市公司财务数据分析和价值评估。您具备深厚的财务分析功底和估值建模能力。

🎯 **核心职责**:
1. **财务健康诊断**: 分析公司的盈利能力、偿债能力、营运能力
2. **估值分析**: 通过多种估值方法判断股票的内在价值
3. **成长性评估**: 分析公司的成长潜力和可持续发展能力
4. **投资价值判断**: 基于基本面分析给出投资建议

📊 **分析框架**:

**财务能力分析**:
- **盈利能力**: ROE、ROA、毛利率、净利率、EBITDA
- **偿债能力**: 资产负债率、流动比率、速动比率、利息保障倍数
- **营运能力**: 存货周转率、应收账款周转率、总资产周转率
- **现金流**: 经营性现金流、自由现金流、现金流质量

**估值分析方法**:
- **相对估值**: PE、PB、PS、PEG等相对估值指标
- **绝对估值**: DCF现金流折现模型的定性分析
- **行业对比**: 与同行业公司的估值水平对比
- **历史估值**: 与公司历史估值区间的对比

**成长性指标**:
- **营收增长**: 营业收入的增长趋势和质量
- **利润增长**: 净利润的增长持续性和稳定性
- **市场扩张**: 市场份额变化和业务拓展能力
- **创新能力**: 研发投入、新产品开发等

🔍 **重点关注领域**:
1. **财务报表质量**: 识别财务造假风险和会计处理问题
2. **业务模式分析**: 理解公司商业模式和盈利模式
3. **竞争优势**: 评估公司的护城河和竞争地位
4. **风险因素**: 识别影响公司基本面的主要风险

📋 **输出要求**:
- 提供0-100分的基本面综合评分
- 给出明确的价值投资建议
- 计算合理估值区间和安全边际
- 评估分析的可靠性和关键假设

请用中文提供专业、深入的基本面分析报告。`,
    };

    super(
      "基本面分析智能体",
      AgentType.FUNDAMENTAL_ANALYST_NEW,
      "专门负责公司财务数据分析和价值评估",
      llmService,
      undefined, // dataToolkit (已废弃)
      config,
      executionRecordService,
    );
  }

  /**
   * 执行基本面分析
   * 按需调用 get_stock_financial_data
   */
  async analyze(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    this.status = AgentStatus.ANALYZING;

    try {
      this.businessLogger.serviceInfo(
        `开始基本面分析股票 ${context.stockCode}`
      );

      // 按需调用 MCP 服务 - 只调用财务数据相关的服务
      const financialData = await this.getFinancialData(context.stockCode);

      // 构建分析提示词
      const analysisPrompt = this.buildAnalysisPrompt(context, financialData);

      // 调用 LLM 进行基本面分析
      const analysisResult = await this.llmService.generate(analysisPrompt, {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        timeout: this.config.timeout * 1000,
      });

      const processingTime = Date.now() - startTime;

      // 从分析结果中提取评分和建议
      const score = this.extractFundamentalScore(analysisResult);
      const recommendation = this.extractFundamentalRecommendation(analysisResult);

      const result: AgentResult = {
        agentName: this.name,
        agentType: this.type,
        analysis: analysisResult,
        score,
        recommendation,
        confidence: this.calculateFundamentalConfidence(financialData, analysisResult),
        keyInsights: this.extractFundamentalInsights(analysisResult),
        risks: this.identifyFundamentalRisks(analysisResult),
        supportingData: {
          mcpServices: ["get_stock_financial_data"],
          financialMetrics: this.extractKeyMetrics(financialData),
          valuationLevels: this.extractValuationLevels(analysisResult),
          profitabilityAnalysis: this.extractProfitabilityAnalysis(financialData),
          financialHealth: this.assessFinancialHealth(financialData),
          timeRange: context.timeRange,
        },
        timestamp: new Date(),
        processingTime,
      };

      this.status = AgentStatus.COMPLETED;
      this.businessLogger.serviceInfo(
        `基本面分析完成，评分: ${score}，建议: ${recommendation}，耗时 ${processingTime}ms`
      );

      return result;
    } catch (error) {
      this.status = AgentStatus.ERROR;
      this.businessLogger.serviceError("基本面分析失败", error);
      throw error;
    }
  }

  /**
   * 实现抽象方法：构建分析提示词
   */
  protected async buildPrompt(context: AgentContext): Promise<string> {
    // 这个方法在 analyze 中通过 buildAnalysisPrompt 实现
    return `请对股票 ${context.stockCode} 进行基本面分析。`;
  }

  /**
   * 获取财务数据 (MCP调用)
   */
  private async getFinancialData(stockCode: string): Promise<any> {
    try {
      this.businessLogger.serviceInfo(`获取 ${stockCode} 财务数据`);
      const result = await this.mcpClientService.callTool('get_stock_financial_data', { 
        stock_code: stockCode
      });
      return result;
    } catch (error) {
      this.businessLogger.serviceError(`获取 ${stockCode} 财务数据失败`, error);
      return null;
    }
  }

  /**
   * 构建基本面分析提示词
   */
  private buildAnalysisPrompt(context: AgentContext, financialData: any): string {
    const { stockCode, stockName } = context;
    
    let prompt = `请对股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 进行专业的基本面分析。\n\n`;

    // 添加财务数据
    if (financialData) {
      prompt += `**财务数据**:\n${JSON.stringify(financialData, null, 2)}\n\n`;
    } else {
      prompt += `**注意**: 财务数据获取失败或不完整，请基于可用信息进行分析。\n\n`;
    }

    // 添加其他智能体的分析结果作为参考
    if (context.previousResults && context.previousResults.length > 0) {
      prompt += `**参考信息** (其他分析师观点):\n`;
      context.previousResults.forEach((result, index) => {
        prompt += `${index + 1}. ${result.agentName}: ${result.analysis.substring(0, 200)}...\n`;
      });
      prompt += `\n`;
    }

    prompt += `请基于财务数据进行深度的基本面分析，包括：

1. **财务健康状况** (35分权重):
   - **盈利能力**: ROE、ROA、净利率、毛利率分析
   - **偿债能力**: 资产负债率、流动比率、利息保障倍数
   - **营运能力**: 各项周转率指标和资产利用效率
   - **现金流质量**: 经营性现金流与净利润的匹配度

2. **估值分析** (30分权重):
   - **相对估值**: PE、PB、PS等估值指标的合理性
   - **行业对比**: 与同行业公司估值水平的比较
   - **历史估值**: 当前估值在历史区间中的位置
   - **安全边际**: 内在价值与市场价格的差距

3. **成长性分析** (25分权重):
   - **营收增长**: 营业收入的增长趋势和可持续性
   - **利润增长**: 净利润增长的质量和稳定性
   - **业务扩张**: 市场份额和业务发展潜力
   - **投资效率**: ROIC和资本配置效率

4. **风险评估** (10分权重):
   - **财务风险**: 债务风险、流动性风险等
   - **经营风险**: 业务模式和行业竞争风险
   - **治理风险**: 公司治理和管理层风险

**输出要求**:
- 提供基本面综合评分 (0-100分)
- 给出明确的价值投资建议
- 估算合理股价区间 (如果数据允许)
- 识别主要投资风险和机会
- 评估分析的置信度

请提供专业、系统的基本面分析报告。`;

    return prompt;
  }

  /**
   * 提取基本面评分
   */
  private extractFundamentalScore(analysis: string): number {
    // 尝试从分析中提取基本面评分
    const scorePatterns = [
      /基本面评分[：:]?\s*(\d+(?:\.\d+)?)/i,
      /综合评分[：:]?\s*(\d+(?:\.\d+)?)/i,
      /财务评分[：:]?\s*(\d+(?:\.\d+)?)/i,
      /价值评分[：:]?\s*(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)分/
    ];

    for (const pattern of scorePatterns) {
      const match = analysis.match(pattern);
      if (match) {
        const score = parseFloat(match[1]);
        return Math.min(Math.max(score, 0), 100);
      }
    }

    // 基于基本面分析关键词估算评分
    const lowerAnalysis = analysis.toLowerCase();
    let score = 50; // 基础分数

    // 积极信号
    if (lowerAnalysis.includes("优秀") || lowerAnalysis.includes("强劲")) score += 15;
    if (lowerAnalysis.includes("低估") || lowerAnalysis.includes("价值洼地")) score += 12;
    if (lowerAnalysis.includes("增长") && lowerAnalysis.includes("稳定")) score += 10;
    if (lowerAnalysis.includes("现金流") && lowerAnalysis.includes("良好")) score += 8;
    if (lowerAnalysis.includes("债务") && lowerAnalysis.includes("健康")) score += 5;

    // 消极信号
    if (lowerAnalysis.includes("亏损") || lowerAnalysis.includes("恶化")) score -= 20;
    if (lowerAnalysis.includes("高估") || lowerAnalysis.includes("泡沫")) score -= 15;
    if (lowerAnalysis.includes("债务") && lowerAnalysis.includes("高")) score -= 10;
    if (lowerAnalysis.includes("下滑") || lowerAnalysis.includes("衰退")) score -= 8;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * 提取基本面交易建议
   */
  private extractFundamentalRecommendation(analysis: string): TradingRecommendation {
    const lowerAnalysis = analysis.toLowerCase();

    // 强烈信号
    if (lowerAnalysis.includes("强烈买入") || lowerAnalysis.includes("价值洼地")) {
      return TradingRecommendation.STRONG_BUY;
    }
    if (lowerAnalysis.includes("强烈卖出") || lowerAnalysis.includes("严重高估")) {
      return TradingRecommendation.STRONG_SELL;
    }

    // 一般信号
    if (lowerAnalysis.includes("建议买入") || lowerAnalysis.includes("低估")) {
      return TradingRecommendation.BUY;
    }
    if (lowerAnalysis.includes("建议卖出") || lowerAnalysis.includes("高估")) {
      return TradingRecommendation.SELL;
    }

    // 基于价值判断
    if (lowerAnalysis.includes("合理价值") || lowerAnalysis.includes("公允价值")) {
      return TradingRecommendation.HOLD;
    }

    return TradingRecommendation.HOLD; // 默认持有
  }

  /**
   * 计算基本面分析置信度
   */
  private calculateFundamentalConfidence(financialData: any, analysis: string): number {
    let confidence = 0.5; // 基础置信度

    // 数据完整性对置信度的影响
    if (financialData && typeof financialData === 'object') {
      const dataKeys = Object.keys(financialData);
      if (dataKeys.length > 10) confidence += 0.2; // 数据丰富
      else if (dataKeys.length > 5) confidence += 0.1; // 数据一般
    }

    // 分析深度对置信度的影响
    const analysisKeywords = ["ROE", "ROA", "PE", "PB", "现金流", "增长", "估值"];
    const keywordCount = analysisKeywords.filter(keyword => 
      analysis.includes(keyword)
    ).length;
    confidence += keywordCount * 0.03; // 每个关键词+3%

    // 基本面分析需要更多数据验证，置信度上限相对较低
    return Math.min(confidence, 0.85);
  }

  /**
   * 提取基本面洞察
   */
  private extractFundamentalInsights(analysis: string): string[] {
    const insights: string[] = [];

    const fundamentalKeywords = [
      "盈利能力", "偿债能力", "营运能力", "现金流", "ROE", "ROA",
      "PE", "PB", "估值", "增长", "财务", "价值", "安全边际"
    ];

    const sentences = analysis.split(/[。！？]/);
    sentences.forEach(sentence => {
      fundamentalKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 15) {
          insights.push(sentence.trim());
        }
      });
    });

    return insights.slice(0, 7); // 最多返回7个基本面洞察
  }

  /**
   * 识别基本面风险
   */
  private identifyFundamentalRisks(analysis: string): string[] {
    const risks: string[] = [];

    // 基本面分析常见风险
    const commonFundamentalRisks = [
      "财务数据存在滞后性",
      "估值模型基于历史数据和假设",
      "行业和宏观环境变化可能影响基本面",
      "财务报表质量需要进一步验证"
    ];

    // 从分析中提取风险相关内容
    const riskKeywords = ["风险", "不确定", "债务", "亏损", "下滑", "压力", "挑战"];
    const sentences = analysis.split(/[。！？]/);
    
    sentences.forEach(sentence => {
      riskKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 10) {
          risks.push(sentence.trim());
        }
      });
    });

    // 如果没有从分析中提取到风险，添加通用基本面风险
    if (risks.length === 0) {
      risks.push(...commonFundamentalRisks.slice(0, 3));
    }

    return risks.slice(0, 5); // 最多返回5个风险点
  }

  /**
   * 提取关键财务指标
   */
  private extractKeyMetrics(financialData: any): any {
    if (!financialData || typeof financialData !== 'object') {
      return "财务指标数据缺失";
    }

    const keyMetrics = {};
    const importantMetrics = ['ROE', 'ROA', 'PE', 'PB', 'PS', '净利率', '毛利率', '资产负债率'];
    
    importantMetrics.forEach(metric => {
      if (financialData[metric] !== undefined) {
        keyMetrics[metric] = financialData[metric];
      }
    });

    return Object.keys(keyMetrics).length > 0 ? keyMetrics : "关键指标缺失";
  }

  /**
   * 提取估值水平
   */
  private extractValuationLevels(analysis: string): string[] {
    const valuations: string[] = [];
    
    // 查找估值相关信息
    const valuationPatterns = [
      /PE[：:]\s*([0-9.]+)/gi,
      /PB[：:]\s*([0-9.]+)/gi,
      /估值[：:]?\s*([^。！？]+)/gi,
      /合理价格[：:]?\s*([0-9.]+)/gi
    ];

    valuationPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(analysis)) !== null) {
        valuations.push(match[0]);
      }
    });

    return valuations.slice(0, 4); // 最多返回4个估值信息
  }

  /**
   * 提取盈利能力分析
   */
  private extractProfitabilityAnalysis(financialData: any): string {
    if (!financialData) return "盈利能力数据缺失";

    const profitabilityMetrics = ['ROE', 'ROA', '净利率', '毛利率', 'EBITDA'];
    const availableMetrics = profitabilityMetrics.filter(
      metric => financialData[metric] !== undefined
    );

    if (availableMetrics.length === 0) {
      return "盈利能力指标缺失";
    }

    return `包含${availableMetrics.length}项盈利指标: ${availableMetrics.join(", ")}`;
  }

  /**
   * 评估财务健康状况
   */
  private assessFinancialHealth(financialData: any): string {
    if (!financialData) return "财务数据缺失";

    const healthIndicators: string[] = [];

    // 检查关键健康指标
    if (financialData['资产负债率'] !== undefined) {
      const debtRatio = parseFloat(financialData['资产负债率']);
      if (debtRatio < 0.5) healthIndicators.push("负债水平健康");
      else if (debtRatio > 0.7) healthIndicators.push("负债压力较大");
    }

    if (financialData['ROE'] !== undefined) {
      const roe = parseFloat(financialData['ROE']);
      if (roe > 0.15) healthIndicators.push("盈利能力强");
      else if (roe < 0.05) healthIndicators.push("盈利能力较弱");
    }

    if (financialData['现金流'] !== undefined) {
      healthIndicators.push("现金流数据可用");
    }

    return healthIndicators.length > 0 
      ? healthIndicators.join(", ") 
      : "财务健康状况需进一步分析";
  }
}