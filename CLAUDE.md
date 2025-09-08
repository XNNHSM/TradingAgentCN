# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 🏗️ 系统概述

**TradingAgentCN** 是基于MCP协议的智能交易决策系统，专门针对中国A股市场设计。

### 核心技术栈
- **后端**: NestJS + TypeScript + TypeORM + PostgreSQL + Redis
- **数据源**: 阿里云百炼MCP协议 (qtf_mcp股票数据服务)
- **MCP客户端**: 基于 @modelcontextprotocol/sdk 的统一调用架构
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
│   └── entities/             # 智能体执行记录实体
├── common/                   # 公共组件
│   ├── dto/                  # 通用DTO
│   ├── utils/                # BusinessLogger等工具
│   └── entities/             # 基础实体
├── modules/                  # 业务模块
│   ├── news/                 # 新闻爬虫模块
│   ├── watchlist/            # 自选股管理
│   └── analysis/             # 股票分析接口
└── temporal/                 # Temporal统一模块
    ├── core/                 # 核心组件
    ├── schedulers/           # 调度器服务
    ├── workers/              # Worker实现
    ├── workflows/            # 工作流定义
    ├── interfaces/           # 接口定义
    ├── config/               # 配置文件
    ├── managers/             # 管理器
    └── temporal.module.ts    # 统一模块入口
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
| 智能分析 | `news-crawling` | 新闻爬取→摘要生成→股票分析子工作流 |

### 统一调度架构规范 ⭐
- 🏗️ **模块解耦**: 各业务模块只提供基础能力和方法，不包含调度逻辑
- 🚀 **统一调度**: Temporal作为统一的调度中心，管理所有定时任务和工作流
- 📦 **职责分离**: 业务模块专注业务逻辑，Temporal专注任务调度和执行

**架构原则**:
```
业务模块 (提供基础能力) → Temporal统一调度 (任务编排) → 工作流执行 (业务处理)
```

**调度器组织结构**:
```
src/common/temporal/
├── schedulers/              # 统一调度器服务
│   ├── news-temporal-client.service.ts      # 新闻Temporal客户端
│   ├── news-worker.service.ts              # 新闻Worker服务
│   └── intelligent-analysis-scheduler.service.ts   # 智能分析调度服务
├── workflows/              # 工作流定义
│   └── news/                 # 新闻相关工作流
│       ├── news-crawling.workflow.ts
│       ├── news-content-processing.workflow.ts
│       ├── single-source-crawling.workflow.ts
│       └── news.activities.ts
├── managers/               # 基础管理器
│   ├── connection.manager.ts
│   ├── worker.manager.ts
│   └── workflow.manager.ts
└── temporal.module.ts      # 统一Temporal模块
```

## 🏗️ Temporal统一目录结构

### 新的目录架构
```
src/temporal/                           # Temporal统一模块
├── core/                              # 核心组件
│   ├── interfaces/                     # 通用接口定义
│   │   ├── connection.config.ts       # 连接配置接口
│   │   ├── worker.config.ts           # Worker配置接口
│   │   └── workflow.config.ts         # 工作流配置接口
│   └── worker/                         # Worker核心实现
│       └── worker.ts                  # Worker基类和工厂方法
├── schedulers/                        # 调度器服务
│   ├── news/                          # 新闻调度器
│   │   ├── news-temporal-client.service.ts     # 客户端服务
│   │   ├── news-worker.service.ts             # Worker服务
│   │   └── news-temporal-scheduler.service.ts  # 调度器服务
│   └── agents/                        # 智能体调度器
│       ├── agents-temporal-client.service.ts  # 客户端服务
│       └── agents-worker.service.ts          # Worker服务
├── workers/                           # Worker实现
│   ├── agents/                        # 智能体Worker
│   │   ├── agents-worker.service.ts          # Worker服务
│   │   └── agents-temporal-client.service.ts  # 客户端服务
│   └── news/                          # 新闻Worker
│       └── news-worker.service.ts             # Worker服务
├── workflows/                         # 工作流定义
│   ├── news/                          # 新闻工作流
│   │   ├── news-crawling.workflow.ts  # 新闻爬取工作流
│   │   └── news.activities.ts         # 新闻活动接口
│   ├── agents/                        # 智能体工作流
│   │   ├── agent-analysis.activities.ts # 智能体分析活动
│   │   ├── mcp.activities.ts          # MCP活动接口
│   │   └── policy-analysis.activities.ts # 政策分析活动
│   └── stock-analysis.workflow.ts     # 股票分析工作流
├── interfaces/                        # 接口定义
│   ├── connection.ts                  # 连接相关接口
│   ├── worker.ts                      # Worker相关接口
│   └── workflow.ts                    # 工作流相关接口
├── config/                            # 配置文件
│   ├── connection.config.ts            # 连接配置
│   ├── worker.config.ts                # Worker配置
│   └── workflow.config.ts              # 工作流配置
├── managers/                          # 管理器
│   ├── connection.manager.ts           # 连接管理器
│   ├── worker.manager.ts               # Worker管理器
│   └── workflow.manager.ts             # 工作流管理器
└── temporal.module.ts                  # Temporal统一模块
```

