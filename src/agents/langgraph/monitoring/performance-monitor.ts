/**
 * 性能监控组件
 * 提供详细的性能指标收集、分析和预测功能
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { BusinessLogger, LogCategory } from '../../../common/utils/business-logger.util';
import { WorkflowExecutionMode } from '../integration/workflow-bridge';

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  /** 时间戳 */
  timestamp: Date;
  /** 执行模式 */
  mode: WorkflowExecutionMode;
  /** 股票代码 */
  stockCode: string;
  /** 执行时间 */
  executionTime: number;
  /** 成功状态 */
  success: boolean;
  /** 数据质量分数 */
  dataQuality?: number;
  /** 系统负载 */
  systemLoad: {
    cpu: number;
    memory: number;
    activeWorkflows: number;
  };
  /** 错误信息 */
  error?: string;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 系统健康状态接口
 */
export interface SystemHealthStatus {
  /** 状态 */
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  /** CPU使用率 */
  cpuUsage: number;
  /** 内存使用率 */
  memoryUsage: number;
  /** 活跃工作流数量 */
  activeWorkflows: number;
  /** 磁盘使用率 */
  diskUsage?: number;
  /** 网络使用率 */
  networkUsage?: number;
  /** 最后检查时间 */
  lastCheck: Date;
}

/**
 * 性能统计接口
 */
export interface PerformanceStats {
  /** 总执行次数 */
  totalExecutions: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 平均执行时间 */
  averageExecutionTime: number;
  /** 中位数执行时间 */
  medianExecutionTime: number;
  /** 95百分位执行时间 */
  p95ExecutionTime: number;
  /** 99百分位执行时间 */
  p99ExecutionTime: number;
  /** 最小执行时间 */
  minExecutionTime: number;
  /** 最大执行时间 */
  maxExecutionTime: number;
  /** 标准差 */
  standardDeviation: number;
  /** 按模式统计 */
  byMode: Record<WorkflowExecutionMode, PerformanceStats>;
  /** 按股票统计 */
  byStock: Record<string, PerformanceStats>;
  /** 时间序列数据 */
  timeSeries: Array<{
    timestamp: Date;
    executionCount: number;
    averageTime: number;
    successRate: number;
  }>;
}

/**
 * 性能预测接口
 */
export interface PerformancePrediction {
  /** 预测的执行时间 */
  predictedExecutionTime: number;
  /** 置信度 */
  confidence: number;
  /** 预测的执行模式 */
  recommendedMode: WorkflowExecutionMode;
  /** 预测的成功率 */
  predictedSuccessRate: number;
  /** 预测依据 */
  reasoning: string[];
}

/**
 * 性能监控服务
 */
@Injectable()
export class PerformanceMonitorService implements OnModuleInit {
  private readonly logger: BusinessLogger;
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsCount = 10000; // 最大保存指标数量
  private predictionModel: any = null;

  constructor() {
    this.logger = new BusinessLogger(PerformanceMonitorService.name);
  }

  /**
   * 模块初始化
   */
  async onModuleInit(): Promise<void> {
    await this.initializePredictionModel();
    this.logger.serviceInfo('性能监控服务初始化完成');
  }

  /**
   * 初始化预测模型
   */
  private async initializePredictionModel(): Promise<void> {
    // 简化的预测模型，实际可以使用更复杂的机器学习算法
    this.predictionModel = {
      predict: (features: any) => this.simplePrediction(features),
      train: (data: PerformanceMetrics[]) => this.trainModel(data),
    };
  }

