/**
 * 工作流切换器
 * 基于配置和运行时状态动态选择最优的工作流执行方式
 */

import { Injectable } from '@nestjs/common';
import { BusinessLogger, LogCategory } from '../../../common/utils/business-logger.util';
import { WorkflowExecutionMode } from './workflow-bridge';
import { AnalysisState } from '../state-manager';

/**
 * 工作流选择策略
 */
export interface WorkflowSelectionStrategy {
  /** 基于数据复杂度的选择 */
  dataComplexity?: {
    simple: WorkflowExecutionMode;
    complex: WorkflowExecutionMode;
    threshold: number; // 复杂度阈值
  };
  /** 基于实时性要求的选择 */
  realtimeRequirement?: {
    high: WorkflowExecutionMode;  // 高实时性要求
    low: WorkflowExecutionMode;   // 低实时性要求
  };
  /** 基于系统负载的选择 */
  systemLoad?: {
    high: WorkflowExecutionMode;   // 高负载时使用
    low: WorkflowExecutionMode;    // 低负载时使用
  };
  /** 基于错误率的选择 */
  errorRate?: {
    high: WorkflowExecutionMode;    // 高错误率时切换
    low: WorkflowExecutionMode;     // 低错误率时使用
    threshold: number;              // 错误率阈值
  };
}

/**
 * 系统状态指标
 */
export interface SystemMetrics {
  /** LangGraphJS 健康状态 */
  langgraphjsHealth: {
    available: boolean;
    responseTime: number;
    errorRate: number;
    agentCount: number;
  };
  /** Temporal 健康状态 */
  temporalHealth: {
    available: boolean;
    responseTime: number;
    errorRate: number;
    workerCount: number;
  };
  /** 系统负载 */
  systemLoad: {
    cpu: number;
    memory: number;
    activeWorkflows: number;
  };
}

/**
 * 工作流决策结果
 */
export interface WorkflowDecision {
  /** 选择的执行模式 */
  mode: WorkflowExecutionMode;
  /** 决策原因 */
  reason: string;
  /** 置信度 */
  confidence: number;
  /** 备选方案 */
  alternatives: WorkflowExecutionMode[];
  /** 决策时间戳 */
  timestamp: Date;
}

/**
 * 工作流切换器
 * 基于多种策略动态选择最优的工作流执行方式
 */
@Injectable()
export class WorkflowSwitcherService {
  private readonly logger: BusinessLogger;
  private strategy: WorkflowSelectionStrategy;
  private decisionHistory: WorkflowDecision[] = [];
  private systemMetrics: SystemMetrics | null = null;

  constructor() {
    this.logger = new BusinessLogger(WorkflowSwitcherService.name);
    this.initializeDefaultStrategy();
  }

  /**
   * 初始化默认策略
   */
  private initializeDefaultStrategy(): void {
    this.strategy = {
      dataComplexity: {
        simple: WorkflowExecutionMode.LANGGRAPHJS,
        complex: WorkflowExecutionMode.TEMPORAL,
        threshold: 0.7,
      },
      realtimeRequirement: {
        high: WorkflowExecutionMode.LANGGRAPHJS,
        low: WorkflowExecutionMode.TEMPORAL,
      },
      systemLoad: {
        high: WorkflowExecutionMode.TEMPORAL,
        low: WorkflowExecutionMode.LANGGRAPHJS,
      },
      errorRate: {
        high: WorkflowExecutionMode.TEMPORAL,
        low: WorkflowExecutionMode.LANGGRAPHJS,
        threshold: 0.1,
      },
    };

    this.logger.serviceInfo('工作流切换器策略已初始化', { strategy: this.strategy });
  }

  /**
   * 更新系统指标
   */
  async updateSystemMetrics(metrics: SystemMetrics): Promise<void> {
    this.systemMetrics = metrics;
    this.logger.debug(LogCategory.SERVICE_INFO, '系统指标已更新', undefined, { metrics });
  }

