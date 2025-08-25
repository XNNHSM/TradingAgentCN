/**
 * 数据获取智能体
 * 负责统一管理所有 MCP 服务调用，避免重复调用和成本浪费
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAgent } from '../base/base-agent';
import { MCPClientService } from '../services/mcp-client.service';
import { LLMService } from '../services/llm.service';
import { AgentExecutionRecordService } from '../services/agent-execution-record.service';
import { AgentConfig } from '../interfaces/agent.interface';
import { BusinessLogger } from '../../common/utils/business-logger.util';
import { 
  StockBasicInfo, 
  RealTimeStockData as StockRealtimeData, 
  KLineData as StockHistoricalData,
  TechnicalIndicators as StockTechnicalIndicators 
} from '../../common/interfaces/stock-data.interface';

// 财务数据接口（临时定义，后续可能需要单独文件）
export interface StockFinancialData {
  totalRevenue?: number;
  netIncome?: number;
  totalAssets?: number;
  totalDebt?: number;
  pe?: number;
  pb?: number;
  roe?: number;
  debt_to_equity?: number;
  [key: string]: any;
}

/**
 * 综合股票数据接口
 */
export interface ComprehensiveStockData {
  stockCode: string;
  basicInfo: StockBasicInfo;
  realtimeData: StockRealtimeData;
  historicalData: StockHistoricalData[];
  technicalIndicators: StockTechnicalIndicators;
  financialData: StockFinancialData;
  relatedNews: Array<{
    title: string;
    summary: string;
    publishTime: string;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>;
  timestamp: string;
}

@Injectable()
export class DataCollectorAgent extends BaseAgent {
  private readonly businessLogger = new BusinessLogger(DataCollectorAgent.name);

  constructor(
    protected readonly mcpClientService: MCPClientService,
    protected readonly llmService: LLMService,
    protected readonly executionRecordService: AgentExecutionRecordService,
    protected readonly configService: ConfigService,
  ) {
    const config: Partial<AgentConfig> = {
      model: configService.get<string>(
        "DATA_COLLECTOR_MODEL",
        configService.get<string>("LLM_DEFAULT_MODEL", "qwen-turbo"), // 数据收集器使用轻量模型
      ),
      temperature: configService.get<number>(
        "DATA_COLLECTOR_TEMPERATURE",
        configService.get<number>("LLM_DEFAULT_TEMPERATURE", 0.3), // 较低温度，更准确的解析
      ),
      maxTokens: configService.get<number>(
        "DATA_COLLECTOR_MAX_TOKENS",
        configService.get<number>("LLM_DEFAULT_MAX_TOKENS", 2000), // 较少token，主要用于数据解析
      ),
      timeout: configService.get<number>(
        "DATA_COLLECTOR_TIMEOUT",
        configService.get<number>("LLM_DEFAULT_TIMEOUT", 30), // 较短超时
      ),
      retryCount: configService.get<number>(
        "DATA_COLLECTOR_RETRY_COUNT",
        configService.get<number>("LLM_MAX_RETRIES", 2), // 较少重试次数
      ),
      systemPrompt: `您是一位专业的数据解析专家，负责将原始数据转换为结构化信息。

🎯 **核心职责**
1. **数据解析**: 将JSON字符串解析为结构化数据
2. **情感分析**: 对新闻内容进行情感倾向分析
3. **数据验证**: 确保解析后的数据完整性和准确性
4. **格式标准化**: 输出标准格式的分析结果

📊 **分析标准**
- 情感分类: positive(利好)、negative(利空)、neutral(中性)
- 摘要长度: 50字以内，突出关键信息
- 输出格式: 严格按照JSON格式返回
- 数据完整性: 确保所有必要字段都有值`,
    };

    super(
      "数据获取智能体",
      "DATA_COLLECTOR" as any, // AgentType 枚举中可能还没有这个类型
      "统一管理所有MCP服务调用，提供综合股票数据",
      llmService,
      undefined, // dataToolkit
      config,
      executionRecordService,
    );
  }

