/**
 * 高级告警和通知系统
 * 提供智能告警规则、通知渠道管理、告警升级和恢复机制
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessLogger, LogCategory } from '../../../common/utils/business-logger.util';
import { PerformanceMonitorService, PerformanceMetrics, SystemHealthStatus } from './performance-monitor';

/**
 * 告警级别
 */
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * 告警类型
 */
export enum AlertType {
  SYSTEM = 'system',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  BUSINESS = 'business',
  PREDICTION = 'prediction',
}

/**
 * 告警状态
 */
export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
}

/**
 * 通知渠道
 */
export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  DINGTALK = 'dingtalk',
  WECHAT = 'wechat',
}

/**
 * 告警规则
 */
export interface AlertRule {
  /** 规则ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 告警类型 */
  type: AlertType;
  /** 默认严重级别 */
  severity: AlertSeverity;
  /** 条件表达式 */
  condition: string;
  /** 阈值 */
  threshold: number;
  /** 持续时间（毫秒） */
  duration: number;
  /** 是否启用 */
  enabled: boolean;
  /** 通知渠道 */
  notificationChannels: NotificationChannel[];
  /** 升级规则 */
  escalationRules?: EscalationRule[];
  /** 抑制规则 */
  suppressionRules?: SuppressionRule[];
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 升级规则
 */
export interface EscalationRule {
  /** 升级级别 */
  level: number;
  /** 升级时间（毫秒） */
  escalationTime: number;
  /** 升级后的严重级别 */
  escalatedSeverity: AlertSeverity;
  /** 升级后的通知渠道 */
  escalatedChannels: NotificationChannel[];
  /** 升级条件 */
  escalationCondition?: string;
}

/**
 * 抑制规则
 */
export interface SuppressionRule {
  /** 抑制条件 */
  condition: string;
  /** 抑制时间（毫秒） */
  suppressionTime: number;
  /** 抑制原因 */
  reason: string;
}

/**
 * 告警通知
 */
export interface AlertNotification {
  /** 告警ID */
  alertId: string;
  /** 通知渠道 */
  channel: NotificationChannel;
  /** 通知内容 */
  content: {
    title: string;
    message: string;
    details?: any;
    actions?: any[];
  };
  /** 接收者 */
  recipients: string[];
  /** 发送时间 */
  sentAt: Date;
  /** 发送状态 */
  status: 'pending' | 'sent' | 'failed';
  /** 重试次数 */
  retryCount: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 告警实例
 */
export interface AlertInstance {
  /** 告警ID */
  id: string;
  /** 规则ID */
  ruleId: string;
  /** 告警名称 */
  name: string;
  /** 告警类型 */
  type: AlertType;
  /** 严重级别 */
  severity: AlertSeverity;
  /** 状态 */
  status: AlertStatus;
  /** 消息 */
  message: string;
  /** 指标名称 */
  metric: string;
  /** 当前值 */
  value: number;
  /** 阈值 */
  threshold: number;
  /** 触发时间 */
  triggeredAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
  /** 确认信息 */
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  /** 解决时间 */
  resolvedAt?: Date;
  /** 解决原因 */
  resolvedReason?: string;
  /** 元数据 */
  metadata: Record<string, any>;
  /** 通知历史 */
  notificationHistory: AlertNotification[];
}

/**
 * 告警系统配置
 */
export interface AlertSystemConfig {
  /** 告警检查间隔 */
  checkInterval: number;
  /** 历史数据保留天数 */
  historyRetentionDays: number;
  /** 最大重试次数 */
  maxRetryAttempts: number;
  /** 重试间隔 */
  retryInterval: number;
  /** 默认通知渠道 */
  defaultChannels: NotificationChannel[];
  /** 告警规则文件路径 */
  rulesFilePath?: string;
}

/**
 * 高级告警和通知系统
 */
@Injectable()
export class AlertingSystemService implements OnModuleInit {
  private readonly logger: BusinessLogger;
  private config: AlertSystemConfig;
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, AlertInstance> = new Map();
  private alertHistory: AlertInstance[] = [];
  private notificationQueue: AlertNotification[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly performanceMonitor: PerformanceMonitorService,
  ) {
    this.logger = new BusinessLogger(AlertingSystemService.name);
  }

