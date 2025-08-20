import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ComprehensiveAnalystAgent } from './comprehensive-analyst.agent';
import { LLMService } from '../services/llm.service';
import { MCPClientService } from '../services/mcp-client.service';
import { AgentContext, AgentType } from '../interfaces/agent.interface';

describe('ComprehensiveAnalystAgent', () => {
  let agent: ComprehensiveAnalystAgent;
  let llmService: LLMService;
  let mcpClient: MCPClientService;

  const mockLLMService = {
    generateWithTools: jest.fn(),
    generate: jest.fn(),
  };

  const mockMCPClient = {
    initialize: jest.fn(),
    isConnectedToMCP: jest.fn(() => true),
    getToolDefinitions: jest.fn(() => [
      {
        type: 'function',
        function: {
          name: 'get_stock_basic_info',
          description: '获取股票基本信息',
          parameters: {
            type: 'object',
            properties: {
              stock_code: { type: 'string', description: '股票代码' }
            },
            required: ['stock_code']
          }
        }
      }
    ]),
    callTool: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        'COMPREHENSIVE_ANALYST_MODEL': 'qwen-plus',
        'COMPREHENSIVE_ANALYST_TEMPERATURE': 0.7,
        'COMPREHENSIVE_ANALYST_MAX_TOKENS': 4000,
        'COMPREHENSIVE_ANALYST_TIMEOUT': 60,
        'COMPREHENSIVE_ANALYST_RETRY_COUNT': 3,
        'DASHSCOPE_STANDARD_MODEL': 'qwen-plus',
        'LLM_DEFAULT_TEMPERATURE': 0.7,
        'LLM_DEFAULT_MAX_TOKENS': 4000,
        'LLM_DEFAULT_TIMEOUT': 60,
        'LLM_MAX_RETRIES': 3,
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComprehensiveAnalystAgent,
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: MCPClientService,
          useValue: mockMCPClient,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    agent = module.get<ComprehensiveAnalystAgent>(ComprehensiveAnalystAgent);
    llmService = module.get<LLMService>(LLMService);
    mcpClient = module.get<MCPClientService>(MCPClientService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('智能体初始化', () => {
    it('应该正确初始化综合分析师', () => {
      expect(agent).toBeDefined();
      expect(agent.name).toBe('综合分析师');
      expect(agent.type).toBe(AgentType.COMPREHENSIVE_ANALYST);
      expect(agent.role).toBe('集技术分析、基本面分析、新闻分析于一体的全能分析师');
    });

    it('应该正确配置LLM参数', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('COMPREHENSIVE_ANALYST_MODEL', 'qwen-plus');
      expect(mockConfigService.get).toHaveBeenCalledWith('COMPREHENSIVE_ANALYST_TEMPERATURE', 0.7);
      expect(mockConfigService.get).toHaveBeenCalledWith('COMPREHENSIVE_ANALYST_MAX_TOKENS', 4000);
    });
  });

  describe('股票分析功能', () => {
    const testContext: AgentContext = {
      stockCode: '000001',
      stockName: '平安银行',
      timeRange: {
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-08-01'),
      },
    };

    it('应该成功执行综合分析', async () => {
      const mockLLMResponse = {
        content: `# 000001 综合分析报告

## 技术分析
- 短期趋势：上升
- 支撑位：15.80元
- 阻力位：17.20元

## 基本面分析  
- ROE：15.2%
- 净利润增长率：12.5%
- 市盈率：6.8倍

## 消息面分析
- 近期获得监管批复，业务扩张预期
- 银行板块政策支持力度加大

## 综合评估
- 技术面评分：75/100分
- 短期建议：买入
- 目标价位：16.50-17.00元`,
        finishReason: 'stop',
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
        },
        toolCalls: [
          {
            id: 'call_1',
            function: {
              name: 'get_stock_basic_info',
              arguments: JSON.stringify({ stock_code: '000001' }),
            },
          },
        ],
      };

      mockLLMService.generateWithTools.mockResolvedValue(mockLLMResponse);
      mockMCPClient.callTool.mockResolvedValue('股票基本信息数据');

      const result = await agent.analyze(testContext);

      expect(result).toBeDefined();
      expect(result.agentName).toBe('综合分析师');
      expect(result.agentType).toBe(AgentType.COMPREHENSIVE_ANALYST);
      expect(result.analysis).toContain('000001');
      expect(result.analysis).toContain('综合分析报告');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('应该正确提取评分信息', async () => {
      const mockAnalysis = `
# 股票分析报告
技术面评分: 85分
置信度: 0.8
短期建议: 买入
目标价格: 50.0元
`;

      const mockLLMResponse = {
        content: mockAnalysis,
        finishReason: 'stop',
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      };

      mockLLMService.generateWithTools.mockResolvedValue(mockLLMResponse);

      const result = await agent.analyze(testContext);

      expect(result.score).toBe(85);
      expect(result.confidence).toBe(0.8);
      expect(result.recommendation).toBe('BUY');
    });

    it('应该处理MCP工具调用', async () => {
      const mockLLMResponse = {
        content: '基础分析内容',
        finishReason: 'stop',
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        toolCalls: [
          {
            id: 'call_1',
            function: {
              name: 'get_stock_basic_info',
              arguments: JSON.stringify({ stock_code: '000001' }),
            },
          },
          {
            id: 'call_2', 
            function: {
              name: 'get_stock_realtime_data',
              arguments: JSON.stringify({ stock_code: '000001' }),
            },
          },
        ],
      };

      const mockToolResults = [
        '股票基本信息：平安银行...',
        '实时行情：当前价格 16.25元...',
      ];

      mockLLMService.generateWithTools.mockResolvedValue(mockLLMResponse);
      mockMCPClient.callTool
        .mockResolvedValueOnce(mockToolResults[0])
        .mockResolvedValueOnce(mockToolResults[1]);

      const result = await agent.analyze(testContext);

      expect(mockMCPClient.callTool).toHaveBeenCalledTimes(2);
      expect(mockMCPClient.callTool).toHaveBeenCalledWith(
        'get_stock_basic_info',
        { stock_code: '000001' }
      );
      expect(mockMCPClient.callTool).toHaveBeenCalledWith(
        'get_stock_realtime_data', 
        { stock_code: '000001' }
      );

      expect(result.analysis).toContain('基础分析内容');
      expect(result.analysis).toContain('MCP数据获取结果');
      expect(result.analysis).toContain('股票基本信息：平安银行');
    });

    it('应该处理MCP连接初始化', async () => {
      mockMCPClient.isConnectedToMCP.mockReturnValue(false);
      
      const mockLLMResponse = {
        content: '分析内容',
        finishReason: 'stop',
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      };

      mockLLMService.generateWithTools.mockResolvedValue(mockLLMResponse);

      await agent.analyze(testContext);

      expect(mockMCPClient.initialize).toHaveBeenCalled();
    });

    it('应该设置默认时间范围', async () => {
      const contextWithoutTimeRange: AgentContext = {
        stockCode: '000001',
        stockName: '平安银行',
      };

      const mockLLMResponse = {
        content: '分析结果',
        finishReason: 'stop', 
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      };

      mockLLMService.generateWithTools.mockResolvedValue(mockLLMResponse);

      const result = await agent.analyze(contextWithoutTimeRange);

      expect(result).toBeDefined();
      // 验证是否设置了默认的60天时间范围
      const calls = mockLLMService.generateWithTools.mock.calls;
      expect(calls[0][0]).toContain('60天');
    });
  });

  describe('错误处理', () => {
    const testContext: AgentContext = {
      stockCode: '000001',
      stockName: '平安银行',
    };

    it('应该处理LLM调用失败', async () => {
      mockLLMService.generateWithTools.mockRejectedValue(new Error('LLM调用失败'));

      await expect(agent.analyze(testContext)).rejects.toThrow('LLM调用失败');
    });

    it('应该处理MCP工具调用失败', async () => {
      const mockLLMResponse = {
        content: '基础内容',
        finishReason: 'stop',
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        toolCalls: [
          {
            id: 'call_1',
            function: {
              name: 'get_stock_basic_info',
              arguments: JSON.stringify({ stock_code: '000001' }),
            },
          },
        ],
      };

      mockLLMService.generateWithTools.mockResolvedValue(mockLLMResponse);
      mockMCPClient.callTool.mockRejectedValue(new Error('MCP工具调用失败'));

      const result = await agent.analyze(testContext);

      expect(result.analysis).toContain('基础内容');
      expect(result.analysis).toContain('MCP工具调用失败');
    });

    it('应该处理MCP初始化失败', async () => {
      mockMCPClient.isConnectedToMCP.mockReturnValue(false);
      mockMCPClient.initialize.mockRejectedValue(new Error('MCP初始化失败'));

      await expect(agent.analyze(testContext)).rejects.toThrow('MCP初始化失败');
    });
  });

  describe('提示词构建', () => {
    it('应该构建正确的分析提示词', async () => {
      const testContext: AgentContext = {
        stockCode: '000001',
        stockName: '平安银行',
        timeRange: {
          startDate: new Date('2025-07-01'),
          endDate: new Date('2025-08-01'),
        },
      };

      const mockLLMResponse = {
        content: '分析结果',
        finishReason: 'stop',
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      };

      mockLLMService.generateWithTools.mockResolvedValue(mockLLMResponse);

      await agent.analyze(testContext);

      const prompt = mockLLMService.generateWithTools.mock.calls[0][0];
      
      expect(prompt).toContain('000001');
      expect(prompt).toContain('平安银行');
      expect(prompt).toContain('2025-7-1');
      expect(prompt).toContain('2025-8-1');
      expect(prompt).toContain('get_stock_basic_info');
      expect(prompt).toContain('get_stock_realtime_data');
      expect(prompt).toContain('get_stock_historical_data');
      expect(prompt).toContain('综合分析报告');
    });
  });
});