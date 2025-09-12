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
- **消息通知**: 统一的消息发送和通知管理

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
│   ├── analysis/             # 股票分析接口
│   └── message/              # 消息通知模块
│       ├── adapters/         # 消息适配器
│       │   └── webhook/      # Webhook消息适配器
│       ├── interfaces/       # 接口定义
│       ├── providers/        # 消息提供者
│       ├── entities/         # 实体定义
│       └── dtos/             # 数据传输对象
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
- **TaskQueue**: 使用简洁业务名称 (`stock-analysis`)

### 核心工作流
| 工作流 | TaskQueue | 功能描述 |
|--------|-----------|----------|
| 股票分析 | `stock-analysis` | MCP数据获取→智能分析→决策生成 |

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
├── workflows/              # 工作流定义
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
│   └── agents/                        # 智能体调度器
│       ├── agents-temporal-client.service.ts  # 客户端服务
│       └── agents-worker.service.ts          # Worker服务
├── workers/                           # Worker实现
│   └── agents/                        # 智能体Worker
│       ├── agents-worker.service.ts          # Worker服务
│       └── agents-temporal-client.service.ts  # 客户端服务
├── workflows/                         # 工作流定义
│   ├── agents/                        # 智能体工作流
│   │   ├── agent-analysis.activities.ts # 智能体分析活动
│   │   └── mcp.activities.ts          # MCP活动接口
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
// 智能体模块导入调度器服务
import { AgentsTemporalClientService } from '../temporal/workers/agents/agents-temporal-client.service';