  /**
   * 模块初始化
   */
  async onModuleInit(): Promise<void> {
    await this.initializeConfig();
    await this.loadDefaultRules();
    await this.startMonitoring();
    
    this.logger.serviceInfo('高级告警和通知系统初始化完成', {
      rulesCount: this.rules.size,
      config: this.config,
    });
  }

  /**
   * 初始化配置
   */
  private async initializeConfig(): Promise<void> {
    this.config = {
      checkInterval: this.configService.get<number>(
        'ALERTING_CHECK_INTERVAL',
        30000
      ),
      historyRetentionDays: this.configService.get<number>(
        'ALERTING_HISTORY_RETENTION_DAYS',
        30
      ),
      maxRetryAttempts: this.configService.get<number>(
        'ALERTING_MAX_RETRY_ATTEMPTS',
        3
      ),
      retryInterval: this.configService.get<number>(
        'ALERTING_RETRY_INTERVAL',
        60000
      ),
      defaultChannels: this.configService.get<NotificationChannel[]>(
        'ALERTING_DEFAULT_CHANNELS',
        [NotificationChannel.WEBHOOK]
      ),
      rulesFilePath: this.configService.get<string>('ALERTING_RULES_FILE_PATH'),
    };
  }

  /**
   * 加载默认告警规则
   */
  private async loadDefaultRules(): Promise<void> {
    const defaultRules: AlertRule[] = [
      {
        id: 'cpu_usage_high',
        name: 'CPU使用率过高',
        description: '当CPU使用率超过阈值时触发',
        type: AlertType.SYSTEM,
        severity: AlertSeverity.HIGH,
        condition: 'cpu_usage > threshold',
        threshold: 80,
        duration: 300000, // 5分钟
        enabled: true,
        notificationChannels: [NotificationChannel.WEBHOOK, NotificationChannel.DINGTALK],
        escalationRules: [
          {
            level: 1,
            escalationTime: 600000, // 10分钟
            escalatedSeverity: AlertSeverity.CRITICAL,
            escalatedChannels: [NotificationChannel.SMS, NotificationChannel.EMAIL],
          },
        ],
      },
      {
        id: 'memory_usage_high',
        name: '内存使用率过高',
        description: '当内存使用率超过阈值时触发',
        type: AlertType.SYSTEM,
        severity: AlertSeverity.HIGH,
        condition: 'memory_usage > threshold',
        threshold: 85,
        duration: 300000,
        enabled: true,
        notificationChannels: [NotificationChannel.WEBHOOK, NotificationChannel.DINGTALK],
      },
      {
        id: 'error_rate_high',
        name: '错误率过高',
        description: '当系统错误率超过阈值时触发',
        type: AlertType.PERFORMANCE,
        severity: AlertSeverity.MEDIUM,
        condition: 'error_rate > threshold',
        threshold: 0.1,
        duration: 600000, // 10分钟
        enabled: true,
        notificationChannels: [NotificationChannel.WEBHOOK],
      },
      {
        id: 'response_time_high',
        name: '响应时间过长',
        description: '当平均响应时间超过阈值时触发',
        type: AlertType.PERFORMANCE,
        severity: AlertSeverity.MEDIUM,
        condition: 'avg_response_time > threshold',
        threshold: 10000,
        duration: 300000,
        enabled: true,
        notificationChannels: [NotificationChannel.WEBHOOK],
      },
      {
        id: 'prediction_error_probability_high',
        name: '预测错误率过高',
        description: '当预测系统错误率超过阈值时触发',
        type: AlertType.PREDICTION,
        severity: AlertSeverity.MEDIUM,
        condition: 'error_probability > threshold',
        threshold: 0.3,
        duration: 300000,
        enabled: true,
        notificationChannels: [NotificationChannel.WEBHOOK],
      },
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * 启动监控
   */
  private async startMonitoring(): Promise<void> {
    // 定时检查告警条件
    setInterval(async () => {
      try {
        await this.checkAlertConditions();
        await this.processEscalations();
        await this.sendNotifications();
      } catch (error) {
        this.logger.serviceError('告警检查失败', error as Error);
      }
    }, this.config.checkInterval);

    // 定时清理历史数据
    setInterval(async () => {
      await this.cleanupHistoryData();
    }, 24 * 60 * 60 * 1000); // 每天清理一次
  }

  /**
   * 检查告警条件
   */
  private async checkAlertConditions(): Promise<void> {
    const systemHealth = await this.performanceMonitor.getSystemHealthStatus();
    const recentMetrics = await this.performanceMonitor.getRecentMetrics(50);
    const predictions = await this.performanceMonitor.getPredictions();

    const context = {
      systemHealth,
      recentMetrics,
      predictions,
      timestamp: new Date(),
    };

    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      try {
        const shouldTrigger = await this.evaluateRule(rule, context);
        
        if (shouldTrigger) {
          await this.triggerAlert(rule, context);
        } else {
          await this.checkAlertResolution(rule, context);
        }
      } catch (error) {
        this.logger.warn(LogCategory.SERVICE_ERROR, `评估告警规则失败: ${rule.id}`, undefined, {
          error: (error as Error).message,
          ruleId: rule.id,
        });
      }
    }
  }

  /**
   * 评估告警规则
   */
  private async evaluateRule(rule: AlertRule, context: any): Promise<boolean> {
    // 简化的规则评估逻辑
    switch (rule.id) {
      case 'cpu_usage_high':
        return context.systemHealth.cpuUsage > rule.threshold;
      
      case 'memory_usage_high':
        return context.systemHealth.memoryUsage > rule.threshold;
      
      case 'error_rate_high':
        const failedMetrics = context.recentMetrics.filter(m => !m.success);
        const errorRate = failedMetrics.length / context.recentMetrics.length;
        return errorRate > rule.threshold;
      
      case 'response_time_high':
        const avgResponseTime = context.recentMetrics.reduce(
          (sum, m) => sum + m.executionTime, 0
        ) / context.recentMetrics.length;
        return avgResponseTime > rule.threshold;
      
      case 'prediction_error_probability_high':
        return context.predictions?.errorProbability > rule.threshold;
      
      default:
        return false;
    }
  }

  /**
   * 触发告警
   */
  private async triggerAlert(rule: AlertRule, context: any): Promise<void> {
    const alertId = `${rule.id}_${Date.now()}`;
    const existingAlert = Array.from(this.activeAlerts.values())
      .find(alert => alert.ruleId === rule.id && alert.status === AlertStatus.ACTIVE);

    if (existingAlert) {
      // 更新现有告警
      existingAlert.updatedAt = new Date();
      existingAlert.value = this.getAlertValue(rule, context);
      return;
    }

    // 创建新告警
    const alert: AlertInstance = {
      id: alertId,
      ruleId: rule.id,
      name: rule.name,
      type: rule.type,
      severity: rule.severity,
      status: AlertStatus.ACTIVE,
      message: this.generateAlertMessage(rule, context),
      metric: this.getAlertMetric(rule),
      value: this.getAlertValue(rule, context),
      threshold: rule.threshold,
      triggeredAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        ...context,
        ruleMetadata: rule.metadata,
      },
      notificationHistory: [],
    };

    this.activeAlerts.set(alertId, alert);
    this.alertHistory.push(alert);

    // 创建通知
    await this.createNotifications(alert, rule);

    this.logger.warn(LogCategory.SERVICE_ERROR, '触发新告警', undefined, {
      alertId,
      ruleId: rule.id,
      severity: alert.severity,
      message: alert.message,
    });
  }

