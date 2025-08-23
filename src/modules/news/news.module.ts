import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { RawNews } from './entities/raw-news.entity';
import { NewsSummary } from './entities/news-summary.entity';
import { NewsCrawlerFactory } from './factories/news-crawler.factory';
import { XWLBCrawlerService } from './crawlers/xwlb-crawler.service';
import { NewsSchedulerService } from './services/news-scheduler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RawNews, NewsSummary]),
    ConfigModule,
  ],
  controllers: [NewsController],
  providers: [
    NewsService,
    NewsCrawlerFactory,
    XWLBCrawlerService,
    NewsSchedulerService,
  ],
  exports: [NewsService, NewsCrawlerFactory],
})
export class NewsModule {}