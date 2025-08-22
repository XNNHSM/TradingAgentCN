import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { RawNews } from './entities/raw-news.entity';
import { NewsCrawlerFactory } from './factories/news-crawler.factory';
import { JJRBCrawlerService } from './crawlers/jjrb-crawler.service';
import { XHMRDXCrawlerService } from './crawlers/xhmrdx-crawler.service';
import { XWLBCrawlerService } from './crawlers/xwlb-crawler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RawNews]),
    ConfigModule,
  ],
  controllers: [NewsController],
  providers: [
    NewsService,
    NewsCrawlerFactory,
    JJRBCrawlerService,
    XHMRDXCrawlerService,
    XWLBCrawlerService,
  ],
  exports: [NewsService, NewsCrawlerFactory],
})
export class NewsModule {}