### 模块导入规范
- **统一入口**: 所有Temporal功能通过 `src/temporal/temporal.module.ts` 统一导入
- **调度器服务**: 位于 `src/temporal/schedulers/[业务领域]/` 目录
- **Worker实现**: 位于 `src/temporal/workers/[业务领域]/` 目录
- **工作流定义**: 位于 `src/temporal/workflows/[业务领域]/` 目录
- **管理器组件**: 位于 `src/temporal/managers/` 目录，提供底层管理功能

**示例用法**:
```typescript
// 新闻模块导入调度器服务
import { IntelligentAnalysisSchedulerService } from '../../temporal/schedulers/news/intelligent-analysis-scheduler.service';

@Module({
  imports: [
    ConfigModule,
    TemporalModule, // 导入统一Temporal模块
  ],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
```

### 架构优势
1. **统一管理**: 所有Temporal相关功能集中在一个模块中
2. **清晰分离**: 调度器、Worker、工作流各自独立
3. **易于扩展**: 新增业务领域时只需在相应目录下创建文件
4. **依赖清晰**: 通过统一模块管理所有依赖关系

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

### MCP SDK调用规范 ⭐

**统一规范**: 项目中所有MCP调用必须通过 `MCPClientSDKService` 进行，基于 `@modelcontextprotocol/sdk`

#### 核心原则
- **统一入口**: 使用 `MCPClientSDKService.callTool()` 方法调用所有MCP工具
- **SDK优先**: 基于官方 MCP SDK，确保协议兼容性和稳定性
- **工具映射**: 将业务工具名称映射到MCP服务的实际工具名称
- **连接管理**: SDK自动处理连接管理、重连和错误处理

#### MCP工具映射规则
| 业务工具名称 | MCP工具名称 | 用途说明 | 调用成本 |
|-------------|------------|----------|----------|
| `get_stock_basic_info` | `brief` | 股票基础信息 | 低 |
| `get_stock_realtime_data` | `brief` | 实时行情数据 | 低 |
| `search_stocks` | `brief` | 股票搜索 | 低 |
| `get_market_overview` | `brief` | 市场概况 | 低 |
| `get_stock_historical_data` | `medium` | 历史行情数据 | 中 |
| `get_stock_financial_data` | `medium` | 财务数据 | 中 |
| `get_stock_technical_indicators` | `full` | 技术指标 | 高 |
| `get_stock_news` | `full` | 股票新闻 | 高 |

#### 标准调用示例
```typescript
// 注入服务
constructor(
  private readonly mcpClient: MCPClientSDKService
) {}

// 调用MCP工具
const result = await this.mcpClient.callTool('get_stock_basic_info', {
  stock_code: '600519'
});
```

#### 股票代码自动转换
- **输入格式**: `600519` 或 `000001`
- **输出格式**: `SH600519` 或 `SZ000001`
- **转换规则**: 6、9开头 → SH；0、3开头 → SZ

### 股票分析标准流程 ⭐
```
1. 获取股票基础信息（公司名称、代码、所属行业/板块、上市时间、市值规模等）
2. 收集公司基本面数据（财务报表、营收/利润趋势、毛利率、资产负债情况、现金流等）
3. 分析行业环境（行业赛道前景、政策导向、市场规模、竞争格局、上下游产业链关系）
4. 研究公司竞争优势（核心技术、品牌壁垒、市场份额、成本控制能力、管理层能力等）
5. 查看市场情绪与资金动向（近期股价走势、成交量变化、机构持仓变动、股东人数趋势）
6. 评估估值水平（计算PE、PB、PS等估值指标，对比行业均值及历史分位）
7. 梳理风险因素（政策风险、行业周期波动、公司经营隐患、市场系统性风险等）
8. 综合信息给出判断（判断股票投资价值、潜在空间与风险，形成初步结论）
```