  /**
   * 记录性能指标
   */
  async recordMetrics(metrics: Omit<PerformanceMetrics, 'timestamp'>): Promise<void> {
    const completeMetrics: PerformanceMetrics = {
      ...metrics,
      timestamp: new Date(),
    };

    this.metrics.push(completeMetrics);

    // 保持指标数量在限制范围内
    if (this.metrics.length > this.maxMetricsCount) {
      this.metrics = this.metrics.slice(-this.maxMetricsCount);
    }

    // 异步训练预测模型
    if (this.metrics.length % 100 === 0) {
      this.trainPredictionModel().catch(error => {
        this.logger.warn(LogCategory.SERVICE_ERROR, '预测模型训练失败', undefined, { error: error.message });
      });
    }

    this.logger.debug(LogCategory.SERVICE_INFO, '性能指标已记录', undefined, {
      mode: metrics.mode,
      stockCode: metrics.stockCode,
      executionTime: metrics.executionTime,
      success: metrics.success,
    });
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(timeRange?: { start: Date; end: Date }): PerformanceStats {
    let filteredMetrics = this.metrics;

    // 应用时间范围过滤
    if (timeRange) {
      filteredMetrics = this.metrics.filter(metric => 
        metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
      );
    }

    if (filteredMetrics.length === 0) {
      return this.getEmptyStats();
    }

    // 计算总体统计
    const executionTimes = filteredMetrics
      .filter(m => m.success)
      .map(m => m.executionTime);

    const sortedTimes = [...executionTimes].sort((a, b) => a - b);
    
    const overallStats: PerformanceStats = {
      totalExecutions: filteredMetrics.length,
      successCount: filteredMetrics.filter(m => m.success).length,
      failureCount: filteredMetrics.filter(m => !m.success).length,
      averageExecutionTime: this.calculateAverage(executionTimes),
      medianExecutionTime: this.calculateMedian(sortedTimes),
      p95ExecutionTime: this.calculatePercentile(sortedTimes, 95),
      p99ExecutionTime: this.calculatePercentile(sortedTimes, 99),
      minExecutionTime: sortedTimes[0] || 0,
      maxExecutionTime: sortedTimes[sortedTimes.length - 1] || 0,
      standardDeviation: this.calculateStandardDeviation(executionTimes),
      byMode: this.groupByMode(filteredMetrics),
      byStock: this.groupByStock(filteredMetrics),
      timeSeries: this.generateTimeSeries(filteredMetrics),
    };

    return overallStats;
  }

  /**
   * 性能预测
   */
  async predictPerformance(params: {
    stockCode: string;
    complexity?: number;
    systemLoad?: { cpu: number; memory: number };
    priority?: 'high' | 'medium' | 'low';
  }): Promise<PerformancePrediction> {
    if (!this.predictionModel || this.metrics.length < 50) {
      // 数据不足时返回默认预测
      return {
        predictedExecutionTime: 5000,
        confidence: 0.5,
        recommendedMode: WorkflowExecutionMode.HYBRID,
        predictedSuccessRate: 0.85,
        reasoning: ['数据不足，使用默认预测'],
      };
    }

    const features = {
      stockCode: params.stockCode,
      complexity: params.complexity || this.estimateComplexity(params.stockCode),
      systemLoad: params.systemLoad || { cpu: 0.5, memory: 0.6 },
      priority: params.priority || 'medium',
      historicalPerformance: this.getHistoricalPerformance(params.stockCode),
    };

    return this.predictionModel.predict(features);
  }

  /**
   * 获取性能建议
   */
  getPerformanceRecommendations(): Array<{
    type: 'optimization' | 'configuration' | 'scaling';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    expectedImprovement: string;
    implementation: string;
  }> {
    const stats = this.getPerformanceStats();
    const recommendations: any[] = [];

    // 基于成功率的建议
    if (stats.successCount / stats.totalExecutions < 0.9) {
      recommendations.push({
        type: 'optimization' as const,
        priority: 'high' as const,
        title: '提升成功率',
        description: `当前成功率为 ${((stats.successCount / stats.totalExecutions) * 100).toFixed(1)}%，低于90%目标`,
        expectedImprovement: '提升至95%以上',
        implementation: '检查错误日志，优化错误处理机制，增加重试次数',
      });
    }

    // 基于执行时间的建议
    if (stats.averageExecutionTime > 8000) {
      recommendations.push({
        type: 'optimization' as const,
        priority: 'medium' as const,
        title: '优化执行时间',
        description: `平均执行时间 ${stats.averageExecutionTime.toFixed(0)}ms，超过8秒目标`,
        expectedImprovement: '减少至5秒以内',
        implementation: '使用LangGraphJS模式，优化数据收集流程，并行化处理',
      });
    }

    // 基于系统负载的建议
    const recentLoad = this.getRecentSystemLoad();
    if (recentLoad.cpu > 0.8 || recentLoad.memory > 0.8) {
      recommendations.push({
        type: 'scaling' as const,
        priority: 'high' as const,
        title: '系统负载优化',
        description: `当前系统负载较高 - CPU: ${(recentLoad.cpu * 100).toFixed(0)}%, 内存: ${(recentLoad.memory * 100).toFixed(0)}%`,
        expectedImprovement: '降低至70%以下',
        implementation: '增加服务器资源，优化资源使用，实现负载均衡',
      });
    }

    // 基于模式分布的建议
    const modeStats = stats.byMode;
    const bestMode = Object.entries(modeStats)
      .reduce((best, [mode, stats]) => 
        stats.successCount / stats.totalExecutions > best.rate 
          ? { mode, rate: stats.successCount / stats.totalExecutions } 
          : best, 
        { mode: '', rate: 0 }
      );

    if (bestMode.mode && bestMode.rate > 0.9) {
      recommendations.push({
        type: 'configuration' as const,
        priority: 'medium' as const,
        title: '优化执行模式配置',
        description: `${bestMode.mode} 模式成功率达到 ${(bestMode.rate * 100).toFixed(1)}%，建议优先使用`,
        expectedImprovement: '整体成功率提升5-10%',
        implementation: '调整WORKFLOW_BRIDGE_DEFAULT_MODE配置，增加该模式使用权重',
      });
    }

    return recommendations;
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): {
    summary: PerformanceStats;
    recommendations: ReturnType<typeof this.getPerformanceRecommendations>;
    insights: string[];
    trends: {
      executionTime: { direction: 'improving' | 'degrading'; change: number };
      successRate: { direction: 'improving' | 'degrading'; change: number };
      systemLoad: { direction: 'stable' | 'increasing' | 'decreasing'; change: number };
    };
  } {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const currentStats = this.getPerformanceStats({ start: last24Hours, end: now });
    const previousStats = this.getPerformanceStats({ start: lastWeek, end: last24Hours });

    const recommendations = this.getPerformanceRecommendations();
    const insights = this.generateInsights(currentStats, previousStats);
    const trends = this.calculateTrends(currentStats, previousStats);

    return {
      summary: currentStats,
      recommendations,
      insights,
      trends,
    };
  }

  /**
   * 训练预测模型
   */
  private async trainPredictionModel(): Promise<void> {
    if (this.predictionModel && this.metrics.length >= 100) {
      await this.predictionModel.train(this.metrics.slice(-1000));
      this.logger.serviceInfo('预测模型训练完成', {
        trainingDataSize: Math.min(this.metrics.length, 1000),
      });
    }
  }

  /**
   * 简单预测算法
   */
  private simplePrediction(features: any): PerformancePrediction {
    const { stockCode, complexity, systemLoad, priority, historicalPerformance } = features;

    // 基于历史数据预测
    const baseTime = historicalPerformance.averageTime || 5000;
    const baseSuccessRate = historicalPerformance.successRate || 0.85;

    // 根据特征调整预测
    let predictedTime = baseTime;
    let predictedSuccessRate = baseSuccessRate;

    // 复杂度影响
    if (complexity > 0.7) {
      predictedTime *= 1.5;
      predictedSuccessRate *= 0.9;
    } else if (complexity < 0.3) {
      predictedTime *= 0.7;
      predictedSuccessRate *= 1.1;
    }

    // 系统负载影响
    if (systemLoad.cpu > 0.8 || systemLoad.memory > 0.8) {
      predictedTime *= 1.3;
      predictedSuccessRate *= 0.95;
    }

    // 优先级影响
    if (priority === 'high') {
      predictedTime *= 0.8;
      predictedSuccessRate *= 0.98;
    }

    // 选择推荐模式
    let recommendedMode = WorkflowExecutionMode.HYBRID;
    const reasoning: string[] = [];

    if (predictedTime < 4000 && predictedSuccessRate > 0.9) {
      recommendedMode = WorkflowExecutionMode.LANGGRAPHJS;
      reasoning.push('预测执行时间短，适合LangGraphJS模式');
    } else if (predictedSuccessRate < 0.85) {
      recommendedMode = WorkflowExecutionMode.TEMPORAL;
      reasoning.push('预测成功率较低，使用更可靠的Temporal模式');
    } else {
      reasoning.push('使用混合模式平衡性能和可靠性');
    }

    return {
      predictedExecutionTime: Math.round(predictedTime),
      confidence: Math.min(historicalPerformance.dataPoints / 50, 0.9),
      recommendedMode,
      predictedSuccessRate: Math.min(predictedSuccessRate, 0.99),
      reasoning,
    };
  }

  /**
   * 训练模型
   */
  private trainModel(data: PerformanceMetrics[]): void {
    // 简化实现：记录训练数据
    this.logger.debug(LogCategory.SERVICE_INFO, '预测模型训练', undefined, {
      dataPoints: data.length,
      timeRange: {
        start: data[0]?.timestamp,
        end: data[data.length - 1]?.timestamp,
      },
    });
  }

  /**
   * 估算股票复杂度
   */
  private estimateComplexity(stockCode: string): number {
    // 基于股票代码和历史数据估算复杂度
    const historicalData = this.metrics.filter(m => m.stockCode === stockCode);
    
    if (historicalData.length === 0) {
      return 0.5; // 默认中等复杂度
    }

    const avgTime = historicalData
      .filter(m => m.success)
      .reduce((sum, m) => sum + m.executionTime, 0) / historicalData.length;

    // 根据执行时间映射到复杂度
    return Math.min(avgTime / 10000, 1.0);
  }

  /**
   * 获取历史性能数据
   */
  private getHistoricalPerformance(stockCode: string): {
    averageTime: number;
    successRate: number;
    dataPoints: number;
  } {
    const stockMetrics = this.metrics.filter(m => m.stockCode === stockCode);
    
    if (stockMetrics.length === 0) {
      return { averageTime: 5000, successRate: 0.85, dataPoints: 0 };
    }

    const successfulMetrics = stockMetrics.filter(m => m.success);
    const averageTime = successfulMetrics.length > 0
      ? successfulMetrics.reduce((sum, m) => sum + m.executionTime, 0) / successfulMetrics.length
      : 5000;
    
    const successRate = stockMetrics.filter(m => m.success).length / stockMetrics.length;

    return {
      averageTime,
      successRate,
      dataPoints: stockMetrics.length,
    };
  }

  /**
   * 获取最近的系统负载
   */
  private getRecentSystemLoad(): { cpu: number; memory: number } {
    const recentMetrics = this.metrics.slice(-100);
    
    if (recentMetrics.length === 0) {
      return { cpu: 0.5, memory: 0.6 };
    }

    const avgCpu = recentMetrics.reduce((sum, m) => sum + m.systemLoad.cpu, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.systemLoad.memory, 0) / recentMetrics.length;

    return { cpu: avgCpu, memory: avgMemory };
  }

  /**
   * 生成性能洞察
   */
  private generateInsights(current: PerformanceStats, previous: PerformanceStats): string[] {
    const insights: string[] = [];

    // 执行时间洞察
    if (current.averageExecutionTime < previous.averageExecutionTime * 0.9) {
      insights.push(`执行时间显著改善：从 ${previous.averageExecutionTime.toFixed(0)}ms 降至 ${current.averageExecutionTime.toFixed(0)}ms`);
    } else if (current.averageExecutionTime > previous.averageExecutionTime * 1.1) {
      insights.push(`执行时间恶化：从 ${previous.averageExecutionTime.toFixed(0)}ms 增至 ${current.averageExecutionTime.toFixed(0)}ms`);
    }

    // 成功率洞察
    const currentSuccessRate = current.successCount / current.totalExecutions;
    const previousSuccessRate = previous.successCount / previous.totalExecutions;
    
    if (currentSuccessRate > previousSuccessRate * 1.05) {
      insights.push(`成功率显著提升：从 ${(previousSuccessRate * 100).toFixed(1)}% 提升至 ${(currentSuccessRate * 100).toFixed(1)}%`);
    } else if (currentSuccessRate < previousSuccessRate * 0.95) {
      insights.push(`成功率下降：从 ${(previousSuccessRate * 100).toFixed(1)}% 降至 ${(currentSuccessRate * 100).toFixed(1)}%`);
    }

    // 模式使用洞察
    const modeChanges = Object.entries(current.byMode).map(([mode, stats]) => {
      const prevStats = previous.byMode[mode as WorkflowExecutionMode];
      const change = stats.totalExecutions - (prevStats?.totalExecutions || 0);
      return { mode, change };
    });

    const mostIncreased = modeChanges.reduce((max, curr) => 
      curr.change > max.change ? curr : max, { mode: '', change: 0 }
    );

    if (mostIncreased.change > 10) {
      insights.push(`${mostIncreased.mode} 模式使用量显著增加 (+${mostIncreased.change}次)`);
    }

    return insights;
  }

  /**
   * 计算趋势
   */
  private calculateTrends(current: PerformanceStats, previous: PerformanceStats): {
    executionTime: { direction: 'improving' | 'degrading'; change: number };
    successRate: { direction: 'improving' | 'degrading'; change: number };
    systemLoad: { direction: 'stable' | 'increasing' | 'decreasing'; change: number };
  } {
    const timeChange = (previous.averageExecutionTime - current.averageExecutionTime) / previous.averageExecutionTime;
    const currentSuccessRate = current.successCount / current.totalExecutions;
    const previousSuccessRate = previous.successCount / previous.totalExecutions;
    const successRateChange = (currentSuccessRate - previousSuccessRate) / previousSuccessRate;

    const recentMetrics = this.metrics.slice(-100);
    const olderMetrics = this.metrics.slice(-200, -100);
    
    let loadChange = 0;
    if (recentMetrics.length > 0 && olderMetrics.length > 0) {
      const recentAvgLoad = recentMetrics.reduce((sum, m) => 
        sum + (m.systemLoad.cpu + m.systemLoad.memory) / 2, 0
      ) / recentMetrics.length;
      
      const olderAvgLoad = olderMetrics.reduce((sum, m) => 
        sum + (m.systemLoad.cpu + m.systemLoad.memory) / 2, 0
      ) / olderMetrics.length;
      
      loadChange = (recentAvgLoad - olderAvgLoad) / olderAvgLoad;
    }

    return {
      executionTime: {
        direction: timeChange > 0.05 ? 'improving' : 'degrading',
        change: timeChange,
      },
      successRate: {
        direction: successRateChange > 0.02 ? 'improving' : 'degrading',
        change: successRateChange,
      },
      systemLoad: {
        direction: Math.abs(loadChange) < 0.05 ? 'stable' : 
                  loadChange > 0 ? 'increasing' : 'decreasing',
        change: loadChange,
      },
    };
  }

  // 辅助方法
  private getEmptyStats(): PerformanceStats {
    return {
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      averageExecutionTime: 0,
      medianExecutionTime: 0,
      p95ExecutionTime: 0,
      p99ExecutionTime: 0,
      minExecutionTime: 0,
      maxExecutionTime: 0,
      standardDeviation: 0,
      byMode: {} as any,
      byStock: {} as any,
      timeSeries: [],
    };
  }

  private calculateAverage(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0;
  }

  private calculateMedian(sortedNumbers: number[]): number {
    if (sortedNumbers.length === 0) return 0;
    const mid = Math.floor(sortedNumbers.length / 2);
    return sortedNumbers.length % 2 === 0 
      ? (sortedNumbers[mid - 1] + sortedNumbers[mid]) / 2 
      : sortedNumbers[mid];
  }

  private calculatePercentile(sortedNumbers: number[], percentile: number): number {
    if (sortedNumbers.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedNumbers.length) - 1;
    return sortedNumbers[Math.max(0, Math.min(index, sortedNumbers.length - 1))];
  }

  private calculateStandardDeviation(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const avg = this.calculateAverage(numbers);
    const squareDiffs = numbers.map(n => Math.pow(n - avg, 2));
    const avgSquareDiff = this.calculateAverage(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  private groupByMode(metrics: PerformanceMetrics[]): Record<WorkflowExecutionMode, PerformanceStats> {
    const grouped: Record<string, PerformanceMetrics[]> = {};
    
    metrics.forEach(metric => {
      if (!grouped[metric.mode]) {
        grouped[metric.mode] = [];
      }
      grouped[metric.mode].push(metric);
    });

    const result: Record<WorkflowExecutionMode, PerformanceStats> = {} as any;
    
    for (const [mode, modeMetrics] of Object.entries(grouped)) {
      const executionTimes = modeMetrics.filter(m => m.success).map(m => m.executionTime);
      result[mode as WorkflowExecutionMode] = {
        totalExecutions: modeMetrics.length,
        successCount: modeMetrics.filter(m => m.success).length,
        failureCount: modeMetrics.filter(m => !m.success).length,
        averageExecutionTime: this.calculateAverage(executionTimes),
        medianExecutionTime: this.calculateMedian([...executionTimes].sort((a, b) => a - b)),
        p95ExecutionTime: this.calculatePercentile([...executionTimes].sort((a, b) => a - b), 95),
        p99ExecutionTime: this.calculatePercentile([...executionTimes].sort((a, b) => a - b), 99),
        minExecutionTime: Math.min(...executionTimes, 0),
        maxExecutionTime: Math.max(...executionTimes, 0),
        standardDeviation: this.calculateStandardDeviation(executionTimes),
        byMode: {} as any,
        byStock: {} as any,
        timeSeries: [],
      };
    }

    return result;
  }

  private groupByStock(metrics: PerformanceMetrics[]): Record<string, PerformanceStats> {
    const grouped: Record<string, PerformanceMetrics[]> = {};
    
    metrics.forEach(metric => {
      if (!grouped[metric.stockCode]) {
        grouped[metric.stockCode] = [];
      }
      grouped[metric.stockCode].push(metric);
    });

    const result: Record<string, PerformanceStats> = {};
    
    for (const [stockCode, stockMetrics] of Object.entries(grouped)) {
      const executionTimes = stockMetrics.filter(m => m.success).map(m => m.executionTime);
      result[stockCode] = {
        totalExecutions: stockMetrics.length,
        successCount: stockMetrics.filter(m => m.success).length,
        failureCount: stockMetrics.filter(m => !m.success).length,
        averageExecutionTime: this.calculateAverage(executionTimes),
        medianExecutionTime: this.calculateMedian([...executionTimes].sort((a, b) => a - b)),
        p95ExecutionTime: this.calculatePercentile([...executionTimes].sort((a, b) => a - b), 95),
        p99ExecutionTime: this.calculatePercentile([...executionTimes].sort((a, b) => a - b), 99),
        minExecutionTime: Math.min(...executionTimes, 0),
        maxExecutionTime: Math.max(...executionTimes, 0),
        standardDeviation: this.calculateStandardDeviation(executionTimes),
        byMode: {} as any,
        byStock: {} as any,
        timeSeries: [],
      };
    }

    return result;
  }

  private generateTimeSeries(metrics: PerformanceMetrics[]): Array<{
    timestamp: Date;
    executionCount: number;
    averageTime: number;
    successRate: number;
  }> {
    const timeSeries: Record<string, {
      timestamp: Date;
      executionTimes: number[];
      successCount: number;
      totalCount: number;
    }> = {};

    // 按小时分组
    metrics.forEach(metric => {
      const hourKey = new Date(metric.timestamp).toISOString().slice(0, 13); // YYYY-MM-DDTHH
      
      if (!timeSeries[hourKey]) {
        timeSeries[hourKey] = {
          timestamp: new Date(metric.timestamp),
          executionTimes: [],
          successCount: 0,
          totalCount: 0,
        };
      }

      timeSeries[hourKey].executionTimes.push(metric.executionTime);
      timeSeries[hourKey].totalCount++;
      if (metric.success) {
        timeSeries[hourKey].successCount++;
      }
    });

    return Object.values(timeSeries).map(hour => ({
      timestamp: hour.timestamp,
      executionCount: hour.totalCount,
      averageTime: hour.executionTimes.length > 0 
        ? this.calculateAverage(hour.executionTimes) 
        : 0,
      successRate: hour.totalCount > 0 ? hour.successCount / hour.totalCount : 0,
    })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * 清理旧数据
   */
  cleanupOldData(keepDays: number = 30): { cleanedCount: number } {
    const cutoffDate = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);
    const originalLength = this.metrics.length;
    
    this.metrics = this.metrics.filter(metric => metric.timestamp >= cutoffDate);
    const cleanedCount = originalLength - this.metrics.length;
    
    this.logger.info(LogCategory.SERVICE_INFO, '清理旧性能数据', undefined, {
      removedCount: cleanedCount,
      remainingCount: this.metrics.length,
      cutoffDate,
    });
    
    return { cleanedCount };
  }

  /**
   * 导出性能数据
   */
  exportPerformanceData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.metrics, null, 2);
    }

    // CSV 格式
    const headers = [
      'timestamp', 'mode', 'stockCode', 'executionTime', 'success',
      'dataQuality', 'cpuLoad', 'memoryLoad', 'activeWorkflows', 'error'
    ];

    const rows = this.metrics.map(metric => [
      metric.timestamp.toISOString(),
      metric.mode,
      metric.stockCode,
      metric.executionTime,
      metric.success,
      metric.dataQuality || '',
      metric.systemLoad.cpu,
      metric.systemLoad.memory,
      metric.systemLoad.activeWorkflows,
      metric.error || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * 获取性能报告
   */
  async getPerformanceReport() {
    const totalExecutions = this.metrics.length;
    const successCount = this.metrics.filter(m => m.success).length;
    const averageExecutionTime = this.metrics.reduce((sum, m) => sum + m.executionTime, 0) / totalExecutions || 0;
    
    return {
      totalExecutions,
      successCount,
      successRate: totalExecutions > 0 ? successCount / totalExecutions : 0,
      averageExecutionTime,
      lastUpdated: new Date(),
      byMode: this.getStatsByMode(),
      byStockCode: this.getStatsByStockCode(),
    };
  }

  /**
   * 获取错误趋势
   */
  async getErrorTrends(startTime: Date, endTime: Date): Promise<any[]> {
    const filteredMetrics = this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );
    
    // 按小时分组错误率
    const hourlyErrors: Record<string, { total: number; errors: number }> = {};
    
    filteredMetrics.forEach(metric => {
      const hour = metric.timestamp.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      if (!hourlyErrors[hour]) {
        hourlyErrors[hour] = { total: 0, errors: 0 };
      }
      hourlyErrors[hour].total++;
      if (!metric.success) {
        hourlyErrors[hour].errors++;
      }
    });
    
    return Object.entries(hourlyErrors).map(([hour, data]) => ({
      hour,
      errorRate: data.errors / data.total,
      total: data.total,
      errors: data.errors,
    }));
  }

  /**
   * 获取工作负载趋势
   */
  async getWorkloadTrends(startTime: Date, endTime: Date): Promise<any[]> {
    const filteredMetrics = this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );
    
    // 按小时分组平均负载
    const hourlyLoad: Record<string, { totalCpu: number; totalMemory: number; count: number }> = {};
    
    filteredMetrics.forEach(metric => {
      const hour = metric.timestamp.toISOString().slice(0, 13);
      if (!hourlyLoad[hour]) {
        hourlyLoad[hour] = { totalCpu: 0, totalMemory: 0, count: 0 };
      }
      hourlyLoad[hour].totalCpu += metric.systemLoad.cpu;
      hourlyLoad[hour].totalMemory += metric.systemLoad.memory;
      hourlyLoad[hour].count++;
    });
    
    return Object.entries(hourlyLoad).map(([hour, data]) => ({
      hour,
      avgCpu: data.totalCpu / data.count,
      avgMemory: data.totalMemory / data.count,
      activeWorkflows: data.count,
    }));
  }

  /**
   * 导出指标
   */
  async exportMetrics(format: 'json' | 'csv', filters?: any): Promise<any> {
    let filteredMetrics = this.metrics;
    
    if (filters) {
      if (filters.startTime) {
        filteredMetrics = filteredMetrics.filter(m => m.timestamp >= filters.startTime);
      }
      if (filters.endTime) {
        filteredMetrics = filteredMetrics.filter(m => m.timestamp <= filters.endTime);
      }
      if (filters.stockCode) {
        filteredMetrics = filteredMetrics.filter(m => m.stockCode === filters.stockCode);
      }
    }
    
    if (format === 'json') {
      return filteredMetrics;
    } else if (format === 'csv') {
      // 简化的CSV导出
      const headers = ['timestamp', 'mode', 'stockCode', 'executionTime', 'success', 'cpuUsage', 'memoryUsage'];
      const rows = filteredMetrics.map(m => [
        m.timestamp.toISOString(),
        m.mode,
        m.stockCode,
        m.executionTime,
        m.success,
        m.systemLoad.cpu,
        m.systemLoad.memory,
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    throw new Error(`Unsupported format: ${format}`);
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealthStatus(): Promise<SystemHealthStatus> {
    const recentMetrics = this.metrics.slice(-10);
    const avgCpu = recentMetrics.reduce((sum, m) => sum + m.systemLoad.cpu, 0) / recentMetrics.length || 0;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.systemLoad.memory, 0) / recentMetrics.length || 0;
    const recentErrors = recentMetrics.filter(m => !m.success).length;

    const status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 
      avgCpu > 90 || avgMemory > 95 || recentErrors > 5 ? 'UNHEALTHY' :
      avgCpu > 80 || avgMemory > 85 || recentErrors > 2 ? 'DEGRADED' : 'HEALTHY';

    return {
      status,
      cpuUsage: avgCpu,
      memoryUsage: avgMemory,
      activeWorkflows: recentMetrics[recentMetrics.length - 1]?.systemLoad.activeWorkflows || 0,
      diskUsage: 0, // 简化实现
      networkUsage: 0, // 简化实现
      lastCheck: new Date(),
    };
  }

  /**
   * 获取最近的性能指标
   */
  async getRecentMetrics(count: number = 10): Promise<PerformanceMetrics[]> {
    return this.metrics.slice(-count);
  }

  /**
   * 获取性能预测
   */
  async getPredictions() {
    // 简化的预测实现
    const recentMetrics = this.metrics.slice(-20);
    if (recentMetrics.length < 5) {
      return null;
    }

    const avgExecutionTime = recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length;
    const trend = this.calculateSimpleTrend(recentMetrics.map(m => m.executionTime));
    const successRate = recentMetrics.filter(m => m.success).length / recentMetrics.length;

    return {
      expectedExecutionTime: avgExecutionTime,
      expectedSuccessRate: successRate,
      confidence: Math.min(0.9, recentMetrics.length / 50),
      trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
      recommendations: this.generateRecommendations(recentMetrics),
    };
  }

  /**
   * 获取活跃工作流
   */
  async getActiveWorkflows() {
    // 简化实现，返回模拟数据
    return [
      {
        id: 'stock-analysis-demo',
        type: 'stock-analysis',
        stockCode: '000001',
        startTime: new Date(Date.now() - 300000),
        status: 'running',
        progress: 75,
      }
    ];
  }

  /**
   * 获取性能趋势
   */
  async getPerformanceTrends(startDate: Date, endDate: Date) {
    const filteredMetrics = this.metrics.filter(m => 
      m.timestamp >= startDate && m.timestamp <= endDate
    );

    if (filteredMetrics.length === 0) {
      return null;
    }

    return {
      totalRequests: filteredMetrics.length,
      successRate: filteredMetrics.filter(m => m.success).length / filteredMetrics.length,
      averageResponseTime: filteredMetrics.reduce((sum, m) => sum + m.executionTime, 0) / filteredMetrics.length,
      errorRate: filteredMetrics.filter(m => !m.success).length / filteredMetrics.length,
      trends: {
        executionTime: this.calculateSimpleTrend(filteredMetrics.map(m => m.executionTime)),
        successRate: this.calculateSimpleTrend(
          filteredMetrics.map((m, i, arr) => 
            arr.slice(0, i + 1).filter(x => x.success).length / (i + 1)
          )
        ),
      },
    };
  }

  /**
   * 获取指定股票的性能统计
   */
  async getPerformanceStatsByStock(stockCode: string) {
    const stockMetrics = this.metrics.filter(m => m.stockCode === stockCode);
    
    if (stockMetrics.length === 0) {
      return null;
    }

    const executionTimes = stockMetrics.map(m => m.executionTime);
    const successCount = stockMetrics.filter(m => m.success).length;

    return {
      stockCode,
      totalExecutions: stockMetrics.length,
      successCount,
      successRate: successCount / stockMetrics.length,
      averageExecutionTime: executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length,
      minExecutionTime: Math.min(...executionTimes),
      maxExecutionTime: Math.max(...executionTimes),
      lastExecution: stockMetrics[stockMetrics.length - 1].timestamp,
    };
  }

  /**
   * 获取指定股票的指标数据
   */
  async getMetricsByStock(stockCode: string, days: number = 7) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.metrics.filter(m => 
      m.stockCode === stockCode && m.timestamp >= cutoffDate
    );
  }

  /**
   * 计算简单趋势
   */
  private calculateSimpleTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    return (secondAvg - firstAvg) / firstAvg;
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(metrics: PerformanceMetrics[]): string[] {
    const recommendations: string[] = [];
    
    const avgCpu = metrics.reduce((sum, m) => sum + m.systemLoad.cpu, 0) / metrics.length;
    const avgMemory = metrics.reduce((sum, m) => sum + m.systemLoad.memory, 0) / metrics.length;
    const avgExecutionTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length;
    const successRate = metrics.filter(m => m.success).length / metrics.length;

    if (avgCpu > 80) {
      recommendations.push('CPU使用率过高，建议优化算法复杂度或增加服务器资源');
    }
    
    if (avgMemory > 85) {
      recommendations.push('内存使用率过高，建议优化内存使用或增加内存容量');
    }
    
    if (avgExecutionTime > 10000) {
      recommendations.push('平均响应时间过长，建议检查数据获取逻辑和算法优化');
    }
    
    if (successRate < 0.95) {
      recommendations.push('成功率偏低，建议加强错误处理和重试机制');
    }

    return recommendations;
  }

  /**
   * 按执行模式获取统计
   */
  private getStatsByMode() {
    const stats: Record<string, any> = {};
    
    const modes = [...new Set(this.metrics.map(m => m.mode))];
    for (const mode of modes) {
      const modeMetrics = this.metrics.filter(m => m.mode === mode);
      const successCount = modeMetrics.filter(m => m.success).length;
      
      stats[mode] = {
        totalExecutions: modeMetrics.length,
        successCount,
        successRate: modeMetrics.length > 0 ? successCount / modeMetrics.length : 0,
        averageExecutionTime: modeMetrics.length > 0 
          ? modeMetrics.reduce((sum, m) => sum + m.executionTime, 0) / modeMetrics.length 
          : 0,
      };
    }
    
    return stats;
  }

  /**
   * 按股票代码获取统计
   */
  private getStatsByStockCode() {
    const stats: Record<string, any> = {};
    
    const stockCodes = [...new Set(this.metrics.map(m => m.stockCode))];
    for (const stockCode of stockCodes) {
      const stockMetrics = this.metrics.filter(m => m.stockCode === stockCode);
      const successCount = stockMetrics.filter(m => m.success).length;
      
      stats[stockCode] = {
        totalExecutions: stockMetrics.length,
        successCount,
        successRate: stockMetrics.length > 0 ? successCount / stockMetrics.length : 0,
        averageExecutionTime: stockMetrics.length > 0 
          ? stockMetrics.reduce((sum, m) => sum + m.executionTime, 0) / stockMetrics.length 
          : 0,
      };
    }
    
    return stats;
  }
}