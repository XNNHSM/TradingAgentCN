import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentExecutionRecord } from '../entities/agent-execution-record.entity';
import { AgentExecutionShardingService } from '../services/agent-execution-sharding.service';
import { AgentExecutionRecordService } from '../services/agent-execution-record.service';
import { ExecutionRecordsController } from './execution-records.controller';

/**
 * Agent执行记录模块
 * 提供分表存储和查询功能
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AgentExecutionRecord]),
  ],
  providers: [
    AgentExecutionShardingService,
    AgentExecutionRecordService,
  ],
  controllers: [ExecutionRecordsController],
  exports: [
    AgentExecutionShardingService,
    AgentExecutionRecordService,
  ],
})
export class ExecutionRecordsModule {}