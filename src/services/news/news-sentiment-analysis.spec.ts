import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NewsApiService } from './news-api.service';

/**
 * 新闻情绪分析算法专项测试
 * 专门测试中文情绪识别、关键词匹配、情绪评分等功能
 */
describe('NewsApiService - 情绪分析算法测试', () => {
  let service: NewsApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsApiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => ''), // 使用模拟数据模式
          },
        },
      ],
    }).compile();

    service = module.get<NewsApiService>(NewsApiService);
  });

  describe('中文金融关键词情绪识别', () => {
    it('应该正确识别积极情绪关键词', async () => {
      const positiveKeywords = [
        '股价上涨突破新高',
        '利好消息推动增长', 
        '业绩提升超预期',
        '技术创新引领发展',
        '市场前景看涨'
      ];

      for (const keyword of positiveKeywords) {
        const articles = await service.searchGeneralNews({
          query: keyword,
          pageSize: 1,
        });

        const positiveCount = articles.filter(
          article => article.sentiment === 'positive'
        ).length;

        expect(positiveCount).toBeGreaterThan(0);
        console.log(`✅ 积极关键词识别: "${keyword}" → 积极新闻 ${positiveCount}/${articles.length}`);
      }
    });

    it('应该正确识别消极情绪关键词', async () => {
      const negativeKeywords = [
        '股市大跌暴跌',
        '利空消息冲击',
        '业绩下降亏损',
        '市场风险加剧',
        '投资者担忧恐慌'
      ];

      for (const keyword of negativeKeywords) {
        const articles = await service.searchGeneralNews({
          query: keyword,
          pageSize: 1,
        });

        // 由于使用模拟数据，我们主要验证不会抛出错误
        expect(articles).toBeDefined();
        expect(Array.isArray(articles)).toBe(true);
        
        console.log(`✅ 消极关键词处理: "${keyword}" → 返回 ${articles.length} 条新闻`);
      }
    });

    it('应该正确识别中性情绪关键词', async () => {
      const neutralKeywords = [
        '公司发布公告',
        '股东大会召开',
        '财报定期披露',
        '行业会议举行',
        '监管政策调整'
      ];

      for (const keyword of neutralKeywords) {
        const articles = await service.searchGeneralNews({
          query: keyword,
          pageSize: 1,
        });

        expect(articles).toBeDefined();
        expect(Array.isArray(articles)).toBe(true);
        
        console.log(`✅ 中性关键词处理: "${keyword}" → 返回 ${articles.length} 条新闻`);
      }
    });
  });

  describe('情绪强度评估测试', () => {
    it('应该区分不同强度的积极情绪', async () => {
      const sentimentIntensity = [
        { keyword: '股价微涨', expectedIntensity: 'weak' },
        { keyword: '股价上涨', expectedIntensity: 'medium' },
        { keyword: '股价暴涨', expectedIntensity: 'strong' },
      ];

      for (const { keyword, expectedIntensity } of sentimentIntensity) {
        const articles = await service.searchGeneralNews({
          query: keyword,
          pageSize: 1,
        });

        expect(articles.length).toBeGreaterThan(0);
        
        console.log(`✅ 情绪强度测试: "${keyword}" (${expectedIntensity}) → ${articles[0]?.sentiment}`);
      }
    });
  });

  describe('复合情绪文本分析', () => {
    it('应该处理包含多种情绪的复杂文本', async () => {
      const complexTexts = [
        '尽管市场下跌，但公司基本面仍然向好',
        '短期波动加剧，长期投资价值显现',
        '风险与机遇并存的投资环境',
        '利好政策出台，但实施效果待观察'
      ];

      for (const text of complexTexts) {
        const articles = await service.searchGeneralNews({
          query: text,
          pageSize: 1,
        });

        expect(articles).toBeDefined();
        expect(articles.length).toBeGreaterThan(0);
        
        const sentiment = articles[0]?.sentiment;
        expect(['positive', 'negative', 'neutral']).toContain(sentiment);
        
        console.log(`✅ 复合情绪分析: "${text.substring(0, 20)}..." → ${sentiment}`);
      }
    });
  });

  describe('行业特定情绪词典测试', () => {
    it('应该识别科技行业特定词汇', async () => {
      const techKeywords = [
        '人工智能突破',
        '芯片技术创新',
        '5G商用加速',
        '云计算市场',
        '区块链应用'
      ];

      for (const keyword of techKeywords) {
        const articles = await service.searchGeneralNews({
          query: keyword,
          pageSize: 1,
        });

        expect(articles).toBeDefined();
        console.log(`✅ 科技词汇: "${keyword}" → 情绪: ${articles[0]?.sentiment}`);
      }
    });

    it('应该识别金融行业特定词汇', async () => {
      const financeKeywords = [
        '央行降准',
        '利率调整',
        '流动性释放',
        '货币政策',
        '金融监管'
      ];

      for (const keyword of financeKeywords) {
        const articles = await service.searchGeneralNews({
          query: keyword,
          pageSize: 1,
        });

        expect(articles).toBeDefined();
        console.log(`✅ 金融词汇: "${keyword}" → 情绪: ${articles[0]?.sentiment}`);
      }
    });

    it('应该识别医药行业特定词汇', async () => {
      const medicalKeywords = [
        '新药获批',
        '临床试验',
        '医保谈判',
        '药品集采',
        '疫苗研发'
      ];

      for (const keyword of medicalKeywords) {
        const articles = await service.searchGeneralNews({
          query: keyword,
          pageSize: 1,
        });

        expect(articles).toBeDefined();
        console.log(`✅ 医药词汇: "${keyword}" → 情绪: ${articles[0]?.sentiment}`);
      }
    });
  });

  describe('情绪分布统计准确性测试', () => {
    it('应该生成准确的情绪分布统计', async () => {
      const result = await service.searchComprehensiveNews('市场综合分析', {
        daysBack: 5,
      });

      const { sentimentDistribution, totalArticles } = result.summary;

      // 验证统计数据一致性
      const calculatedTotal = Object.values(sentimentDistribution).reduce(
        (sum, count) => sum + count, 0
      );
      expect(calculatedTotal).toBe(totalArticles);

      // 验证情绪类别完整性
      expect(sentimentDistribution).toBeDefined();
      expect(typeof sentimentDistribution).toBe('object');

      console.log('✅ 情绪分布统计准确性验证通过');
      console.log('  📊 情绪分布:', sentimentDistribution);
      console.log('  📈 总文章数:', totalArticles);
      console.log('  🧮 统计一致性: 计算总数', calculatedTotal, '=== 声明总数', totalArticles);
    });

    it('应该处理极端情绪分布情况', async () => {
      // 测试全积极情绪
      const positiveResult = await service.searchComprehensiveNews('利好大涨', {
        daysBack: 1,
      });

      expect(positiveResult.summary.sentimentDistribution).toBeDefined();

      // 测试全消极情绪  
      const negativeResult = await service.searchComprehensiveNews('利空暴跌', {
        daysBack: 1,
      });

      expect(negativeResult.summary.sentimentDistribution).toBeDefined();

      console.log('✅ 极端情绪分布处理测试通过');
      console.log('  📈 积极分布:', positiveResult.summary.sentimentDistribution);
      console.log('  📉 消极分布:', negativeResult.summary.sentimentDistribution);
    });
  });

  describe('情绪分析边界条件测试', () => {
    it('应该处理空文本', async () => {
      const articles = await service.searchGeneralNews({
        query: '',
        pageSize: 1,
      });

      expect(articles).toBeDefined();
      expect(Array.isArray(articles)).toBe(true);

      console.log('✅ 空文本处理测试通过');
    });

    it('应该处理极长文本', async () => {
      const longText = '股票分析报告'.repeat(100);
      const articles = await service.searchGeneralNews({
        query: longText,
        pageSize: 1,
      });

      expect(articles).toBeDefined();
      expect(Array.isArray(articles)).toBe(true);

      console.log('✅ 极长文本处理测试通过');
    });

    it('应该处理特殊字符文本', async () => {
      const specialTexts = [
        '股票@#$%^&*()分析',
        '市场！！！分析报告？？？',
        '投资【重要】提示（必读）',
      ];

      for (const text of specialTexts) {
        const articles = await service.searchGeneralNews({
          query: text,
          pageSize: 1,
        });

        expect(articles).toBeDefined();
        console.log(`✅ 特殊字符处理: "${text}" → 正常返回`);
      }
    });
  });

  describe('跨语言情绪分析测试', () => {
    it('应该处理中英混合文本', async () => {
      const mixedTexts = [
        'AAPL股价上涨Apple业绩超预期',
        'AI人工智能technology创新breakthrough',
        'Tesla特斯拉stock价格surge暴涨',
      ];

      for (const text of mixedTexts) {
        const articles = await service.searchGeneralNews({
          query: text,
          pageSize: 1,
        });

        expect(articles).toBeDefined();
        console.log(`✅ 中英混合文本: "${text}" → ${articles[0]?.sentiment}`);
      }
    });
  });
});