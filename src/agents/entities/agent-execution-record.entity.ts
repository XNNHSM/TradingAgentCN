import { 
  Entity, 
  Column, 
  Index
} from 'typeorm';
import { AgentType, TradingRecommendation } from '../interfaces/agent.interface';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * Agent执行记录实体 - 分表存储
 * 表命名规则: agent_execution_records_{agent_type}
 * 例如: agent_execution_records_market_analyst
 */
@Entity('agent_execution_records')
@Index(['stockCode', 'executionDate'])
@Index(['agentType', 'executionDate'])  
@Index(['sessionId'])
@Index(['executionDate'])
export class AgentExecutionRecord extends BaseEntity {

  // === 基础信息 ===
  @Column({ type: 'varchar', length: 50 })
  sessionId: string; // 会话ID，用于关联同一次分析的所有agent调用

  @Column({ type: 'enum', enum: AgentType })
  agentType: AgentType; // Agent类型

  @Column({ type: 'varchar', length: 100 })
  agentName: string; // Agent名称

  @Column({ type: 'varchar', length: 200 })
  agentRole: string; // Agent角色描述

  // === 股票信息 ===
  @Column({ type: 'varchar', length: 20 })
  stockCode: string; // 股票代码

  @Column({ type: 'varchar', length: 100, nullable: true })
  stockName: string; // 股票名称

  // === 执行信息 ===
  @Column({ type: 'timestamp' })
  executionDate: Date; // 执行日期

  @Column({ type: 'timestamp' })
  startTime: Date; // 开始时间

  @Column({ type: 'timestamp' })
  endTime: Date; // 结束时间

  @Column({ type: 'int', unsigned: true })
  processingTimeMs: number; // 处理时长(毫秒)

  @Column({ type: 'enum', enum: ['success', 'error', 'timeout'], default: 'success' })
  executionStatus: 'success' | 'error' | 'timeout'; // 执行状态

  // === LLM调用信息 ===
  @Column({ type: 'varchar', length: 50 })
  llmModel: string; // 使用的LLM模型

  @Column({ type: 'text' })
  inputPrompt: string; // 输入提示词

  @Column({ type: 'int', unsigned: true, nullable: true })
  inputTokens: number; // 输入Token数量

  @Column({ type: 'int', unsigned: true, nullable: true })
  outputTokens: number; // 输出Token数量

  @Column({ type: 'int', unsigned: true, nullable: true })
  totalTokens: number; // 总Token数量

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  estimatedCost: number; // 预估成本(美元)

  // === 分析结果 ===
  @Column({ type: 'text' })
  analysisResult: string; // 分析结果(原markdown内容)

  @Column({ type: 'json', nullable: true })
  structuredResult: any; // 结构化结果(JSON格式)

  @Column({ type: 'smallint', nullable: true })
  score: number; // 评分(0-100)

  @Column({ type: 'enum', enum: TradingRecommendation, nullable: true })
  recommendation: TradingRecommendation; // 交易建议

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidence: number; // 置信度(0-1)

  @Column({ type: 'json', nullable: true })
  keyInsights: string[]; // 关键洞察

  @Column({ type: 'json', nullable: true })
  risks: string[]; // 风险提示

  @Column({ type: 'json', nullable: true })
  supportingData: any; // 支撑数据

  // === 工具调用信息 ===
  @Column({ type: 'json', nullable: true })
  toolCalls: any[]; // Function calling调用记录

  @Column({ type: 'json', nullable: true })
  toolResults: any[]; // 工具调用结果

  // === 上下文信息 ===
  @Column({ type: 'json', nullable: true })
  contextData: any; // 上下文数据

  @Column({ type: 'json', nullable: true })
  previousResults: any[]; // 前序Agent结果

  @Column({ type: 'json', nullable: true })
  metadata: any; // 扩展元数据

  // === 错误信息 ===
  @Column({ type: 'text', nullable: true })
  errorMessage: string; // 错误信息

  @Column({ type: 'text', nullable: true })
  errorStack: string; // 错误堆栈

  // === 统计字段 ===
  @Column({ type: 'varchar', length: 50, nullable: true })
  analysisType: string; // 分析类型(single/batch/real-time等)

  @Column({ type: 'varchar', length: 20, nullable: true })
  userAgent: string; // 调用来源

  @Column({ type: 'varchar', length: 50, nullable: true })
  environment: string; // 运行环境(dev/test/prod)
}