import { Injectable } from '@nestjs/common';
import { AbstractNewsCrawlerFactory, NewsSource } from '../interfaces/news-crawler-factory.interface';
import { AbstractNewsCrawlerService } from '../interfaces/news-crawler.interface';
import { XWLBCrawlerService } from '../crawlers/xwlb-crawler.service';

@Injectable()
export class NewsCrawlerFactory extends AbstractNewsCrawlerFactory {
  constructor(
    private readonly xwlbCrawlerService: XWLBCrawlerService,
  ) {
    super();
  }

  createCrawler(source: NewsSource): AbstractNewsCrawlerService {
    switch (source) {
      case NewsSource.XWLB:
        return this.xwlbCrawlerService;
      default:
        throw new Error(`Unsupported news source: ${source}`);
    }
  }
}