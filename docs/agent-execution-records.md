# 智能体执行记录水平分表系统

## 🎯 系统概述

智能体执行记录系统实现了基于AgentType的水平分表架构，自动记录每次LLM调用的详细执行信息，为系统监控、性能分析和成本管理提供数据支持。

## 🏗️ 架构设计

### 水平分表策略

```
主表概念: agent_execution_records
分表实现: 按AgentType进行水平分表

agent_execution_records_BASIC_DATA_AGENT        # 基础数据智能体记录
agent_execution_records_TECHNICAL_ANALYST       # 技术分析师记录  
agent_execution_records_FUNDAMENTAL_ANALYST     # 基本面分析师记录
agent_execution_records_NEWS_ANALYST            # 新闻分析师记录
agent_execution_records_INDUSTRY_ANALYST        # 行业分析师记录
agent_execution_records_COMPETITIVE_ANALYST     # 竞争分析师记录
agent_execution_records_VALUATION_ANALYST       # 估值分析师记录
agent_execution_records_RISK_ANALYST            # 风险分析师记录
agent_execution_records_UNIFIED_ORCHESTRATOR    # 统一协调器记录
```

### 核心组件

1. **AgentExecutionRecord实体** - 定义记录表结构
2. **AgentExecutionShardingService** - 分表管理服务
3. **AgentExecutionRecordService** - 记录操作服务
4. **AgentExecutionRecorderInterceptor** - 自动记录拦截器

## 📊 记录字段说明

### 基础信息
- `sessionId`: 会话ID，关联同一次分析的所有智能体调用
- `agentType`: 智能体类型（用于分表路由）
- `agentName`: 智能体名称
- `agentRole`: 智能体角色描述

### 执行信息
- `executionDate`: 执行日期
- `startTime`: 开始时间
- `endTime`: 结束时间
- `processingTimeMs`: 处理时长（毫秒）
- `executionStatus`: 执行状态（success/error/timeout）

### LLM调用信息
- `llmModel`: 使用的LLM模型
- `inputPrompt`: 输入提示词
- `inputTokens`: 输入Token数量
- `outputTokens`: 输出Token数量
- `totalTokens`: 总Token数量
- `estimatedCost`: 预估成本（美元）

### 分析结果
- `analysisResult`: 分析结果（原markdown内容）
- `structuredResult`: 结构化结果（JSON格式）
- `score`: 评分（0-100）
- `recommendation`: 交易建议
- `confidence`: 置信度（0-1）
- `keyInsights`: 关键洞察
- `risks`: 风险提示

## 🚀 使用方式

### 1. 自动记录（推荐）

通过拦截器自动记录智能体执行：

```typescript
// 在智能体类上应用拦截器（已在BaseAgent中集成）
@UseInterceptors(AgentExecutionRecorderInterceptor)
export class MyAgent extends BaseAgent {
  async analyze(context: AgentContext): Promise<AgentResult> {
    // 智能体分析逻辑
    // 执行记录会自动保存到对应的分表
  }
}
```

### 2. 手动记录

```typescript
import { AgentExecutionRecordService, CreateAgentExecutionRecordDto } from './services/agent-execution-record.service';

@Injectable()
export class MyService {
  constructor(
    private readonly executionRecordService: AgentExecutionRecordService
  ) {}

  async someMethod() {
    const recordDto: CreateAgentExecutionRecordDto = {
      sessionId: 'session_123',
      agentType: AgentType.BASIC_DATA_AGENT,
      agentName: '基础数据智能体',
      agentRole: '股票基础数据分析',
      stockCode: '000001',
      stockName: '平安银行',
      context: { /* ... */ },
      llmModel: 'qwen-plus',
      inputPrompt: '分析股票000001',
      llmResponse: { /* ... */ },
      result: { /* ... */ },
      startTime: new Date(),
      endTime: new Date(),
    };

    await this.executionRecordService.createExecutionRecord(recordDto);
  }
}
```

### 3. 查询记录

