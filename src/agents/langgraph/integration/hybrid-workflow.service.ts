/**
 * 混合工作流服务
 * 结合 LangGraphJS 和 Temporal 的优势，提供智能的工作流执行
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessLogger, LogCategory } from '../../../common/utils/business-logger.util';
import { WorkflowBridgeService, WorkflowExecutionMode, WorkflowExecutionResult } from './workflow-bridge';
import { WorkflowSwitcherService, WorkflowDecision } from './workflow-switcher';
import { AgentExecutionRecordService } from '../../services/agent-execution-record.service';
import { PerformanceMonitorService, PerformanceMetrics, SystemHealthStatus } from '../monitoring/performance-monitor';

/**
 * 混合工作流配置
 */
export interface HybridWorkflowConfig {
  /** 是否启用智能路由 */
  enableSmartRouting: boolean;
  /** 是否启用自适应学习 */
  enableAdaptiveLearning: boolean;
  /** 性能监控窗口大小 */
  performanceWindow: number;
  /** 决策优化阈值 */
  optimizationThreshold: number;
  /** 缓存决策结果 */
  enableDecisionCaching: boolean;
  /** 缓存过期时间 */
  cacheExpiry: number;
}

/**
 * 工作流性能统计
 */
export interface WorkflowPerformanceStats {
  /** 执行次数 */
  executionCount: number;
  /** 成功次数 */
  successCount: number;
  /** 平均执行时间 */
  averageExecutionTime: number;
  /** 成功率 */
  successRate: number;
  /** 各模式统计 */
  modeStats: Record<WorkflowExecutionMode, {
    count: number;
    successCount: number;
    averageTime: number;
    successRate: number;
  }>;
}

/**
 * 混合工作流服务
 * 智能地结合 LangGraphJS 和 Temporal 的优势
 */
@Injectable()
export class HybridWorkflowService implements OnModuleInit {
  private readonly logger: BusinessLogger;
  private config: HybridWorkflowConfig;
  private performanceStats: Map<string, WorkflowPerformanceStats> = new Map();
  private decisionCache: Map<string, { decision: WorkflowDecision; timestamp: Date }> = new Map();
  private adaptiveModel: any = null; // 自适应学习模型

  constructor(
    private readonly configService: ConfigService,
    private readonly workflowBridge: WorkflowBridgeService,
    private readonly workflowSwitcher: WorkflowSwitcherService,
    private readonly executionRecordService: AgentExecutionRecordService,
    private readonly performanceMonitor: PerformanceMonitorService,
  ) {
    this.logger = new BusinessLogger(HybridWorkflowService.name);
  }

  /**
   * 模块初始化
   */
  async onModuleInit(): Promise<void> {
    await this.initializeConfig();
    // Note: initializeAdaptiveModel method will be added later
    
    this.logger.serviceInfo('混合工作流服务初始化完成', {
      config: this.config,
      adaptiveModelEnabled: this.adaptiveModel !== null,
    });
  }

  /**
   * 初始化配置
   */
  private async initializeConfig(): Promise<void> {
    this.config = {
      enableSmartRouting: this.configService.get<boolean>(
        'HYBRID_WORKFLOW_ENABLE_SMART_ROUTING',
        true
      ),
      enableAdaptiveLearning: this.configService.get<boolean>(
        'HYBRID_WORKFLOW_ENABLE_ADAPTIVE_LEARNING',
        true
      ),
      performanceWindow: this.configService.get<number>(
        'HYBRID_WORKFLOW_PERFORMANCE_WINDOW',
        1000
      ),
      optimizationThreshold: this.configService.get<number>(
        'HYBRID_WORKFLOW_OPTIMIZATION_THRESHOLD',
        0.1
      ),
      enableDecisionCaching: this.configService.get<boolean>(
        'HYBRID_WORKFLOW_ENABLE_DECISION_CACHING',
        true
      ),
      cacheExpiry: this.configService.get<number>(
        'HYBRID_WORKFLOW_CACHE_EXPIRY',
        300000, // 5分钟
      ),
    };
  }

