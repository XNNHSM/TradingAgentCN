import { Test, TestingModule } from '@nestjs/testing';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { NewsTemporalSchedulerService } from './services/news-temporal-scheduler.service';
import { CrawlNewsDto } from './dto/crawl-news.dto';
import { NewsSource } from './interfaces/news-crawler-factory.interface';

describe('NewsController', () => {
  let controller: NewsController;
  let newsService: NewsService;
  let temporalScheduler: NewsTemporalSchedulerService;

  const mockNewsService = {
    startCrawlingTask: jest.fn(),
    getSupportedSources: jest.fn(),
  };

  const mockTemporalScheduler = {
    triggerYesterdayNewsCrawl: jest.fn(),
    getScheduleStatus: jest.fn(),
    getWorkflowResult: jest.fn(),
    getWorkflowStatus: jest.fn(),
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
          provide: NewsTemporalSchedulerService,
          useValue: mockTemporalScheduler,
        },
      ],
    }).compile();

    controller = module.get<NewsController>(NewsController);
    newsService = module.get<NewsService>(NewsService);
    temporalScheduler = module.get<NewsTemporalSchedulerService>(NewsTemporalSchedulerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('crawlNews', () => {
    it('should start crawling task and return success message', async () => {
      const crawlDto: CrawlNewsDto = {
        startDate: '2025-08-21',
        endDate: '2025-08-21',
        sources: [NewsSource.XWLB],
      };

      const result = await controller.crawlNews(crawlDto);

      expect(result.code).toBe(0);
      expect(result.data.message).toBe('新闻爬取任务已启动，正在后台执行');
      expect(mockNewsService.startCrawlingTask).toHaveBeenCalledWith(crawlDto);
    });

    it('should start crawling task for all sources when sources not specified', async () => {
      const crawlDto: CrawlNewsDto = {
        startDate: '2025-08-21',
        endDate: '2025-08-21',
      };

      const result = await controller.crawlNews(crawlDto);

      expect(result.code).toBe(0);
      expect(result.data.message).toBe('新闻爬取任务已启动，正在后台执行');
      expect(mockNewsService.startCrawlingTask).toHaveBeenCalledWith(crawlDto);
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

        mockTemporalScheduler.triggerYesterdayNewsCrawl.mockResolvedValue(expectedResult);

        const result = await controller.triggerYesterdayNewsCrawl();

        expect(result.code).toBe(0);
        expect(result.data).toEqual(expectedResult);
        expect(temporalScheduler.triggerYesterdayNewsCrawl).toHaveBeenCalled();
      });
    });

    describe('getTemporalScheduleStatus', () => {
      it('should return Temporal schedule status', async () => {
        const expectedStatus = {
          taskName: 'daily-news-crawling',
          namespace: 'news-dev',
          taskQueue: 'news-crawling-dev',
          scheduleId: 'daily-news-crawling-dev',
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
  });
});