import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { decode } from "iconv-lite";
import { BusinessLogger } from "../../common/utils/business-logger.util";
import {
  IStockDataService,
  RealTimeStockData,
  HistoricalStockData,
  TechnicalIndicators,
  StockBasicInfo,
  MarketOverview,
  StockDataQuery,
  Exchange,
  KLineType,
} from "../../common/interfaces/stock-data.interface";

/**
 * 股票数据服务 - 直接集成多数据源的实现
 * - 腾讯股票API: 获取股票基本信息和实时数据
 * - 东方财富API: 获取资金流向和市场概览数据
 */
@Injectable()
export class StockDataService implements IStockDataService, OnModuleInit {
  private readonly logger = new BusinessLogger(StockDataService.name);

  /** 腾讯股票API配置 */
  private readonly tencentConfig = {
    searchUrl: "https://proxy.finance.qq.com/ifzqgtimg/appstock/smartbox/search/get",
    stockDataUrl: "https://qt.gtimg.cn/q=",
    realtimeUrl: "https://qt.gtimg.cn/q=",
  };

  /** 东方财富API配置 */
  private readonly eastmoneyConfig = {
    baseUrl: "https://data.eastmoney.com",
    realtimeUrl: "https://push2.eastmoney.com/api/qt/stock/get",
    historyUrl: "https://push2his.eastmoney.com/api/qt/stock/kline/get",
    fundFlowUrl: "https://data.eastmoney.com/dataapi/bkzj/getbkzj",
  };

  /** 缓存控制 */
  private readonly enableCache: boolean;
  private readonly enableFileCache: boolean;

  constructor(private readonly configService: ConfigService) {
    // 从环境变量读取缓存配置
    this.enableCache = this.configService.get<boolean>("ENABLE_CACHE", false);
    this.enableFileCache = this.configService.get<boolean>("STOCK_ENABLE_FILE_CACHE", false);
  }

  /**
   * 模块初始化
   */
  async onModuleInit() {
    this.logger.serviceInfo("股票数据服务初始化完成");
    this.logger.serviceInfo(`缓存配置: ENABLE_CACHE=${this.enableCache}, STOCK_ENABLE_FILE_CACHE=${this.enableFileCache}`);
  }

  /**
   * 获取实时股票数据 - 使用腾讯API
   */
  async getRealTimeData(stockCode: string): Promise<RealTimeStockData> {
    const startTime = Date.now();
    const fullCode = this.convertToTencentCode(stockCode);
    const url = `${this.tencentConfig.realtimeUrl}${fullCode}`;

    try {
      this.logComplex(
        JSON.stringify({
          category: "HTTP_REQUEST",
          message: JSON.stringify({
            method: "GET",
            url: url,
            params: { stockCode, fullCode },
            operation: "获取实时数据",
          }),
          url: url,
        }),
      );

      const response = await this.fetchWithTimeout(url, 8000);
      const endTime = Date.now();

      if (!response.ok) {
        this.logComplex(
          JSON.stringify({
            category: "HTTP_ERROR",
            message: JSON.stringify({
              status: response.status,
              error: `HTTP错误: ${response.status}`,
              duration: `${endTime - startTime}ms`,
            }),
            url: url,
          }),
        );
        throw new Error(`腾讯股票API HTTP错误: ${response.status}`);
      }

      // 腾讯API返回的是GBK编码的文本数据
      const arrayBuffer = await response.arrayBuffer();
      const text = decode(Buffer.from(arrayBuffer), "GBK");

      this.logComplex(
        JSON.stringify({
          category: "HTTP_RESPONSE",
          message: JSON.stringify({
            status: response.status,
            dataSize: text.length,
            duration: `${endTime - startTime}ms`,
            hasValidData: text.includes("="),
          }),
          url: url,
        }),
      );

      return this.parseTencentRealTimeData(text, stockCode);
    } catch (error) {
      this.logComplex(
        JSON.stringify({
          category: "BUSINESS_ERROR",
          message: JSON.stringify({
            operation: "获取实时数据",
            stockCode: stockCode,
            error: error.message,
            duration: `${Date.now() - startTime}ms`,
          }),
          url: url,
        }),
      );
      throw new Error(`获取股票 ${stockCode} 实时数据失败: ${error.message}`);
    }
  }