  /**
   * 初始化自适应学习模型
   */
  private async initializeAdaptiveLearning(): Promise<void> {
    if (!this.config.enableAdaptiveLearning) {
      return;
    }

    try {
      // 这里可以加载或创建简单的机器学习模型
      // 简化实现：使用基于规则的模型
      this.adaptiveModel = {
        predict: (features: any) => this.simpleRuleBasedPrediction(features),
        update: (features: any, result: any) => this.updateModel(features, result),
      };

      this.logger.serviceInfo('自适应学习模型初始化完成');
    } catch (error) {
      this.logger.warn(LogCategory.SERVICE_ERROR, '自适应学习模型初始化失败，使用默认规则', undefined, {
        error: (error as Error).message,
      });
    }
  }

  /**
   * 执行混合工作流
   */
  async executeHybridWorkflow(params: {
    stockCode: string;
    stockName?: string;
    sessionId: string;
    workflowId?: string;
    enableMessagePush?: boolean;
    isScheduledRun?: boolean;
    metadata?: Record<string, any>;
    forceMode?: WorkflowExecutionMode;
    priority?: 'high' | 'medium' | 'low';
    realtimeRequired?: boolean;
  }): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(params);
    
    this.logger.serviceInfo('开始执行混合工作流', {
      stockCode: params.stockCode,
      sessionId: params.sessionId,
      priority: params.priority,
      realtimeRequired: params.realtimeRequired,
    });

