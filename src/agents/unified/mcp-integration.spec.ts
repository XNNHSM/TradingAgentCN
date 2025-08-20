import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MCPClientService } from '../services/mcp-client.service';
import { ComprehensiveAnalystAgent } from './comprehensive-analyst.agent';
import { TradingStrategistAgent } from './trading-strategist.agent';
import { UnifiedOrchestratorService } from './unified-orchestrator.service';
import { LLMService } from '../services/llm.service';
import { AgentType, TradingRecommendation } from '../interfaces/agent.interface';

describe('MCP集成测试', () => {
  let mcpClient: MCPClientService;
  let orchestrator: UnifiedOrchestratorService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        'DASHSCOPE_API_KEY': 'test-api-key-12345',
        'COMPREHENSIVE_ANALYST_MODEL': 'qwen-plus',
        'COMPREHENSIVE_ANALYST_TEMPERATURE': 0.7,
        'COMPREHENSIVE_ANALYST_MAX_TOKENS': 4000,
        'COMPREHENSIVE_ANALYST_TIMEOUT': 60,
        'COMPREHENSIVE_ANALYST_RETRY_COUNT': 3,
        'TRADING_STRATEGIST_MODEL': 'qwen-plus',
        'TRADING_STRATEGIST_TEMPERATURE': 0.6,
        'TRADING_STRATEGIST_MAX_TOKENS': 3000,
        'TRADING_STRATEGIST_TIMEOUT': 45,
        'TRADING_STRATEGIST_RETRY_COUNT': 3,
        'DASHSCOPE_STANDARD_MODEL': 'qwen-plus',
        'LLM_DEFAULT_TEMPERATURE': 0.7,
        'LLM_DEFAULT_MAX_TOKENS': 4000,
        'LLM_DEFAULT_TIMEOUT': 60,
        'LLM_MAX_RETRIES': 3,
      };
      return config[key] || defaultValue;
    }),
  };

  const mockLLMService = {
    generateWithTools: jest.fn(),
    generate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MCPClientService,
        ComprehensiveAnalystAgent,
        TradingStrategistAgent,
        UnifiedOrchestratorService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
      ],
    }).compile();

    mcpClient = module.get<MCPClientService>(MCPClientService);
    orchestrator = module.get<UnifiedOrchestratorService>(UnifiedOrchestratorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('MCP客户端基础功能', () => {
    it('应该正确初始化MCP客户端', async () => {
      expect(mcpClient).toBeDefined();
      await mcpClient.initialize();
      expect(mcpClient.isConnectedToMCP()).toBe(true);
    });

    it('应该正确返回可用工具列表', () => {
      const tools = mcpClient.getAvailableTools();
      expect(tools).toHaveLength(8);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toEqual([
        'get_stock_basic_info',
        'get_stock_realtime_data',
        'get_stock_historical_data',
        'get_stock_technical_indicators',
        'get_stock_financial_data',
        'get_market_overview',
        'search_stocks',
        'get_stock_news',
      ]);
    });

    it('应该正确返回LLM工具定义', () => {
      const toolDefs = mcpClient.getToolDefinitions();
      expect(toolDefs).toHaveLength(8);
      
      toolDefs.forEach(tool => {
        expect(tool).toHaveProperty('type', 'function');
        expect(tool.function).toHaveProperty('name');
        expect(tool.function).toHaveProperty('description');
        expect(tool.function).toHaveProperty('parameters');
      });
    });
  });

  describe('统一协调服务', () => {
    it('应该正确创建统一协调服务', () => {
      expect(orchestrator).toBeDefined();
    });

    it('应该返回正确的服务状态', () => {
      const status = orchestrator.getServiceStatus();
      expect(status.availableAgents).toEqual([
        'ComprehensiveAnalyst',
        'TradingStrategist',
      ]);
    });

    it('应该正确生成建议文本', () => {
      const testCases = [
        { rec: 'STRONG_BUY', expected: '强烈买入 🚀' },
        { rec: 'BUY', expected: '买入 📈' },
        { rec: 'HOLD', expected: '持有 ⏸️' },
        { rec: 'SELL', expected: '卖出 📉' },
        { rec: 'STRONG_SELL', expected: '强烈卖出 ⚠️' },
      ];

      testCases.forEach(({ rec, expected }) => {
        const result = orchestrator['getRecommendationText'](rec);
        expect(result).toBe(expected);
      });
    });

    it('应该正确生成风险等级', () => {
      const testCases = [
        { score: 85, expected: '低风险 🟢' },
        { score: 70, expected: '中等风险 🟡' },
        { score: 50, expected: '较高风险 🟠' },
        { score: 30, expected: '高风险 🔴' },
      ];

      testCases.forEach(({ score, expected }) => {
        const result = orchestrator['getRiskLevel'](score);
        expect(result).toBe(expected);
      });
    });
  });

  describe('MCP工具调用模拟', () => {
    beforeEach(async () => {
      await mcpClient.initialize();
    });

    it('应该成功调用股票基本信息工具', async () => {
      const result = await mcpClient.callTool('get_stock_basic_info', {
        stock_code: '000001'
      });

      expect(result).toContain('股票基本信息');
      expect(result).toContain('000001');
      expect(result).toContain('阿里云百炼MCP股票数据服务');
    });

    it('应该成功调用市场概览工具', async () => {
      const result = await mcpClient.callTool('get_market_overview', {});

      expect(result).toContain('A股市场概览');
      expect(result).toContain('上证指数');
      expect(result).toContain('深证成指');
    });

    it('应该成功调用股票搜索工具', async () => {
      const result = await mcpClient.callTool('search_stocks', {
        keyword: '科技'
      });

      expect(result).toContain('股票搜索结果');
      expect(result).toContain('科技');
    });
  });

  describe('错误处理', () => {
    it('应该处理不支持的工具调用', async () => {
      await mcpClient.initialize();
      
      await expect(
        mcpClient.callTool('unsupported_tool', {})
      ).rejects.toThrow('不支持的MCP工具: unsupported_tool');
    });

    it('应该处理API密钥缺失', async () => {
      // 创建一个没有API密钥的配置
      const badConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'DASHSCOPE_API_KEY') return undefined;
          return '';
        }),
      };

      const badModule = await Test.createTestingModule({
        providers: [
          MCPClientService,
          {
            provide: ConfigService,
            useValue: badConfigService,
          },
        ],
      }).compile();

      const badMcpClient = badModule.get<MCPClientService>(MCPClientService);
      
      await expect(badMcpClient.initialize()).rejects.toThrow(
        'DASHSCOPE_API_KEY 环境变量未设置'
      );
    });
  });
});