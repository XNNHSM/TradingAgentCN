# TradingAgentCN

基于大语言模型(LLM)和阿里云百炼MCP协议的智能交易决策系统，专门针对中国A股市场设计。通过统一智能体架构、实时数据采集、情绪分析和技术指标分析，为投资者提供专业的交易建议和风险评估。

## 🎯 核心价值

- **智能化决策**: 基于MCP协议的统一智能体决策引擎
- **全景分析**: 技术面、基本面、新闻情绪三维度综合分析
- **架构简化**: 从8个智能体简化为2个核心智能体，降低75%复杂度
- **数据统一**: 基于阿里云百炼MCP协议的统一数据获取接口
- **实时响应**: 支持定时任务和手动触发的灵活决策模式

## 🏗️ 技术架构

### 技术栈
- **框架**: NestJS + TypeScript + TypeORM
- **智能体**: LangChain.js + 阿里云百炼MCP协议
- **数据获取**: MCP (Model Context Protocol) 统一接口
- **主要LLM**: 阿里云百炼(DashScope)
- **数据库**: MySQL + Redis
- **部署**: Docker 容器化

### 新一代MCP架构设计
```
API接口层 → NestJS服务层 → 统一智能体框架 → MCP协议层 → 阿里云百炼数据服务 → 存储缓存层
```

### 智能体架构 (重构后)
```
统一智能体系统/
├── 综合分析师 (ComprehensiveAnalyst)
│   └── 集成技术分析 + 基本面分析 + 新闻分析
├── 交易策略师 (TradingStrategist) 
│   └── 集成多空分析 + 交易决策 + 风险管控
└── 统一协调服务 (UnifiedOrchestrator)
    └── MCP协议数据获取 + 智能体协调 + 决策生成
```

### MCP数据工具 (8个核心工具)
- `get_stock_basic_info` - 获取股票基本信息
- `get_stock_realtime_data` - 获取实时行情数据  
- `get_stock_historical_data` - 获取历史价格数据
- `get_stock_technical_indicators` - 获取技术指标
- `get_stock_financial_data` - 获取财务数据
- `get_market_overview` - 获取市场概览
- `search_stocks` - 搜索股票
- `get_stock_news` - 获取相关新闻

## 🚀 快速开始

### 环境要求
- Node.js 18+
- MySQL 8.0+
- Redis 7.0+
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
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=trading_agent_cn

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 阿里云百炼API配置 (必需)
DASHSCOPE_API_KEY=your_dashscope_api_key

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
# 创建数据库
mysql -u root -p -e "CREATE DATABASE trading_agent_cn CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

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

### 智能体决策接口 (新增)

#### 单个股票分析
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
│   ├── watchlist/   # 自选股模块
│   ├── health/      # 健康检查模块
│   └── ...
├── agents/          # 智能体模块 (MCP架构)
│   ├── services/    # MCP客户端服务
│   │   ├── mcp-client.service.ts        # MCP协议客户端
│   │   └── llm.service.ts              # LLM调用服务
│   ├── unified/     # 统一智能体架构
│   │   ├── comprehensive-analyst.agent.ts   # 综合分析师
│   │   ├── trading-strategist.agent.ts      # 交易策略师  
│   │   └── unified-orchestrator.service.ts # 统一协调服务
│   ├── interfaces/  # 智能体接口定义
│   └── agents.module.ts # 智能体模块
├── app.module.ts    # 应用主模块
└── main.ts          # 应用入口
```

### 数据库规范
- 所有实体继承 `BaseEntity`
- 使用软删除，不进行物理删除
- 所有查询限制最多关联3张表
- 列表接口必须分页，最多200条记录

### MCP智能体开发规范
- 所有数据获取通过MCP客户端服务，不直接调用外部API
- 智能体必须实现标准的AgentInterface接口
- 使用统一的日志记录格式和错误处理机制
- 所有分析结果必须包含置信度评分(0-100)
- 工具调用必须处理超时和重试机制

### 缓存策略  
- 开发阶段缓存功能暂时禁用 (ENABLE_CACHE=false)
- Redis仅作为缓存层，所有数据必须落盘到MySQL
- 缓存键命名规范: `模块:方法:参数`  
- 所有缓存必须设置TTL过期时间

## 🐳 Docker 部署

### 使用 Docker Compose
```bash
docker-compose up -d
```

### 手动构建
```bash
# 构建镜像
docker build -t trading-agent-cn .

# 运行容器
docker run -d \
  --name trading-agent-cn \
  -p 3000:3000 \
  -e DB_HOST=mysql \
  -e REDIS_HOST=redis \
  -e DASHSCOPE_API_KEY=your_api_key \
  trading-agent-cn
```

## 📊 监控与日志

- 应用日志存储在 `logs/` 目录
- 支持结构化日志输出 (JSON格式)
- 提供健康检查端点用于监控
- MCP连接状态实时监控
- 智能体分析性能指标跟踪

## 🧪 测试指南

### 运行测试
```bash
# 运行所有测试
npm run test

# 运行MCP相关测试
npm test -- --testPathPattern="mcp"

# 运行智能体测试
npm test -- --testPathPattern="agents"

# 运行测试并查看覆盖率
npm run test:cov
```

### 测试说明
- MCP测试使用模拟数据，不依赖真实API
- 智能体测试覆盖完整的分析流程
- 集成测试验证端到端的决策workflow

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

🚀 **TradingAgentCN** - 让智能投资决策触手可及！