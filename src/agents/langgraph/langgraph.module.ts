/**
 * LangGraphJS 模块
 * 提供 LangGraphJS 工作流引擎的模块定义
 */

import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentExecutionRecord } from '../entities/agent-execution-record.entity';
import { LLMService } from '../services/llm.service';
import { DashScopeAdapter } from '../services/llm-adapters/dashscope-adapter';
import { MCPClientSDKService } from '../services/mcp-client-sdk.service';
import { AgentExecutionRecordService } from '../services/agent-execution-record.service';
import { LangGraphServiceManager } from './langgraph.service';

/**
 * LangGraphJS 模块配置接口
 */
export interface LangGraphModuleOptions {
  /**
   * 是否启用 LangGraphJS
   */
  enabled?: boolean;
  
  /**
   * 调试模式
   */
  debug?: boolean;
  
  /**
   * 最大递归深度
   */
  recursionLimit?: number;
  
  /**
   * 工作流超时时间
   */
  timeout?: string;
}

/**
 * LangGraphJS 模块
 */
@Module({})
export class LangGraphModule {
  /**
   * 动态注册 LangGraphJS 模块
   */
  static forRoot(options: LangGraphModuleOptions = {}): DynamicModule {
    const {
      enabled = true,
      debug = false,
      recursionLimit = 100,
      timeout = '10m',
    } = options;

    return {
      module: LangGraphModule,
      imports: [
        ConfigModule,
        TypeOrmModule.forFeature([AgentExecutionRecord]),
      ],
      providers: [
        {
          provide: 'LANGGRAPHJS_OPTIONS',
          useValue: {
            enabled,
            debug,
            recursionLimit,
            timeout,
          },
        },
        DashScopeAdapter,
        LLMService,
        MCPClientSDKService,
        AgentExecutionRecordService,
        LangGraphServiceManager,
      ],
      exports: [LangGraphServiceManager],
      global: enabled, // 全局模块
    };
  }

  /**
   * 异步注册 LangGraphJS 模块
   */
  static forRootAsync(options: LangGraphModuleOptions = {}): DynamicModule {
    const {
      enabled = true,
      debug = false,
      recursionLimit = 100,
      timeout = '10m',
    } = options;

    return {
      module: LangGraphModule,
      imports: [
        ConfigModule,
        TypeOrmModule.forFeature([AgentExecutionRecord]),
      ],
      providers: [
        {
          provide: 'LANGGRAPHJS_OPTIONS',
          useFactory: async (configService: ConfigService) => ({
            enabled: enabled ?? configService.get<boolean>('LANGGRAPHJS_ENABLED', true),
            debug: debug ?? configService.get<boolean>('LANGGRAPHJS_DEBUG', false),
            recursionLimit: recursionLimit ?? configService.get<number>('LANGGRAPHJS_RECURSION_LIMIT', 100),
            timeout: timeout ?? configService.get<string>('LANGGRAPHJS_TIMEOUT', '10m'),
          }),
          inject: [ConfigService],
        },
        DashScopeAdapter,
        LLMService,
        MCPClientSDKService,
        AgentExecutionRecordService,
        LangGraphServiceManager,
      ],
      exports: [LangGraphServiceManager],
      global: enabled,
    };
  }

  /**
   * 功能模块 - 仅注册服务，不包含智能体创建逻辑
   */
  static forFeature(): DynamicModule {
    return {
      module: LangGraphModule,
      imports: [
        TypeOrmModule.forFeature([AgentExecutionRecord]),
      ],
      providers: [
        DashScopeAdapter,
        LLMService,
        MCPClientSDKService,
        AgentExecutionRecordService,
        LangGraphServiceManager,
      ],
      exports: [LangGraphServiceManager],
    };
  }
}