  /**
   * 获取历史股票数据 - 使用东方财富API
   */
  async getHistoricalData(query: StockDataQuery): Promise<HistoricalStockData> {
    const startTime = Date.now();
    const marketCode = this.getMarketCode(query.code);
    const fullCode = `${marketCode}${query.code}`;
    const klt = this.convertKLineTypeToEastmoney(query.klineType || KLineType.DAILY);
    const limit = query.limit || 800;
    
    const url = `${this.eastmoneyConfig.historyUrl}?ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=${klt}&fqt=1&secid=${fullCode}&lmt=${limit}`;

    try {
      this.logComplex(
        JSON.stringify({
          category: "HTTP_REQUEST",
          message: JSON.stringify({
            method: "GET",
            url: url,
            params: { stockCode: query.code, klineType: query.klineType, limit, fullCode },
            operation: "获取历史数据",
          }),
          url: url,
        }),
      );

      const response = await this.fetchWithTimeout(url, 10000);
      const endTime = Date.now();

      if (!response.ok) {
        this.logComplex(
          JSON.stringify({
            category: "HTTP_ERROR",
            message: JSON.stringify({
              status: response.status,
              error: `HTTP错误: ${response.status}`,
              duration: `${endTime - startTime}ms`,
            }),
            url: url,
          }),
        );
        throw new Error(`东方财富API HTTP错误: ${response.status}`);
      }

      const data = await response.json();

      this.logComplex(
        JSON.stringify({
          category: "HTTP_RESPONSE",
          message: JSON.stringify({
            status: response.status,
            dataSize: JSON.stringify(data).length,
            recordCount: data?.data?.klines?.length || 0,
            duration: `${endTime - startTime}ms`,
          }),
          url: url,
        }),
      );

      if (!data || !data.data || !data.data.klines || data.rc !== 0) {
        throw new Error(`东方财富API返回空数据: ${JSON.stringify(data)}`);
      }

      return this.parseEastmoneyHistoricalData(data.data, query.code, query.klineType || KLineType.DAILY);
    } catch (error) {
      this.logComplex(
        JSON.stringify({
          category: "BUSINESS_ERROR",
          message: JSON.stringify({
            operation: "获取历史数据",
            stockCode: query.code,
            klineType: query.klineType,
            error: error.message,
            duration: `${Date.now() - startTime}ms`,
          }),
          url: url,
        }),
      );
      throw new Error(`获取股票 ${query.code} 历史数据失败: ${error.message}`);
    }
  }

  /**
   * 获取技术指标 - 基于历史数据计算
   */
  async getTechnicalIndicators(query: StockDataQuery): Promise<TechnicalIndicators> {
    try {
      this.logger.debug(`获取技术指标: ${query.code}`);
      
      // 获取足够的历史数据用于计算技术指标
      const historicalQuery = {
        ...query,
        limit: 200, // 获取200个交易日的数据用于计算
        klineType: KLineType.DAILY,
      };
      
      const historicalData = await this.getHistoricalData(historicalQuery);
      const prices = historicalData.data.map(item => item.close);
      
      return this.calculateTechnicalIndicators(prices, 20);
    } catch (error) {
      this.logger.businessError(`获取技术指标`, error);
      throw new Error(`获取股票 ${query.code} 技术指标失败: ${error.message}`);
    }
  }

  /**
   * 获取市场概览 - 使用东方财富API
   */
  async getMarketOverview(): Promise<MarketOverview> {
    const startTime = Date.now();
    // 获取上证指数数据作为市场概览基础
    const url = `${this.eastmoneyConfig.realtimeUrl}?ut=fa5fd1943c7b386f172d6893dbfba10b&invt=2&fltt=2&fields=f43,f57,f58,f169,f170,f46,f60,f44,f45,f47,f48,f50,f86,f600,f601,f154,f161&secid=1.000001`;

    try {
      this.logComplex(
        JSON.stringify({
          category: "HTTP_REQUEST",
          message: JSON.stringify({
            method: "GET",
            url: url,
            params: { indexCode: "000001" },
            operation: "获取市场概览",
          }),
          url: url,
        }),
      );

      const response = await this.fetchWithTimeout(url, 10000);
      const endTime = Date.now();

      if (!response.ok) {
        this.logComplex(
          JSON.stringify({
            category: "HTTP_ERROR",
            message: JSON.stringify({
              status: response.status,
              error: `HTTP错误: ${response.status}`,
              duration: `${endTime - startTime}ms`,
            }),
            url: url,
          }),
        );
        throw new Error(`东方财富API HTTP错误: ${response.status}`);
      }

      const data = await response.json();

      this.logComplex(
        JSON.stringify({
          category: "HTTP_RESPONSE",
          message: JSON.stringify({
            status: response.status,
            dataSize: JSON.stringify(data).length,
            duration: `${endTime - startTime}ms`,
          }),
          url: url,
        }),
      );

      if (!data || !data.data || data.rc !== 0) {
        throw new Error(`东方财富API响应异常: ${JSON.stringify(data)}`);
      }

      return this.parseEastmoneyMarketData(data.data);
    } catch (error) {
      this.logComplex(
        JSON.stringify({
          category: "BUSINESS_ERROR",
          message: JSON.stringify({
            operation: "获取市场概览",
            error: error.message,
            duration: `${Date.now() - startTime}ms`,
          }),
          url: url,
        }),
      );
      throw new Error(`获取市场概览失败: ${error.message}`);
    }
  }

