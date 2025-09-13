/**
 * 实时监控仪表板服务
 * 提供系统性能监控、健康检查、告警管理和可视化仪表板功能
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessLogger, LogCategory } from '../../../common/utils/business-logger.util';
import { PerformanceMonitorService, PerformanceMetrics, SystemHealthStatus } from './performance-monitor';
import { HybridWorkflowService } from '../integration/hybrid-workflow.service';
import { interval, Subject, Observable } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';

/**
 * 仪表板配置
 */
export interface DashboardConfig {
  /** 刷新间隔（毫秒） */
  refreshInterval: number;
  /** 保留的历史数据点数 */
  historyDataPoints: number;
  /** 告警阈值 */
  alertThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    errorRate: number;
    responseTime: number;
  };
  /** 是否启用WebSocket推送 */
  enableWebSocket: boolean;
  /** 是否启用预测分析 */
  enablePredictions: boolean;
}

/**
 * 仪表板数据
 */
export interface DashboardData {
  /** 系统健康状态 */
  systemHealth: SystemHealthStatus;
  /** 性能指标 */
  performance: {
    current: PerformanceMetrics[];
    trends: any;
    predictions: any;
  };
  /** 工作流状态 */
  workflows: {
    active: any[];
    completed: any[];
    failed: any[];
    stats: any;
  };
  /** 告警信息 */
  alerts: {
    active: any[];
    history: any[];
    severity: {
      high: number;
      medium: number;
      low: number;
    };
  };
  /** 系统资源 */
  resources: {
    cpu: number[];
    memory: number[];
    disk: number[];
    network: number[];
  };
  /** 时间戳 */
  timestamp: Date;
}

/**
 * 实时监控仪表板服务
 * 提供系统监控、健康检查和可视化仪表板功能
 */
