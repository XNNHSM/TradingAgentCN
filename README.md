# TradingAgentCN

基于大语言模型(LLM)和阿里云百炼MCP协议的智能交易决策系统，专门针对中国A股市场设计。通过三阶段增强版工作流、9个专业智能体协同分析、实时数据采集和多维度智能分析，为投资者提供专业的交易建议和风险评估。

## 🎯 核心价值

- **三阶段智能工作流**: 数据收集 → 专业分析 → 决策整合的完整分析链路
- **9个专业智能体**: 按需调用，严格遵循股票分析8步标准流程
- **全景深度分析**: 基本面、技术面、行业环境、竞争优势、估值、风险6大维度
- **MCP+LLM双引擎**: MCP数据获取 + LLM智能分析的完美结合
- **成本可控**: 按需调用原则，避免重复MCP调用，智能成本管理

## 🏗️ 技术架构

### 技术栈
- **框架**: NestJS + TypeScript + TypeORM
- **智能体**: LangChain.js + 阿里云百炼MCP协议
- **数据获取**: MCP (Model Context Protocol) 统一接口
- **主要LLM**: 阿里云百炼(DashScope)
- **数据库**: PostgreSQL + Redis
- **工作流引擎**: Temporal - 分布式工作流协调和状态管理
- **部署**: Docker 容器化

### 增强版三阶段工作流架构
```
API接口层 → NestJS服务层 → Temporal工作流引擎 → 三阶段智能体工作流 → MCP协议层 → 阿里云百炼数据服务 → 存储缓存层

三阶段工作流详细架构：
第一阶段：数据收集 (MCP+LLM) → 第二阶段：专业分析 (纯LLM) → 第三阶段：决策整合 (纯LLM)
```

### 三阶段9智能体架构 (增强版)
```
第一阶段：数据收集阶段
├── BasicDataAgent          # 基础信息+实时数据 (MCP+LLM)
├── TechnicalAnalystAgent   # 历史+技术指标 (MCP+LLM)
├── FundamentalAnalystAgent # 财务数据 (MCP+LLM)
└── NewsAnalystAgent        # 新闻数据 (MCP+LLM)

第二阶段：专业分析阶段 (纯LLM)
├── IndustryAnalystAgent    # 行业环境分析
├── CompetitiveAnalystAgent # 竞争优势分析
├── ValuationAnalystAgent   # 估值水平分析
└── RiskAnalystAgent        # 风险因素分析

第三阶段：决策整合阶段 (纯LLM)
└── UnifiedOrchestratorAgent # 综合决策生成
```

### 股票分析8步标准流程映射

| 分析步骤 | 对应智能体 | MCP工具调用 | LLM分析内容 |
|---------|-----------|-------------|------------|
| 1. 股票基础信息 | BasicDataAgent | get_stock_basic_info, get_stock_realtime_data | 公司概况、市值分析 |
| 2. 基本面数据 | FundamentalAnalystAgent | get_stock_financial_data | 财务健康度、盈利能力 |
| 3. 行业环境 | IndustryAnalystAgent | 无 (基于已有数据) | 行业前景、政策影响 |
| 4. 竞争优势 | CompetitiveAnalystAgent | 无 (基于已有数据) | 护城河、市场地位 |
| 5. 市场情绪 | TechnicalAnalystAgent + NewsAnalystAgent | get_stock_historical_data, get_stock_technical_indicators, get_stock_news | 技术走势、资金流向、新闻情绪 |
| 6. 估值水平 | ValuationAnalystAgent | 无 (基于已有数据) | PE/PB分析、估值合理性 |
| 7. 风险因素 | RiskAnalystAgent | 无 (基于已有数据) | 风险识别、风险量化 |
| 8. 综合判断 | UnifiedOrchestratorAgent | 无 (基于已有数据) | 投资建议、行动计划 |

## 🚀 快速开始

