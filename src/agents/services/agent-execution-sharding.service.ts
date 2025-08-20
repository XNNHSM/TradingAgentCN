import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AgentType } from '../interfaces/agent.interface';
import { AgentExecutionRecord } from '../entities/agent-execution-record.entity';

/**
 * Agent执行记录分表管理服务
 * 实现按Agent类型分表的sharding策略
 */
@Injectable()
export class AgentExecutionShardingService {
  private readonly logger = new Logger(AgentExecutionShardingService.name);
  private readonly tableCache = new Map<AgentType, string>();
  private readonly repositoryCache = new Map<string, Repository<AgentExecutionRecord>>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * 获取指定Agent类型的表名
   */
  getTableName(agentType: AgentType): string {
    if (this.tableCache.has(agentType)) {
      return this.tableCache.get(agentType)!;
    }

    const tableName = `agent_execution_records_${agentType}`;
    this.tableCache.set(agentType, tableName);
    return tableName;
  }

  /**
   * 获取指定Agent类型的Repository
   */
  async getRepository(agentType: AgentType): Promise<Repository<AgentExecutionRecord>> {
    const tableName = this.getTableName(agentType);
    
    if (this.repositoryCache.has(tableName)) {
      return this.repositoryCache.get(tableName)!;
    }

    // 确保表存在
    await this.ensureTableExists(agentType);
    
    // 创建动态Repository
    const repository = this.dataSource.getRepository(AgentExecutionRecord);
    // 动态设置表名
    repository.metadata.tableName = tableName;
    
    this.repositoryCache.set(tableName, repository);
    return repository;
  }

  /**
   * 确保分表存在
   */
  private async ensureTableExists(agentType: AgentType): Promise<void> {
    const tableName = this.getTableName(agentType);
    
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();

      // 检查表是否存在
      const tableExists = await queryRunner.hasTable(tableName);
      
      if (!tableExists) {
        this.logger.log(`创建分表: ${tableName}`);
        
        // 创建分表SQL(基于主表结构)
        const createTableSQL = `
          CREATE TABLE ${tableName} LIKE agent_execution_records;
        `;
        
        await queryRunner.query(createTableSQL);
        
        // 创建分表特定的索引
        const indexSQL = [
          `CREATE INDEX idx_${agentType}_stock_execution ON ${tableName} (stock_code, execution_date);`,
          `CREATE INDEX idx_${agentType}_session ON ${tableName} (session_id);`,
          `CREATE INDEX idx_${agentType}_execution_date ON ${tableName} (execution_date);`,
          `CREATE INDEX idx_${agentType}_status ON ${tableName} (execution_status);`,
        ];
        
        for (const sql of indexSQL) {
          await queryRunner.query(sql);
        }
        
        this.logger.log(`分表 ${tableName} 创建成功`);
      }
      
      await queryRunner.release();
    } catch (error) {
      this.logger.error(`创建分表 ${tableName} 失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 创建所有Agent类型的分表
   */
  async createAllShardTables(): Promise<void> {
    this.logger.log('开始创建所有Agent分表...');
    
    const agentTypes = Object.values(AgentType);
    
    for (const agentType of agentTypes) {
      try {
        await this.ensureTableExists(agentType);
      } catch (error) {
        this.logger.error(`创建 ${agentType} 分表失败:`, error);
      }
    }
    
    this.logger.log('所有Agent分表创建完成');
  }

  /**
   * 获取分表统计信息
   */
  async getShardingStats(): Promise<any> {
    const stats: any = {
      totalTables: 0,
      tables: {},
    };

    for (const agentType of Object.values(AgentType)) {
      try {
        const repository = await this.getRepository(agentType);
        const tableName = this.getTableName(agentType);
        
        const count = await repository.count();
        const latestRecord = await repository.findOne({
          order: { createdAt: 'DESC' }
        });
        
        stats.tables[agentType] = {
          tableName,
          recordCount: count,
          latestExecution: latestRecord?.executionDate || null,
        };
        
        stats.totalTables++;
      } catch (error) {
        this.logger.warn(`获取 ${agentType} 统计信息失败: ${error.message}`);
        stats.tables[agentType] = {
          tableName: this.getTableName(agentType),
          recordCount: 0,
          latestExecution: null,
          error: error.message,
        };
      }
    }

    return stats;
  }

  /**
   * 跨分表查询
   */
  async queryAcrossShards(
    agentTypes: AgentType[],
    queryOptions: {
      stockCode?: string;
      sessionId?: string;
      dateRange?: { start: Date; end: Date };
      limit?: number;
      offset?: number;
    }
  ): Promise<AgentExecutionRecord[]> {
    const results: AgentExecutionRecord[] = [];
    
    for (const agentType of agentTypes) {
      try {
        const repository = await this.getRepository(agentType);
        
        // 构建查询条件
        const queryBuilder = repository.createQueryBuilder('record');
        
        if (queryOptions.stockCode) {
          queryBuilder.andWhere('record.stockCode = :stockCode', { stockCode: queryOptions.stockCode });
        }
        
        if (queryOptions.sessionId) {
          queryBuilder.andWhere('record.sessionId = :sessionId', { sessionId: queryOptions.sessionId });
        }
        
        if (queryOptions.dateRange) {
          queryBuilder.andWhere('record.executionDate BETWEEN :start AND :end', {
            start: queryOptions.dateRange.start,
            end: queryOptions.dateRange.end,
          });
        }
        
        queryBuilder.orderBy('record.executionDate', 'DESC');
        
        if (queryOptions.limit) {
          queryBuilder.limit(queryOptions.limit);
        }
        
        if (queryOptions.offset) {
          queryBuilder.offset(queryOptions.offset);
        }
        
        const records = await queryBuilder.getMany();
        results.push(...records);
        
      } catch (error) {
        this.logger.warn(`查询 ${agentType} 分表失败: ${error.message}`);
      }
    }
    
    // 按时间排序
    return results.sort((a, b) => b.executionDate.getTime() - a.executionDate.getTime());
  }

  /**
   * 清理过期数据
   */
  async cleanupOldRecords(retentionDays: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    this.logger.log(`开始清理 ${retentionDays} 天前的记录，截止日期: ${cutoffDate.toISOString()}`);
    
    for (const agentType of Object.values(AgentType)) {
      try {
        const repository = await this.getRepository(agentType);
        
        const result = await repository
          .createQueryBuilder()
          .delete()
          .where('executionDate < :cutoffDate', { cutoffDate })
          .execute();
        
        this.logger.log(`${agentType} 表清理了 ${result.affected} 条记录`);
        
      } catch (error) {
        this.logger.error(`清理 ${agentType} 表失败: ${error.message}`);
      }
    }
    
    this.logger.log('数据清理完成');
  }

  /**
   * 获取表大小信息
   */
  async getTableSizes(): Promise<any> {
    const sizes: any = {};
    
    for (const agentType of Object.values(AgentType)) {
      const tableName = this.getTableName(agentType);
      
      try {
        const result = await this.dataSource.query(`
          SELECT 
            table_name,
            ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
            table_rows
          FROM information_schema.tables 
          WHERE table_schema = DATABASE()
          AND table_name = '${tableName}'
        `);
        
        sizes[agentType] = result[0] || {
          table_name: tableName,
          size_mb: 0,
          table_rows: 0
        };
        
      } catch (error) {
        this.logger.warn(`获取 ${tableName} 大小失败: ${error.message}`);
        sizes[agentType] = {
          table_name: tableName,
          size_mb: 0,
          table_rows: 0,
          error: error.message
        };
      }
    }
    
    return sizes;
  }
}