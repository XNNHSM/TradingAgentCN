# 新闻调度器 Temporal 迁移指南

## 概述

本文档描述了将传统的 NestJS Cron 调度器迁移到 Temporal Schedule 的完整过程。这次迁移为新闻爬取系统带来了更强大的分布式工作流管理能力。

## 迁移动机

### 传统 Cron 调度的局限性
- **单机执行**: 无法分布式运行，存在单点故障风险
- **状态难管理**: 缺乏持久化的执行状态跟踪
- **错误难恢复**: 任务失败后缺乏智能重试和补偿机制
- **监控能力有限**: 缺乏可视化的任务执行监控
- **扩展性差**: 难以实现复杂的工作流编排

### Temporal 的优势
- **分布式执行**: 支持多实例部署和负载均衡
- **完整状态追踪**: 持久化记录每个工作流的执行历史
- **自动错误重试**: 内置智能重试策略和故障恢复
- **丰富的监控界面**: Web UI 提供详细的任务监控和调试
- **水平扩展能力**: 支持动态添加 Worker 实例

## 架构设计

### 新架构组件

```
新闻模块 Temporal 架构
├── 工作流层 (Workflows)
│   └── NewsCrawlingWorkflow - 新闻爬取主工作流
├── 活动层 (Activities)  
│   ├── getSupportedSources - 获取支持的新闻源
│   ├── validateDate - 验证日期格式
│   ├── crawlNewsFromSource - 爬取单个数据源
│   └── getWorkflowSummary - 生成执行摘要
├── 服务层 (Services)
│   ├── NewsTemporalClientService - Temporal 客户端管理
│   ├── NewsWorkerService - Temporal Worker 管理
│   └── NewsTemporalSchedulerService - 调度管理服务
└── API层 (Controllers)
    └── NewsController - 新增 Temporal 相关端点
```

### Namespace 和 TaskQueue 规范

按照项目规范，本项目采用以下统一命名：

- **Namespace**: `default` (统一使用 default namespace)
- **TaskQueue**: `news-crawling` (所有环境使用相同的 taskQueue)
- **ScheduleID**: `daily-news-crawling`

## 实现详情

### 1. 工作流实现 (news-crawling.workflow.ts)

```typescript
export async function newsCrawlingWorkflow(
  input: NewsCrawlingWorkflowInput
): Promise<NewsCrawlingWorkflowResult>
```

**核心特性**:
- 支持取消信号处理
- 原子化活动编排
- 错误隔离和重试
- 详细的执行统计

### 2. 活动实现 (news.activities.ts)

**活动列表**:
- `getSupportedSources()` - 获取所有支持的新闻源
- `validateDate(date: string)` - 严格的日期格式验证
- `crawlNewsFromSource(source, date)` - 单源新闻爬取
- `getWorkflowSummary(input)` - 生成执行摘要报告

**重试策略**:
```typescript
retry: {
  initialInterval: '10s',
  maximumInterval: '1m', 
  backoffCoefficient: 2,
  maximumAttempts: 3,
}
```

### 3. 定时调度配置

```typescript
// 每日凌晨1点执行
cronExpression: '0 1 * * *'
timeZone: 'Asia/Shanghai'
```

**调度策略**:
- `ScheduleOverlapPolicy.SKIP` - 避免任务重叠
- `catchupWindow: '1m'` - 1分钟补偿窗口

## API 接口

### 新增的 Temporal 端点

| 端点 | 功能 | 描述 |
|------|------|------|
| `POST /news/temporal/trigger-yesterday` | 手动触发 | 手动启动昨日新闻爬取 |
| `POST /news/temporal/schedule-status` | 调度状态 | 查看定时任务状态 |
| `POST /news/temporal/workflow-result` | 工作流结果 | 获取具体执行结果 |
| `POST /news/temporal/workflow-status` | 工作流状态 | 查看运行状态 |

### 响应格式示例

```json
{
  "code": 0,
  "data": {
    "success": true,
    "workflowId": "manual-news-crawling-2025-08-20-1692345678",
    "message": "手动触发昨日(2025-08-20)新闻爬取任务成功"
  },
  "message": "操作成功",
  "timestamp": "2025-08-21T10:30:00.000Z"
}
```

## 配置管理

### 环境变量

