import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StockDataService } from '../../services/stock-data/stock-data.service';
import {
  RealTimeStockData,
  HistoricalStockData,
  TechnicalIndicators,
  StockBasicInfo,
  MarketOverview,
  StockDataQuery,
  KLineType
} from '../../common/interfaces/stock-data.interface';

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
  private readonly logger = new Logger(DataToolkitService.name);
  private tools: Map<string, FunctionTool> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly stockDataService: StockDataService,
  ) {
    this.initializeTools();
  }

  /**
   * 初始化数据获取工具
   */
  private initializeTools(): void {
    // 注册中国股票数据获取工具
    this.registerTool({
      name: 'get_china_stock_data',
      description: '获取中国股票的历史数据、实时数据和技术指标',
      parameters: {
        type: 'object',
        properties: {
          stock_code: {
            type: 'string',
            description: '股票代码（如 000001, 600519）'
          },
          start_date: {
            type: 'string',
            description: '开始日期，格式 YYYY-MM-DD'
          },
          end_date: {
            type: 'string',
            description: '结束日期，格式 YYYY-MM-DD'
          }
        },
        required: ['stock_code', 'start_date', 'end_date']
      },
      handler: this.getChinaStockData.bind(this)
    });

    // 注册财务数据获取工具
    this.registerTool({
      name: 'get_financial_data',
      description: '获取公司财务数据，包括财务报表、财务比率等',
      parameters: {
        type: 'object',
        properties: {
          stock_code: {
            type: 'string',
            description: '股票代码'
          },
          report_type: {
            type: 'string',
            enum: ['income_statement', 'balance_sheet', 'cash_flow'],
            description: '报表类型：income_statement(利润表), balance_sheet(资产负债表), cash_flow(现金流量表)'
          },
          period: {
            type: 'string',
            enum: ['annual', 'quarterly'],
            description: '报告期间：annual(年报), quarterly(季报)'
          }
        },
        required: ['stock_code']
      },
      handler: this.getFinancialData.bind(this)
    });

    // 注册市场概览工具
    this.registerTool({
      name: 'get_china_market_overview',
      description: '获取中国股市整体概览，包括主要指数表现',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      handler: this.getChinaMarketOverview.bind(this)
    });

    // 注册公司基本信息工具
    this.registerTool({
      name: 'get_company_info',
      description: '获取公司基本信息，包括公司简介、主营业务、行业分类等',
      parameters: {
        type: 'object',
        properties: {
          stock_code: {
            type: 'string',
            description: '股票代码'
          }
        },
        required: ['stock_code']
      },
      handler: this.getCompanyInfo.bind(this)
    });

    // 注册行业数据工具
    this.registerTool({
      name: 'get_industry_data',
      description: '获取行业数据和同行业公司对比信息',
      parameters: {
        type: 'object',
        properties: {
          industry_code: {
            type: 'string',
            description: '行业代码或股票代码'
          }
        },
        required: ['industry_code']
      },
      handler: this.getIndustryData.bind(this)
    });

    this.logger.log(`已注册 ${this.tools.size} 个数据获取工具`);
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
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  /**
   * 执行工具调用
   */
  async executeTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`未找到工具: ${toolName}`);
    }

    try {
      this.logger.debug(`执行工具: ${toolName}，参数: ${JSON.stringify(parameters)}`);
      const result = await tool.handler(parameters);
      this.logger.debug(`工具执行完成: ${toolName}`);
      return result;
    } catch (error) {
      this.logger.error(`工具执行失败: ${toolName}, 错误: ${error.message}`);
      throw error;
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
      const realTimeData = await this.stockDataService.getRealTimeData(stock_code);
      
      // 获取历史数据
      const query: StockDataQuery = {
        code: stock_code,
        startDate: new Date(start_date),
        endDate: new Date(end_date),
        klineType: KLineType.DAILY
      };
      const historicalData = await this.stockDataService.getHistoricalData(query);
      
      // 获取技术指标
      const technicalIndicators = await this.stockDataService.getTechnicalIndicators(query);
      
      // 格式化数据为文本
      const analysisText = `
# ${stock_code} 股票数据分析

## 📊 实时行情
- 股票名称: ${realTimeData.name || '未知'}
- 当前价格: ¥${realTimeData.price?.toFixed(2) || 'N/A'}
- 涨跌幅: ${realTimeData.changePercent ? (realTimeData.changePercent > 0 ? '+' : '') + realTimeData.changePercent.toFixed(2) + '%' : 'N/A'}
- 成交量: ${realTimeData.volume?.toLocaleString() || 'N/A'}手
- 成交额: ¥${realTimeData.turnover ? (realTimeData.turnover / 10000).toFixed(2) + '万' : 'N/A'}
- 换手率: ${realTimeData.turnoverRate?.toFixed(2) || 'N/A'}%
- 市盈率: ${realTimeData.pe?.toFixed(2) || 'N/A'}
- 市净率: ${realTimeData.pb?.toFixed(2) || 'N/A'}
- 更新时间: ${realTimeData.timestamp?.toLocaleString() || new Date().toLocaleString()}

## 📈 历史数据概览
- 数据期间: ${start_date} 至 ${end_date}
- 数据条数: ${historicalData.data?.length || 0}条
- 期间最高: ¥${historicalData.data?.length ? Math.max(...historicalData.data.map(d => d.high)).toFixed(2) : 'N/A'}
- 期间最低: ¥${historicalData.data?.length ? Math.min(...historicalData.data.map(d => d.low)).toFixed(2) : 'N/A'}
- 期间涨幅: ${this.calculatePeriodReturn(historicalData.data)}
- 平均成交量: ${historicalData.data?.length ? Math.round(historicalData.data.reduce((sum, d) => sum + d.volume, 0) / historicalData.data.length).toLocaleString() : 'N/A'}手

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

数据来源: 通达信API
`;

      return analysisText;
    } catch (error) {
      this.logger.error(`获取股票数据失败: ${error.message}`);
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
    const { stock_code, report_type = 'income_statement', period = 'annual' } = params;
    
    try {
      // 获取公司基本信息（包含财务指标）
      const basicInfo = await this.stockDataService.getStockBasicInfo(stock_code);
      
      const financialText = `
# ${stock_code} 财务数据分析

## 财务报表类型: ${report_type}
## 报告期间: ${period}

### 基本财务信息
- 公司名称: ${basicInfo.name || '未知'}
- 股票代码: ${basicInfo.code}
- 总股本: ${basicInfo.totalShares ? (basicInfo.totalShares / 10000).toFixed(0) + '万股' : '未知'}
- 流通股本: ${basicInfo.floatShares ? (basicInfo.floatShares / 10000).toFixed(0) + '万股' : '未知'}
- 上市日期: ${basicInfo.listDate ? basicInfo.listDate.toLocaleDateString() : '未知'}
- 交易所: ${basicInfo.exchangeName || '未知'}

### 业务信息
- 所属行业: ${basicInfo.industry || '未知'}
- 所属板块: ${basicInfo.sector || '未知'}
- 股票状态: ${basicInfo.status || '未知'}
- 是否停牌: ${basicInfo.suspended ? '是' : '否'}

### 基本估值指标
基于实时行情数据获取的估值信息，详细财务数据需要额外获取。

注意：当前系统基于通达信数据接口，主要提供实时行情和基本信息。
详细的财务报表数据（利润表、资产负债表、现金流量表等）需要
集成专业的财务数据源才能提供。

数据来源: 通达信API
`;

      return financialText;
    } catch (error) {
      this.logger.error(`获取财务数据失败: ${error.message}`);
      return `获取股票 ${stock_code} 财务数据失败: ${error.message}`;
    }
  }

  /**
   * 计算期间收益率
   */
  private calculatePeriodReturn(data?: { close: number }[]): string {
    if (!data || data.length === 0) return 'N/A';
    
    const firstPrice = data[0].close;
    const lastPrice = data[data.length - 1].close;
    const returnPercent = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    return (returnPercent > 0 ? '+' : '') + returnPercent.toFixed(2) + '%';
  }

  /**
   * 获取数组最后一个有效值
   */
  private getLastValue(arr?: number[]): string {
    if (!arr || arr.length === 0) return 'N/A';
    
    // 从后往前找第一个非NaN值
    for (let i = arr.length - 1; i >= 0; i--) {
      if (!isNaN(arr[i])) {
        return arr[i].toFixed(2);
      }
    }
    
    return 'N/A';
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
- 涨跌点数: ${marketOverview.shanghaiIndex.change > 0 ? '+' : ''}${marketOverview.shanghaiIndex.change.toFixed(2)}
- 涨跌幅: ${marketOverview.shanghaiIndex.changePercent > 0 ? '+' : ''}${marketOverview.shanghaiIndex.changePercent.toFixed(2)}%

## 📈 深证成指
- 当前点位: ${marketOverview.shenzhenIndex.value.toFixed(2)}
- 涨跌点数: ${marketOverview.shenzhenIndex.change > 0 ? '+' : ''}${marketOverview.shenzhenIndex.change.toFixed(2)}
- 涨跌幅: ${marketOverview.shenzhenIndex.changePercent > 0 ? '+' : ''}${marketOverview.shenzhenIndex.changePercent.toFixed(2)}%

## 📈 创业板指
- 当前点位: ${marketOverview.chinextIndex.value.toFixed(2)}
- 涨跌点数: ${marketOverview.chinextIndex.change > 0 ? '+' : ''}${marketOverview.chinextIndex.change.toFixed(2)}
- 涨跌幅: ${marketOverview.chinextIndex.changePercent > 0 ? '+' : ''}${marketOverview.chinextIndex.changePercent.toFixed(2)}%

## 📈 科创50
- 当前点位: ${marketOverview.star50Index.value.toFixed(2)}
- 涨跌点数: ${marketOverview.star50Index.change > 0 ? '+' : ''}${marketOverview.star50Index.change.toFixed(2)}
- 涨跌幅: ${marketOverview.star50Index.changePercent > 0 ? '+' : ''}${marketOverview.star50Index.changePercent.toFixed(2)}%

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
      this.logger.error(`获取市场概览失败: ${error.message}`);
      return `获取市场概览失败: ${error.message}`;
    }
  }

  /**
   * 获取公司基本信息
   */
  private async getCompanyInfo(params: { stock_code: string }): Promise<string> {
    const { stock_code } = params;
    
    try {
      const basicInfo = await this.stockDataService.getStockBasicInfo(stock_code);
      
      const companyInfoText = `
# ${stock_code} 公司基本信息

## 公司概况
- 股票名称: ${basicInfo.name || '未知'}
- 股票代码: ${basicInfo.code}
- 交易所: ${basicInfo.exchangeName || '未知'}
- 上市日期: ${basicInfo.listDate ? basicInfo.listDate.toLocaleDateString() : '未知'}
- 总股本: ${basicInfo.totalShares ? (basicInfo.totalShares / 10000).toFixed(0) + '万股' : '未知'}
- 流通股本: ${basicInfo.floatShares ? (basicInfo.floatShares / 10000).toFixed(0) + '万股' : '未知'}

## 行业信息
- 所属行业: ${basicInfo.industry || '未知'}
- 所属板块: ${basicInfo.sector || '未知'}
- 股票状态: ${basicInfo.status || '未知'}
- 是否停牌: ${basicInfo.suspended ? '是' : '否'}

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
      this.logger.error(`获取公司信息失败: ${error.message}`);
      return `获取股票 ${stock_code} 公司信息失败: ${error.message}`;
    }
  }

  /**
   * 获取行业数据
   */
  private async getIndustryData(params: { industry_code: string }): Promise<string> {
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
      this.logger.error(`获取行业数据失败: ${error.message}`);
      return `获取行业 ${industry_code} 数据失败: ${error.message}`;
    }
  }
}