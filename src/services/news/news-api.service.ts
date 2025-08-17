import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessLogger } from '../../common/utils/business-logger.util';

/**
 * 新闻数据接口
 */
export interface NewsArticle {
  title: string;
  content: string;
  url: string;
  source: string;
  publishedAt: Date;
  sentiment?: 'positive' | 'negative' | 'neutral';
  relevanceScore?: number;
}

/**
 * 新闻搜索参数
 */
export interface NewsSearchParams {
  query: string;
  language?: string;
  sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
  from?: Date;
  to?: Date;
  sources?: string[];
  domains?: string[];
  pageSize?: number;
  page?: number;
}

/**
 * 新闻API服务
 * 集成多个新闻数据源，为智能体提供实时新闻分析能力
 */
@Injectable()
export class NewsApiService {
  private readonly logger = new BusinessLogger(NewsApiService.name);
  
  // API配置
  private readonly newsApiKey: string;
  private readonly finnhubApiKey: string;
  private readonly alphaVantageApiKey: string;

  // API基础URL
  private readonly newsApiUrl = 'https://newsapi.org/v2';
  private readonly finnhubNewsUrl = 'https://finnhub.io/api/v1/company-news';
  private readonly alphaVantageNewsUrl = 'https://www.alphavantage.co/query';

  constructor(private readonly configService: ConfigService) {
    this.newsApiKey = this.configService.get<string>('NEWS_API_KEY', '');
    this.finnhubApiKey = this.configService.get<string>('FINNHUB_API_KEY', '');
    this.alphaVantageApiKey = this.configService.get<string>('ALPHA_VANTAGE_API_KEY', '');
    
    this.logger.serviceInfo('新闻API服务初始化完成', {
      hasNewsApiKey: !!this.newsApiKey,
      hasFinnhubKey: !!this.finnhubApiKey,
      hasAlphaVantageKey: !!this.alphaVantageApiKey,
    });
  }

  /**
   * 搜索通用新闻 - 使用NewsAPI
   */
  async searchGeneralNews(params: NewsSearchParams): Promise<NewsArticle[]> {
    if (!this.newsApiKey) {
      this.logger.warn('NewsAPI密钥未配置，返回模拟数据');
      return this.getMockGeneralNews(params.query);
    }

    try {
      const searchParams = new URLSearchParams({
        q: params.query,
        apiKey: this.newsApiKey,
        language: params.language || 'zh',
        sortBy: params.sortBy || 'publishedAt',
        pageSize: (params.pageSize || 20).toString(),
        page: (params.page || 1).toString(),
      });

      if (params.from) {
        searchParams.append('from', params.from.toISOString());
      }
      if (params.to) {
        searchParams.append('to', params.to.toISOString());
      }
      if (params.sources?.length) {
        searchParams.append('sources', params.sources.join(','));
      }
      if (params.domains?.length) {
        searchParams.append('domains', params.domains.join(','));
      }

      const url = `${this.newsApiUrl}/everything?${searchParams.toString()}`;
      
      this.logger.httpRequest('GET', url, Object.fromEntries(searchParams));

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`NewsAPI请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.logger.httpResponse(url, response.status, { 
        totalResults: data.totalResults,
        articlesCount: data.articles?.length || 0 
      });

      return this.parseNewsApiResponse(data);

    } catch (error) {
      this.logger.businessError('搜索通用新闻', error);
      return this.getMockGeneralNews(params.query);
    }
  }

  /**
   * 获取股票相关新闻 - 使用FinnHub
   */
  async getStockNews(stockSymbol: string, fromDate: Date, toDate: Date): Promise<NewsArticle[]> {
    if (!this.finnhubApiKey) {
      this.logger.warn('FinnHub API密钥未配置，返回模拟数据');
      return this.getMockStockNews(stockSymbol);
    }

    try {
      const params = new URLSearchParams({
        symbol: stockSymbol,
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
        token: this.finnhubApiKey,
      });

      const url = `${this.finnhubNewsUrl}?${params.toString()}`;
      
      this.logger.httpRequest('GET', url, Object.fromEntries(params));

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`FinnHub请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.logger.httpResponse(url, response.status, { 
        articlesCount: data?.length || 0 
      });

      return this.parseFinnhubResponse(data);

    } catch (error) {
      this.logger.businessError('获取股票新闻', error);
      return this.getMockStockNews(stockSymbol);
    }
  }

