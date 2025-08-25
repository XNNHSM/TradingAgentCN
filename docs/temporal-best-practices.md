# Temporal 工作流最佳实践指南

本文档展示了如何在 TradingAgentCN 项目中正确使用 Temporal 工作流引擎。

## 📋 命名规范总结

### Namespace 命名规范
- **策略**: 统一使用 `default` namespace
- **优势**: 简化配置管理，便于监控和运维

### TaskQueue 命名规范  
- **格式**: `{业务功能名称}`
- **示例**: `stock-analysis`, `news-crawling`, `portfolio-monitoring`
- **原则**: 直接使用业务功能名称，不添加模块前缀或环境后缀

## 🏗️ 模块级别实现示例

### 1. 智能体模块 (agents)

#### 客户端配置
```typescript
// src/agents/temporal/agents-temporal-client.service.ts
import { Client, Connection } from '@temporalio/client';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AgentsTemporalClientService {
  private readonly logger = new Logger(AgentsTemporalClientService.name);
  private client: Client;

  constructor(private readonly configService: ConfigService) {
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      const connection = await Connection.connect({
        address: `${this.configService.get('TEMPORAL_HOST', 'localhost')}:${this.configService.get('TEMPORAL_PORT', '7233')}`,
      });

      // 统一使用 default namespace
      this.client = new Client({
        connection,
        namespace: 'default',
      });

      this.logger.log('智能体模块 Temporal 客户端已连接到 default namespace');
    } catch (error) {
      this.logger.error('智能体模块 Temporal 客户端初始化失败', error);
    }
  }

  async startStockAnalysisWorkflow(input: StockAnalysisInput): Promise<WorkflowHandle> {
    return await this.client.workflow.start(stockAnalysisWorkflow, {
      taskQueue: 'stock-analysis',  // 简化的业务功能名称
      workflowId: `stock-analysis-${input.stockCode}-${Date.now()}`,
      args: [input],
    });
  }

  async startPortfolioMonitoringWorkflow(input: PortfolioInput): Promise<WorkflowHandle> {
    return await this.client.workflow.start(portfolioMonitoringWorkflow, {
      taskQueue: 'portfolio-monitoring',  // 简化的业务功能名称
      workflowId: `portfolio-monitoring-${input.userId}-${Date.now()}`,
      args: [input],
    });
  }
}
```

#### Worker 配置
```typescript
// src/agents/temporal/agents-worker.service.ts
import { Worker } from '@temporalio/worker';
import { ConfigService } from '@nestjs/config';
import { agentsActivities } from './activities';

export class AgentsWorkerService {
  static async createWorkers(configService: ConfigService): Promise<Worker[]> {
    const workers: Worker[] = [];
    
    // 股票分析 Worker
    const stockAnalysisWorker = await Worker.create({
      workflowsPath: require.resolve('./workflows'),
      activities: agentsActivities,
      taskQueue: 'stock-analysis',  // 简化命名
      maxConcurrentActivityTaskExecutions: 10,
      maxConcurrentWorkflowTaskExecutions: 3,
    });
    workers.push(stockAnalysisWorker);

    // 投资组合监控 Worker  
    const portfolioWorker = await Worker.create({
      workflowsPath: require.resolve('./workflows'),
      activities: agentsActivities,
      taskQueue: 'portfolio-monitoring',  // 简化命名
      maxConcurrentActivityTaskExecutions: 20,
      maxConcurrentWorkflowTaskExecutions: 5,
    });
    workers.push(portfolioWorker);

    console.log('智能体模块 Workers 已启动:');
    console.log('- 股票分析任务队列: stock-analysis');
    console.log('- 投资组合监控队列: portfolio-monitoring');

    return workers;
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

    // 统一使用 default namespace
    this.client = new Client({
      connection,
      namespace: 'default',
    });

    this.logger.log('新闻模块 Temporal 客户端已连接到 default namespace');
  }

  async startNewsCrawlingWorkflow(input: NewsCrawlingInput): Promise<WorkflowHandle> {
    return await this.client.workflow.start(newsCrawlingWorkflow, {
      taskQueue: 'news-crawling',  // 简化命名
      workflowId: `news-crawling-${input.date}-${Date.now()}`,
      args: [input],
    });
  }

  async startNewsProcessingWorkflow(input: NewsProcessingInput): Promise<WorkflowHandle> {
    return await this.client.workflow.start(newsProcessingWorkflow, {
      taskQueue: 'news-processing',  // 简化命名
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
import { newsActivities } from './activities';

export class NewsWorkerService {
  static async createWorkers(configService: ConfigService): Promise<Worker[]> {
    const workers: Worker[] = [];

    // 新闻爬取 Worker (IO 密集型，高并发)
    const crawlingWorker = await Worker.create({
      workflowsPath: require.resolve('./workflows'),
      activities: newsActivities,
      taskQueue: 'news-crawling',  // 简化命名
      maxConcurrentActivityTaskExecutions: 50, // 高并发爬取
      maxConcurrentWorkflowTaskExecutions: 10,
    });
    workers.push(crawlingWorker);

    // 新闻处理 Worker (CPU 密集型，中等并发)
    const processingWorker = await Worker.create({
      workflowsPath: require.resolve('./workflows'),
      activities: newsActivities,
      taskQueue: 'news-processing',  // 简化命名
      maxConcurrentActivityTaskExecutions: 10,
      maxConcurrentWorkflowTaskExecutions: 5,
    });
    workers.push(processingWorker);

    console.log('新闻模块 Workers 已启动:');
    console.log('- 爬取任务队列: news-crawling');
    console.log('- 处理任务队列: news-processing');

    return workers;
  }
}
```

