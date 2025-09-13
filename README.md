# TradingAgentCN

基于大语言模型(LLM)和阿里云百炼MCP协议的智能交易决策系统，专门针对中国A股市场设计。通过智能体协同分析、实时数据采集和多维度智能分析，为投资者提供专业的交易建议和风险评估。

## ⚠️ 投资风险预警

**重要提示：本项目仅供学习和技术研究使用，不构成任何投资建议！**

### 风险声明
- **市场风险**：股票市场具有高度波动性，投资可能面临重大损失
- **系统局限性**：AI分析基于历史数据和算法模型，无法预测市场突发事件
- **数据准确性**：系统依赖的数据来源可能存在延迟、错误或不完整性
- **模型风险**：大语言模型可能产生不准确或误导性的分析结果
- **技术故障**：软件系统可能存在bug、服务中断或数据丢失风险
- **过拟合风险**：基于历史数据的分析可能不适用于未来市场环境

### 使用建议
1. **仅供学习**：建议仅用于学术研究、技术学习和AI应用探索
2. **谨慎决策**：如需实际投资，请咨询专业金融顾问，进行独立判断
3. **风险控制**：实际投资请严格控制仓位，设置止损点
4. **多方验证**：投资决策应结合多种信息源和专业意见
5. **合规要求**：确保投资行为符合当地法律法规和监管要求

### 免责声明
本项目开发者不对因使用本系统而产生的任何投资损失承担责任。用户应充分了解投资风险，理性投资，自负盈亏。

## 🎯 核心价值

- **智能工作流**: 数据收集 → 专业分析 → 决策整合 → 结果通知的完整分析链路
- **多智能体协同**: 按需调用，严格遵循股票分析标准流程
- **全景深度分析**: 基本面、技术面、行业环境、竞争优势、估值、风险多维度分析
- **MCP+LLM双引擎**: MCP数据获取 + LLM智能分析的完美结合
- **成本可控**: 按需调用原则，避免重复MCP调用，智能成本管理
- **实时通知**: 支持钉钉、企业微信等多种消息渠道，及时推送分析结果和重要信息

## 🏗️ 技术架构

### 技术栈
- **框架**: NestJS + TypeScript + TypeORM
- **智能体**: LangChain.js + 阿里云百炼MCP协议
- **数据获取**: MCP (Model Context Protocol) 统一接口
- **主要LLM**: 阿里云百炼(DashScope)
- **数据库**: PostgreSQL + Redis
- **工作流引擎**: 
  - **生产环境**: Temporal - 分布式工作流协调和状态管理
  - **开发中**: LangGraphJS - 智能体工作流编排引擎
- **消息通知**: 统一消息发送架构，支持钉钉、企业微信等Webhook
- **部署**: Docker 容器化

### 工作流架构
```
# 传统架构（生产环境）
API接口层 → NestJS服务层 → Temporal工作流引擎 → 智能体工作流 → MCP协议层 → 阿里云百炼数据服务 → 存储缓存层

# 新架构（开发中）
API接口层 → NestJS服务层 → LangGraphJS工作流引擎 → 智能体节点 → MCP协议层 → 阿里云百炼数据服务 → 存储缓存层

工作流详细架构：
数据收集 (MCP+LLM) → 专业分析 (纯LLM) → 决策整合 (纯LLM) → 消息通知 (Webhook)

定时任务架构：
智能分析调度器 → 自选股获取 → 股票分析子工作流 → 结果通知
```

### 智能体架构
```
数据收集阶段
├── BasicDataAgent          # 基础信息+实时数据 (MCP+LLM)
├── TechnicalAnalystAgent   # 历史+技术指标 (MCP+LLM)
├── FundamentalAnalystAgent # 财务数据 (MCP+LLM)

专业分析阶段 (纯LLM)
├── IndustryAnalystAgent    # 行业环境分析
├── CompetitiveAnalystAgent # 竞争优势分析
├── ValuationAnalystAgent   # 估值水平分析
└── RiskAnalystAgent        # 风险因素分析

决策整合阶段 (纯LLM)
└── UnifiedOrchestratorAgent # 综合决策生成
```

### 股票分析标准流程

