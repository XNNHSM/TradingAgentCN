# TradingAgentCN

基于大语言模型(LLM)的智能交易决策系统，专门针对中国A股市场设计。通过多智能体协作、实时数据采集、情绪分析和技术指标分析，为投资者提供专业的交易建议和风险评估。

## 🎯 核心价值

- **智能化决策**: 基于多LLM协作的投资决策引擎
- **全景分析**: 技术面、基本面、新闻情绪三维度综合分析
- **风险可控**: 内置风险管理和反思机制
- **实时响应**: 支持定时任务和手动触发的灵活决策模式

## 🏗️ 技术架构

### 技术栈
- **框架**: NestJS + TypeScript + TypeORM
- **智能体**: LangChain.js
- **主要LLM**: 阿里云百炼(DashScope)
- **数据库**: MySQL + Redis
- **部署**: Docker 容器化

### 架构设计
```
API 接口层 → NestJS 服务层 → 多智能体框架 → LLM 提供商层 → 数据服务层 → 存储缓存层
```

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

# 百炼API配置
DASHSCOPE_API_KEY=your_api_key
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

## 🔧 开发指南

### 项目结构
```
src/
├── common/           # 公共模块
│   ├── dto/         # 数据传输对象
│   ├── entities/    # 基础实体类
│   └── ...
├── config/          # 配置文件
├── modules/         # 业务模块
│   ├── watchlist/   # 自选股模块
│   ├── health/      # 健康检查模块
│   └── ...
├── agents/          # 智能体模块（待实现）
├── app.module.ts    # 应用主模块
└── main.ts          # 应用入口
```

### 数据库规范
- 所有实体继承 `BaseEntity`
- 使用软删除，不进行物理删除
- 所有查询限制最多关联3张表
- 列表接口必须分页，最多200条记录

### 缓存策略
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
  trading-agent-cn
```

## 📊 监控与日志

- 应用日志存储在 `logs/` 目录
- 支持结构化日志输出
- 提供健康检查端点用于监控

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