  /**
   * 获取股票综合数据
   * 这是唯一调用 MCP 服务的入口，避免重复调用
   */
  async collectStockData(stockCode: string): Promise<{
    success: boolean;
    data?: ComprehensiveStockData;
    error?: string;
  }> {
    const startTime = new Date();
    const sessionId = `data-collection-${stockCode}-${Date.now()}`;
    
    try {
      this.businessLogger.serviceInfo(`开始获取股票 ${stockCode} 的综合数据`);

      // 1. 获取股票基本信息
      this.businessLogger.serviceInfo('获取股票基本信息...');
      const basicInfoRaw = await this.mcpClientService.callTool('get_stock_basic_info', { stock_code: stockCode });
      const basicInfo = this.parseBasicInfo(basicInfoRaw, stockCode);

      // 2. 获取实时行情数据
      this.businessLogger.serviceInfo('获取实时行情数据...');
      const realtimeDataRaw = await this.mcpClientService.callTool('get_stock_realtime_data', { stock_code: stockCode });
      const realtimeData = this.parseRealtimeData(realtimeDataRaw, stockCode);

      // 3. 获取历史价格数据 (最近30天)
      this.businessLogger.serviceInfo('获取历史价格数据...');
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const historicalDataRaw = await this.mcpClientService.callTool('get_stock_historical_data', {
        stock_code: stockCode,
        start_date: startDate,
        end_date: endDate
      });
      const historicalData = this.parseHistoricalData(historicalDataRaw);

      // 4. 获取技术指标
      this.businessLogger.serviceInfo('获取技术指标数据...');
      const technicalDataRaw = await this.mcpClientService.callTool('get_stock_technical_indicators', {
        stock_code: stockCode,
        period: 20
      });
      const technicalIndicators = this.parseTechnicalIndicators(technicalDataRaw);

      // 5. 获取财务数据
      this.businessLogger.serviceInfo('获取财务数据...');
      const financialDataRaw = await this.mcpClientService.callTool('get_stock_financial_data', {
        stock_code: stockCode,
        report_type: 'balance',
        period: 'quarterly'
      });
      const financialData = this.parseFinancialData(financialDataRaw);

      // 6. 获取相关新闻并进行情感分析
      this.businessLogger.serviceInfo('获取相关新闻...');
      const newsDataRaw = await this.mcpClientService.callTool('get_stock_news', {
        keyword: stockCode,
        days: 7
      });
      const newsDataParsed = this.parseNewsData(newsDataRaw);
      const relatedNews = await this.analyzeNewsData(newsDataParsed);

      // 7. 整合所有数据
      const comprehensiveData: ComprehensiveStockData = {
        stockCode,
        basicInfo,
        realtimeData,
        historicalData,
        technicalIndicators,
        financialData,
        relatedNews,
        timestamp: new Date().toISOString(),
      };

      // 9. 创建执行记录
      if (this.executionRecordService) {
        try {
          await this.executionRecordService.createExecutionRecord({
            sessionId,
            agentType: "DATA_COLLECTOR" as any,
            agentName: this.name,
            agentRole: this.role,
            stockCode,
            context: { stockCode },
            llmModel: this.config.model,
            inputPrompt: `数据获取请求: ${stockCode}`,
            llmResponse: {
              content: '数据获取成功',
              finishReason: 'stop',
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
            },
            result: {
              agentName: this.name,
              agentType: "DATA_COLLECTOR" as any,
              analysis: '股票数据获取成功',
              timestamp: new Date(),
              processingTime: Date.now() - startTime.getTime(),
              confidence: 100,
              score: 100,
            },
            startTime,
            endTime: new Date(),
            analysisType: 'data_collection',
            environment: process.env.NODE_ENV || 'development',
          });
        } catch (recordError) {
          this.businessLogger.serviceError('保存数据获取执行记录失败', recordError);
        }
      }

      this.businessLogger.serviceInfo(`股票 ${stockCode} 综合数据获取完成`, {
        historicalDataPoints: historicalData?.length || 0,
        newsCount: relatedNews?.length || 0,
      });

      return {
        success: true,
        data: comprehensiveData,
      };

    } catch (error) {
      this.businessLogger.serviceError(`获取股票 ${stockCode} 数据失败`, error, { stockCode });
      
      // 创建失败执行记录
      if (this.executionRecordService) {
        try {
          await this.executionRecordService.createExecutionRecord({
            sessionId,
            agentType: "DATA_COLLECTOR" as any,
            agentName: this.name,
            agentRole: this.role,
            stockCode,
            context: { stockCode },
            llmModel: this.config.model,
            inputPrompt: `数据获取请求: ${stockCode}`,
            llmResponse: {
              content: '数据获取失败',
              finishReason: 'error',
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
            },
            result: {
              agentName: this.name,
              agentType: "DATA_COLLECTOR" as any,
              analysis: `数据获取失败: ${error.message}`,
              timestamp: new Date(),
              processingTime: Date.now() - startTime.getTime(),
              confidence: 0,
              score: 0,
            },
            startTime,
            endTime: new Date(),
            analysisType: 'data_collection',
            environment: process.env.NODE_ENV || 'development',
            errorMessage: error.message,
            errorStack: error.stack,
          });
        } catch (recordError) {
          this.businessLogger.serviceError('保存数据获取失败执行记录失败', recordError);
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 分析新闻数据的情感倾向
   */
  private async analyzeNewsData(newsData: any[]): Promise<Array<{
    title: string;
    summary: string;
    publishTime: string;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>> {
    if (!newsData || newsData.length === 0) {
      return [];
    }

    try {
      const prompt = `
请分析以下股票新闻的情感倾向，为每条新闻提供简洁的摘要和情感分类：

新闻数据：
${JSON.stringify(newsData, null, 2)}

请以JSON格式返回分析结果，格式如下：
[
  {
    "title": "新闻标题",
    "summary": "新闻要点摘要(50字以内)",
    "publishTime": "发布时间",
    "sentiment": "positive/negative/neutral"
  }
]

分析要求：
1. 摘要要简洁明了，突出对股价影响的关键信息
2. 情感分类标准：positive(利好消息)、negative(利空消息)、neutral(中性消息)
3. 只返回JSON格式，不要其他解释文字
`;

      const response = await this.llmService.generate(prompt);

      // 尝试解析LLM返回的JSON
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return analysis.filter(item => item.title && item.sentiment);
      }

      // 如果解析失败，返回基础格式
      return newsData.slice(0, 5).map(news => ({
        title: news.title || '无标题',
        summary: news.content?.substring(0, 50) + '...' || '无内容',
        publishTime: news.publishTime || new Date().toISOString(),
        sentiment: 'neutral' as const,
      }));

    } catch (error) {
      this.businessLogger.serviceError('新闻情感分析失败', error);
      
      // 返回基础格式作为备选
      return newsData.slice(0, 5).map(news => ({
        title: news.title || '无标题',
        summary: news.content?.substring(0, 50) + '...' || '无内容', 
        publishTime: news.publishTime || new Date().toISOString(),
        sentiment: 'neutral' as const,
      }));
    }
  }

  /**
   * 验证数据完整性
   */
  validateDataCompleteness(data: ComprehensiveStockData): {
    isComplete: boolean;
    missingFields: string[];
    completeness: number;
  } {
    const requiredFields = [
      'basicInfo',
      'realtimeData', 
      'historicalData',
      'technicalIndicators',
      'financialData',
    ];

    const missingFields: string[] = [];
    let presentCount = 0;

    requiredFields.forEach(field => {
      if (data[field] && (Array.isArray(data[field]) ? data[field].length > 0 : true)) {
        presentCount++;
      } else {
        missingFields.push(field);
      }
    });

    const completeness = Math.round((presentCount / requiredFields.length) * 100);

    return {
      isComplete: missingFields.length === 0,
      missingFields,
      completeness,
    };
  }

  /**
   * 实现抽象方法 buildPrompt (数据获取智能体通常不需要构建提示词)
   */
  protected async buildPrompt(context: { stockCode: string; stockName?: string }): Promise<string> {
    return `数据获取智能体不需要构建提示词，直接调用MCP服务获取股票 ${context.stockCode} 的数据。`;
  }

  /**
   * 获取代理类型
   */
  getAgentType(): string {
    return 'DataCollectorAgent';
  }

  /**
   * 获取代理描述
   */
  getAgentDescription(): string {
    return '数据获取智能体 - 统一管理所有MCP服务调用，提供综合股票数据';
  }

  /**
   * 解析基本信息数据
   */
  private parseBasicInfo(rawData: string, stockCode: string): StockBasicInfo {
    try {
      const data = JSON.parse(rawData);
      return {
        code: stockCode,
        name: data.name || stockCode,
        exchange: data.exchange === 'SSE' ? 0 : 1, // SSE = 1, SZSE = 0
        exchangeName: data.exchangeName || (data.exchange === 'SSE' ? '上海证券交易所' : '深圳证券交易所'),
        industry: data.industry,
        sector: data.sector,
        listDate: data.listDate ? new Date(data.listDate) : undefined,
        totalShares: data.totalShares,
        floatShares: data.floatShares,
        suspended: data.suspended || false,
        status: data.status || 'normal',
      };
    } catch (error) {
      this.businessLogger.serviceError('解析基本信息数据失败', error);
      return {
        code: stockCode,
        name: stockCode,
        exchange: 0, // 默认深圳
        exchangeName: '未知',
      };
    }
  }

  /**
   * 解析实时行情数据
   */
  private parseRealtimeData(rawData: string, stockCode: string): StockRealtimeData {
    try {
      const data = JSON.parse(rawData);
      return {
        code: stockCode,
        name: data.name || stockCode,
        price: data.price || 0,
        open: data.open || 0,
        high: data.high || 0,
        low: data.low || 0,
        preClose: data.preClose || 0,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        volume: data.volume || 0,
        turnover: data.turnover || 0,
        turnoverRate: data.turnoverRate || 0,
        pe: data.pe || 0,
        pb: data.pb || 0,
        totalValue: data.totalValue || 0,
        circulationValue: data.circulationValue || 0,
        bid1: data.bid1 || 0,
        bidVol1: data.bidVol1 || 0,
        ask1: data.ask1 || 0,
        askVol1: data.askVol1 || 0,
        bidPrices: data.bidPrices || [],
        bidVolumes: data.bidVolumes || [],
        askPrices: data.askPrices || [],
        askVolumes: data.askVolumes || [],
        timestamp: new Date(),
      };
    } catch (error) {
      this.businessLogger.serviceError('解析实时行情数据失败', error);
      return {
        code: stockCode,
        name: stockCode,
        price: 0, open: 0, high: 0, low: 0, preClose: 0,
        change: 0, changePercent: 0, volume: 0, turnover: 0,
        turnoverRate: 0, pe: 0, pb: 0, totalValue: 0,
        circulationValue: 0, bid1: 0, bidVol1: 0, ask1: 0,
        askVol1: 0, bidPrices: [], bidVolumes: [],
        askPrices: [], askVolumes: [], timestamp: new Date(),
      };
    }
  }

  /**
   * 解析历史数据
   */
  private parseHistoricalData(rawData: string): StockHistoricalData[] {
    try {
      const data = JSON.parse(rawData);
      if (Array.isArray(data)) {
        return data.map(item => ({
          date: new Date(item.date),
          open: item.open || 0,
          high: item.high || 0,
          low: item.low || 0,
          close: item.close || 0,
          volume: item.volume || 0,
          turnover: item.turnover,
        }));
      }
      return [];
    } catch (error) {
      this.businessLogger.serviceError('解析历史数据失败', error);
      return [];
    }
  }

  /**
   * 解析技术指标数据
   */
  private parseTechnicalIndicators(rawData: string): StockTechnicalIndicators {
    try {
      const data = JSON.parse(rawData);
      return {
        ma: {
          ma5: data.ma?.ma5 || [],
          ma10: data.ma?.ma10 || [],
          ma20: data.ma?.ma20 || [],
          ma50: data.ma?.ma50,
          ma200: data.ma?.ma200,
        },
        rsi: {
          rsi14: data.rsi?.rsi14 || [],
          rsi6: data.rsi?.rsi6,
          rsi24: data.rsi?.rsi24,
        },
        macd: {
          dif: data.macd?.dif || [],
          dea: data.macd?.dea || [],
          macd: data.macd?.macd || [],
        },
        bollinger: {
          upper: data.bollinger?.upper || [],
          middle: data.bollinger?.middle || [],
          lower: data.bollinger?.lower || [],
        },
        kdj: data.kdj ? {
          k: data.kdj.k || [],
          d: data.kdj.d || [],
          j: data.kdj.j || [],
        } : undefined,
      };
    } catch (error) {
      this.businessLogger.serviceError('解析技术指标数据失败', error);
      return {
        ma: { ma5: [], ma10: [], ma20: [] },
        rsi: { rsi14: [] },
        macd: { dif: [], dea: [], macd: [] },
        bollinger: { upper: [], middle: [], lower: [] },
      };
    }
  }

  /**
   * 解析财务数据
   */
  private parseFinancialData(rawData: string): StockFinancialData {
    try {
      const data = JSON.parse(rawData);
      return {
        totalRevenue: data.totalRevenue,
        netIncome: data.netIncome,
        totalAssets: data.totalAssets,
        totalDebt: data.totalDebt,
        pe: data.pe,
        pb: data.pb,
        roe: data.roe,
        debt_to_equity: data.debt_to_equity,
        ...data, // 保留其他可能的字段
      };
    } catch (error) {
      this.businessLogger.serviceError('解析财务数据失败', error);
      return {};
    }
  }

  /**
   * 解析新闻数据
   */
  private parseNewsData(rawData: string): any[] {
    try {
      const data = JSON.parse(rawData);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      this.businessLogger.serviceError('解析新闻数据失败', error);
      return [];
    }
  }
}