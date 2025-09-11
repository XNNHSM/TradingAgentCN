import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {SSEClientTransport} from '@modelcontextprotocol/sdk/client/sse.js';
import {BusinessLogger, LogCategory} from '../../common/utils/business-logger.util';

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
   * 解析Markdown格式的响应
   */
  private parseMarkdownResponse(textContent: string, toolName: string): any {
    if (!textContent || typeof textContent !== 'string') {
      return null;
    }

    // 根据工具名称使用不同的解析策略
    switch (toolName) {
      case 'get_stock_basic_info':
      case 'get_stock_realtime_data':
        return this.parseStockBasicInfo(textContent);
      
      case 'get_stock_financial_data':
        return this.parseStockFinancialData(textContent);
      
      case 'get_stock_historical_data':
      case 'get_stock_technical_indicators':
        return this.parseStockDataWithTable(textContent);
      
      case 'get_stock_news':
        return this.parseStockNews(textContent);
      
      case 'get_market_overview':
        return this.parseMarketOverview(textContent);
      
      default:
        return this.parseGenericMarkdown(textContent);
    }
  }

  /**
   * 解析股票基本信息（Markdown格式）
   */
  private parseStockBasicInfo(textContent: string): any {
    try {
      const result: any = {};
      
      // 如果文本内容为空或无效，返回null
      if (!textContent || textContent.trim() === '') {
        return null;
      }
      
      // 尝试多种格式的解析
      
      // 格式1：标准Markdown格式（包含# 基本数据）
      const basicSection = textContent.match(/# 基本数据\s*\n([\s\S]*?)(?=\n# |\n## |\Z)/);
      if (basicSection) {
        const basicContent = basicSection[1];
        
        // 提取股票代码 - 多种可能的格式
        const stockCodeMatch = basicContent.match(/- 股票代码:\s*([^\n]+)/) ||
                              basicContent.match(/股票代码[：:]\s*([^\n]+)/) ||
                              basicContent.match(/代码[：:]\s*([^\n]+)/);
        if (stockCodeMatch) result.stock_code = stockCodeMatch[1].trim();
        
        // 提取股票名称 - 多种可能的格式
        const stockNameMatch = basicContent.match(/- 股票名称:\s*([^\n]+)/) ||
                              basicContent.match(/股票名称[：:]\s*([^\n]+)/) ||
                              basicContent.match(/名称[：:]\s*([^\n]+)/);
        if (stockNameMatch) result.stock_name = stockNameMatch[1].trim();
        
        // 提取数据日期
        const dateMatch = basicContent.match(/- 数据日期:\s*([^\n]+)/) ||
                         basicContent.match(/日期[：:]\s*([^\n]+)/);
        if (dateMatch) result.date = dateMatch[1].trim();
        
        // 提取行业概念
        const industryMatch = basicContent.match(/- 行业概念:\s*([^\n]+)/) ||
                             basicContent.match(/行业[：:]\s*([^\n]+)/);
        if (industryMatch) result.industry = industryMatch[1].trim();
      }
      
      // 格式2：如果没有找到标准格式，尝试直接搜索
      if (!result.stock_code || !result.stock_name) {
        // 直接在整个文本中搜索
        const stockCodeMatch = textContent.match(/股票代码[：:]\s*([^\n]+)/) ||
                              textContent.match(/代码[：:]\s*([^\n]+)/);
        if (stockCodeMatch && !result.stock_code) result.stock_code = stockCodeMatch[1].trim();
        
        const stockNameMatch = textContent.match(/股票名称[：:]\s*([^\n]+)/) ||
                              textContent.match(/名称[：:]\s*([^\n]+)/);
        if (stockNameMatch && !result.stock_name) result.stock_name = stockNameMatch[1].trim();
      }
      
      // 解析交易数据部分
      const tradingSection = textContent.match(/# 交易数据\s*\n([\s\S]*?)(?=\n# |\n## |\Z)/) ||
                           textContent.match(/# 交易信息\s*\n([\s\S]*?)(?=\n# |\n## |\Z)/);
      if (tradingSection) {
        const tradingContent = tradingSection[1];
        
        // 提取价格信息 - 多种可能的格式
        const priceMatch = tradingContent.match(/- 当日:\s*([\d.]+)/) ||
                          tradingContent.match(/当前价格[：:]\s*([\d.]+)/) ||
                          tradingContent.match(/价格[：:]\s*([\d.]+)/) ||
                          tradingContent.match(/现价[：:]\s*([\d.]+)/);
        if (priceMatch) result.price = parseFloat(priceMatch[1]);
        
        // 提取最高价
        const highMatch = tradingContent.match(/最高:\s*([\d.]+)/) ||
                         tradingContent.match(/最高价[：:]\s*([\d.]+)/);
        if (highMatch) result.high = parseFloat(highMatch[1]);
        
        // 提取最低价
        const lowMatch = tradingContent.match(/最低:\s*([\d.]+)/) ||
                        tradingContent.match(/最低价[：:]\s*([\d.]+)/);
        if (lowMatch) result.low = parseFloat(lowMatch[1]);
        
        // 提取成交量
        const volumeMatch = tradingContent.match(/- 成交量:\s*([^\n]+)/) ||
                           tradingContent.match(/成交量[：:]\s*([^\n]+)/);
        if (volumeMatch) result.volume = volumeMatch[1].trim();
        
        // 提取成交额
        const amountMatch = tradingContent.match(/- 成交额:\s*([^\n]+)/) ||
                           tradingContent.match(/成交额[：:]\s*([^\n]+)/);
        if (amountMatch) result.amount = amountMatch[1].trim();
        
        // 提取市值
        const marketCapMatch = tradingContent.match(/- 总市值:\s*([^\n]+)/) ||
                              tradingContent.match(/市值[：:]\s*([^\n]+)/);
        if (marketCapMatch) result.market_cap = marketCapMatch[1].trim();
      }
      
      // 如果仍然没有找到基本信息，尝试在整个文本中查找价格信息
      if (!result.price) {
        const priceMatch = textContent.match(/(\d+\.?\d*)/);
        if (priceMatch) {
          result.price = parseFloat(priceMatch[1]);
        }
      }
      
      // 如果至少有股票代码，就返回结果（允许部分数据缺失）
      if (result.stock_code) {
        // 设置默认值
        if (!result.stock_name) result.stock_name = result.stock_code;
        if (!result.price) result.price = 0;
        
        this.logger.serviceInfo('股票基本信息解析成功', {
          股票代码: result.stock_code,
          股票名称: result.stock_name,
          价格: result.price,
          完整字段: Object.keys(result)
        });
        
        return result;
      }
      
      this.logger.businessError('无法解析股票基本信息', new Error('缺少必要字段'), {
        文本预览: textContent.substring(0, 200),
        解析结果: result
      });
      
      return null;
    } catch (error) {
      this.logger.businessError('解析股票基本信息失败', error, {
        文本预览: textContent.substring(0, 200)
      });
      return null;
    }
  }

  /**
   * 解析股票财务数据（Markdown格式）
   */
  private parseStockFinancialData(textContent: string): any {
    try {
      const result: any = { data: {} };
      
      // 尝试解析表格数据
      const tableMatches = textContent.match(/\|([^|]+)\|([^|]+)\|([^|]+)\|/g);
      if (tableMatches) {
        const financialData: any = {};
        
        tableMatches.forEach(match => {
          const [, indicator, year2023, year2022] = match.split('|').map(s => s.trim());
          if (indicator && indicator !== '指标' && indicator !== '---') {
            financialData[indicator] = {
              '2023': year2023 !== '-' ? year2022 : null,
              '2022': year2022 !== '-' ? year2022 : null
            };
          }
        });
        
        if (Object.keys(financialData).length > 0) {
          result.data = financialData;
          return result;
        }
      }
      
      // 如果没有表格，尝试解析列表格式
      const listMatches = textContent.match(/- ([^:]+):\s*([^\n]+)/g);
      if (listMatches) {
        const financialData: any = {};
        
        listMatches.forEach(match => {
          const [, key, value] = match.match(/- ([^:]+):\s*([^\n]+)/) || [];
          if (key && value) {
            financialData[key.trim()] = value.trim();
          }
        });
        
        if (Object.keys(financialData).length > 0) {
          result.data = financialData;
          return result;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.businessError('解析股票财务数据失败', error);
      return null;
    }
  }

  /**
   * 解析包含表格的股票数据
   */
  private parseStockDataWithTable(textContent: string): any {
    try {
      const result: any = { data: [] };
      
      // 解析表格数据
      const lines = textContent.split('\n');
      const tableStart = lines.findIndex(line => line.includes('|'));
      
      if (tableStart !== -1) {
        // 找到表头
        const headerLine = lines[tableStart];
        const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
        
        // 找到数据行
        const dataLines = lines.slice(tableStart + 2).filter(line => line.includes('|') && !line.includes('---'));
        
        const tableData = dataLines.map(line => {
          const values = line.split('|').map(v => v.trim()).filter(v => v);
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        });
        
        if (tableData.length > 0) {
          result.data = tableData;
          return result;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.businessError('解析表格数据失败', error);
      return null;
    }
  }

  /**
   * 解析股票新闻
   */
  private parseStockNews(textContent: string): any {
    try {
      const result: any = { news: [] };
      
      // 如果文本内容为空或无效，返回null
      if (!textContent || textContent.trim() === '') {
        return null;
      }
      
      // 先尝试标准的新闻格式解析
      const newsItems = textContent.match(/\d+\. [^\n]+\n[^\n]+/g);
      if (newsItems) {
        const news = newsItems.map(item => {
          const titleMatch = item.match(/\d+\. ([^\n]+)/);
          const dateMatch = item.match(/日期[：:]\s*([^\n]+)/);
          
          return {
            title: titleMatch ? titleMatch[1].trim() : '',
            date: dateMatch ? dateMatch[1].trim() : '',
            content: item.trim()
          };
        });
        
        result.news = news;
        return result;
      }
      
      // 如果没有找到标准新闻格式，尝试从基本信息中提取相关信息
      // 查找可能的新闻关键词或相关信息
      const newsKeywords = [
        '公告', '新闻', '报道', '消息', '资讯', '动态', 
        '重大', '利好', '利空', '收购', '并购', '投资', '融资'
      ];
      
      const lines = textContent.split('\n');
      const newsLines = lines.filter(line => 
        newsKeywords.some(keyword => line.includes(keyword))
      );
      
      if (newsLines.length > 0) {
        const news = newsLines.map(line => {
          // 清理格式
          const cleanLine = line.replace(/^[-*#]\s*/, '').trim();
          return {
            title: cleanLine.substring(0, 50) + (cleanLine.length > 50 ? '...' : ''),
            date: new Date().toISOString().split('T')[0], // 使用当前日期
            content: cleanLine,
            source: 'company_info'
          };
        });
        
        result.news = news;
        return result;
      }
      
      // 如果仍然没有找到新闻信息，返回一个默认的新闻对象
      // 包含从基本信息中提取的公司信息
      const stockInfo = this.parseStockBasicInfo(textContent);
      if (stockInfo) {
        result.news = [{
          title: `${stockInfo.stock_name || '公司'}基本信息`,
          date: stockInfo.date || new Date().toISOString().split('T')[0],
          content: `公司代码：${stockInfo.stock_code}，公司名称：${stockInfo.stock_name || ''}，所属行业：${stockInfo.industry || '未知'}`,
          source: 'basic_info'
        }];
        return result;
      }
      
      // 最后的备选方案：返回基本信息作为新闻
      result.news = [{
        title: '公司信息',
        date: new Date().toISOString().split('T')[0],
        content: textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''),
        source: 'raw_content'
      }];
      
      return result;
    } catch (error) {
      this.logger.businessError('解析股票新闻失败', error, {
        文本预览: textContent.substring(0, 200)
      });
      return null;
    }
  }

  /**
   * 解析市场概况
   */
  private parseMarketOverview(textContent: string): any {
    try {
      const result: any = {};
      
      // 解析主要指数
      const indicesMatches = textContent.match(/- ([^:]+):\s*([^\n]+)/g);
      if (indicesMatches) {
        const majorIndices: any = {};
        indicesMatches.forEach(match => {
          const [, index, value] = match.match(/- ([^:]+):\s*([^\n]+)/) || [];
          if (index && value) {
            majorIndices[index.trim()] = value.trim();
          }
        });
        result.major_indices = majorIndices;
      }
      
      // 解析市场趋势
      const trendMatch = textContent.match(/市场趋势[：:]\s*([^\n]+)/);
      if (trendMatch) result.market_trend = trendMatch[1].trim();
      
      return result;
    } catch (error) {
      this.logger.businessError('解析市场概况失败', error);
      return null;
    }
  }

  /**
   * 通用Markdown解析器
   */
  private parseGenericMarkdown(textContent: string): any {
    try {
      const result: any = {};
      
      // 解析所有键值对
      const keyValueMatches = textContent.match(/- ([^:]+):\s*([^\n]+)/g);
      if (keyValueMatches) {
        keyValueMatches.forEach(match => {
          const [, key, value] = match.match(/- ([^:]+):\s*([^\n]+)/) || [];
          if (key && value) {
            result[key.trim()] = value.trim();
          }
        });
      }
      
      return Object.keys(result).length > 0 ? result : null;
    } catch (error) {
      this.logger.businessError('通用Markdown解析失败', error);
      return null;
    }
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
      'get_market_overview': ['symbol'],
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

      this.logger.debug(LogCategory.SERVICE_INFO, `映射MCP工具调用`, '', {
        toolName,
        originalParams: parameters,
        mapping: 'starting'
      });

      switch (toolName) {
        case "get_stock_basic_info":
        case "get_stock_realtime_data":
        case "search_stocks":
          mcpToolName = "brief";
          mcpParams = { symbol: this.convertStockCode(parameters.stock_code) };
          this.logger.debug(LogCategory.SERVICE_INFO, `MCP工具映射完成`, '', {
            toolName,
            mcpToolName,
            mcpParams,
            stockCodeConversion: `${parameters.stock_code} -> ${this.convertStockCode(parameters.stock_code)}`
          });
          break;
        
        case "get_market_overview":
          mcpToolName = "brief";
          // 使用传入的symbol参数，如果没有则使用默认值
          mcpParams = { symbol: parameters.symbol || "SH000001" };
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
          this.logger.debug(LogCategory.SERVICE_INFO, `MCP工具映射完成`, '', {
            toolName,
            mcpToolName,
            mcpParams,
            stockCodeConversion: `${parameters.stock_code} -> ${this.convertStockCode(parameters.stock_code)}`
          });
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
          this.logger.debug(LogCategory.SERVICE_INFO, `MCP工具映射完成`, '', {
            toolName,
            mcpToolName,
            mcpParams,
            stockCodeConversion: `${parameters.stock_code} -> ${this.convertStockCode(parameters.stock_code)}`
          });
          break;
        
        case "get_stock_news":
          // 新闻查询使用 brief 工具，因为 full 工具返回的是基本信息而不是新闻
          mcpToolName = "brief";
          mcpParams = { 
            symbol: this.convertStockCode(parameters.stock_code)
          };
          break;
        
        default:
          throw new Error(`不支持的MCP工具: ${toolName}`);
      }

      this.logger.serviceInfo(`映射工具调用`, {
        原始工具: toolName,
        MCP工具: mcpToolName,
        原始参数: parameters,
        MCP参数: mcpParams,
        股票代码转换: `${parameters.stock_code} -> ${mcpParams.symbol}`
      });

      // 调用MCP工具
      const result = await this.client.callTool({
        name: mcpToolName,
        arguments: mcpParams
      });

      this.logger.serviceInfo(`MCP工具调用成功`, {
        工具名称: mcpToolName,
        结果类型: typeof result.content,
        结果长度: Array.isArray(result.content) ? result.content.length : 'N/A',
        股票代码: mcpParams.symbol
      });

      if (Array.isArray(result.content) && result.content.length > 0) {
        // 取第一个内容项的文本
        const firstContent = result.content[0];
        if (firstContent.type === 'text') {
          const textContent = firstContent.text;
          this.logger.serviceInfo(`MCP返回文本内容`, {
            文本长度: textContent.length,
            是否为空: !textContent || textContent.trim() === '',
            文本预览: textContent.substring(0, 100),
            股票代码: mcpParams.symbol
          });
          
          // 检查是否为空内容
          if (!textContent || textContent.trim() === '') {
            this.logger.businessError('MCP API返回空文本内容', new Error('空响应'), {
              工具名称: mcpToolName,
              股票代码: mcpParams.symbol
            });
            throw new Error('MCP API返回空文本内容');
          }
          
          // 尝试解析JSON文本
          try {
            const parsedContent = JSON.parse(textContent);
            this.logger.serviceInfo(`MCP返回JSON解析成功`, {
              解析后类型: typeof parsedContent,
              主要字段: Object.keys(parsedContent || {}),
              股票代码: mcpParams.symbol
            });
            return parsedContent;
          } catch (parseError) {
            // 尝试解析Markdown格式
            const parsedMarkdown = this.parseMarkdownResponse(textContent, toolName);
            if (parsedMarkdown) {
              this.logger.serviceInfo(`MCP返回Markdown解析成功`, {
                解析后类型: typeof parsedMarkdown,
                主要字段: Object.keys(parsedMarkdown || {}),
                股票代码: mcpParams.symbol
              });
              return parsedMarkdown;
            } else {
              this.logger.businessError('MCP返回内容解析失败', parseError, {
                工具名称: mcpToolName,
                股票代码: mcpParams.symbol,
                文本预览: textContent.substring(0, 200)
              });
              
              // 对于解析失败的情况，提供有用的默认值
              switch (toolName) {
                case 'get_stock_basic_info':
                case 'get_stock_realtime_data':
                  // 对于基本信息和实时数据，从参数中构造基本对象
                  return {
                    stock_code: parameters.stock_code,
                    stock_name: parameters.stock_code,
                    price: 0,
                    industry: '未知',
                    market: '未知',
                    source: 'default_fallback'
                  };
                  
                case 'get_stock_news':
                  // 对于新闻，返回默认新闻对象
                  return {
                    news: [{
                      title: `${parameters.stock_code} 相关信息`,
                      date: new Date().toISOString().split('T')[0],
                      content: `未能获取到 ${parameters.stock_code} 的相关新闻信息`,
                      source: 'default_fallback'
                    }]
                  };
                  
                case 'get_stock_financial_data':
                  // 对于财务数据，返回空数据结构
                  return {
                    data: {},
                    message: '财务数据获取失败，使用默认值',
                    source: 'default_fallback'
                  };
                  
                case 'get_stock_historical_data':
                case 'get_stock_technical_indicators':
                  // 对于历史数据和技术指标，返回空数组
                  return {
                    data: [],
                    message: '数据获取失败，使用默认值',
                    source: 'default_fallback'
                  };
                  
                case 'get_market_overview':
                  // 对于市场概况，返回基本结构
                  return {
                    market_trend: '未知',
                    major_indices: {},
                    message: '市场概况获取失败，使用默认值',
                    source: 'default_fallback'
                  };
                  
                default:
                  // 对于其他工具，返回原始文本
                  return {
                    content: textContent,
                    message: '内容解析失败，返回原始文本',
                    source: 'default_fallback'
                  };
              }
            }
          }
        }
      }

      // 如果不是文本类型，尝试直接解析content对象
      try {
        const parsedContent = result.content;
        this.logger.serviceInfo(`MCP返回内容对象`, {
          内容类型: typeof parsedContent,
          主要字段: Object.keys(parsedContent || {})
        });
        return parsedContent;
      } catch (parseError) {
        this.logger.businessError('MCP内容解析失败', parseError);
        throw new Error('MCP API返回的内容无法解析');
      }

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