```typescript
// 查询指定智能体类型的记录
const records = await this.executionRecordService.queryExecutionRecords({
  agentTypes: [AgentType.BASIC_DATA_AGENT],
  stockCode: '000001',
  limit: 50
});

// 根据会话ID查询所有相关记录
const sessionRecords = await this.executionRecordService.getRecordsBySessionId('session_123');

// 获取股票分析历史
const history = await this.executionRecordService.getStockAnalysisHistory('000001', AgentType.BASIC_DATA_AGENT);

// 获取执行统计信息
const stats = await this.executionRecordService.getExecutionStats({
  dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
});
```

## 🔧 API接口

### 查询执行记录
```http
POST /api/v1/agents/execution-records/query
{
  "agentTypes": ["BASIC_DATA_AGENT"],
  "stockCode": "000001",
  "dateRange": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "limit": 50
}
```

### 获取会话记录
```http
GET /api/v1/agents/execution-records/session/{sessionId}
```

### 获取股票分析历史
```http
GET /api/v1/agents/execution-records/stock/{stockCode}/history?agentType=BASIC_DATA_AGENT&limit=20
```

### 获取执行统计
```http
POST /api/v1/agents/execution-records/statistics
{
  "dateRange": {
    "start": "2024-01-01T00:00:00Z", 
    "end": "2024-01-31T23:59:59Z"
  }
}
```

### 获取分表统计
```http
GET /api/v1/agents/execution-records/sharding/stats
```

### 获取智能体性能指标
```http
GET /api/v1/agents/execution-records/agent-types/{agentType}/performance?days=30
```

## 📈 监控指标

系统提供丰富的监控指标：

### 执行统计
- 总执行次数
- 成功率
- 平均处理时间
- 平均评分
- 平均成本

### Token使用统计
- 总输入Token
- 总输出Token
- 总Token使用量

### 按智能体类型统计
- 各智能体执行次数
- 各智能体成功率
- 各智能体平均评分
- 各智能体平均处理时间

### 按日期统计
- 每日执行次数分布
- 执行趋势分析

### 交易建议分布
- 强烈买入/买入/持有/卖出/强烈卖出的分布统计

## 🧹 数据管理

### 自动分表创建
系统会自动检测并创建所需的分表：

```http
POST /api/v1/agents/execution-records/create-tables
```

### 过期数据清理
定期清理过期记录以控制存储成本：

```http
POST /api/v1/agents/execution-records/cleanup
{
  "retentionDays": 90
}
```

### 表大小监控
监控各分表的存储使用情况：

```http
GET /api/v1/agents/execution-records/sharding/stats
```

## ⚡ 性能优化

### 索引策略
每个分表都有优化的索引：

```sql
-- 主要查询索引
CREATE INDEX idx_{agentType}_stock_execution ON {tableName} (stockCode, executionDate);
CREATE INDEX idx_{agentType}_session ON {tableName} (sessionId);
CREATE INDEX idx_{agentType}_execution_date ON {tableName} (executionDate);
CREATE INDEX idx_{agentType}_status ON {tableName} (executionStatus);
```

### 查询优化
- 使用分表路由避免全表扫描
- 按日期范围限制查询
- 合理设置查询限制

### 存储优化
- JSON字段压缩存储大型分析结果
- 定期清理过期数据
- 监控表大小增长

## 🚨 注意事项

1. **分表路由**: 所有操作都基于`agentType`进行分表路由，确保正确设置
2. **会话管理**: 同一次分析的所有智能体调用应使用相同的`sessionId`
3. **数据一致性**: 跨表查询时注意数据的时间一致性
4. **存储成本**: 定期清理过期记录，控制存储成本
5. **性能监控**: 监控分表大小和查询性能，必要时进行优化

## 📝 最佳实践

1. **使用拦截器**: 推荐使用`AgentExecutionRecorderInterceptor`自动记录
2. **合理设置保留期**: 根据业务需求设置数据保留期，平衡存储成本和数据需求
3. **监控告警**: 对异常执行率、处理时间等设置监控告警
4. **定期分析**: 定期分析执行记录，优化智能体性能和成本
5. **错误处理**: 记录服务错误不应影响主要业务流程

通过这套完整的执行记录系统，您可以全面监控智能体的执行情况，优化系统性能，控制运营成本。