  /**
   * 检查告警解决
   */
  private async checkAlertResolution(rule: AlertRule, context: any): Promise<void> {
    const alertsToResolve = Array.from(this.activeAlerts.values())
      .filter(alert => alert.ruleId === rule.id && alert.status === AlertStatus.ACTIVE);

    for (const alert of alertsToResolve) {
      const shouldResolve = !(await this.evaluateRule(rule, context));
      
      if (shouldResolve) {
        alert.status = AlertStatus.RESOLVED;
        alert.resolvedAt = new Date();
        alert.resolvedReason = '条件不再满足';
        alert.updatedAt = new Date();

        this.activeAlerts.delete(alert.id);

        // 发送解决通知
        await this.sendResolutionNotification(alert);

        this.logger.serviceInfo('告警已解决', {
          alertId: alert.id,
          ruleId: rule.id,
          resolutionTime: alert.resolvedAt,
        });
      }
    }
  }

  /**
   * 生成告警消息
   */
  private generateAlertMessage(rule: AlertRule, context: any): string {
    const value = this.getAlertValue(rule, context);
    
    switch (rule.id) {
      case 'cpu_usage_high':
        return `CPU使用率过高: ${value.toFixed(1)}% (阈值: ${rule.threshold}%)`;
      
      case 'memory_usage_high':
        return `内存使用率过高: ${value.toFixed(1)}% (阈值: ${rule.threshold}%)`;
      
      case 'error_rate_high':
        return `错误率过高: ${(value * 100).toFixed(1)}% (阈值: ${(rule.threshold * 100).toFixed(1)}%)`;
      
      case 'response_time_high':
        return `平均响应时间过长: ${value.toFixed(0)}ms (阈值: ${rule.threshold}ms)`;
      
      case 'prediction_error_probability_high':
        return `预测错误率过高: ${(value * 100).toFixed(1)}% (阈值: ${(rule.threshold * 100).toFixed(1)}%)`;
      
      default:
        return `${rule.name}: 当前值 ${value} 超过阈值 ${rule.threshold}`;
    }
  }

