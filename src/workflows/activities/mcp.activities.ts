/**
 * MCP相关的Temporal Activities
 * 将MCP服务调用封装为可重试、可监控的Activities
 */

import { ConfigService } from '@nestjs/config';
import { BusinessLogger } from '../../common/utils/business-logger.util';

/**
 * MCP配置接口
 */
export interface MCPConfig {
  name: string;
  type: string;
  baseUrl: string;
  headers: Record<string, string>;
  description: string;
  isActive: boolean;
}

/**
 * MCP工具调用参数接口
 */
export interface MCPToolCallParams {
  toolName: string;
  parameters: Record<string, any>;
}

/**
 * MCP Activities接口定义
 */
export interface MCPActivities {
  // 连接管理
  initializeMCPConnection: () => Promise<boolean>;
  testMCPConnection: () => Promise<boolean>;
  disconnectMCP: () => Promise<void>;
  
  // 基础工具调用
  callMCPTool: (params: MCPToolCallParams) => Promise<any>;
  
  // 股票数据获取Activities
  getStockBasicInfo: (params: { stock_code: string }) => Promise<any>;
  getStockRealtimeData: (params: { stock_code: string }) => Promise<any>;
  getStockHistoricalData: (params: {
    stock_code: string;
    start_date: string;
    end_date: string;
    period?: string;
  }) => Promise<any>;
  getStockTechnicalIndicators: (params: {
    stock_code: string;
    indicators: string[];
    start_date: string;
    end_date: string;
  }) => Promise<any>;
  getStockFinancialData: (params: {
    stock_code: string;
    report_type?: string;
    period?: string;
  }) => Promise<any>;
  getMarketOverview: (params?: any) => Promise<any>;
  searchStocks: (params: { keyword: string }) => Promise<any>;
  getStockNews: (params: {
    stock_code?: string;
    keyword?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }) => Promise<any>;
}

/**
 * 创建MCP Activities实现
 */
