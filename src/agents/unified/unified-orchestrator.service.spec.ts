import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnifiedOrchestratorService } from './unified-orchestrator.service';
import { ComprehensiveAnalystAgent } from './comprehensive-analyst.agent';
import { TradingStrategistAgent } from './trading-strategist.agent';
import { MCPClientService } from '../services/mcp-client.service';
import { AgentContext, AgentType, AgentResult, TradingRecommendation } from '../interfaces/agent.interface';

describe('UnifiedOrchestratorService', () => {
  let service: UnifiedOrchestratorService;
  let comprehensiveAnalyst: ComprehensiveAnalystAgent;
  let tradingStrategist: TradingStrategistAgent;
  let mcpClient: MCPClientService;

  const mockMCPClient = {
    initialize: jest.fn(),
    isConnectedToMCP: jest.fn(() => true),
    disconnect: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockComprehensiveAnalyst = {
    analyze: jest.fn(),
    name: '综合分析师',
    type: AgentType.COMPREHENSIVE_ANALYST,
  };

  const mockTradingStrategist = {
    analyze: jest.fn(),
    name: '交易策略师',
    type: AgentType.TRADING_STRATEGIST,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnifiedOrchestratorService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MCPClientService,
          useValue: mockMCPClient,
        },
        {
          provide: ComprehensiveAnalystAgent,
          useValue: mockComprehensiveAnalyst,
        },
        {
          provide: TradingStrategistAgent,
          useValue: mockTradingStrategist,
        },
      ],
    }).compile();

    service = module.get<UnifiedOrchestratorService>(UnifiedOrchestratorService);
    comprehensiveAnalyst = module.get<ComprehensiveAnalystAgent>(ComprehensiveAnalystAgent);
    tradingStrategist = module.get<TradingStrategistAgent>(TradingStrategistAgent);
    mcpClient = module.get<MCPClientService>(MCPClientService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('服务初始化', () => {
    it('应该正确创建统一协调服务', () => {
      expect(service).toBeDefined();
    });

    it('应该正确获取服务状态', () => {
      const status = service.getServiceStatus();
      
      expect(status).toEqual({
        mcpConnection: true,
        availableAgents: ['ComprehensiveAnalyst', 'TradingStrategist'],
        lastAnalysisTime: expect.any(Date),
      });
    });
  });

  describe('股票分析流程', () => {
    const testContext: AgentContext = {
      stockCode: '000001',
      stockName: '平安银行',
      timeRange: {
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-08-01'),
      },
    };

    const mockComprehensiveResult: AgentResult = {
      agentName: '综合分析师',
      agentType: AgentType.COMPREHENSIVE_ANALYST,
      analysis: '综合分析结果：技术面评分80分，基本面良好...',
      score: 80,
      recommendation: TradingRecommendation.BUY,
      confidence: 0.85,
      keyInsights: ['技术面强势', '基本面稳健', '行业前景良好'],
      risks: ['市场系统性风险', '行业政策风险'],
      timestamp: new Date(),
      processingTime: 5000,
    };

    const mockStrategyResult: AgentResult = {
      agentName: '交易策略师',
      agentType: AgentType.TRADING_STRATEGIST,
      analysis: '交易策略：建议分批建仓，目标价位16.5-17.0元...',
      score: 75,
      recommendation: TradingRecommendation.BUY,
      confidence: 0.8,
      keyInsights: ['适合中长期持有', '风险可控', '仓位建议20%'],
      risks: ['短期波动风险'],
      timestamp: new Date(),
      processingTime: 4000,
    };

    it('应该成功执行完整的股票分析流程', async () => {
      mockComprehensiveAnalyst.analyze.mockResolvedValue(mockComprehensiveResult);
      mockTradingStrategist.analyze.mockResolvedValue(mockStrategyResult);

      const result = await service.analyzeStock(testContext);

      expect(result).toBeDefined();
      expect(result.sessionId).toMatch(/^mcp_session_\d+$/);
      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual(mockComprehensiveResult);
      expect(result.results[1]).toEqual(mockStrategyResult);
      expect(result.finalRecommendation).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);

      // 验证调用顺序和参数
      expect(mockComprehensiveAnalyst.analyze).toHaveBeenCalledWith({
        ...testContext,
        metadata: {
          sessionId: expect.stringMatching(/^mcp_session_\d+$/),
          analysisType: 'comprehensive',
        },
      });

      expect(mockTradingStrategist.analyze).toHaveBeenCalledWith({
        ...testContext,
        metadata: {
          sessionId: expect.stringMatching(/^mcp_session_\d+$/),
          analysisType: 'strategy',
        },
        previousResults: [mockComprehensiveResult],
      });
    });

    it('应该正确生成最终综合建议', async () => {
      mockComprehensiveAnalyst.analyze.mockResolvedValue(mockComprehensiveResult);
      mockTradingStrategist.analyze.mockResolvedValue(mockStrategyResult);

      const result = await service.analyzeStock(testContext);
      const finalRec = result.finalRecommendation;

      expect(finalRec.agentName).toBe('MCP智能投顾系统');
      expect(finalRec.agentType).toBe(AgentType.COMPREHENSIVE_ANALYST);
      expect(finalRec.score).toBe(78); // 80 * 0.7 + 75 * 0.3 = 78.5 -> 78
      expect(finalRec.recommendation).toBe('BUY');
      expect(finalRec.confidence).toBeCloseTo(0.825); // (0.85 + 0.8) / 2
      expect(finalRec.keyInsights).toHaveLength(6); // 合并后的洞察
      expect(finalRec.risks).toHaveLength(3); // 合并后的风险
      expect(finalRec.analysis).toContain('MCP智能投顾综合报告');
      expect(finalRec.analysis).toContain('000001');
      expect(finalRec.supportingData?.componentResults).toHaveLength(2);
    });

    it('应该处理MCP未连接的情况', async () => {
      mockMCPClient.isConnectedToMCP.mockReturnValue(false);
      mockComprehensiveAnalyst.analyze.mockResolvedValue(mockComprehensiveResult);
      mockTradingStrategist.analyze.mockResolvedValue(mockStrategyResult);

      await service.analyzeStock(testContext);

      expect(mockMCPClient.initialize).toHaveBeenCalled();
    });

    it('应该正确处理会话ID', async () => {
      const contextWithSessionId = {
        ...testContext,
        metadata: { sessionId: 'custom_session_123' },
      };

      mockComprehensiveAnalyst.analyze.mockResolvedValue(mockComprehensiveResult);
      mockTradingStrategist.analyze.mockResolvedValue(mockStrategyResult);

      const result = await service.analyzeStock(contextWithSessionId);

      expect(result.sessionId).toBe('custom_session_123');
    });
  });

  describe('批量分析功能', () => {
    const stockCodes = ['000001', '600519', '000002'];

    const createMockResult = (stockCode: string, success: boolean = true): AgentResult => ({
      agentName: success ? '综合分析师' : '',
      agentType: AgentType.COMPREHENSIVE_ANALYST,
      analysis: success ? `${stockCode} 分析完成` : '',
      score: success ? 70 : 0,
      recommendation: TradingRecommendation.HOLD,
      confidence: 0.7,
      timestamp: new Date(),
      processingTime: 3000,
    });

    it('应该成功执行批量分析', async () => {
      // Mock analyzeStock 方法
      const mockAnalyzeStock = jest.spyOn(service, 'analyzeStock');
      
      stockCodes.forEach((code, index) => {
        mockAnalyzeStock.mockResolvedValueOnce({
          sessionId: `session_${code}`,
          results: [createMockResult(code)],
          finalRecommendation: createMockResult(code),
          processingTime: 3000,
        });
      });

      const result = await service.analyzeBatch(stockCodes);

      expect(result).toBeDefined();
      expect(result.sessionId).toMatch(/^mcp_batch_\d+$/);
      expect(result.results).toHaveProperty('000001');
      expect(result.results).toHaveProperty('600519');
      expect(result.results).toHaveProperty('000002');
      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(result.summary.processingTime).toBeGreaterThan(0);

      mockAnalyzeStock.mockRestore();
    });

    it('应该正确处理部分分析失败的情况', async () => {
      const mockAnalyzeStock = jest.spyOn(service, 'analyzeStock');
      
      // 第一个成功
      mockAnalyzeStock.mockResolvedValueOnce({
        sessionId: 'session_000001',
        results: [createMockResult('000001')],
        finalRecommendation: createMockResult('000001'),
        processingTime: 3000,
      });
      
      // 第二个失败
      mockAnalyzeStock.mockRejectedValueOnce(new Error('分析失败'));
      
      // 第三个成功
      mockAnalyzeStock.mockResolvedValueOnce({
        sessionId: 'session_000002',
        results: [createMockResult('000002')],
        finalRecommendation: createMockResult('000002'),
        processingTime: 3000,
      });

      const result = await service.analyzeBatch(stockCodes);

      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.results).toHaveProperty('000001');
      expect(result.results).not.toHaveProperty('600519'); // 失败的股票不应该在结果中
      expect(result.results).toHaveProperty('000002');

      mockAnalyzeStock.mockRestore();
    });
  });

  describe('MCP连接管理', () => {
    it('应该成功重连MCP服务', async () => {
      await service.reconnectMCP();

      expect(mockMCPClient.disconnect).toHaveBeenCalled();
      expect(mockMCPClient.initialize).toHaveBeenCalled();
    });

    it('应该处理MCP重连失败', async () => {
      mockMCPClient.initialize.mockRejectedValue(new Error('MCP连接失败'));

      await expect(service.reconnectMCP()).rejects.toThrow('MCP连接失败');
      expect(mockMCPClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    const testContext: AgentContext = {
      stockCode: '000001',
      stockName: '平安银行',
    };

    it('应该处理综合分析失败', async () => {
      mockComprehensiveAnalyst.analyze.mockRejectedValue(new Error('综合分析失败'));

      await expect(service.analyzeStock(testContext)).rejects.toThrow('综合分析失败');
    });

    it('应该处理交易策略分析失败', async () => {
      const mockComprehensiveResult: AgentResult = {
        agentName: '综合分析师',
        agentType: AgentType.COMPREHENSIVE_ANALYST,
        analysis: '综合分析完成',
        timestamp: new Date(),
      };

      mockComprehensiveAnalyst.analyze.mockResolvedValue(mockComprehensiveResult);
      mockTradingStrategist.analyze.mockRejectedValue(new Error('交易策略分析失败'));

      await expect(service.analyzeStock(testContext)).rejects.toThrow('交易策略分析失败');
    });

    it('应该处理MCP初始化失败', async () => {
      mockMCPClient.isConnectedToMCP.mockReturnValue(false);
      mockMCPClient.initialize.mockRejectedValue(new Error('MCP初始化失败'));

      await expect(service.analyzeStock(testContext)).rejects.toThrow('MCP初始化失败');
    });
  });

  describe('最终报告生成', () => {
    it('应该正确生成投资建议文本', () => {
      const testCases = [
        { rec: 'STRONG_BUY', expected: '强烈买入 🚀' },
        { rec: 'BUY', expected: '买入 📈' },
        { rec: 'HOLD', expected: '持有 ⏸️' },
        { rec: 'SELL', expected: '卖出 📉' },
        { rec: 'STRONG_SELL', expected: '强烈卖出 ⚠️' },
        { rec: undefined, expected: '持有 ⏸️' },
      ];

      testCases.forEach(({ rec, expected }) => {
        const result = service['getRecommendationText'](rec);
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
        const result = service['getRiskLevel'](score);
        expect(result).toBe(expected);
      });
    });
  });
});