### 环境要求
- Node.js 18+
- PostgreSQL 15+
- Redis 7.0+
- Temporal Server (通过Docker)
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 环境配置
1. 复制环境配置文件：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，配置数据库和Redis连接信息：
```bash
# 数据库配置 (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=test_123!
DB_DATABASE=trading_agent

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 阿里云百炼API配置 (必需)
DASHSCOPE_API_KEY=your_dashscope_api_key

# Temporal 工作流配置
TEMPORAL_HOST=localhost
TEMPORAL_PORT=7233
# 注意: TEMPORAL_NAMESPACE 和 TEMPORAL_TASK_QUEUE 已移除
# 现在由各模块根据新规范自行管理
WORKFLOW_EXECUTION_TIMEOUT=30m
ACTIVITY_EXECUTION_TIMEOUT=5m
ACTIVITY_RETRY_ATTEMPTS=3

# 环境标识 (用于 Temporal namespace 和 taskQueue 命名)
NODE_ENV=dev  # dev | test | stg | prd

# MCP智能体配置 (可选)
COMPREHENSIVE_ANALYST_MODEL=qwen-plus
COMPREHENSIVE_ANALYST_TEMPERATURE=0.7
COMPREHENSIVE_ANALYST_MAX_TOKENS=4000

TRADING_STRATEGIST_MODEL=qwen-plus  
TRADING_STRATEGIST_TEMPERATURE=0.6
TRADING_STRATEGIST_MAX_TOKENS=3000
```

### 数据库初始化
```bash
# 使用Docker快速启动PostgreSQL
docker run --name trading-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=test_123! \
  -e POSTGRES_DB=trading_agent \
  -p 5432:5432 -d postgres:15

# 或手动创建数据库
psql -U postgres -c "CREATE DATABASE trading_agent;"

# 运行数据库迁移（开发模式会自动同步表结构）
npm run start:dev
```

### 启动应用
```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

应用启动后访问：
- API服务: http://localhost:3000/api/v1
- API文档: http://localhost:3000/api-docs

### 智能体服务验证
```bash
# 运行智能体集成测试
npm test -- --testPathPattern="unified/.*\.spec\.ts"

# 运行MCP客户端测试  
npm test -- --testPathPattern="mcp-client.service.spec.ts"

# 运行完整的MCP集成测试
npm test -- --testPathPattern="mcp-integration.spec.ts"
```

## 📚 API 文档

### 自选股管理接口

#### 1. 获取自选股列表
```http
POST /api/v1/watchlist/list
Content-Type: application/json

{
  "page": 1,
  "limit": 20
}
```

#### 2. 添加自选股
```http
POST /api/v1/watchlist/add
Content-Type: application/json

{
  "stockCode": "600036",
  "stockName": "招商银行",
  "isHolding": false,
  "holdingQuantity": 0,
  "holdingPrice": 0
}
```

#### 3. 更新自选股
```http
POST /api/v1/watchlist/update
Content-Type: application/json

{
  "stockCode": "600036",
  "isHolding": true,
  "holdingQuantity": 200,
  "holdingPrice": 46.50
}
```

#### 4. 删除自选股
```http
POST /api/v1/watchlist/delete
Content-Type: application/json

{
  "stockCode": "600036"
}
```

#### 5. 获取持仓股票
```http
POST /api/v1/watchlist/holdings
Content-Type: application/json

{}
```

### 健康检查接口

#### 系统健康检查
```http
POST /api/v1/health/check
```

#### 数据库连接检查
```http
POST /api/v1/health/database
```

#### Redis连接检查
```http
POST /api/v1/health/redis
```

### 智能体分析接口 (新增)

#### 增强版股票分析 (三阶段工作流)
```http
POST /api/v1/analysis/analyze-enhanced
Content-Type: application/json

{
  "stockCode": "000001",
  "stockName": "平安银行"
}
```

**响应结构**:
```json
{
  "code": 200,
  "data": {
    "stage1DataCollection": {
      "basicDataAnalysis": "...",
      "technicalAnalysis": "...", 
      "fundamentalAnalysis": "...",
      "newsAnalysis": "..."
    },
    "stage2ProfessionalAnalysis": {
      "industryAnalysis": "...",
      "competitiveAnalysis": "...",
      "valuationAnalysis": "...",
      "riskAnalysis": "..."
    },
    "stage3DecisionIntegration": {
      "overallScore": 78,
      "recommendation": "买入",
      "confidence": 85,
      "keyDecisionFactors": ["基本面良好", "行业前景乐观"],
      "riskAssessment": ["市场波动风险"],
      "actionPlan": "建议在回调时分批买入"
    },
    "mcpDataSummary": {
      "basicInfo": {...},
      "realtimeData": {...},
      "historicalData": {...},
      "technicalIndicators": {...},
      "financialData": {...},
      "marketOverview": {...},
      "news": [{...}]
    }
  }
}
```

#### 传统单阶段分析 (兼容)
```http
POST /api/v1/agents/analyze-stock
Content-Type: application/json

