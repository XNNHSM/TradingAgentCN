import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionRecordsService } from './execution-records.service';
import { AgentExecutionRecordService } from '../services/agent-execution-record.service';
import { AgentExecutionRecord } from '../entities/agent-execution-record.entity';

describe('ExecutionRecordsService', () => {
  let service: ExecutionRecordsService;
  let executionRecordService: AgentExecutionRecordService;

  const mockExecutionRecordService = {
    getRecordsBySessionId: jest.fn(),
    getAgentCallHistory: jest.fn(),
    getStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionRecordsService,
        {
          provide: AgentExecutionRecordService,
          useValue: mockExecutionRecordService,
        },
      ],
    }).compile();

    service = module.get<ExecutionRecordsService>(ExecutionRecordsService);
    executionRecordService = module.get<AgentExecutionRecordService>(AgentExecutionRecordService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRecordsBySessionId', () => {
    it('should return records by session ID', async () => {
      const sessionId = 'test-session-123';
      const mockRecords = [
        {
          id: 1,
          sessionId,
          agentType: 'BasicDataAgent',
          agentName: 'Basic Data Agent',
          llmProvider: 'dashscope',
          llmModel: 'qwen-plus',
          inputMessages: {},
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          executionTimeMs: 1000,
          status: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          version: 1,
        },
      ] as AgentExecutionRecord[];

      mockExecutionRecordService.getRecordsBySessionId.mockResolvedValue(mockRecords);

      const result = await service.getRecordsBySessionId(sessionId);

      expect(executionRecordService.getRecordsBySessionId).toHaveBeenCalledWith(sessionId);
      expect(result).toEqual(mockRecords);
    });

    it('should handle errors', async () => {
      const sessionId = 'test-session-123';
      const error = new Error('Database error');

      mockExecutionRecordService.getRecordsBySessionId.mockRejectedValue(error);

      await expect(service.getRecordsBySessionId(sessionId)).rejects.toThrow('Database error');
    });
  });

  describe('getAgentCallHistory', () => {
    it('should return paginated agent call history', async () => {
      const agentType = 'BasicDataAgent';
      const page = 1;
      const limit = 20;
      const mockRecords = [
        {
          id: 1,
          sessionId: 'session-1',
          agentType,
          agentName: 'Basic Data Agent',
          llmProvider: 'dashscope',
          llmModel: 'qwen-plus',
          inputMessages: {},
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          executionTimeMs: 1000,
          status: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          version: 1,
        },
        {
          id: 2,
          sessionId: 'session-2',
          agentType,
          agentName: 'Basic Data Agent',
          llmProvider: 'dashscope',
          llmModel: 'qwen-plus',
          inputMessages: {},
          inputTokens: 80,
          outputTokens: 40,
          totalTokens: 120,
          executionTimeMs: 800,
          status: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          version: 1,
        },
      ] as AgentExecutionRecord[];

      mockExecutionRecordService.getAgentCallHistory.mockResolvedValue(mockRecords);

      const result = await service.getAgentCallHistory(agentType, page, limit);

      expect(executionRecordService.getAgentCallHistory).toHaveBeenCalledWith(agentType, 20);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.total).toBe(2);
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    });
  });

  describe('getExecutionStats', () => {
    it('should return execution statistics', async () => {
      const filters = { agentType: 'BasicDataAgent' };
      const mockStats = {
        totalExecutions: 100,
        successRate: 0.95,
        avgExecutionTime: 1500,
        tokenUsage: {
          totalInputTokens: 10000,
          totalOutputTokens: 5000,
          totalTokens: 15000,
        },
        byAgentType: {},
        byLLMModel: {},
        byDate: {},
      };

      mockExecutionRecordService.getStats.mockResolvedValue(mockStats);

      const result = await service.getExecutionStats(filters);

      expect(executionRecordService.getStats).toHaveBeenCalledWith(filters);
      expect(result.data).toEqual(mockStats);
    });
  });

  describe('getPopularAgents', () => {
    it('should return popular agents statistics', async () => {
      const mockStats = {
        totalExecutions: 100,
        successRate: 0.95,
        avgExecutionTime: 1500,
        tokenUsage: {
          totalInputTokens: 10000,
          totalOutputTokens: 5000,
          totalTokens: 15000,
        },
        byAgentType: {
          'BasicDataAgent': { count: 50, successRate: 0.98, avgExecutionTime: 1200, totalTokens: 7500 },
          'TechnicalAnalystAgent': { count: 30, successRate: 0.90, avgExecutionTime: 1800, totalTokens: 4500 },
        },
        byLLMModel: {},
        byDate: {},
      };

      mockExecutionRecordService.getStats.mockResolvedValue(mockStats);

      const result = await service.getPopularAgents();

      expect(result.data.popularAgents).toHaveLength(2);
      expect(result.data.popularAgents[0].agentType).toBe('BasicDataAgent');
      expect(result.data.totalExecutions).toBe(100);
    });
  });

  describe('getTokenUsageStats', () => {
    it('should return token usage statistics', async () => {
      const mockStats = {
        totalExecutions: 100,
        successRate: 0.95,
        avgExecutionTime: 1500,
        tokenUsage: {
          totalInputTokens: 10000,
          totalOutputTokens: 5000,
          totalTokens: 15000,
        },
        byAgentType: {},
        byLLMModel: {
          'qwen-plus': { count: 60, successRate: 0.95, totalTokens: 9000 },
          'qwen-turbo': { count: 40, successRate: 0.95, totalTokens: 6000 },
        },
        byDate: {
          '2023-01-01': 10,
          '2023-01-02': 15,
        },
      };

      mockExecutionRecordService.getStats.mockResolvedValue(mockStats);

      const result = await service.getTokenUsageStats();

      expect(result.data.totalTokens).toBe(15000);
      expect(result.data.avgTokensPerCall).toBe(150);
      expect(result.data.byLLMModel).toEqual(mockStats.byLLMModel);
      expect(result.data.dailyUsage).toEqual(mockStats.byDate);
    });
  });
});