  /**
   * 获取市场概况新闻 - 使用Alpha Vantage
   */
  async getMarketNews(topics: string[] = ['market', 'economy']): Promise<NewsArticle[]> {
    if (!this.alphaVantageApiKey) {
      this.logger.warn('Alpha Vantage API密钥未配置，返回模拟数据');
      return this.getMockMarketNews();
    }

    try {
      const params = new URLSearchParams({
        function: 'NEWS_SENTIMENT',
        topics: topics.join(','),
        apikey: this.alphaVantageApiKey,
      });

      const url = `${this.alphaVantageNewsUrl}?${params.toString()}`;
      
      this.logger.httpRequest('GET', url, Object.fromEntries(params));

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Alpha Vantage请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.logger.httpResponse(url, response.status, { 
        articlesCount: data?.feed?.length || 0 
      });

      return this.parseAlphaVantageResponse(data);

    } catch (error) {
      this.logger.businessError('获取市场新闻', error);
      return this.getMockMarketNews();
    }
  }

  /**
   * 综合新闻搜索 - 聚合多个数据源
   */
  async searchComprehensiveNews(query: string, options: {
    includeStock?: boolean;
    includeMarket?: boolean;
    stockSymbol?: string;
    daysBack?: number;
  } = {}): Promise<{
    generalNews: NewsArticle[];
    stockNews?: NewsArticle[];
    marketNews?: NewsArticle[];
    summary: {
      totalArticles: number;
      sentimentDistribution: Record<string, number>;
      topSources: string[];
    };
  }> {
    const { 
      includeStock = false, 
      includeMarket = true, 
      stockSymbol, 
      daysBack = 7 
    } = options;

    const toDate = new Date();
    const fromDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const promises: Promise<NewsArticle[]>[] = [];
    
    // 通用新闻搜索
    promises.push(this.searchGeneralNews({
      query,
      from: fromDate,
      to: toDate,
      pageSize: 50,
      language: 'zh',
    }));

    // 股票新闻
    let stockNewsPromise: Promise<NewsArticle[]> | undefined;
    if (includeStock && stockSymbol) {
      stockNewsPromise = this.getStockNews(stockSymbol, fromDate, toDate);
      promises.push(stockNewsPromise);
    }

    // 市场新闻
    let marketNewsPromise: Promise<NewsArticle[]> | undefined;
    if (includeMarket) {
      marketNewsPromise = this.getMarketNews(['market', 'economy', 'finance']);
      promises.push(marketNewsPromise);
    }

    try {
      const results = await Promise.allSettled(promises);
      
      const generalNews = results[0].status === 'fulfilled' ? results[0].value : [];
      const stockNews = includeStock && stockSymbol && results[1]?.status === 'fulfilled' 
        ? (results[1] as PromiseFulfilledResult<NewsArticle[]>).value : undefined;
      const marketNews = includeMarket && results[includeStock ? 2 : 1]?.status === 'fulfilled' 
        ? (results[includeStock ? 2 : 1] as PromiseFulfilledResult<NewsArticle[]>).value : undefined;

      // 分析汇总
      const allArticles = [
        ...generalNews,
        ...(stockNews || []),
        ...(marketNews || []),
      ];

      const summary = this.generateNewsSummary(allArticles);

      return {
        generalNews,
        stockNews,
        marketNews,
        summary,
      };

    } catch (error) {
      this.logger.businessError('综合新闻搜索', error);
      
      // 返回错误时的默认结果
      return {
        generalNews: this.getMockGeneralNews(query),
        summary: {
          totalArticles: 0,
          sentimentDistribution: { neutral: 1 },
          topSources: ['Mock Source'],
        },
      };
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 解析NewsAPI响应
   */
  private parseNewsApiResponse(data: any): NewsArticle[] {
    if (!data.articles || !Array.isArray(data.articles)) {
      return [];
    }

    return data.articles.map((article: any) => ({
      title: article.title || '',
      content: article.description || article.content || '',
      url: article.url || '',
      source: article.source?.name || 'Unknown',
      publishedAt: new Date(article.publishedAt),
      sentiment: this.analyzeSentiment(article.title + ' ' + article.description),
      relevanceScore: 0.8, // 基础相关性评分
    })).filter((article: NewsArticle) => article.title && article.content);
  }

  /**
   * 解析FinnHub响应
   */
  private parseFinnhubResponse(data: any[]): NewsArticle[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((article: any) => ({
      title: article.headline || '',
      content: article.summary || '',
      url: article.url || '',
      source: article.source || 'FinnHub',
      publishedAt: new Date(article.datetime * 1000), // FinnHub使用Unix时间戳
      sentiment: this.analyzeSentiment(article.headline + ' ' + article.summary),
      relevanceScore: 0.9, // 股票专业新闻相关性较高
    })).filter((article: NewsArticle) => article.title && article.content);
  }

  /**
   * 解析Alpha Vantage响应
   */
  private parseAlphaVantageResponse(data: any): NewsArticle[] {
    if (!data.feed || !Array.isArray(data.feed)) {
      return [];
    }

    return data.feed.map((article: any) => ({
      title: article.title || '',
      content: article.summary || '',
      url: article.url || '',
      source: article.source || 'Alpha Vantage',
      publishedAt: new Date(article.time_published),
      sentiment: this.convertAlphaVantageSentiment(article.overall_sentiment_label),
      relevanceScore: parseFloat(article.relevance_score) || 0.5,
    })).filter((article: NewsArticle) => article.title && article.content);
  }

  /**
   * 简单的情绪分析
   */
  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    if (!text) return 'neutral';

    const positiveWords = ['涨', '上涨', '利好', '增长', '提升', '突破', '创新高'];
    const negativeWords = ['跌', '下跌', '利空', '下降', '暴跌', '亏损', '风险'];

    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * 转换Alpha Vantage情绪标签
   */
  private convertAlphaVantageSentiment(label: string): 'positive' | 'negative' | 'neutral' {
    switch (label?.toLowerCase()) {
      case 'bullish':
      case 'somewhat-bullish':
        return 'positive';
      case 'bearish':
      case 'somewhat-bearish':
        return 'negative';
      default:
        return 'neutral';
    }
  }

  /**
   * 生成新闻汇总
   */
  private generateNewsSummary(articles: NewsArticle[]): {
    totalArticles: number;
    sentimentDistribution: Record<string, number>;
    topSources: string[];
  } {
    const sentimentCounts = articles.reduce((acc, article) => {
      const sentiment = article.sentiment || 'neutral';
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sourceCounts = articles.reduce((acc, article) => {
      acc[article.source] = (acc[article.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topSources = Object.entries(sourceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([source]) => source);

    return {
      totalArticles: articles.length,
      sentimentDistribution: sentimentCounts,
      topSources,
    };
  }

  // ==================== 模拟数据方法 ====================

  /**
   * 获取模拟通用新闻数据
   */
  private getMockGeneralNews(query: string): NewsArticle[] {
    return [
      {
        title: `${query}相关政策利好消息`,
        content: `最新政策显示，国家将进一步支持${query}相关产业发展，预期将带来积极影响。`,
        url: 'https://mock-news.com/1',
        source: '财经新闻网',
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        sentiment: 'positive',
        relevanceScore: 0.9,
      },
      {
        title: `${query}行业分析师观点分歧`,
        content: `针对${query}的未来发展，市场分析师观点出现分歧，部分看好长期前景，部分担心短期风险。`,
        url: 'https://mock-news.com/2',
        source: '市场观察',
        publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        sentiment: 'neutral',
        relevanceScore: 0.8,
      },
    ];
  }

  /**
   * 获取模拟股票新闻数据
   */
  private getMockStockNews(stockSymbol: string): NewsArticle[] {
    return [
      {
        title: `${stockSymbol}发布季度财报，业绩超预期`,
        content: `${stockSymbol}公司发布最新季度财报，营收和利润均超出市场预期，推动股价上涨。`,
        url: 'https://mock-stock-news.com/1',
        source: 'Stock News Pro',
        publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        sentiment: 'positive',
        relevanceScore: 0.95,
      },
    ];
  }

  /**
   * 获取模拟市场新闻数据
   */
  private getMockMarketNews(): NewsArticle[] {
    return [
      {
        title: '央行维持基准利率不变，市场反应平稳',
        content: '央行在最新的货币政策会议中决定维持基准利率不变，符合市场预期，股市反应相对平稳。',
        url: 'https://mock-market-news.com/1',
        source: '财经日报',
        publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        sentiment: 'neutral',
        relevanceScore: 0.7,
      },
    ];
  }
}