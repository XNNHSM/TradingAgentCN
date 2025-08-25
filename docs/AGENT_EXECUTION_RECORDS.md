# Agent执行记录系统设计文档

## 🎯 系统概述

本系统为 TradingAgentCN 项目设计了一个完整的 Agent 执行记录存储和分析系统，用于替代原有的 Markdown 输出方式，提供更好的数据持久化、查询和统计分析能力。

### 🏗️ 核心特性

- **数据库持久化**: 替代 Markdown 文件，所有 LLM 调用和结果存储到数据库
- **分表 Sharding**: 按 Agent 类型自动分表，提高查询性能
- **完整记录**: 记录 LLM 调用的完整上下文、响应和执行信息
- **统计分析**: 提供丰富的统计分析和性能监控功能
- **成本追踪**: 记录 Token 使用量和预估成本

## 📊 数据库设计

### 主表结构
```sql
-- 主表作为分表模板
CREATE TABLE agent_execution_records (
  id VARCHAR(36) PRIMARY KEY,
  sessionId VARCHAR(50),           -- 会话ID
  agentType ENUM(...),            -- Agent类型
  agentName VARCHAR(100),         -- Agent名称
  agentRole VARCHAR(200),         -- Agent角色
  stockCode VARCHAR(20),          -- 股票代码
  stockName VARCHAR(100),         -- 股票名称
  executionDate DATETIME,         -- 执行日期
  startTime DATETIME,             -- 开始时间
  endTime DATETIME,               -- 结束时间
  processingTimeMs INT UNSIGNED,   -- 处理时长
  executionStatus ENUM('success', 'error', 'timeout'), -- 执行状态
  
  -- LLM调用信息
  llmModel VARCHAR(50),           -- LLM模型
  inputPrompt TEXT,               -- 输入提示词
  inputTokens INT UNSIGNED,       -- 输入Token数
  outputTokens INT UNSIGNED,      -- 输出Token数
  totalTokens INT UNSIGNED,       -- 总Token数
  estimatedCost DECIMAL(10,6),    -- 预估成本
  
  -- 分析结果
  analysisResult LONGTEXT,        -- 原始分析结果
  structuredResult JSON,          -- 结构化结果
  score TINYINT UNSIGNED,         -- 评分(0-100)
  recommendation ENUM(...),       -- 交易建议
  confidence DECIMAL(3,2),        -- 置信度(0-1)
  keyInsights JSON,               -- 关键洞察
  risks JSON,                     -- 风险提示
  supportingData JSON,            -- 支撑数据
  
  -- 工具调用信息
  toolCalls JSON,                 -- Function calling记录
  toolResults JSON,               -- 工具调用结果
  
  -- 上下文和元数据
  contextData JSON,               -- 上下文数据
  previousResults JSON,           -- 前序Agent结果
  metadata JSON,                  -- 扩展元数据
  errorMessage TEXT,              -- 错误信息
  errorStack TEXT,                -- 错误堆栈
  
  -- 审计字段
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deletedAt DATETIME,             -- 软删除
  version INT DEFAULT 1,          -- 乐观锁
  
  -- 统计字段
  analysisType VARCHAR(50),       -- 分析类型
  userAgent VARCHAR(20),          -- 调用来源
  environment VARCHAR(50)         -- 运行环境
);
```

### 分表策略
```
agent_execution_records_market_analyst     -- 市场分析师
agent_execution_records_fundamental_analyst -- 基本面分析师
agent_execution_records_news_analyst       -- 新闻分析师
agent_execution_records_bull_researcher    -- 多头研究员
agent_execution_records_bear_researcher    -- 空头研究员
... (每个Agent类型一张表)
```

## 🔧 核心组件

### 1. AgentExecutionRecord Entity
```typescript
@Entity('agent_execution_records')
@Index(['stockCode', 'executionDate'])
@Index(['agentType', 'executionDate'])
export class AgentExecutionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column({ type: 'enum', enum: AgentType })
  agentType: AgentType;
  
  // ... 其他字段
}
```

### 2. 分表管理服务
```typescript
@Injectable()
export class AgentExecutionShardingService {
  // 获取指定Agent类型的表名
  getTableName(agentType: AgentType): string
  
  // 获取动态Repository
  async getRepository(agentType: AgentType): Promise<Repository<AgentExecutionRecord>>
  
  // 跨分表查询
  async queryAcrossShards(agentTypes: AgentType[], options): Promise<AgentExecutionRecord[]>
  
  // 创建所有分表
  async createAllShardTables(): Promise<void>
}
```

### 3. 执行记录服务
```typescript
@Injectable() 
export class AgentExecutionRecordService {
  // 创建执行记录
  async createExecutionRecord(dto: CreateAgentExecutionRecordDto): Promise<AgentExecutionRecord>
  
  // 查询执行记录
  async queryExecutionRecords(dto: QueryAgentExecutionRecordDto): Promise<AgentExecutionRecord[]>
  
  // 获取统计数据
  async getExecutionStats(dto: QueryAgentExecutionRecordDto): Promise<AgentExecutionStatsDto>
}
```

