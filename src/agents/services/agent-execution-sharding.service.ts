import {Injectable, Logger} from '@nestjs/common';
import {InjectDataSource} from '@nestjs/typeorm';
import {DataSource, Repository} from 'typeorm';
import {AgentType} from '../interfaces/agent.interface';
import {AgentExecutionRecord} from '../entities/agent-execution-record.entity';

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
    
    // 使用QueryBuilder方式操作指定表，而不是修改元数据
    const baseRepository = this.dataSource.getRepository(AgentExecutionRecord);
    
    // 创建一个包装的Repository，重写save等方法来指定正确的表名
    const wrappedRepository = {
      ...baseRepository,
      
      save: async (entity: AgentExecutionRecord | AgentExecutionRecord[]): Promise<AgentExecutionRecord | AgentExecutionRecord[]> => {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        
        try {
          if (Array.isArray(entity)) {
            const results: AgentExecutionRecord[] = [];
            for (const e of entity) {
              const result = await this.saveToTable(queryRunner, tableName, e);
              results.push(result);
            }
            return results;
          } else {
            return await this.saveToTable(queryRunner, tableName, entity);
          }
        } finally {
          await queryRunner.release();
        }
      },
      
      update: async (criteria: any, partialEntity: any): Promise<any> => {
        return await this.dataSource
          .createQueryBuilder()
          .update(tableName)
          .set(partialEntity)
          .where(criteria)
          .execute();
      },
      
      findOne: async (options: any): Promise<AgentExecutionRecord | null> => {
        const result = await this.dataSource
          .createQueryBuilder(AgentExecutionRecord, 'record')
          .from(tableName, 'record')
          .where(options.where || {})
          .getOne();
        return result as AgentExecutionRecord | null;
      },
      
      find: async (options: any = {}): Promise<AgentExecutionRecord[]> => {
        const results = await this.dataSource
          .createQueryBuilder(AgentExecutionRecord, 'record')
          .from(tableName, 'record')
          .where(options.where || {})
          .limit(options.take)
          .offset(options.skip)
          .getMany();
        return results as AgentExecutionRecord[];
      }
    } as Repository<AgentExecutionRecord>;
    
    this.repositoryCache.set(tableName, wrappedRepository);
    return wrappedRepository;
  }

  /**
   * 保存记录到指定表
   */
  private async saveToTable(queryRunner: any, tableName: string, entity: AgentExecutionRecord): Promise<AgentExecutionRecord> {
    const fields = [
      'sessionId', 'agentType', 'agentName', 'agentRole', 'stockCode', 'stockName',
      'executionDate', 'startTime', 'endTime', 'processingTimeMs', 'executionStatus',
      'llmModel', 'inputPrompt', 'inputTokens', 'outputTokens', 'totalTokens', 'estimatedCost',
      'analysisResult', 'structuredResult', 'score', 'recommendation', 'confidence',
      'keyInsights', 'risks', 'supportingData', 'toolCalls', 'toolResults',
      'contextData', 'previousResults', 'metadata', 'errorMessage', 'errorStack',
      'analysisType', 'userAgent', 'environment', 'createdAt', 'updatedAt'
    ];
    
    // JSON字段列表，需要序列化处理
    const jsonFields = [
      'structuredResult', 'keyInsights', 'risks', 'supportingData', 
      'toolCalls', 'toolResults', 'contextData', 'previousResults', 'metadata'
    ];
    
    const values = fields.map(field => {
      let value = entity[field];
      
      // 处理undefined值
      if (value === undefined) {
        // 对于时间字段，如果未设置则使用当前时间
        if (field === 'createdAt' || field === 'updatedAt') {
          return new Date();
        }
        return null;
      }
      
      // 对JSON字段进行序列化
      if (jsonFields.includes(field) && value !== null) {
        try {
          return JSON.stringify(value);
        } catch (error) {
          this.logger.warn(`序列化JSON字段${field}失败: ${error.message}`);
          return null;
        }
      }
      
      return value;
    });
    
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
    const fieldNames = fields.map(f => `"${f}"`).join(', ');
    
    const insertSQL = `
      INSERT INTO ${tableName} (${fieldNames})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await queryRunner.query(insertSQL, values);
    return result[0] as AgentExecutionRecord;
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
        
        // 创建分表SQL(PostgreSQL不支持LIKE语法，需要手动创建)
        const createTableSQL = `
          CREATE TABLE ${tableName} (
            id SERIAL PRIMARY KEY,
            "sessionId" VARCHAR(50) NOT NULL,
            "agentType" VARCHAR(50) NOT NULL,
            "agentName" VARCHAR(100) NOT NULL,
            "agentRole" VARCHAR(200) NOT NULL,
            "stockCode" VARCHAR(20) NOT NULL,
            "stockName" VARCHAR(100),
            "executionDate" TIMESTAMP NOT NULL,
            "startTime" TIMESTAMP NOT NULL,
            "endTime" TIMESTAMP NOT NULL,
            "processingTimeMs" INTEGER NOT NULL,
            "executionStatus" VARCHAR(20) DEFAULT 'success',
            "llmModel" VARCHAR(50) NOT NULL,
            "inputPrompt" TEXT NOT NULL,
            "inputTokens" INTEGER,
            "outputTokens" INTEGER,
            "totalTokens" INTEGER,
            "estimatedCost" DECIMAL(10,6),
            "analysisResult" TEXT NOT NULL,
            "structuredResult" JSONB,
            "score" SMALLINT,
            "recommendation" VARCHAR(20),
            "confidence" DECIMAL(3,2),
            "keyInsights" JSONB,
            "risks" JSONB,
            "supportingData" JSONB,
            "toolCalls" JSONB,
            "toolResults" JSONB,
            "contextData" JSONB,
            "previousResults" JSONB,
            "metadata" JSONB,
            "errorMessage" TEXT,
            "errorStack" TEXT,
            "analysisType" VARCHAR(50),
            "userAgent" VARCHAR(20),
            "environment" VARCHAR(50),
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "deletedAt" TIMESTAMP,
            "version" INTEGER DEFAULT 1
          );
        `;
        
        await queryRunner.query(createTableSQL);
        
        // 创建分表特定的索引 (修正PostgreSQL列名)
        const indexSQL = [
          `CREATE INDEX idx_${agentType}_stock_execution ON ${tableName} ("stockCode", "executionDate");`,
          `CREATE INDEX idx_${agentType}_session ON ${tableName} ("sessionId");`,
          `CREATE INDEX idx_${agentType}_execution_date ON ${tableName} ("executionDate");`,
          `CREATE INDEX idx_${agentType}_status ON ${tableName} ("executionStatus");`,
          `CREATE INDEX idx_${agentType}_agent_type ON ${tableName} ("agentType");`,
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