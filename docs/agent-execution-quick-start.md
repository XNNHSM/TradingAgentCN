# AgentExecutionRecord水平分表系统快速开始

## 🎯 系统概述

智能体执行记录系统已成功实现并通过测试！该系统提供：

- ✅ 按AgentType自动水平分表
- ✅ 每次LLM调用自动记录执行信息
- ✅ 完整的CRUD操作和跨表查询
- ✅ 丰富的统计监控功能
- ✅ 性能优化的索引策略

## 🚀 快速验证

### 1. 运行测试验证
```bash
# 验证核心服务功能
npm test -- --testPathPattern="agent-execution-record.service.spec.ts"

# 编译检查
npx tsc --noEmit
```

### 2. 启动应用验证API
```bash
# 启动开发服务器
npm run start:dev

# 访问API文档
open http://localhost:3000/api-docs
```

### 3. 验证分表创建
```bash
# 创建所有智能体分表
curl -X POST http://localhost:3000/api/v1/agents/execution-records/create-tables

# 查看分表统计
curl -X GET http://localhost:3000/api/v1/agents/execution-records/sharding/stats
```

## 📊 分表映射关系

| 智能体类型 | 分表名 | 职责 |
|-----------|--------|------|
| `BASIC_DATA_AGENT` | `agent_execution_records_BASIC_DATA_AGENT` | 基础数据智能体记录 |
| `TECHNICAL_ANALYST_NEW` | `agent_execution_records_TECHNICAL_ANALYST_NEW` | 技术分析师记录 |
| `FUNDAMENTAL_ANALYST_NEW` | `agent_execution_records_FUNDAMENTAL_ANALYST_NEW` | 基本面分析师记录 |
| `NEWS_ANALYST_NEW` | `agent_execution_records_NEWS_ANALYST_NEW` | 新闻分析师记录 |
| `SOCIAL_MEDIA_ANALYST` | `agent_execution_records_SOCIAL_MEDIA_ANALYST` | 社交媒体分析师记录 |
| `QUANTITATIVE_TRADER` | `agent_execution_records_QUANTITATIVE_TRADER` | 量化交易员记录 |
| `MACRO_ECONOMIST` | `agent_execution_records_MACRO_ECONOMIST` | 宏观经济分析师记录 |
| `POLICY_ANALYST` | `agent_execution_records_POLICY_ANALYST` | 政策分析师记录 |
| `UNIFIED_ORCHESTRATOR` | `agent_execution_records_UNIFIED_ORCHESTRATOR` | 统一协调器记录 |

## 🔧 自动记录机制

### BaseAgent集成
所有智能体继承`BaseAgent`后自动获得执行记录功能：

```typescript
// 智能体执行时自动记录
export class MyAgent extends BaseAgent {
  async analyze(context: AgentContext): Promise<AgentResult> {
    // 智能体分析逻辑
    // 执行记录会自动保存到对应分表：agent_execution_records_{agentType}
    return result;
  }
}
```

### 拦截器支持
`AgentExecutionRecorderInterceptor`提供额外的自动记录支持：

```typescript
@UseInterceptors(AgentExecutionRecorderInterceptor)
@Controller('agents')
export class MyController {
  // 方法执行会自动记录到执行记录表
}
```

## 📈 监控和查询API

### 查询会话记录
```bash
curl -X GET http://localhost:3000/api/v1/agents/execution-records/session/{sessionId}
```

### 获取股票分析历史
```bash
curl -X GET "http://localhost:3000/api/v1/agents/execution-records/stock/000001/history?agentType=BASIC_DATA_AGENT&limit=20"
```

### 获取执行统计
```bash
curl -X POST http://localhost:3000/api/v1/agents/execution-records/statistics \
  -H "Content-Type: application/json" \
  -d '{
    "dateRange": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-31T23:59:59Z"
    }
  }'
```

### 获取智能体性能指标
```bash
curl -X GET "http://localhost:3000/api/v1/agents/execution-records/agent-types/BASIC_DATA_AGENT/performance?days=30"
```

## 💡 使用示例

### 手动创建执行记录
```typescript
import { AgentExecutionRecordService } from './services/agent-execution-record.service';

@Injectable()
export class ExampleService {
  constructor(
    private readonly executionRecordService: AgentExecutionRecordService
  ) {}

  async recordExecution() {
    const record = await this.executionRecordService.createExecutionRecord({
      sessionId: 'session_123',
      agentType: AgentType.BASIC_DATA_AGENT,
      agentName: '基础数据智能体',
      agentRole: '股票基础数据分析',
      stockCode: '000001',
      stockName: '平安银行',
      context: { /* AgentContext */ },
      llmModel: 'qwen-plus',
      inputPrompt: '分析股票000001的基础信息',
      llmResponse: { /* LLMResponse */ },
      result: { /* AgentResult */ },
      startTime: new Date(),
      endTime: new Date(),
    });
    
    console.log('执行记录已保存到分表:', record.id);
  }
}
```

### 查询和统计
```typescript
// 查询特定智能体的记录
const records = await this.executionRecordService.queryExecutionRecords({
  agentTypes: [AgentType.BASIC_DATA_AGENT],
  stockCode: '000001',
  limit: 50
});

// 获取统计信息
const stats = await this.executionRecordService.getExecutionStats({
  dateRange: { 
    start: new Date('2024-01-01'), 
    end: new Date('2024-01-31') 
  }
});

console.log(`总执行次数: ${stats.totalExecutions}`);
console.log(`成功率: ${(stats.successRate * 100).toFixed(1)}%`);
console.log(`平均处理时间: ${stats.avgProcessingTime}ms`);
```

## 🛠️ 维护操作

### 清理过期数据
```bash
curl -X POST http://localhost:3000/api/v1/agents/execution-records/cleanup \
  -H "Content-Type: application/json" \
  -d '{"retentionDays": 90}'
```

### 监控分表大小
```bash
curl -X GET http://localhost:3000/api/v1/agents/execution-records/sharding/stats
```

## 📝 核心文件位置

```
src/agents/
├── entities/agent-execution-record.entity.ts          # 执行记录实体定义
├── services/
│   ├── agent-execution-record.service.ts              # 执行记录业务服务
│   ├── agent-execution-record.service.spec.ts         # 单元测试
│   └── agent-execution-sharding.service.ts            # 分表管理服务
├── interceptors/agent-execution-recorder.interceptor.ts  # 自动记录拦截器
├── controllers/agent-execution-records.controller.ts     # REST API控制器
└── base/base-agent.ts                                    # 基础智能体类（已集成记录功能）
```

## ✅ 验证清单

- [x] 所有TypeScript编译通过
- [x] 单元测试全部通过 (10/10)
- [x] 按AgentType自动分表
- [x] 自动记录LLM执行信息
- [x] 跨表查询功能
- [x] 丰富的监控API
- [x] BaseAgent集成
- [x] 拦截器支持
- [x] 完整的错误处理
- [x] 数据清理功能

## 🎉 总结

智能体执行记录水平分表系统已完全实现并可投入使用！

**核心特性**：
- 🔄 自动按AgentType分表存储
- 📊 自动记录每次LLM调用详情
- 🔍 支持会话、股票、智能体类型等多维度查询
- 📈 提供丰富的执行统计和性能监控
- 🛠️ 完善的数据管理和清理功能

该系统将为您的智能体应用提供全面的执行追踪、性能监控和成本管理支持！