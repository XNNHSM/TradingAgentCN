import { Test, TestingModule } from '@nestjs/testing';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { IntelligentAnalysisSchedulerService } from '../../temporal/schedulers/news/intelligent-analysis-scheduler.service';
import { CrawlNewsDto } from './dto/crawl-news.dto';
import { NewsSource } from './interfaces/news-crawler-factory.interface';

describe('NewsController', () => {
  let controller: NewsController;
  let newsService: NewsService;
  let temporalScheduler: IntelligentAnalysisSchedulerService;

  const mockNewsService = {
    startCrawlingTask: jest.fn(),
    getSupportedSources: jest.fn(),
  };

  const mockTemporalScheduler = {
    triggerYesterdayIntelligentAnalysis: jest.fn(),
    getScheduleStatus: jest.fn(),
    getWorkflowResult: jest.fn(),
    getWorkflowStatus: jest.fn(),
    startNewsRangeCrawlWorkflow: jest.fn(), // 新增
    getRangeCrawlProgress: jest.fn(), // 新增
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsController],
      providers: [
        {
          provide: NewsService,
          useValue: mockNewsService,
        },
        {
          provide: IntelligentAnalysisSchedulerService,
          useValue: mockTemporalScheduler,
        },
      ],
    }).compile();

    controller = module.get<NewsController>(NewsController);
    newsService = module.get<NewsService>(NewsService);
    temporalScheduler = module.get<IntelligentAnalysisSchedulerService>(IntelligentAnalysisSchedulerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('crawlNews', () => {
    it('should start crawling task using Temporal workflow and return success result', async () => {
      const crawlDto: CrawlNewsDto = {
        startDate: '2025-08-21',
        endDate: '2025-08-21',
        sources: [NewsSource.XWLB],
      };

      const expectedTemporalResult = {
        success: true,
        workflowId: 'range-news-crawling-2025-08-21-to-2025-08-21-12345',
        message: '成功启动 1 个日期的新闻爬取工作流 (2025-08-21 至 2025-08-21)',
      };

      mockTemporalScheduler.startNewsRangeCrawlWorkflow.mockResolvedValue(expectedTemporalResult);

      const result = await controller.crawlNews(crawlDto);

      expect(result.code).toBe(0);
      expect(result.data).toEqual(expectedTemporalResult);
      expect(mockTemporalScheduler.startNewsRangeCrawlWorkflow).toHaveBeenCalledWith(
        crawlDto.startDate,
        crawlDto.endDate,
        crawlDto.sources
      );
    });

    it('should start crawling task for all sources when sources not specified', async () => {
      const crawlDto: CrawlNewsDto = {
        startDate: '2025-08-21',
        endDate: '2025-08-21',
      };

      const expectedTemporalResult = {
        success: true,
        workflowId: 'range-news-crawling-2025-08-21-to-2025-08-21-67890',
        message: '成功启动 1 个日期的新闻爬取工作流 (2025-08-21 至 2025-08-21)',
      };

      mockTemporalScheduler.startNewsRangeCrawlWorkflow.mockResolvedValue(expectedTemporalResult);

      const result = await controller.crawlNews(crawlDto);

      expect(result.code).toBe(0);
      expect(result.data).toEqual(expectedTemporalResult);
      expect(mockTemporalScheduler.startNewsRangeCrawlWorkflow).toHaveBeenCalledWith(
        crawlDto.startDate,
        crawlDto.endDate,
        undefined // sources not specified
      );
    });
  });

  describe('getSupportedSources', () => {
    it('should return supported news sources', async () => {
      const supportedSources = [NewsSource.XWLB];
      const expectedResult = {
        code: 0,
        data: supportedSources,
        message: '操作成功',
        timestamp: '2025-08-21T10:30:00.000Z',
      };

      mockNewsService.getSupportedSources.mockReturnValue(expectedResult);

      const result = await controller.getSupportedSources();

      expect(result).toEqual(expectedResult);
      expect(newsService.getSupportedSources).toHaveBeenCalled();
    });
  });

  describe('Temporal endpoints', () => {
    describe('triggerYesterdayNewsCrawl', () => {
      it('should trigger yesterday news crawl using Temporal', async () => {
        const expectedResult = {
          success: true,
          workflowId: 'manual-news-crawling-2025-08-20-12345',
          message: '手动触发昨日(2025-08-20)新闻爬取任务成功',
        };

        mockTemporalScheduler.triggerYesterdayIntelligentAnalysis.mockResolvedValue(expectedResult);

        const result = await controller.triggerYesterdayNewsCrawl();

        expect(result.code).toBe(0);
        expect(result.data).toEqual(expectedResult);
        expect(temporalScheduler.triggerYesterdayIntelligentAnalysis).toHaveBeenCalled();
      });
    });

    describe('getTemporalScheduleStatus', () => {
      it('should return Temporal schedule status', async () => {
        const expectedStatus = {
          taskName: 'daily-news-crawling',
          namespace: 'default',
          taskQueue: 'news-crawling',
          scheduleId: 'daily-news-crawling',
          description: '每天凌晨1点执行新闻爬取任务 - 由 Temporal Schedule 管理',
          nextRunTime: new Date('2025-08-22T01:00:00.000Z'),
          recentActions: [],
        };

        mockTemporalScheduler.getScheduleStatus.mockResolvedValue(expectedStatus);

        const result = await controller.getTemporalScheduleStatus();

        expect(result.code).toBe(0);
        expect(result.data).toEqual(expectedStatus);
        expect(temporalScheduler.getScheduleStatus).toHaveBeenCalled();
      });
    });

    describe('getWorkflowResult', () => {
      it('should return workflow execution result', async () => {
        const workflowId = 'test-workflow-123';
        const expectedResult = {
          success: true,
          date: '2025-08-20',
          totalCrawled: 5,
          successSources: 1,
          failedSources: 0,
          results: { XWLB: 5 },
          duration: '30s',
          message: '新闻爬取任务完成',
        };

        mockTemporalScheduler.getWorkflowResult.mockResolvedValue(expectedResult);

        const result = await controller.getWorkflowResult({ workflowId });

        expect(result.code).toBe(0);
        expect(result.data).toEqual(expectedResult);
        expect(temporalScheduler.getWorkflowResult).toHaveBeenCalledWith(workflowId);
      });
    });

    describe('getWorkflowStatus', () => {
      it('should return workflow status', async () => {
        const workflowId = 'test-workflow-123';
        const expectedStatus = {
          status: 'COMPLETED',
          runId: 'test-run-456',
          startTime: new Date('2025-08-21T01:00:00.000Z'),
          endTime: new Date('2025-08-21T01:05:00.000Z'),
        };

        mockTemporalScheduler.getWorkflowStatus.mockResolvedValue(expectedStatus);

        const result = await controller.getWorkflowStatus({ workflowId });

        expect(result.code).toBe(0);
        expect(result.data).toEqual(expectedStatus);
        expect(temporalScheduler.getWorkflowStatus).toHaveBeenCalledWith(workflowId);
      });
    });

    describe('getRangeCrawlProgress', () => {
      it('should return range crawl progress', async () => {
        const mainWorkflowId = 'range-news-crawling-2025-08-20-to-2025-08-21-12345';
        const expectedProgress = {
          mainWorkflowId,
          totalDays: 2,
          completedDays: 1,
          runningDays: 1,
          failedDays: 0,
          overallProgress: 50,
          dailyStatus: [
            {
              date: '2025-08-20',
              workflowId: `${mainWorkflowId}-2025-08-20`,
              status: 'COMPLETED',
              startTime: new Date('2025-08-21T01:00:00.000Z'),
              endTime: new Date('2025-08-21T01:05:00.000Z'),
            },
            {
              date: '2025-08-21',
              workflowId: `${mainWorkflowId}-2025-08-21`,
              status: 'RUNNING',
              startTime: new Date('2025-08-21T01:00:00.000Z'),
              endTime: undefined,
            },
          ],
          summary: '总计 2 天, 已完成 1 天, 运行中 1 天, 失败 0 天, 进度 50%',
        };

        mockTemporalScheduler.getRangeCrawlProgress.mockResolvedValue(expectedProgress);

        const result = await controller.getRangeCrawlProgress({ mainWorkflowId });

        expect(result.code).toBe(0);
        expect(result.data).toEqual(expectedProgress);
        expect(temporalScheduler.getRangeCrawlProgress).toHaveBeenCalledWith(mainWorkflowId);
      });
    });
  });
});