  /**
   * 根据分析参数选择最优工作流
   */
  async selectOptimalWorkflow(params: {
    stockCode: string;
    sessionId: string;
    analysisComplexity?: number;
    realtimeRequired?: boolean;
    priority?: 'high' | 'medium' | 'low';
  }): Promise<WorkflowDecision> {
    const startTime = Date.now();
    
    this.logger.serviceInfo('开始选择最优工作流', {
      stockCode: params.stockCode,
      sessionId: params.sessionId,
      analysisComplexity: params.analysisComplexity,
      realtimeRequired: params.realtimeRequired,
      priority: params.priority,
    });

    try {
      // 评估各种选择因素
      const factors = await this.evaluateSelectionFactors(params);
      
      // 应用选择策略
      const decision = this.applySelectionStrategy(factors, params);
      
      // 记录决策历史
      this.recordDecision(decision);
      
      this.logger.serviceInfo('工作流选择完成', {
        selectedMode: decision.mode,
        reason: decision.reason,
        confidence: decision.confidence,
        evaluationTime: Date.now() - startTime,
      });

      return decision;

    } catch (error) {
      this.logger.serviceError('工作流选择失败', error as Error, {
        stockCode: params.stockCode,
        sessionId: params.sessionId,
      });

      // 返回默认决策
      const fallbackDecision: WorkflowDecision = {
        mode: WorkflowExecutionMode.HYBRID,
        reason: '选择策略失败，使用混合模式',
        confidence: 0.5,
        alternatives: [WorkflowExecutionMode.LANGGRAPHJS, WorkflowExecutionMode.TEMPORAL],
        timestamp: new Date(),
      };

      this.recordDecision(fallbackDecision);
      return fallbackDecision;
    }
  }

  /**
   * 评估选择因素
   */
  private async evaluateSelectionFactors(params: any): Promise<{
    dataComplexity: number;
    systemLoad: number;
    errorRates: {
      langgraphjs: number;
      temporal: number;
    };
    availability: {
      langgraphjs: boolean;
      temporal: boolean;
    };
    performance: {
      langgraphjsResponseTime: number;
      temporalResponseTime: number;
    };
  }> {
    // 计算数据复杂度
    const dataComplexity = await this.calculateDataComplexity(params.stockCode);
    
    // 获取系统负载
    const systemLoad = this.systemMetrics?.systemLoad?.cpu || 0;
    
    // 获取错误率
    const errorRates = {
      langgraphjs: this.systemMetrics?.langgraphjsHealth?.errorRate || 0,
      temporal: this.systemMetrics?.temporalHealth?.errorRate || 0,
    };
    
    // 获取可用性
    const availability = {
      langgraphjs: this.systemMetrics?.langgraphjsHealth?.available || false,
      temporal: this.systemMetrics?.temporalHealth?.available || false,
    };
    
    // 获取性能指标
    const performance = {
      langgraphjsResponseTime: this.systemMetrics?.langgraphjsHealth?.responseTime || 0,
      temporalResponseTime: this.systemMetrics?.temporalHealth?.responseTime || 0,
    };

    return {
      dataComplexity,
      systemLoad,
      errorRates,
      availability,
      performance,
    };
  }

  /**
   * 计算数据复杂度
   */
  private async calculateDataComplexity(stockCode: string): Promise<number> {
    // 这里可以根据股票代码的历史分析数据、数据量等计算复杂度
    // 简化实现：基于股票代码长度和行业等因素估算
    let complexity = 0.5; // 默认中等复杂度
    
    // 股票代码长度影响
    if (stockCode.length > 6) complexity += 0.1;
    
    // 行业复杂度（这里可以集成更复杂的逻辑）
    const complexIndustries = ['半导体', '人工智能', '生物医药', '新能源'];
    if (complexIndustries.some(industry => stockCode.includes(industry.slice(0, 2)))) {
      complexity += 0.2;
    }
    
    return Math.min(complexity, 1.0);
  }

