/**
 * 新闻内容处理子工作流
 * 负责处理单条新闻的完整流程：抓取内容 -> 保存数据 -> 生成摘要 -> 保存摘要
 */

import { proxyActivities, defineSignal, setHandler, condition } from '@temporalio/workflow';
import type { NewsActivities, NewsLink, NewsContent, NewsSummaryResult } from './news.activities';
import { ContentType } from '../../../common/interfaces/summary-generation.interface';

// 子工作流输入参数
export interface NewsContentProcessingInput {
  newsLink: NewsLink;       // 新闻链接信息
  source: string;           // 数据源名称
  maxRetries?: number;      // 最大重试次数，默认3次
}

// 子工作流输出结果
export interface NewsContentProcessingResult {
  success: boolean;
  newsLink: NewsLink;
  source: string;
  crawledContent?: NewsContent;     // 爬取的新闻内容
  savedNewsId?: number;            // 保存的新闻ID
  generatedSummary?: NewsSummaryResult;  // 生成的摘要
  savedSummaryId?: number;         // 保存的摘要ID
  message: string;
  errors: string[];                // 错误信息列表
}

// 子工作流控制信号
export const cancelNewsProcessingSignal = defineSignal<[]>('cancelNewsProcessing');

// 创建活动代理
const {
  crawlSingleNews,
  persistNewsData,
  generateNewsSummary,
  persistSummaryData,
  generateFallbackSummary,
} = proxyActivities<NewsActivities>({
  startToCloseTimeout: '3m',    // 单个活动最多3分钟超时
  retry: {
    maximumAttempts: 1, // 默认不重试
  },
});

/**
 * 新闻内容处理子工作流主函数
 */
export async function newsContentProcessingWorkflow(
  input: NewsContentProcessingInput
): Promise<NewsContentProcessingResult> {
  const { newsLink, source, maxRetries = 3 } = input;
  const errors: string[] = [];
  
  // 设置取消信号处理
  let cancelled = false;
  setHandler(cancelNewsProcessingSignal, () => {
    cancelled = true;
  });

  try {
    // 步骤1: 爬取新闻内容（带重试机制）
    if (cancelled) {
      return createFailureResult(newsLink, source, '工作流被取消', errors);
    }

    let crawledContent: NewsContent | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (cancelled) break;

      try {
        // 根据source调用相应的爬取实例
        crawledContent = await crawlSingleNews(newsLink, source);
        break; // 成功则跳出重试循环
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          errors.push(`新闻内容抓取失败 [${newsLink.url}] (重试${maxRetries}次): ${lastError.message}`);
          return createFailureResult(newsLink, source, `抓取失败: ${lastError.message}`, errors);
        } else {
          // 非最后一次重试，添加延迟后继续
          await condition(() => false, `${attempt * 2}s`);
        }
      }
    }

    if (!crawledContent || cancelled) {
      return createFailureResult(newsLink, source, '未能获取新闻内容', errors);
    }

    // 步骤2: 保存新闻数据
    if (cancelled) {
      return createFailureResult(newsLink, source, '工作流被取消', errors);
    }

    let savedNewsId: number | undefined;
    try {
      const persistResult = await persistNewsData([crawledContent]);
      if (persistResult.success && persistResult.count > 0) {
        // 这里简化处理，实际应该从persistNewsData返回ID信息
        // 或者通过查询数据库获取刚保存的新闻ID
        savedNewsId = 1; // 临时处理，实际需要从数据库查询
      } else {
        errors.push(`新闻数据保存失败: ${persistResult.message}`);
        return createFailureResult(newsLink, source, `数据保存失败: ${persistResult.message}`, errors);
      }
    } catch (error) {
      const message = `新闻数据保存异常: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(message);
      return createFailureResult(newsLink, source, message, errors);
    }

    // 步骤3: 生成新闻摘要
    if (cancelled) {
      return await createPartialSuccessResult(newsLink, source, crawledContent, savedNewsId, '工作流被取消', errors);
    }

    let generatedSummary: NewsSummaryResult | undefined;
    try {
      generatedSummary = await generateNewsSummary(crawledContent);
    } catch (error) {
      const message = `摘要生成失败: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(message);
      // 摘要生成失败不算整体失败，因为新闻内容已经成功保存，调用fallback生成摘要
      return await createPartialSuccessResult(newsLink, source, crawledContent, savedNewsId, message, errors);
    }

    // 步骤4: 保存新闻摘要
    if (cancelled || !generatedSummary) {
      return await createPartialSuccessResult(newsLink, source, crawledContent, savedNewsId, '工作流被取消或摘要为空', errors);
    }

    let savedSummaryId: number | undefined;
    try {
      const summaryPersistResult = await persistSummaryData([generatedSummary]);
      if (summaryPersistResult.success && summaryPersistResult.count > 0) {
        savedSummaryId = 1; // 临时处理，实际需要从数据库查询
      } else {
        errors.push(`摘要数据保存失败: ${summaryPersistResult.message}`);
        // 摘要保存失败不算整体失败
      }
    } catch (error) {
      const message = `摘要数据保存异常: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(message);
    }

    // 构建成功结果
    return {
      success: true,
      newsLink,
      source,
      crawledContent,
      savedNewsId,
      generatedSummary,
      savedSummaryId,
      message: `新闻处理完成: ${crawledContent.title}`,
      errors,
    };

  } catch (error) {
    const message = `新闻内容处理异常: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(message);
    return createFailureResult(newsLink, source, message, errors);
  }
}

/**
 * 创建失败结果的辅助函数
 */
function createFailureResult(
  newsLink: NewsLink,
  source: string,
  message: string,
  errors: string[]
): NewsContentProcessingResult {
  return {
    success: false,
    newsLink,
    source,
    message,
    errors,
  };
}

/**
 * 创建部分成功结果的辅助函数（新闻保存成功但摘要处理失败）
 * 此时会调用LLM生成摘要数据
 */
async function createPartialSuccessResult(
  newsLink: NewsLink,
  source: string,
  crawledContent: NewsContent,
  savedNewsId: number | undefined,
  message: string,
  errors: string[]
): Promise<NewsContentProcessingResult> {
  let generatedSummary: NewsSummaryResult | undefined;
  
  try {
    // 调用LLM生成fallback摘要
    generatedSummary = await generateFallbackSummary({
      content: crawledContent.content,
      title: crawledContent.title,
      contentType: ContentType.NEWS,
      source: source,
      publishTime: crawledContent.publishTime,
      maxTokens: 300, // 使用较短的摘要
      language: 'zh'
    });
    
    // 如果生成成功，尝试保存摘要
    if (generatedSummary) {
      try {
        const summaryPersistResult = await persistSummaryData([generatedSummary]);
        if (summaryPersistResult.success) {
          return {
            success: true,
            newsLink,
            source,
            crawledContent,
            savedNewsId,
            generatedSummary,
            savedSummaryId: generatedSummary.newsId,
            message: `部分成功: ${message}，但已生成fallback摘要`,
            errors,
          };
        }
      } catch (saveError) {
        errors.push(`fallback摘要保存失败: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
      }
    }
  } catch (summaryError) {
    errors.push(`fallback摘要生成失败: ${summaryError instanceof Error ? summaryError.message : String(summaryError)}`);
  }

  // 如果摘要生成或保存失败，仍然返回部分成功
  return {
    success: true, // 新闻内容已保存，视为成功
    newsLink,
    source,
    crawledContent,
    savedNewsId,
    message: `部分成功: ${message}，fallback摘要处理失败`,
    errors,
  };
}