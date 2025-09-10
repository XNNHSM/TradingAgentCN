/**
 * 新闻爬取 Temporal 工作流
 * 负责协调新闻数据的定时爬取任务，使用子工作流模式进行数据源隔离
 */

import { 
  proxyActivities, 
  defineSignal, 
  setHandler, 
  workflowInfo,
  startChild,
  ChildWorkflowHandle,
  condition
} from '@temporalio/workflow';
import type { NewsActivities } from './news.activities';
import type { 
  SingleSourceCrawlingInput,
  SingleSourceCrawlingResult
} from './single-source-crawling.workflow';
// 导入子工作流以确保它被包含
export { singleSourceCrawlingWorkflow } from './single-source-crawling.workflow';
export { newsContentProcessingWorkflow } from './news-content-processing.workflow';
import { stockAnalysisWorkflow, StockAnalysisInput } from '../stock-analysis.workflow';

// 工作流输入参数
export interface NewsCrawlingWorkflowInput {
  date: string; // 爬取日期 YYYY-MM-dd 格式
  sources?: string[]; // 可选的数据源列表，为空则爬取所有支持的源
  skipDuplicateCheck?: boolean; // 是否跳过重复检查，默认为false
  enableStockAnalysis?: boolean; // 是否启用股票分析子工作流，默认为true
}

// 工作流输出结果（增强版，包含更详细的子工作流信息）
export interface NewsCrawlingWorkflowResult {
  success: boolean;
  date: string;
  totalSources: number;
  successfulSources: number;
  failedSources: number;
  totalLinks: number;               // 所有数据源找到的总链接数
  totalCrawledNews: number;         // 成功爬取的总新闻数
  totalSavedNews: number;          // 成功保存的总新闻数
  totalGeneratedSummaries: number; // 成功生成的总摘要数
  totalSavedSummaries: number;     // 成功保存的总摘要数
  sourceResults: Record<string, SingleSourceCrawlingResult>; // 每个数据源的详细结果
  stockAnalysisResults?: StockAnalysisSubWorkflowResult[]; // 股票分析子工作流结果
  duration: string;
  message: string;
  errors: string[];                // 收集所有子工作流的错误
}

// 股票分析子工作流结果
export interface StockAnalysisSubWorkflowResult {
  stockCode: string;
  stockName?: string;
  workflowId: string;
  success: boolean;
  overallScore?: number;
  recommendation?: string;
  confidence?: number;
  processingTime?: number;
  error?: string;
}

// 工作流控制信号
export const cancelCrawlingSignal = defineSignal<[]>('cancelCrawling');

// 创建活动代理（仅保留必要的活动）
const {
  getSupportedSources,
  validateDate,
  checkDuplicateCrawling,
  getWatchlistStocks,
} = proxyActivities<NewsActivities>({
  startToCloseTimeout: '3m',    // 简化活动，缩短超时时间
  retry: {
    maximumAttempts: 1, // 默认不重试
  },
});

/**
 * 生成基于 source 和 date 的确定性工作流ID
 */
function generateWorkflowId(source: string, date: string): string {
  return `news-crawling-${source}-${date}`;
}

/**
 * 生成基于 source 和 date 的确定性子工作流ID
 */
function generateChildWorkflowId(source: string, date: string): string {
  return `single-source-${source}-${date}`;
}

/**
 * 新闻爬取工作流主函数（重构版本，使用子工作流模式）
 */
