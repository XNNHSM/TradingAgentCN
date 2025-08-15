import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  IStockDataService,
  RealTimeStockData,
  HistoricalStockData,
  TechnicalIndicators,
  StockBasicInfo,
  MarketOverview,
  StockDataQuery,
  DataServerConfig,
  CacheConfig,
  Exchange,
  KLineType,
  KLineData,
} from '../../common/interfaces/stock-data.interface';

/**
 * 股票数据服务 - 基于通达信数据源的实现
 */
@Injectable()
export class StockDataService implements IStockDataService, OnModuleInit {
  private readonly logger = new Logger(StockDataService.name);
  
  /** 通达信服务器列表 */
  private readonly servers: DataServerConfig[] = [
    { ip: '115.238.56.198', port: 7709, name: 'TDX-Server-1' },
    { ip: '115.238.90.165', port: 7709, name: 'TDX-Server-2' },
    { ip: '180.153.18.170', port: 7709, name: 'TDX-Server-3' },
    { ip: '119.147.212.81', port: 7709, name: 'TDX-Server-4' },
    { ip: '123.125.108.23', port: 7709, name: 'TDX-Server-5' },
  ];

  /** 当前可用的服务器 */
  private workingServers: DataServerConfig[] = [];
  
  /** 缓存配置 */
  private cacheConfig: CacheConfig;

  /** 股票名称缓存 */
  private stockNameCache: Map<string, string> = new Map();

