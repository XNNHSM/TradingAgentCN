import { Test, TestingModule } from '@nestjs/testing';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { CrawlNewsDto } from './dto/crawl-news.dto';
import { NewsSource } from './interfaces/news-crawler-factory.interface';

describe('NewsController', () => {
  let controller: NewsController;
  let newsService: NewsService;

  const mockNewsService = {
    crawlNewsWithSources: jest.fn(),
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
    it('should crawl news with specified sources', async () => {
      const crawlDto: CrawlNewsDto = {
        startDate: '2025-08-21',
        endDate: '2025-08-21',
        sources: [NewsSource.JJRB, NewsSource.XHMRDX],
      };

      const expectedResult = {
        code: 0,
        data: {
          totalCrawled: 10,
          sourceResults: [
            {
              source: NewsSource.JJRB,
              count: 5,
              success: true,
            },
            {
              source: NewsSource.XHMRDX,
              count: 5,
              success: true,
            },
          ],
        },
        message: '操作成功',
        timestamp: '2025-08-21T10:30:00.000Z',
      };

      mockNewsService.crawlNewsWithSources.mockResolvedValue(expectedResult);

      const result = await controller.crawlNews(crawlDto);

      expect(result).toEqual(expectedResult);
      expect(newsService.crawlNewsWithSources).toHaveBeenCalledWith(crawlDto);
    });

    it('should crawl news from all sources when sources not specified', async () => {
      const crawlDto: CrawlNewsDto = {
        startDate: '2025-08-21',
        endDate: '2025-08-21',
      };

      const expectedResult = {
        code: 0,
        data: {
          totalCrawled: 15,
          sourceResults: [
            {
              source: NewsSource.JJRB,
              count: 5,
              success: true,
            },
            {
              source: NewsSource.XHMRDX,
              count: 5,
              success: true,
            },
            {
              source: NewsSource.XWLB,
              count: 5,
              success: true,
            },
          ],
        },
        message: '操作成功',
        timestamp: '2025-08-21T10:30:00.000Z',
      };

      mockNewsService.crawlNewsWithSources.mockResolvedValue(expectedResult);

      const result = await controller.crawlNews(crawlDto);

      expect(result).toEqual(expectedResult);
      expect(newsService.crawlNewsWithSources).toHaveBeenCalledWith(crawlDto);
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