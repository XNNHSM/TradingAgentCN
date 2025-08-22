import { Injectable } from '@nestjs/common';
import { AbstractNewsCrawlerFactory, NewsSource } from '../interfaces/news-crawler-factory.interface';
import { AbstractNewsCrawlerService } from '../interfaces/news-crawler.interface';
import { JJRBCrawlerService } from '../crawlers/jjrb-crawler.service';
import { XHMRDXCrawlerService } from '../crawlers/xhmrdx-crawler.service';
import { XWLBCrawlerService } from '../crawlers/xwlb-crawler.service';

@Injectable()
export class NewsCrawlerFactory extends AbstractNewsCrawlerFactory {
  constructor(
    private readonly jjrbCrawlerService: JJRBCrawlerService,
    private readonly xhmrdxCrawlerService: XHMRDXCrawlerService,
    private readonly xwlbCrawlerService: XWLBCrawlerService,
  ) {
    super();
  }

  createCrawler(source: NewsSource): AbstractNewsCrawlerService {
    switch (source) {
      case NewsSource.JJRB:
        return this.jjrbCrawlerService;
      case NewsSource.XHMRDX:
        return this.xhmrdxCrawlerService;
      case NewsSource.XWLB:
        return this.xwlbCrawlerService;
      default:
        throw new Error(`Unsupported news source: ${source}`);
    }
  }
}