  /** 常见股票映射 */
  private readonly commonStockMappings: Record<string, string> = {
    '000001': '平安银行',
    '000002': '万科A',
    '600000': '浦发银行',
    '600036': '招商银行',
    '600519': '贵州茅台',
    '000858': '五粮液',
    '002415': '海康威视',
    '300059': '东方财富',
    '600276': '恒瑞医药',
  };

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    // 初始化缓存配置
    this.cacheConfig = {
      realtimeDataTTL: this.configService.get('STOCK_CACHE_REALTIME_TTL', 30), // 30秒
      historicalDataTTL: this.configService.get('STOCK_CACHE_HISTORICAL_TTL', 21600), // 6小时
      basicInfoTTL: this.configService.get('STOCK_CACHE_BASIC_INFO_TTL', 86400), // 24小时
      enableFileCache: this.configService.get('STOCK_ENABLE_FILE_CACHE', true),
      fileCacheDir: this.configService.get('STOCK_FILE_CACHE_DIR', './cache/stock-data'),
    };
  }

  async onModuleInit() {
    this.logger.log('初始化股票数据服务...');
    
    // 创建文件缓存目录
    if (this.cacheConfig.enableFileCache && this.cacheConfig.fileCacheDir) {
      try {
        await fs.mkdir(this.cacheConfig.fileCacheDir, { recursive: true });
        this.logger.log(`文件缓存目录创建成功: ${this.cacheConfig.fileCacheDir}`);
      } catch (error) {
        this.logger.warn(`文件缓存目录创建失败: ${error.message}`);
      }
    }

    // 检测服务器连接
    await this.checkAllServers();
    
    // 预加载常见股票名称
    await this.preloadCommonStockNames();

    this.logger.log('股票数据服务初始化完成');
  }

  /**
   * 获取实时股票数据
   */
  async getRealTimeData(code: string): Promise<RealTimeStockData> {
    const cacheKey = `stock:realtime:${code}`;
    
    try {
      // 尝试从缓存获取
      const cachedData = await this.getFromCache(cacheKey);
      if (cachedData) {
        this.logger.debug(`从缓存获取实时数据: ${code}`);
        return JSON.parse(cachedData);
      }

      // 从数据源获取
      const realTimeData = await this.fetchRealTimeDataFromSource(code);
      
      // 缓存数据
      await this.setCache(cacheKey, JSON.stringify(realTimeData), this.cacheConfig.realtimeDataTTL);
      
      this.logger.debug(`获取实时数据成功: ${code}`);
      return realTimeData;
      
    } catch (error) {
      this.logger.error(`获取实时数据失败: ${code}, ${error.message}`, error.stack);
      throw new Error(`获取股票 ${code} 实时数据失败: ${error.message}`);
    }
  }

  /**
   * 获取多只股票实时数据
   */
  async getBatchRealTimeData(codes: string[]): Promise<RealTimeStockData[]> {
    const promises = codes.map(code => this.getRealTimeData(code));
    const results = await Promise.allSettled(promises);
    
    const successResults: RealTimeStockData[] = [];
    const failedCodes: string[] = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successResults.push(result.value);
      } else {
        failedCodes.push(codes[index]);
        this.logger.warn(`批量获取实时数据失败: ${codes[index]}, ${result.reason.message}`);
      }
    });

    if (failedCodes.length > 0) {
      this.logger.warn(`批量获取数据部分失败，失败股票: ${failedCodes.join(', ')}`);
    }

    return successResults;
  }

  /**
   * 获取历史股票数据
   */
  async getHistoricalData(query: StockDataQuery): Promise<HistoricalStockData> {
    const { code, startDate, endDate, klineType = KLineType.DAILY, limit = 800 } = query;
    
    const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 默认1年前
    const end = endDate || new Date();
    
    const cacheKey = `stock:historical:${code}:${klineType}:${start.toISOString().split('T')[0]}:${end.toISOString().split('T')[0]}`;
    
    try {
      // 尝试从缓存获取
      const cachedData = await this.getFromCache(cacheKey);
      if (cachedData) {
        this.logger.debug(`从缓存获取历史数据: ${code}`);
        return JSON.parse(cachedData, this.dateReviver);
      }

      // 从数据源获取
      const historicalData = await this.fetchHistoricalDataFromSource(code, start, end, klineType, limit);
      
      // 缓存数据
      await this.setCache(cacheKey, JSON.stringify(historicalData), this.cacheConfig.historicalDataTTL);
      
      this.logger.debug(`获取历史数据成功: ${code}, ${historicalData.data.length} 条记录`);
      return historicalData;
      
    } catch (error) {
      this.logger.error(`获取历史数据失败: ${code}, ${error.message}`, error.stack);
      throw new Error(`获取股票 ${code} 历史数据失败: ${error.message}`);
    }
  }

  /**
   * 获取技术指标数据
   */
  async getTechnicalIndicators(query: StockDataQuery): Promise<TechnicalIndicators> {
    const { code } = query;
    const cacheKey = `stock:indicators:${code}`;
    
    try {
      // 尝试从缓存获取
      const cachedData = await this.getFromCache(cacheKey);
      if (cachedData) {
        this.logger.debug(`从缓存获取技术指标: ${code}`);
        return JSON.parse(cachedData);
      }

      // 先获取历史数据
      const historicalData = await this.getHistoricalData(query);
      
      // 计算技术指标
      const indicators = this.calculateTechnicalIndicators(historicalData.data);
      
      // 缓存数据 (技术指标与历史数据同步更新)
      await this.setCache(cacheKey, JSON.stringify(indicators), this.cacheConfig.historicalDataTTL);
      
      this.logger.debug(`计算技术指标成功: ${code}`);
      return indicators;
      
    } catch (error) {
      this.logger.error(`获取技术指标失败: ${code}, ${error.message}`, error.stack);
      throw new Error(`获取股票 ${code} 技术指标失败: ${error.message}`);
    }
  }

  /**
   * 获取股票基本信息
   */
  async getStockBasicInfo(code: string): Promise<StockBasicInfo> {
    const cacheKey = `stock:basic:${code}`;
    
    try {
      // 尝试从缓存获取
      const cachedData = await this.getFromCache(cacheKey);
      if (cachedData) {
        this.logger.debug(`从缓存获取基本信息: ${code}`);
        return JSON.parse(cachedData, this.dateReviver);
      }

      // 获取基本信息
      const basicInfo = await this.fetchStockBasicInfo(code);
      
      // 缓存数据
      await this.setCache(cacheKey, JSON.stringify(basicInfo), this.cacheConfig.basicInfoTTL);
      
      this.logger.debug(`获取基本信息成功: ${code}`);
      return basicInfo;
      
    } catch (error) {
      this.logger.error(`获取基本信息失败: ${code}, ${error.message}`, error.stack);
      throw new Error(`获取股票 ${code} 基本信息失败: ${error.message}`);
    }
  }

  /**
   * 搜索股票
   */
  async searchStocks(keyword: string): Promise<StockBasicInfo[]> {
    try {
      // 在实际实现中，这里应该调用搜索API
      // 目前返回模拟数据
      const results: StockBasicInfo[] = [];
      
      // 搜索逻辑：检查股票代码或名称匹配
      for (const [code, name] of Object.entries(this.commonStockMappings)) {
        if (code.includes(keyword) || name.includes(keyword)) {
          const basicInfo = await this.getStockBasicInfo(code);
          results.push(basicInfo);
        }
      }
      
      return results.slice(0, 10); // 限制返回数量
      
    } catch (error) {
      this.logger.error(`搜索股票失败: ${keyword}, ${error.message}`, error.stack);
      throw new Error(`搜索股票失败: ${error.message}`);
    }
  }

  /**
   * 获取市场概览
   */
  async getMarketOverview(): Promise<MarketOverview> {
    const cacheKey = 'market:overview';
    
    try {
      // 尝试从缓存获取
      const cachedData = await this.getFromCache(cacheKey);
      if (cachedData) {
        this.logger.debug('从缓存获取市场概览');
        return JSON.parse(cachedData, this.dateReviver);
      }

      // 获取市场概览数据
      const overview = await this.fetchMarketOverview();
      
      // 缓存数据 (5分钟)
      await this.setCache(cacheKey, JSON.stringify(overview), 300);
      
      this.logger.debug('获取市场概览成功');
      return overview;
      
    } catch (error) {
      this.logger.error(`获取市场概览失败: ${error.message}`, error.stack);
      throw new Error(`获取市场概览失败: ${error.message}`);
    }
  }

  /**
   * 检测服务器连接状态
   */
  async checkServerConnection(): Promise<boolean> {
    try {
      await this.checkAllServers();
      return this.workingServers.length > 0;
    } catch (error) {
      this.logger.error(`检测服务器连接失败: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * 清除缓存
   */
  async clearCache(pattern?: string): Promise<void> {
    try {
      // Cache manager doesn't support pattern-based clearing
      // For now, we'll reset the entire cache
      await this.cacheManager.reset();
      this.logger.log('清除所有缓存成功');
    } catch (error) {
      this.logger.error(`清除缓存失败: ${error.message}`, error.stack);
      throw new Error(`清除缓存失败: ${error.message}`);
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 检测所有服务器状态
   */
  private async checkAllServers(): Promise<void> {
    this.logger.log('开始检测服务器连接状态...');
    
    const promises = this.servers.map(server => this.checkSingleServer(server));
    const results = await Promise.allSettled(promises);
    
    this.workingServers = [];
    
    results.forEach((result, index) => {
      const server = this.servers[index];
      if (result.status === 'fulfilled' && result.value) {
        this.workingServers.push(server);
        this.logger.log(`服务器连接正常: ${server.name} (${server.ip}:${server.port})`);
      } else {
        this.logger.warn(`服务器连接失败: ${server.name} (${server.ip}:${server.port})`);
      }
    });

    this.logger.log(`可用服务器数量: ${this.workingServers.length}/${this.servers.length}`);
  }

  /**
   * 检测单个服务器状态
   */
  private async checkSingleServer(server: DataServerConfig): Promise<boolean> {
    try {
      // 在实际实现中，这里应该实现TCP连接检测
      // 目前返回模拟结果
      const startTime = Date.now();
      
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      server.latency = Date.now() - startTime;
      server.lastCheckTime = new Date();
      server.available = Math.random() > 0.2; // 80%成功率模拟
      
      return server.available;
    } catch (error) {
      server.available = false;
      server.lastCheckTime = new Date();
      return false;
    }
  }

  /**
   * 预加载常见股票名称
   */
  private async preloadCommonStockNames(): Promise<void> {
    try {
      for (const [code, name] of Object.entries(this.commonStockMappings)) {
        this.stockNameCache.set(code, name);
      }
      this.logger.log(`预加载股票名称成功: ${this.stockNameCache.size} 个`);
    } catch (error) {
      this.logger.warn(`预加载股票名称失败: ${error.message}`);
    }
  }

  /**
   * 从数据源获取实时数据
   */
  private async fetchRealTimeDataFromSource(code: string): Promise<RealTimeStockData> {
    // 在实际实现中，这里应该调用通达信API
    // 目前返回模拟数据
    
    const name = this.stockNameCache.get(code) || await this.fetchStockName(code);
    const exchange = this.determineExchange(code);
    
    return {
      code,
      name,
      price: this.generateMockPrice(code),
      open: this.generateMockPrice(code, 0.98, 1.02),
      high: this.generateMockPrice(code, 1.00, 1.05),
      low: this.generateMockPrice(code, 0.95, 1.00),
      preClose: this.generateMockPrice(code, 0.95, 1.05),
      change: this.generateMockValue(-2, 2, 2),
      changePercent: this.generateMockValue(-0.10, 0.10, 4),
      volume: this.generateMockValue(1000000, 100000000, 0),
      turnover: this.generateMockValue(10000000, 1000000000, 0),
      turnoverRate: this.generateMockValue(0.01, 0.15, 4),
      pe: this.generateMockValue(5, 50, 2),
      pb: this.generateMockValue(0.5, 5, 2),
      totalValue: this.generateMockValue(5000000000, 1000000000000, 0),
      circulationValue: this.generateMockValue(3000000000, 800000000000, 0),
      bid1: this.generateMockPrice(code, 0.999, 1.001),
      bidVol1: this.generateMockValue(100, 10000, 0),
      ask1: this.generateMockPrice(code, 1.001, 1.003),
      askVol1: this.generateMockValue(100, 10000, 0),
      bidPrices: Array.from({ length: 5 }, () => this.generateMockPrice(code, 0.995, 1.000)),
      bidVolumes: Array.from({ length: 5 }, () => this.generateMockValue(100, 10000, 0)),
      askPrices: Array.from({ length: 5 }, () => this.generateMockPrice(code, 1.000, 1.005)),
      askVolumes: Array.from({ length: 5 }, () => this.generateMockValue(100, 10000, 0)),
      timestamp: new Date(),
    };
  }

  /**
   * 从数据源获取历史数据
   */
  private async fetchHistoricalDataFromSource(
    code: string,
    startDate: Date,
    endDate: Date,
    klineType: KLineType,
    limit: number
  ): Promise<HistoricalStockData> {
    // 在实际实现中，这里应该调用通达信API获取K线数据
    // 目前返回模拟数据
    
    const name = this.stockNameCache.get(code) || await this.fetchStockName(code);
    const data: KLineData[] = [];
    
    // 生成模拟K线数据
    const daysDiff = Math.min(Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)), limit);
    let currentPrice = this.generateMockPrice(code);
    
    for (let i = daysDiff - 1; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      
      // 跳过周末 (简化处理)
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      const open = currentPrice * this.generateMockValue(0.98, 1.02, 4);
      const close = open * this.generateMockValue(0.95, 1.05, 4);
      const high = Math.max(open, close) * this.generateMockValue(1.00, 1.03, 4);
      const low = Math.min(open, close) * this.generateMockValue(0.97, 1.00, 4);
      
      data.push({
        date,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: this.generateMockValue(1000000, 50000000, 0),
        turnover: this.generateMockValue(10000000, 500000000, 0),
      });
      
      currentPrice = close;
    }
    
    return {
      code,
      name,
      klineType,
      data: data.reverse(), // 按时间正序排列
      fetchTime: new Date(),
    };
  }

  /**
   * 获取股票基本信息
   */
  private async fetchStockBasicInfo(code: string): Promise<StockBasicInfo> {
    const name = this.stockNameCache.get(code) || await this.fetchStockName(code);
    const exchange = this.determineExchange(code);
    
    return {
      code,
      name,
      exchange,
      exchangeName: exchange === Exchange.SSE ? '上海证券交易所' : '深圳证券交易所',
      industry: this.generateMockIndustry(code),
      sector: this.generateMockSector(code),
      listDate: this.generateRandomDate(new Date('2000-01-01'), new Date('2020-12-31')),
      totalShares: this.generateMockValue(100000000, 10000000000, 0),
      floatShares: this.generateMockValue(50000000, 8000000000, 0),
      suspended: Math.random() < 0.05, // 5%概率停牌
      status: '正常交易',
    };
  }

  /**
   * 获取市场概览数据
   */
  private async fetchMarketOverview(): Promise<MarketOverview> {
    // 在实际实现中，这里应该获取真实的指数数据
    return {
      shanghaiIndex: {
        value: this.generateMockValue(2800, 3500, 2),
        change: this.generateMockValue(-50, 50, 2),
        changePercent: this.generateMockValue(-0.02, 0.02, 4),
      },
      shenzhenIndex: {
        value: this.generateMockValue(10000, 14000, 2),
        change: this.generateMockValue(-100, 100, 2),
        changePercent: this.generateMockValue(-0.02, 0.02, 4),
      },
      chinextIndex: {
        value: this.generateMockValue(2000, 3000, 2),
        change: this.generateMockValue(-50, 50, 2),
        changePercent: this.generateMockValue(-0.03, 0.03, 4),
      },
      star50Index: {
        value: this.generateMockValue(800, 1200, 2),
        change: this.generateMockValue(-20, 20, 2),
        changePercent: this.generateMockValue(-0.025, 0.025, 4),
      },
      totalVolume: this.generateMockValue(100000000000, 1000000000000, 0),
      totalTurnover: this.generateMockValue(500000000000, 2000000000000, 0),
      riseCount: this.generateMockValue(800, 2000, 0),
      fallCount: this.generateMockValue(800, 2000, 0),
      timestamp: new Date(),
    };
  }

  /**
   * 获取股票名称
   */
  private async fetchStockName(code: string): Promise<string> {
    // 检查缓存
    if (this.stockNameCache.has(code)) {
      return this.stockNameCache.get(code)!;
    }

    // 在实际实现中，这里应该从数据库或API获取股票名称
    // 目前返回默认名称
    const name = `股票${code}`;
    this.stockNameCache.set(code, name);
    
    return name;
  }

  /**
   * 计算技术指标
   */
  private calculateTechnicalIndicators(klineData: KLineData[]): TechnicalIndicators {
    const prices = klineData.map(item => item.close);
    const highs = klineData.map(item => item.high);
    const lows = klineData.map(item => item.low);
    
    return {
      ma: {
        ma5: this.calculateMA(prices, 5),
        ma10: this.calculateMA(prices, 10),
        ma20: this.calculateMA(prices, 20),
        ma50: this.calculateMA(prices, 50),
        ma200: this.calculateMA(prices, 200),
      },
      rsi: {
        rsi14: this.calculateRSI(prices, 14),
        rsi6: this.calculateRSI(prices, 6),
        rsi24: this.calculateRSI(prices, 24),
      },
      macd: this.calculateMACD(prices),
      bollinger: this.calculateBollingerBands(prices, 20, 2),
      kdj: this.calculateKDJ(highs, lows, prices),
    };
  }

  /**
   * 计算移动平均线
   */
  private calculateMA(prices: number[], period: number): number[] {
    const ma: number[] = [];
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        ma.push(NaN);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        ma.push(Number((sum / period).toFixed(4)));
      }
    }
    
    return ma;
  }

  /**
   * 计算RSI指标
   */
  private calculateRSI(prices: number[], period: number): number[] {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    // 计算涨跌幅
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // 计算RSI
    for (let i = 0; i < gains.length; i++) {
      if (i < period - 1) {
        rsi.push(NaN);
      } else {
        const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        
        if (avgLoss === 0) {
          rsi.push(100);
        } else {
          const rs = avgGain / avgLoss;
          rsi.push(Number((100 - 100 / (1 + rs)).toFixed(2)));
        }
      }
    }
    
    return [NaN, ...rsi]; // 添加第一个NaN以匹配价格数组长度
  }

  /**
   * 计算MACD指标
   */
  private calculateMACD(prices: number[]): { dif: number[]; dea: number[]; macd: number[] } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    const dif = ema12.map((value, index) => 
      !isNaN(value) && !isNaN(ema26[index]) ? Number((value - ema26[index]).toFixed(4)) : NaN
    );
    
    const dea = this.calculateEMA(dif.filter(v => !isNaN(v)), 9);
    
    // 填充DEA数组以匹配DIF长度
    const fullDea = new Array(dif.length).fill(NaN);
    const startIndex = dif.findIndex(v => !isNaN(v));
    if (startIndex !== -1) {
      dea.forEach((value, index) => {
        if (startIndex + index < fullDea.length) {
          fullDea[startIndex + index] = value;
        }
      });
    }
    
    const macd = dif.map((difValue, index) => {
      const deaValue = fullDea[index];
      return !isNaN(difValue) && !isNaN(deaValue) ? Number(((difValue - deaValue) * 2).toFixed(4)) : NaN;
    });
    
    return { dif, dea: fullDea, macd };
  }

  /**
   * 计算EMA指标
   */
  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // 找到第一个非NaN值
    let firstValidIndex = -1;
    for (let i = 0; i < prices.length; i++) {
      if (!isNaN(prices[i])) {
        firstValidIndex = i;
        break;
      }
    }
    
    if (firstValidIndex === -1) {
      return new Array(prices.length).fill(NaN);
    }
    
    // 前面填充NaN
    for (let i = 0; i < firstValidIndex; i++) {
      ema.push(NaN);
    }
    
    // 第一个值使用简单平均
    if (firstValidIndex + period - 1 < prices.length) {
      const firstPeriodSum = prices.slice(firstValidIndex, firstValidIndex + period).reduce((a, b) => a + b, 0);
      
      for (let i = firstValidIndex; i < firstValidIndex + period - 1; i++) {
        ema.push(NaN);
      }
      
      ema.push(Number((firstPeriodSum / period).toFixed(4)));
      
      // 计算后续EMA值
      for (let i = firstValidIndex + period; i < prices.length; i++) {
        if (!isNaN(prices[i])) {
          const currentEma = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
          ema.push(Number(currentEma.toFixed(4)));
        } else {
          ema.push(NaN);
        }
      }
    } else {
      // 数据不足，全部填充NaN
      for (let i = firstValidIndex; i < prices.length; i++) {
        ema.push(NaN);
      }
    }
    
    return ema;
  }

  /**
   * 计算布林带
   */
  private calculateBollingerBands(prices: number[], period: number, stdDev: number): { upper: number[]; middle: number[]; lower: number[] } {
    const middle = this.calculateMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        upper.push(NaN);
        lower.push(NaN);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const mean = middle[i];
        const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
        const standardDeviation = Math.sqrt(variance);
        
        upper.push(Number((mean + stdDev * standardDeviation).toFixed(4)));
        lower.push(Number((mean - stdDev * standardDeviation).toFixed(4)));
      }
    }
    
    return { upper, middle, lower };
  }

  /**
   * 计算KDJ指标
   */
  private calculateKDJ(highs: number[], lows: number[], closes: number[]): { k: number[]; d: number[]; j: number[] } {
    const k: number[] = [];
    const d: number[] = [];
    const j: number[] = [];
    const period = 9;
    
    let prevK = 50;
    let prevD = 50;
    
    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        k.push(NaN);
        d.push(NaN);
        j.push(NaN);
      } else {
        const slice_highs = highs.slice(i - period + 1, i + 1);
        const slice_lows = lows.slice(i - period + 1, i + 1);
        
        const highest = Math.max(...slice_highs);
        const lowest = Math.min(...slice_lows);
        
        const rsv = ((closes[i] - lowest) / (highest - lowest)) * 100;
        
        const currentK = (2 / 3) * prevK + (1 / 3) * rsv;
        const currentD = (2 / 3) * prevD + (1 / 3) * currentK;
        const currentJ = 3 * currentK - 2 * currentD;
        
        k.push(Number(currentK.toFixed(2)));
        d.push(Number(currentD.toFixed(2)));
        j.push(Number(currentJ.toFixed(2)));
        
        prevK = currentK;
        prevD = currentD;
      }
    }
    
    return { k, d, j };
  }

  // ==================== 工具方法 ====================

  /**
   * 确定交易所
   */
  private determineExchange(code: string): Exchange {
    if (code.startsWith('60') || code.startsWith('68') || code.startsWith('90')) {
      return Exchange.SSE; // 上海证券交易所
    } else if (code.startsWith('00') || code.startsWith('30') || code.startsWith('20')) {
      return Exchange.SZSE; // 深圳证券交易所
    }
    return Exchange.SZSE; // 默认深圳
  }

  /**
   * 生成模拟价格
   */
  private generateMockPrice(code: string, minMultiplier = 0.8, maxMultiplier = 1.2): number {
    // 基于股票代码生成相对稳定的基础价格
    const basePrice = this.getBasePriceByCode(code);
    const multiplier = this.generateMockValue(minMultiplier, maxMultiplier, 4);
    return Number((basePrice * multiplier).toFixed(2));
  }

  /**
   * 根据股票代码获取基础价格
   */
  private getBasePriceByCode(code: string): number {
    // 使用股票代码生成相对稳定的基础价格
    const hash = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const priceLevels = [5, 10, 15, 20, 30, 50, 80, 100, 150, 200];
    return priceLevels[hash % priceLevels.length];
  }

  /**
   * 生成模拟数值
   */
  private generateMockValue(min: number, max: number, decimals: number = 0): number {
    const value = Math.random() * (max - min) + min;
    return Number(value.toFixed(decimals));
  }

  /**
   * 生成模拟行业
   */
  private generateMockIndustry(code: string): string {
    const industries = ['银行', '房地产', '制造业', '科技', '医药生物', '食品饮料', '电力', '化工', '汽车', '通信'];
    const hash = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return industries[hash % industries.length];
  }

  /**
   * 生成模拟板块
   */
  private generateMockSector(code: string): string {
    const sectors = ['主板', '中小板', '创业板', '科创板', '北交所'];
    
    if (code.startsWith('68')) return '科创板';
    if (code.startsWith('30')) return '创业板';
    if (code.startsWith('00')) return '中小板';
    
    return '主板';
  }

  /**
   * 生成随机日期
   */
  private generateRandomDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  /**
   * 从缓存获取数据
   */
  private async getFromCache(key: string): Promise<string | null> {
    try {
      const result = await this.cacheManager.get<string>(key);
      return result || null;
    } catch (error) {
      this.logger.warn(`从缓存获取数据失败: ${key}, ${error.message}`);
      
      // 尝试从文件缓存获取
      if (this.cacheConfig.enableFileCache) {
        return await this.getFromFileCache(key);
      }
      
      return null;
    }
  }

  /**
   * 设置缓存数据
   */
  private async setCache(key: string, value: string, ttl: number): Promise<void> {
    try {
      // Cache Manager TTL is in milliseconds, convert from seconds
      await this.cacheManager.set(key, value, ttl * 1000);
    } catch (error) {
      this.logger.warn(`设置缓存失败: ${key}, ${error.message}`);
      
      // 尝试设置文件缓存
      if (this.cacheConfig.enableFileCache) {
        await this.setFileCache(key, value, ttl);
      }
    }
  }

  /**
   * 从文件缓存获取数据
   */
  private async getFromFileCache(key: string): Promise<string | null> {
    if (!this.cacheConfig.fileCacheDir) return null;
    
    try {
      const filePath = path.join(this.cacheConfig.fileCacheDir, `${key.replace(/[:/]/g, '_')}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const cacheData = JSON.parse(data);
      
      // 检查是否过期
      if (new Date(cacheData.expireTime) > new Date()) {
        return cacheData.value;
      } else {
        // 删除过期文件
        await fs.unlink(filePath).catch(() => {});
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * 设置文件缓存
   */
  private async setFileCache(key: string, value: string, ttl: number): Promise<void> {
    if (!this.cacheConfig.fileCacheDir) return;
    
    try {
      const filePath = path.join(this.cacheConfig.fileCacheDir, `${key.replace(/[:/]/g, '_')}.json`);
      const expireTime = new Date(Date.now() + ttl * 1000);
      const cacheData = { value, expireTime };
      
      await fs.writeFile(filePath, JSON.stringify(cacheData));
    } catch (error) {
      this.logger.warn(`设置文件缓存失败: ${key}, ${error.message}`);
    }
  }

  /**
   * JSON 日期反序列化器
   */
  private dateReviver(key: string, value: any): any {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return new Date(value);
    }
    return value;
  }
}