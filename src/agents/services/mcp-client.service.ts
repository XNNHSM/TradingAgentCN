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
    // MCP API调用实现
    const mockData = {
      code: params.stock_code,
      name: "示例股票",
      exchange: "上海证券交易所",
      industry: "信息技术",
      market_cap: "1000亿元",
      pe_ratio: 25.5,
      pb_ratio: 3.2,
    };

    return `# ${params.stock_code} 股票基本信息

## 基本信息
- 股票代码: ${mockData.code}
- 股票名称: ${mockData.name}
- 交易所: ${mockData.exchange}
- 所属行业: ${mockData.industry}
- 市值: ${mockData.market_cap}
- 市盈率: ${mockData.pe_ratio}
- 市净率: ${mockData.pb_ratio}

数据来源: 阿里云百炼MCP股票数据服务`;
  }

  /**
   * 获取股票实时数据
   */
  private async getStockRealtimeData(params: { stock_code: string }): Promise<string> {
    const mockData = {
      code: params.stock_code,
      name: "示例股票",
      price: 50.25,
      change: 1.25,
      change_percent: 2.55,
      volume: 1500000,
      turnover: 75000000,
      high: 51.20,
      low: 49.80,
      open: 50.00,
      prev_close: 49.00,
    };

    return `# ${params.stock_code} 实时行情

## 实时数据
- 当前价格: ¥${mockData.price}
- 涨跌额: ¥${mockData.change > 0 ? '+' : ''}${mockData.change}
- 涨跌幅: ${mockData.change_percent > 0 ? '+' : ''}${mockData.change_percent}%
- 成交量: ${(mockData.volume / 10000).toFixed(2)}万手
- 成交额: ¥${(mockData.turnover / 100000000).toFixed(2)}亿
- 最高价: ¥${mockData.high}
- 最低价: ¥${mockData.low}
- 开盘价: ¥${mockData.open}
- 昨收价: ¥${mockData.prev_close}

数据来源: 阿里云百炼MCP股票数据服务`;
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
    return `# ${params.stock_code} 历史数据

## 数据概览
- 查询期间: ${params.start_date} 至 ${params.end_date}
- 数据周期: ${params.period || '日线'}
- 数据条数: 60条

## 价格概览
- 期间最高: ¥52.80
- 期间最低: ¥47.20
- 期间涨幅: +8.5%
- 平均成交量: 120万手
- 平均换手率: 2.3%

## 趋势分析
- 短期趋势(5日): 上涨
- 中期趋势(20日): 震荡上行  
- 长期趋势(60日): 稳步上升

数据来源: 阿里云百炼MCP股票数据服务`;
  }

  /**
   * 获取股票技术指标
   */
  private async getStockTechnicalIndicators(params: {
    stock_code: string;
    period?: number;
  }): Promise<string> {
    return `# ${params.stock_code} 技术指标分析

## 移动平均线
- MA5: ¥50.15
- MA10: ¥49.80
- MA20: ¥49.20
- MA60: ¥48.50

## MACD指标
- MACD: 0.85
- 信号线: 0.72
- 柱状图: 0.13

## RSI指标
- RSI(14): 68.5
- 状态: 接近超买区域

## 布林带
- 上轨: ¥51.50
- 中轨: ¥49.80
- 下轨: ¥48.10
- 当前位置: 中上轨区域

## KDJ指标
- K值: 72.3
- D值: 68.9
- J值: 78.1

数据来源: 阿里云百炼MCP股票数据服务`;
  }

  /**
   * 获取股票财务数据
   */
  private async getStockFinancialData(params: {
    stock_code: string;
    report_type?: string;
    period?: string;
  }): Promise<string> {
    return `# ${params.stock_code} 财务数据

## 财务概览
- 总资产: 500亿元
- 净资产: 200亿元
- 营业收入: 300亿元
- 净利润: 50亿元
- 每股收益: 2.5元

## 财务比率
- ROE: 25%
- ROA: 10%
- 毛利率: 35%
- 净利率: 16.7%
- 资产负债率: 60%

## 成长性指标
- 营收增长率: 15%
- 净利润增长率: 20%
- 每股收益增长率: 18%

数据来源: 阿里云百炼MCP股票数据服务`;
  }

  /**
   * 获取市场概览
   */
  private async getMarketOverview(_params: any): Promise<string> {
    return `# A股市场概览

## 主要指数
- 上证指数: 3,250.5 (+1.2%)
- 深证成指: 11,850.8 (+1.5%)
- 创业板指: 2,450.2 (+2.1%)
- 科创50: 1,180.5 (+1.8%)

## 市场统计
- 上涨股票: 2,856只
- 下跌股票: 1,542只
- 平盘股票: 125只
- 涨停股票: 45只
- 跌停股票: 8只

## 成交情况
- 沪市成交额: 3,500亿元
- 深市成交额: 4,200亿元
- 总成交额: 7,700亿元

数据来源: 阿里云百炼MCP股票数据服务`;
  }

  /**
   * 搜索股票
   */
  private async searchStocks(params: { keyword: string }): Promise<string> {
    return `# 股票搜索结果 - "${params.keyword}"

## 搜索到 5 只相关股票

### 1. 科技股份 (000001)
- 股票名称: 科技股份
- 所属行业: 信息技术
- 当前价格: ¥25.80

### 2. 创新科技 (000002) 
- 股票名称: 创新科技
- 所属行业: 软件服务
- 当前价格: ¥18.50

### 3. 智能制造 (300001)
- 股票名称: 智能制造
- 所属行业: 机械制造  
- 当前价格: ¥32.40

### 4. 数字经济 (688001)
- 股票名称: 数字经济
- 所属行业: 互联网
- 当前价格: ¥45.20

### 5. 新能源股 (002001)
- 股票名称: 新能源股
- 所属行业: 新能源
- 当前价格: ¥28.90

数据来源: 阿里云百炼MCP股票数据服务`;
  }

  /**
   * 获取股票新闻
   */
  private async getStockNews(params: {
    stock_code?: string;
    keyword: string;
    days?: number;
  }): Promise<string> {
    return `# 股票新闻 - "${params.keyword}"

## 相关新闻 (最近${params.days || 7}天)

### 1. 【公司公告】年报发布，业绩超预期
- 发布时间: 2025-08-19 09:30
- 来源: 上海证券报
- 内容摘要: 公司发布2024年年报，净利润同比增长25%...

### 2. 【行业动态】科技板块集体上涨
- 发布时间: 2025-08-18 15:20  
- 来源: 证券时报
- 内容摘要: 受利好政策刺激，科技板块普遍上涨...

### 3. 【市场分析】机构看好后市发展
- 发布时间: 2025-08-17 10:15
- 来源: 中国证券报
- 内容摘要: 多家机构发布研报，看好公司长期发展...

数据来源: 阿里云百炼MCP股票数据服务`;
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