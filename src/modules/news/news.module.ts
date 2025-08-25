import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { RawNews } from './entities/raw-news.entity';
import { NewsSummary } from './entities/news-summary.entity';
import { NewsCrawlerFactory } from './factories/news-crawler.factory';
import { XWLBCrawlerService } from './crawlers/xwlb-crawler.service';
// Temporal 相关服务
import { NewsTemporalClientService } from './temporal/news-temporal-client.service';
import { NewsWorkerService } from './temporal/news-worker.service';
import { NewsTemporalSchedulerService } from './services/news-temporal-scheduler.service';

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
    // Temporal 服务
    NewsTemporalClientService,
    NewsWorkerService,
    NewsTemporalSchedulerService,
  ],
  exports: [
    NewsService, 
    NewsCrawlerFactory, 
    NewsTemporalClientService,
    NewsTemporalSchedulerService,
  ],
})
export class NewsModule {}