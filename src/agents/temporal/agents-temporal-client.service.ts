/**
 * 智能体模块专属 Temporal 客户端服务
 * 严格按照新的命名规范: agents-{environment}
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Connection, WorkflowHandle, WorkflowIdReusePolicy } from '@temporalio/client';
import { BusinessLogger } from '../../common/utils/business-logger.util';

export interface StockAnalysisWorkflowInput {
  stockCode: string;
  stockName?: string;
  sessionId: string;
  metadata: Record<string, any>;
}

// 注意：不再支持批量分析，每次只处理一只股票

@Injectable()
export class AgentsTemporalClientService implements OnModuleDestroy {
  private readonly logger = new BusinessLogger(AgentsTemporalClientService.name);
  private client?: Client;
  private connection?: Connection;
  private readonly namespace: string;
  private readonly environment: string;

  constructor(private readonly configService: ConfigService) {
    this.environment = this.configService.get('NODE_ENV', 'dev');
    this.namespace = `agents-${this.environment}`;
    this.initializeClient();
  }

  /**
   * 初始化智能体模块专属 Temporal 客户端
   */
  private async initializeClient(): Promise<void> {
    try {
      // 创建连接
      this.connection = await Connection.connect({
        address: `${this.configService.get('TEMPORAL_HOST', 'localhost')}:${this.configService.get('TEMPORAL_PORT', '7233')}`,
      });

      // 创建客户端 - 使用智能体模块专属命名空间
      this.client = new Client({
        connection: this.connection,
        namespace: this.namespace,
      });

      this.logger.serviceInfo(`智能体模块 Temporal 客户端已连接`, {
        namespace: this.namespace,
        environment: this.environment,
      });
    } catch (error) {
      this.logger.serviceError('智能体模块 Temporal 客户端初始化失败', error, {
        namespace: this.namespace,
        environment: this.environment,
      });
      // 在测试环境或Temporal不可用时继续运行
    }
  }

  /**
   * 启动股票分析工作流
   * 使用股票代码+日期作为workflowId保证当天同一股票不重复执行
   */
  async startStockAnalysisWorkflow(input: StockAnalysisWorkflowInput): Promise<WorkflowHandle | null> {
    if (!this.client) {
      this.logger.warn('Temporal 客户端未初始化，无法启动工作流');
      return null;
    }

    try {
      const taskQueue = `agents-analysis-${this.environment}`;
      
      // 使用股票代码+当前日期作为workflowId，确保当天同一股票不重复执行
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD格式
      const workflowId = `stock-analysis-${input.stockCode}-${today}`;

      // 使用MCP工作流
      const handle = await this.client.workflow.start('stockAnalysisMCPWorkflow', {
        taskQueue,
        workflowId,
        args: [input],
        workflowExecutionTimeout: this.configService.get('WORKFLOW_EXECUTION_TIMEOUT', '30m'),
        // 如果工作流已存在且失败了，允许重复执行
        workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE_FAILED_ONLY,
      });

      this.logger.serviceInfo('股票分析工作流已启动', {
        workflowId,
        taskQueue,
        stockCode: input.stockCode,
        analysisDate: today,
      });

      return handle;
    } catch (error) {
      // 如果是因为workflowId已存在导致的错误，尝试获取已存在的工作流
      if (error.message && error.message.includes('WorkflowExecutionAlreadyStarted')) {
        const today = new Date().toISOString().split('T')[0];
        const workflowId = `stock-analysis-${input.stockCode}-${today}`;
        
        this.logger.serviceInfo('当天该股票的分析工作流已存在，返回已存在的句柄', {
          workflowId,
          stockCode: input.stockCode,
        });
        
        try {
          return await this.getWorkflowHandle(workflowId);
        } catch (getHandleError) {
          this.logger.serviceError('获取已存在的工作流句柄失败', getHandleError);
          return null;
        }
      }
      
      this.logger.serviceError('启动股票分析工作流失败', error, {
        stockCode: input.stockCode,
      });
      throw error;
    }
  }

  // 注意：根据需求，不再支持批量分析工作流
  // 每次只分析一只股票，并使用股票代码+日期保证唯一性

  /**
   * 获取工作流句柄
   */
  async getWorkflowHandle(workflowId: string): Promise<WorkflowHandle | null> {
    if (!this.client) {
      return null;
    }

    try {
      return this.client.workflow.getHandle(workflowId);
    } catch (error) {
      this.logger.serviceError('获取工作流句柄失败', error, { workflowId });
      return null;
    }
  }

  /**
   * 检查客户端连接状态
   */
  isConnected(): boolean {
    return !!this.client && !!this.connection;
  }

  /**
   * 获取客户端信息
   */
  getClientInfo(): {
    namespace: string;
    environment: string;
    connected: boolean;
  } {
    return {
      namespace: this.namespace,
      environment: this.environment,
      connected: this.isConnected(),
    };
  }

  /**
   * 重新连接
   */
  async reconnect(): Promise<void> {
    this.logger.serviceInfo('重新连接智能体模块 Temporal 客户端...');
    
    try {
      await this.close();
      await this.initializeClient();
      this.logger.serviceInfo('智能体模块 Temporal 客户端重连成功');
    } catch (error) {
      this.logger.serviceError('智能体模块 Temporal 客户端重连失败', error);
      throw error;
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.close();
        this.logger.serviceInfo('智能体模块 Temporal 连接已关闭');
      }
    } catch (error) {
      this.logger.serviceError('关闭 Temporal 连接失败', error);
    } finally {
      this.client = undefined;
      this.connection = undefined;
    }
  }

  /**
   * 模块销毁时自动关闭连接
   */
  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}