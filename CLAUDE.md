# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 🏗️ 系统架构概述

TradingAgentCN 是一个基于大语言模型(LLM)的智能交易决策系统，专门针对中国A股市场设计。系统采用全新的MCP(Model Context Protocol)架构，通过统一的智能体协作、阿里云百炼数据获取和先进的分析算法，为投资者提供专业的交易建议和风险评估。

### 技术栈
- **后端框架**: NestJS + TypeScript + TypeORM
- **数据获取协议**: 阿里云百炼MCP (Model Context Protocol)
- **主要LLM**: 阿里云百炼(DashScope) - qwen-plus/qwen-max
- **数据库**: PostgreSQL + Redis
- **工作流引擎**: Temporal - 分布式工作流协调和状态管理
- **部署方案**: Docker 容器化

### 新一代MCP + Temporal架构
```
API接口层 → NestJS服务层 → Temporal工作流引擎 → 统一智能体服务 → MCP客户端 → 阿里云百炼MCP → 股票数据服务
```

### 核心组件
1. **自选股管理**: 股票选择、持仓跟踪
2. **统一智能体引擎**: 综合分析师 + 交易策略师 (取代原8个智能体)
3. **MCP数据获取**: 通过阿里云百炼MCP协议获取实时股票数据
4. **智能决策**: 综合技术面、基本面、消息面的一体化分析
5. **Temporal工作流**: 分布式任务调度、状态管理和容错处理

## 🚀 开发命令

### 构建和启动
```bash
# 构建应用
npm run build

# 开发模式(热重载)
npm run start:dev

# 调试模式
npm run start:debug

# 生产模式
npm run start:prod
```

### 测试
```bash
# 运行所有测试
npm run test

# 监听模式运行测试
npm run test:watch

# 运行测试并生成覆盖率报告
npm run test:cov

# 运行端到端测试
npm run test:e2e

# 调试测试
npm run test:debug
```

### 代码质量
```bash
# ESLint 检查和自动修复
npm run lint

# Prettier 代码格式化
npm run format
```

### MCP智能体测试 (重要)
```bash
# 运行MCP集成测试
npm test -- src/agents/unified/mcp-integration.spec.ts

# 运行MCP客户端服务测试
npm test -- src/agents/services/mcp-client.service.spec.ts

# 运行综合分析师测试
npm test -- src/agents/unified/comprehensive-analyst.agent.spec.ts

# 运行基础智能体测试
npm test -- src/agents/base/base-agent.spec.ts

# 运行LLM服务测试
npm test -- src/agents/services/llm.service.spec.ts

# 运行Temporal客户端测试
npm test -- src/agents/temporal/agents-temporal-client.service.spec.ts

# 运行新闻 Temporal 调度测试
npm test -- src/modules/news/temporal/news-temporal-scheduler.service.spec.ts

# 运行新闻摘要实体测试
npm test -- src/modules/news/entities/news-summary.entity.spec.ts
```

