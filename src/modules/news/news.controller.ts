import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { CrawlNewsDto } from './dto/crawl-news.dto';
import { NewsSource } from './interfaces/news-crawler-factory.interface';
import { NewsTemporalSchedulerService } from './services/news-temporal-scheduler.service';
import { Result } from '../../common/dto/result.dto';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(
    private readonly newsService: NewsService,
    private readonly newsTemporalScheduler: NewsTemporalSchedulerService,
  ) {}

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

  @Post('temporal/trigger-yesterday')
  @ApiOperation({ 
    summary: '手动触发昨日新闻爬取 (Temporal)', 
    description: '使用 Temporal 工作流手动触发昨日新闻爬取任务' 
  })
  @ApiResponse({ status: 200, description: 'Temporal 工作流启动成功' })
  async triggerYesterdayNewsCrawl(): Promise<Result<{
    success: boolean;
    workflowId: string;
    message: string;
  }>> {
    const result = await this.newsTemporalScheduler.triggerYesterdayNewsCrawl();
    return Result.success(result);
  }

  @Post('temporal/schedule-status')
  @ApiOperation({ 
    summary: '获取 Temporal 定时任务状态', 
    description: '查看 Temporal Schedule 的状态和执行历史' 
  })
  @ApiResponse({ status: 200, description: '获取状态成功' })
  async getTemporalScheduleStatus(): Promise<Result<{
    taskName: string;
    namespace: string;
    taskQueue: string;
    scheduleId: string;
    description: string;
    nextRunTime?: Date;
    recentActions?: Array<{ result: string; startTime: Date; endTime?: Date }>;
  }>> {
    const status = await this.newsTemporalScheduler.getScheduleStatus();
    return Result.success(status);
  }

  @Post('temporal/workflow-result')
  @ApiOperation({ 
    summary: '获取 Temporal 工作流执行结果', 
    description: '根据工作流ID查询具体的执行结果' 
  })
  @ApiResponse({ status: 200, description: '获取结果成功' })
  async getWorkflowResult(@Body() body: { workflowId: string }): Promise<Result<{
    success: boolean;
    date: string;
    totalCrawled: number;
    successSources: number;
    failedSources: number;
    results: Record<string, number>;
    duration: string;
    message: string;
  }>> {
    const result = await this.newsTemporalScheduler.getWorkflowResult(body.workflowId);
    return Result.success(result);
  }

  @Post('temporal/workflow-status')
  @ApiOperation({ 
    summary: '获取 Temporal 工作流状态', 
    description: '根据工作流ID查询工作流的运行状态' 
  })
  @ApiResponse({ status: 200, description: '获取状态成功' })
  async getWorkflowStatus(@Body() body: { workflowId: string }): Promise<Result<{
    status: string;
    runId: string;
    startTime?: Date;
    endTime?: Date;
  }>> {
    const status = await this.newsTemporalScheduler.getWorkflowStatus(body.workflowId);
    return Result.success(status);
  }
}