### 4. BaseAgent 集成
```typescript
export abstract class BaseAgent {
  constructor(
    // ... 其他参数
    protected readonly executionRecordService?: AgentExecutionRecordService,
  ) {}
  
  async analyze(context: AgentContext): Promise<AgentResult> {
    const startTime = new Date();
    // ... 执行分析逻辑
    
    // 自动记录执行结果
    if (this.executionRecordService) {
      await this.executionRecordService.createExecutionRecord({
        sessionId,
        agentType: this.type,
        // ... 记录完整信息
      });
    }
    
    return result;
  }
}
```

## 🚀 使用方式

### 1. 创建分表
```bash
# 通过API创建所有分表
curl -X POST http://localhost:3000/agent-execution-records/sharding/create-tables
```

### 2. 查询执行记录
```typescript
// 根据会话ID查询
const records = await executionRecordService.getRecordsBySessionId('session_123');

// 根据股票代码查询历史
const history = await executionRecordService.getStockAnalysisHistory('000001', AgentType.MARKET_ANALYST);

// 复杂条件查询
const results = await executionRecordService.queryExecutionRecords({
  agentTypes: [AgentType.MARKET_ANALYST, AgentType.FUNDAMENTAL_ANALYST],
  stockCode: '000001',
  dateRange: {
    start: new Date('2025-08-01'),
    end: new Date('2025-08-20')
  },
  executionStatus: 'success',
  minScore: 80
});
```

### 3. 获取统计数据
```typescript
// 获取性能统计
const stats = await executionRecordService.getExecutionStats({
  dateRange: {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前
    end: new Date()
  }
});

console.log('成功率:', stats.successRate);
console.log('平均处理时间:', stats.avgProcessingTime);
console.log('Token使用量:', stats.tokenUsage.totalTokens);
console.log('预估成本:', stats.avgCost);
```

### 4. API接口示例
```bash
# 查询执行记录
curl -X POST http://localhost:3000/agent-execution-records/query \
  -H "Content-Type: application/json" \
  -d '{
    "stockCode": "000001",
    "agentTypes": ["market_analyst"],
    "dateRange": {
      "start": "2025-08-01T00:00:00Z",
      "end": "2025-08-20T23:59:59Z"
    },
    "limit": 50
  }'

# 获取性能报告
curl -X GET "http://localhost:3000/agent-execution-records/performance/report?days=7"

# 获取分表信息
curl -X GET http://localhost:3000/agent-execution-records/sharding/info
```

## 📈 统计分析功能

### 1. 基础统计
- 总执行次数
- 成功率
- 平均处理时间
- 平均评分
- Token使用量和成本

### 2. 按Agent类型统计
- 每个Agent类型的执行次数
- 各Agent类型的成功率和性能
- 各Agent类型的平均评分

### 3. 时间趋势分析
- 按日期统计执行次数
- 性能趋势变化
- 成本趋势分析

### 4. 交易建议分析
- 各类建议的分布统计
- 建议准确性分析（可结合后续实际收益）

## 🔍 性能优化

### 1. 索引策略
```sql
-- 主要索引
CREATE INDEX idx_stock_execution ON table_name (stock_code, execution_date);
CREATE INDEX idx_agent_execution ON table_name (agent_type, execution_date);  
CREATE INDEX idx_session ON table_name (session_id);
CREATE INDEX idx_status ON table_name (execution_status);
```

### 2. 分表优势
- **查询性能**: 单表数据量减少，查询速度提升
- **并发性能**: 减少锁竞争，提高并发处理能力
- **维护便利**: 可以独立维护各Agent类型的数据

### 3. 数据清理
```typescript
// 定期清理过期数据
await shardingService.cleanupOldRecords(90); // 清理90天前的数据
```

## 🛡️ 错误处理和监控

### 1. 错误记录
- 完整的错误信息和堆栈记录
- 执行状态标记（success/error/timeout）
- 失败原因分类和统计

### 2. 监控指标
- 实时成功率监控
- 响应时间监控 
- Token使用量监控
- 成本预警

### 3. 数据一致性
- 乐观锁防止并发更新冲突
- 软删除保留历史数据
- 审计字段记录完整生命周期

## 🎉 系统优势

### vs 原有 Markdown 方式

| 特性 | Markdown | 数据库记录 |
|------|----------|------------|
| 存储方式 | 文件系统 | 关系数据库 |
| 查询能力 | 文件搜索 | 结构化SQL查询 |
| 统计分析 | 手工处理 | 自动统计分析 |
| 并发安全 | 文件锁 | 数据库事务 |
| 扩展性 | 有限 | 高度可扩展 |
| 数据完整性 | 依赖文件 | ACID保证 |
| 成本追踪 | 无 | 完整记录 |
| 性能监控 | 无 | 实时监控 |

### 业务价值
- **决策支持**: 基于历史数据优化Agent配置
- **成本控制**: 精确的Token使用和成本分析
- **质量提升**: 通过统计发现和改进问题
- **合规审计**: 完整的执行日志满足审计需求

## 🔮 未来扩展

1. **实时仪表板**: Agent执行情况实时可视化
2. **智能告警**: 异常检测和自动告警
3. **A/B测试**: 不同Agent配置的效果对比
4. **机器学习**: 基于历史数据优化Agent参数
5. **多维分析**: 更丰富的统计分析维度

这个设计实现了从简单的Markdown输出到专业数据库存储系统的升级，为TradingAgentCN项目提供了强大的数据管理和分析能力。