⚠️ **MCP测试重要说明**:
- **MCP协议**: 测试使用阿里云百炼MCP协议获取股票数据
- **API密钥要求**: 需要配置有效的 `DASHSCOPE_API_KEY` 才能运行完整测试
- **网络依赖**: 测试依赖阿里云百炼MCP服务 (https://dashscope.aliyuncs.com/api/v1/mcps/qtf_mcp)
- **模拟数据**: MCP客户端在测试环境中使用模拟数据，保证测试稳定性
- **Temporal配置**: 统一使用 `default` 命名空间，简化Temporal配置管理
- **日期格式**: 统一使用 `YYYY-MM-dd` 格式 (如: 2025-08-16)
- **时间格式**: 统一使用 `YYYY-MM-dd HH:mm:ss` 格式 (如: 2025-08-16 14:30:25)

### 数据库管理
```bash
# 生成数据库迁移文件
npm run migration:generate

# 执行数据库迁移
npm run migration:run

# 回滚数据库迁移
npm run migration:revert
```

### Docker 部署
```bash
# 使用默认配置启动
docker-compose up -d

# 使用环境变量自定义配置
cp .env.example .env
# 编辑 .env 文件设置数据库密码等
docker-compose up -d

# 使用命令行环境变量
POSTGRES_PASSWORD=myPassword REDIS_PASSWORD=myRedisPass docker-compose up -d

# 修改应用服务端口
APP_PORT=8080 docker-compose up -d

# 启动Redis管理界面
docker-compose --profile redis-ui up -d

# 手动构建 Docker 镜像
docker build -t trading-agent-cn .
```

### Temporal 工作流管理
```bash
# 启动 Temporal 服务集群
docker-compose up temporal -d

# 查看 Temporal Web UI (默认端口 8088)
open http://localhost:8088

# 查看 Temporal 服务状态
docker-compose ps temporal temporal-admin-tools

# 重启 Temporal 服务
docker-compose restart temporal

# 查看 Temporal 日志
docker-compose logs -f temporal
```

## 📁 项目结构

```
├── docs/                   # 文档目录
│   └── temporal-best-practices.md  # Temporal最佳实践指南
src/
├── agents/                 # MCP智能体模块
│   ├── base/              # 智能体基础类
│   ├── entities/          # 智能体实体定义
│   ├── execution-records/ # 执行记录管理
│   ├── interfaces/        # 智能体接口定义
│   ├── services/          # 核心服务
│   │   ├── mcp-client.service.ts     # MCP客户端服务
│   │   ├── llm.service.ts            # LLM服务
│   │   └── llm-adapters/             # LLM适配器
│   ├── unified/           # 统一智能体架构
│   │   ├── comprehensive-analyst.agent.ts  # 综合分析师
│   │   ├── trading-strategist.agent.ts     # 交易策略师
│   │   └── unified-orchestrator.service.ts # 统一协调服务
│   └── agents.module.ts   # 智能体模块配置
├── app.module.ts          # 主应用模块
├── main.ts               # 应用入口点
├── common/               # 公共工具和组件
│   ├── decorators/       # 自定义装饰器
│   ├── dto/             # 数据传输对象
│   │   └── result.dto.ts # 统一响应格式
│   ├── entities/        # 基础实体类
│   │   └── base.entity.ts # 通用字段基础实体
│   ├── enums/           # 枚举定义
│   ├── filters/         # 异常过滤器
│   ├── guards/          # 认证/授权守卫
│   ├── interceptors/    # 请求/响应拦截器
│   ├── pipes/           # 验证管道
│   └── utils/           # 工具函数
├── config/              # 配置文件
│   ├── database.config.ts # 数据库配置
│   └── redis.config.ts   # Redis配置
└── modules/             # 业务模块
    ├── health/          # 健康检查模块
    │   ├── health.controller.ts
    │   ├── health.module.ts
    │   └── health.service.ts
    ├── news/            # 新闻爬虫模块
    │   ├── crawlers/    # 爬虫服务实现
    │   │   └── xwlb-crawler.service.ts  # 新闻联播爬虫
    │   ├── dto/         # 新闻相关DTOs
    │   ├── entities/    # 新闻实体类
    │   │   ├── raw-news.entity.ts      # 原始新闻数据实体
    │   │   └── news-summary.entity.ts  # 新闻摘要实体
    │   ├── factories/   # 爬虫工厂
    │   ├── interfaces/  # 爬虫接口定义
    │   ├── services/    # 新闻相关服务
    │   │   └── news-temporal-scheduler.service.ts # Temporal 新闻调度服务
    │   ├── temporal/    # Temporal 工作流
    │   │   ├── news-crawling.workflow.ts         # 新闻爬取工作流
    │   │   ├── news.activities.ts               # 新闻爬取活动
    │   │   ├── news-temporal-client.service.ts  # Temporal 客户端
    │   │   └── news-worker.service.ts           # Temporal Worker
    │   ├── news.controller.ts
    │   ├── news.module.ts
    │   └── news.service.ts
    ├── user/            # 用户管理(待实现)
    └── watchlist/       # 自选股管理
        ├── dto/         # 自选股DTOs
        ├── entities/    # 自选股实体
        ├── watchlist.controller.ts
        ├── watchlist.module.ts
        └── watchlist.service.ts
```

## 🔄 Temporal 工作流架构

### Temporal 设计原则
本工程使用 **Temporal** 作为分布式工作流协调引擎，遵循以下原则:

- **所有工作流(Workflow)通过 Orchestrator 进行维护**
- **每个业务服务(Service)提供原子化的方法，作为活动(Activity)**
- **工作流负责协调，活动负责执行具体业务逻辑**
- **通过 Temporal 实现状态管理、错误重试和故障恢复**

### 工作流组织架构
```
workflows/                    # Temporal 工作流定义
├── orchestrators/            # 工作流协调器
│   ├── stock-analysis.workflow.ts        # 股票分析工作流
│   ├── news-crawling.workflow.ts         # 新闻爬取工作流
│   ├── daily-report.workflow.ts          # 每日报告生成工作流
│   └── portfolio-monitoring.workflow.ts  # 投资组合监控工作流
├── activities/               # 业务活动定义
│   ├── stock.activities.ts               # 股票相关活动
│   ├── news.activities.ts                # 新闻相关活动
│   ├── analysis.activities.ts            # 分析相关活动
│   ├── notification.activities.ts        # 通知相关活动
│   └── data-collection.activities.ts     # 数据收集活动
└── temporal/                 # Temporal 配置和客户端
    ├── client.ts             # Temporal 客户端配置
    ├── worker.ts             # Temporal Worker 配置
    └── types.ts              # 工作流和活动类型定义
```

### 核心工作流示例

#### 1. 股票分析工作流 (Stock Analysis Workflow)
```typescript
// workflows/orchestrators/stock-analysis.workflow.ts
@Workflow()
export class StockAnalysisWorkflow {
  @WorkflowMethod()
  async executeStockAnalysis(input: StockAnalysisInput): Promise<StockAnalysisResult> {
    // 1. 数据收集活动
    const marketData = await proxyActivities<DataCollectionActivities>({
      startToCloseTimeout: '5m'
    }).collectStockData(input.stockCode);
    
    // 2. 技术分析活动
    const technicalAnalysis = await proxyActivities<AnalysisActivities>({
      startToCloseTimeout: '3m'
    }).performTechnicalAnalysis(marketData);
    
    // 3. 基本面分析活动
    const fundamentalAnalysis = await proxyActivities<AnalysisActivities>({
      startToCloseTimeout: '3m'
    }).performFundamentalAnalysis(marketData);
    
    // 4. 综合决策活动
    const finalDecision = await proxyActivities<AnalysisActivities>({
      startToCloseTimeout: '2m'
    }).generateTradingDecision(technicalAnalysis, fundamentalAnalysis);
    
    // 5. 结果通知活动
    await proxyActivities<NotificationActivities>({
      startToCloseTimeout: '1m'
    }).sendAnalysisResult(finalDecision);
    
    return finalDecision;
  }
}
```

#### 2. 活动实现示例 (Activities Implementation)
```typescript
// workflows/activities/stock.activities.ts
export interface StockActivities {
  validateStockCode(stockCode: string): Promise<boolean>;
  fetchStockPrice(stockCode: string): Promise<StockPrice>;
  calculateTechnicalIndicators(priceData: StockPrice[]): Promise<TechnicalIndicators>;
}

@Injectable()
export class StockActivitiesImpl implements StockActivities {
  constructor(
    private readonly mcpClientService: McpClientService,
    private readonly businessLogger: BusinessLogger
  ) {}
  
  @Activity()
  async validateStockCode(stockCode: string): Promise<boolean> {
    // 原子化操作: 股票代码验证
    return await this.mcpClientService.validateStock(stockCode);
  }
  
  @Activity()
  async fetchStockPrice(stockCode: string): Promise<StockPrice> {
    // 原子化操作: 获取股票价格
    return await this.mcpClientService.getStockRealtimeData(stockCode);
  }
  
  @Activity()
  async calculateTechnicalIndicators(priceData: StockPrice[]): Promise<TechnicalIndicators> {
    // 原子化操作: 计算技术指标
    return await this.analysisService.calculateIndicators(priceData);
  }
}
```

### Temporal 集成规范

#### 1. Namespace 命名规范 ⭐
**命名规则**: `{模块名}-{环境}`

**环境标识**:
- `dev`: 开发环境
- `test`: 测试环境  
- `stg`: 预发布环境
- `prd`: 生产环境

**示例**:
```bash
# 新闻模块
news-dev        # 新闻模块开发环境
news-test       # 新闻模块测试环境
news-prd        # 新闻模块生产环境

# 智能体模块
agents-dev      # 智能体模块开发环境
agents-prd      # 智能体模块生产环境

# 自选股模块
watchlist-dev   # 自选股模块开发环境
watchlist-prd   # 自选股模块生产环境

# 分析模块
analysis-dev    # 分析模块开发环境
analysis-prd    # 分析模块生产环境
```

**Namespace 配置示例**:
```typescript
// 在各模块的 Temporal 客户端中
const client = new Client({
  connection,
  namespace: `${MODULE_NAME}-${NODE_ENV}`, // 如: 'news-dev'
});
```

#### 2. TaskQueue 命名规范 ⭐
**命名规则**: `{模块名}-{业务域}-{环境}`

**规范说明**:
- 🚫 **不使用全局配置**: 移除 `TEMPORAL_TASK_QUEUE` 环境变量
- ✅ **模块自定义**: 每个业务模块自行定义 taskQueue 名称
- ✅ **业务隔离**: 不同业务使用不同的 taskQueue
- ✅ **环境隔离**: 不同环境使用不同的 taskQueue

**TaskQueue 命名示例**:
```bash
# 新闻模块
news-crawling-dev       # 新闻爬取任务队列(开发环境)
news-processing-dev     # 新闻处理任务队列(开发环境)
news-crawling-prd       # 新闻爬取任务队列(生产环境)

# 智能体模块
agents-analysis-dev     # 股票分析任务队列(开发环境)
agents-batch-dev        # 批量分析任务队列(开发环境)
agents-analysis-prd     # 股票分析任务队列(生产环境)

# 自选股模块
watchlist-monitoring-dev    # 自选股监控任务队列(开发环境)
watchlist-alerts-dev        # 自选股提醒任务队列(开发环境)

# 分析模块
analysis-reports-dev    # 分析报告任务队列(开发环境)
analysis-alerts-dev     # 分析提醒任务队列(开发环境)
```

**TaskQueue 使用示例**:
```typescript
// 在工作流启动时指定 taskQueue
const handle = await client.workflow.start(stockAnalysisWorkflow, {
  taskQueue: `agents-analysis-${NODE_ENV}`,  // agents-analysis-dev
  workflowId: `stock-analysis-${stockCode}-${Date.now()}`,
  args: [{ stockCode, metadata }],
});

// Worker 监听特定的 taskQueue
const worker = await Worker.create({
  workflowsPath: require.resolve('./workflows'),
  activities,
  taskQueue: `news-crawling-${NODE_ENV}`,   // news-crawling-dev
});
```

#### 3. TaskQueue 最佳实践规范

**🎯 队列粒度划分**:
- **按业务功能划分**: 不同业务功能使用独立队列
- **按执行特性划分**: CPU密集型 vs IO密集型任务分离
- **按优先级划分**: 高优先级任务使用专门队列

**⚡ 性能优化策略**:
```typescript
// 高并发队列配置
const highThroughputWorker = await Worker.create({
  taskQueue: 'agents-batch-prd',
  maxConcurrentActivityTaskExecutions: 20,
  maxConcurrentWorkflowTaskExecutions: 10,
});

// CPU密集型队列配置  
const computeIntensiveWorker = await Worker.create({
  taskQueue: 'analysis-compute-prd',
  maxConcurrentActivityTaskExecutions: 4,  // 限制并发
});

// IO密集型队列配置
const ioIntensiveWorker = await Worker.create({
  taskQueue: 'news-crawling-prd', 
  maxConcurrentActivityTaskExecutions: 50, // 高并发
});
```

**📊 监控和报警**:
```typescript
// 队列监控指标
interface TaskQueueMetrics {
  queueName: string;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
}

// 队列健康检查
export class TaskQueueHealthCheck {
  async checkQueueHealth(queueName: string): Promise<QueueHealth> {
    // 检查队列积压情况
    // 检查Worker连接状态 
    // 检查任务执行成功率
  }
}
```

#### 4. 工作流设计原则
- **单一职责**: 每个工作流专注于一个业务场景
- **原子活动**: 每个活动(Activity)执行单一、原子化的业务操作
- **无状态**: 活动应该是无状态的，所有状态由工作流管理
- **容错性**: 通过重试策略和补偿机制处理失败

#### 2. 活动(Activity)规范
- **服务注入**: 通过依赖注入获取业务服务
- **错误处理**: 抛出明确的业务异常，由工作流处理重试逻辑
- **超时配置**: 每个活动设置合适的超时时间
- **日志记录**: 使用 BusinessLogger 记录活动执行状态

#### 3. 工作流调度策略
- **定时触发**: 使用 Temporal 的定时器功能替代传统 Cron 任务
- **事件驱动**: 支持外部事件触发工作流执行
- **并发控制**: 通过工作流配置控制并发执行数量
- **状态查询**: 提供工作流执行状态查询接口

### Temporal 配置管理

#### 1. 环境变量配置 (更新后)
```bash
# Temporal 服务配置
TEMPORAL_HOST=localhost
TEMPORAL_PORT=7233
# 注意: 移除了 TEMPORAL_NAMESPACE 和 TEMPORAL_TASK_QUEUE 配置
# namespace 和 taskQueue 由各模块自行管理

# 工作流配置
WORKFLOW_EXECUTION_TIMEOUT=30m
ACTIVITY_EXECUTION_TIMEOUT=5m
ACTIVITY_RETRY_ATTEMPTS=3

# 环境标识 (用于 namespace 和 taskQueue 命名)
NODE_ENV=dev  # dev | test | stg | prd
```

#### 2. Worker 配置 (更新后)
```typescript
// 模块级别 Worker 配置示例
// src/modules/news/temporal/news-worker.ts
export const createNewsWorker = () => {
  const environment = process.env.NODE_ENV || 'dev';
  
  return Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities: newsActivities,
    taskQueue: `news-crawling-${environment}`,  // 动态生成
    maxConcurrentActivityTaskExecutions: 20,
    maxConcurrentWorkflowTaskExecutions: 5,
  });
};

// src/modules/agents/temporal/agents-worker.ts  
export const createAgentsWorker = () => {
  const environment = process.env.NODE_ENV || 'dev';
  
  return Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities: analysisActivities,
    taskQueue: `agents-analysis-${environment}`, // 动态生成
    maxConcurrentActivityTaskExecutions: 10,
    maxConcurrentWorkflowTaskExecutions: 3,
  });
};
```

#### 3. 客户端配置 (更新后)
```typescript
// 模块级别客户端配置示例
// src/modules/news/temporal/news-client.ts
export class NewsTemporalClient {
  private client: Client;
  
  constructor() {
    const environment = process.env.NODE_ENV || 'dev';
    const namespace = `news-${environment}`;
    
    this.client = new Client({
      connection,
      namespace, // news-dev, news-prd 等
    });
  }
  
  async startNewsCrawlingWorkflow(input: NewsCrawlingInput) {
    const environment = process.env.NODE_ENV || 'dev';
    const taskQueue = `news-crawling-${environment}`;
    
    return await this.client.workflow.start(newsCrawlingWorkflow, {
      taskQueue,
      workflowId: `news-crawling-${input.date}-${Date.now()}`,
      args: [input],
    });
  }
}
```
```

### 工作流监控和管理

#### 1. Web UI 监控
- **访问地址**: http://localhost:8088
- **功能特性**: 
  - 工作流执行状态查看
  - 活动执行历史追踪
  - 失败任务重试管理
  - 性能指标监控

#### 2. 程序化监控
```typescript
// 获取工作流执行状态
const handle = client.workflow.getHandle(workflowId);
const description = await handle.describe();
const result = await handle.result();
```

### 替代传统任务调度

#### 迁移 Cron 任务到 Temporal
- **新闻爬取定时任务** → 新闻爬取工作流 (每日 1:00 AM)
- **股票分析定时任务** → 股票分析工作流 (每日 9:00 AM)
- **系统监控任务** → 系统监控工作流 (每小时)

#### 优势对比
```
传统 Cron 任务           Temporal 工作流
├─ 单机执行             ├─ 分布式执行
├─ 状态难管理           ├─ 完整状态追踪
├─ 错误难恢复           ├─ 自动错误重试
├─ 监控能力有限         ├─ 丰富的监控界面
└─ 扩展性差             └─ 水平扩展能力
```

## 🗄️ 数据库架构

### 存储架构
```
┌─────────────────────────────────────────────────────────────────┐
│                          数据存储架构                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Redis 缓存层                            │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │实时数据缓存 │ │计算结果缓存 │ │会话缓存     │          │ │
│  │  │- 股票价格   │ │- 智能体分析 │ │- 用户状态   │          │ │
│  │  │- 新闻数据   │ │- 技术指标   │ │- 临时数据   │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │ (仅缓存，所有数据必须落盘)         │
│                              ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                PostgreSQL 持久化存储                       │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │核心业务数据 │ │股票市场数据 │ │系统运营数据 │          │ │
│  │  │- 用户信息   │ │- 股票基础   │ │- 系统配置   │          │ │
│  │  │- 自选股     │ │- 价格数据   │ │- 操作日志   │          │ │
│  │  │- 持仓信息   │ │- 技术指标   │ │- 错误日志   │          │ │
│  │  │- 决策记录   │ │- 新闻数据   │ │- 监控数据   │          │ │
│  │  │- 分析结果   │ │- 情绪分析   │ │             │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 存储策略
- **PostgreSQL**: 所有业务数据的主要持久化存储，包含核心业务数据、股票市场数据和系统运营数据
- **Redis**: ⚠️ **现阶段暂时禁用缓存** - 开发阶段为确保数据一致性，暂时关闭所有缓存功能
- **软删除**: 所有实体使用逻辑删除(deletedAt字段)

### 实体标准
- 所有实体继承 `BaseEntity`，包含标准字段:
  - `createdAt`: 创建时间戳
  - `updatedAt`: 更新时间戳
  - `deletedAt`: 删除时间戳(软删除)
  - `version`: 乐观锁版本号

### 查询限制
- 每个查询最多关联3张表
- 所有列表接口必须实现分页(最多200条记录)
- 避免可能导致全表扫描的复杂查询
- 禁止跨模块联表查询，由相应模块service提供方法进行数据聚合
- 禁止跨模块直接注入repository

### 缓存管理策略
⚠️ **开发阶段缓存配置**:
- **当前状态**: 所有缓存功能暂时禁用
- **配置方式**: 环境变量 `ENABLE_CACHE=false`
- **数据源**: 直接访问PostgreSQL和外部API，不使用缓存层
- **性能考虑**: 开发阶段优先保证数据一致性，后续优化性能

### 数据流向设计 (无缓存模式)

#### 数据写入流程
```
1. 数据源 → 2. 业务处理 → 3. PostgreSQL落盘
```

#### 数据读取流程
```
1. 直接查询PostgreSQL → 2. 返回结果
```

### 缓存配置规范 (后续启用时)
- 模式: `模块:方法:参数`
- 示例: `watchlist:list:userId123`
- 所有缓存键必须设置TTL过期时间

## ⚠️ 数据安全与测试规范

### Mock数据使用规则 (重要)
🚨 **严格禁止在非单元测试代码中使用Mock数据**:

- **禁止场景**: 在业务代码、服务类、控制器、Activities、工作流中使用任何形式的Mock数据
- **允许场景**: 仅在单元测试文件（`.spec.ts`、`.test.ts`）中使用Mock数据
- **问题风险**: Mock数据会导致：
  - 生产环境隐藏的逻辑错误
  - 调试困难，问题排查复杂
  - 数据不一致性
  - 业务逻辑验证失效

#### ❌ 错误示例
```typescript
// 业务代码中不应该有这样的逻辑
if (process.env.NODE_ENV === 'test') {
  return { mockData: 'test' }; // 禁止！
}

// Activity中不应该有Mock逻辑
async function getStockData(params) {
  if (isTestEnvironment()) {
    return mockStockData; // 禁止！
  }
  // ... 真实API调用
}
```

#### ✅ 正确做法
```typescript
// 业务代码：始终调用真实服务或抛出明确错误
async function getStockData(params) {
  try {
    return await realApiCall(params);
  } catch (error) {
    logger.error('API调用失败', error);
    throw new Error('数据获取失败，请检查网络连接和API配置');
  }
}

// 单元测试：使用Jest Mock
// ✅ 在 .spec.ts 文件中
const mockApiCall = jest.fn().mockResolvedValue(testData);
```

#### 替代方案
1. **错误处理**: 在无法获取真实数据时，抛出明确的错误信息
2. **配置管理**: 使用环境变量控制API端点，而非Mock逻辑
3. **测试环境**: 搭建独立的测试API服务，而非使用Mock数据
4. **单元测试**: 仅在测试文件中使用Jest的Mock功能

## 🔧 API 标准

### 请求格式
- **所有接口统一使用POST方法** (不使用GET/PUT/DELETE)
- **所有参数放在请求体中** (不使用URL参数或查询字符串)
- Content-Type: `application/json`

### 响应格式
所有API返回标准化的 `Result<T>` 格式:
```typescript
{
  code: number,    // 0 = 成功，非零 = 错误
  data: T,         // 响应数据
  message: string, // 响应消息
  timestamp: string // 响应时间戳
}
```

### 分页格式
```typescript
{
  code: 0,
  data: {
    items: T[],           // 当前页数据
    total: number,        // 总记录数
    page: number,         // 当前页码(从1开始)
    limit: number,        // 每页大小
    totalPages: number,   // 总页数
    hasNext: boolean,     // 是否有下一页
    hasPrev: boolean      // 是否有上一页
  }
}
```

## 🎯 MCP统一智能体系统

### 新一代智能体架构
```
MCP智能体系统/
├── 综合分析师 (ComprehensiveAnalystAgent)
│   ├── 技术分析 (整合原市场分析师)
│   ├── 基本面分析 (整合原基本面分析师)
│   └── 新闻情绪分析 (整合原新闻分析师)
├── 交易策略师 (TradingStrategistAgent)
│   ├── 多空观点对比 (整合原多头/空头研究员)
│   ├── 交易决策制定 (整合原交易智能体)
│   └── 风险管控方案 (整合原风险管理员)
└── 统一协调服务 (UnifiedOrchestratorService)
    ├── MCP数据获取 (通过阿里云百炼MCP协议)
    ├── 智能体协调 (综合分析师 → 交易策略师)
    └── 最终决策生成 (权重: 综合分析70% + 交易策略30%)
```

### MCP决策工作流

#### 自动流程(定时任务)
1. 每天早上9点启动定时任务
2. 检查是否为交易日，非交易日结束流程
3. 获取已添加的自选股列表
4. 通过MCP协议获取股票数据、财务数据、新闻数据
5. 启动综合分析师进行全面分析
6. 启动交易策略师制定交易方案
7. 统一协调服务生成最终买卖建议

#### 手动分析流程
1. 接收HTTP请求，用户输入股票代码
2. 验证股票代码格式和有效性
3. 通过MCP协议实时获取股票相关数据
4. 两阶段智能体分析: 综合分析 → 交易策略
5. 返回统一的投资建议和风险评估

## 🌐 数据源

### 股票市场数据
- **上海证券交易所**: 60xxxx 代码
- **深圳证券交易所**: 00xxxx 代码
- **创业板**: 30xxxx 代码
- **科创板**: 68xxxx 代码

### MCP数据协议
- **阿里云百炼MCP**: qtf_mcp股票数据服务
  - 股票基本信息: get_stock_basic_info
  - 实时行情数据: get_stock_realtime_data  
  - 历史价格数据: get_stock_historical_data
  - 技术指标分析: get_stock_technical_indicators
  - 财务数据查询: get_stock_financial_data
  - 市场概览信息: get_market_overview
  - 股票搜索功能: search_stocks
  - 相关新闻获取: get_stock_news

### LLM提供商
- **主要提供商**: 阿里云百炼(DashScope)
  - 模型: qwen-turbo, qwen-plus, qwen-max等
  - 中文语言优化，中国用户首选
- **备选方案**: OpenAI GPT、Google Gemini、Anthropic Claude

## 🔒 开发指南

### 代码标准
- 使用TypeScript严格类型检查
- 遵循NestJS模块结构和依赖注入
- 实现适当的错误处理和日志记录
- 使用DTOs配合 `class-validator` 进行输入验证

### 日期时间格式标准 (重要)
⚠️ **统一格式规范**:
```typescript
// 日期格式
const dateFormat = 'YYYY-MM-dd';
// 示例: '2025-08-16'

// 日期时间格式  
const dateTimeFormat = 'YYYY-MM-dd HH:mm:ss';
// 示例: '2025-08-16 14:30:25'
```

**应用场景**:
- **API接口**: 所有日期参数使用 `YYYY-MM-dd` 格式
- **数据库存储**: 日期时间字段使用 `YYYY-MM-dd HH:mm:ss` 格式
- **日志记录**: 时间戳使用 `YYYY-MM-dd HH:mm:ss` 格式
- **前端显示**: 统一使用标准格式，避免歧义
- **股票数据**: start_date, end_date 等参数使用 `YYYY-MM-dd` 格式

**格式处理原则**:
- 输入验证: 严格校验日期格式
- 统一工具: 使用 `DateTimeUtil` 工具类进行处理
- 错误处理: 无效日期返回明确错误信息
- 装饰器验证: 使用 `@IsDateFormat` 和 `@IsDateTimeFormat` 进行DTO验证
- 日志优化: 测试环境中使用debug级别，避免干扰测试输出

**使用示例**:
```typescript
import { DateTimeUtil } from '../common/utils/date-time.util';
import { IsDateFormat, IsDateTimeFormat } from '../common/decorators/date-format.decorator';

// 解析日期
const date = DateTimeUtil.parseDate('2025-08-16');

// 格式化日期
const dateString = DateTimeUtil.formatDate(new Date());

// DTO验证
class QueryDto {
  @IsDateFormat()
  startDate: string; // 必须是 YYYY-MM-dd 格式
  
  @IsDateTimeFormat()
  timestamp: string; // 必须是 YYYY-MM-dd HH:mm:ss 格式
}
```

### 日志记录规范 (重要)
⚠️ **使用统一业务日志组件**:

项目使用 `BusinessLogger` 组件进行统一日志管理，位于 `src/common/utils/business-logger.util.ts`。

**初始化BusinessLogger**:
```typescript
import { BusinessLogger, LogCategory } from '../common/utils/business-logger.util';

export class YourService {
  private readonly businessLogger = new BusinessLogger(YourService.name);
}
```

**日志类别 (LogCategory)**:
- `HTTP_REQUEST` - HTTP请求日志
- `HTTP_RESPONSE` - HTTP响应日志  
- `HTTP_ERROR` - HTTP错误日志
- `SERVICE_INFO` - 服务信息日志
- `SERVICE_ERROR` - 服务错误日志
- `BUSINESS_ERROR` - 业务错误日志
- `API_CALL` - API调用日志
- `API_SUCCESS` - API成功响应日志
- `API_ERROR` - API错误日志
- `DATABASE_QUERY` - 数据库查询日志
- `DATABASE_ERROR` - 数据库错误日志
- `AGENT_INFO` - 智能体信息日志
- `AGENT_ERROR` - 智能体错误日志

**常用方法**:
```typescript
// 基础日志方法
businessLogger.info(LogCategory.SERVICE_INFO, "服务已启动", url?, context?);
businessLogger.debug(LogCategory.SERVICE_INFO, "调试信息", url?, context?);
businessLogger.warn(LogCategory.SERVICE_ERROR, "警告信息", url?, context?);
businessLogger.error(LogCategory.SERVICE_ERROR, "错误信息", error?, url?, context?);

// 便捷方法
businessLogger.serviceInfo("服务信息", context?);
businessLogger.serviceError("服务错误", error?, context?);
businessLogger.businessError("业务操作", error, context?);

// HTTP相关日志
businessLogger.httpRequest("GET", url, params?, headers?);
businessLogger.httpResponse(url, status, data?, duration?);
businessLogger.httpError(url, error, status?, duration?);

// API相关日志
businessLogger.apiCall("GET", url, params?, headers?);
businessLogger.apiSuccess(url, status, data?, duration?);
businessLogger.apiError(url, error, status?, duration?);
```

**使用示例**:
```typescript
// 服务信息
this.businessLogger.serviceInfo("新闻爬虫服务已初始化");

// HTTP请求
this.businessLogger.httpRequest("GET", targetUrl, { date: "2025-08-16" });

// HTTP响应
this.businessLogger.httpResponse(targetUrl, 200, newsData, "1200ms");

// 业务错误
this.businessLogger.businessError("爬取新闻数据", error, { 
  url: targetUrl,
  date: crawlDate 
});

// API调用
this.businessLogger.apiCall("POST", "/api/news/crawl", { 
  startDate: "2025-08-01",
  endDate: "2025-08-16" 
});
```

**重要特性**:
- **简洁格式**: 使用易读的文本格式，不使用JSON格式
- **敏感信息过滤**: 自动隐藏API密钥、Authorization等敏感请求头
- **简化调用**: 提供 `debug(message)`, `warn(message)` 等简化方法
- **上下文支持**: 可选的context参数用于记录额外信息
- **错误堆栈**: 自动提取Error对象的message和stack信息

**日志格式示例**:
```
[SERVICE_INFO] 服务已启动
[HTTP_REQUEST] HTTP请求 GET https://example.com | Context: params={"date":"2025-08-16"}
[HTTP_RESPONSE] HTTP响应 200 | Duration: 1200ms
[SERVICE_ERROR] 业务操作失败: 爬取新闻数据 | Error: 网络连接超时
```

### 安全最佳实践
- 永远不要在代码中暴露API密钥或机密信息
- 使用环境变量进行配置
- 实现适当的身份验证和授权
- 验证所有输入数据
- 日志中不记录敏感信息(API密钥、密码等)

### 模块设计
- 每个模块应该是自包含的
- 避免跨模块直接注入repository
- 使用服务间通信进行跨模块数据访问
- 遵循领域驱动设计原则

## 🚀 快速开始

1. **安装依赖**: `npm install`
2. **配置环境**: 复制 `.env.example` 到 `.env` 并配置
3. **启动数据库**: 确保PostgreSQL和Redis正在运行
4. **启动Temporal服务**: `docker-compose -f docker-compose.temporal.yml up -d` (使用默认的 default 命名空间)
5. **运行开发模式**: `npm run start:dev`
6. **访问API文档**: http://localhost:3000/api-docs
7. **运行测试**: `npm run test`

## 🏗️ 详细架构图

### 整体系统架构
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API 接口层 (API Gateway)                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  RESTful APIs   │  │  WebSocket APIs │  │   定时任务接口   │              │
│  │ (CRUD操作)      │  │ (实时推送)      │  │  (系统调度)     │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NestJS 后端服务层 (Application Layer)                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         业务服务模块                                    │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │ │
│  │  │自选股服务   │ │决策引擎服务 │ │数据采集服务 │ │新闻分析服务 │      │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │ │
│  │  │风险管控服务 │ │定时任务服务 │ │通知推送服务 │ │系统配置服务 │      │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      TypeORM 数据访问层                                │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │ │
│  │  │实体模型     │ │仓储模式     │ │数据验证     │ │事务管理     │      │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MCP统一智能体框架层 (New Architecture)                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      统一智能体协作系统                                  │ │
│  │  ┌─────────────────────────────┐ ┌─────────────────────────────┐        │ │
│  │  │    综合分析师 (Agent 1)      │ │    交易策略师 (Agent 2)      │        │ │
│  │  │                             │ │                             │        │ │
│  │  │ ├─ 技术分析 (整合原3个)      │ │ ├─ 多空观点对比             │        │ │
│  │  │ ├─ 基本面分析              │ │ ├─ 交易决策制定             │        │ │
│  │  │ └─ 新闻情绪分析            │ │ └─ 风险管控方案             │        │ │
│  │  └─────────────────────────────┘ └─────────────────────────────┘        │ │
│  │                    ↓ 数据获取                  ↑ 分析结果                 │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                     MCP客户端服务                                   │ │ │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│ │ │
│  │  │  │股票基本信息  │ │实时行情数据  │ │历史价格数据  │ │技术指标分析  ││ │ │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘│ │ │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│ │ │
│  │  │  │财务数据查询  │ │市场概览信息  │ │股票搜索功能  │ │相关新闻获取  ││ │ │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘│ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      ↓ MCP协议                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      阿里云百炼MCP股票数据服务                            │ │
│  │                   (https://dashscope.aliyuncs.com)                      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 📝 业务模块设计

### 1. 自选股模块
- **添加自选股**: 验证股票代码，存储股票信息
- **获取自选股列表**: 支持分页，返回用户的所有自选股
- **更新自选股**: 修改持仓信息，包括数量和价格
- **删除自选股**: 逻辑删除，保留历史记录

**自选股信息字段**:
- 股票代码(stockCode)
- 股票名称(stockName)  
- 是否持仓(isHolding)
- 持仓数量(holdingQuantity)
- 持仓价格(holdingPrice)

### 2. MCP智能体决策模块
- **MCP数据获取**: 通过阿里云百炼MCP协议统一获取数据
- **两阶段智能体协作**: 综合分析师 → 交易策略师
- **智能决策生成**: 权重化综合评分 (综合分析70% + 交易策略30%)
- **执行记录管理**: 完整记录分析过程和工具调用

### 3. MCP数据获取模块

#### MCP股票数据服务 (qtf_mcp)
- get_stock_basic_info: 股票基本信息
- get_stock_realtime_data: 实时行情数据
- get_stock_historical_data: 历史价格数据
- get_stock_technical_indicators: 技术指标分析
- get_stock_financial_data: 财务数据查询
- get_market_overview: 市场概览信息
- search_stocks: 股票搜索功能
- get_stock_news: 相关新闻获取

#### 数据获取优势
- **统一接口**: MCP协议标准化数据获取
- **实时更新**: 直连阿里云百炼数据源
- **高可靠性**: 自动重试和错误处理机制
- **智能缓存**: 减少重复调用，提高响应速度

### 4. 新闻爬虫模块
- **抽象工厂模式**: 支持灵活扩展不同新闻数据源
- **当前数据源**: 新闻联播(央视权威新闻发布平台)
- **实时落盘机制**: 每获取一条新闻立即保存，避免批量处理时数据丢失风险
- **智能去重**: 基于URL的新闻去重机制
- **异步处理**: 后台爬取任务，不阻塞API响应
- **日期范围爬取**: 支持指定起止日期的批量采集
- **容错性**: 单条新闻获取失败不影响其他新闻的保存
- **定时任务**: 每天凌晨1点自动爬取前一天的新闻数据

**数据库实体**:
- **原始新闻数据(RawNews)**: 存储爬取的完整新闻信息
  - 新闻标题(title)、新闻正文(content)、原文链接(url)
  - 数据源代码(sourceCode)、数据源名称(sourceName)
  - 新闻日期(newsDate)、分析状态(analyzed)、地域标记(region)
- **新闻摘要数据(NewsSummary)**: 存储AI生成的新闻摘要
  - 新闻ID(newsId)、新闻标题(title)、新闻摘要(summary)
  - 新闻内容日期(newsDate)、一对一关联原始新闻

#### 实时落盘机制设计

**架构原理**:
```
爬取URL → 解析新闻内容 → 立即执行保存回调 → 继续下一条
            ↓
      [实时数据库保存]
       - 重复性检查
       - 数据验证
       - 事务保证
```

**核心特性**:
- **即时保存**: 每获取一条新闻立即调用`saveNewsCallback`进行落盘
- **异常隔离**: 单条新闻保存失败不影响其他新闻的获取和保存
- **数据一致性**: 保持原有的URL重复性检查机制
- **回滚安全**: 数据库事务确保保存的原子性
- **详细日志**: 每次保存操作都有相应的日志记录

**方法签名**:
```typescript
// 单日新闻爬取
crawlNews(date: string, saveNewsCallback?: (news: RawNews) => Promise<void>): Promise<RawNews[]>

// 日期范围新闻爬取  
crawlNewsRange(startDate: string, endDate: string, saveNewsCallback?: (news: RawNews) => Promise<void>): Promise<RawNews[]>
```

**使用优势**:
- **容错性**: 网络异常或程序中断时已保存的数据不会丢失
- **内存优化**: 避免在内存中累积大量新闻数据
- **实时反馈**: 可以立即看到爬取和保存的进度
- **性能稳定**: 降低因批量保存导致的数据库压力峰值

#### 新闻 Temporal 调度系统

**Temporal 调度服务(NewsTemporalSchedulerService)**:
- **执行时间**: 每天凌晨1点（中国时区）
- **调度表达式**: `'0 1 * * *'`
- **任务范围**: 通过 Temporal 工作流自动爬取前一天所有支持数据源的新闻

**核心特性**:
- **自动化执行**: 无需人工干预，系统自动完成每日新闻采集
- **智能日期计算**: 自动获取前一天日期（YYYY-MM-dd格式）
- **多数据源支持**: 遍历所有支持的新闻源进行爬取
- **请求频率控制**: 数据源间添加2秒延迟，避免过于频繁请求
- **详细执行日志**: 完整记录爬取过程、成功数量、失败原因
- **异常容错处理**: 单个数据源失败不影响其他数据源爬取

**手动执行功能**:
```typescript
// 手动触发昨日新闻爬取（用于测试或补漏）
async triggerYesterdayNewsCrawl(): Promise<{
  success: boolean;
  message: string;
  results: Record<string, number>;
}>
```

**任务监控功能**:
```typescript
// 获取定时任务状态和下次运行时间
getScheduleStatus(): {
  taskName: string;
  cronExpression: string;
  timeZone: string; 
  description: string;
  nextRunDate?: string;
}
```

**执行统计信息**:
- 成功爬取的数据源数量
- 失败的数据源及错误信息  
- 每个数据源获取的新闻条数
- 总执行时间和完成状态

## 📝 关键文件
- `src/main.ts`: 应用启动入口
- `src/app.module.ts`: 根模块配置
- `src/common/entities/base.entity.ts`: 包含标准字段的基础实体
- `src/common/dto/result.dto.ts`: 标准化API响应格式
- `src/modules/news/entities/news-summary.entity.ts`: 新闻摘要实体
- `src/modules/news/services/news-temporal-scheduler.service.ts`: 新闻 Temporal 调度服务
- `src/modules/news/temporal/news-crawling.workflow.ts`: 新闻爬取 Temporal 工作流
- `src/modules/news/temporal/news.activities.ts`: 新闻爬取活动实现
- `src/modules/analysis/analysis.controller.ts`: 简化后的分析控制器（仅股票分析接口）
- `src/agents/unified/unified-orchestrator.service.ts`: MCP统一智能体协调服务
- `prompt_templates.md`: AI智能体提示词模板