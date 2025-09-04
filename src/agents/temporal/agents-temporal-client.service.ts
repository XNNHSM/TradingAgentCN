/**
 * 智能体模块 Temporal 客户端服务
 * 使用 default 命名空间简化配置
 */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkflowHandle } from '@temporalio/client';
import { BusinessLogger } from '../../common/utils/business-logger.util';
import { TemporalManager } from '../../common/temporal/temporal.manager';
import { WorkflowStartOptions } from '../../common/temporal/interfaces/temporal-config.interface';
import { stockAnalysisWorkflow } from '../../workflows/orchestrators/stock-analysis.workflow';
import type { StockAnalysisInput } from '../../workflows/orchestrators/stock-analysis.workflow';

// 注意：不再支持批量分析，每次只处理一只股票

@Injectable()
export class AgentsTemporalClientService implements OnModuleDestroy {
  private readonly logger = new BusinessLogger(AgentsTemporalClientService.name);
  private readonly environment: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly temporalManager: TemporalManager,
  ) {
    this.environment = this.configService.get('NODE_ENV', 'development');
  }

  /**
   * 检查Temporal连接状态
   */
  async checkConnection(): Promise<boolean> {
    try {
      return await this.temporalManager.checkConnection();
    } catch (error) {
      this.logger.serviceError('检查Temporal连接状态失败', error);
      return false;
    }
  }



  /**
   * 获取工作流句柄
   */
  async getWorkflowHandle(workflowId: string): Promise<WorkflowHandle | null> {
    try {
      return await this.temporalManager.getWorkflowHandle(workflowId);
    } catch (error) {
      this.logger.serviceError('获取工作流句柄失败', error, { workflowId });
      return null;
    }
  }

  /**
   * 检查客户端连接状态
   */
  async isConnected(): Promise<boolean> {
    return await this.temporalManager.checkConnection();
  }

  /**
   * 获取客户端信息
   */
  async getClientInfo(): Promise<{
    environment: string;
    connected: boolean;
    connectionStatus: any;
  }> {
    const connected = await this.isConnected();
    const connectionStatus = this.temporalManager.getConnectionStatus();
    
    return {
      environment: this.environment,
      connected,
      connectionStatus,
    };
  }

  /**
   * 重新连接
   */
  async reconnect(): Promise<void> {
    this.logger.serviceInfo('重新连接智能体模块 Temporal 客户端...');
    
    try {
      await this.temporalManager.reconnect();
      this.logger.serviceInfo('智能体模块 Temporal 客户端重连成功');
    } catch (error) {
      this.logger.serviceError('智能体模块 Temporal 客户端重连失败', error);
      throw error;
    }
  }

  /**
   * 模块销毁时的清理工作
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.serviceInfo('智能体模块 Temporal 客户端服务正在关闭...');
    // TemporalManager 会处理连接关闭，这里不需要额外操作
  }

  /**
   * 启动股票分析工作流
   * 使用三阶段智能体工作流：数据收集 -> 专业分析 -> 决策整合
   */
  async startStockAnalysisWorkflow(input: StockAnalysisInput): Promise<WorkflowHandle | null> {
    try {
      // 使用股票代码+当前日期作为workflowId
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD格式
      const workflowId = `stock-analysis-${input.stockCode}-${today}`;

      // 构建工作流启动选项
      const workflowOptions: WorkflowStartOptions<StockAnalysisInput> = {
        workflowType: stockAnalysisWorkflow,
        taskQueue: 'stock-analysis',
        workflowId,
        args: [input],
        timeout: this.configService.get('WORKFLOW_EXECUTION_TIMEOUT', '45m'), // 工作流需要更长时间
        retryPolicy: {
          maximumAttempts: 2, // 减少重试次数，因为智能体分析更复杂
          initialInterval: '2s',
          maximumInterval: '120s',
          backoffCoefficient: 2,
        },
      };

      // 使用统一管理器启动工作流
      const handle = await this.temporalManager.startWorkflow(workflowOptions);

      this.logger.serviceInfo('股票分析工作流已启动', {
        workflowId,
        taskQueue: workflowOptions.taskQueue,
        stockCode: input.stockCode,
        analysisDate: today,
        analysisType: 'comprehensive',
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
          // 获取已存在的工作流句柄
          const existingHandle = await this.temporalManager.getWorkflowHandle(workflowId);
          return existingHandle;
        } catch (getError) {
          this.logger.serviceError('获取已存在的工作流句柄失败', getError);
          throw getError;
        }
      }

      this.logger.serviceError('启动股票分析工作流失败', error, {
        stockCode: input.stockCode,
        sessionId: input.sessionId,
      });
      throw error;
    }
  }
}