import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { forwardRef } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { RawNews } from './entities/raw-news.entity';
import { NewsSummary } from './entities/news-summary.entity';
import { NewsCrawlerFactory } from './factories/news-crawler.factory';
import { XWLBCrawlerService } from './crawlers/xwlb-crawler.service';
import { NewsSummaryService } from './services/news-summary.service';
import { NewsWorkerService } from './temporal/news-worker.service';
import { SummaryGenerationService } from '../../common/services/summary-generation.service';
// Temporal 相关服务 - 从统一Temporal模块导入
import { TemporalModule } from '../../temporal/temporal.module';
// Agents模块 - 提供SummaryGenerationAgent
import { AgentsModule } from '../../agents/agents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RawNews, NewsSummary]),
    ConfigModule,
    TemporalModule,
    forwardRef(() => AgentsModule),
  ],
  controllers: [NewsController],
  providers: [
    NewsService,
    NewsSummaryService,
    NewsCrawlerFactory,
    XWLBCrawlerService,
    NewsWorkerService,
    SummaryGenerationService,
  ],
  exports: [
    NewsService,
    NewsSummaryService,
    NewsCrawlerFactory, 
  ],
})
export class NewsModule {}