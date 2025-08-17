import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StockDataService } from "../../services/stock-data/stock-data.service";
import { NewsApiService } from "../../services/news/news-api.service";
import { DateTimeUtil } from "../../common/utils/date-time.util";
import { BusinessLogger } from "../../common/utils/business-logger.util";
import {
  RealTimeStockData,
  HistoricalStockData,
  TechnicalIndicators,
  StockBasicInfo,
  MarketOverview,
  StockDataQuery,
  KLineType,
} from "../../common/interfaces/stock-data.interface";

/**
 * 函数调用工具定义
 */
export interface FunctionTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  handler: (...args: any[]) => Promise<any>;
}

/**
 * 数据获取工具包服务
 * 提供各种数据获取功能供智能体使用
 */
@Injectable()
export class DataToolkitService {
  private readonly logger = new BusinessLogger(DataToolkitService.name);
  private tools: Map<string, FunctionTool> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly stockDataService: StockDataService,
    private readonly newsApiService: NewsApiService,
  ) {
    this.initializeTools();
  }

  /**
   * 初始化数据获取工具
   */
  private initializeTools(): void {
    // 注册中国股票数据获取工具
    this.registerTool({
      name: "get_china_stock_data",
      description: "获取中国股票的历史数据、实时数据和技术指标",
      parameters: {
        type: "object",
        properties: {
          stock_code: {
            type: "string",
            description: "股票代码（如 000001, 600519）",
          },
          start_date: {
            type: "string",
            description: "开始日期，严格格式 YYYY-MM-dd (如: 2025-08-16)",
          },
          end_date: {
            type: "string",
            description: "结束日期，严格格式 YYYY-MM-dd (如: 2025-08-16)",
          },
        },
        required: ["stock_code", "start_date", "end_date"],
      },
      handler: this.getChinaStockData.bind(this),
    });

    // 注册财务数据获取工具
    this.registerTool({
      name: "get_financial_data",
      description: "获取公司财务数据，包括财务报表、财务比率等",
      parameters: {
        type: "object",
        properties: {
          stock_code: {
            type: "string",
            description: "股票代码",
          },
          report_type: {
            type: "string",
            enum: ["income_statement", "balance_sheet", "cash_flow"],
            description:
              "报表类型：income_statement(利润表), balance_sheet(资产负债表), cash_flow(现金流量表)",
          },
          period: {
            type: "string",
            enum: ["annual", "quarterly"],
            description: "报告期间：annual(年报), quarterly(季报)",
          },
        },
        required: ["stock_code"],
      },
      handler: this.getFinancialData.bind(this),
    });

    // 注册市场概览工具
    this.registerTool({
      name: "get_china_market_overview",
      description: "获取中国股市整体概览，包括主要指数表现",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      handler: this.getChinaMarketOverview.bind(this),
    });

    // 注册公司基本信息工具
    this.registerTool({
      name: "get_company_info",
      description: "获取公司基本信息，包括公司简介、主营业务、行业分类等",
      parameters: {
        type: "object",
        properties: {
          stock_code: {
            type: "string",
            description: "股票代码",
          },
        },
        required: ["stock_code"],
      },
      handler: this.getCompanyInfo.bind(this),
    });

    // 注册行业数据工具
    this.registerTool({
      name: "get_industry_data",
      description: "获取行业数据和同行业公司对比信息",
      parameters: {
        type: "object",
        properties: {
          industry_code: {
            type: "string",
            description: "行业代码或股票代码",
          },
        },
        required: ["industry_code"],
      },
      handler: this.getIndustryData.bind(this),
    });

    // 注册股票搜索工具
    this.registerTool({
      name: "search_stocks",
      description: "根据关键词搜索股票",
      parameters: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "搜索关键词（可以是股票名称或简称）",
          },
        },
        required: ["keyword"],
      },
      handler: this.searchStocks.bind(this),
    });

    // 注册批量实时数据工具
    this.registerTool({
      name: "get_batch_realtime_data",
      description: "批量获取多只股票的实时数据",
      parameters: {
        type: "object",
        properties: {
          stock_codes: {
            type: "array",
            items: { type: "string" },
            description: "股票代码数组（如 ['000001', '600519']）",
          },
        },
        required: ["stock_codes"],
      },
      handler: this.getBatchRealTimeData.bind(this),
    });

    // 注册技术指标分析工具
    this.registerTool({
      name: "get_technical_indicators",
      description: "获取股票的详细技术指标分析",
      parameters: {
        type: "object",
        properties: {
          stock_code: {
            type: "string",
            description: "股票代码",
          },
          period: {
            type: "number",
            description: "计算周期天数（默认20天）",
            default: 20,
          },
        },
        required: ["stock_code"],
      },
      handler: this.getTechnicalIndicators.bind(this),
    });

    // 注册新闻搜索工具
    this.registerTool({
      name: "get_stock_news",
      description: "获取股票相关新闻信息",
      parameters: {
        type: "object",
        properties: {
          stock_code: {
            type: "string", 
            description: "股票代码（可选，不提供则获取市场新闻）",
          },
          keyword: {
            type: "string",
            description: "新闻关键词",
          },
          days: {
            type: "number",
            description: "查询天数（默认7天）",
            default: 7,
          },
        },
        required: ["keyword"],
      },
      handler: this.getStockNews.bind(this),
    });

    // 注册市场情绪分析工具
    this.registerTool({
      name: "get_market_sentiment",
      description: "获取市场情绪分析，包括涨跌家数、热门板块等",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      handler: this.getMarketSentiment.bind(this),
    });

    // 注册资金流向分析工具
    this.registerTool({
      name: "get_fund_flow_analysis",
      description: "获取资金流向分析，包括北向资金、行业资金流等",
      parameters: {
        type: "object",
        properties: {
          analysis_type: {
            type: "string",
            enum: ["northbound", "industry", "concept"],
            description: "分析类型：northbound(北向资金), industry(行业资金), concept(概念资金)",
            default: "industry",
          },
        },
        required: [],
      },
      handler: this.getFundFlowAnalysis.bind(this),
    });

    this.logger.serviceInfo(`已注册 ${this.tools.size} 个数据获取工具`);
  }

  /**
   * 注册工具
   */
  private registerTool(tool: FunctionTool): void {
    this.tools.set(tool.name, tool);
    this.logger.debug(`注册工具: ${tool.name}`);
  }

  /**
   * 获取所有可用工具
   */
  getAvailableTools(): FunctionTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取工具定义（用于 LLM function calling）
   */
  getToolDefinitions(): any[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * 执行工具调用
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, any>,
  ): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`未找到工具: ${toolName}`);
    }

    try {
      this.logger.debug(
        `执行工具: ${toolName}，参数: ${JSON.stringify(parameters)}`,
      );
      const result = await tool.handler(parameters);
      this.logger.debug(`工具执行完成: ${toolName}`);
      return result;
    } catch (error) {
      this.logger.businessError(`工具执行失败: ${toolName}`, error);
      throw error;
    }
  }

  /**
   * 安全解析日期字符串 - 使用统一的日期工具类
   */
  private parseDate(dateString: string): Date {
    try {
      return DateTimeUtil.parseDate(dateString);
    } catch (error) {
      this.logger.businessError(`日期解析失败: ${dateString}`, error);
      // 返回一个默认日期（今天）
      return new Date();
    }
  }

  /**
   * 获取中国股票数据
   */
  private async getChinaStockData(params: {
    stock_code: string;
    start_date: string;
    end_date: string;
  }): Promise<string> {
    const { stock_code, start_date, end_date } = params;

    try {
      // 获取实时数据
      const realTimeData =
        await this.stockDataService.getRealTimeData(stock_code);

      // 获取历史数据 - 修复日期解析
      const query: StockDataQuery = {
        code: stock_code,
        startDate: this.parseDate(start_date),
        endDate: this.parseDate(end_date),
        klineType: KLineType.DAILY,
      };
      const historicalData =
        await this.stockDataService.getHistoricalData(query);

      // 获取技术指标
      const technicalIndicators =
        await this.stockDataService.getTechnicalIndicators(query);

      // 格式化数据为文本
      const analysisText = `
# ${stock_code} 股票数据分析

## 📊 实时行情
- 股票名称: ${realTimeData.name || "未知"}
- 当前价格: ¥${realTimeData.price?.toFixed(2) || "N/A"}
- 涨跌幅: ${realTimeData.changePercent ? (realTimeData.changePercent > 0 ? "+" : "") + realTimeData.changePercent.toFixed(2) + "%" : "N/A"}
- 成交量: ${realTimeData.volume?.toLocaleString() || "N/A"}手
- 成交额: ¥${realTimeData.turnover ? (realTimeData.turnover / 10000).toFixed(2) + "万" : "N/A"}
- 换手率: ${realTimeData.turnoverRate?.toFixed(2) || "N/A"}%
- 市盈率: ${realTimeData.pe?.toFixed(2) || "N/A"}
- 市净率: ${realTimeData.pb?.toFixed(2) || "N/A"}
- 更新时间: ${realTimeData.timestamp ? DateTimeUtil.formatDateTime(realTimeData.timestamp) : DateTimeUtil.getCurrentDateTime()}

## 📈 历史数据概览
- 数据期间: ${start_date} 至 ${end_date}
- 数据条数: ${historicalData.data?.length || 0}条
- 期间最高: ¥${historicalData.data?.length ? Math.max(...historicalData.data.map((d) => d.high)).toFixed(2) : "N/A"}
- 期间最低: ¥${historicalData.data?.length ? Math.min(...historicalData.data.map((d) => d.low)).toFixed(2) : "N/A"}
- 期间涨幅: ${this.calculatePeriodReturn(historicalData.data)}
- 平均成交量: ${historicalData.data?.length ? Math.round(historicalData.data.reduce((sum, d) => sum + d.volume, 0) / historicalData.data.length).toLocaleString() : "N/A"}手

## 🔍 技术指标
- MA5: ¥${this.getLastValue(technicalIndicators.ma?.ma5)}
- MA10: ¥${this.getLastValue(technicalIndicators.ma?.ma10)}
- MA20: ¥${this.getLastValue(technicalIndicators.ma?.ma20)}
- MA60: ¥${this.getLastValue(technicalIndicators.ma?.ma50)}
- RSI: ${this.getLastValue(technicalIndicators.rsi?.rsi14)}
- MACD: ${this.getLastValue(technicalIndicators.macd?.dif)}
- KDJ-K: ${this.getLastValue(technicalIndicators.kdj?.k)}
- KDJ-D: ${this.getLastValue(technicalIndicators.kdj?.d)}
- BOLL上轨: ¥${this.getLastValue(technicalIndicators.bollinger?.upper)}
- BOLL中轨: ¥${this.getLastValue(technicalIndicators.bollinger?.middle)}
- BOLL下轨: ¥${this.getLastValue(technicalIndicators.bollinger?.lower)}
`;

      return analysisText;
    } catch (error) {
      this.logger.businessError(`获取股票数据`, error);
      return `获取股票 ${stock_code} 数据失败: ${error.message}`;
    }
  }

  /**
   * 获取财务数据
   */
  private async getFinancialData(params: {
    stock_code: string;
    report_type?: string;
    period?: string;
  }): Promise<string> {
    const {
      stock_code,
      report_type = "income_statement",
      period = "annual",
    } = params;

    try {
      // 获取公司基本信息（包含财务指标）
      const basicInfo =
        await this.stockDataService.getStockBasicInfo(stock_code);

      const financialText = `
# ${stock_code} 财务数据分析

## 财务报表类型: ${report_type}
## 报告期间: ${period}

### 基本财务信息
- 公司名称: ${basicInfo.name || "未知"}
- 股票代码: ${basicInfo.code}
- 总股本: ${basicInfo.totalShares ? (basicInfo.totalShares / 10000).toFixed(0) + "万股" : "未知"}
- 流通股本: ${basicInfo.floatShares ? (basicInfo.floatShares / 10000).toFixed(0) + "万股" : "未知"}
- 上市日期: ${basicInfo.listDate ? basicInfo.listDate.toLocaleDateString() : "未知"}
- 交易所: ${basicInfo.exchangeName || "未知"}

### 业务信息
- 所属行业: ${basicInfo.industry || "未知"}
- 所属板块: ${basicInfo.sector || "未知"}
- 股票状态: ${basicInfo.status || "未知"}
- 是否停牌: ${basicInfo.suspended ? "是" : "否"}

### 基本估值指标
基于实时行情数据获取的估值信息，详细财务数据需要额外获取。

注意：当前系统基于通达信数据接口，主要提供实时行情和基本信息。
详细的财务报表数据（利润表、资产负债表、现金流量表等）需要
集成专业的财务数据源才能提供。

`;

      return financialText;
    } catch (error) {
      this.logger.businessError(`获取财务数据`, error);
      return `获取股票 ${stock_code} 财务数据失败: ${error.message}`;
    }
  }

  /**
   * 计算期间收益率
   */
  private calculatePeriodReturn(data?: { close: number }[]): string {
    if (!data || data.length === 0) return "N/A";

    const firstPrice = data[0].close;
    const lastPrice = data[data.length - 1].close;
    const returnPercent = ((lastPrice - firstPrice) / firstPrice) * 100;

    return (returnPercent > 0 ? "+" : "") + returnPercent.toFixed(2) + "%";
  }

  /**
   * 获取数组最后一个有效值
   */
  private getLastValue(arr?: number[]): string {
    if (!arr || arr.length === 0) return "N/A";

    // 从后往前找第一个非NaN值
    for (let i = arr.length - 1; i >= 0; i--) {
      if (!isNaN(arr[i])) {
        return arr[i].toFixed(2);
      }
    }

    return "N/A";
  }

  /**
   * 获取中国市场概览
   */
  private async getChinaMarketOverview(): Promise<string> {
    try {
      const marketOverview = await this.stockDataService.getMarketOverview();

      const overviewText = `
# 中国股市概览

## 📈 上证指数
- 当前点位: ${marketOverview.shanghaiIndex.value.toFixed(2)}
- 涨跌点数: ${marketOverview.shanghaiIndex.change > 0 ? "+" : ""}${marketOverview.shanghaiIndex.change.toFixed(2)}
- 涨跌幅: ${marketOverview.shanghaiIndex.changePercent > 0 ? "+" : ""}${marketOverview.shanghaiIndex.changePercent.toFixed(2)}%

## 📈 深证成指
- 当前点位: ${marketOverview.shenzhenIndex.value.toFixed(2)}
- 涨跌点数: ${marketOverview.shenzhenIndex.change > 0 ? "+" : ""}${marketOverview.shenzhenIndex.change.toFixed(2)}
- 涨跌幅: ${marketOverview.shenzhenIndex.changePercent > 0 ? "+" : ""}${marketOverview.shenzhenIndex.changePercent.toFixed(2)}%

## 📈 创业板指
- 当前点位: ${marketOverview.chinextIndex.value.toFixed(2)}
- 涨跌点数: ${marketOverview.chinextIndex.change > 0 ? "+" : ""}${marketOverview.chinextIndex.change.toFixed(2)}
- 涨跌幅: ${marketOverview.chinextIndex.changePercent > 0 ? "+" : ""}${marketOverview.chinextIndex.changePercent.toFixed(2)}%

## 📈 科创50
- 当前点位: ${marketOverview.star50Index.value.toFixed(2)}
- 涨跌点数: ${marketOverview.star50Index.change > 0 ? "+" : ""}${marketOverview.star50Index.change.toFixed(2)}
- 涨跌幅: ${marketOverview.star50Index.changePercent > 0 ? "+" : ""}${marketOverview.star50Index.changePercent.toFixed(2)}%

## 📊 市场统计
- 上涨股票: ${marketOverview.riseCount}只
- 下跌股票: ${marketOverview.fallCount}只
- 总成交量: ${(marketOverview.totalVolume / 100000000).toFixed(2)}亿手
- 总成交额: ¥${(marketOverview.totalTurnover / 100000000).toFixed(2)}亿

更新时间: ${marketOverview.timestamp.toLocaleString()}
数据来源: 通达信API
`;

      return overviewText;
    } catch (error) {
      this.logger.businessError(`获取市场概览`, error);
      return `获取市场概览失败: ${error.message}`;
    }
  }

  /**
   * 获取公司基本信息
   */
  private async getCompanyInfo(params: {
    stock_code: string;
  }): Promise<string> {
    const { stock_code } = params;

    try {
      const basicInfo =
        await this.stockDataService.getStockBasicInfo(stock_code);

      const companyInfoText = `
# ${stock_code} 公司基本信息

## 公司概况
- 股票名称: ${basicInfo.name || "未知"}
- 股票代码: ${basicInfo.code}
- 交易所: ${basicInfo.exchangeName || "未知"}
- 上市日期: ${basicInfo.listDate ? basicInfo.listDate.toLocaleDateString() : "未知"}
- 总股本: ${basicInfo.totalShares ? (basicInfo.totalShares / 10000).toFixed(0) + "万股" : "未知"}
- 流通股本: ${basicInfo.floatShares ? (basicInfo.floatShares / 10000).toFixed(0) + "万股" : "未知"}

## 行业信息
- 所属行业: ${basicInfo.industry || "未知"}
- 所属板块: ${basicInfo.sector || "未知"}
- 股票状态: ${basicInfo.status || "未知"}
- 是否停牌: ${basicInfo.suspended ? "是" : "否"}

## 数据说明
当前数据服务主要提供股票基本信息和实时行情数据。
详细的财务指标（如ROE、毛利率、净利率等）需要集成专门的
财务数据接口才能提供更全面的分析。

数据来源: 通达信API

### 建议后续完善内容
1. 集成专业财务数据接口（如Wind、同花顺等）
2. 完善盈利能力、财务健康度分析
3. 增加行业对比和历史财务指标走势分析
`;

      return companyInfoText;
    } catch (error) {
      this.logger.businessError(`获取公司信息`, error);
      return `获取股票 ${stock_code} 公司信息失败: ${error.message}`;
    }
  }

  /**
   * 获取行业数据
   */
  private async getIndustryData(params: {
    industry_code: string;
  }): Promise<string> {
    const { industry_code } = params;

    try {
      const mockIndustryData = `
# 行业数据分析 - ${industry_code}

## 行业概况
- 行业名称: 信息技术行业
- 行业规模: ¥50,000亿元
- 年增长率: +12%
- 上市公司数量: 500家
- 龙头企业: 10家

## 行业估值水平
- 平均PE: 25倍
- 平均PB: 3.5倍
- 平均ROE: 12%
- 平均毛利率: 35%
- 平均净利率: 18%

## 同行业对比企业（前5名）
1. 领先科技(000001): PE 22倍, ROE 15%
2. 创新软件(000002): PE 28倍, ROE 18%  
3. 智能制造(000003): PE 24倍, ROE 14%
4. 数字服务(000004): PE 30倍, ROE 20%
5. 科技先锋(000005): PE 26倍, ROE 16%

## 行业发展趋势
- 政策支持: 国家大力支持科技创新
- 市场需求: 数字化转型需求增长
- 技术发展: AI、云计算等新技术快速发展
- 投资机会: 细分领域存在投资机会

数据来源: 行业研究报告 (模拟数据)
`;

      return mockIndustryData;
    } catch (error) {
      this.logger.businessError(`获取行业数据`, error);
      return `获取行业 ${industry_code} 数据失败: ${error.message}`;
    }
  }

  /**
   * 搜索股票
   */
  private async searchStocks(params: {
    keyword: string;
  }): Promise<string> {
    const { keyword } = params;

    try {
      this.logger.debug(`搜索股票: ${keyword}`);
      const searchResults = await this.stockDataService.searchStocks(keyword);

      if (searchResults.length === 0) {
        return `未找到与"${keyword}"相关的股票`;
      }

      const searchText = `
# 股票搜索结果 - "${keyword}"

## 📊 搜索到 ${searchResults.length} 只股票

${searchResults.map((stock, index) => `
### ${index + 1}. ${stock.name} (${stock.code})
- 股票代码: ${stock.code}
- 股票名称: ${stock.name}
- 交易所: ${stock.exchangeName}
- 所属行业: ${stock.industry}
- 所属板块: ${stock.sector}
`).join('\n')}

## 使用建议
选择感兴趣的股票代码，可以进一步使用以下工具获取详细信息：
- \`get_china_stock_data\` - 获取股票详细数据
- \`get_company_info\` - 获取公司基本信息
- \`get_technical_indicators\` - 获取技术指标分析

搜索时间: ${DateTimeUtil.getCurrentDateTime()}
`;

      return searchText;
    } catch (error) {
      this.logger.businessError(`搜索股票`, error);
      return `搜索股票"${keyword}"失败: ${error.message}`;
    }
  }

  /**
   * 批量获取实时数据
   */
  private async getBatchRealTimeData(params: {
    stock_codes: string[];
  }): Promise<string> {
    const { stock_codes } = params;

    try {
      this.logger.debug(`批量获取实时数据: ${stock_codes.join(', ')}`);
      
      if (stock_codes.length === 0) {
        return "请提供至少一个股票代码";
      }

      if (stock_codes.length > 10) {
        return "批量查询最多支持10只股票，请减少查询数量";
      }

      const batchData = await this.stockDataService.getBatchRealTimeData(stock_codes);

      const batchText = `
# 批量实时数据 - ${stock_codes.length}只股票

## 📊 实时行情对比

${batchData.map((stock, index) => `
### ${index + 1}. ${stock.name} (${stock.code})
- 当前价格: ¥${stock.price?.toFixed(2) || "N/A"}
- 涨跌幅: ${stock.changePercent ? (stock.changePercent > 0 ? "+" : "") + stock.changePercent.toFixed(2) + "%" : "N/A"}
- 涨跌额: ¥${stock.change ? (stock.change > 0 ? "+" : "") + stock.change.toFixed(2) : "N/A"}
- 成交量: ${stock.volume ? (stock.volume / 10000).toFixed(2) + "万手" : "N/A"}
- 换手率: ${stock.turnoverRate?.toFixed(2) || "N/A"}%
- 市盈率: ${stock.pe?.toFixed(2) || "N/A"}
`).join('\n')}

## 📈 表现排序

### 涨幅榜
${batchData
  .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
  .slice(0, 5)
  .map((stock, index) => `${index + 1}. ${stock.name}(${stock.code}): ${stock.changePercent ? (stock.changePercent > 0 ? "+" : "") + stock.changePercent.toFixed(2) + "%" : "N/A"}`)
  .join('\n')}

### 成交活跃榜  
${batchData
  .sort((a, b) => (b.turnoverRate || 0) - (a.turnoverRate || 0))
  .slice(0, 5)
  .map((stock, index) => `${index + 1}. ${stock.name}(${stock.code}): ${stock.turnoverRate?.toFixed(2) || "N/A"}%`)
  .join('\n')}

数据更新时间: ${DateTimeUtil.getCurrentDateTime()}
数据来源: 腾讯股票API
`;

      return batchText;
    } catch (error) {
      this.logger.businessError(`批量获取实时数据`, error);
      return `批量获取实时数据失败: ${error.message}`;
    }
  }

  /**
   * 获取技术指标
   */
  private async getTechnicalIndicators(params: {
    stock_code: string;
    period?: number;
  }): Promise<string> {
    const { stock_code, period = 20 } = params;

    try {
      this.logger.debug(`获取技术指标: ${stock_code}, period: ${period}`);

      const query: StockDataQuery = {
        code: stock_code,
        startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 180天前
        endDate: new Date(),
        klineType: KLineType.DAILY,
      };

      const indicators = await this.stockDataService.getTechnicalIndicators(query);
      const realTimeData = await this.stockDataService.getRealTimeData(stock_code);

      const indicatorsText = `
# ${stock_code} 技术指标分析

## 📊 当前价格信息
- 股票名称: ${realTimeData.name}
- 当前价格: ¥${realTimeData.price?.toFixed(2)}
- 涨跌幅: ${realTimeData.changePercent ? (realTimeData.changePercent > 0 ? "+" : "") + realTimeData.changePercent.toFixed(2) + "%" : "N/A"}

## 📈 移动平均线分析
- MA5: ¥${this.getLastValue(indicators.ma?.ma5)}
- MA10: ¥${this.getLastValue(indicators.ma?.ma10)}
- MA20: ¥${this.getLastValue(indicators.ma?.ma20)}

### 均线形态分析
${this.analyzeMATrend(indicators.ma, realTimeData.price)}

## 📊 技术指标
### RSI 相对强弱指标
- RSI(14): ${this.getLastValue(indicators.rsi?.rsi14)}
- 强弱判断: ${this.analyzeRSI(this.getLastValueNumber(indicators.rsi?.rsi14))}

### MACD 指标
- MACD: ${this.getLastValue(indicators.macd?.macd)}
- 信号线: ${this.getLastValue(indicators.macd?.dea)}
- 柱状图: ${this.getLastValue(indicators.macd?.dif)}

### 布林带
- 上轨: ¥${this.getLastValue(indicators.bollinger?.upper)}
- 中轨: ¥${this.getLastValue(indicators.bollinger?.middle)}
- 下轨: ¥${this.getLastValue(indicators.bollinger?.lower)}
- 位置分析: ${this.analyzeBollingerPosition(realTimeData.price, indicators.bollinger)}

## 🎯 技术面总结
${this.generateTechnicalSummary(indicators, realTimeData)}

计算周期: ${period}天
分析时间: ${DateTimeUtil.getCurrentDateTime()}
`;

      return indicatorsText;
    } catch (error) {
      this.logger.businessError(`获取技术指标`, error);
      return `获取股票 ${stock_code} 技术指标失败: ${error.message}`;
    }
  }

  /**
   * 获取股票新闻
   */
  private async getStockNews(params: {
    stock_code?: string;
    keyword: string;
    days?: number;
  }): Promise<string> {
    const { stock_code, keyword, days = 7 } = params;

    try {
      this.logger.debug(`获取股票新闻: ${keyword}, 股票: ${stock_code}, 天数: ${days}`);

      // 使用真实新闻API获取数据
      const newsResult = await this.newsApiService.searchComprehensiveNews(keyword, {
        includeStock: !!stock_code,
        stockSymbol: stock_code,
        includeMarket: true,
        daysBack: days,
      });

      // 格式化新闻数据为Markdown
      const newsText = `
# 📰 股票新闻分析 - "${keyword}"

## 搜索参数
- 关键词: ${keyword}
- 股票代码: ${stock_code || "全市场"}
- 查询时间范围: 最近${days}天
- 数据来源: NewsAPI + FinnHub + Alpha Vantage

## 📈 通用新闻 (${newsResult.generalNews.length}条)

${newsResult.generalNews.slice(0, 5).map((article, index) => `
### ${index + 1}. ${article.title}
- 来源: ${article.source}
- 发布时间: ${DateTimeUtil.formatDateTime(article.publishedAt)}
- 情绪倾向: ${this.getSentimentEmoji(article.sentiment)} ${this.getSentimentText(article.sentiment)}
- 相关度: ${this.getRelevanceStars(article.relevanceScore)}
- 摘要: ${article.content.substring(0, 200)}${article.content.length > 200 ? '...' : ''}
- 链接: ${article.url}
`).join('\n')}

${stock_code && newsResult.stockNews ? `
## 🏢 个股专业新闻 (${newsResult.stockNews.length}条)

${newsResult.stockNews.slice(0, 3).map((article, index) => `
### ${index + 1}. ${article.title}
- 来源: ${article.source}
- 发布时间: ${DateTimeUtil.formatDateTime(article.publishedAt)}
- 情绪倾向: ${this.getSentimentEmoji(article.sentiment)} ${this.getSentimentText(article.sentiment)}
- 相关度: ${this.getRelevanceStars(article.relevanceScore)}
- 摘要: ${article.content.substring(0, 200)}${article.content.length > 200 ? '...' : ''}
`).join('\n')}
` : ''}

${newsResult.marketNews ? `
## 🌍 市场宏观新闻 (${newsResult.marketNews.length}条)

${newsResult.marketNews.slice(0, 3).map((article, index) => `
### ${index + 1}. ${article.title}
- 来源: ${article.source}
- 发布时间: ${DateTimeUtil.formatDateTime(article.publishedAt)}
- 情绪倾向: ${this.getSentimentEmoji(article.sentiment)} ${this.getSentimentText(article.sentiment)}
- 摘要: ${article.content.substring(0, 200)}${article.content.length > 200 ? '...' : ''}
`).join('\n')}
` : ''}

## 🎯 新闻情绪分析汇总
- 总新闻数: ${newsResult.summary.totalArticles}条
- 情绪分布:
${Object.entries(newsResult.summary.sentimentDistribution).map(([sentiment, count]) => 
  `  - ${this.getSentimentText(sentiment)}: ${count}条`
).join('\n')}
- 主要来源: ${newsResult.summary.topSources.join(', ')}

## 💡 投资建议
${this.generateNewsInvestmentAdvice(newsResult.summary.sentimentDistribution, keyword)}

分析时间: ${DateTimeUtil.getCurrentDateTime()}
数据来源: 实时新闻API聚合
`;

      return newsText;
    } catch (error) {
      this.logger.businessError(`获取股票新闻`, error);
      return `获取股票新闻失败: ${error.message}`;
    }
  }

  /**
   * 获取市场情绪分析
   */
  private async getMarketSentiment(): Promise<string> {
    try {
      this.logger.debug("获取市场情绪分析");
      
      const marketOverview = await this.stockDataService.getMarketOverview();

      const sentimentText = `
# 📊 市场情绪分析

## 🎯 指数表现
- 上证指数: ${marketOverview.shanghaiIndex.value.toFixed(2)} (${marketOverview.shanghaiIndex.changePercent > 0 ? "+" : ""}${marketOverview.shanghaiIndex.changePercent.toFixed(2)}%)
- 深证成指: ${marketOverview.shenzhenIndex.value.toFixed(2)} (${marketOverview.shenzhenIndex.changePercent > 0 ? "+" : ""}${marketOverview.shenzhenIndex.changePercent.toFixed(2)}%)
- 创业板指: ${marketOverview.chinextIndex.value.toFixed(2)} (${marketOverview.chinextIndex.changePercent > 0 ? "+" : ""}${marketOverview.chinextIndex.changePercent.toFixed(2)}%)

## 📈 市场广度
- 上涨股票: ${marketOverview.riseCount}只
- 下跌股票: ${marketOverview.fallCount}只
- 涨跌比: ${marketOverview.fallCount > 0 ? (marketOverview.riseCount / marketOverview.fallCount).toFixed(2) : "N/A"}

## 💰 资金情况
- 总成交额: ¥${(marketOverview.totalTurnover / 100000000).toFixed(0)}亿
- 成交活跃度: ${this.analyzeVolumeActivity(marketOverview.totalTurnover)}

## 🌡️ 情绪指标
${this.generateSentimentAnalysis(marketOverview)}

## 🔥 热门板块 (模拟数据)
1. 人工智能: +3.5%
2. 新能源汽车: +2.8%
3. 医药生物: +1.9%
4. 半导体: +1.5%
5. 消费电子: +0.8%

## 📉 调整板块
1. 房地产: -2.1%
2. 钢铁: -1.8%
3. 煤炭: -1.2%

## 🎯 市场情绪总结
${this.generateMarketSentimentSummary(marketOverview)}

分析时间: ${DateTimeUtil.getCurrentDateTime()}
数据来源: 腾讯股票API + 东方财富API
`;

      return sentimentText;
    } catch (error) {
      this.logger.businessError(`获取市场情绪分析`, error);
      return `获取市场情绪分析失败: ${error.message}`;
    }
  }

  /**
   * 获取资金流向分析
   */
  private async getFundFlowAnalysis(params: {
    analysis_type?: string;
  }): Promise<string> {
    const { analysis_type = "industry" } = params;

    try {
      this.logger.debug(`获取资金流向分析: ${analysis_type}`);

      // 模拟资金流向数据 - 实际应集成东方财富资金流向API
      const fundFlowText = `
# 💰 资金流向分析 - ${analysis_type}

## 📊 分析类型: ${this.getAnalysisTypeName(analysis_type)}

${this.generateFundFlowContent(analysis_type)}

## 🎯 投资策略建议
${this.generateFundFlowStrategy(analysis_type)}

分析时间: ${DateTimeUtil.getCurrentDateTime()}
数据来源: 东方财富资金流向API (模拟数据)

注意: 当前为模拟数据，实际部署需要集成真实的资金流向数据源。
`;

      return fundFlowText;
    } catch (error) {
      this.logger.businessError(`获取资金流向分析`, error);
      return `获取资金流向分析失败: ${error.message}`;
    }
  }

  // ==================== 辅助分析方法 ====================

  /**
   * 分析均线趋势
   */
  private analyzeMATrend(ma: any, currentPrice: number): string {
    const ma5 = this.getLastValueNumber(ma?.ma5);
    const ma10 = this.getLastValueNumber(ma?.ma10);
    const ma20 = this.getLastValueNumber(ma?.ma20);

    if (!ma5 || !ma10 || !ma20) return "均线数据不足";

    let analysis = "";
    
    if (currentPrice > ma5 && ma5 > ma10 && ma10 > ma20) {
      analysis = "多头排列，趋势向上，建议持有或加仓";
    } else if (currentPrice < ma5 && ma5 < ma10 && ma10 < ma20) {
      analysis = "空头排列，趋势向下，建议谨慎或减仓";
    } else if (currentPrice > ma20) {
      analysis = "价格在中长期均线之上，整体趋势偏强";
    } else {
      analysis = "价格在中长期均线之下，整体趋势偏弱";
    }

    return analysis;
  }

  /**
   * 分析RSI指标
   */
  private analyzeRSI(rsi: number): string {
    if (!rsi) return "数据不足";
    
    if (rsi >= 80) return "超买区域，警惕回调";
    if (rsi >= 70) return "偏强区域，注意风险";
    if (rsi <= 20) return "超卖区域，可能反弹";
    if (rsi <= 30) return "偏弱区域，观察企稳";
    return "正常区域，继续观察";
  }

  /**
   * 分析布林带位置
   */
  private analyzeBollingerPosition(price: number, bollinger: any): string {
    const upper = this.getLastValueNumber(bollinger?.upper);
    const middle = this.getLastValueNumber(bollinger?.middle);
    const lower = this.getLastValueNumber(bollinger?.lower);

    if (!upper || !middle || !lower) return "数据不足";

    if (price >= upper) return "突破上轨，强势，但警惕回调";
    if (price <= lower) return "跌破下轨，弱势，但可能超跌";
    if (price > middle) return "位于中轨上方，偏强";
    return "位于中轨下方，偏弱";
  }

  /**
   * 生成技术面总结
   */
  private generateTechnicalSummary(indicators: any, realTimeData: any): string {
    const rsi = this.getLastValueNumber(indicators.rsi?.rsi14);
    const price = realTimeData.price;
    const ma20 = this.getLastValueNumber(indicators.ma?.ma20);

    let score = 0;
    let factors = [];

    // RSI评分
    if (rsi && rsi > 30 && rsi < 70) {
      score += 1;
      factors.push("RSI处于正常区间");
    }

    // 价格与均线关系
    if (price && ma20 && price > ma20) {
      score += 1;
      factors.push("价格高于20日均线");
    }

    // 涨跌幅评分
    if (realTimeData.changePercent && realTimeData.changePercent > 0) {
      score += 1;
      factors.push("当日表现为正");
    }

    let sentiment = "";
    if (score >= 2) sentiment = "偏乐观";
    else if (score >= 1) sentiment = "中性";
    else sentiment = "偏谨慎";

    return `技术面评分: ${score}/3 (${sentiment})\n积极因素: ${factors.join(", ") || "暂无"}`;
  }

  /**
   * 分析成交量活跃度
   */
  private analyzeVolumeActivity(volume: number): string {
    if (volume > 1000000000000) return "极度活跃";
    if (volume > 800000000000) return "活跃";
    if (volume > 500000000000) return "一般";
    return "清淡";
  }

  /**
   * 生成情绪分析
   */
  private generateSentimentAnalysis(marketOverview: any): string {
    const upRatio = marketOverview.fallCount > 0 ? 
      marketOverview.riseCount / (marketOverview.riseCount + marketOverview.fallCount) : 0.5;
    
    let sentiment = "";
    if (upRatio >= 0.7) sentiment = "极度乐观 🚀";
    else if (upRatio >= 0.6) sentiment = "乐观 📈";
    else if (upRatio >= 0.4) sentiment = "中性 ➡️";
    else if (upRatio >= 0.3) sentiment = "悲观 📉";
    else sentiment = "极度悲观 💔";

    return `整体情绪: ${sentiment}\n多空比例: ${(upRatio * 100).toFixed(1)}% vs ${((1-upRatio) * 100).toFixed(1)}%`;
  }

  /**
   * 生成市场情绪总结
   */
  private generateMarketSentimentSummary(marketOverview: any): string {
    const upRatio = marketOverview.fallCount > 0 ? 
      marketOverview.riseCount / (marketOverview.riseCount + marketOverview.fallCount) : 0.5;
    
    if (upRatio >= 0.7) {
      return "市场情绪高涨，多数个股上涨，建议把握机会但注意风险控制";
    } else if (upRatio >= 0.6) {
      return "市场情绪偏乐观，结构性机会明显，可适度参与";
    } else if (upRatio >= 0.4) {
      return "市场情绪中性，个股分化明显，需要精选个股";
    } else {
      return "市场情绪偏悲观，建议谨慎操作，等待企稳信号";
    }
  }

  /**
   * 获取分析类型名称
   */
  private getAnalysisTypeName(type: string): string {
    switch (type) {
      case "northbound": return "北向资金";
      case "industry": return "行业资金";
      case "concept": return "概念资金";
      default: return "综合资金";
    }
  }

  /**
   * 生成资金流向内容
   */
  private generateFundFlowContent(type: string): string {
    switch (type) {
      case "northbound":
        return `
## 🌏 北向资金流向
- 今日净流入: +85.6亿元
- 沪股通: +52.3亿元
- 深股通: +33.3亿元
- 本周累计: +420.8亿元
- 本月累计: +1,235.6亿元

### 重点流入个股
1. 贵州茅台: +12.8亿元
2. 宁德时代: +8.5亿元  
3. 比亚迪: +6.7亿元
4. 平安银行: +5.2亿元
5. 美的集团: +4.9亿元`;

      case "industry":
        return `
## 🏭 行业资金流向 (今日)
### 资金净流入前5
1. 人工智能: +126.8亿元
2. 新能源汽车: +89.5亿元
3. 医药生物: +56.7亿元
4. 电子信息: +42.3亿元
5. 食品饮料: +38.9亿元

### 资金净流出前5
1. 房地产: -78.5亿元
2. 钢铁行业: -45.2亿元
3. 煤炭行业: -32.8亿元
4. 银行: -28.6亿元
5. 石油化工: -25.4亿元`;

      case "concept":
        return `
## 💡 概念资金流向 (今日)
### 热门概念净流入
1. ChatGPT概念: +95.6亿元
2. 新能源概念: +78.9亿元
3. 芯片概念: +67.2亿元
4. 生物医药: +45.8亿元
5. 5G概念: +38.4亿元

### 概念净流出
1. 元宇宙: -42.5亿元
2. 数字货币: -38.7亿元
3. 区块链: -25.9亿元`;

      default:
        return "## 综合资金流向分析\n暂无数据";
    }
  }

  /**
   * 生成资金流向策略
   */
  private generateFundFlowStrategy(type: string): string {
    switch (type) {
      case "northbound":
        return "北向资金持续净流入，显示外资对A股信心增强，建议关注北向资金重点买入的白马蓝筹股";
      case "industry":
        return "人工智能、新能源等科技成长板块资金流入明显，建议关注相关龙头股投资机会";
      case "concept":
        return "AI概念热度不减，新能源持续受到资金青睐，可适度配置相关主题基金或个股";
      default:
        return "建议根据资金流向趋势调整投资策略";
    }
  }

  /**
   * 获取数组最后一个有效值（数字）
   */
  private getLastValueNumber(arr?: number[]): number {
    if (!arr || arr.length === 0) return 0;

    for (let i = arr.length - 1; i >= 0; i--) {
      if (!isNaN(arr[i])) {
        return arr[i];
      }
    }

    return 0;
  }

  /**
   * 获取情绪表情符号
   */
  private getSentimentEmoji(sentiment?: string): string {
    switch (sentiment) {
      case 'positive': return '📈';
      case 'negative': return '📉';
      case 'neutral': 
      default: return '➡️';
    }
  }

  /**
   * 获取情绪文本描述
   */
  private getSentimentText(sentiment?: string): string {
    switch (sentiment) {
      case 'positive': return '积极';
      case 'negative': return '消极';
      case 'neutral':
      default: return '中性';
    }
  }

  /**
   * 获取相关度星级
   */
  private getRelevanceStars(score?: number): string {
    if (!score) return '⭐';
    
    const starCount = Math.max(1, Math.min(5, Math.round(score * 5)));
    return '⭐'.repeat(starCount);
  }

  /**
   * 生成新闻投资建议
   */
  private generateNewsInvestmentAdvice(
    sentimentDistribution: Record<string, number>,
    keyword: string
  ): string {
    const total = Object.values(sentimentDistribution).reduce((sum, count) => sum + count, 0);
    const positiveRatio = (sentimentDistribution.positive || 0) / total;
    const negativeRatio = (sentimentDistribution.negative || 0) / total;

    if (positiveRatio > 0.6) {
      return `新闻面偏向积极乐观，${keyword}相关板块获得较多正面报道，建议关注投资机会，但仍需注意风险控制。`;
    } else if (negativeRatio > 0.6) {
      return `新闻面偏向消极悲观，${keyword}相关板块面临较多负面消息，建议谨慎投资，密切关注风险信号。`;
    } else if (positiveRatio > negativeRatio) {
      return `新闻面整体偏向积极，${keyword}相关板块正面消息略多，可适度关注，建议等待更明确信号。`;
    } else {
      return `新闻面情绪中性，${keyword}相关板块消息分化，建议基于基本面和技术面进行综合判断。`;
    }
  }
}
