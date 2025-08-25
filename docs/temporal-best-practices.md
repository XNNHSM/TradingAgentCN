# Temporal 工作流最佳实践指南

本文档展示了如何在 TradingAgentCN 项目中正确使用 Temporal 工作流引擎。

## 📋 命名规范总结

### Namespace 命名规范
- **格式**: `{模块名}-{环境}`
- **示例**: `agents-dev`, `news-prd`, `watchlist-test`

### TaskQueue 命名规范  
- **格式**: `{模块名}-{业务域}-{环境}`
- **示例**: `agents-analysis-dev`, `news-crawling-prd`

## 🏗️ 模块级别实现示例

### 1. 智能体模块 (agents)

#### 客户端配置
```typescript
// src/agents/temporal/agents-temporal-client.ts
import { Client, Connection } from '@temporalio/client';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AgentsTemporalClient {
  private readonly logger = new Logger(AgentsTemporalClient.name);
  private client: Client;

  constructor(private readonly configService: ConfigService) {
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      const connection = await Connection.connect({
        address: `${this.configService.get('TEMPORAL_HOST', 'localhost')}:${this.configService.get('TEMPORAL_PORT', '7233')}`,
      });

      // 使用智能体模块的专属命名空间
      const environment = this.configService.get('NODE_ENV', 'dev');
      const namespace = `agents-${environment}`;

      this.client = new Client({
        connection,
        namespace,
      });

      this.logger.log(`智能体模块 Temporal 客户端已连接到命名空间: ${namespace}`);
    } catch (error) {
      this.logger.error('智能体模块 Temporal 客户端初始化失败', error);
    }
  }

  async startStockAnalysisWorkflow(input: StockAnalysisInput): Promise<WorkflowHandle> {
    const environment = this.configService.get('NODE_ENV', 'dev');
    const taskQueue = `agents-analysis-${environment}`;

    return await this.client.workflow.start(stockAnalysisWorkflow, {
      taskQueue,
      workflowId: `stock-analysis-${input.stockCode}-${Date.now()}`,
      args: [input],
    });
  }

  async startBatchAnalysisWorkflow(input: BatchAnalysisInput): Promise<WorkflowHandle> {
    const environment = this.configService.get('NODE_ENV', 'dev');
    const taskQueue = `agents-batch-${environment}`;

    return await this.client.workflow.start(batchAnalysisWorkflow, {
      taskQueue,
      workflowId: `batch-analysis-${Date.now()}`,
      args: [input],
    });
  }
}
```

#### Worker 配置
```typescript
// src/agents/temporal/agents-worker.ts
import { Worker } from '@temporalio/worker';
import { ConfigService } from '@nestjs/config';
import { agentsActivities } from './agents-activities';

export class AgentsWorkerService {
  static async createWorker(configService: ConfigService): Promise<Worker> {
    const environment = configService.get('NODE_ENV', 'dev');
    
    // 为不同业务域创建专门的 Worker
    const analysisWorker = await Worker.create({
      workflowsPath: require.resolve('./workflows'),
      activities: agentsActivities,
      taskQueue: `agents-analysis-${environment}`,
      maxConcurrentActivityTaskExecutions: 10,
      maxConcurrentWorkflowTaskExecutions: 3,
    });

    const batchWorker = await Worker.create({
      workflowsPath: require.resolve('./workflows'),
      activities: agentsActivities,
      taskQueue: `agents-batch-${environment}`,
      maxConcurrentActivityTaskExecutions: 20,
      maxConcurrentWorkflowTaskExecutions: 5,
    });

    console.log(`智能体模块 Workers 已启动:`);
    console.log(`- 分析任务队列: agents-analysis-${environment}`);
    console.log(`- 批量任务队列: agents-batch-${environment}`);

    return analysisWorker; // 返回主要的 worker
  }
}
```

### 2. 新闻模块 (news)

#### 客户端配置
```typescript
// src/modules/news/temporal/news-temporal-client.ts
import { Client, Connection } from '@temporalio/client';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NewsTemporalClient {
  private readonly logger = new Logger(NewsTemporalClient.name);
  private client: Client;

  constructor(private readonly configService: ConfigService) {
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    const connection = await Connection.connect({
      address: `${this.configService.get('TEMPORAL_HOST', 'localhost')}:${this.configService.get('TEMPORAL_PORT', '7233')}`,
    });

    // 新闻模块专属命名空间
    const environment = this.configService.get('NODE_ENV', 'dev');
    const namespace = `news-${environment}`;

    this.client = new Client({
      connection,
      namespace,
    });

    this.logger.log(`新闻模块 Temporal 客户端已连接到命名空间: ${namespace}`);
  }

  async startNewsCrawlingWorkflow(input: NewsCrawlingInput): Promise<WorkflowHandle> {
    const environment = this.configService.get('NODE_ENV', 'dev');
    const taskQueue = `news-crawling-${environment}`;

    return await this.client.workflow.start(newsCrawlingWorkflow, {
      taskQueue,
      workflowId: `news-crawling-${input.date}-${Date.now()}`,
      args: [input],
    });
  }

  async startNewsProcessingWorkflow(input: NewsProcessingInput): Promise<WorkflowHandle> {
    const environment = this.configService.get('NODE_ENV', 'dev');
    const taskQueue = `news-processing-${environment}`;

    return await this.client.workflow.start(newsProcessingWorkflow, {
      taskQueue,
      workflowId: `news-processing-${input.batchId}-${Date.now()}`,
      args: [input],
    });
  }
}
```