| 分析步骤 | 对应智能体 | MCP工具调用 | LLM分析内容 |
|---------|-----------|-------------|------------|
| 1. 股票基础信息 | BasicDataAgent | get_stock_basic_info, get_stock_realtime_data | 公司概况、市值分析 |
| 2. 基本面数据 | FundamentalAnalystAgent | get_stock_financial_data | 财务健康度、盈利能力 |
| 3. 行业环境 | IndustryAnalystAgent | 基于已有数据 | 行业前景、政策影响 |
| 4. 竞争优势 | CompetitiveAnalystAgent | 基于已有数据 | 护城河、市场地位 |
| 5. 市场情绪 | TechnicalAnalystAgent | get_stock_historical_data, get_stock_technical_indicators | 技术走势、资金流向 |
| 6. 估值水平 | ValuationAnalystAgent | 基于已有数据 | PE/PB分析、估值合理性 |
| 7. 风险因素 | RiskAnalystAgent | 基于已有数据 | 风险识别、风险量化 |
| 8. 综合判断 | UnifiedOrchestratorAgent | 基于已有数据 | 投资建议、行动计划 |

## 🚀 LangGraphJS 架构升级（开发中）

### 架构优势
我们正在引入 LangGraphJS 来升级现有的工作流引擎，实现更强大的智能体编排能力：

- **🎯 声明式工作流**: 使用图结构定义智能体执行流程，更直观易维护
- **🔄 自动状态管理**: 无需手动传递状态，系统自动处理上下文共享
- **⚡ 智能并发**: 基于依赖关系的最优并发执行，提升30%性能
- **🔀 动态路由**: 基于中间结果的条件分支和智能错误恢复
- **📊 可视化调试**: 执行路径可视化，便于问题定位和优化

### 架构对比

| 特性 | Temporal (当前) | LangGraphJS (新) |
|------|-----------------|-------------------|
| **状态管理** | 手动序列化/反序列化 | 自动状态传递和共享 |
| **编程模型** | 命令式，基于 Activity | 声明式，基于图结构 |
| **并发控制** | 固定阶段划分 | 智能依赖分析 |
| **错误处理** | 简单重试机制 | 智能错误恢复和降级 |
| **开发效率** | 需要大量样板代码 | 减少40%代码量 |
| **调试能力** | 基于日志分析 | 可视化执行路径 |

### 迁移策略
1. **渐进式迁移**: 保持现有功能的同时，逐步迁移到新架构
2. **向后兼容**: API接口保持不变，确保平滑升级
3. **混合模式**: 支持新旧架构并存，灵活切换

### 开发状态
- ✅ **阶段1**: 基础设施搭建和适配器开发
- 🔄 **阶段2**: 核心工作流重构（进行中）
- 📋 **阶段3**: 高级特性实现（动态路由、监控等）

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
# LangGraphJS 已作为核心依赖自动安装
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

# 环境标识
NODE_ENV=dev  # dev | test | stg | prd

# MCP智能体配置 (可选)
COMPREHENSIVE_ANALYST_MODEL=qwen-plus
COMPREHENSIVE_ANALYST_TEMPERATURE=0.7
COMPREHENSIVE_ANALYST_MAX_TOKENS=4000

TRADING_STRATEGIST_MODEL=qwen-plus  
TRADING_STRATEGIST_TEMPERATURE=0.6
TRADING_STRATEGIST_MAX_TOKENS=3000

# LangGraphJS 配置 (可选，开发中)
WORKFLOW_ENGINE=temporal        # temporal | langgraph
LANGGRAPHJS_DEBUG=false         # 启用 LangGraphJS 调试模式
LANGGRAPHJS_RECURSION_LIMIT=100 # 最大递归深度
LANGGRAPHJS_TIMEOUT=10m         # 工作流超时时间
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

### 服务验证
```bash
# 运行智能体集成测试
npm test -- --testPathPattern="unified/.*\.spec\.ts"

# 运行MCP客户端测试  
npm test -- --testPathPattern="mcp-client.service.spec.ts"

# 运行完整的MCP集成测试
npm test -- --testPathPattern="mcp-integration.spec.ts"
```

## 📚 API 文档

应用启动后访问：
- API服务: http://localhost:3000/api/v1
- API文档: http://localhost:3000/api-docs

