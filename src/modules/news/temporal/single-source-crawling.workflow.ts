/**
 * 单个数据源新闻爬取子工作流
 * 负责单个数据源的完整新闻爬取流程：获取链接 -> 爬取内容 -> 数据落盘 -> 生成摘要 -> 摘要落盘
 */

import { 
  proxyActivities, 
  defineSignal, 
  setHandler, 
  condition,
  startChild,
  ChildWorkflowHandle
} from '@temporalio/workflow';
import type { NewsActivities, NewsLink } from './news.activities';
import type { 
  NewsContentProcessingInput,
  NewsContentProcessingResult
} from './news-content-processing.workflow';

// 子工作流输入参数
export interface SingleSourceCrawlingInput {
  source: string;       // 数据源名称
  date: string;         // 爬取日期 YYYY-MM-dd 格式
  maxRetries?: number;  // 单个新闻的最大重试次数，默认3次
}

// 子工作流输出结果
export interface SingleSourceCrawlingResult {
  success: boolean;
  source: string;
  date: string;
  totalLinks: number;           // 找到的总链接数
  successfulNews: number;       // 成功爬取的新闻数
  failedNews: number;          // 失败的新闻数
  savedNews: number;           // 成功保存的新闻数
  generatedSummaries: number;  // 成功生成摘要的数量
  savedSummaries: number;      // 成功保存摘要的数量
  message: string;
  errors: string[];            // 错误信息列表
}

// 子工作流控制信号
export const cancelSingleSourceSignal = defineSignal<[]>('cancelSingleSource');

// 创建活动代理（只保留链接获取活动）
const {
  getNewsLinks,
} = proxyActivities<NewsActivities>({
  startToCloseTimeout: '3m',    // 链接获取活动3分钟超时
  retry: {
    initialInterval: '5s',
    maximumInterval: '30s',
    backoffCoefficient: 2,
    maximumAttempts: 2,
  },
});

/**
 * 单个数据源新闻爬取子工作流主函数
 */
export async function singleSourceCrawlingWorkflow(
  input: SingleSourceCrawlingInput
): Promise<SingleSourceCrawlingResult> {
  const { source, date, maxRetries = 3 } = input;
  const errors: string[] = [];
  
  // 设置取消信号处理
  let cancelled = false;
  setHandler(cancelSingleSourceSignal, () => {
    cancelled = true;
  });

  try {
    // 步骤1: 获取新闻链接列表
    if (cancelled) {
      return createFailureResult(source, date, 0, 0, 0, 0, 0, 0, '工作流被取消', errors);
    }

    const newsLinks = await getNewsLinks(source, date);
    if (newsLinks.length === 0) {
      const message = `${source} 未找到任何新闻链接`;
      errors.push(message);
      return createFailureResult(source, date, 0, 0, 0, 0, 0, 0, message, errors);
    }

    // 步骤2: 为每个新闻链接启动内容处理子工作流（并行处理，但有并发限制）
    const batchSize = 5; // 并发限制：同时最多处理5个新闻
    let successfulNews = 0;
    let failedNews = 0;
    let savedNews = 0;
    let generatedSummaries = 0;
    let savedSummaries = 0;

    for (let i = 0; i < newsLinks.length; i += batchSize) {
      if (cancelled) break;

      const batch = newsLinks.slice(i, i + batchSize);
      const childWorkflowHandles: ChildWorkflowHandle<any>[] = [];

      // 为当前批次的每个新闻链接启动内容处理子工作流
      for (const newsLink of batch) {
        if (cancelled) break;

        try {
          const childInput: NewsContentProcessingInput = {
            newsLink,
            source,
            maxRetries,
          };

          const childHandle = await startChild('newsContentProcessingWorkflow', {
            workflowId: `news-content-${source}-${newsLink.url.split('/').pop()}-${Date.now()}`,
            args: [childInput],
            // 子工作流超时时间：10分钟（给足够时间处理单个新闻）
            workflowExecutionTimeout: '10m',
          });

          childWorkflowHandles.push(childHandle);
        } catch (error) {
          errors.push(`启动新闻内容处理子工作流失败 [${newsLink.url}]: ${error instanceof Error ? error.message : String(error)}`);
          failedNews++;
        }
      }

      // 等待当前批次的所有子工作流完成
      const batchResults = await Promise.allSettled(
        childWorkflowHandles.map(handle => handle.result())
      );

      // 收集批次结果
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const newsLink = batch[j];

        if (result.status === 'fulfilled') {
          const processingResult = result.value as NewsContentProcessingResult;
          
          if (processingResult.success) {
            successfulNews++;
            if (processingResult.savedNewsId) {
              savedNews++;
            }
            if (processingResult.generatedSummary) {
              generatedSummaries++;
            }
            if (processingResult.savedSummaryId) {
              savedSummaries++;
            }
          } else {
            failedNews++;
          }
          
          // 收集子工作流的错误信息
          errors.push(...processingResult.errors);
        } else {
          failedNews++;
          errors.push(`新闻内容处理子工作流执行失败 [${newsLink?.url}]: ${result.reason}`);
        }
      }

      // 批次间添加延迟，避免过于频繁的请求
      if (i + batchSize < newsLinks.length) {
        await condition(() => false, '2s');
      }
    }

    // 构建最终结果
    const success = !cancelled && successfulNews > 0 && savedNews > 0;
    const message = cancelled 
      ? '工作流被取消'
      : `${source} 爬取完成: 链接${newsLinks.length}个, 成功${successfulNews}个, 保存${savedNews}条, 摘要${savedSummaries}条`;

    return {
      success,
      source,
      date,
      totalLinks: newsLinks.length,
      successfulNews,
      failedNews,
      savedNews,
      generatedSummaries,
      savedSummaries,
      message,
      errors,
    };

  } catch (error) {
    const message = `${source} 子工作流执行异常: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(message);
    
    return createFailureResult(source, date, 0, 0, 0, 0, 0, 0, message, errors);
  }
}


/**
 * 创建失败结果的辅助函数
 */
function createFailureResult(
  source: string,
  date: string,
  totalLinks: number,
  successfulNews: number,
  failedNews: number,
  savedNews: number,
  generatedSummaries: number,
  savedSummaries: number,
  message: string,
  errors: string[]
): SingleSourceCrawlingResult {
  return {
    success: false,
    source,
    date,
    totalLinks,
    successfulNews,
    failedNews,
    savedNews,
    generatedSummaries,
    savedSummaries,
    message,
    errors,
  };
}