## 🎯 TaskQueue 业务功能映射

### 核心业务功能
```bash
stock-analysis         # 股票分析任务队列
news-crawling         # 新闻爬取任务队列
news-processing       # 新闻处理任务队列
portfolio-monitoring  # 投资组合监控任务队列
daily-report          # 日报生成任务队列
risk-assessment       # 风险评估任务队列
market-data-sync      # 市场数据同步任务队列
notification-dispatch # 通知分发任务队列
```

### 业务优先级划分
```typescript
// 高优先级业务功能
const criticalQueues = [
  'stock-analysis',      // 实时股票分析
  'risk-assessment',     // 风险评估
];

// 中优先级业务功能  
const normalQueues = [
  'portfolio-monitoring', // 投资组合监控
  'market-data-sync',    // 市场数据同步
];

// 低优先级业务功能
const lowQueues = [
  'news-crawling',       // 新闻爬取
  'daily-report',        // 日报生成
];
```

## 🚀 性能调优指南

### 1. TaskQueue 并发配置

#### CPU 密集型任务
```typescript
const worker = await Worker.create({
  taskQueue: 'risk-assessment',
  maxConcurrentActivityTaskExecutions: 4,  // 限制并发，避免CPU过载
  maxConcurrentWorkflowTaskExecutions: 2,
});
```

#### IO 密集型任务
```typescript
const worker = await Worker.create({
  taskQueue: 'news-crawling',
  maxConcurrentActivityTaskExecutions: 50, // 高并发，充分利用IO等待时间
  maxConcurrentWorkflowTaskExecutions: 10,
});
```

### 2. 业务功能队列配置
```typescript
// 实时分析队列配置
const realtimeAnalysisWorker = await Worker.create({
  taskQueue: 'stock-analysis',
  maxConcurrentActivityTaskExecutions: 15,
  maxConcurrentWorkflowTaskExecutions: 5,
});

// 批量处理队列配置
const batchProcessingWorker = await Worker.create({
  taskQueue: 'daily-report',
  maxConcurrentActivityTaskExecutions: 8,
  maxConcurrentWorkflowTaskExecutions: 3,
});

// 监控队列配置
const monitoringWorker = await Worker.create({
  taskQueue: 'portfolio-monitoring',
  maxConcurrentActivityTaskExecutions: 25,
  maxConcurrentWorkflowTaskExecutions: 8,
});
```

### 3. 监控和报警
```typescript
// 业务功能队列健康检查
export class TaskQueueHealthCheck {
  private readonly criticalQueues = [
    'stock-analysis',
    'risk-assessment',
    'portfolio-monitoring'
  ];

  async checkQueueHealth(queueName: string): Promise<QueueHealthStatus> {
    // 检查队列积压情况
    // 检查 Worker 连接状态
    // 检查任务执行成功率
    
    const isCritical = this.criticalQueues.includes(queueName);
    return {
      queueName,
      healthy: true,
      pendingTasks: 0,
      activeWorkers: 1,
      isCritical,
      alertThreshold: isCritical ? 10 : 50, // 关键队列更低的报警阈值
    };
  }
}
```

## ⚠️ 注意事项

1. **统一 Namespace**: 所有模块都使用 `default` namespace，简化管理
2. **简化命名**: TaskQueue 名称直接反映业务功能，便于理解和维护
3. **资源管理**: 根据业务特性合理配置 Worker 并发数
4. **业务优先级**: 关键业务功能使用专门的队列和更严格的监控
5. **环境隔离**: 通过部署层面或配置文件区分环境，而非队列名称

## 🔗 相关文档

- [Temporal 官方文档](https://docs.temporal.io/)
- [项目 CLAUDE.md 开发规范](../CLAUDE.md)
- [项目 README.md 使用指南](../README.md)