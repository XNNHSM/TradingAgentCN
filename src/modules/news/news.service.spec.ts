import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NewsService } from './news.service';
import { RawNews, NewsRegion } from './entities/raw-news.entity';
import { NewsCrawlerFactory } from './factories/news-crawler.factory';
import { NewsSource } from './interfaces/news-crawler-factory.interface';

describe('NewsService', () => {
  let service: NewsService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockCrawlerFactory = {
    isSourceSupported: jest.fn(),
    createCrawler: jest.fn(),
    getSupportedSources: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        {
          provide: getRepositoryToken(RawNews),
          useValue: mockRepository,
        },
        {
          provide: NewsCrawlerFactory,
          useValue: mockCrawlerFactory,
        },
      ],
    }).compile();

    service = module.get<NewsService>(NewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a news item successfully', async () => {
      const createNewsDto = {
        title: 'Test News',
        content: 'Test Content',
        url: 'https://test.com/news/1',
        sourceCode: 'test',
        sourceName: 'Test Source',
        newsDate: '2025-08-21',
        analyzed: false,
        region: NewsRegion.DOMESTIC,
      };

      const savedNews = {
        id: 1,
        ...createNewsDto,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
      };

      mockRepository.create.mockReturnValue(savedNews);
      mockRepository.save.mockResolvedValue(savedNews);

      const result = await service.create(createNewsDto);

      expect(result.code).toBe(0);
      expect(result.data).toEqual(savedNews);
      expect(mockRepository.create).toHaveBeenCalledWith(createNewsDto);
      expect(mockRepository.save).toHaveBeenCalledWith(savedNews);
    });

    it('should handle creation error', async () => {
      const createNewsDto = {
        title: 'Test News',
        content: 'Test Content',
        url: 'https://test.com/news/1',
        sourceCode: 'test',
        sourceName: 'Test Source',
        newsDate: '2025-08-21',
      };

      mockRepository.create.mockReturnValue(createNewsDto);
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      const result = await service.create(createNewsDto);

      expect(result.code).not.toBe(0);
      expect(result.message).toBe('创建新闻失败');
    });
  });

  describe('findOne', () => {
    it('should find a news item by id', async () => {
      const newsId = 1;
      const foundNews = {
        id: newsId,
        title: 'Test News',
        content: 'Test Content',
        url: 'https://test.com/news/1',
        sourceCode: 'test',
        sourceName: 'Test Source',
        newsDate: '2025-08-21',
        analyzed: false,
        region: NewsRegion.DOMESTIC,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        version: 1,
      };

      mockRepository.findOne.mockResolvedValue(foundNews);

      const result = await service.findOne(newsId);

      expect(result.code).toBe(0);
      expect(result.data).toEqual(foundNews);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: newsId } });
    });

    it('should return error when news not found', async () => {
      const newsId = 999;
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne(newsId);

      expect(result.code).not.toBe(0);
      expect(result.message).toBe('新闻不存在');
    });
  });

  describe('getSupportedSources', () => {
    it('should return supported news sources', () => {
      const supportedSources = [NewsSource.XWLB];
      mockCrawlerFactory.getSupportedSources.mockReturnValue(supportedSources);

      const result = service.getSupportedSources();

      expect(result.code).toBe(0);
      expect(result.data).toEqual(supportedSources);
      expect(mockCrawlerFactory.getSupportedSources).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete a news item', async () => {
      const newsId = 1;
      mockRepository.softDelete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(newsId);

      expect(result.code).toBe(0);
      expect(mockRepository.softDelete).toHaveBeenCalledWith(newsId);
    });

    it('should return error when news to delete not found', async () => {
      const newsId = 999;
      mockRepository.softDelete.mockResolvedValue({ affected: 0 });

      const result = await service.remove(newsId);

      expect(result.code).not.toBe(0);
      expect(result.message).toBe('新闻不存在');
    });
  });
});