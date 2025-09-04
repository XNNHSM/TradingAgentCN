import {Test, TestingModule} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';
import {MCPClientService} from './mcp-client.service';

describe('MCPClientService', () => {
  let service: MCPClientService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      switch (key) {
        case 'DASHSCOPE_API_KEY':
          return 'ali_bailian';
        default:
          return defaultValue;
      }
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MCPClientService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MCPClientService>(MCPClientService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('服务初始化', () => {
    it('应该正确创建MCP客户端服务', () => {
      expect(service).toBeDefined();
      expect(service.isConnectedToMCP()).toBe(false);
    });

    it('应该成功初始化MCP连接', async () => {
      await service.initialize();
      expect(service.isConnectedToMCP()).toBe(true);
    });

    it('API密钥缺失时应该抛出错误', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DASHSCOPE_API_KEY') return undefined;
        return '';
      });

      const newService = new MCPClientService(configService);
      await expect(newService.initialize()).rejects.toThrow('DASHSCOPE_API_KEY 环境变量未设置');
    });
  });

  describe('MCP工具调用', () => {
    beforeEach(async () => {
      // 重置mock以避免之前失败测试的影响
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        switch (key) {
          case 'DASHSCOPE_API_KEY':
            return 'test-api-key-12345';
          default:
            return defaultValue;
        }
      });
      
      await service.initialize();
    });

    it('应该成功获取股票基本信息', async () => {
      const result = await service.callTool('get_stock_basic_info', {
        stock_code: '000001'
      });

      expect(result).toContain('000001');
      expect(result).toContain('股票基本信息');
      expect(result).toContain('阿里云百炼MCP股票数据服务');
    });

    it('应该成功获取股票实时数据', async () => {
      const result = await service.callTool('get_stock_realtime_data', {
        stock_code: '600519'
      });

      expect(result).toContain('600519');
      expect(result).toContain('实时行情');
      expect(result).toContain('当前价格');
    });

    it('应该成功获取股票历史数据', async () => {
      const result = await service.callTool('get_stock_historical_data', {
        stock_code: '000001',
        start_date: '2025-07-01',
        end_date: '2025-08-01'
      });

      expect(result).toContain('000001');
      expect(result).toContain('历史数据');
      expect(result).toContain('2025-07-01');
      expect(result).toContain('2025-08-01');
    });

    it('应该成功获取技术指标', async () => {
      const result = await service.callTool('get_stock_technical_indicators', {
        stock_code: '000001',
        period: 20
      });

      expect(result).toContain('技术指标分析');
      expect(result).toContain('移动平均线');
      expect(result).toContain('MACD');
      expect(result).toContain('RSI');
    });

    it('应该成功获取财务数据', async () => {
      const result = await service.callTool('get_stock_financial_data', {
        stock_code: '000001',
        report_type: 'income',
        period: 'annual'
      });

      expect(result).toContain('财务数据');
      expect(result).toContain('总资产');
      expect(result).toContain('净利润');
    });

    it('应该成功获取市场概览', async () => {
      const result = await service.callTool('get_market_overview', {});

      expect(result).toContain('A股市场概览');
      expect(result).toContain('上证指数');
      expect(result).toContain('深证成指');
    });

    it('应该成功搜索股票', async () => {
      const result = await service.callTool('search_stocks', {
        keyword: '科技'
      });

      expect(result).toContain('股票搜索结果');
      expect(result).toContain('科技');
    });

    it('应该成功获取股票新闻', async () => {
      const result = await service.callTool('get_stock_news', {
        keyword: '科技',
        days: 7
      });

      expect(result).toContain('股票新闻');
      expect(result).toContain('科技');
      expect(result).toContain('7天');
    });

    it('不支持的工具应该抛出错误', async () => {
      await expect(
        service.callTool('unsupported_tool', {})
      ).rejects.toThrow('不支持的MCP工具: unsupported_tool');
    });
  });

  describe('工具定义', () => {
    it('应该返回所有可用工具', () => {
      const tools = service.getAvailableTools();
      expect(tools).toHaveLength(8);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('get_stock_basic_info');
      expect(toolNames).toContain('get_stock_realtime_data');
      expect(toolNames).toContain('get_stock_historical_data');
      expect(toolNames).toContain('get_stock_technical_indicators');
      expect(toolNames).toContain('get_stock_financial_data');
      expect(toolNames).toContain('get_market_overview');
      expect(toolNames).toContain('search_stocks');
      expect(toolNames).toContain('get_stock_news');
    });

    it('应该返回LLM可用的工具定义', () => {
      const toolDefs = service.getToolDefinitions();
      expect(toolDefs.tools).toHaveLength(4);
      
      toolDefs.tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
      });
    });
  });

  describe('连接管理', () => {
    it('应该正确报告连接状态', async () => {
      expect(service.isConnectedToMCP()).toBe(false);
      
      await service.initialize();
      expect(service.isConnectedToMCP()).toBe(true);
      
      await service.disconnect();
      expect(service.isConnectedToMCP()).toBe(false);
    });

    it('未连接时调用工具应该自动初始化', async () => {
      expect(service.isConnectedToMCP()).toBe(false);
      
      const result = await service.callTool('get_market_overview', {});
      expect(result).toContain('A股市场概览');
      expect(service.isConnectedToMCP()).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应该处理工具调用异常', async () => {
      await service.initialize();
      
      // 模拟内部错误
      const originalMethod = service['getStockBasicInfo'];
      service['getStockBasicInfo'] = jest.fn().mockRejectedValue(new Error('API调用失败'));
      
      await expect(
        service.callTool('get_stock_basic_info', { stock_code: '000001' })
      ).rejects.toThrow('API调用失败');
      
      // 恢复原方法
      service['getStockBasicInfo'] = originalMethod;
    });
  });
});