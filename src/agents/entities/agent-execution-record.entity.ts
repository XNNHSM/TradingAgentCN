import { 
  Entity, 
  Column, 
  Index
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * Agent执行记录实体 - 统一存储所有LLM调用记录
 * 专注于记录LLM调用的详细信息和Token消耗
 */
@Entity('agent_execution_records')
@Index(['sessionId'])
@Index(['agentType'])
@Index(['createdAt'])
@Index(['status'])
export class AgentExecutionRecord extends BaseEntity {

  // === 会话和智能体信息 ===
  @Column({ type: 'varchar', length: 50 })
  sessionId: string; // 会话ID，用于关联同一次分析的所有agent调用

  @Column({ type: 'varchar', length: 50 })
  agentType: string; // Agent类型

  @Column({ type: 'varchar', length: 100 })
  agentName: string; // Agent名称

  @Column({ type: 'varchar', length: 50, nullable: true })
  executionPhase: string; // 执行阶段(数据收集/专业分析/决策整合)

  // === LLM调用信息 ===
  @Column({ type: 'varchar', length: 50 })
  llmProvider: string; // LLM提供商(dashscope/openai)

  @Column({ type: 'varchar', length: 100 })
  llmModel: string; // 使用的LLM模型

  @Column({ type: 'text', nullable: true })
  promptTemplate: string; // 使用的提示模板

  @Column({ type: 'jsonb' })
  inputMessages: any; // 输入消息内容

  @Column({ type: 'text', nullable: true })
  outputContent: string; // LLM响应内容

  @Column({ type: 'int', default: 0 })
  inputTokens: number; // 输入Token数量

  @Column({ type: 'int', default: 0 })
  outputTokens: number; // 输出Token数量

  @Column({ type: 'int', default: 0 })
  totalTokens: number; // 总Token数量

  // === 执行状态和性能信息 ===
  @Column({ type: 'int', default: 0 })
  executionTimeMs: number; // 执行耗时(毫秒)

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string; // 状态: pending/success/failed

  // === 错误信息 ===
  @Column({ type: 'text', nullable: true })
  errorMessage: string; // 错误信息

  @Column({ type: 'varchar', length: 50, nullable: true })
  errorCode: string; // 错误码

  // === 扩展元数据 ===
  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // 扩展元数据(业务上下文等)
}