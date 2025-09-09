import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { MessageType } from '../dtos/message.dto';

/**
 * 消息发送记录实体
 */
@Entity('message_send_records')
@Index(['provider', 'status', 'createdAt'])
@Index(['target', 'createdAt'])
export class MessageSendRecord extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 50,
    comment: '消息提供者',
  })
  provider: string;

  @Column({
    type: 'varchar',
    length: 500,
    comment: '目标标识',
  })
  target: string;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    comment: '消息标题',
  })
  title?: string;

  @Column({
    type: 'text',
    comment: '消息内容',
  })
  content: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
    comment: '消息类型',
  })
  messageType: MessageType;

  @Column({
    type: 'json',
    nullable: true,
    comment: '请求参数',
  })
  requestParams?: Record<string, any>;

  @Column({
    type: 'json',
    nullable: true,
    comment: '响应结果',
  })
  response?: Record<string, any>;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '消息ID',
  })
  messageId?: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'success', 'failed', 'retrying'],
    default: 'pending',
    comment: '发送状态',
  })
  status: 'pending' | 'success' | 'failed' | 'retrying';

  @Column({
    type: 'text',
    nullable: true,
    comment: '错误信息',
  })
  errorMessage?: string;

  @Column({
    type: 'int',
    nullable: true,
    comment: '重试次数',
  })
  retryCount?: number;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: '开始时间',
  })
  startTime?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: '结束时间',
  })
  endTime?: Date;

  @Column({
    type: 'int',
    comment: '执行时长(毫秒)',
  })
  executionTime: number;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
    comment: '成本(元)',
  })
  cost?: number;

  @Column({
    type: 'json',
    nullable: true,
    comment: '扩展元数据',
  })
  metadata?: Record<string, any>;
}