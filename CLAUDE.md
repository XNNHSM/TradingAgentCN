# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 🏗️ 系统概述

**TradingAgentCN** 是基于MCP协议的智能交易决策系统，专门针对中国A股市场设计。

### 核心技术栈
- **后端**: NestJS + TypeScript + TypeORM + PostgreSQL + Redis
- **数据源**: 阿里云百炼MCP协议 (qtf_mcp股票数据服务)
- **智能体**: 分层LLM配置 (qwen-turbo/plus/max)
- **工作流**: Temporal分布式协调引擎
- **架构**: 单体应用 (NestJS应用即Temporal Worker)

### 系统架构
```
API接口层 → NestJS服务层 → Temporal工作流引擎 → 统一智能体服务 → MCP客户端 → 阿里云百炼MCP → 股票数据
```

### 核心组件
- **自选股管理**: 股票选择、持仓跟踪
- **MCP统一智能体**: 按需调用专业化智能体避免重复
- **Temporal工作流**: 分布式任务调度和状态管理
- **新闻爬虫**: 基于Temporal的定时新闻采集

## 🚀 开发命令

### 基础操作
```bash
# 开发启动
npm run start:dev

# 构建和测试
npm run build
npm run test
npm run lint

# Docker部署
docker-compose up -d
```

### Temporal管理
```bash
# 启动Temporal服务
docker-compose up temporal -d

# Web UI (查看Worker状态)
open http://localhost:8088

# 重要测试
npm test -- src/agents/temporal/agents-temporal-client.service.spec.ts
npm test -- src/modules/news/temporal/news-temporal-scheduler.service.spec.ts
```

### 数据库操作
```bash
# 数据库迁移
npm run migration:generate
npm run migration:run
```

## 📁 项目结构

```
src/
├── agents/                    # MCP智能体模块
│   ├── unified/              # 统一智能体架构
│   ├── services/             # MCP客户端、LLM服务
│   └── temporal/             # Temporal Worker服务
├── common/                   # 公共组件
│   ├── temporal/             # Temporal统一封装
│   ├── utils/                # BusinessLogger等工具
│   └── entities/             # 基础实体
├── modules/                  # 业务模块
│   ├── news/                 # 新闻爬虫模块
│   ├── watchlist/            # 自选股管理
│   └── analysis/             # 股票分析接口
└── workflows/                # Temporal工作流定义
    ├── orchestrators/        # 工作流协调器
    └── activities/           # 业务活动实现
```

## 🔄 Temporal架构

### 单体应用设计 ⭐
- 🏗️ **单体非微服务**: NestJS应用本身就是Temporal Worker
- 🚀 **自动启动**: 应用启动时自动启动Worker并调用 `worker.run()`
- 📦 **统一部署**: Client和Worker在同一应用进程中

**Worker启动流程**:
```
NestJS启动 → AgentsModule初始化 → startWorkers() → worker.run() → 轮询TaskQueue
```

### 命名规范
- **Namespace**: 统一使用 `default`
- **TaskQueue**: 使用简洁业务名称 (`stock-analysis`, `news-crawling`)

### 核心工作流
| 工作流 | TaskQueue | 功能描述 |
|--------|-----------|----------|
| 股票分析 | `stock-analysis` | MCP数据获取→智能分析→决策生成 |
| 新闻爬取 | `news-crawling` | 定时爬取→实时落盘→摘要生成 |

## 🗄️ 数据架构

### 存储策略
- **PostgreSQL**: 所有业务数据主要存储
- **Redis缓存**: 开发阶段暂时禁用 (`ENABLE_CACHE=false`)
- **软删除**: 所有实体使用 `deletedAt` 字段

### 数据规范
- **查询限制**: 最多关联3张表，列表最多200条记录
- **跨模块访问**: 禁止直接注入repository，通过service方法访问
- **实体标准**: 继承BaseEntity (createdAt/updatedAt/deletedAt/version)

## 🎯 MCP智能体系统

### 按需调用原则 ⚠️
**核心原则**: 每个智能体专门负责特定的MCP服务调用，避免重复调用控制成本

### 智能体职责分工
| 智能体 | MCP服务调用 | 职责说明 |
|--------|-------------|----------|
| BasicDataAgent | get_stock_basic_info, get_stock_realtime_data | 基础数据获取 |
| TechnicalAnalystAgent | get_stock_historical_data, get_stock_technical_indicators | 技术分析 |
| FundamentalAnalystAgent | get_stock_financial_data | 基本面分析 |
| NewsAnalystAgent | get_stock_news | 新闻情绪分析 |
| UnifiedOrchestratorAgent | 无MCP调用 | 整合所有结果 |

