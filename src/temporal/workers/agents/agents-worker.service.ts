/**
 * 智能体模块专属 Temporal Worker 服务
 * 基于新的Temporal统一封装架构重构
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from '@temporalio/worker';
import { BusinessLogger } from '../../../common/utils/business-logger.util';
import { TemporalManager } from '../../temporal.manager';
import { WorkerCreateOptions } from '../../interfaces/temporal-config.interface';
import { createActivities } from '../../core/worker/worker';
import { LLMService } from '../../../agents/services/llm.service';
import { MCPClientSDKService } from '../../../agents/services/mcp-client-sdk.service';
import { AgentExecutionRecordService } from '../../../agents/services/agent-execution-record.service';
import { AnalysisService } from '../../../modules/analysis/analysis.service';

@Injectable()
export class AgentsWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new BusinessLogger(AgentsWorkerService.name);
  private workers: Worker[] = [];
  private readonly environment: string;
  private readonly taskQueue: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly temporalManager: TemporalManager,
    private readonly llmService: LLMService,
    private readonly mcpClientService: MCPClientSDKService,
    private readonly executionRecordService?: AgentExecutionRecordService,
    private readonly analysisService?: AnalysisService,
  ) {
    this.environment = this.configService.get('NODE_ENV', 'dev');
    this.taskQueue = 'stock-analysis';
  }

  /**
   * 模块初始化时启动 Worker
   */
  async onModuleInit(): Promise<void> {
    try {
      // 在开发环境或测试环境中可以选择不启动 Worker
      if (this.configService.get('TEMPORAL_WORKER_ENABLED', 'true') === 'false') {
        this.logger.serviceInfo('Temporal Worker 被禁用，跳过启动');
        return;
      }

      await this.startWorkers();
    } catch (error) {
      this.logger.serviceError('启动 Agents Worker 失败', error);
      // 不抛出错误，避免影响整个应用启动
    }
  }

  /**
   * 启动智能体模块的所有 Workers
   * 使用新的Temporal统一封装架构
   */
  async startWorkers(): Promise<void> {
    try {
      // 创建所有活动实现（包括MCP、智能体分析活动和分析记录活动）
      const activities = createActivities(
        this.configService, 
        this.llmService, 
        this.mcpClientService,
        this.executionRecordService,
        this.analysisService
      );

      // 定义Worker配置 - 直接指向股票分析工作流
      const workerOptions: WorkerCreateOptions = {
        taskQueue: this.taskQueue,
        workflowsPath: require.resolve('../../workflows/stock-analysis.workflow'),
        activities,
        options: {
          maxConcurrentActivities: 10,
          maxConcurrentWorkflows: 3,
          enableLogging: this.environment !== 'production',
        },
      };

      // 使用统一管理器创建Worker
      const worker = await this.temporalManager.createWorker(workerOptions);
      this.workers.push(worker);

      this.logger.serviceInfo('智能体模块 Workers 启动成功', {
        environment: this.environment,
        taskQueue: workerOptions.taskQueue,
        workerCount: this.workers.length,
        maxConcurrentActivities: workerOptions.options?.maxConcurrentActivities,
        maxConcurrentWorkflows: workerOptions.options?.maxConcurrentWorkflows,
      });
    } catch (error) {
      this.logger.serviceError('启动智能体模块 Workers 失败', error);
      throw error;
    }
  }


  /**
   * 获取 Worker 状态信息
   */
  getWorkersStatus(): {
    environment: string;
    totalWorkers: number;
    workers: Array<{
      taskQueue: string;
      maxConcurrentActivities: number;
      maxConcurrentWorkflows: number;
    }>;
  } {
    return {
      environment: this.environment,
      totalWorkers: this.workers.length,
      workers: [
        {
          taskQueue: this.taskQueue,
          maxConcurrentActivities: 10,
          maxConcurrentWorkflows: 3,
        },
      ],
    };
  }

  /**
   * 检查 Workers 健康状态
   * 使用统一管理器的健康检查功能
   */
  async checkWorkersHealth(): Promise<{
    healthy: boolean;
    totalWorkers: number;
    activeWorkers: number;
    issues: string[];
  }> {
    try {
      const healthStatus = await this.temporalManager.checkWorkerHealth();
      
      return {
        healthy: healthStatus.healthy,
        totalWorkers: healthStatus.totalWorkers,
        activeWorkers: healthStatus.activeWorkers,
        issues: healthStatus.issues.map(issue => 
          `Worker ${issue.workerId} (${issue.taskQueue}): ${issue.issue}`
        ),
      };
    } catch (error) {
      this.logger.serviceError('检查Workers健康状态失败', error);
      return {
        healthy: false,
        totalWorkers: this.workers.length,
        activeWorkers: 0,
        issues: [`健康检查失败: ${error.message}`],
      };
    }
  }

  /**
   * 停止所有 Workers
   * 使用统一管理器的关闭功能
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.serviceInfo('正在关闭智能体模块 Workers...');
      
      // 使用统一管理器关闭所有Workers
      await this.temporalManager.shutdownWorkers();
      
      // 清空本地Worker数组
      this.workers = [];
      
      this.logger.serviceInfo('智能体模块所有 Workers 已关闭');
    } catch (error) {
      this.logger.serviceError('关闭智能体模块 Workers 失败', error);
      // 即使出错也清空本地数组
      this.workers = [];
    }
  }

  /**
   * 模块销毁时自动关闭 Workers
   */
  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }
}