### 按需调用原则 ⚠️
**核心原则**: 每个智能体专门负责特定的MCP服务调用，避免重复调用控制成本

### 智能体职责分工
| 智能体 | MCP服务调用 | 职责说明 | 对应分析流程 |
|--------|-------------|----------|-------------|
| BasicDataAgent | get_stock_basic_info, get_stock_realtime_data | 基础数据获取 | 流程1：基础信息 |
| TechnicalAnalystAgent | get_stock_historical_data, get_stock_technical_indicators | 技术分析 | 流程5：市场情绪与资金动向 |
| FundamentalAnalystAgent | get_stock_financial_data | 基本面分析 | 流程2：基本面数据 |
| NewsAnalystAgent | get_stock_news | 新闻情绪分析 | 流程5：市场情绪补充 |
| IndustryAnalystAgent | 待定 | 行业环境分析 | 流程3：行业环境 |
| CompetitiveAnalystAgent | 待定 | 竞争优势分析 | 流程4：竞争优势 |
| ValuationAnalystAgent | 待定 | 估值分析 | 流程6：估值水平 |
| RiskAnalystAgent | 待定 | 风险分析 | 流程7：风险因素 |
| UnifiedOrchestratorAgent | 无MCP调用 | 整合所有结果 | 流程8：综合判断 |

### 工作流程
```
第一阶段：数据收集（并行执行）
├── BasicDataAgent: 基础信息 + 实时数据
├── FundamentalAnalystAgent: 财务数据
├── TechnicalAnalystAgent: 历史数据 + 技术指标  
└── NewsAnalystAgent: 新闻数据

第二阶段：专业分析（基于第一阶段数据）
├── IndustryAnalystAgent: 行业环境分析
├── CompetitiveAnalystAgent: 竞争优势分析
├── ValuationAnalystAgent: 估值水平分析
└── RiskAnalystAgent: 风险因素分析

第三阶段：决策整合
└── UnifiedOrchestratorAgent: 综合所有结果生成最终投资建议
```

### LLM调用执行记录规范 ⭐

**核心设计**: `AgentExecutionRecord` 统一存储所有LLM调用记录，不再按agent类型水平分表

#### 记录内容要求
- **调用追踪**: 记录完整的LLM调用链路和上下文信息
- **成本监控**: 详细记录消耗的token数量（input/output/total）
- **性能统计**: 记录调用耗时、成功/失败状态
- **上下文保存**: 保存请求参数、响应结果供后续分析
- **关联信息**: 建立与业务流程的关联关系

#### 自动记录机制
- **BaseAgent集成**: 所有继承自BaseAgent的智能体自动记录LLM调用
- **透明化**: 业务逻辑无需关注记录过程，由基础设施层自动处理
- **实时落盘**: 每次LLM调用完成后立即存储到数据库
- **异常捕获**: 记录调用失败的错误信息和异常堆栈

#### 核心字段规范
- **会话追踪**: sessionId关联同一业务请求的多次LLM调用
- **智能体标识**: agentType和agentName明确调用来源
- **模型信息**: llmProvider和llmModel记录具体使用的LLM
- **Token统计**: inputTokens/outputTokens/totalTokens精确记录消耗
- **状态管理**: status字段追踪调用状态(pending/success/failed)
- **元数据扩展**: metadata字段存储额外的业务上下文信息

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

# MCP服务配置
MCP_API_KEY=your_mcp_api_key        # MCP专用API密钥
DASHSCOPE_API_KEY=your_api_key      # DashScope LLM API密钥 

# Temporal
TEMPORAL_HOST=localhost:7233
TEMPORAL_WORKER_ENABLED=true

# 功能开关
ENABLE_CACHE=false  # 开发阶段禁用缓存
INTELLIGENT_ANALYSIS_SCHEDULER_ENABLED=true  # 智能分析调度器开关
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
- src/common/temporal/workflows/news/news-crawling.workflow.ts # 智能分析工作流
- src/temporal/schedulers/news/intelligent-analysis-scheduler.service.ts # 智能分析调度器

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