  /**
   * 获取告警指标名称
   */
  private getAlertMetric(rule: AlertRule): string {
    switch (rule.id) {
      case 'cpu_usage_high':
        return 'cpu_usage';
      case 'memory_usage_high':
        return 'memory_usage';
      case 'error_rate_high':
        return 'error_rate';
      case 'response_time_high':
        return 'avg_response_time';
      case 'prediction_error_probability_high':
        return 'error_probability';
      default:
        return 'unknown';
    }
  }

  /**
   * 获取告警值
   */
  private getAlertValue(rule: AlertRule, context: any): number {
    switch (rule.id) {
      case 'cpu_usage_high':
        return context.systemHealth.cpuUsage;
      case 'memory_usage_high':
        return context.systemHealth.memoryUsage;
      case 'error_rate_high':
        const failedMetrics = context.recentMetrics.filter(m => !m.success);
        return failedMetrics.length / context.recentMetrics.length;
      case 'response_time_high':
        return context.recentMetrics.reduce(
          (sum, m) => sum + m.executionTime, 0
        ) / context.recentMetrics.length;
      case 'prediction_error_probability_high':
        return context.predictions?.errorProbability || 0;
      default:
        return 0;
    }
  }

  /**
   * 创建通知
   */
  private async createNotifications(alert: AlertInstance, rule: AlertRule): Promise<void> {
    const channels = rule.notificationChannels.length > 0 
      ? rule.notificationChannels 
      : this.config.defaultChannels;

    for (const channel of channels) {
      const notification: AlertNotification = {
        alertId: alert.id,
        channel,
        content: {
          title: `[${alert.severity.toUpperCase()}] ${alert.name}`,
          message: alert.message,
          details: {
            alertId: alert.id,
            metric: alert.metric,
            currentValue: alert.value,
            threshold: alert.threshold,
            triggeredAt: alert.triggeredAt,
            severity: alert.severity,
          },
          actions: [
            {
              label: '查看详情',
              url: `/api/v1/analysis/alerts/${alert.id}`,
            },
            {
              label: '确认告警',
              action: 'acknowledge',
              method: 'POST',
              url: `/api/v1/analysis/alerts/${alert.id}/acknowledge`,
            },
          ],
        },
        recipients: this.getNotificationRecipients(channel),
        sentAt: new Date(),
        status: 'pending',
        retryCount: 0,
      };

      this.notificationQueue.push(notification);
      alert.notificationHistory.push(notification);
    }
  }

  /**
   * 获取通知接收者
   */
  private getNotificationRecipients(channel: NotificationChannel): string[] {
    // 这里应该从配置或数据库中获取接收者信息
    switch (channel) {
      case NotificationChannel.EMAIL:
        return ['admin@example.com'];
      case NotificationChannel.SMS:
        return ['+8613800138000'];
      case NotificationChannel.WEBHOOK:
        return ['http://localhost:3000/webhook/alert'];
      case NotificationChannel.DINGTALK:
        return ['https://oapi.dingtalk.com/robot/send'];
      case NotificationChannel.WECHAT:
        return ['https://qyapi.weixin.qq.com/cgi-bin/webhook/send'];
      default:
        return [];
    }
  }

