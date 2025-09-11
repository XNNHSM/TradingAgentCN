import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {SSEClientTransport} from '@modelcontextprotocol/sdk/client/sse.js';
import {BusinessLogger} from '../../common/utils/business-logger.util';

@Injectable()
export class MCPClientSDKService {
  private readonly logger = new BusinessLogger(MCPClientSDKService.name);
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  /**
   * 初始化MCP客户端连接
   */
  async initialize(): Promise<void> {
    try {
      this.logger.serviceInfo("正在初始化MCP SDK客户端连接...");
      
      // 验证MCP专用API密钥
      const apiKey = this.configService.get<string>("MCP_API_KEY");
      if (!apiKey || apiKey.trim() === '') {
        throw new Error("MCP_API_KEY 环境变量未设置或为空");
      }

      // 创建MCP客户端
      this.client = new Client(
        {
          name: "TradingAgentCN",
          version: "1.0.0"
        },
        {
          capabilities: {
            roots: {
              listChanged: true
            },
            sampling: {}
          }
        }
      );

      // 创建SSE transport
      const url = new URL('https://dashscope.aliyuncs.com/api/v1/mcps/qtf_mcp/sse');
      
      this.transport = new SSEClientTransport(url, {
        requestInit: {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      });

      // 连接到服务器
      await this.client.connect(this.transport);
      
      this.isConnected = true;
      this.logger.serviceInfo("MCP SDK客户端连接成功");

    } catch (error) {
      this.logger.businessError("MCP SDK客户端初始化失败", error);
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
   * 验证MCP工具调用参数
   */
  private validateToolParameters(toolName: string, parameters: Record<string, any>): void {
    const validationRules = {
      'get_stock_basic_info': ['stock_code'],
      'get_stock_realtime_data': ['stock_code'],
      'get_stock_historical_data': ['stock_code', 'start_date', 'end_date'],
      'get_stock_technical_indicators': ['stock_code', 'indicators', 'start_date', 'end_date'],
      'get_stock_financial_data': ['stock_code'],
      'get_stock_news': [],
      'get_market_overview': [],
      'search_stocks': ['keyword']
    };

    const requiredParams = validationRules[toolName] || [];
    const missingParams = requiredParams.filter(param => !parameters[param]);

    if (missingParams.length > 0) {
      throw new Error(`MCP工具 ${toolName} 缺少必需参数: ${missingParams.join(', ')}`);
    }
  }

  /**
   * 调用MCP工具
   */
  async callTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    if (!this.isConnected || !this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('MCP客户端未初始化');
    }

    try {
      this.logger.serviceInfo(`调用MCP工具: ${toolName}`, { parameters });

      // 验证参数
      this.validateToolParameters(toolName, parameters);

      // 根据工具名称映射到MCP服务的实际工具名称
      let mcpToolName: string;
      let mcpParams: Record<string, any>;

      switch (toolName) {
        case "get_stock_basic_info":
        case "get_stock_realtime_data":
        case "search_stocks":
          mcpToolName = "brief";
          mcpParams = { symbol: this.convertStockCode(parameters.stock_code) };
          break;
        
        case "get_market_overview":
          mcpToolName = "brief";
          // getMarketOverview不需要股票代码，使用默认参数
          mcpParams = { symbol: "SH000001" };
          break;
        
        case "get_stock_historical_data":
          mcpToolName = "medium";
          // 对于历史数据，需要添加额外参数
          mcpParams = { 
            symbol: this.convertStockCode(parameters.stock_code),
            start_date: parameters.start_date,
            end_date: parameters.end_date,
            period: parameters.period || 'daily'
          };
          break;
        
        case "get_stock_financial_data":
          mcpToolName = "medium";
          mcpParams = { 
            symbol: this.convertStockCode(parameters.stock_code),
            report_type: parameters.report_type || 'annual',
            period: parameters.period || '2023'
          };
          break;
        
        case "get_stock_technical_indicators":
          mcpToolName = "full";
          mcpParams = { 
            symbol: this.convertStockCode(parameters.stock_code),
            indicators: parameters.indicators,
            start_date: parameters.start_date,
            end_date: parameters.end_date
          };
          break;
        
        case "get_stock_news":
          mcpToolName = "full";
          mcpParams = { 
            symbol: this.convertStockCode(parameters.stock_code),
            keyword: parameters.keyword,
            start_date: parameters.start_date,
            end_date: parameters.end_date,
            limit: parameters.limit || 10
          };
          break;
        
        default:
          throw new Error(`不支持的MCP工具: ${toolName}`);
      }

      this.logger.serviceInfo(`映射工具调用`, {
        原始工具: toolName,
        MCP工具: mcpToolName,
        原始参数: parameters,
        MCP参数: mcpParams
      });

      // 调用MCP工具
      const result = await this.client.callTool({
        name: mcpToolName,
        arguments: mcpParams
      });

      this.logger.serviceInfo(`MCP工具调用成功`, {
        工具名称: mcpToolName,
        结果类型: typeof result.content,
        结果长度: Array.isArray(result.content) ? result.content.length : 'N/A'
      });

      if (Array.isArray(result.content) && result.content.length > 0) {
        // 取第一个内容项的文本
        const firstContent = result.content[0];
        if (firstContent.type === 'text') {
          const textContent = firstContent.text;
          this.logger.serviceInfo(`MCP返回文本内容`, {
            文本长度: textContent.length,
            是否为空: !textContent || textContent.trim() === ''
          });
          
          // 检查是否为空内容
          if (!textContent || textContent.trim() === '') {
            throw new Error('MCP API返回空文本内容');
          }
          
          return textContent;
        }
      }

      const jsonContent = JSON.stringify(result.content);
      this.logger.serviceInfo(`MCP返回JSON内容`, {
        JSON长度: jsonContent.length,
        是否为空: !jsonContent || jsonContent.trim() === '' || jsonContent === '[]'
      });
      
      // 检查是否为空JSON
      if (!jsonContent || jsonContent.trim() === '' || jsonContent === '[]' || jsonContent === '[{}]') {
        throw new Error('MCP API返回空JSON内容');
      }

      return jsonContent;

    } catch (error) {
      this.logger.businessError(`MCP工具调用失败: ${toolName}`, error, { parameters });
      throw error;
    }
  }

  /**
   * 获取可用工具列表
   */
  async getAvailableTools() {
    if (!this.isConnected || !this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('MCP客户端未初始化');
    }

    try {
      const toolsList = await this.client.listTools();
      this.logger.serviceInfo('获取可用工具列表', {
        工具数量: toolsList.tools.length,
        工具名称: toolsList.tools.map(t => t.name)
      });
      
      return toolsList.tools;
    } catch (error) {
      this.logger.businessError('获取工具列表失败', error);
      throw error;
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client && this.transport) {
        await this.client.close();
        this.isConnected = false;
        this.logger.serviceInfo("MCP SDK连接已断开");
      }
    } catch (error) {
      this.logger.businessError("断开MCP连接失败", error);
      throw error;
    }
  }

  /**
   * 向后兼容方法
   */
  isConnectedToMCP(): boolean {
    return this.isConnected;
  }

  /**
   * 获取工具定义信息（用于LLM）
   */
  getToolDefinitions() {
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