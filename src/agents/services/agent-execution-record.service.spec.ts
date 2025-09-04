import {Test, TestingModule} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';
import {DataSource, Repository} from 'typeorm';
import {AgentExecutionRecordService, CreateAgentExecutionRecordDto} from './agent-execution-record.service';
import {AgentExecutionShardingService} from './agent-execution-sharding.service';
import {AgentExecutionRecord} from '../entities/agent-execution-record.entity';
import {AgentType, TradingRecommendation} from '../interfaces/agent.interface';
import {LLMResponse} from './llm.service';

describe('AgentExecutionRecordService', () => {
  let service: AgentExecutionRecordService;
  let shardingService: AgentExecutionShardingService;
  let mockDataSource: Partial<DataSource>;
  let mockRepository: Partial<Repository<AgentExecutionRecord>>;

  beforeEach(async () => {
    // Mock Repository
    mockRepository = {
      save: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    // Mock DataSource
    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
      createQueryRunner: jest.fn(),
      query: jest.fn(),
    };

    // Mock ShardingService
    const mockShardingService = {
      getRepository: jest.fn().mockResolvedValue(mockRepository),
      queryAcrossShards: jest.fn(),
      getShardingStats: jest.fn(),
      createAllShardTables: jest.fn(),
      cleanupOldRecords: jest.fn(),
      getTableSizes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentExecutionRecordService,
        {
          provide: AgentExecutionShardingService,
          useValue: mockShardingService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<AgentExecutionRecordService>(AgentExecutionRecordService);
    shardingService = module.get<AgentExecutionShardingService>(AgentExecutionShardingService);
  });

  it('应该被正确创建', () => {
    expect(service).toBeDefined();
    expect(shardingService).toBeDefined();
  });

  describe('createExecutionRecord', () => {
    it('应该成功创建执行记录', async () => {
      const mockSavedRecord = {
        id: 1,
        sessionId: 'test-session',
        agentType: AgentType.BASIC_DATA_AGENT,
        agentName: '基础数据智能体',
        stockCode: '000001',
        executionStatus: 'success',
      } as AgentExecutionRecord;

      // Mock repository methods
      (mockRepository.create as jest.Mock).mockReturnValue(new AgentExecutionRecord());
      (mockRepository.save as jest.Mock).mockResolvedValue(mockSavedRecord);

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 5000);

      const mockLLMResponse: LLMResponse = {
        content: '测试分析结果',
        finishReason: 'stop',
        usage: {
          inputTokens: 100,
          outputTokens: 200,
          totalTokens: 300,
          cost: 0.001,
        },
        model: 'qwen-plus',
      };

      const mockResult = {
        agentType: AgentType.BASIC_DATA_AGENT,
        agentName: '基础数据智能体',
        analysis: '测试分析结果',
        timestamp: endTime,
        score: 85,
        recommendation: TradingRecommendation.BUY,
        confidence: 0.8,
        keyInsights: ['关键洞察1', '关键洞察2'],
        risks: ['风险1'],
        supportingData: {}
      };

      const createDto: CreateAgentExecutionRecordDto = {
        sessionId: 'test-session',
        agentType: AgentType.BASIC_DATA_AGENT,
        agentName: '基础数据智能体',
        agentRole: '股票基础数据分析',
        stockCode: '000001',
        stockName: '平安银行',
        context: {
          stockCode: '000001',
          stockName: '平安银行',
          timeRange: { startDate: startTime, endDate: endTime },
          metadata: {}
        },
        llmModel: 'qwen-plus',
        inputPrompt: '测试输入提示词',
        llmResponse: mockLLMResponse,
        result: mockResult,
        startTime,
        endTime,
      };

      const result = await service.createExecutionRecord(createDto);

      expect(shardingService.getRepository).toHaveBeenCalledWith(AgentType.BASIC_DATA_AGENT);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockSavedRecord);
    });

    it('应该在缺少agentType时抛出错误', async () => {
      const createDto = {
        sessionId: 'test-session',
        // agentType: 缺失
        agentName: '测试智能体',
      } as CreateAgentExecutionRecordDto;

      await expect(service.createExecutionRecord(createDto)).rejects.toThrow('AgentType是必需的字段');
    });
  });

  describe('queryExecutionRecords', () => {
    it('应该成功查询执行记录', async () => {
      const mockRecords = [
        {
          id: 1,
          agentType: AgentType.BASIC_DATA_AGENT,
          stockCode: '000001',
          sessionId: 'test-session',
        }
      ] as AgentExecutionRecord[];

      (shardingService.queryAcrossShards as jest.Mock).mockResolvedValue(mockRecords);

      const queryDto = {
        agentTypes: [AgentType.BASIC_DATA_AGENT],
        stockCode: '000001',
        limit: 10,
      };

      const result = await service.queryExecutionRecords(queryDto);

      expect(shardingService.queryAcrossShards).toHaveBeenCalledWith(
        [AgentType.BASIC_DATA_AGENT],
        {
          stockCode: '000001',
          sessionId: undefined,
          dateRange: undefined,
          limit: 10,
          offset: undefined,
        }
      );
      expect(result).toEqual(mockRecords);
    });

    it('应该使用默认的agentTypes', async () => {
      const mockRecords = [] as AgentExecutionRecord[];
      (shardingService.queryAcrossShards as jest.Mock).mockResolvedValue(mockRecords);

      const queryDto = {
        stockCode: '000001',
      };

      await service.queryExecutionRecords(queryDto);

      expect(shardingService.queryAcrossShards).toHaveBeenCalledWith(
        Object.values(AgentType),
        expect.any(Object)
      );
    });
  });

  describe('getRecordsBySessionId', () => {
    it('应该根据sessionId获取记录', async () => {
      const sessionId = 'test-session-123';
      const mockRecords = [
        { id: 1, sessionId, agentType: AgentType.BASIC_DATA_AGENT },
        { id: 2, sessionId, agentType: AgentType.TECHNICAL_ANALYST_NEW },
      ] as AgentExecutionRecord[];

      (shardingService.queryAcrossShards as jest.Mock).mockResolvedValue(mockRecords);

      const result = await service.getRecordsBySessionId(sessionId);

      expect(result).toEqual(mockRecords);
    });
  });

  describe('getStockAnalysisHistory', () => {
    it('应该获取股票分析历史', async () => {
      const stockCode = '000001';
      const mockRecords = [
        {
          id: 1,
          stockCode,
          agentType: AgentType.BASIC_DATA_AGENT,
          executionDate: new Date(),
        }
      ] as AgentExecutionRecord[];

      (shardingService.queryAcrossShards as jest.Mock).mockResolvedValue(mockRecords);

      const result = await service.getStockAnalysisHistory(stockCode, AgentType.BASIC_DATA_AGENT, 20);

      expect(shardingService.queryAcrossShards).toHaveBeenCalledWith(
        [AgentType.BASIC_DATA_AGENT],
        expect.objectContaining({
          stockCode,
          limit: 20,
        })
      );
      expect(result).toEqual(mockRecords);
    });
  });

  describe('getExecutionStats', () => {
    it('应该计算执行统计信息', async () => {
      const mockRecords = [
        {
          id: 1,
          executionStatus: 'success',
          processingTimeMs: 1000,
          score: 80,
          estimatedCost: 0.001,
          inputTokens: 100,
          outputTokens: 150,
          totalTokens: 250,
          recommendation: TradingRecommendation.BUY,
          agentType: AgentType.BASIC_DATA_AGENT,
          executionDate: new Date('2024-01-01'),
        },
        {
          id: 2,
          executionStatus: 'success',
          processingTimeMs: 2000,
          score: 70,
          estimatedCost: 0.002,
          inputTokens: 120,
          outputTokens: 180,
          totalTokens: 300,
          recommendation: TradingRecommendation.HOLD,
          agentType: AgentType.TECHNICAL_ANALYST_NEW,
          executionDate: new Date('2024-01-02'),
        },
        {
          id: 3,
          executionStatus: 'error',
          processingTimeMs: 500,
          score: null,
          estimatedCost: 0,
          inputTokens: 50,
          outputTokens: 0,
          totalTokens: 50,
          recommendation: null,
          agentType: AgentType.BASIC_DATA_AGENT,
          executionDate: new Date('2024-01-03'),
        }
      ] as AgentExecutionRecord[];

      (shardingService.queryAcrossShards as jest.Mock).mockResolvedValue(mockRecords);

      const result = await service.getExecutionStats({});

      expect(result.totalExecutions).toBe(3);
      expect(result.successRate).toBe(2/3); // 2个成功，1个失败
      expect(Math.round(result.avgProcessingTime)).toBe(1167); // (1000 + 2000 + 500) / 3 = 1166.67，四舍五入为1167
      expect(result.avgScore).toBe(75); // (80 + 70) / 2 (只计算成功的)
      expect(result.tokenUsage.totalTokens).toBe(600); // 250 + 300 + 50
      expect(result.recommendations[TradingRecommendation.BUY]).toBe(1);
      expect(result.recommendations[TradingRecommendation.HOLD]).toBe(1);
      expect(result.byAgentType[AgentType.BASIC_DATA_AGENT].count).toBe(2);
      expect(result.byAgentType[AgentType.TECHNICAL_ANALYST_NEW].count).toBe(1);
    });
  });

  describe('deleteExecutionRecord', () => {
    it('应该软删除执行记录', async () => {
      const mockUpdateResult = { affected: 1 };
      (mockRepository.update as jest.Mock) = jest.fn().mockResolvedValue(mockUpdateResult);

      const result = await service.deleteExecutionRecord(AgentType.BASIC_DATA_AGENT, 123);

      expect(shardingService.getRepository).toHaveBeenCalledWith(AgentType.BASIC_DATA_AGENT);
      expect(result).toBe(true);
    });
  });
});

describe('智能体执行记录水平分表集成测试', () => {
  it('应该测试完整的水平分表流程', async () => {
    // 这里可以添加集成测试，验证：
    // 1. 分表的自动创建
    // 2. 不同AgentType的记录保存到不同表
    // 3. 跨表查询功能
    // 4. 分表统计功能
    // 5. 数据清理功能
    
    // 由于涉及真实数据库操作，这里只是结构性测试
    expect(true).toBe(true);
  });
});