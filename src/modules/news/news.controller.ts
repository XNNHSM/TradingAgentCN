import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { CrawlNewsDto } from './dto/crawl-news.dto';
import { NewsSource } from './interfaces/news-crawler-factory.interface';
import { Result } from '../../common/dto/result.dto';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post('crawl')
  @ApiOperation({ 
    summary: '爬取新闻数据', 
    description: '根据指定的日期范围和数据源爬取新闻。数据源可选，不传则爬取所有支持的数据源。爬取任务将异步执行。' 
  })
  @ApiResponse({ status: 200, description: '爬取任务启动成功' })
  async crawlNews(@Body() crawlDto: CrawlNewsDto): Promise<Result<{ message: string }>> {
    // 异步启动爬取任务，不等待结果
    this.newsService.startCrawlingTask(crawlDto);
    return Result.success({ message: '新闻爬取任务已启动，正在后台执行' });
  }

  @Post('supported-sources')
  @ApiOperation({ summary: '获取支持的新闻源列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getSupportedSources(): Promise<Result<NewsSource[]>> {
    return this.newsService.getSupportedSources();
  }
}