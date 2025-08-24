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

/**
 * 创建MCP活动实现
 * 注意：分析逻辑已移至workflow中，这里只提供MCP数据获取活动
 */
export function createActivities(
  configService: ConfigService
): MCPActivities {
  // 创建MCP Activities
  const mcpActivities = createMCPActivities(configService);

  return mcpActivities;
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

  // 根据新规范使用动态 taskQueue: agents-analysis-{environment}
  const environment = configService.get('NODE_ENV', 'dev');
  const taskQueue = `agents-analysis-${environment}`;
  
  // 创建Worker
  const worker = await Worker.create({
    workflowsPath: require.resolve('../orchestrators/stock-analysis-mcp.workflow'),
    activities,
    taskQueue,
  });
  
  console.log(`Temporal Worker 正在监听 taskQueue: ${taskQueue}`);

  return worker;
}