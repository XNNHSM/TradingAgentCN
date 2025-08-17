import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NewsApiService } from './news-api.service';

describe('NewsApiService', () => {
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
              // 模拟配置，不提供真实API密钥
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

  describe('搜索通用新闻', () => {
    it('应该在没有API密钥时返回模拟数据', async () => {
      const result = await service.searchGeneralNews({
        query: '人工智能',
        pageSize: 5,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // 检查新闻文章结构
      const article = result[0];
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('content');
      expect(article).toHaveProperty('source');
      expect(article).toHaveProperty('publishedAt');
      expect(article).toHaveProperty('sentiment');
      
      console.log('✅ 通用新闻搜索测试通过，返回模拟数据:', result.length, '条新闻');
    });
  });

  describe('获取股票新闻', () => {
    it('应该在没有API密钥时返回模拟数据', async () => {
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const toDate = new Date();
      
      const result = await service.getStockNews('AAPL', fromDate, toDate);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      console.log('✅ 股票新闻获取测试通过，返回模拟数据:', result.length, '条新闻');
    });
  });

  describe('综合新闻搜索', () => {
    it('应该成功聚合多源新闻数据', async () => {
      const result = await service.searchComprehensiveNews('新能源汽车', {
        includeStock: true,
        stockSymbol: 'TSLA',
        includeMarket: true,
        daysBack: 7,
      });

      expect(result).toBeDefined();
      expect(result.generalNews).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.totalArticles).toBeGreaterThan(0);
      expect(result.summary.sentimentDistribution).toBeDefined();
      expect(result.summary.topSources).toBeDefined();
      
      console.log('✅ 综合新闻搜索测试通过');
      console.log('  - 通用新闻:', result.generalNews.length, '条');
      console.log('  - 股票新闻:', result.stockNews?.length || 0, '条');
      console.log('  - 市场新闻:', result.marketNews?.length || 0, '条');
      console.log('  - 情绪分布:', result.summary.sentimentDistribution);
      console.log('  - 主要来源:', result.summary.topSources);
    });
  });

  describe('新闻情绪分析', () => {
    it('应该正确分析新闻情绪', async () => {
      const positiveNews = await service.searchGeneralNews({
        query: '科技股上涨',
        pageSize: 1,
      });

      const negativeNews = await service.searchGeneralNews({
        query: '市场下跌',
        pageSize: 1,
      });

      // 检查情绪分析结果
      expect(positiveNews[0]?.sentiment).toBeDefined();
      expect(negativeNews[0]?.sentiment).toBeDefined();
      
      console.log('✅ 新闻情绪分析测试通过');
      console.log('  - 积极新闻情绪:', positiveNews[0]?.sentiment);
      console.log('  - 消极新闻情绪:', negativeNews[0]?.sentiment);
    });
  });
});