  /**
   * 发送通知
   */
  private async sendNotifications(): Promise<void> {
    const pendingNotifications = this.notificationQueue.filter(n => n.status === 'pending');
    
    for (const notification of pendingNotifications) {
      try {
        await this.sendNotification(notification);
        notification.status = 'sent';
        notification.sentAt = new Date();
        
        this.logger.serviceInfo('通知发送成功', {
          alertId: notification.alertId,
          channel: notification.channel,
          recipients: notification.recipients,
        });
      } catch (error) {
        notification.status = 'failed';
        notification.error = (error as Error).message;
        notification.retryCount++;
        
        this.logger.serviceError('通知发送失败', error as Error, {
          alertId: notification.alertId,
          channel: notification.channel,
          retryCount: notification.retryCount,
        });

        // 重试逻辑
        if (notification.retryCount < this.config.maxRetryAttempts) {
          setTimeout(async () => {
            notification.status = 'pending';
          }, this.config.retryInterval);
        }
      }
    }

    // 清理已发送或失败超过最大重试次数的通知
    this.notificationQueue = this.notificationQueue.filter(
      n => n.status === 'pending' || 
           (n.status === 'failed' && n.retryCount < this.config.maxRetryAttempts)
    );
  }

  /**
   * 发送单个通知
   */
  private async sendNotification(notification: AlertNotification): Promise<void> {
    // 这里应该实现具体的通知发送逻辑
    // 简化实现：只是记录日志
    this.logger.serviceInfo('模拟发送通知', {
      channel: notification.channel,
      title: notification.content.title,
      message: notification.content.message,
      recipients: notification.recipients,
    });

    // 实际实现应该调用相应的通知服务
    switch (notification.channel) {
      case NotificationChannel.EMAIL:
        // 调用邮件服务
        break;
      case NotificationChannel.SMS:
        // 调用短信服务
        break;
      case NotificationChannel.WEBHOOK:
        // 调用Webhook服务
        break;
      case NotificationChannel.DINGTALK:
        // 调用钉钉机器人服务
        break;
      case NotificationChannel.WECHAT:
        // 调用企业微信机器人服务
        break;
    }
  }

  /**
   * 发送解决通知
   */
  private async sendResolutionNotification(alert: AlertInstance): Promise<void> {
    const notification: AlertNotification = {
      alertId: alert.id,
      channel: NotificationChannel.WEBHOOK,
      content: {
        title: `[RESOLVED] ${alert.name}`,
        message: `告警已解决: ${alert.message}`,
        details: {
          alertId: alert.id,
          resolvedAt: alert.resolvedAt,
          resolvedReason: alert.resolvedReason,
          duration: alert.resolvedAt.getTime() - alert.triggeredAt.getTime(),
        },
      },
      recipients: this.getNotificationRecipients(NotificationChannel.WEBHOOK),
      sentAt: new Date(),
      status: 'pending',
      retryCount: 0,
    };

    this.notificationQueue.push(notification);
  }

  /**
   * 处理升级
   */
  private async processEscalations(): Promise<void> {
    const now = Date.now();

    for (const alert of this.activeAlerts.values()) {
      if (alert.status !== AlertStatus.ACTIVE) {
        continue;
      }

      const rule = this.rules.get(alert.ruleId);
      if (!rule || !rule.escalationRules) {
        continue;
      }

      const duration = now - alert.triggeredAt.getTime();

      for (const escalationRule of rule.escalationRules) {
        if (duration >= escalationRule.escalationTime && 
            alert.severity !== escalationRule.escalatedSeverity) {
          
          // 升级告警
          alert.severity = escalationRule.escalatedSeverity;
          alert.updatedAt = new Date();

          // 发送升级通知
          await this.createEscalationNotification(alert, escalationRule);

          this.logger.warn(LogCategory.SERVICE_ERROR, '告警已升级', undefined, {
            alertId: alert.id,
            from: rule.severity,
            to: escalationRule.escalatedSeverity,
            escalationLevel: escalationRule.level,
          });
        }
      }
    }
  }

