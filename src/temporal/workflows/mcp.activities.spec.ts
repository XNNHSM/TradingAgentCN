import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createMCPActivities, MCPActivities } from './mcp.activities';

// Mock fetch globally
global.fetch = jest.fn();

describe('MCP Activities', () => {
  let mcpActivities: MCPActivities;
  let configService: ConfigService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        DASHSCOPE_API_KEY: 'test-api-key',
        NODE_ENV: 'test',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(() => {
    configService = mockConfigService as any;
    mcpActivities = createMCPActivities(configService);
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
  });

  // Helper function to initialize MCP connection with mocked response
  const initializeMCPConnection = async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stock_code: '000001' }),
    } as Response);
    await mcpActivities.initializeMCPConnection();
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('连接管理', () => {
    it('应该成功初始化MCP连接', async () => {
      // Mock successful connection test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stock_code: '000001' }),
      } as Response);

      const result = await mcpActivities.initializeMCPConnection();
      expect(result).toBe(true);
    });

    it('应该成功测试MCP连接', async () => {
      // Mock successful connection test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stock_code: '000001' }),
      } as Response);

      const result = await mcpActivities.testMCPConnection();
      expect(result).toBe(true);
    });

    it('应该在API密钥未设置时抛出错误', async () => {
      const configWithoutApiKey = {
        get: jest.fn().mockReturnValue(undefined),
      };
      
      const mcpActivitiesWithoutKey = createMCPActivities(configWithoutApiKey as any);
      
      await expect(mcpActivitiesWithoutKey.initializeMCPConnection()).rejects.toThrow(
        'DASHSCOPE_API_KEY 环境变量未设置'
      );
    });

    it('应该成功断开MCP连接', async () => {
      await expect(mcpActivities.disconnectMCP()).resolves.toBeUndefined();
    });
  });

  describe('股票基本信息获取', () => {
    it('应该成功获取股票基本信息', async () => {
      // Mock connection initialization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stock_code: '000001' }),
      } as Response);
      
      await mcpActivities.initializeMCPConnection();
      
      const mockResponse = {
        stock_code: '000001',
        stock_name: '模拟股票',
        market: '深圳',
        industry: '模拟行业',
        total_shares: 1000000000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getStockBasicInfo({
        stock_code: '000001',
      });

      expect(result).toBeDefined();
      expect(result.stock_code).toBe('000001');
      expect(result.stock_name).toBe('模拟股票');
      expect(result.market).toBe('深圳');
      expect(result.industry).toBe('模拟行业');
      expect(result.total_shares).toBe(1000000000);
    });

    it('应该返回正确的股票基本信息格式', async () => {
      const mockResponse = {
        stock_code: '600036',
        stock_name: '模拟股票',
        market: '上海',
        industry: '模拟行业',
        listing_date: '2025-01-01',
        total_shares: 1000000000,
        market_cap: 50000000000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getStockBasicInfo({
        stock_code: '600036',
      });

      expect(result).toMatchObject({
        stock_code: '600036',
        stock_name: expect.any(String),
        market: expect.any(String),
        industry: expect.any(String),
        listing_date: expect.any(String),
        total_shares: expect.any(Number),
        market_cap: expect.any(Number),
      });
    });
  });

  describe('实时行情数据获取', () => {
    it('应该成功获取实时行情数据', async () => {
      const mockResponse = {
        stock_code: '000001',
        current_price: 45.67,
        change: 1.23,
        change_percent: 2.77,
        volume: 12345678,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getStockRealtimeData({
        stock_code: '000001',
      });

      expect(result).toBeDefined();
      expect(result.stock_code).toBe('000001');
      expect(result.current_price).toBe(45.67);
      expect(result.change).toBe(1.23);
      expect(result.change_percent).toBe(2.77);
      expect(result.volume).toBe(12345678);
    });

    it('应该返回正确的实时数据格式', async () => {
      const mockResponse = {
        stock_code: '600036',
        current_price: 50.25,
        change: 1.25,
        change_percent: 2.55,
        volume: 1500000,
        turnover: 75000000,
        high: 51.20,
        low: 49.80,
        open: 50.00,
        timestamp: '2025-08-24 09:30:00',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getStockRealtimeData({
        stock_code: '600036',
      });

      expect(result).toMatchObject({
        stock_code: '600036',
        current_price: expect.any(Number),
        change: expect.any(Number),
        change_percent: expect.any(Number),
        volume: expect.any(Number),
        turnover: expect.any(Number),
        high: expect.any(Number),
        low: expect.any(Number),
        open: expect.any(Number),
        timestamp: expect.any(String),
      });
    });
  });

  describe('历史数据获取', () => {
    it('应该成功获取历史数据', async () => {
      const mockResponse = {
        stock_code: '000001',
        period: 'daily',
        data: [
          {
            date: '2025-01-01',
            open: 50.00,
            high: 51.00,
            low: 49.50,
            close: 50.50,
            volume: 1000000,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getStockHistoricalData({
        stock_code: '000001',
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        period: 'daily',
      });

      expect(result).toBeDefined();
      expect(result.stock_code).toBe('000001');
      expect(result.period).toBe('daily');
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('应该返回正确的历史数据格式', async () => {
      const mockResponse = {
        stock_code: '600036',
        period: 'daily',
        data: [
          {
            date: '2025-01-01',
            open: 50.00,
            high: 51.00,
            low: 49.50,
            close: 50.50,
            volume: 1000000,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getStockHistoricalData({
        stock_code: '600036',
        start_date: '2025-01-01',
        end_date: '2025-01-31',
      });

      expect(result.data[0]).toMatchObject({
        date: expect.any(String),
        open: expect.any(Number),
        high: expect.any(Number),
        low: expect.any(Number),
        close: expect.any(Number),
        volume: expect.any(Number),
      });
    });
  });

  describe('技术指标获取', () => {
    it('应该成功获取技术指标', async () => {
      const mockResponse = {
        stock_code: '000001',
        indicators: {
          MA5: 45.23,
          MA10: 44.80,
          RSI: 65.4,
          MACD: 0.23,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getStockTechnicalIndicators({
        stock_code: '000001',
        indicators: ['MA5', 'MA10', 'RSI', 'MACD'],
        start_date: '2025-01-01',
        end_date: '2025-01-31',
      });

      expect(result).toBeDefined();
      expect(result.stock_code).toBe('000001');
      expect(result.indicators).toBeDefined();
      expect(result.indicators.MA5).toBe(45.23);
      expect(result.indicators.RSI).toBe(65.4);
      expect(result.indicators.MACD).toBe(0.23);
    });

    it('应该返回正确的技术指标格式', async () => {
      const mockResponse = {
        stock_code: '600036',
        indicators: {
          MA5: 45.23,
          MA10: 44.80,
          MA20: 43.50,
          RSI: 65.4,
          MACD: 0.23,
          BOLL_UPPER: 52.0,
          BOLL_MIDDLE: 50.0,
          BOLL_LOWER: 48.0,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getStockTechnicalIndicators({
        stock_code: '600036',
        indicators: ['BOLL_UPPER', 'BOLL_MIDDLE', 'BOLL_LOWER'],
        start_date: '2025-01-01',
        end_date: '2025-01-31',
      });

      expect(result.indicators).toMatchObject({
        MA5: expect.any(Number),
        MA10: expect.any(Number),
        MA20: expect.any(Number),
        RSI: expect.any(Number),
        MACD: expect.any(Number),
        BOLL_UPPER: expect.any(Number),
        BOLL_MIDDLE: expect.any(Number),
        BOLL_LOWER: expect.any(Number),
      });
    });
  });

  describe('财务数据获取', () => {
    it('应该成功获取财务数据', async () => {
      const mockResponse = {
        stock_code: '000001',
        report_type: 'annual',
        financial_data: {
          revenue: 15000000000,
          net_income: 2500000000,
          eps: 2.50,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getStockFinancialData({
        stock_code: '000001',
        report_type: 'annual',
        period: '2023',
      });

      expect(result).toBeDefined();
      expect(result.stock_code).toBe('000001');
      expect(result.report_type).toBe('annual');
      expect(result.financial_data).toBeDefined();
      expect(result.financial_data.revenue).toBe(15000000000);
      expect(result.financial_data.eps).toBe(2.50);
    });

    it('应该返回正确的财务数据格式', async () => {
      const mockResponse = {
        stock_code: '600036',
        report_type: 'quarterly',
        financial_data: {
          revenue: 8000000000,
          net_income: 1200000000,
          total_assets: 50000000000,
          total_liabilities: 30000000000,
          shareholders_equity: 20000000000,
          eps: 1.80,
          roe: 0.15,
          debt_ratio: 0.60,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getStockFinancialData({
        stock_code: '600036',
        report_type: 'quarterly',
        period: '2023Q4',
      });

      expect(result.financial_data).toMatchObject({
        revenue: expect.any(Number),
        net_income: expect.any(Number),
        total_assets: expect.any(Number),
        total_liabilities: expect.any(Number),
        shareholders_equity: expect.any(Number),
        eps: expect.any(Number),
        roe: expect.any(Number),
        debt_ratio: expect.any(Number),
      });
    });
  });

  describe('市场概览获取', () => {
    it('应该成功获取市场概览', async () => {
      const mockResponse = {
        market_summary: {
          shanghai_index: {
            value: 3245.67,
            change: 12.34,
            change_percent: 0.38,
          },
          shenzhen_index: {
            value: 2156.89,
            change: -5.67,
            change_percent: -0.26,
          },
          gem_index: {
            value: 2458.12,
            change: 15.78,
            change_percent: 0.65,
          },
        },
        market_sentiment: '乐观',
        trading_volume: 485000000000,
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getMarketOverview();

      expect(result).toBeDefined();
      expect(result.market_summary).toBeDefined();
      expect(result.market_summary.shanghai_index).toBeDefined();
      expect(result.market_summary.shenzhen_index).toBeDefined();
      expect(result.market_summary.gem_index).toBeDefined();
      expect(result.market_sentiment).toBe('乐观');
    });

    it('应该返回正确的市场概览格式', async () => {
      const mockResponse = {
        market_summary: {
          shanghai_index: {
            value: 3245.67,
            change: 12.34,
            change_percent: 0.38,
          },
        },
        market_sentiment: '乐观',
        trading_volume: 485000000000,
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getMarketOverview({});

      expect(result.market_summary.shanghai_index).toMatchObject({
        value: expect.any(Number),
        change: expect.any(Number),
        change_percent: expect.any(Number),
      });
      
      expect(result).toMatchObject({
        market_summary: expect.any(Object),
        market_sentiment: expect.any(String),
        trading_volume: expect.any(Number),
        timestamp: expect.any(String),
      });
    });
  });

  describe('股票搜索', () => {
    it('应该成功搜索股票', async () => {
      const mockResponse = {
        keyword: '银行',
        results: [
          {
            stock_code: '000001',
            stock_name: '平安银行',
            market: '深圳',
            industry: '银行',
            current_price: 12.34,
          },
          {
            stock_code: '600036',
            stock_name: '招商银行',
            market: '上海',
            industry: '银行',
            current_price: 45.67,
          },
        ],
        total: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.searchStocks({
        keyword: '银行',
      });

      expect(result).toBeDefined();
      expect(result.keyword).toBe('银行');
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('应该返回正确的搜索结果格式', async () => {
      const mockResponse = {
        keyword: '科技',
        results: [
          {
            stock_code: '000001',
            stock_name: '科技股份',
            market: '深圳',
            industry: '信息技术',
            current_price: 25.80,
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.searchStocks({
        keyword: '科技',
      });

      expect(result.results[0]).toMatchObject({
        stock_code: expect.any(String),
        stock_name: expect.any(String),
        market: expect.any(String),
        industry: expect.any(String),
        current_price: expect.any(Number),
      });
    });
  });

  describe('股票新闻获取', () => {
    it('应该成功获取股票新闻', async () => {
      const mockResponse = {
        stock_code: '000001',
        news: [
          {
            title: '股票利好消息发布',
            summary: '公司发布季度业绩报告，超出市场预期',
            source: '财经新闻',
            publish_time: new Date().toISOString(),
            sentiment: '正面',
            relevance_score: 0.85,
          },
          {
            title: '行业政策调整影响分析',
            summary: '监管政策调整对相关行业带来影响',
            source: '行业分析',
            publish_time: new Date().toISOString(),
            sentiment: '中性',
            relevance_score: 0.72,
          },
        ],
        total: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getStockNews({
        stock_code: '000001',
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        limit: 5,
      });

      expect(result).toBeDefined();
      expect(result.stock_code).toBe('000001');
      expect(result.news).toBeInstanceOf(Array);
      expect(result.news.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('应该返回正确的新闻格式', async () => {
      const mockResponse = {
        keyword: '市场',
        news: [
          {
            title: '市场分析报告',
            summary: '综合市场表现分析',
            source: '证券时报',
            publish_time: new Date().toISOString(),
            sentiment: '中性',
            relevance_score: 0.75,
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await mcpActivities.getStockNews({
        keyword: '市场',
        limit: 10,
      });

      expect(result.news[0]).toMatchObject({
        title: expect.any(String),
        summary: expect.any(String),
        source: expect.any(String),
        publish_time: expect.any(String),
        sentiment: expect.any(String),
        relevance_score: expect.any(Number),
      });
    });
  });

  describe('基础工具调用', () => {
    it('应该成功调用MCP工具', async () => {
      // Mock connection test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stock_code: '000001' }),
      } as Response);
      
      // Mock tool call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stock_code: '000001', stock_name: '模拟股票' }),
      } as Response);

      // 先初始化连接
      await mcpActivities.initializeMCPConnection();
      
      const result = await mcpActivities.callMCPTool({
        toolName: 'get_stock_basic_info',
        parameters: { stock_code: '000001' },
      });

      expect(result).toBeDefined();
      expect(result.stock_code).toBe('000001');
    });

    it('应该在调用不支持的工具时抛出错误', async () => {
      // Mock connection test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stock_code: '000001' }),
      } as Response);

      // 先初始化连接
      await mcpActivities.initializeMCPConnection();
      
      await expect(
        mcpActivities.callMCPTool({
          toolName: 'unsupported_tool',
          parameters: {},
        })
      ).rejects.toThrow('不支持的MCP工具: unsupported_tool');
    });
  });

  describe('并行调用测试', () => {
    it('应该支持并行调用多个MCP工具', async () => {
      // Mock multiple responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ stock_code: '000001', stock_name: '模拟股票' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ stock_code: '000001', current_price: 50.0 }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ market_summary: { shanghai_index: { value: 3000 } } }),
        } as Response);

      const promises = [
        mcpActivities.getStockBasicInfo({ stock_code: '000001' }),
        mcpActivities.getStockRealtimeData({ stock_code: '000001' }),
        mcpActivities.getMarketOverview(),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0].stock_code).toBe('000001');
      expect(results[1].stock_code).toBe('000001');
      expect(results[2].market_summary).toBeDefined();
    });

    it('应该在并行调用中正确处理错误', async () => {
      // Mock one success and one failure
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ stock_code: '000001', stock_name: '模拟股票' }),
        } as Response);

      const promises = [
        mcpActivities.getStockBasicInfo({ stock_code: '000001' }),
        mcpActivities.callMCPTool({
          toolName: 'invalid_tool',
          parameters: {},
        }),
      ];

      const results = await Promise.allSettled(promises);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });
  });
});