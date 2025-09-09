# Temporal 新闻爬取 API 使用指南

## 概述

新闻爬取系统已全面升级到使用 Temporal 工作流执行，提供更好的容错性、监控能力和任务管理功能。

## API 接口

### 1. 启动新闻爬取任务 (Temporal 工作流)

**接口**: `POST /api/v1/news/crawl`

**功能**: 使用 Temporal 工作流启动基于日期范围的新闻爬取任务

**请求体**:
```json
{
  "startDate": "2025-08-20",
  "endDate": "2025-08-22",
  "sources": ["xwlb"]  // 可选，不传则爬取所有支持的数据源
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "success": true,
    "workflowId": "range-news-crawling-2025-08-20-to-2025-08-22-1724598123456",
    "message": "成功启动 3 个日期的新闻爬取工作流 (2025-08-20 至 2025-08-22)"
  },
  "message": "操作成功",
  "timestamp": "2025-08-25T12:00:00.000Z"
}
```

**特点**:
- ✅ 支持日期范围爬取（最多30天）
- ✅ 每个日期启动独立的工作流，并发执行
- ✅ 提供完整的容错和重试机制
- ✅ 可通过 Temporal UI 监控执行状态

### 2. 查看日期范围爬取进度

**接口**: `POST /api/v1/news/temporal/range-crawl-progress`

**功能**: 查看整个日期范围爬取的进度和各日期详细状态

**请求体**:
```json
{
  "mainWorkflowId": "range-news-crawling-2025-08-20-to-2025-08-22-1724598123456"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "mainWorkflowId": "range-news-crawling-2025-08-20-to-2025-08-22-1724598123456",
    "totalDays": 3,
    "completedDays": 2,
    "runningDays": 1,
    "failedDays": 0,
    "overallProgress": 67,
    "dailyStatus": [
      {
        "date": "2025-08-20",
        "workflowId": "range-news-crawling-2025-08-20-to-2025-08-22-1724598123456-2025-08-20",
        "status": "COMPLETED",
        "startTime": "2025-08-25T01:00:00.000Z",
        "endTime": "2025-08-25T01:05:23.000Z"
      },
      {
        "date": "2025-08-21",
        "workflowId": "range-news-crawling-2025-08-20-to-2025-08-22-1724598123456-2025-08-21",
        "status": "COMPLETED",
        "startTime": "2025-08-25T01:00:00.000Z",
        "endTime": "2025-08-25T01:04:15.000Z"
      },
      {
        "date": "2025-08-22",
        "workflowId": "range-news-crawling-2025-08-20-to-2025-08-22-1724598123456-2025-08-22",
        "status": "RUNNING",
        "startTime": "2025-08-25T01:00:00.000Z",
        "endTime": null
      }
    ],
    "summary": "总计 3 天, 已完成 2 天, 运行中 1 天, 失败 0 天, 进度 67%"
  },
  "message": "操作成功",
  "timestamp": "2025-08-25T12:15:00.000Z"
}
```

### 3. 获取单个工作流详细结果

**接口**: `POST /api/v1/news/temporal/workflow-result`

**功能**: 查看单个日期工作流的详细执行结果

**请求体**:
```json
{
  "workflowId": "range-news-crawling-2025-08-20-to-2025-08-22-1724598123456-2025-08-20"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "success": true,
    "date": "2025-08-20",
    "totalCrawled": 15,
    "successSources": 1,
    "failedSources": 0,
    "results": {
      "xwlb": 15
    },
    "duration": "5m23s",
    "message": "新闻爬取任务完成 (2025-08-20) | 执行时间: 5m23s | 总爬取新闻: 15条 | 成功数据源: 1/1 (100%) | 详细结果: xwlb: 15条"
  },
  "message": "操作成功",
  "timestamp": "2025-08-25T12:20:00.000Z"
}
```

### 4. 其他现有接口

- `POST /api/v1/news/temporal/trigger-yesterday`: 手动触发昨日新闻爬取
- `POST /api/v1/news/temporal/schedule-status`: 查看定时任务状态
- `POST /api/v1/news/temporal/workflow-status`: 查看工作流状态
- `POST /api/v1/news/supported-sources`: 获取支持的数据源

## 工作流架构

### 三层工作流设计

```
主工作流 (Range Crawl) 
├── 日期1 工作流 (News Crawling)
│   ├── 数据源1 子工作流 (Single Source)
│   │   ├── 获取新闻链接 Activity
│   │   ├── 新闻内容处理 子工作流 (Content Processing)
│   │   │   ├── 爬取内容 Activity
│   │   │   ├── 保存数据 Activity
│   │   │   ├── 生成摘要 Activity
│   │   │   └── 保存摘要 Activity
│   │   └── ...
│   └── 数据源2 子工作流
├── 日期2 工作流
└── 日期3 工作流
```

### 关键特性

1. **并发执行**: 多个日期的工作流并发运行，提高效率
2. **错误隔离**: 单个日期或数据源失败不影响其他任务
3. **细粒度控制**: 每个步骤都是独立的 Activity，支持精确的重试和监控
4. **状态透明**: 完整的执行状态和进度跟踪
5. **容量限制**: 最多支持30天的日期范围，避免资源过载

## 使用示例

### 爬取单日新闻

```bash
curl -X POST http://localhost:3000/api/v1/news/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-08-25",
    "endDate": "2025-08-25",
    "sources": ["xwlb"]
  }'
```

### 爬取一周新闻

```bash
curl -X POST http://localhost:3000/api/v1/news/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-08-19",
    "endDate": "2025-08-25"
  }'
```

### 查看爬取进度

```bash
curl -X POST http://localhost:3000/api/v1/news/temporal/range-crawl-progress \
  -H "Content-Type: application/json" \
  -d '{
    "mainWorkflowId": "range-news-crawling-2025-08-19-to-2025-08-25-1724598123456"
  }'
```

## 监控和调试

### Temporal Web UI

访问 http://localhost:8088 查看：
- 工作流执行状态
- 活动执行历史
- 错误信息和堆栈
- 执行时间和性能统计

### 命名规则

- **主工作流ID**: `range-news-crawling-{startDate}-to-{endDate}-{timestamp}`
- **日期工作流ID**: `{mainWorkflowId}-{date}`
- **TaskQueue**: `news-crawling` (统一命名，不做环境区分)

## 注意事项

1. **日期格式**: 使用 `YYYY-MM-dd` 格式 (如: 2025-08-25)
2. **日期范围限制**: 最多支持30天的连续日期范围
3. **资源消耗**: 大范围爬取会启动多个并发工作流，注意服务器资源
4. **数据源**: 当前支持 `xwlb` (新闻联播)，后续可扩展更多数据源
5. **重复执行**: 系统会自动去重，重复执行安全

## 故障处理

如果工作流执行失败：

1. **查看状态**: 使用 `workflow-status` 接口查看具体错误
2. **查看日志**: 检查应用程序日志获取详细错误信息
3. **Temporal UI**: 在 Web UI 中查看工作流执行历史和错误堆栈
4. **重新执行**: 可以使用相同参数重新调用 `/crawl` 接口，系统会自动去重