    try {
      // 1. 获取系统健康状态
      const systemHealth = await this.performanceMonitor.getSystemHealthStatus();
      
      // 2. 获取或创建工作流决策
      let workflowDecision: WorkflowDecision;
      
      if (params.forceMode) {
        // 强制使用指定模式
        workflowDecision = {
          mode: params.forceMode,
          reason: '强制指定模式',
          confidence: 1.0,
          alternatives: [],
          timestamp: new Date(),
        };
      } else if (this.config.enableDecisionCaching) {
        // 尝试从缓存获取决策
        workflowDecision = await this.getOrCacheDecision(cacheKey, params);
      } else {
        // 实时决策
        workflowDecision = await this.workflowSwitcher.selectOptimalWorkflow(params);
      }

      // 3. 执行工作流
      const executionResult = await this.workflowBridge.executeStockAnalysis({
        ...params,
        forceMode: workflowDecision.mode,
      });

      // 4. 记录详细的性能指标
      const performanceMetrics: PerformanceMetrics = {
        timestamp: new Date(),
        mode: executionResult.mode,
        stockCode: params.stockCode,
        executionTime: executionResult.executionTime,
        success: executionResult.success,
        dataQuality: await this.estimateDataQuality(params.stockCode),
        systemLoad: {
          cpu: systemHealth.cpuUsage,
          memory: systemHealth.memoryUsage,
          activeWorkflows: systemHealth.activeWorkflows,
        },
        error: executionResult.error,
        metadata: {
          ...params.metadata,
          decisionReason: workflowDecision.reason,
          decisionConfidence: workflowDecision.confidence,
          priority: params.priority,
          realtimeRequired: params.realtimeRequired,
        },
      };

      // 5. 记录性能指标
      await this.performanceMonitor.recordMetrics(performanceMetrics);

      // 6. 更新性能统计
      this.updatePerformanceStats(params.stockCode, executionResult);

      // 7. 更新自适应模型
      if (this.config.enableAdaptiveLearning && this.adaptiveModel) {
        await this.updateAdaptiveModel(params, workflowDecision, executionResult);
      }

      // 8. 记录执行结果
      await this.recordExecution(params, workflowDecision, executionResult);

      this.logger.serviceInfo('混合工作流执行完成', {
        stockCode: params.stockCode,
        selectedMode: workflowDecision.mode,
        decisionReason: workflowDecision.reason,
        executionSuccess: executionResult.success,
        executionTime: executionResult.executionTime,
        performanceScore: performanceMetrics.dataQuality,
      });

      return executionResult;

    } catch (error) {
      this.logger.serviceError('混合工作流执行失败', error as Error, {
        stockCode: params.stockCode,
        sessionId: params.sessionId,
      });

      // 记录失败指标
      await this.performanceMonitor.recordMetrics({
        mode: params.forceMode || WorkflowExecutionMode.HYBRID,
        stockCode: params.stockCode,
        executionTime: Date.now() - startTime,
        success: false,
        error: (error as Error).message,
        systemLoad: {
          cpu: 0,
          memory: 0,
          activeWorkflows: 0,
        },
        metadata: params.metadata,
      });

      // 返回失败结果
      return {
        mode: params.forceMode || WorkflowExecutionMode.HYBRID,
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
        retryCount: 0,
        systemInfo: {
          langgraphjsAvailable: false,
          temporalAvailable: false,
          fallbackUsed: true,
        },
      };
    }
  }

  /**
   * 获取或缓存决策
   */
  private async getOrCacheDecision(cacheKey: string, params: any): Promise<WorkflowDecision> {
    // 检查缓存
    const cached = this.decisionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp.getTime() < this.config.cacheExpiry) {
      this.logger.debug(LogCategory.SERVICE_INFO, '使用缓存的决策', undefined, {
        cacheKey,
        cachedDecision: cached.decision,
      });
      return cached.decision;
    }

    // 获取新决策
    const decision = await this.workflowSwitcher.selectOptimalWorkflow(params);
    
    // 缓存决策
    this.decisionCache.set(cacheKey, { decision, timestamp: new Date() });
    
    // 清理过期缓存
    this.cleanupExpiredCache();

    return decision;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(params: any): string {
    const keyComponents = [
      params.stockCode,
      params.priority || 'medium',
      params.realtimeRequired ? 'realtime' : 'normal',
    ];
    return keyComponents.join('_');
  }

  /**
   * 估算数据质量
   */
  private async estimateDataQuality(stockCode: string): Promise<number> {
    try {
      // 使用性能监控系统的数据质量评估功能
      const recentMetrics = await this.performanceMonitor.getMetricsByStock(stockCode, 1);
      
      if (recentMetrics.length === 0) {
        return 0.8; // 默认质量分数
      }

      // 基于历史成功率计算质量分数
      const successRate = recentMetrics.filter(m => m.success).length / recentMetrics.length;
      const avgExecutionTime = recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length;
      
      // 综合评分：成功率占70%，执行时间占30%
      const qualityScore = (successRate * 0.7) + (Math.max(0, 1 - avgExecutionTime / 10000) * 0.3);
      
      return Math.min(1, Math.max(0, qualityScore));
    } catch (error) {
      this.logger.warn(LogCategory.SERVICE_ERROR, '数据质量评估失败', undefined, {
        stockCode,
        error: (error as Error).message,
      });
      return 0.8; // 默认值
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.decisionCache.entries()) {
      if (now - value.timestamp.getTime() > this.config.cacheExpiry) {
        this.decisionCache.delete(key);
      }
    }
  }

  /**
   * 更新性能统计
   */
  private updatePerformanceStats(stockCode: string, result: WorkflowExecutionResult): void {
    let stats = this.performanceStats.get(stockCode);
    
    if (!stats) {
      stats = this.initializePerformanceStats();
      this.performanceStats.set(stockCode, stats);
    }

    // 更新总体统计
    stats.executionCount++;
    if (result.success) {
      stats.successCount++;
    }
    stats.averageExecutionTime = this.calculateAverageTime(stats, result.executionTime);
    stats.successRate = stats.successCount / stats.executionCount;

    // 更新模式统计
    const modeStats = stats.modeStats[result.mode];
    modeStats.count++;
    if (result.success) {
      modeStats.successCount++;
    }
    modeStats.averageTime = this.calculateAverageTime(modeStats, result.executionTime);
    modeStats.successRate = modeStats.successCount / modeStats.count;

    // 保持统计窗口大小
    if (stats.executionCount > this.config.performanceWindow) {
      this.prunePerformanceStats(stats);
    }
  }

  /**
   * 初始化性能统计
   */
  private initializePerformanceStats(): WorkflowPerformanceStats {
    const modeStats: Record<WorkflowExecutionMode, any> = {} as any;
    
    for (const mode of Object.values(WorkflowExecutionMode)) {
      modeStats[mode] = {
        count: 0,
        successCount: 0,
        averageTime: 0,
        successRate: 0,
      };
    }

    return {
      executionCount: 0,
      successCount: 0,
      averageExecutionTime: 0,
      successRate: 0,
      modeStats,
    };
  }

  /**
   * 计算平均时间
   */
  private calculateAverageTime(stats: any, newTime: number): number {
    if (stats.count === 1) {
      return newTime;
    }
    return (stats.averageExecutionTime * (stats.count - 1) + newTime) / stats.count;
  }

  /**
   * 修剪性能统计
   */
  private prunePerformanceStats(stats: WorkflowPerformanceStats): void {
    // 简化实现：重置统计
    // 实际应该实现滑动窗口或采样算法
    const ratio = this.config.performanceWindow / stats.executionCount;
    
    stats.executionCount = Math.round(stats.executionCount * ratio);
    stats.successCount = Math.round(stats.successCount * ratio);
    
    for (const mode of Object.values(WorkflowExecutionMode)) {
      const modeStats = stats.modeStats[mode];
      modeStats.count = Math.round(modeStats.count * ratio);
      modeStats.successCount = Math.round(modeStats.successCount * ratio);
    }
  }

  /**
   * 更新自适应模型
   */
  private async updateAdaptiveModel(
    params: any,
    decision: WorkflowDecision,
    result: WorkflowExecutionResult
  ): Promise<void> {
    try {
      const features = {
        stockCode: params.stockCode,
        priority: params.priority,
        realtimeRequired: params.realtimeRequired,
        timestamp: Date.now(),
      };

      const modelResult = {
        selectedMode: decision.mode,
        success: result.success,
        executionTime: result.executionTime,
        confidence: decision.confidence,
      };

      await this.adaptiveModel.update(features, modelResult);
    } catch (error) {
      this.logger.warn(LogCategory.SERVICE_ERROR, '更新自适应模型失败', undefined, {
        error: (error as Error).message,
      });
    }
  }

  /**
   * 简单基于规则的预测
   */
  private simpleRuleBasedPrediction(features: any): WorkflowExecutionMode {
    // 基于简单的规则预测最优模式
    if (features.priority === 'high' && features.realtimeRequired) {
      return WorkflowExecutionMode.LANGGRAPHJS;
    }
    
    if (features.priority === 'low' && !features.realtimeRequired) {
      return WorkflowExecutionMode.TEMPORAL;
    }
    
    return WorkflowExecutionMode.HYBRID;
  }

  /**
   * 更新模型
   */
  private async updateModel(features: any, result: any): Promise<void> {
    // 简化实现：记录学习数据
    // 实际应该实现真正的机器学习更新逻辑
    this.logger.debug(LogCategory.SERVICE_INFO, '更新自适应模型', undefined, {
      features,
      result,
    });
  }

  /**
   * 记录执行结果
   */
  private async recordExecution(
    params: any,
    decision: WorkflowDecision,
    result: WorkflowExecutionResult
  ): Promise<void> {
    try {
      await this.executionRecordService.create({
        sessionId: params.sessionId,
        agentType: 'HybridWorkflow',
        agentName: 'HybridWorkflowService',
        executionPhase: 'workflow_execution',
        llmProvider: result.mode,
        llmModel: 'N/A',
        inputMessages: {
          input: JSON.stringify({
            ...params,
            workflowDecision: decision,
          })
        },
        outputContent: JSON.stringify(result),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        executionTimeMs: result.executionTime,
        status: result.success ? 'success' : 'failed',
        metadata: {
          decisionReason: decision.reason,
          decisionConfidence: decision.confidence,
          selectedMode: decision.mode,
          stockCode: params.stockCode,
        },
      });
    } catch (error) {
      this.logger.warn(LogCategory.SERVICE_ERROR, '记录执行结果失败', undefined, {
        error: (error as Error).message,
      });
    }
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    overall: WorkflowPerformanceStats;
    byStock: Record<string, WorkflowPerformanceStats>;
    topPerformers: Array<{
      stockCode: string;
      successRate: number;
      averageTime: number;
    }>;
    recommendations: string[];
  } {
    const overall = this.getOverallPerformanceStats();
    const byStock = Object.fromEntries(this.performanceStats);
    
    const topPerformers = Object.entries(byStock)
      .map(([stockCode, stats]) => ({
        stockCode,
        successRate: stats.successRate,
        averageTime: stats.averageExecutionTime,
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10);

    const recommendations = this.generateRecommendations(overall, byStock);

    return {
      overall,
      byStock,
      topPerformers,
      recommendations,
    };
  }

  /**
   * 获取总体性能统计
   */
  private getOverallPerformanceStats(): WorkflowPerformanceStats {
    const allStats = Array.from(this.performanceStats.values());
    
    if (allStats.length === 0) {
      return this.initializePerformanceStats();
    }

    const overall = this.initializePerformanceStats();
    
    // 聚合所有统计
    for (const stats of allStats) {
      overall.executionCount += stats.executionCount;
      overall.successCount += stats.successCount;
      
      for (const mode of Object.values(WorkflowExecutionMode)) {
        const modeStats = stats.modeStats[mode];
        overall.modeStats[mode].count += modeStats.count;
        overall.modeStats[mode].successCount += modeStats.successCount;
      }
    }

    // 计算比率
    overall.successRate = overall.successCount / overall.executionCount;
    overall.averageExecutionTime = this.calculateWeightedAverage(allStats);
    
    for (const mode of Object.values(WorkflowExecutionMode)) {
      const modeStats = overall.modeStats[mode];
      if (modeStats.count > 0) {
        modeStats.successRate = modeStats.successCount / modeStats.count;
        modeStats.averageTime = this.calculateModeAverageTime(allStats, mode);
      }
    }

    return overall;
  }

  /**
   * 计算加权平均执行时间
   */
  private calculateWeightedAverage(stats: WorkflowPerformanceStats[]): number {
    let totalWeightedTime = 0;
    let totalCount = 0;
    
    for (const stat of stats) {
      totalWeightedTime += stat.averageExecutionTime * stat.executionCount;
      totalCount += stat.executionCount;
    }
    
    return totalCount > 0 ? totalWeightedTime / totalCount : 0;
  }

  /**
   * 计算模式的平均时间
   */
  private calculateModeAverageTime(stats: WorkflowPerformanceStats[], mode: WorkflowExecutionMode): number {
    let totalWeightedTime = 0;
    let totalCount = 0;
    
    for (const stat of stats) {
      const modeStats = stat.modeStats[mode];
      if (modeStats.count > 0) {
        totalWeightedTime += modeStats.averageTime * modeStats.count;
        totalCount += modeStats.count;
      }
    }
    
    return totalCount > 0 ? totalWeightedTime / totalCount : 0;
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(
    overall: WorkflowPerformanceStats,
    byStock: Record<string, WorkflowPerformanceStats>
  ): string[] {
    const recommendations: string[] = [];

    // 基于总体性能的建议
    if (overall.successRate < 0.9) {
      recommendations.push(`总体成功率较低 (${(overall.successRate * 100).toFixed(1)}%)，建议检查系统配置`);
    }

    if (overall.averageExecutionTime > 10000) {
      recommendations.push(`平均执行时间较长 (${overall.averageExecutionTime.toFixed(0)}ms)，建议优化性能`);
    }

    // 基于模式性能的建议
    for (const mode of Object.values(WorkflowExecutionMode)) {
      const modeStats = overall.modeStats[mode];
      if (modeStats.count > 10 && modeStats.successRate < 0.8) {
        recommendations.push(`${mode} 模式成功率较低 (${(modeStats.successRate * 100).toFixed(1)}%)，建议检查或减少使用`);
      }
    }

    // 基于个股性能的建议
    const poorPerformers = Object.entries(byStock)
      .filter(([_, stats]) => stats.executionCount > 5 && stats.successRate < 0.7)
      .map(([stockCode]) => stockCode);

    if (poorPerformers.length > 0) {
      recommendations.push(`以下股票分析成功率较低: ${poorPerformers.join(', ')}，建议重点关注`);
    }

    return recommendations;
  }

  /**
   * 优化配置
   */
  async optimizeConfiguration(): Promise<{
    optimizations: Array<{
      parameter: string;
      oldValue: any;
      newValue: any;
      reason: string;
    }>;
    expectedImprovement: string;
  }> {
    const performance = this.getPerformanceReport();
    const optimizations: any[] = [];

    // 基于性能数据调整配置
    if (performance.overall.successRate < 0.9) {
      const bestMode = Object.entries(performance.overall.modeStats)
        .reduce((best, [mode, stats]) => 
          stats.successRate > best.rate ? { mode, rate: stats.successRate } : best, 
          { mode: '', rate: 0 }
        );

      if (bestMode.rate > 0.9) {
        optimizations.push({
          parameter: 'defaultMode',
          oldValue: this.configService.get('WORKFLOW_BRIDGE_DEFAULT_MODE'),
          newValue: bestMode.mode,
          reason: `${bestMode.mode} 模式成功率更高 (${(bestMode.rate * 100).toFixed(1)}%)`,
        });
      }
    }

    // 基于执行时间调整缓存配置
    if (performance.overall.averageExecutionTime > 5000) {
      optimizations.push({
        parameter: 'enableDecisionCaching',
        oldValue: this.config.enableDecisionCaching,
        newValue: true,
        reason: '执行时间较长，启用决策缓存可以减少决策开销',
      });
    }

    const expectedImprovement = optimizations.length > 0 
      ? `预计成功率提升 ${((optimizations.length * 5)).toFixed(1)}%`
      : '当前配置已优化，无明显改进空间';

    return {
      optimizations,
      expectedImprovement,
    };
  }

  /**
   * 重置统计数据
   */
  resetPerformanceStats(): void {
    this.performanceStats.clear();
    this.decisionCache.clear();
    this.logger.serviceInfo('性能统计数据已重置');
  }

  /**
   * 获取配置信息
   */
  getConfig(): HybridWorkflowConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  async updateConfig(config: Partial<HybridWorkflowConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.logger.serviceInfo('混合工作流配置已更新', { config: this.config });
  }

  /**
   * 获取增强的性能报告（结合性能监控服务）
   */
  async getEnhancedPerformanceReport(): Promise<{
    hybridWorkflow: any;
    performanceMonitor: any;
    systemHealth: SystemHealthStatus;
    predictions: any;
    alerts: any[];
  }> {
    const [hybridReport, performanceReport, systemHealth, predictions] = await Promise.all([
      this.getPerformanceReport(),
      this.performanceMonitor.getPerformanceReport(),
      this.performanceMonitor.getSystemHealthStatus(),
      this.performanceMonitor.getPredictions(),
    ]);

    const alerts = this.generateAlerts(systemHealth, performanceReport, predictions);

    return {
      hybridWorkflow: hybridReport,
      performanceMonitor: performanceReport,
      systemHealth,
      predictions,
      alerts,
    };
  }

  /**
   * 获取实时监控数据
   */
  async getRealTimeMonitoring(): Promise<{
    currentMetrics: PerformanceMetrics[];
    systemStatus: SystemHealthStatus;
    activeWorkflows: any[];
    recentAlerts: any[];
  }> {
    const [recentMetrics, systemStatus, activeWorkflows] = await Promise.all([
      this.performanceMonitor.getRecentMetrics(10),
      this.performanceMonitor.getSystemHealthStatus(),
      this.performanceMonitor.getActiveWorkflows(),
    ]);

    const recentAlerts = this.generateAlerts(systemStatus, await this.performanceMonitor.getPerformanceReport(), await this.performanceMonitor.getPredictions());

    return {
      currentMetrics: recentMetrics,
      systemStatus,
      activeWorkflows,
      recentAlerts,
    };
  }

  /**
   * 获取趋势分析
   */
  async getTrendAnalysis(timeRange: string = '24h'): Promise<{
    performanceTrends: any;
    errorTrends: any;
    workloadTrends: any;
    recommendations: string[];
  }> {
    const endTime = new Date();
    const startTime = this.getTimeRangeStart(timeRange);

    const [performanceTrends, errorTrends, workloadTrends] = await Promise.all([
      this.performanceMonitor.getPerformanceTrends(startTime, endTime),
      this.performanceMonitor.getErrorTrends(startTime, endTime),
      this.performanceMonitor.getWorkloadTrends(startTime, endTime),
    ]);

    const recommendations = await this.generateTrendRecommendations(performanceTrends, errorTrends, workloadTrends);

    return {
      performanceTrends,
      errorTrends,
      workloadTrends,
      recommendations,
    };
  }

  /**
   * 导出性能数据
   */
  async exportPerformanceData(format: 'json' | 'csv', filters?: {
    stockCode?: string;
    mode?: WorkflowExecutionMode;
    startDate?: Date;
    endDate?: Date;
  }): Promise<string> {
    return await this.performanceMonitor.exportMetrics(format, filters);
  }

  /**
   * 生成告警
   */
  private generateAlerts(systemHealth: SystemHealthStatus, performanceReport: any, predictions: any): any[] {
    const alerts: any[] = [];

    // 系统健康告警
    if (systemHealth.cpuUsage > 80) {
      alerts.push({
        type: 'SYSTEM',
        severity: 'HIGH',
        message: `CPU使用率过高: ${systemHealth.cpuUsage.toFixed(1)}%`,
        timestamp: new Date(),
        metric: 'cpu_usage',
        value: systemHealth.cpuUsage,
        threshold: 80,
      });
    }

    if (systemHealth.memoryUsage > 85) {
      alerts.push({
        type: 'SYSTEM',
        severity: 'HIGH',
        message: `内存使用率过高: ${systemHealth.memoryUsage.toFixed(1)}%`,
        timestamp: new Date(),
        metric: 'memory_usage',
        value: systemHealth.memoryUsage,
        threshold: 85,
      });
    }

    // 性能告警
    if (performanceReport.overall.successRate < 0.9) {
      alerts.push({
        type: 'PERFORMANCE',
        severity: 'MEDIUM',
        message: `总体成功率过低: ${(performanceReport.overall.successRate * 100).toFixed(1)}%`,
        timestamp: new Date(),
        metric: 'success_rate',
        value: performanceReport.overall.successRate,
        threshold: 0.9,
      });
    }

    // 预测告警
    if (predictions.errorProbability > 0.3) {
      alerts.push({
        type: 'PREDICTION',
        severity: 'MEDIUM',
        message: `未来1小时错误率预测较高: ${(predictions.errorProbability * 100).toFixed(1)}%`,
        timestamp: new Date(),
        metric: 'error_probability',
        value: predictions.errorProbability,
        threshold: 0.3,
      });
    }

    return alerts;
  }

  /**
   * 生成趋势建议
   */
  private async generateTrendRecommendations(performanceTrends: any, errorTrends: any, workloadTrends: any): Promise<string[]> {
    const recommendations: string[] = [];

    // 性能趋势分析
    if (performanceTrends.trend === 'decreasing') {
      recommendations.push('性能呈下降趋势，建议检查系统资源使用情况');
    }

    // 错误趋势分析
    if (errorTrends.trend === 'increasing') {
      recommendations.push('错误率呈上升趋势，建议检查外部依赖和系统稳定性');
    }

    // 工作负载趋势分析
    if (workloadTrends.trend === 'increasing' && workloadTrends.predictedLoad > 80) {
      recommendations.push('工作负载持续增加，预计将达到系统容量限制，建议扩容或优化');
    }

    // 模式性能建议
    const performanceReport = await this.performanceMonitor.getPerformanceReport();
    for (const mode of Object.keys(performanceReport.byMode)) {
      const stats = performanceReport.byMode[mode];
      if (stats.successRate < 0.8 && stats.count > 10) {
        recommendations.push(`${mode} 模式成功率较低 (${(stats.successRate * 100).toFixed(1)}%)，建议检查或优化`);
      }
    }

    return recommendations;
  }

  /**
   * 获取时间范围开始时间
   */
  private getTimeRangeStart(timeRange: string): Date {
    const now = new Date();
    const ranges: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    const duration = ranges[timeRange] || ranges['24h'];
    return new Date(now.getTime() - duration);
  }
}