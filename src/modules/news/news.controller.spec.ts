import { Test, TestingModule } from '@nestjs/testing';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { CrawlNewsDto } from './dto/crawl-news.dto';
import { NewsSource } from './interfaces/news-crawler-factory.interface';

describe('NewsController', () => {
  let controller: NewsController;
  let newsService: NewsService;

  const mockNewsService = {
    startCrawlingTask: jest.fn(),
    getSupportedSources: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsController],
      providers: [
        {
          provide: NewsService,
          useValue: mockNewsService,
        },
      ],
    }).compile();

    controller = module.get<NewsController>(NewsController);
    newsService = module.get<NewsService>(NewsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('crawlNews', () => {
    it('should start crawling task and return success message', async () => {
      const crawlDto: CrawlNewsDto = {
        startDate: '2025-08-21',
        endDate: '2025-08-21',
        sources: [NewsSource.JJRB, NewsSource.XHMRDX],
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
      const supportedSources = [NewsSource.JJRB, NewsSource.XHMRDX, NewsSource.XWLB];
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
});