{
  "stockCode": "000001",
  "stockName": "平安银行"
}
```

#### 批量股票分析
```http  
POST /api/v1/agents/analyze-batch
Content-Type: application/json

{
  "stocks": [
    {
      "stockCode": "000001",
      "stockName": "平安银行" 
    },
    {
      "stockCode": "600036",
      "stockName": "招商银行"
    }
  ]
}
```

#### 获取智能体状态
```http
POST /api/v1/agents/status
```

## 🔧 开发指南

### 项目结构
```
src/
├── common/           # 公共模块
│   ├── dto/         # 数据传输对象
│   ├── entities/    # 基础实体类
│   └── utils/       # 工具函数
├── config/          # 配置文件
├── modules/         # 业务模块
│   ├── analysis/    # 股票分析模块 (增强版API)
│   ├── watchlist/   # 自选股模块
│   ├── health/      # 健康检查模块
│   └── ...
├── agents/          # 智能体模块 (MCP+LLM架构)
│   ├── services/    # MCP客户端服务
│   │   ├── mcp-client.service.ts        # MCP协议客户端
│   │   └── llm.service.ts              # LLM调用服务
│   ├── unified/     # 9个专业智能体架构
│   │   ├── basic-data.agent.ts              # 基础数据智能体
│   │   ├── technical-analyst.agent.ts       # 技术分析师
│   │   ├── fundamental-analyst.agent.ts     # 基本面分析师
│   │   ├── news-analyst.agent.ts            # 新闻分析师
│   │   ├── industry-analyst.agent.ts        # 行业分析师
│   │   ├── competitive-analyst.agent.ts     # 竞争分析师
│   │   ├── valuation-analyst.agent.ts       # 估值分析师
│   │   ├── risk-analyst.agent.ts            # 风险分析师
│   │   └── unified-orchestrator.agent.ts   # 统一协调器
│   ├── temporal/    # Temporal Worker服务
│   ├── interfaces/  # 智能体接口定义
│   └── agents.module.ts # 智能体模块
├── workflows/       # Temporal 工作流模块
│   ├── orchestrators/  # 工作流协调器
│   │   ├── enhanced-stock-analysis.workflow.ts  # 增强版三阶段工作流
│   │   ├── stock-analysis.workflow.ts            # 传统股票分析工作流
│   │   ├── news-crawling.workflow.ts             # 新闻爬取工作流
│   │   └── daily-report.workflow.ts              # 每日报告工作流
│   ├── activities/     # 业务活动定义
│   │   ├── agent-analysis.activities.ts          # 智能体分析活动
│   │   ├── stock.activities.ts                   # 股票相关活动
│   │   ├── news.activities.ts                    # 新闻相关活动
│   │   └── analysis.activities.ts                # 分析相关活动
│   └── temporal/       # Temporal 配置
│       ├── client.ts                             # Temporal 客户端
│       ├── worker.ts                             # Temporal Worker
│       └── types.ts                              # 类型定义
├── app.module.ts    # 应用主模块
└── main.ts          # 应用入口
```

### 数据库规范
- 所有实体继承 `BaseEntity`
- 使用软删除，不进行物理删除
- 所有查询限制最多关联3张表
- 列表接口必须分页，最多200条记录

### 三阶段增强版工作流开发规范
- **阶段分工**: 第一阶段MCP数据获取+LLM基础分析，第二阶段纯LLM专业分析，第三阶段纯LLM决策整合
- **按需调用**: 严格遵循按需调用原则，每个智能体只调用其专门负责的MCP服务
- **8步标准流程**: 完全遵循股票分有8步标准流程（基础信息→基本面→行业→竞争→市场情绪→估值→风险→综合判断）
- **结果结构化**: 所有分析结果必须包含置信度评分(0-100)、关键决策因素、风险评估、行动计划
- **数据流转**: 第一阶段数据传递给后续阶段，避免重复MCP调用

### Temporal工作流开发规范
- **工作流协调**: 所有复杂业务流程通过Temporal工作流管理
- **原子化活动**: 每个Service方法作为单一Activity，保证原子性
- **状态管理**: 工作流状态由Temporal自动管理，支持故障恢复
- **错误重试**: 通过活动重试策略处理临时性错误
- **监控追踪**: 所有工作流执行状态可通过Web UI实时监控

### 缓存策略  
- 开发阶段缓存功能暂时禁用 (ENABLE_CACHE=false)
- Redis仅作为缓存层，所有数据必须落盘到PostgreSQL
- 缓存键命名规范: `模块:方法:参数`  
- 所有缓存必须设置TTL过期时间

## 🐳 Docker 部署

### 使用 Docker Compose

#### 快速启动（使用默认配置）
```bash
docker-compose up -d
```

#### 使用环境变量自定义配置

1. **复制环境变量模板**:
```bash
cp .env.example .env
```

2. **编辑 `.env` 文件配置数据库密码等**:
```bash
# PostgreSQL 配置
POSTGRES_PASSWORD=mySecurePassword123
POSTGRES_DB=trading_agent