  /**
   * 获取股票基本信息 - 使用腾讯API
   */
  async getStockBasicInfo(stockCode: string): Promise<StockBasicInfo> {
    try {
      this.logger.debug(`获取股票基本信息: ${stockCode}`);

      const realTimeData = await this.getRealTimeData(stockCode);

      const basicInfo: StockBasicInfo = {
        code: stockCode,
        name: realTimeData.name,
        exchange: this.getExchangeByCode(stockCode),
        exchangeName: this.getExchangeNameByCode(stockCode),
        sector: "未知", // 需要从其他数据源获取
        industry: "未知", // 需要从其他数据源获取
        listDate: new Date(), // 需要从其他数据源获取
        totalShares:
          realTimeData.totalValue && realTimeData.price
            ? Math.floor(realTimeData.totalValue / realTimeData.price)
            : 0,
        floatShares:
          realTimeData.circulationValue && realTimeData.price
            ? Math.floor(realTimeData.circulationValue / realTimeData.price)
            : 0,
      };

      return basicInfo;
    } catch (error) {
      this.logger.businessError(`获取股票基本信息`, error);
      throw new Error(`获取股票 ${stockCode} 基本信息失败: ${error.message}`);
    }
  }

  /**
   * 搜索股票 - 使用腾讯API
   */
  async searchStocks(keyword: string): Promise<StockBasicInfo[]> {
    const startTime = Date.now();
    const url = `${this.tencentConfig.searchUrl}?q=${encodeURIComponent(keyword)}`;

    try {
      this.logComplex(
        JSON.stringify({
          category: "HTTP_REQUEST",
          message: JSON.stringify({
            method: "GET",
            url: url,
            params: { keyword },
            operation: "搜索股票",
          }),
          url: url,
        }),
      );

      const response = await this.fetchWithTimeout(url, 8000);
      const endTime = Date.now();

      if (!response.ok) {
        this.logComplex(
          JSON.stringify({
            category: "HTTP_ERROR",
            message: JSON.stringify({
              status: response.status,
              error: `HTTP错误: ${response.status}`,
              duration: `${endTime - startTime}ms`,
            }),
            url: url,
          }),
        );
        throw new Error(`腾讯股票搜索API HTTP错误: ${response.status}`);
      }

      const data = await response.json();

      this.logComplex(
        JSON.stringify({
          category: "HTTP_RESPONSE",
          message: JSON.stringify({
            status: response.status,
            dataSize: JSON.stringify(data).length,
            resultCount: data?.data?.stock?.length || 0,
            duration: `${endTime - startTime}ms`,
          }),
          url: url,
        }),
      );

      return this.parseTencentSearchResult(data, keyword);
    } catch (error) {
      this.logComplex(
        JSON.stringify({
          category: "BUSINESS_ERROR",
          message: JSON.stringify({
            operation: "搜索股票",
            keyword: keyword,
            error: error.message,
            duration: `${Date.now() - startTime}ms`,
          }),
          url: url,
        }),
      );
      throw new Error(`搜索股票失败: ${error.message}`);
    }
  }

