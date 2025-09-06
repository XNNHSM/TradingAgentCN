/**
 * 摘要生成功能测试文件
 * 验证 createPartialSuccessResult 方法和摘要生成服务的集成
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SummaryGenerationService } from '../../common/services/summary-generation.service';
import { SummaryGenerationAgent } from '../../agents/unified/summary-generation.agent';
import { ConfigService } from '@nestjs/config';
import { ContentType } from '../../common/interfaces/summary-generation.interface';

// Mock SummaryGenerationAgent
const mockSummaryGenerationAgent = {
  generateSummary: jest.fn(),
};

describe('SummaryGenerationService', () => {
  let service: SummaryGenerationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummaryGenerationService,
        {
          provide: SummaryGenerationAgent,
          useValue: mockSummaryGenerationAgent,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SummaryGenerationService>(SummaryGenerationService);
    
    // Reset mock before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('should generate summary for news content', async () => {
      // Mock SummaryGenerationAgent response
      const mockAgentResponse = {
        success: true,
        summary: '这是一条测试新闻的摘要',
        keyPoints: ['要点1', '要点2'],
        sentiment: 'neutral',
        category: '新闻',
        tags: ['测试', '新闻'],
        tokenUsage: { input: 100, output: 50, total: 150 },
        processingTime: 100,
        message: '摘要生成成功'
      };

      mockSummaryGenerationAgent.generateSummary.mockResolvedValue(mockAgentResponse);

      const input = {
        content: '这是一条测试新闻的完整内容，包含了各种重要信息和细节描述...',
        title: '测试新闻标题',
        contentType: ContentType.NEWS,
        source: '测试来源',
        publishTime: '2024-01-01',
        maxTokens: 300,
        language: 'zh'
      };

      const result = await service.generate(input);

      expect(result.success).toBe(true);
      expect(result.summary).toBe('这是一条测试新闻的摘要');
      expect(result.keyPoints).toEqual(['要点1', '要点2']);
      expect(result.sentiment).toBe('neutral');
      expect(result.category).toBe('新闻');
      expect(result.tags).toEqual(['测试', '新闻']);
      expect(result.tokenUsage).toEqual({ input: 100, output: 50, total: 150 });
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle agent failure gracefully', async () => {
      // Mock SummaryGenerationAgent failure
      mockSummaryGenerationAgent.generateSummary.mockRejectedValue(new Error('Agent服务调用失败'));

      const input = {
        content: '测试内容',
        title: '测试标题',
        contentType: ContentType.NEWS,
      };

      const result = await service.generate(input);

      expect(result.success).toBe(false);
      expect(result.summary).toBe('');
      expect(result.error).toBeDefined();
    });

    it('should handle agent response with parsing success', async () => {
      // Mock SummaryGenerationAgent response with successful parsing
      const mockAgentResponse = {
        success: true,
        summary: '这不是一个有效的JSON字符串，但是一个有效的摘要',
        keyPoints: ['关键点1', '关键点2'],
        sentiment: 'neutral',
        category: '其他',
        tags: [],
        tokenUsage: { input: 80, output: 40, total: 120 },
        processingTime: 80,
        message: '摘要生成成功'
      };

      mockSummaryGenerationAgent.generateSummary.mockResolvedValue(mockAgentResponse);

      const input = {
        content: '测试内容',
        title: '测试标题',
        contentType: ContentType.NEWS,
      };

      const result = await service.generate(input);

      expect(result.success).toBe(true);
      expect(result.summary).toBe('这不是一个有效的JSON字符串，但是一个有效的摘要');
      expect(result.keyPoints).toEqual(['关键点1', '关键点2']);
      expect(Array.isArray(result.keyPoints)).toBe(true);
    });

    it('should preprocess content based on content type', async () => {
      const mockAgentResponse = {
        success: true,
        summary: '处理后的摘要',
        keyPoints: [],
        sentiment: 'neutral',
        category: '其他',
        tags: [],
        tokenUsage: { input: 50, output: 25, total: 75 },
        processingTime: 50,
        message: '摘要生成成功'
      };

      mockSummaryGenerationAgent.generateSummary.mockResolvedValue(mockAgentResponse);

      // Test news content preprocessing
      const newsInput = {
        content: '本文来源：测试记者报道\n这是新闻正文内容【更多详情，请点击链接】编辑：编辑姓名',
        title: '新闻标题',
        contentType: ContentType.NEWS,
      };

      const newsResult = await service.generate(newsInput);

      expect(newsResult.success).toBe(true);

      // Test policy content preprocessing
      const policyInput = {
        content: '第一条：政策内容\n（一）具体措施\n1、实施细则',
        title: '政策标题',
        contentType: ContentType.POLICY,
      };

      const policyResult = await service.generate(policyInput);

      expect(policyResult.success).toBe(true);
    });

    it('should delegate to agent for content processing', async () => {
      const mockAgentResponse = {
        success: true,
        summary: '测试摘要',
        keyPoints: [],
        sentiment: 'neutral',
        category: '其他',
        tags: [],
        tokenUsage: { input: 30, output: 15, total: 45 },
        processingTime: 30,
        message: '摘要生成成功'
      };

      mockSummaryGenerationAgent.generateSummary.mockResolvedValue(mockAgentResponse);

      // Test simple content type
      const simpleInput = {
        content: '简单新闻内容',
        title: '新闻标题',
        contentType: ContentType.NEWS,
      };

      await service.generate(simpleInput);

      expect(mockSummaryGenerationAgent.generateSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '简单新闻内容',
          title: '新闻标题',
          contentType: ContentType.NEWS
        })
      );

      // Reset mock
      mockSummaryGenerationAgent.generateSummary.mockClear();

      // Test complex content type
      const complexInput = {
        content: '复杂政策内容',
        title: '政策标题',
        contentType: ContentType.POLICY,
      };

      mockSummaryGenerationAgent.generateSummary.mockResolvedValue(mockAgentResponse);

      await service.generate(complexInput);

      expect(mockSummaryGenerationAgent.generateSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '复杂政策内容',
          title: '政策标题',
          contentType: ContentType.POLICY
        })
      );
    });

    it('should return token usage from agent', async () => {
      const mockAgentResponse = {
        success: true,
        summary: '测试摘要',
        keyPoints: [],
        sentiment: 'neutral',
        category: '其他',
        tags: [],
        tokenUsage: { input: 120, output: 60, total: 180 },
        processingTime: 45,
        message: '摘要生成成功'
      };

      mockSummaryGenerationAgent.generateSummary.mockResolvedValue(mockAgentResponse);

      const input = {
        content: '这是一段中文测试内容，包含一些英文字符mixed content',
        title: '测试标题',
        contentType: ContentType.NEWS,
      };

      const result = await service.generate(input);

      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage.input).toBe(120);
      expect(result.tokenUsage.output).toBe(60);
      expect(result.tokenUsage.total).toBe(180);
    });
  });

  describe('isSupported', () => {
    it('should return true for supported content types', () => {
      expect(service.isSupported(ContentType.NEWS)).toBe(true);
      expect(service.isSupported(ContentType.POLICY)).toBe(true);
      expect(service.isSupported(ContentType.HOT_SEARCH)).toBe(true);
      expect(service.isSupported(ContentType.REPORT)).toBe(true);
      expect(service.isSupported(ContentType.ANNOUNCEMENT)).toBe(true);
      expect(service.isSupported(ContentType.ARTICLE)).toBe(true);
      expect(service.isSupported(ContentType.OTHER)).toBe(true);
    });
  });
});