### 工作流程
```
1. 并行执行专业智能体 (MCP数据获取)
2. 基于结果的高级分析智能体
3. 统一协调器生成最终决策
```

## 🔧 开发规范

### 日期时间格式 ⭐
```typescript
// 统一格式
const dateFormat = 'YYYY-MM-dd';        // 示例: '2025-08-16'
const dateTimeFormat = 'YYYY-MM-dd HH:mm:ss'; // 示例: '2025-08-16 14:30:25'

// 使用工具类
import { DateTimeUtil } from '../common/utils/date-time.util';
const date = DateTimeUtil.parseDate('2025-08-16');
```

### 日志记录规范 ⭐
```typescript
// 使用BusinessLogger
import { BusinessLogger, LogCategory } from '../common/utils/business-logger.util';

private readonly businessLogger = new BusinessLogger(YourService.name);

// 常用方法
businessLogger.serviceInfo("服务信息");
businessLogger.httpRequest("GET", url, params);
businessLogger.businessError("操作", error, context);
```

### API标准
- **请求方式**: 统一使用POST方法，参数放在请求体
- **响应格式**: 标准 `Result<T>` 格式 (code/data/message/timestamp)
- **分页格式**: items/total/page/limit/totalPages/hasNext/hasPrev

### Mock数据禁用 🚨
**严格禁止**: 在业务代码中使用任何形式的Mock数据
- **仅允许**: 在单元测试文件 (`.spec.ts`) 中使用
- **替代方案**: 抛出明确错误、配置管理、独立测试环境

### 安全最佳实践
- 永远不暴露API密钥
- 使用环境变量配置
- 日志自动过滤敏感信息 (API密钥、Authorization等)
- 实现适当的输入验证

## 📚 快速参考

### 环境变量配置
```bash
# 数据库
DATABASE_URL=postgresql://user:pass@localhost/db
REDIS_URL=redis://localhost:6379

# MCP服务
DASHSCOPE_API_KEY=your_api_key

# Temporal
TEMPORAL_HOST=localhost:7233
TEMPORAL_WORKER_ENABLED=true

# 功能开关
ENABLE_CACHE=false  # 开发阶段禁用缓存
NODE_ENV=development
```

### 重要文件路径
```
核心配置：
- src/main.ts                              # 应用入口
- src/agents/agents.module.ts              # 智能体模块
- src/common/temporal/temporal.manager.ts  # Temporal统一管理

业务逻辑：
- src/modules/analysis/analysis.controller.ts    # 股票分析API
- src/agents/unified/unified-orchestrator.agent.ts # 统一协调器
- src/modules/news/temporal/news-crawling.workflow.ts # 新闻爬取工作流

工具组件：
- src/common/utils/business-logger.util.ts    # 业务日志
- src/common/utils/date-time.util.ts          # 日期工具
- src/common/dto/result.dto.ts                # 响应格式
```

### 常见TaskQueue
```bash
stock-analysis      # 股票分析
news-crawling       # 新闻爬取
portfolio-monitoring # 投资组合监控
daily-report        # 日报生成
```

### BusinessLogger类别
```typescript
LogCategory.SERVICE_INFO     # 服务信息
LogCategory.HTTP_REQUEST     # HTTP请求
LogCategory.BUSINESS_ERROR   # 业务错误
LogCategory.API_CALL        # API调用
LogCategory.AGENT_INFO      # 智能体信息
```

## 🚀 快速开始

1. **环境准备**: 
   ```bash
   npm install
   cp .env.example .env  # 配置环境变量
   ```

2. **启动服务**:
   ```bash
   # 启动PostgreSQL、Redis、Temporal
   docker-compose up -d
   
   # 启动应用
   npm run start:dev
   ```

3. **验证运行**:
   - API文档: http://localhost:3000/api-docs
   - Temporal UI: http://localhost:8088
   - 测试接口: `POST /api/v1/analysis/analyze`

4. **运行测试**: `npm test`

---

**架构核心理念**: 通过MCP协议统一数据获取，Temporal协调工作流，按需调用智能体，实现成本可控的智能交易决策系统。