export function createMCPActivities(configService: ConfigService): MCPActivities {
  const logger = new BusinessLogger('MCPActivities');
  
  // MCP配置
  let mcpConfig: MCPConfig;
  let isConnected = false;

  // 初始化配置
  const initializeConfig = () => {
    mcpConfig = {
      name: "阿里云百炼_股票数据",
      type: "sse",
      baseUrl: "https://dashscope.aliyuncs.com/api/v1/mcps/qtf_mcp/sse",
      headers: {
        Authorization: `Bearer ${configService.get<string>("DASHSCOPE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      description: "股票数据以 MCP 协议，提供及时、准确的股票基本信息、行情、财务、技术指标等股票数据",
      isActive: true,
    };
  };

  // 测试连接
  const testConnection = async (): Promise<void> => {
    try {
      // 使用简单的股票基本信息查询来测试连接
      await callTool('get_stock_basic_info', { stock_code: '000001' });
    } catch (error) {
      throw new Error(`MCP连接测试失败: ${error.message}`);
    }
  };

  // 核心工具调用方法
  const callTool = async (toolName: string, parameters: Record<string, any>): Promise<any> => {
    if (!mcpConfig) {
      throw new Error('MCP配置未初始化');
    }

    // 根据工具名称路由到具体实现
    switch (toolName) {
      case 'get_stock_basic_info':
        return await getStockBasicInfoImpl(parameters as { stock_code: string });
      case 'get_stock_realtime_data':
        return await getStockRealtimeDataImpl(parameters as { stock_code: string });
      case 'get_stock_historical_data':
        return await getStockHistoricalDataImpl(parameters as {
          stock_code: string;
          start_date: string;
          end_date: string;
          period?: string;
        });
      case 'get_stock_technical_indicators':
        return await getStockTechnicalIndicatorsImpl(parameters as {
          stock_code: string;
          indicators: string[];
          start_date: string;
          end_date: string;
        });
      case 'get_stock_financial_data':
        return await getStockFinancialDataImpl(parameters as {
          stock_code: string;
          report_type?: string;
          period?: string;
        });
      case 'get_market_overview':
        return await getMarketOverviewImpl(parameters);
      case 'search_stocks':
        return await searchStocksImpl(parameters as { keyword: string });
      case 'get_stock_news':
        return await getStockNewsImpl(parameters as {
          stock_code?: string;
          keyword?: string;
          start_date?: string;
          end_date?: string;
          limit?: number;
        });
      default:
        throw new Error(`不支持的MCP工具: ${toolName}`);
    }
  };

  // 具体工具实现方法
  const getStockBasicInfoImpl = async (params: { stock_code: string }): Promise<any> => {
    logger.serviceInfo(`获取股票基本信息: ${params.stock_code}`);
    
    if (!mcpConfig) {
      throw new Error('MCP配置未初始化，请先调用initializeMCPConnection');
    }

    try {
      // 调用阿里云百炼MCP API
      const response = await fetch(mcpConfig.baseUrl, {
        method: 'POST',
        headers: mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_stock_basic_info',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.businessError('获取股票基本信息失败', error, { stock_code: params.stock_code });
      throw new Error(`获取股票基本信息失败: ${error.message}。请检查网络连接和API配置。`);
    }
  };

  const getStockRealtimeDataImpl = async (params: { stock_code: string }): Promise<any> => {
    logger.serviceInfo(`获取实时行情数据: ${params.stock_code}`);
    
    if (!mcpConfig) {
      throw new Error('MCP配置未初始化，请先调用initializeMCPConnection');
    }

    try {
      const response = await fetch(mcpConfig.baseUrl, {
        method: 'POST',
        headers: mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_stock_realtime_data',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.businessError('获取实时行情数据失败', error, { stock_code: params.stock_code });
      throw new Error(`获取实时行情数据失败: ${error.message}。请检查网络连接和API配置。`);
    }
  };

  const getStockHistoricalDataImpl = async (params: {
    stock_code: string;
    start_date: string;
    end_date: string;
    period?: string;
  }): Promise<any> => {
    logger.serviceInfo(`获取历史数据: ${params.stock_code} (${params.start_date} - ${params.end_date})`);
    
    if (!mcpConfig) {
      throw new Error('MCP配置未初始化，请先调用initializeMCPConnection');
    }

    try {
      const response = await fetch(mcpConfig.baseUrl, {
        method: 'POST',
        headers: mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_stock_historical_data',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.businessError('获取历史数据失败', error, { 
        stock_code: params.stock_code, 
        date_range: `${params.start_date} - ${params.end_date}` 
      });
      throw new Error(`获取历史数据失败: ${error.message}。请检查网络连接和API配置。`);
    }
  };

  const getStockTechnicalIndicatorsImpl = async (params: {
    stock_code: string;
    indicators: string[];
    start_date: string;
    end_date: string;
  }): Promise<any> => {
    logger.serviceInfo(`获取技术指标: ${params.stock_code} (${params.indicators.join(', ')})`);
    
    if (!mcpConfig) {
      throw new Error('MCP配置未初始化，请先调用initializeMCPConnection');
    }

    try {
      const response = await fetch(mcpConfig.baseUrl, {
        method: 'POST',
        headers: mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_stock_technical_indicators',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.businessError('获取技术指标失败', error, { 
        stock_code: params.stock_code,
        indicators: params.indicators.join(', ')
      });
      throw new Error(`获取技术指标失败: ${error.message}。请检查网络连接和API配置。`);
    }
  };

  const getStockFinancialDataImpl = async (params: {
    stock_code: string;
    report_type?: string;
    period?: string;
  }): Promise<any> => {
    logger.serviceInfo(`获取财务数据: ${params.stock_code} (${params.report_type || 'annual'}) `);
    
    if (!mcpConfig) {
      throw new Error('MCP配置未初始化，请先调用initializeMCPConnection');
    }

    try {
      const response = await fetch(mcpConfig.baseUrl, {
        method: 'POST',
        headers: mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_stock_financial_data',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.businessError('获取财务数据失败', error, { 
        stock_code: params.stock_code,
        report_type: params.report_type 
      });
      throw new Error(`获取财务数据失败: ${error.message}。请检查网络连接和API配置。`);
    }
  };

  const getMarketOverviewImpl = async (_params?: any): Promise<any> => {
    logger.serviceInfo('获取市场概览');
    
    if (!mcpConfig) {
      throw new Error('MCP配置未初始化，请先调用initializeMCPConnection');
    }

    try {
      const response = await fetch(mcpConfig.baseUrl, {
        method: 'POST',
        headers: mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_market_overview',
          parameters: _params || {},
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.businessError('获取市场概览失败', error);
      throw new Error(`获取市场概览失败: ${error.message}。请检查网络连接和API配置。`);
    }
  };

  const searchStocksImpl = async (params: { keyword: string }): Promise<any> => {
    logger.serviceInfo(`股票搜索: ${params.keyword}`);
    
    if (!mcpConfig) {
      throw new Error('MCP配置未初始化，请先调用initializeMCPConnection');
    }

    try {
      const response = await fetch(mcpConfig.baseUrl, {
        method: 'POST',
        headers: mcpConfig.headers,
        body: JSON.stringify({
          tool: 'search_stocks',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.businessError('股票搜索失败', error, { keyword: params.keyword });
      throw new Error(`股票搜索失败: ${error.message}。请检查网络连接和API配置。`);
    }
  };

  const getStockNewsImpl = async (params: {
    stock_code?: string;
    keyword?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }): Promise<any> => {
    logger.serviceInfo(`获取股票新闻: ${params.stock_code || params.keyword || '全市场'}`);
    
    if (!mcpConfig) {
      throw new Error('MCP配置未初始化，请先调用initializeMCPConnection');
    }

    try {
      const response = await fetch(mcpConfig.baseUrl, {
        method: 'POST',
        headers: mcpConfig.headers,
        body: JSON.stringify({
          tool: 'get_stock_news',
          parameters: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.businessError('获取股票新闻失败', error, { 
        stock_code: params.stock_code,
        keyword: params.keyword 
      });
      throw new Error(`获取股票新闻失败: ${error.message}。请检查网络连接和API配置。`);
    }
  };

  // 返回Activities实现
  return {
    // 连接管理
    initializeMCPConnection: async (): Promise<boolean> => {
      try {
        logger.serviceInfo("初始化MCP连接");
        
        // 验证API密钥
        const apiKey = configService.get<string>("DASHSCOPE_API_KEY");
        if (!apiKey) {
          throw new Error("DASHSCOPE_API_KEY 环境变量未设置");
        }

        // 初始化配置
        initializeConfig();
        
        // 测试连接
        await testConnection();
        
        isConnected = true;
        logger.serviceInfo("MCP连接初始化成功");
        return true;
      } catch (error) {
        logger.businessError("MCP连接初始化失败", error);
        isConnected = false;
        throw error;
      }
    },

    testMCPConnection: async (): Promise<boolean> => {
      try {
        if (!mcpConfig) {
          initializeConfig();
        }
        await testConnection();
        return true;
      } catch (error) {
        logger.businessError("MCP连接测试失败", error);
        return false;
      }
    },

    disconnectMCP: async (): Promise<void> => {
      logger.serviceInfo("断开MCP连接");
      isConnected = false;
    },

    // 基础工具调用
    callMCPTool: async (params: MCPToolCallParams): Promise<any> => {
      logger.serviceInfo(`调用MCP工具: ${params.toolName}`);
      return await callTool(params.toolName, params.parameters);
    },

    // 股票数据获取Activities
    getStockBasicInfo: getStockBasicInfoImpl,
    getStockRealtimeData: getStockRealtimeDataImpl,
    getStockHistoricalData: getStockHistoricalDataImpl,
    getStockTechnicalIndicators: getStockTechnicalIndicatorsImpl,
    getStockFinancialData: getStockFinancialDataImpl,
    getMarketOverview: getMarketOverviewImpl,
    searchStocks: searchStocksImpl,
    getStockNews: getStockNewsImpl,
  };
}