# Redis 配置
REDIS_PASSWORD=myRedisPassword

# API 密钥
DASHSCOPE_API_KEY=your_actual_api_key
```

3. **使用自定义配置启动**:
```bash
docker-compose up -d
```

> 📝 **说明**: docker-compose 会自动加载 .env 文件中的环境变量

#### 常用环境变量组合

**使用命令行环境变量（临时覆盖）**:
```bash
# 修改数据库密码
POSTGRES_PASSWORD=newPassword docker-compose up -d

# 使用Redis密码
REDIS_PASSWORD=redisPass docker-compose up -d

# 自定义端口
# 应用端口修改为8080
APP_PORT=8080 docker-compose up -d

# 数据库服务端口
POSTGRES_PORT=5433 REDIS_PORT=6380 docker-compose up -d
```

**启动Redis管理界面**:
```bash
docker-compose --profile redis-ui up -d
```

**启动Temporal工作流服务**:
```bash
# 启动Temporal服务集群
docker-compose up temporal -d

# 查看Temporal Web UI (默认端口8088)
open http://localhost:8088

# 查看Temporal服务状态
docker-compose ps temporal temporal-admin-tools
```

### 手动构建
```bash
# 构建镜像
docker build -t trading-agent-cn .

# 运行容器
docker run -d \
  --name trading-agent-cn \
  -p 3000:3000 \
  -e DB_HOST=postgres \
  -e REDIS_HOST=redis \
  -e DASHSCOPE_API_KEY=your_api_key \
  trading-agent-cn
```

### Docker Compose 环境变量说明

| 变量名 | 默认值 | 说明 |
|---------|-------|------|
| `POSTGRES_VERSION` | `15` | PostgreSQL版本 |
| `POSTGRES_PORT` | `5432` | PostgreSQL端口 |
| `POSTGRES_USER` | `postgres` | 数据库用户名 |
| `POSTGRES_PASSWORD` | `test_123!` | 数据库密码 |
| `POSTGRES_DB` | `trading_agent` | 数据库名 |
| `APP_PORT` | `3000` | 应用对外服务端口（主机端口） |
| `PORT` | `3000` | 应用内部端口（容器端口） |
| `REDIS_VERSION` | `7-alpine` | Redis版本 |
| `REDIS_PORT` | `6379` | Redis端口 |
| `REDIS_PASSWORD` | `""` | Redis密码（空为无密码） |
| `REDIS_COMMANDER_PORT` | `8081` | Redis管理界面端口 |
| `TEMPORAL_VERSION` | `1.22` | Temporal Server版本 |
| `TEMPORAL_UI_PORT` | `8088` | Temporal Web UI端口 |
| `TEMPORAL_HOST_PORT` | `7233` | Temporal Server端口 |

## ⚡ Temporal 工作流规范

### Namespace 命名规范
**格式**: `{模块名}-{环境}`

```bash
# 示例
agents-dev      # 智能体模块开发环境
agents-prd      # 智能体模块生产环境
news-dev        # 新闻模块开发环境
news-prd        # 新闻模块生产环境
watchlist-dev   # 自选股模块开发环境
analysis-prd    # 分析模块生产环境
```

### TaskQueue 命名规范
**格式**: `{模块名}-{业务域}-{环境}`

```bash
# 核心业务功能
stock-analysis          # 股票分析任务队列
portfolio-monitoring    # 投资组合监控任务队列