@Injectable()
export class MonitoringDashboardService implements OnModuleInit {
  private readonly logger: BusinessLogger;
  private config: DashboardConfig;
  private dataSubject = new Subject<DashboardData>();
  private destroy$ = new Subject<void>();
  private historyData: DashboardData[] = [];
  private activeAlerts: Map<string, any> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly performanceMonitor: PerformanceMonitorService,
    private readonly hybridWorkflow: HybridWorkflowService,
  ) {
    this.logger = new BusinessLogger(MonitoringDashboardService.name);
  }

  /**
   * 模块初始化
   */
  async onModuleInit(): Promise<void> {
    await this.initializeConfig();
    await this.startMonitoring();
    
    this.logger.serviceInfo('实时监控仪表板服务初始化完成', {
      config: this.config,
    });
  }

  /**
   * 初始化配置
   */
  private async initializeConfig(): Promise<void> {
    this.config = {
      refreshInterval: this.configService.get<number>(
        'DASHBOARD_REFRESH_INTERVAL',
        5000
      ),
      historyDataPoints: this.configService.get<number>(
        'DASHBOARD_HISTORY_DATA_POINTS',
        100
      ),
      alertThresholds: {
        cpuUsage: this.configService.get<number>(
          'DASHBOARD_CPU_THRESHOLD',
          80
        ),
        memoryUsage: this.configService.get<number>(
          'DASHBOARD_MEMORY_THRESHOLD',
          85
        ),
        errorRate: this.configService.get<number>(
          'DASHBOARD_ERROR_RATE_THRESHOLD',
          0.1
        ),
        responseTime: this.configService.get<number>(
          'DASHBOARD_RESPONSE_TIME_THRESHOLD',
          10000
        ),
      },
      enableWebSocket: this.configService.get<boolean>(
        'DASHBOARD_ENABLE_WEBSOCKET',
        true
      ),
      enablePredictions: this.configService.get<boolean>(
        'DASHBOARD_ENABLE_PREDICTIONS',
        true
      ),
    };
  }

  /**
   * 启动监控
   */
  private async startMonitoring(): Promise<void> {
    // 定时收集数据
    interval(this.config.refreshInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(async () => {
        try {
          const dashboardData = await this.collectDashboardData();
          this.dataSubject.next(dashboardData);
          this.updateHistoryData(dashboardData);
          await this.checkAlerts(dashboardData);
        } catch (error) {
          this.logger.warn(LogCategory.SERVICE_ERROR, '收集仪表板数据失败', undefined, {
            error: (error as Error).message,
          });
        }
      });
  }

  /**
   * 收集仪表板数据
   */
  private async collectDashboardData(): Promise<DashboardData> {
    const [
      systemHealth,
      recentMetrics,
      predictions,
      activeWorkflows,
      hybridStats,
    ] = await Promise.all([
      this.performanceMonitor.getSystemHealthStatus(),
      this.performanceMonitor.getRecentMetrics(10),
      this.config.enablePredictions ? this.performanceMonitor.getPredictions() : null,
      this.performanceMonitor.getActiveWorkflows(),
      this.hybridWorkflow?.getPerformanceReport() || null,
    ]);

    const performanceTrends = await this.performanceMonitor.getPerformanceTrends(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
      new Date()
    );

    return {
      systemHealth,
      performance: {
        current: recentMetrics,
        trends: performanceTrends,
        predictions,
      },
      workflows: {
        active: activeWorkflows,
        completed: [], // 需要从数据库查询
        failed: [], // 需要从数据库查询
        stats: hybridStats,
      },
      alerts: {
        active: Array.from(this.activeAlerts.values()),
        history: [], // 需要从数据库查询
        severity: this.calculateAlertSeverity(),
      },
      resources: {
        cpu: [systemHealth.cpuUsage],
        memory: [systemHealth.memoryUsage],
        disk: [systemHealth.diskUsage || 0],
        network: [systemHealth.networkUsage || 0],
      },
      timestamp: new Date(),
    };
  }

  /**
   * 更新历史数据
   */
  private updateHistoryData(data: DashboardData): void {
    this.historyData.push(data);
    
    // 保持历史数据数量限制
    if (this.historyData.length > this.config.historyDataPoints) {
      this.historyData = this.historyData.slice(-this.config.historyDataPoints);
    }
  }

  /**
   * 检查告警
   */
  private async checkAlerts(data: DashboardData): Promise<void> {
    const newAlerts: any[] = [];
    const now = Date.now();

    // CPU使用率告警
    if (data.systemHealth.cpuUsage > this.config.alertThresholds.cpuUsage) {
      const alertKey = `cpu_high_${now}`;
      if (!this.activeAlerts.has(alertKey)) {
        newAlerts.push({
          id: alertKey,
          type: 'SYSTEM',
          severity: 'HIGH',
          message: `CPU使用率过高: ${data.systemHealth.cpuUsage.toFixed(1)}%`,
          metric: 'cpu_usage',
          value: data.systemHealth.cpuUsage,
          threshold: this.config.alertThresholds.cpuUsage,
          timestamp: new Date(),
        });
      }
    }

    // 内存使用率告警
    if (data.systemHealth.memoryUsage > this.config.alertThresholds.memoryUsage) {
      const alertKey = `memory_high_${now}`;
      if (!this.activeAlerts.has(alertKey)) {
        newAlerts.push({
          id: alertKey,
          type: 'SYSTEM',
          severity: 'HIGH',
          message: `内存使用率过高: ${data.systemHealth.memoryUsage.toFixed(1)}%`,
          metric: 'memory_usage',
          value: data.systemHealth.memoryUsage,
          threshold: this.config.alertThresholds.memoryUsage,
          timestamp: new Date(),
        });
      }
    }

    // 错误率告警
    if (data.performance.trends && data.performance.trends.errorRate > this.config.alertThresholds.errorRate) {
      const alertKey = `error_rate_high_${now}`;
      if (!this.activeAlerts.has(alertKey)) {
        newAlerts.push({
          id: alertKey,
          type: 'PERFORMANCE',
          severity: 'MEDIUM',
          message: `错误率过高: ${(data.performance.trends.errorRate * 100).toFixed(1)}%`,
          metric: 'error_rate',
          value: data.performance.trends.errorRate,
          threshold: this.config.alertThresholds.errorRate,
          timestamp: new Date(),
        });
      }
    }

    // 响应时间告警
    const avgResponseTime = data.performance.current.reduce(
      (sum, metric) => sum + metric.executionTime, 0
    ) / data.performance.current.length || 0;

    if (avgResponseTime > this.config.alertThresholds.responseTime) {
      const alertKey = `response_time_high_${now}`;
      if (!this.activeAlerts.has(alertKey)) {
        newAlerts.push({
          id: alertKey,
          type: 'PERFORMANCE',
          severity: 'MEDIUM',
          message: `平均响应时间过长: ${avgResponseTime.toFixed(0)}ms`,
          metric: 'response_time',
          value: avgResponseTime,
          threshold: this.config.alertThresholds.responseTime,
          timestamp: new Date(),
        });
      }
    }

    // 添加新告警
    for (const alert of newAlerts) {
      this.activeAlerts.set(alert.id, alert);
      this.logger.warn(LogCategory.SERVICE_ERROR, '产生新告警', undefined, alert);
    }

    // 清理已解决的告警
    this.cleanupResolvedAlerts(data);
  }

  /**
   * 清理已解决的告警
   */
  private cleanupResolvedAlerts(data: DashboardData): void {
    const resolvedAlerts: string[] = [];

    for (const [alertId, alert] of this.activeAlerts.entries()) {
      let shouldResolve = false;

      switch (alert.metric) {
        case 'cpu_usage':
          shouldResolve = data.systemHealth.cpuUsage <= this.config.alertThresholds.cpuUsage * 0.9;
          break;
        case 'memory_usage':
          shouldResolve = data.systemHealth.memoryUsage <= this.config.alertThresholds.memoryUsage * 0.9;
          break;
        case 'error_rate':
          shouldResolve = data.performance.trends && 
                         data.performance.trends.errorRate <= this.config.alertThresholds.errorRate * 0.9;
          break;
        case 'response_time':
          const avgResponseTime = data.performance.current.reduce(
            (sum, metric) => sum + metric.executionTime, 0
          ) / data.performance.current.length || 0;
          shouldResolve = avgResponseTime <= this.config.alertThresholds.responseTime * 0.9;
          break;
      }

      if (shouldResolve) {
        resolvedAlerts.push(alertId);
      }
    }

    for (const alertId of resolvedAlerts) {
      const alert = this.activeAlerts.get(alertId);
      this.activeAlerts.delete(alertId);
      this.logger.serviceInfo('告警已解决', { alertId, alert });
    }
  }

  /**
   * 计算告警严重程度统计
   */
  private calculateAlertSeverity(): { high: number; medium: number; low: number } {
    const severity = { high: 0, medium: 0, low: 0 };
    
    for (const alert of this.activeAlerts.values()) {
      switch (alert.severity) {
        case 'HIGH':
          severity.high++;
          break;
        case 'MEDIUM':
          severity.medium++;
          break;
        case 'LOW':
          severity.low++;
          break;
      }
    }

    return severity;
  }

  /**
   * 获取实时数据流
   */
  getDashboardDataStream(): Observable<DashboardData> {
    return this.dataSubject.asObservable();
  }

  /**
   * 获取当前仪表板数据
   */
  async getCurrentDashboardData(): Promise<DashboardData> {
    return await this.collectDashboardData();
  }

  /**
   * 获取历史数据
   */
  getHistoryData(timeRange?: string): DashboardData[] {
    if (!timeRange) {
      return this.historyData;
    }

    const ranges: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };

    const duration = ranges[timeRange] || ranges['24h'];
    const cutoffTime = new Date(Date.now() - duration);

    return this.historyData.filter(data => data.timestamp >= cutoffTime);
  }

  /**
   * 获取系统概览
   */
  async getSystemOverview(): Promise<{
    health: SystemHealthStatus;
    performance: {
      uptime: string;
      totalRequests: number;
      successRate: number;
      avgResponseTime: number;
    };
    alerts: {
      active: number;
      high: number;
      medium: number;
      low: number;
    };
    resources: {
      cpu: number;
      memory: number;
      disk: number;
      network: number;
    };
  }> {
    const currentData = await this.getCurrentDashboardData();

    // 计算运行时间
    const uptime = this.calculateUptime();
    
    // 计算性能指标
    const performance = {
      uptime,
      totalRequests: this.historyData.reduce((sum, data) => 
        sum + data.performance.current.length, 0
      ),
      successRate: this.calculateSuccessRate(),
      avgResponseTime: this.calculateAvgResponseTime(),
    };

    return {
      health: currentData.systemHealth,
      performance,
      alerts: {
        active: this.activeAlerts.size,
        high: this.calculateAlertSeverity().high,
        medium: this.calculateAlertSeverity().medium,
        low: this.calculateAlertSeverity().low,
      },
      resources: {
        cpu: currentData.systemHealth.cpuUsage,
        memory: currentData.systemHealth.memoryUsage,
        disk: currentData.systemHealth.diskUsage || 0,
        network: currentData.systemHealth.networkUsage || 0,
      },
    };
  }

  /**
   * 计算运行时间
   */
  private calculateUptime(): string {
    if (this.historyData.length === 0) {
      return '0分钟';
    }

    const startTime = this.historyData[0].timestamp;
    const uptime = Date.now() - startTime.getTime();
    
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  }

  /**
   * 计算成功率
   */
  private calculateSuccessRate(): number {
    if (this.historyData.length === 0) {
      return 1;
    }

    let totalExecutions = 0;
    let successfulExecutions = 0;

    for (const data of this.historyData) {
      for (const metric of data.performance.current) {
        totalExecutions++;
        if (metric.success) {
          successfulExecutions++;
        }
      }
    }

    return totalExecutions > 0 ? successfulExecutions / totalExecutions : 1;
  }

  /**
   * 计算平均响应时间
   */
  private calculateAvgResponseTime(): number {
    if (this.historyData.length === 0) {
      return 0;
    }

    let totalTime = 0;
    let totalCount = 0;

    for (const data of this.historyData) {
      for (const metric of data.performance.current) {
        totalTime += metric.executionTime;
        totalCount++;
      }
    }

    return totalCount > 0 ? totalTime / totalCount : 0;
  }

  /**
   * 手动确认告警
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    this.logger.serviceInfo('告警已确认', { alertId, acknowledgedBy });
    return true;
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(timeRange?: string): any[] {
    // 这里应该从数据库查询告警历史
    // 当前返回当前活动的告警
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 销毁服务
   */
  async onModuleDestroy(): Promise<void> {
    this.destroy$.next();
    this.destroy$.complete();
    this.dataSubject.complete();
    
    this.logger.serviceInfo('实时监控仪表板服务已销毁');
  }
}