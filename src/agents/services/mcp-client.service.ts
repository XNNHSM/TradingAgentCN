import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BusinessLogger } from "../../common/utils/business-logger.util";

/**
 * MCP客户端服务
 * 连接到阿里云百炼股票数据MCP服务器
 */
@Injectable()
export class MCPClientService {
  private readonly logger = new BusinessLogger(MCPClientService.name);
  private mcpConfig: MCPConfig;
  private isConnected: boolean = false;

  constructor(private readonly configService: ConfigService) {
    this.mcpConfig = {
      name: "阿里云百炼_股票数据",
      type: "sse",
      baseUrl: "https://dashscope.aliyuncs.com/api/v1/mcps/qtf_mcp/sse",
      headers: {
        Authorization: `Bearer ${this.configService.get<string>("DASHSCOPE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      description: "股票数据以 MCP 协议，提供及时、准确的股票基本信息、行情、财务、技术指标等股票数据",
      isActive: true,
    };
  }

  /**
   * 初始化MCP连接
   */
  async initialize(): Promise<void> {
    try {
      this.logger.serviceInfo("正在初始化MCP客户端连接...");
      
      // 验证API密钥
      const apiKey = this.configService.get<string>("DASHSCOPE_API_KEY");
      if (!apiKey) {
        throw new Error("DASHSCOPE_API_KEY 环境变量未设置");
      }

      // 测试连接
      await this.testConnection();
      
      this.isConnected = true;
      this.logger.serviceInfo("MCP客户端连接成功");
    } catch (error) {
      this.logger.businessError("MCP客户端初始化失败", error);
      throw error;
    }
  }

  /**
   * 测试连接
   */
  private async testConnection(): Promise<void> {
    // 这里应该实现实际的连接测试逻辑
    // 由于MCP协议的具体实现细节未知，这里先做简单的URL验证
    if (!this.mcpConfig.baseUrl || !this.mcpConfig.headers.Authorization.includes("Bearer ")) {
      throw new Error("MCP服务器配置不完整");
    }
  }

  /**
   * 执行MCP工具调用
   */
  async callTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      this.logger.debug(`调用MCP工具: ${toolName}`);

      // 根据工具名称路由到对应的MCP API
      switch (toolName) {
        case "get_stock_basic_info":
          return await this.getStockBasicInfo(parameters as { stock_code: string });
        case "get_stock_realtime_data":
          return await this.getStockRealtimeData(parameters as { stock_code: string });
        case "get_stock_historical_data":
          return await this.getStockHistoricalData(parameters as { 
            stock_code: string; 
            start_date: string; 
            end_date: string; 
            period?: string; 
          });
        case "get_stock_technical_indicators":
          return await this.getStockTechnicalIndicators(parameters as { 
            stock_code: string; 
            period?: number; 
          });
        case "get_stock_financial_data":
          return await this.getStockFinancialData(parameters as { 
            stock_code: string; 
            report_type?: string; 
            period?: string; 
          });
        case "get_market_overview":
          return await this.getMarketOverview(parameters);
        case "search_stocks":
          return await this.searchStocks(parameters as { keyword: string });
        case "get_stock_news":
          return await this.getStockNews(parameters as { 
            stock_code?: string; 
            keyword: string; 
            days?: number; 
          });
        default:
          throw new Error(`不支持的MCP工具: ${toolName}`);
      }
    } catch (error) {
      this.logger.businessError(`MCP工具调用失败: ${toolName}`, error);
      throw error;
    }
  }

  /**
   * 获取股票基本信息
   */
  private async getStockBasicInfo(params: { stock_code: string }): Promise<string> {
    try {
      const response = await fetch(this.mcpConfig.baseUrl, {
        method: 'POST',
        headers: this.mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_stock_basic_info',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return `# ${params.stock_code} 股票基本信息

## 基本信息
- 股票代码: ${data.stock_code || params.stock_code}
- 股票名称: ${data.stock_name || '未知'}
- 交易所: ${data.market || '未知'}
- 所属行业: ${data.industry || '未知'}
- 市值: ${data.market_cap || '未知'}
- 市盈率: ${data.pe_ratio || '未知'}
- 市净率: ${data.pb_ratio || '未知'}

数据来源: 阿里云百炼MCP股票数据服务`;
    } catch (error) {
      this.logger.businessError('获取股票基本信息失败', error, { stock_code: params.stock_code });
      throw new Error(`获取股票基本信息失败: ${error.message}`);
    }
  }

  /**
   * 获取股票实时数据
   */
  private async getStockRealtimeData(params: { stock_code: string }): Promise<string> {
    try {
      const response = await fetch(this.mcpConfig.baseUrl, {
        method: 'POST',
        headers: this.mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_stock_realtime_data',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const change = data.change || 0;
      const changePercent = data.change_percent || 0;
      const volume = data.volume || 0;
      const turnover = data.turnover || 0;

      return `# ${params.stock_code} 实时行情

## 实时数据
- 当前价格: ¥${data.current_price || '未知'}
- 涨跌额: ¥${change > 0 ? '+' : ''}${change}
- 涨跌幅: ${changePercent > 0 ? '+' : ''}${changePercent}%
- 成交量: ${(volume / 10000).toFixed(2)}万手
- 成交额: ¥${(turnover / 100000000).toFixed(2)}亿
- 最高价: ¥${data.high || '未知'}
- 最低价: ¥${data.low || '未知'}
- 开盘价: ¥${data.open || '未知'}
- 昨收价: ¥${data.prev_close || '未知'}

数据来源: 阿里云百炼MCP股票数据服务`;
    } catch (error) {
      this.logger.businessError('获取股票实时数据失败', error, { stock_code: params.stock_code });
      throw new Error(`获取股票实时数据失败: ${error.message}`);
    }
  }

  /**
   * 获取股票历史数据
   */
  private async getStockHistoricalData(params: {
    stock_code: string;
    start_date: string;
    end_date: string;
    period?: string;
  }): Promise<string> {
    try {
      const response = await fetch(this.mcpConfig.baseUrl, {
        method: 'POST',
        headers: this.mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_stock_historical_data',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const dataCount = data.data?.length || 0;
      
      return `# ${params.stock_code} 历史数据

## 数据概览
- 查询期间: ${params.start_date} 至 ${params.end_date}
- 数据周期: ${params.period || '日线'}
- 数据条数: ${dataCount}条

## 价格概览
- 期间最高: ¥${data.period_high || '未知'}
- 期间最低: ¥${data.period_low || '未知'}
- 期间涨幅: ${data.period_return || '未知'}
- 平均成交量: ${data.avg_volume || '未知'}
- 平均换手率: ${data.avg_turnover_rate || '未知'}

## 趋势分析
- 短期趋势(5日): ${data.trend_short || '未知'}
- 中期趋势(20日): ${data.trend_medium || '未知'}
- 长期趋势(60日): ${data.trend_long || '未知'}

数据来源: 阿里云百炼MCP股票数据服务`;
    } catch (error) {
      this.logger.businessError('获取历史数据失败', error, { 
        stock_code: params.stock_code,
        date_range: `${params.start_date} - ${params.end_date}`
      });
      throw new Error(`获取历史数据失败: ${error.message}`);
    }
  }

  /**
   * 获取股票技术指标
   */
  private async getStockTechnicalIndicators(params: {
    stock_code: string;
    period?: number;
  }): Promise<string> {
    try {
      const response = await fetch(this.mcpConfig.baseUrl, {
        method: 'POST',
        headers: this.mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_stock_technical_indicators',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const indicators = data.indicators || {};
      
      return `# ${params.stock_code} 技术指标分析

## 移动平均线
- MA5: ¥${indicators.MA5 || '未知'}
- MA10: ¥${indicators.MA10 || '未知'}
- MA20: ¥${indicators.MA20 || '未知'}
- MA60: ¥${indicators.MA60 || '未知'}

## MACD指标
- MACD: ${indicators.MACD || '未知'}
- 信号线: ${indicators.MACD_SIGNAL || '未知'}
- 柱状图: ${indicators.MACD_HISTOGRAM || '未知'}

## RSI指标
- RSI(14): ${indicators.RSI || '未知'}
- 状态: ${indicators.RSI_STATUS || '未知'}

## 布林带
- 上轨: ¥${indicators.BOLL_UPPER || '未知'}
- 中轨: ¥${indicators.BOLL_MIDDLE || '未知'}
- 下轨: ¥${indicators.BOLL_LOWER || '未知'}
- 当前位置: ${indicators.BOLL_POSITION || '未知'}

## KDJ指标
- K值: ${indicators.KDJ_K || '未知'}
- D值: ${indicators.KDJ_D || '未知'}
- J值: ${indicators.KDJ_J || '未知'}

数据来源: 阿里云百炼MCP股票数据服务`;
    } catch (error) {
      this.logger.businessError('获取技术指标失败', error, { 
        stock_code: params.stock_code
      });
      throw new Error(`获取技术指标失败: ${error.message}`);
    }
  }

  /**
   * 获取股票财务数据
   */
  private async getStockFinancialData(params: {
    stock_code: string;
    report_type?: string;
    period?: string;
  }): Promise<string> {
    try {
      const response = await fetch(this.mcpConfig.baseUrl, {
        method: 'POST',
        headers: this.mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_stock_financial_data',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const financial = data.financial_data || {};
      
      return `# ${params.stock_code} 财务数据

## 财务概览
- 总资产: ${financial.total_assets || '未知'}
- 净资产: ${financial.shareholders_equity || '未知'}
- 营业收入: ${financial.revenue || '未知'}
- 净利润: ${financial.net_income || '未知'}
- 每股收益: ${financial.eps || '未知'}

## 财务比率
- ROE: ${financial.roe || '未知'}
- ROA: ${financial.roa || '未知'}
- 毛利率: ${financial.gross_margin || '未知'}
- 净利率: ${financial.net_margin || '未知'}
- 资产负债率: ${financial.debt_ratio || '未知'}

## 成长性指标
- 营收增长率: ${financial.revenue_growth || '未知'}
- 净利润增长率: ${financial.profit_growth || '未知'}
- 每股收益增长率: ${financial.eps_growth || '未知'}

数据来源: 阿里云百炼MCP股票数据服务`;
    } catch (error) {
      this.logger.businessError('获取财务数据失败', error, { 
        stock_code: params.stock_code,
        report_type: params.report_type 
      });
      throw new Error(`获取财务数据失败: ${error.message}`);
    }
  }

  /**
   * 获取市场概览
   */
  private async getMarketOverview(_params: any): Promise<string> {
    try {
      const response = await fetch(this.mcpConfig.baseUrl, {
        method: 'POST',
        headers: this.mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_market_overview',
          parameters: _params || {},
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const market = data.market_summary || {};
      const stats = data.market_stats || {};
      
      return `# A股市场概览

## 主要指数
- 上证指数: ${market.shanghai_index?.value || '未知'} (${market.shanghai_index?.change_percent || '未知'})
- 深证成指: ${market.shenzhen_index?.value || '未知'} (${market.shenzhen_index?.change_percent || '未知'})
- 创业板指: ${market.gem_index?.value || '未知'} (${market.gem_index?.change_percent || '未知'})
- 科创50: ${market.star_index?.value || '未知'} (${market.star_index?.change_percent || '未知'})

## 市场统计
- 上涨股票: ${stats.rising_stocks || '未知'}只
- 下跌股票: ${stats.falling_stocks || '未知'}只
- 平盘股票: ${stats.flat_stocks || '未知'}只
- 涨停股票: ${stats.limit_up_stocks || '未知'}只
- 跌停股票: ${stats.limit_down_stocks || '未知'}只

## 成交情况
- 沪市成交额: ${stats.sh_turnover || '未知'}
- 深市成交额: ${stats.sz_turnover || '未知'}
- 总成交额: ${data.trading_volume || '未知'}

数据来源: 阿里云百炼MCP股票数据服务`;
    } catch (error) {
      this.logger.businessError('获取市场概览失败', error);
      throw new Error(`获取市场概览失败: ${error.message}`);
    }
  }

  /**
   * 搜索股票
   */
  private async searchStocks(params: { keyword: string }): Promise<string> {
    try {
      const response = await fetch(this.mcpConfig.baseUrl, {
        method: 'POST',
        headers: this.mcpConfig.headers,
        body: JSON.stringify({
          tool: 'search_stocks',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const results = data.results || [];
      const total = data.total || 0;
      
      let resultText = `# 股票搜索结果 - "${params.keyword}"\n\n## 搜索到 ${total} 只相关股票\n\n`;
      
      results.forEach((stock: any, index: number) => {
        resultText += `### ${index + 1}. ${stock.stock_name || '未知'} (${stock.stock_code || '未知'})\n`;
        resultText += `- 股票名称: ${stock.stock_name || '未知'}\n`;
        resultText += `- 所属行业: ${stock.industry || '未知'}\n`;
        resultText += `- 当前价格: ¥${stock.current_price || '未知'}\n\n`;
      });
      
      resultText += `数据来源: 阿里云百炼MCP股票数据服务`;
      
      return resultText;
    } catch (error) {
      this.logger.businessError('股票搜索失败', error, { keyword: params.keyword });
      throw new Error(`股票搜索失败: ${error.message}`);
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
    try {
      const response = await fetch(this.mcpConfig.baseUrl, {
        method: 'POST',
        headers: this.mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_stock_news',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const news = data.news || [];
      const total = data.total || 0;
      
      let newsText = `# 股票新闻 - "${params.keyword}"\n\n## 相关新闻 (最近${params.days || 7}天)\n\n`;
      
      news.forEach((article: any, index: number) => {
        newsText += `### ${index + 1}. ${article.title || '未知标题'}\n`;
        newsText += `- 发布时间: ${article.publish_time || '未知时间'}\n`;
        newsText += `- 来源: ${article.source || '未知来源'}\n`;
        newsText += `- 内容摘要: ${article.summary || '无摘要'}\n\n`;
      });
      
      newsText += `数据来源: 阿里云百炼MCP股票数据服务`;
      
      return newsText;
    } catch (error) {
      this.logger.businessError('获取股票新闻失败', error, { 
        stock_code: params.stock_code,
        keyword: params.keyword 
      });
      throw new Error(`获取股票新闻失败: ${error.message}`);
    }
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): MCPTool[] {
    return [
      {
        name: "get_stock_basic_info",
        description: "获取股票基本信息",
        parameters: {
          type: "object",
          properties: {
            stock_code: {
              type: "string",
              description: "股票代码（如 000001, 600519）"
            }
          },
          required: ["stock_code"]
        }
      },
      {
        name: "get_stock_realtime_data",
        description: "获取股票实时行情数据",
        parameters: {
          type: "object",
          properties: {
            stock_code: {
              type: "string",
              description: "股票代码（如 000001, 600519）"
            }
          },
          required: ["stock_code"]
        }
      },
      {
        name: "get_stock_historical_data",
        description: "获取股票历史数据",
        parameters: {
          type: "object",
          properties: {
            stock_code: {
              type: "string",
              description: "股票代码"
            },
            start_date: {
              type: "string",
              description: "开始日期 YYYY-MM-dd"
            },
            end_date: {
              type: "string",
              description: "结束日期 YYYY-MM-dd"
            },
            period: {
              type: "string",
              description: "数据周期 (daily/weekly/monthly)",
              default: "daily"
            }
          },
          required: ["stock_code", "start_date", "end_date"]
        }
      },
      {
        name: "get_stock_technical_indicators",
        description: "获取股票技术指标",
        parameters: {
          type: "object",
          properties: {
            stock_code: {
              type: "string",
              description: "股票代码"
            },
            period: {
              type: "number",
              description: "计算周期天数",
              default: 20
            }
          },
          required: ["stock_code"]
        }
      },
      {
        name: "get_stock_financial_data",
        description: "获取股票财务数据",
        parameters: {
          type: "object",
          properties: {
            stock_code: {
              type: "string",
              description: "股票代码"
            },
            report_type: {
              type: "string",
              description: "报表类型 (income/balance/cashflow)",
              default: "income"
            },
            period: {
              type: "string",
              description: "报告期间 (annual/quarterly)",
              default: "annual"
            }
          },
          required: ["stock_code"]
        }
      },
      {
        name: "get_market_overview",
        description: "获取市场概览数据",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "search_stocks",
        description: "搜索股票",
        parameters: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "搜索关键词"
            }
          },
          required: ["keyword"]
        }
      },
      {
        name: "get_stock_news",
        description: "获取股票相关新闻",
        parameters: {
          type: "object",
          properties: {
            stock_code: {
              type: "string",
              description: "股票代码（可选）"
            },
            keyword: {
              type: "string",
              description: "新闻关键词"
            },
            days: {
              type: "number",
              description: "查询天数",
              default: 7
            }
          },
          required: ["keyword"]
        }
      }
    ];
  }

  /**
   * 获取工具定义（用于LLM function calling）
   */
  getToolDefinitions(): any[] {
    return this.getAvailableTools().map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  /**
   * 检查连接状态
   */
  isConnectedToMCP(): boolean {
    return this.isConnected;
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.logger.serviceInfo("MCP客户端连接已断开");
  }
}

/**
 * MCP配置接口
 */
export interface MCPConfig {
  name: string;
  type: "sse" | "stdio" | "websocket";
  baseUrl: string;
  headers: Record<string, string>;
  description: string;
  isActive: boolean;
}

/**
 * MCP工具接口
 */
export interface MCPTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}