# 新闻模块
news-crawling-dev       # 新闻爬取任务队列(开发环境)
news-processing-dev     # 新闻处理任务队列(开发环境)
news-crawling-prd       # 新闻爬取任务队列(生产环境)

# 自选股模块
watchlist-monitoring-dev    # 自选股监控任务队列(开发环境)
watchlist-alerts-prd        # 自选股提醒任务队列(生产环境)
```

### 配置方式
- 🚫 **移除全局配置**: 不再使用 `TEMPORAL_NAMESPACE` 和 `TEMPORAL_TASK_QUEUE` 环境变量
- ✅ **模块自定义**: 每个业务模块根据规范自行定义 namespace 和 taskQueue
- ✅ **环境隔离**: 通过 `NODE_ENV` 环境变量区分不同环境

### 使用示例
```typescript
// 客户端配置
const environment = process.env.NODE_ENV || 'dev';
const namespace = `agents-${environment}`;
const client = new Client({ connection, namespace });

// 工作流启动
const taskQueue = 'stock-analysis';
const handle = await client.workflow.start(stockAnalysisWorkflow, {
  taskQueue,
  workflowId: `stock-analysis-${stockCode}-${Date.now()}`,
});

// Worker配置  
const worker = await Worker.create({
  workflowsPath: require.resolve('./workflows'),
  activities,
  taskQueue: 'stock-analysis',
});
```

## 📊 监控与日志

- 应用日志存储在 `logs/` 目录
- 支持结构化日志输出 (JSON格式)
- 提供健康检查端点用于监控
- MCP连接状态实时监控
- **三阶段工作流监控**: 每个阶段的执行状态、持续时间、成功率
- **智能体性能指标**: 9个智能体的LLM调用次数、响应时间、成本统计
- **Temporal Web UI**: http://localhost:8088 - 工作流执行状态监控
- **工作流追踪**: 完整的执行历史、失败重试、性能指标

### 新增监控项目
- **MCP调用统计**: 每个智能体的MCP服务调用次数和成本
- **分阶段性能分析**: 每个阶段的平均耗时和资源消耗
- **LLM使用统计**: Token消耗、模型选择、调用成功率
- **决策质量评估**: 置信度分数、关键因素识别率

## 🧪 测试指南

### 运行测试
```bash
# 运行所有测试
npm run test

# 运行增强版工作流测试
npm test -- --testPathPattern="enhanced-stock-analysis"

# 运行MCP相关测试
npm test -- --testPathPattern="mcp"

# 运行智能体测试
npm test -- --testPathPattern="agents"

# 运行三阶段工作流集成测试
npm test -- --testPathPattern="agents-temporal-client.service.spec.ts"

# 运行测试并查看覆盖率
npm run test:cov
```

### 测试说明
- **增强版工作流测试**: 验证三阶段工作流的完整执行流程
- **MCP+LLM集成测试**: 验证MCP数据获取和LLM智能分析的结合
- **按需调用测试**: 验证每个智能体只调用其专门负责的MCP服务
- **8步流程测试**: 验证股票分有8步标准流程的完整覆盖
- **结果结构测试**: 验证三阶段分析结果的结构化输出

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系我们

如有问题或建议，请提交 [Issue](https://github.com/your-repo/trading-agent-cn/issues)

---

## 🎆 新版本亮点

### v2.0 增强版三阶段工作流
- ✨ **全新三阶段架构**: 数据收集 → 专业分析 → 决策整合
- 🤖 **9个专业智能体**: 从简单数据获取升级为全方位智能分析
- 🎨 **MCP+LLM双引擎**: 数据获取与智能分析的完美结合
- 📋 **8步标准流程**: 严格遵循股票分析专业流程
- 💰 **成本可控**: 按需调用原则，避免重复MCP调用
- 📈 **结果结构化**: 置信度评分、关键因素、行动计划
- 🚀 **新API端点**: `/api/v1/analysis/analyze-enhanced` 提供三阶段分析

---

🚀 **TradingAgentCN v2.0** - 三阶段增强版工作流，让智能投资决策更加专业、精准、可靠！