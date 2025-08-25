/**
 * 新闻爬取 Temporal 工作流
 * 负责协调新闻数据的定时爬取任务
 */

import { proxyActivities, defineSignal, setHandler, condition, workflowInfo } from '@temporalio/workflow';
import type { NewsActivities } from './news.activities';

// 工作流输入参数
export interface NewsCrawlingWorkflowInput {
  date: string; // 爬取日期 YYYY-MM-dd 格式
  sources?: string[]; // 可选的数据源列表，为空则爬取所有支持的源
}

// 工作流输出结果
export interface NewsCrawlingWorkflowResult {
  success: boolean;
  date: string;
  totalCrawled: number;
  successSources: number;
  failedSources: number;
  results: Record<string, number>;
  duration: string;
  message: string;
}

// 工作流控制信号
export const cancelCrawlingSignal = defineSignal<[]>('cancelCrawling');

// 创建活动代理
const {
  getSupportedSources,
  validateDate,
  crawlNewsFromSource,
  getWorkflowSummary,
} = proxyActivities<NewsActivities>({
  startToCloseTimeout: '10m', // 每个活动最多10分钟超时
  retry: {
    initialInterval: '10s',
    maximumInterval: '1m',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

/**
 * 新闻爬取工作流主函数
 */
export async function newsCrawlingWorkflow(
  input: NewsCrawlingWorkflowInput
): Promise<NewsCrawlingWorkflowResult> {
  const { date, sources } = input;
  const startTime = Date.now();
  
  // 设置取消信号处理
  let cancelled = false;
  setHandler(cancelCrawlingSignal, () => {
    cancelled = true;
  });

  try {
    // 1. 验证输入日期格式
    await validateDate(date);
    
    // 2. 获取支持的新闻源
    const supportedSources = await getSupportedSources();
    const targetSources = sources && sources.length > 0 ? sources : supportedSources;

    // 初始化统计信息
    let totalCrawled = 0;
    let successCount = 0;
    let failedCount = 0;
    const results: Record<string, number> = {};

    // 3. 依次爬取每个数据源的新闻
    for (const source of targetSources) {
      // 检查是否被取消
      if (cancelled) {
        break;
      }

      try {
        // 爬取单个数据源的新闻
        const crawlResult = await crawlNewsFromSource(source, date);
        
        if (crawlResult.success) {
          results[source] = crawlResult.count;
          totalCrawled += crawlResult.count;
          successCount++;
        } else {
          results[source] = 0;
          failedCount++;
        }
      } catch (error) {
        results[source] = 0;
        failedCount++;
      }

      // 在不同数据源之间添加延迟，避免过于频繁的请求
      await condition(() => false, '2s');
    }

    // 4. 生成工作流摘要
    const duration = `${Math.round((Date.now() - startTime) / 1000)}s`;
    const summary = await getWorkflowSummary({
      date,
      totalCrawled,
      successSources: successCount,
      failedSources: failedCount,
      results,
      duration,
    });

    return {
      success: !cancelled && failedCount < targetSources.length, // 只要不是全部失败就算成功
      date,
      totalCrawled,
      successSources: successCount,
      failedSources: failedCount,
      results,
      duration,
      message: cancelled ? '工作流被取消' : summary,
    };

  } catch (error) {
    const duration = `${Math.round((Date.now() - startTime) / 1000)}s`;
    
    return {
      success: false,
      date,
      totalCrawled: 0,
      successSources: 0,
      failedSources: 0,
      results: {},
      duration,
      message: `工作流执行失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}