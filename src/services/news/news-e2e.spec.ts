import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NewsApiService } from './news-api.service';
import { DataToolkitService } from '../../agents/services/data-toolkit.service';
import { StockDataService } from '../stock-data/stock-data.service';

/**
 * 新闻数据流端到端测试
 * 测试从新闻API到智能体工具的完整数据流
 */
describe('新闻数据流 - 端到端测试', () => {
  let newsApiService: NewsApiService;
  let dataToolkitService: DataToolkitService;
  let stockDataService: StockDataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsApiService,
        DataToolkitService,
        StockDataService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              // 测试环境配置
              switch (key) {
                case 'NEWS_API_KEY':
                case 'FINNHUB_API_KEY':
                case 'ALPHA_VANTAGE_API_KEY':
                  return ''; // 使用模拟数据
                case 'ENABLE_CACHE':
                case 'STOCK_ENABLE_FILE_CACHE':
                  return false; // 禁用缓存确保数据一致性
                default:
                  return defaultValue;
              }
            }),
          },
        },
        {
          provide: 'CACHE_MANAGER',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    newsApiService = module.get<NewsApiService>(NewsApiService);
    dataToolkitService = module.get<DataToolkitService>(DataToolkitService);
    stockDataService = module.get<StockDataService>(StockDataService);
  });

  it('所有服务应该正确初始化', () => {
    expect(newsApiService).toBeDefined();
    expect(dataToolkitService).toBeDefined();
    expect(stockDataService).toBeDefined();
  });

  describe('智能体工具与新闻API集成测试', () => {
    it('get_stock_news工具应该调用NewsApiService获取数据', async () => {
      // 监控NewsApiService方法调用
      const searchSpy = jest.spyOn(newsApiService, 'searchComprehensiveNews');

      const result = await dataToolkitService.executeTool('get_stock_news', {
        keyword: '新能源汽车',
        stock_code: '002594',
        days: 7,
      });

      // 验证NewsApiService被正确调用
      expect(searchSpy).toHaveBeenCalledWith('新能源汽车', {
        includeStock: true,
        stockSymbol: '002594',
        includeMarket: true,
        daysBack: 7,
      });

      // 验证返回的Markdown格式
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('📰 股票新闻分析');
      expect(result).toContain('新能源汽车');
      expect(result).toContain('002594');

      searchSpy.mockRestore();

      console.log('✅ get_stock_news工具集成测试通过');
      console.log('  📡 API调用验证: ✓');
      console.log('  📝 Markdown格式: ✓');
    }, 20000);

    it('应该正确传递所有工具参数', async () => {
      const searchSpy = jest.spyOn(newsApiService, 'searchComprehensiveNews');

      // 测试完整参数传递
      await dataToolkitService.executeTool('get_stock_news', {
        keyword: '人工智能',
        stock_code: '000001',
        days: 14,
      });

      expect(searchSpy).toHaveBeenCalledWith('人工智能', {
        includeStock: true,
        stockSymbol: '000001',
        includeMarket: true,
        daysBack: 14,
      });

      // 测试无股票代码情况
      await dataToolkitService.executeTool('get_stock_news', {
        keyword: '宏观经济',
        days: 5,
      });

      expect(searchSpy).toHaveBeenCalledWith('宏观经济', {
        includeStock: false,
        stockSymbol: undefined,
        includeMarket: true,
        daysBack: 5,
      });

      searchSpy.mockRestore();

      console.log('✅ 工具参数传递测试通过');
    }, 15000);
  });

  describe('新闻数据格式化测试', () => {
    it('应该生成符合智能体要求的Markdown格式', async () => {
      const result = await dataToolkitService.executeTool('get_stock_news', {
        keyword: '科技创新',
        stock_code: '600519',
        days: 3,
      });

      // 验证Markdown结构
      expect(result).toMatch(/^# 📰 股票新闻分析/);
      expect(result).toContain('## 搜索参数');
      expect(result).toContain('## 📈 通用新闻');
      expect(result).toContain('## 🏢 个股专业新闻');
      expect(result).toContain('## 🌍 市场宏观新闻');
      expect(result).toContain('## 🎯 新闻情绪分析汇总');
      expect(result).toContain('## 💡 投资建议');

      // 验证新闻条目格式
      expect(result).toMatch(/### \d+\. /); // 新闻条目编号
      expect(result).toContain('- 来源:');
      expect(result).toContain('- 发布时间:');
      expect(result).toContain('- 情绪倾向:');
      expect(result).toContain('- 相关度:');

      console.log('✅ Markdown格式化测试通过');
      console.log('  📑 结构完整性: ✓');
      console.log('  🎨 格式规范性: ✓');
    }, 15000);

    it('应该包含正确的情绪表情符号和星级评分', async () => {
      const result = await dataToolkitService.executeTool('get_stock_news', {
        keyword: '投资机会',
        days: 1,
      });

      // 验证情绪表情符号
      const hasEmoji = /[📈📉➡️]/.test(result);
      expect(hasEmoji).toBe(true);

      // 验证星级评分
      const hasStars = /⭐+/.test(result);
      expect(hasStars).toBe(true);

      // 验证情绪文字描述
      const hasSentimentText = /[积极|消极|中性]/.test(result);
      expect(hasSentimentText).toBe(true);

      console.log('✅ 情绪符号和评分测试通过');
    }, 10000);
  });

  describe('错误处理和数据流稳定性测试', () => {
    it('NewsApiService错误时应该优雅降级', async () => {
      // 模拟NewsApiService抛出错误
      const errorSpy = jest.spyOn(newsApiService, 'searchComprehensiveNews')
        .mockRejectedValue(new Error('API 调用失败'));

      const result = await dataToolkitService.executeTool('get_stock_news', {
        keyword: '测试错误',
        days: 1,
      });

      // 应该返回错误信息而不是抛出异常
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('获取股票新闻失败');

      errorSpy.mockRestore();

      console.log('✅ 错误处理和降级测试通过');
    }, 10000);

    it('应该处理极端参数值', async () => {
      // 测试极端天数值
      const result1 = await dataToolkitService.executeTool('get_stock_news', {
        keyword: '测试',
        days: 0,
      });

      const result2 = await dataToolkitService.executeTool('get_stock_news', {
        keyword: '测试',
        days: 365,
      });

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      console.log('✅ 极端参数处理测试通过');
    }, 15000);
  });

  describe('性能和并发测试', () => {
    it('应该支持并发新闻请求', async () => {
      const promises = [
        dataToolkitService.executeTool('get_stock_news', {
          keyword: '并发测试1',
          days: 1,
        }),
        dataToolkitService.executeTool('get_stock_news', {
          keyword: '并发测试2',
          days: 1,
        }),
        dataToolkitService.executeTool('get_stock_news', {
          keyword: '并发测试3',
          days: 1,
        }),
      ];

      const results = await Promise.all(promises);

      // 验证所有请求都成功完成
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result).toContain(`并发测试${index + 1}`);
      });

      console.log('✅ 并发请求测试通过');
      console.log('  🔀 并发数量:', promises.length);
    }, 30000);

    it('数据流响应时间应该在合理范围内', async () => {
      const startTime = Date.now();

      await dataToolkitService.executeTool('get_stock_news', {
        keyword: '性能测试',
        stock_code: '000001',
        days: 7,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 端到端响应时间应该在合理范围内
      expect(duration).toBeLessThan(10000); // 10秒内完成

      console.log('✅ 响应时间测试通过');
      console.log('  ⏱️ 端到端耗时:', duration, 'ms');
    }, 15000);
  });

  describe('数据一致性验证', () => {
    it('相同参数应该返回一致的数据结构', async () => {
      const params = {
        keyword: '一致性测试',
        stock_code: '000001',
        days: 3,
      };

      const result1 = await dataToolkitService.executeTool('get_stock_news', params);
      const result2 = await dataToolkitService.executeTool('get_stock_news', params);

      // 验证结构一致性
      expect(typeof result1).toBe(typeof result2);
      expect(result1.includes('📰 股票新闻分析')).toBe(result2.includes('📰 股票新闻分析'));
      expect(result1.includes('一致性测试')).toBe(result2.includes('一致性测试'));

      console.log('✅ 数据一致性验证通过');
    }, 20000);

    it('不同参数应该返回不同内容', async () => {
      const result1 = await dataToolkitService.executeTool('get_stock_news', {
        keyword: '内容A',
        days: 1,
      });

      const result2 = await dataToolkitService.executeTool('get_stock_news', {
        keyword: '内容B', 
        days: 1,
      });

      // 验证内容差异
      expect(result1).toContain('内容A');
      expect(result2).toContain('内容B');
      expect(result1).not.toContain('内容B');
      expect(result2).not.toContain('内容A');

      console.log('✅ 内容差异验证通过');
    }, 15000);
  });

  describe('工具注册和发现测试', () => {
    it('get_stock_news应该在工具列表中正确注册', () => {
      const tools = dataToolkitService.getAvailableTools();
      const newsTool = tools.find(tool => tool.name === 'get_stock_news');

      expect(newsTool).toBeDefined();
      expect(newsTool.description).toContain('股票相关新闻');
      expect(newsTool.parameters.required).toContain('keyword');

      console.log('✅ 工具注册验证通过');
      console.log('  🔧 工具名称:', newsTool.name);
      console.log('  📝 工具描述:', newsTool.description.substring(0, 50) + '...');
    });

    it('工具定义应该符合LLM function calling规范', () => {
      const toolDefinitions = dataToolkitService.getToolDefinitions();
      const newsToolDef = toolDefinitions.find(
        tool => tool.function.name === 'get_stock_news'
      );

      expect(newsToolDef).toBeDefined();
      expect(newsToolDef.type).toBe('function');
      expect(newsToolDef.function.name).toBe('get_stock_news');
      expect(newsToolDef.function.description).toBeDefined();
      expect(newsToolDef.function.parameters).toBeDefined();
      expect(newsToolDef.function.parameters.type).toBe('object');
      expect(newsToolDef.function.parameters.properties).toBeDefined();
      expect(newsToolDef.function.parameters.required).toBeDefined();

      console.log('✅ LLM function calling规范验证通过');
    });
  });
});