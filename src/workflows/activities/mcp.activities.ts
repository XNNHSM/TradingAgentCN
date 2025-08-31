/**
 * MCP相关的Temporal Activities
 * 将MCP服务调用封装为可重试、可监控的Activities
 */

import { ConfigService } from '@nestjs/config';
import { BusinessLogger } from '../../common/utils/business-logger.util';
import { MCPClientFallbackService } from '../../agents/services/mcp-client-fallback.service';

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
  
  // 创建MCP客户端服务实例 - 使用带回退机制的版本
  const mcpClientService = new MCPClientFallbackService(configService);

  // 初始化MCP连接的简化版本
  const testConnection = async (): Promise<void> => {
    try {
      logger.serviceInfo('测试MCP连接...');
      // 使用MCPClientService测试连接
      await mcpClientService.initialize();
      logger.serviceInfo('MCP连接测试成功');
    } catch (error) {
      logger.businessError('MCP连接测试失败', error);
      throw new Error(`MCP连接测试失败: ${error.message}。请检查网络连接和API配置。`);
    }
  };

  // 使用MCPClientService的核心工具调用方法
  const callTool = async (toolName: string, parameters: Record<string, any>): Promise<any> => {
    try {
      logger.serviceInfo(`调用MCP工具: ${toolName}`, parameters);
      // 直接使用MCPClientService
      return await mcpClientService.callTool(toolName, parameters);
    } catch (error) {
      logger.businessError(`MCP工具调用失败: ${toolName}`, error, parameters);
      throw error;
    }
  };

  // 返回Activities实现
  return {
    // 连接管理
    initializeMCPConnection: async (): Promise<boolean> => {
      try {
        logger.serviceInfo("初始化MCP连接");
        // 使用MCPClientService初始化
        await mcpClientService.initialize();
        logger.serviceInfo("MCP连接初始化成功");
        return true;
      } catch (error) {
        logger.businessError("MCP连接初始化失败", error);
        throw error;
      }
    },

    testMCPConnection: async (): Promise<boolean> => {
      try {
        await testConnection();
        return true;
      } catch (error) {
        logger.businessError("MCP连接测试失败", error);
        return false;
      }
    },

    disconnectMCP: async (): Promise<void> => {
      logger.serviceInfo("断开MCP连接");
      await mcpClientService.disconnect();
    },

    // 基础工具调用
    callMCPTool: async (params: MCPToolCallParams): Promise<any> => {
      logger.serviceInfo(`调用MCP工具: ${params.toolName}`);
      return await callTool(params.toolName, params.parameters);
    },

    // 股票数据获取Activities - 使用MCPClientService
    getStockBasicInfo: async (params: { stock_code: string }) => 
      await callTool('get_stock_basic_info', params),
    
    getStockRealtimeData: async (params: { stock_code: string }) => 
      await callTool('get_stock_realtime_data', params),
    
    getStockHistoricalData: async (params: {
      stock_code: string;
      start_date: string;
      end_date: string;
      period?: string;
    }) => await callTool('get_stock_historical_data', params),
    
    getStockTechnicalIndicators: async (params: {
      stock_code: string;
      indicators: string[];
      start_date: string;
      end_date: string;
    }) => await callTool('get_stock_technical_indicators', params),
    
    getStockFinancialData: async (params: {
      stock_code: string;
      report_type?: string;
      period?: string;
    }) => await callTool('get_stock_financial_data', params),
    
    getMarketOverview: async (params: any = {}) => 
      await callTool('get_market_overview', params),
    
    searchStocks: async (params: { keyword: string }) => 
      await callTool('search_stocks', params),
    
    getStockNews: async (params: {
      stock_code?: string;
      keyword?: string;
      start_date?: string;
      end_date?: string;
      limit?: number;
    }) => await callTool('get_stock_news', params),
  };
}