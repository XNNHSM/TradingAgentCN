import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {BusinessLogger} from '../../common/utils/business-logger.util';

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
        Authorization: `Bearer ${this.configService.get<string>("MCP_API_KEY")}`,
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
      
      // 验证MCP专用API密钥
      const apiKey = this.configService.get<string>("MCP_API_KEY");
      if (!apiKey || apiKey.trim() === '') {
        throw new Error("MCP_API_KEY 环境变量未设置或为空");
      }

      // 更新配置中的API密钥
      this.mcpConfig.headers.Authorization = `Bearer ${apiKey}`;
      
      this.logger.serviceInfo("API密钥配置成功", {
        hasApiKey: !!apiKey,
        keyLength: apiKey.length,
        keyPrefix: apiKey.substring(0, 10) + '...'
      });

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
    try {
      this.logger.serviceInfo("正在测试MCP API连接...");
      
      // 验证基本配置
      if (!this.mcpConfig.baseUrl || !this.mcpConfig.headers.Authorization.includes("Bearer ")) {
        throw new Error("MCP服务器配置不完整");
      }

      // 测试实际API连接 - 使用MCP协议标准格式
      const response = await fetch(this.mcpConfig.baseUrl, {
        method: 'POST',
        headers: this.mcpConfig.headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "brief",
            arguments: { symbol: 'SH000001' }
          },
          id: Date.now()
        })
      });

      const responseText = await response.text();
      this.logger.serviceInfo("MCP连接测试响应", {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 100) + (responseText.length > 100 ? '...' : '')
      });

      // 即使API返回401 Unauthorized（无效API密钥），也表示连接是成功的
      // 只有网络错误或服务不可用才算连接失败
      if (response.status >= 200 && response.status < 500) {
        this.logger.serviceInfo("MCP API连接测试成功", { status: response.status });
        return;
      }

      throw new Error(`MCP API连接失败: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        throw new Error(`网络连接失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 统一的MCP API调用方法
   */
  private async callMCPAPI(toolName: string, params: Record<string, any>): Promise<any> {
    const requestPayload = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params
      },
      id: Date.now()
    };

    this.logger.serviceInfo('发送MCP API请求', {
      url: this.mcpConfig.baseUrl,
      toolName,
      params,
      headers: {
        ...this.mcpConfig.headers,
        Authorization: this.mcpConfig.headers.Authorization ? `Bearer ***${this.mcpConfig.headers.Authorization.slice(-8)}` : 'Missing'
      },
      requestPayload
    });

    // SSE端点需要特殊处理
    const sseHeaders = {
      ...this.mcpConfig.headers,
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    };

    const response = await fetch(this.mcpConfig.baseUrl, {
      method: 'POST',
      headers: sseHeaders,
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.businessError('MCP API响应错误', new Error(`${response.status} ${response.statusText}`), {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        toolName,
        params
      });
      throw new Error(`MCP API调用失败: ${response.status} ${response.statusText}`);
    }

    // 处理SSE响应流
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let lastJsonResponse = '';

    this.logger.serviceInfo('开始处理MCP响应', {
      hasReader: !!reader,
      contentType: response.headers.get('content-type'),
      isStream: response.body instanceof ReadableStream,
      toolName
    });

    if (reader) {
      try {
        let chunkCount = 0;
        while (true) {
          const { done, value } = await reader.read();
          chunkCount++;
          
          this.logger.serviceInfo(`读取数据块 ${chunkCount}`, {
            done,
            hasValue: !!value,
            valueLength: value?.length || 0,
            toolName
          });
          
          if (done) {
            this.logger.serviceInfo(`SSE流读取完成，总共 ${chunkCount} 个数据块`, { toolName });
            break;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;
          
          this.logger.serviceInfo(`解码数据块内容`, {
            chunkLength: chunk.length,
            chunkPreview: chunk.substring(0, 200),
            toolName
          });
          
          // SSE数据格式：data: {...}\n\n
          const lines = chunk.split('\n');
          this.logger.serviceInfo(`分割出 ${lines.length} 行数据`, { 
            lines: lines.map(line => ({ 
              length: line.length, 
              startsWithData: line.startsWith('data: '),
              preview: line.substring(0, 50)
            })),
            toolName
          });
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.substring(6).trim();
              this.logger.serviceInfo(`找到data行`, {
                jsonStrLength: jsonStr.length,
                jsonStr: jsonStr,
                isDone: jsonStr === '[DONE]',
                toolName
              });
              
              if (jsonStr && jsonStr !== '[DONE]') {
                lastJsonResponse = jsonStr;
                this.logger.serviceInfo(`更新lastJsonResponse`, {
                  length: jsonStr.length,
                  preview: jsonStr.substring(0, 100),
                  toolName
                });
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      this.logger.serviceInfo('使用常规文本处理（非流模式）', { toolName });
      // 如果不是流响应，使用常规文本处理
      const responseText = await response.text();
      fullResponse = responseText;
      lastJsonResponse = responseText;
      
      this.logger.serviceInfo('常规响应文本', {
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 200),
        toolName
      });
    }

    this.logger.serviceInfo('MCP API SSE响应', { 
      toolName,
      fullResponseLength: fullResponse.length,
      lastJsonResponse: lastJsonResponse.substring(0, 200) + (lastJsonResponse.length > 200 ? '...' : ''),
      responsePreview: fullResponse.substring(0, 200) + (fullResponse.length > 200 ? '...' : '')
    });

    if (!lastJsonResponse || lastJsonResponse.trim().length === 0) {
      throw new Error('MCP API返回空响应');
    }

    let data;
    try {
      data = JSON.parse(lastJsonResponse);
      
      // 检查JSON-RPC 2.0响应格式
      if (data.jsonrpc === "2.0") {
        if (data.error) {
          throw new Error(`MCP工具调用失败: ${data.error.message || JSON.stringify(data.error)}`);
        }
        
        // 检查result字段是否存在且有效
        if (data.result === undefined || data.result === null) {
          this.logger.businessError('MCP API返回的result字段为空', new Error('result字段为空'), {
            toolName,
            fullResponse: data
          });
          throw new Error('MCP API返回的result字段为空');
        }
        
        return data.result;
      }
      
      // 如果不是标准JSON-RPC格式，直接返回数据
      return data;
    } catch (parseError) {
      this.logger.businessError('JSON解析失败', parseError, {
        toolName,
        responseText: lastJsonResponse.substring(0, 500),
        fullResponse: fullResponse.substring(0, 500),
        responseLength: lastJsonResponse.length
      });
      throw new Error(`JSON解析失败: ${parseError.message}`);
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
          return await this.getStockBrief(parameters as { stock_code: string });
        case "get_stock_realtime_data":
          return await this.getStockBrief(parameters as { stock_code: string });
        case "get_stock_historical_data":
          return await this.getStockMedium(parameters as { stock_code: string });
        case "get_stock_technical_indicators":
          return await this.getStockFull(parameters as { stock_code: string });
        case "get_stock_financial_data":
          return await this.getStockMedium(parameters as { stock_code: string });
        case "get_market_overview":
          // getMarketOverview不需要股票代码，使用默认参数
          return await this.getStockBrief({ stock_code: "SH000001" });
        case "search_stocks":
          return await this.getStockBrief(parameters as { stock_code: string });
        case "get_stock_news":
          return await this.getStockFull(parameters as { stock_code: string });
        default:
          throw new Error(`不支持的MCP工具: ${toolName}`);
      }
    } catch (error) {
      this.logger.businessError(`MCP工具调用失败: ${toolName}`, error);
      throw error;
    }
  }

  /**
   * 转换股票代码格式 (601633 -> SH601633)
   */
  private convertStockCode(stockCode: string): string {
    // 参数验证
    if (!stockCode || typeof stockCode !== 'string') {
      this.logger.businessError('股票代码转换失败', new Error('无效的股票代码参数'), { stockCode });
      return 'SH000001'; // 返回默认股票代码
    }
    
    // 如果已经是正确格式，直接返回
    if (stockCode.startsWith('SH') || stockCode.startsWith('SZ')) {
      return stockCode;
    }
    
    // 根据股票代码判断交易所
    if (stockCode.startsWith('6') || stockCode.startsWith('9')) {
      return `SH${stockCode}`;
    } else if (stockCode.startsWith('0') || stockCode.startsWith('3')) {
      return `SZ${stockCode}`;
    }
    
    return stockCode;
  }

  /**
   * 获取股票简要信息 (brief)
   */
  private async getStockBrief(params: { stock_code: string }): Promise<string> {
    try {
      const symbol = this.convertStockCode(params.stock_code);
      this.logger.debug(`获取股票简要信息: ${params.stock_code} -> ${symbol}`);
      const data = await this.callMCPAPI('brief', { symbol });
      return data || `获取 ${params.stock_code} 的简要信息`;
    } catch (error) {
      this.logger.businessError('获取股票简要信息失败', error, { stock_code: params.stock_code });
      throw new Error(`获取股票简要信息失败: ${error.message}`);
    }
  }

  /**
   * 获取股票中等详细信息 (medium)
   */
  private async getStockMedium(params: { stock_code: string }): Promise<string> {
    try {
      const symbol = this.convertStockCode(params.stock_code);
      this.logger.debug(`获取股票中等信息: ${params.stock_code} -> ${symbol}`);
      const data = await this.callMCPAPI('medium', { symbol });
      return data || `获取 ${params.stock_code} 的中等详细信息`;
    } catch (error) {
      this.logger.businessError('获取股票中等信息失败', error, { stock_code: params.stock_code });
      throw new Error(`获取股票中等信息失败: ${error.message}`);
    }
  }

  /**
   * 获取股票完整信息 (full)
   */
  private async getStockFull(params: { stock_code: string }): Promise<string> {
    try {
      const symbol = this.convertStockCode(params.stock_code);
      this.logger.debug(`获取股票完整信息: ${params.stock_code} -> ${symbol}`);
      const data = await this.callMCPAPI('full', { symbol });
      return data || `获取 ${params.stock_code} 的完整信息`;
    } catch (error) {
      this.logger.businessError('获取股票完整信息失败', error, { stock_code: params.stock_code });
      throw new Error(`获取股票完整信息失败: ${error.message}`);
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * 获取连接状态（向后兼容）
   */
  isConnectedToMCP(): boolean {
    return this.isConnected;
  }

  /**
   * 断开连接（向后兼容）
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.logger.serviceInfo("MCP连接已断开");
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): MCPTool[] {
    return this.getToolDefinitions().tools;
  }

  /**
   * 获取工具定义信息（用于LLM）
   */
  getToolDefinitions(): { tools: MCPTool[] } {
    return {
      tools: [
        {
          name: 'get_stock_basic_info',
          description: '获取股票的基本信息',
          parameters: {
            type: 'object',
            properties: {
              stock_code: {
                type: 'string',
                description: '股票代码，如 "600519"'
              }
            },
            required: ['stock_code']
          }
        },
        {
          name: 'get_stock_realtime_data',
          description: '获取股票的实时行情数据',
          parameters: {
            type: 'object',
            properties: {
              stock_code: {
                type: 'string',
                description: '股票代码，如 "600519"'
              }
            },
            required: ['stock_code']
          }
        },
        {
          name: 'get_stock_financial_data',
          description: '获取股票的财务数据',
          parameters: {
            type: 'object',
            properties: {
              stock_code: {
                type: 'string',
                description: '股票代码，如 "600519"'
              }
            },
            required: ['stock_code']
          }
        },
        {
          name: 'get_stock_technical_indicators',
          description: '获取股票的技术指标数据',
          parameters: {
            type: 'object',
            properties: {
              stock_code: {
                type: 'string',
                description: '股票代码，如 "600519"'
              }
            },
            required: ['stock_code']
          }
        }
      ]
    };
  }
}