#### Worker 配置
```typescript
// src/modules/news/temporal/news-worker.ts
import { Worker } from '@temporalio/worker';
import { ConfigService } from '@nestjs/config';
import { newsActivities } from './news-activities';

export class NewsWorkerService {
  static async createWorkers(configService: ConfigService): Promise<Worker[]> {
    const environment = configService.get('NODE_ENV', 'dev');
    const workers: Worker[] = [];

    // 新闻爬取 Worker (IO 密集型，高并发)
    const crawlingWorker = await Worker.create({
      workflowsPath: require.resolve('./workflows'),
      activities: newsActivities,
      taskQueue: `news-crawling-${environment}`,
      maxConcurrentActivityTaskExecutions: 50, // 高并发爬取
      maxConcurrentWorkflowTaskExecutions: 10,
    });
    workers.push(crawlingWorker);

    // 新闻处理 Worker (CPU 密集型，中等并发)
    const processingWorker = await Worker.create({
      workflowsPath: require.resolve('./workflows'),
      activities: newsActivities,
      taskQueue: `news-processing-${environment}`,
      maxConcurrentActivityTaskExecutions: 10,
      maxConcurrentWorkflowTaskExecutions: 5,
    });
    workers.push(processingWorker);

    console.log(`新闻模块 Workers 已启动:`);
    console.log(`- 爬取任务队列: news-crawling-${environment}`);
    console.log(`- 处理任务队列: news-processing-${environment}`);

    return workers;
  }
}
```

### 3. 自选股模块 (watchlist)

#### 客户端配置
```typescript
// src/modules/watchlist/temporal/watchlist-temporal-client.ts
import { Client, Connection } from '@temporalio/client';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WatchlistTemporalClient {
  private client: Client;

  constructor(private readonly configService: ConfigService) {
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    const connection = await Connection.connect({
      address: `${this.configService.get('TEMPORAL_HOST')}:${this.configService.get('TEMPORAL_PORT')}`,
    });

    const environment = this.configService.get('NODE_ENV', 'dev');
    const namespace = `watchlist-${environment}`;

    this.client = new Client({ connection, namespace });
  }

  async startMonitoringWorkflow(input: WatchlistMonitoringInput): Promise<WorkflowHandle> {
    const environment = this.configService.get('NODE_ENV', 'dev');
    const taskQueue = `watchlist-monitoring-${environment}`;

    return await this.client.workflow.start(watchlistMonitoringWorkflow, {
      taskQueue,
      workflowId: `watchlist-monitoring-${input.userId}-${Date.now()}`,
      args: [input],
    });
  }

  async startAlertsWorkflow(input: WatchlistAlertsInput): Promise<WorkflowHandle> {
    const environment = this.configService.get('NODE_ENV', 'dev');
    const taskQueue = `watchlist-alerts-${environment}`;

    return await this.client.workflow.start(watchlistAlertsWorkflow, {
      taskQueue,
      workflowId: `watchlist-alerts-${input.alertType}-${Date.now()}`,
      args: [input],
    });
  }
}
```

## 🎯 环境隔离策略

### 开发环境 (dev)
```bash
# 智能体模块
agents-dev                 # namespace
agents-analysis-dev         # taskQueue
agents-batch-dev           # taskQueue

# 新闻模块  
news-dev                   # namespace
news-crawling-dev          # taskQueue
news-processing-dev        # taskQueue

# 自选股模块
watchlist-dev              # namespace
watchlist-monitoring-dev   # taskQueue
watchlist-alerts-dev       # taskQueue
```

### 生产环境 (prd)
```bash
# 智能体模块
agents-prd                 # namespace
agents-analysis-prd        # taskQueue
agents-batch-prd           # taskQueue

# 新闻模块
news-prd                   # namespace
news-crawling-prd          # taskQueue
news-processing-prd        # taskQueue

# 自选股模块
watchlist-prd              # namespace
watchlist-monitoring-prd   # taskQueue
watchlist-alerts-prd       # taskQueue
```

## 🚀 性能调优指南

### 1. TaskQueue 并发配置

#### CPU 密集型任务
```typescript
const worker = await Worker.create({
  taskQueue: `analysis-compute-${environment}`,
  maxConcurrentActivityTaskExecutions: 4,  // 限制并发，避免CPU过载
  maxConcurrentWorkflowTaskExecutions: 2,
});
```

#### IO 密集型任务
```typescript
const worker = await Worker.create({
  taskQueue: `news-crawling-${environment}`,
  maxConcurrentActivityTaskExecutions: 50, // 高并发，充分利用IO等待时间
  maxConcurrentWorkflowTaskExecutions: 10,
});
```

### 2. 优先级队列设计
```typescript
// 高优先级队列
const highPriorityQueue = `agents-urgent-${environment}`;

// 普通优先级队列
const normalPriorityQueue = `agents-analysis-${environment}`;

// 低优先级队列
const lowPriorityQueue = `agents-batch-${environment}`;
```

### 3. 监控和报警
```typescript
// 队列健康检查
export class TemporalHealthCheck {
  async checkQueueHealth(queueName: string): Promise<QueueHealthStatus> {
    // 检查队列积压情况
    // 检查 Worker 连接状态
    // 检查任务执行成功率
    // 设置报警阈值
  }
}
```

## ⚠️ 注意事项

1. **环境隔离**: 确保不同环境使用不同的 namespace 和 taskQueue
2. **资源管理**: 根据业务特性合理配置 Worker 并发数
3. **命名一致性**: 严格按照命名规范创建队列名称
4. **监控报警**: 建立完整的队列监控和报警机制
5. **故障处理**: 设计合理的重试策略和错误处理机制

## 🔗 相关文档

- [Temporal 官方文档](https://docs.temporal.io/)
- [项目 CLAUDE.md 开发规范](../CLAUDE.md)
- [项目 README.md 使用指南](../README.md)