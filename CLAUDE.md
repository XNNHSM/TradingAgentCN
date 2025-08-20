# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 🏗️ 系统架构概述

TradingAgentCN 是一个基于大语言模型(LLM)的智能交易决策系统，专门针对中国A股市场设计。系统采用全新的MCP(Model Context Protocol)架构，通过统一的智能体协作、阿里云百炼数据获取和先进的分析算法，为投资者提供专业的交易建议和风险评估。

### 技术栈
- **后端框架**: NestJS + TypeScript + TypeORM
- **数据获取协议**: 阿里云百炼MCP (Model Context Protocol)
- **主要LLM**: 阿里云百炼(DashScope) - qwen-plus/qwen-max
- **数据库**: MySQL + Redis
- **部署方案**: Docker 容器化

### 新一代MCP架构
```
API接口层 → NestJS服务层 → 统一智能体服务 → MCP客户端 → 阿里云百炼MCP → 股票数据服务
```

### 核心组件
1. **自选股管理**: 股票选择、持仓跟踪
2. **统一智能体引擎**: 综合分析师 + 交易策略师 (取代原8个智能体)
3. **MCP数据获取**: 通过阿里云百炼MCP协议获取实时股票数据
4. **智能决策**: 综合技术面、基本面、消息面的一体化分析

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

# 运行统一协调服务测试
npm test -- src/agents/unified/unified-orchestrator.service.spec.ts

# 运行基础智能体测试
npm test -- src/agents/base/base-agent.spec.ts

# 运行LLM服务测试
npm test -- src/agents/services/llm.service.spec.ts
```

⚠️ **MCP测试重要说明**:
- **MCP协议**: 测试使用阿里云百炼MCP协议获取股票数据
- **API密钥要求**: 需要配置有效的 `DASHSCOPE_API_KEY` 才能运行完整测试
- **网络依赖**: 测试依赖阿里云百炼MCP服务 (https://dashscope.aliyuncs.com/api/v1/mcps/qtf_mcp)
- **模拟数据**: MCP客户端在测试环境中使用模拟数据，保证测试稳定性
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
# 使用 Docker Compose 启动
docker-compose up -d

# 手动构建 Docker 镜像
docker build -t trading-agent-cn .
```

## 📁 项目结构

```
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
    ├── user/            # 用户管理(待实现)
    └── watchlist/       # 自选股管理
        ├── dto/         # 自选股DTOs
        ├── entities/    # 自选股实体
        ├── watchlist.controller.ts
        ├── watchlist.module.ts
        └── watchlist.service.ts
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
│  │                   MySQL 持久化存储                         │ │
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
- **MySQL**: 所有业务数据的主要持久化存储，包含核心业务数据、股票市场数据和系统运营数据
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
- **数据源**: 直接访问MySQL和外部API，不使用缓存层
- **性能考虑**: 开发阶段优先保证数据一致性，后续优化性能

### 数据流向设计 (无缓存模式)

#### 数据写入流程
```
1. 数据源 → 2. 业务处理 → 3. MySQL落盘
```

#### 数据读取流程
```
1. 直接查询MySQL → 2. 返回结果
```

### 缓存配置规范 (后续启用时)
- 模式: `模块:方法:参数`
- 示例: `watchlist:list:userId123`
- 所有缓存键必须设置TTL过期时间

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
⚠️ **统一日志格式**:
```typescript
// 标准日志格式
{
  "category": "分类标识",  // 如: HTTP_REQUEST, HTTP_RESPONSE, SERVICE_ERROR, SERVICE_INFO
  "message": "日志内容",   // JSON格式的详细信息
  "url": "相关URL"        // 可选，HTTP请求相关时必填
}
```

**HTTP请求日志规范**:
```typescript
// HTTP请求日志
this.logger.log(JSON.stringify({
  category: "HTTP_REQUEST",
  message: JSON.stringify({
    method: "GET",
    url: requestUrl,
    params: requestParams,
    headers: sanitizedHeaders  // 隐藏敏感信息
  }),
  url: requestUrl
}));

// HTTP响应日志
this.logger.log(JSON.stringify({
  category: "HTTP_RESPONSE", 
  message: JSON.stringify({
    status: response.status,
    data: responseData,
    duration: `${endTime - startTime}ms`
  }),
  url: requestUrl
}));

// 错误日志
this.logger.error(JSON.stringify({
  category: "HTTP_ERROR",
  message: JSON.stringify({
    error: error.message,
    stack: error.stack,
    context: contextData
  }),
  url: errorUrl
}));
```

**使用示例**:
```typescript
// 服务信息日志
this.logger.log(JSON.stringify({
  category: "SERVICE_INFO",
  message: "智兔数服API已就绪",
  url: ""
}));

// 业务错误日志  
this.logger.error(JSON.stringify({
  category: "BUSINESS_ERROR",
  message: JSON.stringify({
    operation: "获取股票数据",
    stockCode: "000001", 
    error: "数据解析失败"
  }),
  url: ""
}));
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
3. **启动数据库**: 确保MySQL和Redis正在运行
4. **运行开发模式**: `npm run start:dev`
5. **访问API文档**: http://localhost:3000/api-docs
6. **运行测试**: `npm run test`

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

## 📝 关键文件
- `src/main.ts`: 应用启动入口
- `src/app.module.ts`: 根模块配置
- `src/common/entities/base.entity.ts`: 包含标准字段的基础实体
- `src/common/dto/result.dto.ts`: 标准化API响应格式
- `prompt_templates.md`: AI智能体提示词模板