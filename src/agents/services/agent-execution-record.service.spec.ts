import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentExecutionRecordService, CreateLLMExecutionRecordDto } from './agent-execution-record.service';
import { AgentExecutionRecord } from '../entities/agent-execution-record.entity';

describe('AgentExecutionRecordService', () => {
  let service: AgentExecutionRecordService;
  let repository: Repository<AgentExecutionRecord>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentExecutionRecordService,
        {
          provide: getRepositoryToken(AgentExecutionRecord),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AgentExecutionRecordService>(AgentExecutionRecordService);
    repository = module.get<Repository<AgentExecutionRecord>>(getRepositoryToken(AgentExecutionRecord));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save LLM execution record', async () => {
      const createDto: CreateLLMExecutionRecordDto = {
        sessionId: 'test-session-123',
        agentType: 'BasicDataAgent',
        agentName: 'Basic Data Agent',
        executionPhase: '数据收集',
        llmProvider: 'dashscope',
        llmModel: 'qwen-plus',
        promptTemplate: 'Test prompt template',
        inputMessages: [{ role: 'user', content: 'test input' }],
        outputContent: 'test output',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        executionTimeMs: 1500,
        status: 'success',
        metadata: { testKey: 'testValue' },
      };

      const mockCreatedRecord = {
        id: 123,
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
      } as AgentExecutionRecord;

      mockRepository.create.mockReturnValue(mockCreatedRecord);
      mockRepository.save.mockResolvedValue(mockCreatedRecord);

      const result = await service.create(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalledWith(mockCreatedRecord);
      expect(result).toEqual(mockCreatedRecord);
    });

    it('should handle creation errors', async () => {
      const createDto: CreateLLMExecutionRecordDto = {
        sessionId: 'test-session-123',
        agentType: 'BasicDataAgent',
        agentName: 'Basic Data Agent',
        llmProvider: 'dashscope',
        llmModel: 'qwen-plus',
        inputMessages: [{ role: 'user', content: 'test input' }],
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        executionTimeMs: 1500,
        status: 'success',
      };

      mockRepository.create.mockReturnValue(createDto);
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDto)).rejects.toThrow('Database error');
    });
  });

  describe('query', () => {
    it('should query records with filters', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const queryDto = {
        sessionId: 'test-session',
        agentType: 'BasicDataAgent',
        status: 'success',
        limit: 10,
        offset: 0,
      };

      const result = await service.query(queryDto);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('record');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('record.deletedAt IS NULL');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('record.sessionId = :sessionId', { sessionId: 'test-session' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('record.agentType = :agentType', { agentType: 'BasicDataAgent' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('record.status = :status', { status: 'success' });
      expect(result).toEqual([]);
    });
  });

  describe('getRecordsBySessionId', () => {
    it('should get records by session ID', async () => {
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

      jest.spyOn(service, 'query').mockResolvedValue(mockRecords);

      const result = await service.getRecordsBySessionId(sessionId);

      expect(service.query).toHaveBeenCalledWith({ sessionId });
      expect(result).toEqual(mockRecords);
    });
  });

  describe('getAgentCallHistory', () => {
    it('should get agent call history', async () => {
      const agentType = 'BasicDataAgent';
      const limit = 50;
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
      ] as AgentExecutionRecord[];

      jest.spyOn(service, 'query').mockResolvedValue(mockRecords);

      const result = await service.getAgentCallHistory(agentType, limit);

      expect(service.query).toHaveBeenCalledWith({
        agentType,
        limit,
        orderBy: 'createdAt',
        orderDirection: 'DESC',
      });
      expect(result).toEqual(mockRecords);
    });
  });

  describe('getStats', () => {
    it('should calculate statistics', async () => {
      const mockRecords = [
        {
          status: 'success',
          executionTimeMs: 1000,
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          agentType: 'BasicDataAgent',
          llmModel: 'qwen-plus',
          createdAt: new Date('2023-01-01'),
        },
        {
          status: 'failed',
          executionTimeMs: 500,
          inputTokens: 80,
          outputTokens: 0,
          totalTokens: 80,
          agentType: 'BasicDataAgent',
          llmModel: 'qwen-turbo',
          createdAt: new Date('2023-01-02'),
        },
      ] as AgentExecutionRecord[];

      jest.spyOn(service, 'query').mockResolvedValue(mockRecords);

      const result = await service.getStats({});

      expect(result.totalExecutions).toBe(2);
      expect(result.successRate).toBe(0.5);
      expect(result.avgExecutionTime).toBe(750);
      expect(result.tokenUsage.totalTokens).toBe(230);
      expect(result.byAgentType['BasicDataAgent']).toBeDefined();
      expect(result.byLLMModel['qwen-plus']).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update execution record', async () => {
      const recordId = 123;
      const updateDto = {
        outputContent: 'Updated output',
        inputTokens: 150,
        outputTokens: 75,
        totalTokens: 225,
        executionTimeMs: 2000,
        status: 'success',
        metadata: { updated: true }
      };

      const mockUpdatedRecord = {
        id: recordId,
        sessionId: 'test-session',
        agentType: 'BasicDataAgent',
        agentName: 'Basic Data Agent',
        llmProvider: 'dashscope',
        llmModel: 'qwen-plus',
        inputMessages: {},
        ...updateDto,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
      };

      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOne.mockResolvedValue(mockUpdatedRecord);

      const result = await service.update(recordId, updateDto);

      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: recordId },
        {
          ...updateDto,
          updatedAt: expect.any(Date)
        }
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: recordId }
      });
      expect(result).toEqual(mockUpdatedRecord);
    });

    it('should return null if record not found', async () => {
      const recordId = 456;
      const updateDto = { status: 'success' };

      mockRepository.update.mockResolvedValue({ affected: 0 });

      const result = await service.update(recordId, updateDto);

      expect(result).toBeNull();
    });

    it('should handle update errors', async () => {
      const recordId = 789;
      const updateDto = { status: 'success' };

      mockRepository.update.mockRejectedValue(new Error('Database error'));

      await expect(service.update(recordId, updateDto)).rejects.toThrow('Database error');
    });
  });

  describe('delete', () => {
    it('should soft delete record', async () => {
      const recordId = 123;
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.delete(recordId);

      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: recordId },
        { deletedAt: expect.any(Date) }
      );
      expect(result).toBe(true);
    });

    it('should return false if no record affected', async () => {
      const recordId = 456;
      mockRepository.update.mockResolvedValue({ affected: 0 });

      const result = await service.delete(recordId);

      expect(result).toBe(false);
    });
  });
});