  /**
   * 应用选择策略
   */
  private applySelectionStrategy(factors: any, params: any): WorkflowDecision {
    const decisions: Array<{
      mode: WorkflowExecutionMode;
      reason: string;
      confidence: number;
    }> = [];

    // 1. 基于可用性筛选
    const availableModes = [];
    if (factors.availability.langgraphjs) {
      availableModes.push(WorkflowExecutionMode.LANGGRAPHJS);
    }
    if (factors.availability.temporal) {
      availableModes.push(WorkflowExecutionMode.TEMPORAL);
    }

    if (availableModes.length === 0) {
      return {
        mode: WorkflowExecutionMode.FALLBACK,
        reason: '无可用的工作流系统',
        confidence: 1.0,
        alternatives: [],
        timestamp: new Date(),
      };
    }

    if (availableModes.length === 1) {
      return {
        mode: availableModes[0],
        reason: '仅有一个可用系统',
        confidence: 1.0,
        alternatives: [],
        timestamp: new Date(),
      };
    }

    // 2. 基于数据复杂度
    if (this.strategy.dataComplexity) {
      const { simple, complex, threshold } = this.strategy.dataComplexity;
      if (factors.dataComplexity < threshold) {
        decisions.push({
          mode: simple,
          reason: `数据复杂度较低 (${factors.dataComplexity.toFixed(2)})`,
          confidence: 0.8,
        });
      } else {
        decisions.push({
          mode: complex,
          reason: `数据复杂度较高 (${factors.dataComplexity.toFixed(2)})`,
          confidence: 0.8,
        });
      }
    }

    // 3. 基于实时性要求
    if (params.realtimeRequired && this.strategy.realtimeRequirement) {
      const { high, low } = this.strategy.realtimeRequirement;
      const preferredMode = params.realtimeRequired ? high : low;
      decisions.push({
        mode: preferredMode,
        reason: `实时性要求: ${params.realtimeRequired ? '高' : '低'}`,
        confidence: 0.7,
      });
    }

    // 4. 基于系统负载
    if (this.strategy.systemLoad && factors.systemLoad > 0.8) {
      const { high, low } = this.strategy.systemLoad;
      decisions.push({
        mode: high,
        reason: `系统负载较高 (${factors.systemLoad.toFixed(2)})`,
        confidence: 0.6,
      });
    }

    // 5. 基于错误率
    if (this.strategy.errorRate) {
      const { high, low, threshold } = this.strategy.errorRate;
      if (factors.errorRates.langgraphjs > threshold) {
        decisions.push({
          mode: high,
          reason: `LangGraphJS 错误率较高 (${(factors.errorRates.langgraphjs * 100).toFixed(1)}%)`,
          confidence: 0.7,
        });
      }
      if (factors.errorRates.temporal > threshold) {
        decisions.push({
          mode: low,
          reason: `Temporal 错误率较高 (${(factors.errorRates.temporal * 100).toFixed(1)}%)`,
          confidence: 0.7,
        });
      }
    }

    // 6. 基于性能
    if (factors.performance.langgraphjsResponseTime > 0 && factors.performance.temporalResponseTime > 0) {
      const fasterMode = factors.performance.langgraphjsResponseTime < factors.performance.temporalResponseTime
        ? WorkflowExecutionMode.LANGGRAPHJS
        : WorkflowExecutionMode.TEMPORAL;
      
      decisions.push({
        mode: fasterMode,
        reason: `响应时间更优 (${fasterMode === WorkflowExecutionMode.LANGGRAPHJS ? 
          `${factors.performance.langgraphjsResponseTime}ms` : 
          `${factors.performance.temporalResponseTime}ms`})`,
        confidence: 0.5,
      });
    }

    // 7. 基于优先级
    if (params.priority === 'high') {
      decisions.push({
        mode: WorkflowExecutionMode.LANGGRAPHJS,
        reason: '高优先级任务，选择 LangGraphJS',
        confidence: 0.9,
      });
    }

    // 综合决策：选择置信度最高的决策
    if (decisions.length === 0) {
      return {
        mode: WorkflowExecutionMode.HYBRID,
        reason: '无明确倾向，使用混合模式',
        confidence: 0.5,
        alternatives: availableModes,
        timestamp: new Date(),
      };
    }

    // 找到置信度最高的决策
    const bestDecision = decisions.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    return {
      mode: bestDecision.mode,
      reason: bestDecision.reason,
      confidence: bestDecision.confidence,
      alternatives: availableModes.filter(mode => mode !== bestDecision.mode),
      timestamp: new Date(),
    };
  }

