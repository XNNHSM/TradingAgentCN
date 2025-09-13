/**
 * LangGraphJS 集成模块
 * 提供与 Temporal 系统的无缝集成和混合工作流功能
 */

import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LangGraphModule } from '../langgraph.module';
import { AgentsModule } from '../../agents.module';
import { WorkflowBridgeService } from './workflow-bridge';
import { WorkflowSwitcherService } from './workflow-switcher';
import { HybridWorkflowService } from './hybrid-workflow.service';
import { AgentExecutionRecordService } from '../../services/agent-execution-record.service';
import { PerformanceMonitorService } from '../monitoring/performance-monitor';
import { AgentsTemporalClientService } from '../../../temporal/workers/agents/agents-temporal-client.service';

/**
 * 集成模块配置接口
 */
export interface LangGraphIntegrationModuleOptions {
  /** 是否启用混合工作流 */
  enableHybridWorkflow?: boolean;
  /** 是否启用智能路由 */
  enableSmartRouting?: boolean;
  /** 是否启用自适应学习 */
  enableAdaptiveLearning?: boolean;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;
  /** 是否启用自动故障转移 */
  enableAutoFailover?: boolean;
}

/**
 * LangGraphJS 集成模块
 * 提供统一的 LangGraphJS 与 Temporal 集成功能
 */
@Module({})
export class LangGraphIntegrationModule {
  /**
   * 动态注册集成模块
   */
  static forRoot(options: LangGraphIntegrationModuleOptions = {}): DynamicModule {
    const {
      enableHybridWorkflow = true,
      enableSmartRouting = true,
      enableAdaptiveLearning = true,
      enablePerformanceMonitoring = true,
      enableAutoFailover = true,
    } = options;

    return {
      module: LangGraphIntegrationModule,
      imports: [
        ConfigModule,
        AgentsModule,
        LangGraphModule.forRoot({
          enabled: true,
          debug: false,
          recursionLimit: 100,
          timeout: '10m',
        }),
      ],
      providers: [
        {
          provide: 'LANGGRAPH_INTEGRATION_OPTIONS',
          useValue: {
            enableHybridWorkflow,
            enableSmartRouting,
            enableAdaptiveLearning,
            enablePerformanceMonitoring,
            enableAutoFailover,
          },
        },
        PerformanceMonitorService,
        WorkflowBridgeService,
        WorkflowSwitcherService,
        HybridWorkflowService,
      ],
      exports: [
        WorkflowBridgeService,
        WorkflowSwitcherService,
        HybridWorkflowService,
      ],
      global: true,
    };
  }

  /**
   * 异步注册集成模块
   */
  static forRootAsync(options: LangGraphIntegrationModuleOptions = {}): DynamicModule {
    const {
      enableHybridWorkflow = true,
      enableSmartRouting = true,
      enableAdaptiveLearning = true,
      enablePerformanceMonitoring = true,
      enableAutoFailover = true,
    } = options;

    return {
      module: LangGraphIntegrationModule,
      imports: [
        ConfigModule,
        AgentsModule,
        LangGraphModule.forRootAsync({
          enabled: true,
          debug: false,
          recursionLimit: 100,
          timeout: '10m',
        }),
      ],
      providers: [
        {
          provide: 'LANGGRAPH_INTEGRATION_OPTIONS',
          useFactory: async (configService: ConfigService) => ({
            enableHybridWorkflow: enableHybridWorkflow ?? 
              configService.get<boolean>('LANGGRAPH_INTEGRATION_HYBRID_WORKFLOW', true),
            enableSmartRouting: enableSmartRouting ?? 
              configService.get<boolean>('LANGGRAPH_INTEGRATION_SMART_ROUTING', true),
            enableAdaptiveLearning: enableAdaptiveLearning ?? 
              configService.get<boolean>('LANGGRAPH_INTEGRATION_ADAPTIVE_LEARNING', true),
            enablePerformanceMonitoring: enablePerformanceMonitoring ?? 
              configService.get<boolean>('LANGGRAPH_INTEGRATION_PERFORMANCE_MONITORING', true),
            enableAutoFailover: enableAutoFailover ?? 
              configService.get<boolean>('LANGGRAPH_INTEGRATION_AUTO_FAILOVER', true),
          }),
          inject: [ConfigService],
        },
        PerformanceMonitorService,
        WorkflowBridgeService,
        WorkflowSwitcherService,
        HybridWorkflowService,
      ],
      exports: [
        WorkflowBridgeService,
        WorkflowSwitcherService,
        HybridWorkflowService,
      ],
      global: true,
    };
  }

  /**
   * 功能模块 - 仅注册核心服务，不包含配置逻辑
   */
  static forFeature(): DynamicModule {
    return {
      module: LangGraphIntegrationModule,
      providers: [
        PerformanceMonitorService,
        WorkflowBridgeService,
        WorkflowSwitcherService,
        HybridWorkflowService,
      ],
      exports: [
        WorkflowBridgeService,
        WorkflowSwitcherService,
        HybridWorkflowService,
      ],
    };
  }
}