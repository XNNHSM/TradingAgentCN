/**
 * Temporal Worker配置
 * 用于执行工作流和活动
 */

// import { NestContainer } from '@nestjs/core';
import { Worker } from '@temporalio/worker';
import { ConfigService } from '@nestjs/config';
import { MCPClientService } from '../../agents/services/mcp-client.service';
import { BusinessLogger } from '../../common/utils/business-logger.util';
import type { MCPActivities } from '../activities/mcp.activities';
import { createMCPActivities } from '../activities/mcp.activities';
import type { PolicyAnalysisActivities } from '../activities/policy-analysis.activities';
import { createPolicyAnalysisActivities } from '../activities/policy-analysis.activities';
import { NewsSummaryService } from '../../modules/news/services/news-summary.service';

/**
 * 创建所有活动实现
 * 包含MCP数据获取活动和政策分析活动
 */
export function createActivities(
  configService: ConfigService,
  newsSummaryService?: NewsSummaryService
): MCPActivities & PolicyAnalysisActivities {
  // 创建MCP Activities
  const mcpActivities = createMCPActivities(configService);
  
  // 创建政策分析Activities
  let policyActivities = {};
  if (newsSummaryService) {
    policyActivities = createPolicyAnalysisActivities(configService, newsSummaryService);
  } else {
    // 如果没有传入newsSummaryService，创建一个临时实例
    // 这在单独的worker进程中很有用
    try {
      // 在单独worker进程中，我们需要手动创建NewsSummaryService
      // 但这需要数据库连接，在实际部署时可能需要不同的处理方式
      console.warn('NewsSummaryService未提供，政策分析活动将不可用');
    } catch (error) {
      console.warn('无法创建政策分析活动:', error.message);
    }
  }

  // 合并所有活动
  return {
    ...mcpActivities,
    ...policyActivities,
  };
}

/**
 * 创建并启动Temporal Worker
 * 注意：分析逻辑已集成到workflow中，这里只提供MCP数据获取活动
 */
export async function createTemporalWorker(
  configService: ConfigService
): Promise<Worker> {
  // 创建MCP活动实现
  const activities = createActivities(configService);

  // 使用简化的业务功能名称 taskQueue
  const taskQueue = 'stock-analysis';
  
  // 创建Worker
  const worker = await Worker.create({
    workflowsPath: require.resolve('../orchestrators/stock-analysis-mcp.workflow'),
    activities,
    taskQueue,
  });
  
  console.log(`Temporal Worker 正在监听 taskQueue: ${taskQueue}`);

  return worker;
}