  /**
   * 记录决策历史
   */
  private recordDecision(decision: WorkflowDecision): void {
    this.decisionHistory.push(decision);
    
    // 保持最近1000条记录
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory = this.decisionHistory.slice(-1000);
    }
  }

  /**
   * 获取决策统计
   */
  getDecisionStats(): {
    totalDecisions: number;
    modeDistribution: Record<WorkflowExecutionMode, number>;
    averageConfidence: number;
    recentDecisions: WorkflowDecision[];
  } {
    const totalDecisions = this.decisionHistory.length;
    
    const modeDistribution: Record<WorkflowExecutionMode, number> = {} as any;
    for (const mode of Object.values(WorkflowExecutionMode)) {
      modeDistribution[mode] = this.decisionHistory.filter(d => d.mode === mode).length;
    }
    
    const averageConfidence = totalDecisions > 0
      ? this.decisionHistory.reduce((sum, d) => sum + d.confidence, 0) / totalDecisions
      : 0;
    
    const recentDecisions = this.decisionHistory.slice(-10);

    return {
      totalDecisions,
      modeDistribution,
      averageConfidence,
      recentDecisions,
    };
  }

  /**
   * 更新选择策略
   */
  updateStrategy(strategy: Partial<WorkflowSelectionStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
    this.logger.serviceInfo('工作流选择策略已更新', { strategy: this.strategy });
  }

  /**
   * 重置决策历史
   */
  resetDecisionHistory(): void {
    this.decisionHistory = [];
    this.logger.serviceInfo('决策历史已重置');
  }

  /**
   * 获取推荐的工作流模式
   */
  getRecommendedMode(): WorkflowExecutionMode {
    const stats = this.getDecisionStats();
    
    if (stats.totalDecisions === 0) {
      return WorkflowExecutionMode.HYBRID;
    }

    // 找到使用最多的模式
    const mostUsedMode = Object.entries(stats.modeDistribution)
      .reduce((best, [mode, count]) => count > best.count ? { mode, count } : best, { mode: '', count: 0 });

    return mostUsedMode.mode as WorkflowExecutionMode || WorkflowExecutionMode.HYBRID;
  }

  /**
   * 预测最佳模式
   */
  async predictOptimalMode(params: {
    stockCode: string;
    sessionId: string;
    analysisComplexity?: number;
    realtimeRequired?: boolean;
    priority?: 'high' | 'medium' | 'low';
  }): Promise<{
    predictedMode: WorkflowExecutionMode;
    confidence: number;
    reasoning: string[];
  }> {
    const decision = await this.selectOptimalWorkflow(params);
    
    // 基于历史数据进行调整
    const historicalStats = this.getDecisionStats();
    const reasoning: string[] = [decision.reason];
    
    // 如果历史数据显示某个模式成功率更高
    const successRates = this.calculateSuccessRates();
    if (successRates[decision.mode] < 0.8 && successRates[decision.mode] < 0.9) {
      const betterMode = Object.entries(successRates)
        .reduce((best, [mode, rate]) => rate > best.rate ? { mode, rate } : best, { mode: '', rate: 0 });
      
      if (betterMode.rate > successRates[decision.mode]) {
        reasoning.push(`历史数据显示 ${betterMode.mode} 成功率更高 (${(betterMode.rate * 100).toFixed(1)}%)`);
      }
    }

    return {
      predictedMode: decision.mode,
      confidence: decision.confidence,
      reasoning,
    };
  }

  /**
   * 计算各模式的历史成功率
   */
  private calculateSuccessRates(): Record<WorkflowExecutionMode, number> {
    const successRates: Record<WorkflowExecutionMode, { success: number; total: number }> = {} as any;
    
    // 初始化
    for (const mode of Object.values(WorkflowExecutionMode)) {
      successRates[mode] = { success: 0, total: 0 };
    }
    
    // 这里需要与实际的执行结果关联，简化实现
    // 实际应该从执行记录中统计成功率
    return Object.keys(successRates).reduce((rates, mode) => {
      rates[mode as WorkflowExecutionMode] = 0.8; // 默认80%成功率
      return rates;
    }, {} as Record<WorkflowExecutionMode, number>);
  }
}