  /**
   * 创建升级通知
   */
  private async createEscalationNotification(alert: AlertInstance, escalationRule: EscalationRule): Promise<void> {
    const notification: AlertNotification = {
      alertId: alert.id,
      channel: escalationRule.escalatedChannels[0],
      content: {
        title: `[ESCALATED] ${alert.name}`,
        message: `告警已升级到${escalationRule.escalatedSeverity}级别`,
        details: {
          alertId: alert.id,
          originalSeverity: alert.severity,
          escalatedSeverity: escalationRule.escalatedSeverity,
          escalationLevel: escalationRule.level,
          duration: Date.now() - alert.triggeredAt.getTime(),
        },
      },
      recipients: this.getNotificationRecipients(escalationRule.escalatedChannels[0]),
      sentAt: new Date(),
      status: 'pending',
      retryCount: 0,
    };

    this.notificationQueue.push(notification);
    alert.notificationHistory.push(notification);
  }

  /**
   * 清理历史数据
   */
  private async cleanupHistoryData(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.config.historyRetentionDays * 24 * 60 * 60 * 1000);
    
    this.alertHistory = this.alertHistory.filter(alert => 
      alert.triggeredAt >= cutoffDate
    );

    this.logger.serviceInfo('清理告警历史数据完成', {
      removedCount: this.alertHistory.length,
      cutoffDate,
    });
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert || alert.status !== AlertStatus.ACTIVE) {
      return false;
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();
    alert.updatedAt = new Date();

    this.logger.serviceInfo('告警已确认', {
      alertId,
      acknowledgedBy,
    });

    return true;
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): AlertInstance[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(filters?: {
    type?: AlertType;
    severity?: AlertSeverity;
    status?: AlertStatus;
    startDate?: Date;
    endDate?: Date;
  }): AlertInstance[] {
    let filteredHistory = [...this.alertHistory];

    if (filters) {
      if (filters.type) {
        filteredHistory = filteredHistory.filter(a => a.type === filters.type);
      }
      if (filters.severity) {
        filteredHistory = filteredHistory.filter(a => a.severity === filters.severity);
      }
      if (filters.status) {
        filteredHistory = filteredHistory.filter(a => a.status === filters.status);
      }
      if (filters.startDate) {
        filteredHistory = filteredHistory.filter(a => a.triggeredAt >= filters.startDate);
      }
      if (filters.endDate) {
        filteredHistory = filteredHistory.filter(a => a.triggeredAt <= filters.endDate);
      }
    }

    return filteredHistory.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  /**
   * 添加告警规则
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.logger.serviceInfo('添加告警规则', { ruleId: rule.id, ruleName: rule.name });
  }

  /**
   * 更新告警规则
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    Object.assign(rule, updates);
    this.logger.serviceInfo('更新告警规则', { ruleId, updates });
    return true;
  }

  /**
   * 删除告警规则
   */
  deleteRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      this.logger.serviceInfo('删除告警规则', { ruleId });
    }
    return deleted;
  }

  /**
   * 获取告警规则
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取告警统计
   */
  getAlertStats(): {
    total: number;
    active: number;
    acknowledged: number;
    resolved: number;
    byType: Record<AlertType, number>;
    bySeverity: Record<AlertSeverity, number>;
  } {
    const stats = {
      total: this.alertHistory.length,
      active: 0,
      acknowledged: 0,
      resolved: 0,
      byType: {} as Record<AlertType, number>,
      bySeverity: {} as Record<AlertSeverity, number>,
    };

    // 初始化统计
    for (const type of Object.values(AlertType)) {
      stats.byType[type] = 0;
    }
    for (const severity of Object.values(AlertSeverity)) {
      stats.bySeverity[severity] = 0;
    }

    // 统计活跃告警
    for (const alert of this.activeAlerts.values()) {
      stats.active++;
      stats.byType[alert.type]++;
      stats.bySeverity[alert.severity]++;
      
      if (alert.status === AlertStatus.ACKNOWLEDGED) {
        stats.acknowledged++;
      }
    }

    // 统计历史告警
    for (const alert of this.alertHistory) {
      if (alert.status === AlertStatus.RESOLVED) {
        stats.resolved++;
      }
    }

    return stats;
  }
}