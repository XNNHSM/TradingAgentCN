import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {BaseAgent} from '../base/base-agent';
import {LLMService} from '../services/llm.service';
import {AgentExecutionRecordService} from '../services/agent-execution-record.service';
import {AgentConfig, AgentContext, AgentResult, AgentStatus, AgentType} from '../interfaces/agent.interface';
import {BusinessLogger} from '../../common/utils/business-logger.util';

/**
 * 基础数据智能体
 * 专门负责分析来自Activities传递的基础股票信息和实时数据
 * 按需调用原则: 只有这个智能体负责基础股票信息相关的分析
 */
@Injectable()
export class BasicDataAgent extends BaseAgent {
  private readonly businessLogger = new BusinessLogger(BasicDataAgent.name);

  constructor(
    protected readonly llmService: LLMService,
    protected readonly configService: ConfigService,
    protected readonly executionRecordService?: AgentExecutionRecordService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "BASIC_DATA_MODEL",
        configService.get<string>("LLM_DEFAULT_MODEL", "qwen-turbo"), // 轻量模型
      ),
      temperature: configService.get<number>(
        "BASIC_DATA_TEMPERATURE", 
        0.3, // 较低温度，更准确的数据解析
      ),
      maxTokens: configService.get<number>(
        "BASIC_DATA_MAX_TOKENS",
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 1500),
      ),
      timeout: configService.get<number>(
        "BASIC_DATA_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 120),
      ),
      retryCount: configService.get<number>(
        "BASIC_DATA_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 2),
      ),
      systemPrompt: `您是一位专业的基础数据分析师，负责获取和分析股票的基本信息和实时行情数据。

🎯 **核心职责**:
1. **基本信息分析**: 解读股票基本信息，包括公司名称、行业分类、上市状态等
2. **实时数据分析**: 分析当前价格、涨跌幅、成交量等实时行情指标
3. **数据整合**: 将基础信息和实时数据整合成易于理解的分析报告
4. **初步判断**: 基于基础数据给出初步的市场表现判断

📊 **分析框架**:
- **公司概况**: 公司名称、所属行业、市场地位
- **价格表现**: 当前价格、涨跌情况、价格区间
- **交易活跃度**: 成交量、换手率等流动性指标
- **基本面信息**: 总股本、流通股本、市值等基础数据

💡 **输出要求**:
- 简洁明了的数据总结
- 基于数据的客观分析
- 不进行复杂的预测判断
- 为其他智能体提供可靠的基础数据基础

请用中文提供专业、准确的基础数据分析。`,
    };

    super(
      "基础数据智能体",
      AgentType.BASIC_DATA_AGENT,
      "专门负责股票基本信息和实时数据的获取与分析",
      llmService,
      undefined, // dataToolkit (已废弃)
      config,
      executionRecordService,
    );
  }

  
  /**
   * 准备上下文 - 验证和准备分析所需的上下文数据
   */
  protected async prepareContext(context: AgentContext): Promise<AgentContext> {
    // 从context中获取MCP数据（由Activities提供）
    const mcpData = context.metadata?.mcpData;
    const basicInfo = mcpData?.basicInfo;
    const realtimeData = mcpData?.realtimeData;

    if (!basicInfo && !realtimeData) {
      throw new Error('基础数据和实时数据均未提供');
    }

    // 返回包含MCP数据的上下文
    return {
      ...context,
      metadata: {
        ...context.metadata,
        mcpData: {
          basicInfo,
          realtimeData,
        }
      }
    };
  }

  /**
   * 执行分析 - 调用LLM进行基础数据分析
   */
  protected async executeAnalysis(context: AgentContext): Promise<string> {
    // 从准备好的上下文中获取MCP数据
    const mcpData = context.metadata?.mcpData;
    const basicInfo = mcpData?.basicInfo;
    const realtimeData = mcpData?.realtimeData;

    // 构建分析提示词
    const analysisPrompt = this.buildAnalysisPrompt(context, basicInfo, realtimeData);

    // 调用LLM进行基础数据分析
    return await this.callLLM(analysisPrompt);
  }

  /**
   * 处理结果 - 将分析结果转换为AgentResult格式
   */
  protected async processResult(analysis: string, context: AgentContext): Promise<AgentResult> {
    // 从context中获取MCP数据
    const mcpData = context.metadata?.mcpData;
    const basicInfo = mcpData?.basicInfo;
    const realtimeData = mcpData?.realtimeData;

    // 从分析结果中提取评分和建议
    const score = this.extractScore(analysis);
    const recommendation = this.extractRecommendation(analysis);

    const result: AgentResult = {
      agentName: this.name,
      agentType: this.type,
      analysis,
      score,
      recommendation,
      confidence: this.calculateConfidence(basicInfo, realtimeData),
      keyInsights: this.extractBasicInsights(analysis),
      risks: this.identifyRisks(analysis),
      supportingData: {
        analysisType: 'basic_data_analysis',
        dataSource: 'mcp_activities',
        basicInfo,
        realtimeData,
        dataQuality: this.assessDataQuality(basicInfo, realtimeData),
        timeRange: context.timeRange,
      },
      timestamp: new Date(),
    };

    this.businessLogger.serviceInfo(
      `基础数据分析完成，评分: ${score}`
    );

    return result;
  }

  /**
   * 构建基础数据分析提示词
   */
  private buildAnalysisPrompt(context: AgentContext, basicInfo: any, realtimeData: any): string {
    const { stockCode, stockName } = context;
    
    let prompt = `请分析股票 ${stockCode}`;
    if (stockName) {
      prompt += ` (${stockName})`;
    }
    prompt += ` 的基础数据信息。\n\n`;

    // 添加基本信息
    if (basicInfo) {
      prompt += `**股票基本信息**:\n${JSON.stringify(basicInfo, null, 2)}\n\n`;
    }

    // 添加实时数据
    if (realtimeData) {
      prompt += `**实时行情数据**:\n${JSON.stringify(realtimeData, null, 2)}\n\n`;
    }

    prompt += `请基于以上数据进行专业的基础数据分析，包括：

1. **公司基本情况**: 
   - 公司名称、所属行业、主要业务
   - 上市板块、股票代码特征分析

2. **当前市场表现**:
   - 价格表现和涨跌情况分析
   - 成交量和市场活跃度评估
   - 市值规模和股本结构分析

3. **数据质量评估**:
   - 数据的完整性和可靠性
   - 是否存在异常数据或停牌情况

4. **基础判断**:
   - 基于当前数据的客观评估
   - 为后续深度分析提供数据基础

请提供客观、专业的基础数据分析报告。`;

    return prompt;
  }

  /**
   * 计算分析置信度
   */
  private calculateConfidence(basicInfo: any, realtimeData: any): number {
    let confidence = 0.5; // 基础置信度

    // 基于数据可用性调整置信度
    if (basicInfo && Object.keys(basicInfo).length > 0) confidence += 0.25;
    if (realtimeData && Object.keys(realtimeData).length > 0) confidence += 0.25;

    // 基础数据分析相对简单，置信度上限较高
    return Math.min(confidence, 0.95);
  }

  /**
   * 提取关键洞察
   */
  protected extractBasicInsights(analysis: string): string[] {
    const insights: string[] = [];

    // 基础数据关键词
    const keywords = [
      "公司", "行业", "价格", "成交量", "市值", 
      "涨跌", "活跃", "流通", "基本面"
    ];

    const sentences = analysis.split(/[。！？]/);
    sentences.forEach(sentence => {
      keywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 10) {
          insights.push(sentence.trim());
        }
      });
    });

    return insights.slice(0, 5); // 最多返回5个洞察
  }

  /**
   * 识别风险因素
   */
  private identifyRisks(analysis: string): string[] {
    const risks: string[] = [];

    // 基础数据常见风险
    const commonRisks = [
      "基础数据可能存在延迟",
      "实时数据在交易时间外可能不准确", 
      "基础信息可能需要结合其他分析"
    ];

    // 从分析中提取风险相关内容
    const riskKeywords = ["风险", "延迟", "停牌", "异常", "不完整"];
    const sentences = analysis.split(/[。！？]/);
    
    sentences.forEach(sentence => {
      riskKeywords.forEach(keyword => {
        if (sentence.includes(keyword) && sentence.trim().length > 8) {
          risks.push(sentence.trim());
        }
      });
    });

    // 如果没有从分析中提取到风险，添加通用风险
    if (risks.length === 0) {
      risks.push(...commonRisks.slice(0, 2));
    }

    return risks.slice(0, 3); // 最多返回3个风险点
  }

  /**
   * 评估数据质量
   */
  private assessDataQuality(basicInfo: any, realtimeData: any): string {
    const issues: string[] = [];

    if (!basicInfo || Object.keys(basicInfo).length === 0) {
      issues.push("基本信息缺失");
    }

    if (!realtimeData || Object.keys(realtimeData).length === 0) {
      issues.push("实时数据缺失");
    }

    if (issues.length === 0) {
      return "数据完整";
    } else {
      return `数据质量问题: ${issues.join(", ")}`;
    }
  }
}