  /**
   * 获取多只股票实时数据 - 使用腾讯API批量接口
   */
  async getBatchRealTimeData(codes: string[]): Promise<RealTimeStockData[]> {
    const startTime = Date.now();
    const fullCodes = codes.map(code => this.convertToTencentCode(code));
    const url = `${this.tencentConfig.stockDataUrl}${fullCodes.join(",")}`;

    try {
      this.logComplex(
        JSON.stringify({
          category: "HTTP_REQUEST",
          message: JSON.stringify({
            method: "GET",
            url: url,
            params: { codes, fullCodes },
            operation: "批量获取实时数据",
          }),
          url: url,
        }),
      );

      const response = await this.fetchWithTimeout(url, 10000);
      const endTime = Date.now();

      if (!response.ok) {
        this.logComplex(
          JSON.stringify({
            category: "HTTP_ERROR",
            message: JSON.stringify({
              status: response.status,
              error: `HTTP错误: ${response.status}`,
              duration: `${endTime - startTime}ms`,
            }),
            url: url,
          }),
        );
        throw new Error(`腾讯股票API HTTP错误: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const text = decode(Buffer.from(arrayBuffer), "GBK");

      this.logComplex(
        JSON.stringify({
          category: "HTTP_RESPONSE",
          message: JSON.stringify({
            status: response.status,
            dataSize: text.length,
            duration: `${endTime - startTime}ms`,
            stockCount: codes.length,
          }),
          url: url,
        }),
      );

      return this.parseTencentBatchRealTimeData(text, codes);
    } catch (error) {
      this.logComplex(
        JSON.stringify({
          category: "BUSINESS_ERROR",
          message: JSON.stringify({
            operation: "批量获取实时数据",
            codes: codes,
            error: error.message,
            duration: `${Date.now() - startTime}ms`,
          }),
          url: url,
        }),
      );
      throw new Error(`批量获取实时数据失败: ${error.message}`);
    }
  }

  /**
   * 检测服务器连接状态
   */
  async checkServerConnection(): Promise<boolean> {
    try {
      // 测试腾讯API连接
      const testUrl = `${this.tencentConfig.realtimeUrl}sz000001`;
      const response = await this.fetchWithTimeout(testUrl, 5000);
      return response.ok;
    } catch (error) {
      this.logger.businessError(`检测连接状态`, error);
      return false;
    }
  }

  /**
   * 清除缓存
   */
  async clearCache(pattern?: string): Promise<void> {
    this.logger.serviceInfo(`当前配置为不使用缓存 (ENABLE_CACHE=${this.enableCache})，无需清除`);
  }

  // ==================== 私有方法 ====================
  
  /**
   * 临时日志方法 - 用于快速替换复杂的日志调用
   */
  private logComplex(data: any): void {
    // 暂时使用简化的日志记录
    console.log(JSON.stringify(data));
  }

  /**
   * 将股票代码转换为腾讯格式
   */
  private convertToTencentCode(stockCode: string): string {
    if (stockCode.startsWith("6")) {
      return `sh${stockCode}`; // 上海证券交易所
    } else {
      return `sz${stockCode}`; // 深圳证券交易所
    }
  }

  /**
   * 获取市场代码 (东方财富格式)
   */
  private getMarketCode(stockCode: string): string {
    if (stockCode.startsWith("6")) {
      return "1."; // 上海证券交易所
    } else if (stockCode.startsWith("0") || stockCode.startsWith("3")) {
      return "0."; // 深圳证券交易所
    } else if (stockCode.startsWith("68")) {
      return "1."; // 科创板
    } else {
      return "0."; // 默认深圳
    }
  }

  /**
   * 将K线类型转换为东方财富格式
   */
  private convertKLineTypeToEastmoney(klineType: KLineType): string {
    switch (klineType) {
      case KLineType.MINUTE:
        return "1";
      case KLineType.MINUTE_5:
        return "5";
      case KLineType.MINUTE_15:
        return "15";
      case KLineType.MINUTE_30:
        return "30";
      case KLineType.HOUR:
        return "60";
      case KLineType.DAILY:
        return "101";
      case KLineType.WEEKLY:
        return "102";
      case KLineType.MONTHLY:
        return "103";
      default:
        return "101";
    }
  }

  /**
   * 根据股票代码判断交易所
   */
  private getExchangeByCode(stockCode: string): Exchange {
    if (
      stockCode.startsWith("600") ||
      stockCode.startsWith("601") ||
      stockCode.startsWith("603") ||
      stockCode.startsWith("605") ||
      stockCode.startsWith("688")
    ) {
      return Exchange.SSE; // 上海证券交易所
    } else if (
      stockCode.startsWith("000") ||
      stockCode.startsWith("002") ||
      stockCode.startsWith("003") ||
      stockCode.startsWith("300")
    ) {
      return Exchange.SZSE; // 深圳证券交易所
    } else {
      return Exchange.SSE; // 默认上海
    }
  }

  /**
   * 根据股票代码获取交易所名称
   */
  private getExchangeNameByCode(stockCode: string): string {
    const exchange = this.getExchangeByCode(stockCode);
    switch (exchange) {
      case Exchange.SSE:
        return "上海证券交易所";
      case Exchange.SZSE:
        return "深圳证券交易所";
      default:
        return "未知交易所";
    }
  }

  /**
   * 带超时的fetch请求
   */
  private async fetchWithTimeout(url: string, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          Referer: "https://finance.qq.com/",
        },
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("请求超时");
      }
      throw error;
    }
  }

  /**
   * 解析腾讯实时数据
   */
  private parseTencentRealTimeData(text: string, stockCode: string): RealTimeStockData {
    // 腾讯API返回格式: v_sh600000="1~平安银行~000001~11.50~11.45~11.50~..."
    try {
      const match = text.match(/="([^"]+)"/);
      if (!match || !match[1]) {
        throw new Error("无法解析腾讯API响应数据");
      }

      const parts = match[1].split("~");
      if (parts.length < 20) {
        throw new Error("腾讯API数据格式不完整");
      }

      // 腾讯API字段映射:
      // 0: 未知, 1: 名称, 2: 代码, 3: 当前价, 4: 昨收价, 5: 今开价
      // 6: 成交量(手), 7: 外盘, 8: 内盘, 9: 买一, 10-13: 买二至买五
      // 14: 卖一, 15-18: 卖二至卖五, 19-23: 买量, 24-28: 卖量
      // 29: 最新成交时间, 30: 涨跌额, 31: 涨跌幅%, 32: 最高价, 33: 最低价
      const current = Number(parts[3] || 0);
      const preClose = Number(parts[4] || 0);
      const change = Number(parts[30] || 0);
      const changePercent = Number(parts[31] || 0);

      return {
        code: stockCode,
        name: parts[1] || `股票${stockCode}`,
        price: current,
        preClose: preClose,
        open: Number(parts[5] || 0),
        high: Number(parts[32] || 0),
        low: Number(parts[33] || 0),
        change: change,
        changePercent: changePercent,
        volume: Number(parts[6] || 0) * 100, // 腾讯返回的是手，转换为股
        turnover: Number(parts[37] || 0) * 10000, // 腾讯返回的是万元，转换为元
        turnoverRate: Number(parts[38] || 0),
        pe: Number(parts[39] || 0),
        pb: Number(parts[46] || 0),
        totalValue: Number(parts[45] || 0) * 10000, // 万元转换为元
        circulationValue: Number(parts[44] || 0) * 10000, // 万元转换为元
        bid1: Number(parts[9] || 0),
        bidVol1: Number(parts[19] || 0),
        ask1: Number(parts[14] || 0),
        askVol1: Number(parts[24] || 0),
        bidPrices: [
          Number(parts[9] || 0),
          Number(parts[10] || 0),
          Number(parts[11] || 0),
          Number(parts[12] || 0),
          Number(parts[13] || 0),
        ],
        bidVolumes: [
          Number(parts[19] || 0),
          Number(parts[20] || 0),
          Number(parts[21] || 0),
          Number(parts[22] || 0),
          Number(parts[23] || 0),
        ],
        askPrices: [
          Number(parts[14] || 0),
          Number(parts[15] || 0),
          Number(parts[16] || 0),
          Number(parts[17] || 0),
          Number(parts[18] || 0),
        ],
        askVolumes: [
          Number(parts[24] || 0),
          Number(parts[25] || 0),
          Number(parts[26] || 0),
          Number(parts[27] || 0),
          Number(parts[28] || 0),
        ],
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`解析腾讯实时数据失败: ${error.message}`);
    }
  }

  /**
   * 解析腾讯批量实时数据
   */
  private parseTencentBatchRealTimeData(text: string, codes: string[]): RealTimeStockData[] {
    try {
      const results: RealTimeStockData[] = [];
      const lines = text.split('\n').filter(line => line.trim());

      for (const line of lines) {
        for (const code of codes) {
          const fullCode = this.convertToTencentCode(code);
          if (line.includes(`v_${fullCode}=`)) {
            try {
              const stockData = this.parseTencentRealTimeData(line, code);
              results.push(stockData);
            } catch (error) {
              this.logger.warn(`解析股票 ${code} 数据失败: ${error.message}`);
            }
            break;
          }
        }
      }

      return results;
    } catch (error) {
      throw new Error(`解析腾讯批量实时数据失败: ${error.message}`);
    }
  }

  /**
   * 解析腾讯搜索结果
   */
  private parseTencentSearchResult(data: any, keyword: string): StockBasicInfo[] {
    try {
      if (!data || !data.data || !data.data.stock) {
        return [];
      }

      const stockListArray = data.data.stock || [];
      
      return stockListArray.map((stockItemArr: string[]) => {
        const stockCode = stockItemArr[1]?.toLowerCase().replace(/^(sh|sz)/, '') || '';
        return {
          code: stockCode,
          name: stockItemArr[2] || '',
          exchange: this.getExchangeByCode(stockCode),
          exchangeName: this.getExchangeNameByCode(stockCode),
          sector: "未知",
          industry: "未知", 
          listDate: new Date(),
          totalShares: 0,
          floatShares: 0,
        };
      });
    } catch (error) {
      this.logger.businessError(`解析腾讯搜索结果`, error);
      return [];
    }
  }

  /**
   * 解析东方财富历史数据
   */
  private parseEastmoneyHistoricalData(
    data: any,
    stockCode: string,
    klineType: KLineType,
  ): HistoricalStockData {
    try {
      const klines = data.klines || [];

      if (!Array.isArray(klines)) {
        throw new Error("无效的历史数据格式");
      }

      const historicalData = klines.map((kline: string) => {
        const parts = kline.split(',');
        return {
          date: new Date(parts[0]),
          open: Number(parts[1] || 0),
          high: Number(parts[2] || 0),
          low: Number(parts[3] || 0),
          close: Number(parts[4] || 0),
          volume: Number(parts[5] || 0),
          turnover: Number(parts[6] || 0),
        };
      });

      return {
        code: stockCode,
        name: data.name || `股票${stockCode}`,
        klineType,
        data: historicalData,
        fetchTime: new Date(),
      };
    } catch (error) {
      throw new Error(`解析东方财富历史数据失败: ${error.message}`);
    }
  }

  /**
   * 解析东方财富市场数据
   */
  private parseEastmoneyMarketData(data: any): MarketOverview {
    try {
      if (!data) {
        throw new Error("无效的市场数据");
      }

      const current = Number(data.f43 || 0);
      const preClose = Number(data.f60 || 0);
      const change = Number(data.f169 || 0);
      const changePercent = Number(data.f170 || 0);

      return {
        shanghaiIndex: {
          value: current,
          change: change,
          changePercent: changePercent,
        },
        shenzhenIndex: {
          value: 0, // 需要单独获取
          change: 0,
          changePercent: 0,
        },
        chinextIndex: {
          value: 0, // 需要单独获取
          change: 0,
          changePercent: 0,
        },
        star50Index: {
          value: 0, // 需要单独获取
          change: 0,
          changePercent: 0,
        },
        totalVolume: Number(data.f47 || 0),
        totalTurnover: Number(data.f48 || 0),
        riseCount: 0, // 需要单独获取
        fallCount: 0, // 需要单独获取
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`解析东方财富市场数据失败: ${error.message}`);
    }
  }

  /**
   * 计算技术指标
   */
  private calculateTechnicalIndicators(prices: number[], period: number): TechnicalIndicators {
    // 计算移动平均线
    const ma5 = this.calculateMA(prices, 5);
    const ma10 = this.calculateMA(prices, 10);
    const ma20 = this.calculateMA(prices, 20);

    // 计算RSI
    const rsi14 = this.calculateSimpleRSI(prices, 14);

    return {
      ma: {
        ma5: ma5.slice(-1), // 返回最新值
        ma10: ma10.slice(-1),
        ma20: ma20.slice(-1),
      },
      rsi: {
        rsi14: rsi14.slice(-1),
      },
      macd: {
        dif: [0], // 简化实现
        dea: [0],
        macd: [0],
      },
      bollinger: {
        upper: ma20.map((v) => v * 1.02), // 简化实现
        middle: ma20,
        lower: ma20.map((v) => v * 0.98),
      },
    };
  }

  /**
   * 计算移动平均线
   */
  private calculateMA(prices: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices
        .slice(i - period + 1, i + 1)
        .reduce((a, b) => a + b, 0);
      result.push(Number((sum / period).toFixed(2)));
    }
    return result;
  }

  /**
   * 计算简单RSI
   */
  private calculateSimpleRSI(prices: number[], period: number): number[] {
    if (prices.length < period + 1) {
      return [50]; // 默认值
    }

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return [100];

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return [Number(rsi.toFixed(2))];
  }
}