@Module({
  imports: [
    ConfigModule,
    TemporalModule, // 导入统一Temporal模块
  ],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
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
└── TechnicalAnalystAgent: 历史数据 + 技术指标

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

# 每日股票分析调度器配置
DAILY_STOCK_ANALYSIS_SCHEDULER_ENABLED=true  # 每日股票分析调度器开关
DAILY_STOCK_ANALYSIS_SCHEDULER_HOUR=2       # 调度执行小时（0-23）
DAILY_STOCK_ANALYSIS_SCHEDULER_MINUTE=0     # 调度执行分钟（0-59）
DAILY_STOCK_ANALYSIS_SCHEDULER_TIMEZONE=Asia/Shanghai  # 调度器时区

# 每日股票分析消息推送调度器配置
DAILY_STOCK_ANALYSIS_MESSAGE_SCHEDULER_ENABLED=true  # 每日股票分析消息推送调度器开关
DAILY_STOCK_ANALYSIS_MESSAGE_SCHEDULER_HOUR=9       # 消息推送小时（0-23）
DAILY_STOCK_ANALYSIS_MESSAGE_SCHEDULER_MINUTE=0     # 消息推送分钟（0-59）
DAILY_STOCK_ANALYSIS_MESSAGE_SCHEDULER_TIMEZONE=Asia/Shanghai  # 消息推送时区
DAILY_STOCK_ANALYSIS_MESSAGE_LOOKBACK_DAYS=1  # 查找多少天内的分析结果
DAILY_STOCK_ANALYSIS_MESSAGE_MAX_STOCKS=10  # 单条消息最多包含多少只股票

# 消息模块配置
MESSAGE_DINGTALK_ENABLED=false
MESSAGE_WECHAT_ENABLED=false
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

工具组件：
- src/common/utils/business-logger.util.ts    # 业务日志
- src/common/utils/date-time.util.ts          # 日期工具
- src/common/dto/result.dto.ts                # 响应格式

消息模块：
- src/temporal/workflows/message/message-send.activities.ts  # 消息发送Activity实现
- src/temporal/workflows/message/message-send-activities.registration.ts  # Activity注册服务
- src/temporal/workers/message/message-send-worker.service.ts  # 消息发送Worker服务
- src/modules/message/message.service.ts       # 消息服务
- src/modules/message/adapters/webhook/        # 消息提供者适配器
```

### 常见TaskQueue
```bash
stock-analysis      # 股票分析
message-send        # 消息发送
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

## 📨 消息模块架构

### 设计原则 ⭐
- **无Controller设计**: 移除HTTP控制器，专注于工作流集成和Activity调用
- **Temporal最佳实践**: 消息发送作为Temporal Activity，利用Temporal的重试机制
- **配置驱动**: 根据环境变量自动配置消息通道（钉钉、企业微信等）
- **工作流解耦**: 工作流不关心具体消息发送方式，由消息模块统一管理
- **多通道支持**: 支持并发发送到多个已配置的消息通道
- **可靠性**: 利用Temporal的Activity重试机制，无需自行实现重试逻辑

### 架构设计
```
股票分析工作流 → MessageSendActivities → MessageService → 消息提供者 → 外部消息渠道
```

### 核心组件
- **MessageSendActivities**: 消息发送Activity实现，提供具体的发送操作
- **MessageSendActivitiesRegistration**: Activity注册服务，管理Activity的Temporal Worker注册
- **MessageSendWorkerService**: 消息发送Worker服务，负责Worker的创建和管理
- **MessageService**: 消息服务，支持多通道并发发送和配置管理
- **消息提供者**: 钉钉机器人、企业微信机器人等具体实现

### 消息提供者架构 ⭐
```
IMessageProvider (接口)
├── AbstractMessageProvider (抽象基类)
    ├── AbstractWebhookProvider (Webhook抽象基类)
        ├── DingTalkProvider (钉钉机器人)
        └── WeChatProvider (企业微信机器人)
```

### 支持的消息类型
| 消息类型 | 描述 | 支持的提供者 |
|----------|------|-------------|
| 文本消息 | 纯文本内容 | 钉钉、企业微信 |
| Markdown消息 | Markdown格式内容 | 钉钉、企业微信 |
| 图文消息 | 带图片的消息 | 企业微信 |
| 卡片消息 | 卡片式消息 | 钉钉、企业微信 |

### 消息发送流程
1. **配置提供者**: 通过API配置消息提供者的参数
2. **发送消息**: 调用统一的发送接口，支持指定提供者或使用默认
3. **重试机制**: 内置指数退避重试策略，确保消息送达
4. **记录跟踪**: 自动记录发送结果和状态，便于监控和排查

### Activity接口
```typescript
// 工作流可调用的消息发送Activity
sendToAllProviders(params) - 发送消息到所有配置的提供者
sendToProvider(params) - 发送消息到指定提供者
```

### Activity重试机制
消息发送Activity利用Temporal的内置重试机制：
- **最大重试次数**: 3次
- **初始间隔**: 1秒
- **退避系数**: 2
- **最大间隔**: 30秒
- **超时时间**: 2分钟

### 环境变量配置
```bash
# 钉钉配置
MESSAGE_DINGTALK_ENABLED=true
MESSAGE_DINGTALK_ACCESS_TOKEN=your_token
MESSAGE_DINGTALK_WEBHOOK_URL=your_webhook_url
MESSAGE_DINGTALK_SECRET=your_secret
MESSAGE_DINGTALK_RETRY_TIMES=3
MESSAGE_DINGTALK_TIMEOUT=5000

# 企业微信配置
MESSAGE_WECHAT_ENABLED=true
MESSAGE_WECHAT_WEBHOOK_URL=your_webhook_url
MESSAGE_WECHAT_RETRY_TIMES=3
MESSAGE_WECHAT_TIMEOUT=5000
```

### 工作流集成示例
股票分析工作流完成后自动调用消息Activity发送分析结果：
```typescript
// 配置消息发送Activity
const { sendToAllProviders } = workflow.proxyActivities({
  taskQueue: 'message-send',
  startToCloseTimeout: '2m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
  },
});

// 发送消息
const messageParams = {
  messageType: 'stock-analysis',
  title: `📈 ${stockName} (${stockCode}) 分析报告`,
  content: formatAnalysisReport({...}),
  metadata: {...}
};

const sendResult = await sendToAllProviders(messageParams);
```

### 扩展新的消息提供者
1. 继承 `AbstractMessageProvider` 或 `AbstractWebhookProvider`
2. 实现 `formatWebhookMessage()` 方法
3. 实现 `validateConfig()` 方法
4. 在 `MessageService` 中注册新的提供者

---

## ⏰ 每日股票分析调度器

### 功能特性 ⭐
- **定时执行**: 每天凌晨2点自动启动所有自选股的股票分析
- **批量处理**: 并行启动多只股票的分析工作流，提高效率
- **消息控制**: 调度器触发的分析默认不发送消息，避免凌晨打扰
- **状态监控**: 提供调度器状态查询和手动触发功能
- **容错机制**: 单只股票分析失败不影响其他股票的分析

### 调度器架构
```
调度器服务 → 获取自选股列表 → 并行启动股票分析工作流 → 记录执行结果
```

### 核心组件
- **DailyStockAnalysisSchedulerService**: 主要调度器服务，负责定时执行和状态管理
- **TemporalSchedulersController**: 提供HTTP接口用于状态查询和手动触发
- **配置管理**: 通过环境变量控制调度器行为

### API接口
```typescript
# 股票分析调度器
GET /api/v1/temporal/schedulers/daily-stock-analysis/status    # 获取调度器状态
POST /api/v1/temporal/schedulers/daily-stock-analysis/trigger  # 手动触发分析
POST /api/v1/temporal/schedulers/daily-stock-analysis/start    # 启动调度器
POST /api/v1/temporal/schedulers/daily-stock-analysis/stop     # 停止调度器

# 消息推送调度器
GET /api/v1/temporal/schedulers/daily-stock-analysis-message/status    # 获取消息调度器状态
POST /api/v1/temporal/schedulers/daily-stock-analysis-message/trigger  # 手动触发消息推送
POST /api/v1/temporal/schedulers/daily-stock-analysis-message/start    # 启动消息调度器
POST /api/v1/temporal/schedulers/daily-stock-analysis-message/stop     # 停止消息调度器
```

### 环境变量配置
```bash
# 启用/禁用调度器
DAILY_STOCK_ANALYSIS_SCHEDULER_ENABLED=true

# 设置执行时间（24小时制）
DAILY_STOCK_ANALYSIS_SCHEDULER_HOUR=2
DAILY_STOCK_ANALYSIS_SCHEDULER_MINUTE=0

# 设置时区
DAILY_STOCK_ANALYSIS_SCHEDULER_TIMEZONE=Asia/Shanghai
```

### 工作流集成
调度器触发的股票分析工作流会设置特殊标记：
```typescript
{
  enableMessagePush: false,  // 不发送消息，避免凌晨打扰
  isScheduledRun: true,      // 标记为调度器触发
  metadata: {
    source: 'daily-scheduler',
    scheduledAt: new Date().toISOString()
  }
}
```

### 监控和日志
- **启动日志**: 记录调度器启动时间和配置
- **执行日志**: 记录每只股票的分析启动状态
- **错误处理**: 单只股票失败不影响整体流程
- **结果统计**: 记录成功和失败的分析数量

## 📮 每日股票分析消息推送调度器

### 功能特性 ⭐
- **定时推送**: 每天上午9点自动推送已完成的股票分析结果
- **数据汇总**: 汇总指定时间范围内的所有股票分析数据
- **智能分组**: 自动将分析结果分组，避免单条消息过长
- **格式化展示**: 提供美观的Markdown格式消息展示
- **统计分析**: 包含买入/持有/卖出建议统计和重点推荐

### 调度器架构
```
消息调度器 → 查询已完成分析记录 → 分组处理 → 格式化消息 → 推送到消息通道
```

### 核心组件
- **DailyStockAnalysisMessageSchedulerService**: 消息推送调度器服务
- **分析数据查询**: 基于AnalysisRecord实体查询已完成的分析
- **消息格式化**: 生成包含统计信息的Markdown格式消息
- **消息发送**: 通过MessageService发送到所有配置的消息通道

### 消息内容结构
- **总体概览**: 股票总数、平均评分、建议分布、置信度统计
- **重点推荐**: 高评分买入建议的股票推荐
- **详细结果**: 每只股票的具体分析和建议
- **时间范围**: 明确的分析数据时间范围

### 环境变量配置
```bash
# 启用/禁用消息推送调度器
DAILY_STOCK_ANALYSIS_MESSAGE_SCHEDULER_ENABLED=true

# 设置推送时间（上午9点）
DAILY_STOCK_ANALYSIS_MESSAGE_SCHEDULER_HOUR=9
DAILY_STOCK_ANALYSIS_MESSAGE_SCHEDULER_MINUTE=0

# 设置时区
DAILY_STOCK_ANALYSIS_MESSAGE_SCHEDULER_TIMEZONE=Asia/Shanghai

# 设置数据查找范围（查找昨天的分析结果）
DAILY_STOCK_ANALYSIS_MESSAGE_LOOKBACK_DAYS=1

# 设置单条消息最多包含的股票数量
DAILY_STOCK_ANALYSIS_MESSAGE_MAX_STOCKS=10
```

### 配合工作流程
消息推送调度器与股票分析调度器配合工作：
1. **凌晨2点**: 股票分析调度器启动，分析所有自选股（不发送消息）
2. **上午9点**: 消息推送调度器启动，汇总分析结果并发送消息

### 消息发送策略
- **并行发送**: 同时发送到所有配置的消息通道
- **分组处理**: 股票数量过多时自动分组发送
- **容错处理**: 单个消息通道失败不影响其他通道
- **结果记录**: 记录每个消息通道的发送结果

---

**架构核心理念**: 通过MCP协议统一数据获取，Temporal协调工作流，按需调用智能体，实现成本可控的智能交易决策系统。