```bash
# Temporal 服务配置
TEMPORAL_HOST=localhost
TEMPORAL_PORT=7233
NODE_ENV=dev  # 影响 namespace 和 taskQueue 命名

# 功能开关
NEWS_SCHEDULER_ENABLED=true          # 启用 Temporal 调度
TEMPORAL_WORKER_ENABLED=true         # 启用 Worker
LEGACY_CRON_SCHEDULER_ENABLED=false  # 禁用传统 Cron
```

## 兼容性策略

### 迁移完成
1. **完全移除传统服务**: 已删除 `NewsSchedulerService` 和相关 Cron 调度代码
2. **清理依赖**: 移除了 `@nestjs/schedule` 依赖包
3. **更新文档**: 更新所有相关文档和示例

### 迁移结果
1. **✅ 完整迁移**: 传统 Cron 调度已完全替换为 Temporal Schedule
2. **✅ 代码清理**: 移除所有废弃代码和依赖
3. **✅ 测试通过**: 所有测试用例运行正常

## 监控和运维

### Web UI 监控
- **访问地址**: http://localhost:8088
- **功能**: 工作流执行历史、失败任务重试、性能指标

### 日志记录
使用 `BusinessLogger` 记录详细的执行日志：
- 工作流启动/完成事件
- 活动执行状态
- 错误和重试信息
- 性能统计数据

### 健康检查
- 检查 Temporal 连接状态
- 监控 Worker 运行状态
- 验证调度任务状态

## 测试策略

### 单元测试
- Mock Temporal 客户端和服务
- 测试工作流和活动逻辑
- 验证错误处理和重试机制

### 集成测试
- 端到端工作流执行
- 调度触发验证
- 故障恢复测试

## 部署指南

### 前置条件
1. **Temporal Server**: 确保 Temporal 服务正在运行
   ```bash
   docker-compose -f docker-compose.temporal.yml up -d
   ```

2. **数据库**: PostgreSQL 和 Redis 服务可用

### 部署步骤
1. **部署应用**:
   ```bash
   npm run build
   npm run start:prod
   ```

2. **验证部署**:
   ```bash
   # 检查调度状态
   curl -X POST http://localhost:3000/news/temporal/schedule-status
   
   # 手动触发测试
   curl -X POST http://localhost:3000/news/temporal/trigger-yesterday
   ```

### 监控验证
- 访问 Temporal Web UI 确认调度创建成功
- 查看应用日志确认 Worker 启动正常
- 验证 API 端点响应正常

## 故障排查

### 常见问题

1. **连接失败**:
   - 检查 `TEMPORAL_HOST` 和 `TEMPORAL_PORT` 配置
   - 确认 Temporal Server 运行状态

2. **Worker 未启动**:
   - 检查 `TEMPORAL_WORKER_ENABLED` 环境变量
   - 查看应用启动日志

3. **调度未创建**:
   - 检查 `NEWS_SCHEDULER_ENABLED` 配置
   - 确认 namespace 权限

### 日志关键字
- `News Temporal Worker 启动成功` - Worker 启动
- `新闻定时调度创建成功` - 调度创建
- `工作流执行结果获取成功` - 任务完成

## 性能优化

### Worker 配置
```typescript
maxConcurrentActivityTaskExecutions: 5  // 活动并发数
maxConcurrentWorkflowTaskExecutions: 2  // 工作流并发数
```

### 资源监控
- 监控 Worker 内存使用
- 跟踪任务执行时间
- 优化重试策略参数

## 未来规划

### 功能扩展
1. **多数据源并行**: 支持数据源并行爬取
2. **智能调度**: 基于历史数据优化调度时间
3. **动态配置**: 支持运行时调度参数调整

### 架构优化
1. **完全移除传统调度**: 清理废弃代码
2. **增强监控**: 集成更多性能指标
3. **多环境支持**: 完善环境隔离机制

## 总结

通过将新闻调度系统迁移到 Temporal，我们实现了：

- ✅ **高可用性**: 分布式执行和故障恢复
- ✅ **可观测性**: 完整的执行历史和监控
- ✅ **可维护性**: 清晰的工作流编排和错误处理
- ✅ **可扩展性**: 支持水平扩展和复杂工作流

这次迁移为后续的系统扩展和优化奠定了坚实的基础。