export async function newsCrawlingWorkflow(
  input: NewsCrawlingWorkflowInput
): Promise<NewsCrawlingWorkflowResult> {
  const { date, sources, skipDuplicateCheck = false, enableStockAnalysis = true } = input;
  const startTime = Date.now();
  const allErrors: string[] = [];
  
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

    if (targetSources.length === 0) {
      throw new Error('没有可用的新闻数据源');
    }

    // 3. 检查重复爬取（如果未跳过）
    if (!skipDuplicateCheck) {
      for (const source of targetSources) {
        const workflowId = generateWorkflowId(source, date);
        const isDuplicate = await checkDuplicateCrawling(workflowId, source, date);
        
        if (isDuplicate) {
          return {
            success: false,
            date,
            totalSources: targetSources.length,
            successfulSources: 0,
            failedSources: targetSources.length,
            totalLinks: 0,
            totalCrawledNews: 0,
            totalSavedNews: 0,
            totalGeneratedSummaries: 0,
            totalSavedSummaries: 0,
            sourceResults: {},
            duration: `${Math.round((Date.now() - startTime) / 1000)}s`,
            message: `检测到重复爬取任务: ${source} ${date}`,
            errors: [`检测到重复爬取任务: ${source} ${date}`],
          };
        }
      }
    }

    // 4. 为每个数据源启动子工作流（并行执行）
    const childWorkflowHandles: ChildWorkflowHandle<any>[] = [];
    const sourceResults: Record<string, SingleSourceCrawlingResult> = {};

    // 启动所有子工作流
    for (const source of targetSources) {
      if (cancelled) break;

      try {
        const childInput: SingleSourceCrawlingInput = {
          source,
          date,
          maxRetries: 3,
        };

        const childHandle = await startChild('singleSourceCrawlingWorkflow', {
          workflowId: generateChildWorkflowId(source, date),
          args: [childInput],
          // 子工作流超时时间：30分钟（给足够时间处理大量新闻）
          workflowExecutionTimeout: '30m',
          // 子工作流会继承父工作流的taskQueue，不需要显式指定
        });

        childWorkflowHandles.push(childHandle);
      } catch (error) {
        allErrors.push(`启动 ${source} 子工作流失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 5. 等待所有子工作流完成
    const childResults = await Promise.allSettled(
      childWorkflowHandles.map(handle => handle.result())
    );

    // 6. 收集和统计结果
    let successfulSources = 0;
    let failedSources = 0;
    let totalLinks = 0;
    let totalCrawledNews = 0;
    let totalSavedNews = 0;
    let totalGeneratedSummaries = 0;
    let totalSavedSummaries = 0;

    for (let i = 0; i < childResults.length; i++) {
      const result = childResults[i];
      const source = targetSources[i];

      if (result.status === 'fulfilled') {
        const sourceResult = result.value as SingleSourceCrawlingResult;
        sourceResults[source] = sourceResult;

        // 统计数据
        if (sourceResult.success) {
          successfulSources++;
        } else {
          failedSources++;
        }

        totalLinks += sourceResult.totalLinks;
        totalCrawledNews += sourceResult.successfulNews;
        totalSavedNews += sourceResult.savedNews;
        totalGeneratedSummaries += sourceResult.generatedSummaries;
        totalSavedSummaries += sourceResult.savedSummaries;

        // 收集错误信息
        allErrors.push(...sourceResult.errors);
      } else {
        failedSources++;
        allErrors.push(`${source} 子工作流执行失败: ${result.reason}`);
        
        // 创建失败的源结果
        sourceResults[source] = {
          success: false,
          source,
          date,
          totalLinks: 0,
          successfulNews: 0,
          failedNews: 0,
          savedNews: 0,
          generatedSummaries: 0,
          savedSummaries: 0,
          message: `子工作流执行失败: ${result.reason}`,
          errors: [`子工作流执行失败: ${result.reason}`],
        };
      }
    }

    // 7. 构建最终结果
    const duration = `${Math.round((Date.now() - startTime) / 1000)}s`;
    const totalSources = targetSources.length;
    const overallSuccess = !cancelled && successfulSources > 0 && totalSavedNews > 0;

    // 8. 如果启用了股票分析，启动股票分析子工作流
    let stockAnalysisResults: StockAnalysisSubWorkflowResult[] = [];
    if (enableStockAnalysis && overallSuccess && !cancelled) {
      try {
        console.log('开始启动股票分析子工作流');
        stockAnalysisResults = await startStockAnalysisSubWorkflows(date);
        console.log('股票分析子工作流完成', {
          totalStocks: stockAnalysisResults.length,
          successfulStocks: stockAnalysisResults.filter(r => r.success).length,
        });
      } catch (error) {
        const errorMessage = `股票分析子工作流失败: ${error instanceof Error ? error.message : String(error)}`;
        allErrors.push(errorMessage);
        console.error(errorMessage);
      }
    }

    // 9. 构建最终消息
    let message: string;
    if (cancelled) {
      message = '工作流被取消';
    } else if (overallSuccess) {
      message = `新闻爬取完成: ${successfulSources}/${totalSources} 数据源成功, 保存 ${totalSavedNews} 条新闻, ${totalSavedSummaries} 条摘要`;
      if (enableStockAnalysis && stockAnalysisResults.length > 0) {
        const successfulStocks = stockAnalysisResults.filter(r => r.success).length;
        message += `, 股票分析完成: ${successfulStocks}/${stockAnalysisResults.length} 只股票`;
      }
    } else {
      message = `新闻爬取失败: ${failedSources}/${totalSources} 数据源失败`;
    }

    return {
      success: overallSuccess,
      date,
      totalSources,
      successfulSources,
      failedSources,
      totalLinks,
      totalCrawledNews,
      totalSavedNews,
      totalGeneratedSummaries,
      totalSavedSummaries,
      sourceResults,
      stockAnalysisResults: stockAnalysisResults.length > 0 ? stockAnalysisResults : undefined,
      duration,
      message,
      errors: allErrors,
    };

  } catch (error) {
    const duration = `${Math.round((Date.now() - startTime) / 1000)}s`;
    const errorMessage = error instanceof Error ? error.message : String(error);
    allErrors.push(`工作流执行异常: ${errorMessage}`);
    
    return {
      success: false,
      date,
      totalSources: 0,
      successfulSources: 0,
      failedSources: 0,
      totalLinks: 0,
      totalCrawledNews: 0,
      totalSavedNews: 0,
      totalGeneratedSummaries: 0,
      totalSavedSummaries: 0,
      sourceResults: {},
      duration,
      message: `工作流执行失败: ${errorMessage}`,
      errors: allErrors,
    };
  }
}

/**
 * 启动股票分析子工作流
 */
async function startStockAnalysisSubWorkflows(
  date: string
): Promise<StockAnalysisSubWorkflowResult[]> {
  console.log('获取自选股列表以启动股票分析子工作流');
  
  try {
    // 获取自选股列表
    const watchlistStocks = await getWatchlistStocks();
    
    if (!watchlistStocks || watchlistStocks.length === 0) {
      console.log('没有找到自选股，跳过股票分析子工作流');
      return [];
    }

    console.log(`找到 ${watchlistStocks.length} 只自选股，开始启动股票分析子工作流`);

    // 为每只自选股启动股票分析子工作流
    const stockAnalysisPromises = watchlistStocks.map(async (stock) => {
      const stockWorkflowId = `stock-analysis-${stock.stockCode}-${date}`;
      
      try {
        const stockInput: StockAnalysisInput = {
          stockCode: stock.stockCode,
          stockName: stock.stockName,
          sessionId: `news-crawling-${date}`,
          workflowId: stockWorkflowId,
          metadata: {
            triggerSource: 'news-crawling-workflow',
            newsDate: date,
          },
        };

        // 启动子工作流 - 使用统一的taskQueue
        const childHandle = await startChild(stockAnalysisWorkflow, {
          workflowId: stockWorkflowId,
          args: [stockInput],
          taskQueue: 'stock-analysis', // 统一使用简单的 task queue 名称
          workflowExecutionTimeout: '15m', // 股票分析可能需要较长时间
          retry: {
            maximumAttempts: 2,
            initialInterval: '1s',
          },
        });

        // 等待子工作流完成
        const result = await childHandle.result();

        return {
          stockCode: stock.stockCode,
          stockName: stock.stockName,
          workflowId: stockWorkflowId,
          success: true,
          overallScore: result.finalDecision.overallScore,
          recommendation: result.finalDecision.recommendation,
          confidence: result.finalDecision.confidence,
          processingTime: result.totalProcessingTime,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`股票分析子工作流失败: ${stock.stockCode}`, { error: errorMessage });
        
        return {
          stockCode: stock.stockCode,
          stockName: stock.stockName,
          workflowId: stockWorkflowId,
          success: false,
          error: errorMessage,
        };
      }
    });

    // 并行执行所有股票分析子工作流
    const results = await Promise.all(stockAnalysisPromises);
    
    const successfulStocks = results.filter(r => r.success).length;
    const failedStocks = results.filter(r => !r.success).length;
    
    console.log('股票分析子工作流执行完成', {
      totalStocks: results.length,
      successfulStocks,
      failedStocks,
    });

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('获取自选股列表失败', { error: errorMessage });
    throw new Error(`无法获取自选股列表: ${errorMessage}`);
  }
}