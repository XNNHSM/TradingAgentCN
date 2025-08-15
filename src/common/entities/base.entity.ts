import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('increment', { comment: '主键ID' })
  id: number;

  @CreateDateColumn({
    type: 'datetime',
    precision: 6,
    comment: '创建时间',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'datetime',
    precision: 6,
    comment: '更新时间',
  })
  updatedAt: Date;

  @DeleteDateColumn({
    type: 'datetime',
    precision: 6,
    nullable: true,
    comment: '删除时间（软删除）',
  })
  deletedAt?: Date;

  @VersionColumn({
    comment: '版本号（乐观锁）',
    default: 1,
  })
  version: number;
}