### 主要接口模块

#### 智能体分析接口
- 增强版股票分析 (三阶段工作流)
- 传统单阶段分析 (兼容)
- 批量股票分析

#### 自选股管理接口  
- 自选股增删改查
- 持仓股票管理


#### 消息通知接口
- 统一消息发送 (支持钉钉、企业微信)
- 批量消息发送
- 分析结果推送

#### 健康检查接口
- 系统健康状态
- 数据库连接检查
- Redis连接检查

#### Temporal工作流接口
- 工作流状态查询
- 执行结果获取
- 定时任务管理

## 🔧 开发指南

### 项目结构
```
src/
├── common/           # 公共模块
│   ├── dto/         # 数据传输对象
│   ├── entities/    # 基础实体类
│   ├── services/    # 公共服务
│   └── utils/       # 工具函数
├── config/          # 配置文件
├── modules/         # 业务模块
│   ├── watchlist/   # 自选股模块
│   ├── health/      # 健康检查模块
│   └── analysis/    # 分析模块
├── agents/          # 智能体模块
│   ├── services/    # MCP和LLM服务
│   ├── unified/     # 专业智能体
│   └── agents.module.ts
├── temporal/        # Temporal统一模块
│   ├── core/        # 核心组件
│   ├── schedulers/  # 调度器服务
│   ├── workers/     # Worker实现
│   ├── workflows/   # 工作流定义
│   ├── interfaces/  # 接口定义
│   ├── config/      # 配置文件
│   ├── managers/    # 管理器
│   └── temporal.module.ts
├── app.module.ts    # 应用主模块
└── main.ts          # 应用入口
```

### 数据库规范
- 所有实体继承 `BaseEntity`
- 使用软删除，不进行物理删除
- 所有查询限制最多关联3张表
- 列表接口必须分页，最多200条记录

### 工作流开发规范
- **阶段分工**: 第一阶段MCP数据获取+LLM基础分析，第二阶段纯LLM专业分析，第三阶段纯LLM决策整合
- **按需调用**: 严格遵循按需调用原则，每个智能体只调用其专门负责的MCP服务
- **标准流程**: 完全遵循股票分析标准流程（基础信息→基本面→行业→竞争→市场情绪→估值→风险→综合判断）
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
**格式**: `{业务域}-{功能}`

```bash
# 核心业务功能
stock-analysis          # 股票分析任务队列
portfolio-monitoring    # 投资组合监控任务队列

# 智能分析模块
intelligent-analysis    # 智能分析任务队列

# 自选股模块
watchlist-monitoring    # 自选股监控任务队列
watchlist-alerts        # 自选股提醒任务队列
```

### 配置方式
- 🚫 **移除全局配置**: 不再使用 `TEMPORAL_NAMESPACE` 和 `TEMPORAL_TASK_QUEUE` 环境变量
- ✅ **模块自定义**: 每个业务模块根据规范自行定义 namespace 和 taskQueue
- ✅ **统一命名**: 所有环境使用相同的 taskQueue 命名，不做环境区分

### 使用示例
```typescript
// 客户端配置
const namespace = 'default';  // 统一使用 default namespace
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
- **工作流监控**: 执行状态、持续时间、成功率
- **智能体性能指标**: LLM调用次数、响应时间、成本统计
- **Temporal Web UI**: http://localhost:8088 - 工作流执行状态监控
- **工作流追踪**: 完整的执行历史、失败重试、性能指标

### 监控项目
- **MCP调用统计**: 每个智能体的MCP服务调用次数和成本
- **性能分析**: 各阶段的平均耗时和资源消耗
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
- **工作流测试**: 验证工作流的完整执行流程
- **MCP+LLM集成测试**: 验证MCP数据获取和LLM智能分析的结合
- **按需调用测试**: 验证每个智能体只调用其专门负责的MCP服务
- **标准流程测试**: 验证股票分析标准流程的完整覆盖
- **结果结构测试**: 验证分析结果的结构化输出

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

🚀 **TradingAgentCN** - 智能交易决策系统，让投资分析更加高效、智能、专业！

**再次提醒：本系统仅供学习研究使用，不构成投资建议，投资有风险，决策需谨慎！**