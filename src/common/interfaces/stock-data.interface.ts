/**
 * 股票数据相关接口定义
 */

/**
 * 交易所枚举
 */
export enum Exchange {
  /** 深圳证券交易所 */
  SZSE = 0,
  /** 上海证券交易所 */ 
  SSE = 1,
}

/**
 * K线周期枚举
 */
export enum KLineType {
  /** 日线 */
  DAILY = 'D',
  /** 周线 */
  WEEKLY = 'W',
  /** 月线 */
  MONTHLY = 'M',
  /** 分钟线 */
  MINUTE = 'M1',
  /** 5分钟线 */
  MINUTE_5 = 'M5',
  /** 15分钟线 */
  MINUTE_15 = 'M15',
  /** 30分钟线 */
  MINUTE_30 = 'M30',
  /** 60分钟线 */
  HOUR = 'H1',
}

/**
 * 实时股票数据
 */
export interface RealTimeStockData {
  /** 股票代码 */
  code: string;
  /** 股票名称 */
  name: string;
  /** 当前价 */
  price: number;
  /** 开盘价 */
  open: number;
  /** 最高价 */
  high: number;
  /** 最低价 */
  low: number;
  /** 昨收价 */
  preClose: number;
  /** 涨跌额 */
  change: number;
  /** 涨跌幅 */
  changePercent: number;
  /** 成交量 */
  volume: number;
  /** 成交额 */
  turnover: number;
  /** 换手率 */
  turnoverRate: number;
  /** 市盈率 */
  pe: number;
  /** 市净率 */
  pb: number;
  /** 总市值 */
  totalValue: number;
  /** 流通市值 */
  circulationValue: number;
  /** 买一价 */
  bid1: number;
  /** 买一量 */
  bidVol1: number;
  /** 卖一价 */
  ask1: number;
  /** 卖一量 */
  askVol1: number;
  /** 五档买价 */
  bidPrices: number[];
  /** 五档买量 */
  bidVolumes: number[];
  /** 五档卖价 */
  askPrices: number[];
  /** 五档卖量 */
  askVolumes: number[];
  /** 数据时间戳 */
  timestamp: Date;
}

/**
 * K线数据点
 */
export interface KLineData {
  /** 日期 */
  date: Date;
  /** 开盘价 */
  open: number;
  /** 最高价 */
  high: number;
  /** 最低价 */
  low: number;
  /** 收盘价 */
  close: number;
  /** 成交量 */
  volume: number;
  /** 成交额 */
  turnover?: number;
}

/**
 * 历史股票数据
 */
export interface HistoricalStockData {
  /** 股票代码 */
  code: string;
  /** 股票名称 */
  name: string;
  /** K线类型 */
  klineType: KLineType;
  /** K线数据 */
  data: KLineData[];
  /** 数据获取时间 */
  fetchTime: Date;
}

/**
 * 技术指标数据
 */
export interface TechnicalIndicators {
  /** 移动平均线 */
  ma: {
    ma5: number[];
    ma10: number[];
    ma20: number[];
    ma50?: number[];
    ma200?: number[];
  };
  /** RSI指标 */
  rsi: {
    rsi14: number[];
    rsi6?: number[];
    rsi24?: number[];
  };
  /** MACD指标 */
  macd: {
    dif: number[];
    dea: number[];
    macd: number[];
  };
  /** 布林带 */
  bollinger: {
    upper: number[];
    middle: number[];
    lower: number[];
  };
  /** KDJ指标 */
  kdj?: {
    k: number[];
    d: number[];
    j: number[];
  };
}

/**
 * 股票基本信息
 */
export interface StockBasicInfo {
  /** 股票代码 */
  code: string;
  /** 股票名称 */
  name: string;
  /** 交易所 */
  exchange: Exchange;
  /** 交易所名称 */
  exchangeName: string;
  /** 行业 */
  industry?: string;
  /** 板块 */
  sector?: string;
  /** 上市日期 */
  listDate?: Date;
  /** 总股本 */
  totalShares?: number;
  /** 流通股本 */
  floatShares?: number;
  /** 是否停牌 */
  suspended?: boolean;
  /** 股票状态 */
  status?: string;
}

/**
 * 市场概览数据
 */
export interface MarketOverview {
  /** 上证指数 */
  shanghaiIndex: {
    value: number;
    change: number;
    changePercent: number;
  };
  /** 深证成指 */
  shenzhenIndex: {
    value: number;
    change: number;
    changePercent: number;
  };
  /** 创业板指 */
  chinextIndex: {
    value: number;
    change: number;
    changePercent: number;
  };
  /** 科创50 */
  star50Index: {
    value: number;
    change: number;
    changePercent: number;
  };
  /** 总成交量 */
  totalVolume: number;
  /** 总成交额 */
  totalTurnover: number;
  /** 上涨股票数 */
  riseCount: number;
  /** 下跌股票数 */
  fallCount: number;
  /** 数据时间 */
  timestamp: Date;
}

/**
 * 股票数据查询参数
 */
export interface StockDataQuery {
  /** 股票代码 */
  code: string;
  /** 开始日期 */
  startDate?: Date;
  /** 结束日期 */
  endDate?: Date;
  /** K线类型 */
  klineType?: KLineType;
  /** 数据条数限制 */
  limit?: number;
  /** 是否包含技术指标 */
  includeTechnicalIndicators?: boolean;
}

/**
 * 数据服务器配置
 */
export interface DataServerConfig {
  /** 服务器IP */
  ip: string;
  /** 端口 */
  port: number;
  /** 服务器描述 */
  name?: string;
  /** 是否可用 */
  available?: boolean;
  /** 最后检测时间 */
  lastCheckTime?: Date;
  /** 连接延迟(ms) */
  latency?: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 实时数据缓存时间(秒) */
  realtimeDataTTL: number;
  /** 历史数据缓存时间(秒) */
  historicalDataTTL: number;
  /** 股票基本信息缓存时间(秒) */
  basicInfoTTL: number;
  /** 是否启用文件缓存 */
  enableFileCache: boolean;
  /** 文件缓存目录 */
  fileCacheDir?: string;
}

/**
 * 股票数据服务接口
 */
export interface IStockDataService {
  /**
   * 获取实时股票数据
   */
  getRealTimeData(code: string): Promise<RealTimeStockData>;

  /**
   * 获取多只股票实时数据
   */
  getBatchRealTimeData(codes: string[]): Promise<RealTimeStockData[]>;

  /**
   * 获取历史股票数据
   */
  getHistoricalData(query: StockDataQuery): Promise<HistoricalStockData>;

  /**
   * 获取技术指标数据
   */
  getTechnicalIndicators(query: StockDataQuery): Promise<TechnicalIndicators>;

  /**
   * 获取股票基本信息
   */
  getStockBasicInfo(code: string): Promise<StockBasicInfo>;

  /**
   * 搜索股票
   */
  searchStocks(keyword: string): Promise<StockBasicInfo[]>;

  /**
   * 获取市场概览
   */
  getMarketOverview(): Promise<MarketOverview>;

  /**
   * 检测服务器连接状态
   */
  checkServerConnection(): Promise<boolean>;

  /**
   * 清除缓存
   */
  clearCache(pattern?: string): Promise<void>;
}