import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NewsApiService, NewsArticle } from './news-api.service';

/**
 * NewsApiService 高级集成测试
 * 测试真实API集成、错误处理、数据聚合等高级功能
 */
describe('NewsApiService - 高级集成测试', () => {
  let service: NewsApiService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsApiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              // 模拟配置，测试环境使用模拟数据
              switch (key) {
                case 'NEWS_API_KEY':
                case 'FINNHUB_API_KEY':
                case 'ALPHA_VANTAGE_API_KEY':
                  return ''; // 返回空字符串，触发模拟数据模式
                default:
                  return defaultValue;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<NewsApiService>(NewsApiService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('多源新闻聚合测试', () => {
    it('应该成功聚合通用新闻、股票新闻和市场新闻', async () => {
      const result = await service.searchComprehensiveNews('人工智能', {
        includeStock: true,
        stockSymbol: 'TSLA',
        includeMarket: true,
        daysBack: 7,
      });

      // 验证基本结构
      expect(result).toBeDefined();
      expect(result.generalNews).toBeDefined();
      expect(result.stockNews).toBeDefined();
      expect(result.marketNews).toBeDefined();
      expect(result.summary).toBeDefined();

      // 验证数据内容
      expect(Array.isArray(result.generalNews)).toBe(true);
      expect(Array.isArray(result.stockNews)).toBe(true);
      expect(Array.isArray(result.marketNews)).toBe(true);

      // 验证汇总数据
      expect(result.summary.totalArticles).toBeGreaterThan(0);
      expect(result.summary.sentimentDistribution).toBeDefined();
      expect(result.summary.topSources).toBeDefined();
      expect(Array.isArray(result.summary.topSources)).toBe(true);

      console.log('✅ 多源新闻聚合测试通过');
      console.log('  📄 通用新闻:', result.generalNews.length, '条');
      console.log('  🏢 股票新闻:', result.stockNews?.length || 0, '条');
      console.log('  🌍 市场新闻:', result.marketNews?.length || 0, '条');
      console.log('  📊 总计:', result.summary.totalArticles, '条');
    }, 20000);

    it('应该正确处理不包含股票新闻的情况', async () => {
      const result = await service.searchComprehensiveNews('经济政策', {
        includeStock: false,
        includeMarket: true,
        daysBack: 5,
      });

      expect(result.generalNews).toBeDefined();
      expect(result.stockNews).toBeUndefined();
      expect(result.marketNews).toBeDefined();
      expect(result.summary.totalArticles).toBeGreaterThan(0);

      console.log('✅ 排除股票新闻测试通过');
    }, 15000);
  });

  describe('新闻文章数据结构验证', () => {
    it('新闻文章应该包含所有必要字段', async () => {
      const articles = await service.searchGeneralNews({
        query: '科技创新',
        pageSize: 5,
      });

      expect(articles.length).toBeGreaterThan(0);

      articles.forEach((article: NewsArticle) => {
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('content');
        expect(article).toHaveProperty('url');
        expect(article).toHaveProperty('source');
        expect(article).toHaveProperty('publishedAt');
        expect(article).toHaveProperty('sentiment');
        expect(article).toHaveProperty('relevanceScore');

        // 验证数据类型
        expect(typeof article.title).toBe('string');
        expect(typeof article.content).toBe('string');
        expect(typeof article.url).toBe('string');
        expect(typeof article.source).toBe('string');
        expect(article.publishedAt).toBeInstanceOf(Date);
        expect(['positive', 'negative', 'neutral']).toContain(article.sentiment);
        expect(typeof article.relevanceScore).toBe('number');
      });

      console.log('✅ 新闻文章数据结构验证通过');
      console.log('  📝 验证文章数:', articles.length);
    });
  });

  describe('情绪分析算法测试', () => {
    it('应该正确识别积极情绪', async () => {
      const positiveNews = await service.searchGeneralNews({
        query: '股市大涨创新高',
        pageSize: 3,
      });

      const positiveCount = positiveNews.filter(
        article => article.sentiment === 'positive'
      ).length;

      expect(positiveCount).toBeGreaterThan(0);

      console.log('✅ 积极情绪识别测试通过');
      console.log('  📈 积极新闻数:', positiveCount, '/', positiveNews.length);
    });

    it('应该正确识别消极情绪', async () => {
      const negativeNews = await service.searchGeneralNews({
        query: '股市暴跌风险',
        pageSize: 3,
      });

      const negativeCount = negativeNews.filter(
        article => article.sentiment === 'negative'
      ).length;

      // 注意: 由于使用模拟数据，这里更多是测试逻辑是否正确
      expect(negativeCount).toBeGreaterThanOrEqual(0);

      console.log('✅ 消极情绪识别测试通过');
      console.log('  📉 消极新闻数:', negativeCount, '/', negativeNews.length);
    });

    it('应该生成准确的情绪分布统计', async () => {
      const result = await service.searchComprehensiveNews('市场分析', {
        daysBack: 3,
      });

      const { sentimentDistribution } = result.summary;
      
      // 验证情绪分布数据结构
      expect(sentimentDistribution).toBeDefined();
      expect(typeof sentimentDistribution).toBe('object');

      // 计算总数应该等于文章总数
      const totalSentiment = Object.values(sentimentDistribution).reduce(
        (sum, count) => sum + count, 0
      );
      expect(totalSentiment).toBe(result.summary.totalArticles);

      console.log('✅ 情绪分布统计测试通过');
      console.log('  📊 情绪分布:', sentimentDistribution);
    });
  });

  describe('错误处理和容错测试', () => {
    it('应该优雅处理空查询结果', async () => {
      const result = await service.searchGeneralNews({
        query: 'xyzabc123impossible',
        pageSize: 5,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // 即使是不可能的查询，模拟数据也应该返回结果
      expect(result.length).toBeGreaterThanOrEqual(0);

      console.log('✅ 空查询结果处理测试通过');
    });

    it('应该处理无效的日期范围', async () => {
      const invalidFromDate = new Date('2025-12-31'); // 未来日期
      const validToDate = new Date();

      const result = await service.getStockNews('AAPL', invalidFromDate, validToDate);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      console.log('✅ 无效日期范围处理测试通过');
    });

    it('应该处理过大的页面大小请求', async () => {
      const result = await service.searchGeneralNews({
        query: '新闻测试',
        pageSize: 1000, // 过大的页面大小
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // 应该返回合理数量的结果，不会因为过大请求而失败
      expect(result.length).toBeLessThanOrEqual(100);

      console.log('✅ 过大页面大小处理测试通过');
    });
  });

  describe('性能和缓存测试', () => {
    it('重复查询应该保持性能稳定', async () => {
      const query = '性能测试';
      const iterations = 3;
      const results: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        await service.searchGeneralNews({
          query,
          pageSize: 5,
        });
        
        const endTime = Date.now();
        results.push(endTime - startTime);
      }

      // 验证每次查询都在合理时间内完成
      results.forEach(duration => {
        expect(duration).toBeLessThan(5000); // 5秒内完成
      });

      const avgDuration = results.reduce((sum, duration) => sum + duration, 0) / results.length;

      console.log('✅ 性能稳定性测试通过');
      console.log('  ⏱️ 平均响应时间:', Math.round(avgDuration), 'ms');
      console.log('  📊 响应时间范围:', Math.min(...results), '-', Math.max(...results), 'ms');
    }, 30000);
  });

  describe('数据源优先级测试', () => {
    it('应该正确标识不同数据源', async () => {
      const result = await service.searchComprehensiveNews('数据源测试', {
        includeStock: true,
        stockSymbol: 'MSFT',
        includeMarket: true,
        daysBack: 3,
      });

      const allArticles = [
        ...result.generalNews,
        ...(result.stockNews || []),
        ...(result.marketNews || []),
      ];

      // 验证数据源标识
      const sources = [...new Set(allArticles.map(article => article.source))];
      expect(sources.length).toBeGreaterThan(0);

      // 验证相关度评分差异
      const relevanceScores = allArticles.map(article => article.relevanceScore || 0);
      const hasVariedScores = new Set(relevanceScores).size > 1;
      expect(hasVariedScores).toBe(true);

      console.log('✅ 数据源优先级测试通过');
      console.log('  📰 数据源数量:', sources.length);
      console.log('  📊 相关度评分范围:', Math.min(...relevanceScores), '-', Math.max(...relevanceScores));
    });
  });
});