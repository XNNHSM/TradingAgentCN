# Temporal 服务设置指南

TradingAgentCN 使用 Temporal 工作流引擎来管理股票分析任务。为了简化配置，统一使用 Temporal 自带的 `default` 命名空间。

## 快速启动（推荐）

```bash
# 使用 Docker Compose 启动 Temporal 服务
docker-compose -f docker-compose.temporal.yml up -d
```

**优势**:
- 无需复杂的命名空间配置
- 使用 Temporal 默认命名空间，开箱即用
- 包含完整的 Temporal + PostgreSQL + Web UI 环境

### 验证服务状态

```bash
# 检查服务运行状态
docker-compose -f docker-compose.temporal.yml ps

# 查看 Temporal 服务日志
docker-compose -f docker-compose.temporal.yml logs temporal

# 检查 default 命名空间（可选）
docker exec temporal-dev tctl --address localhost:7233 namespace list
```

### 方法二：使用 Temporal CLI（本地开发）

如果需要本地开发环境：

```bash
# 安装 Temporal CLI (macOS/Linux)
curl -sSf https://temporal.download/cli.sh | sh

# 或使用 Homebrew (macOS)
brew install temporal

# 启动开发服务器（包含 default 命名空间）
temporal server start-dev

# 验证连接
tctl namespace list
```

## 环境变量配置

```bash
# .env 文件
NODE_ENV=development        # 或 production
TEMPORAL_HOST=localhost     # Temporal 服务器地址
TEMPORAL_PORT=7233         # Temporal 服务器端口

# 注意：不再需要配置命名空间，统一使用 default
```

## 配置说明

- **命名空间**: 统一使用 `default`，无需额外配置
- **任务队列**: `agents-analysis`，简化队列管理
- **工作流ID**: `stock-analysis-{stockCode}-{date}` 格式，确保唯一性

## 故障排除

### 1. 连接失败

**错误信息**:
```
Connection refused to localhost:7233
```

**解决方案**:
1. 确保 Temporal 服务正在运行
2. 检查端口 7233 是否被占用
3. 验证 Docker 容器状态：`docker ps | grep temporal`

### 2. 工作流执行失败

**错误信息**:
```
WorkflowExecutionAlreadyStarted
```

**解决方案**:
- 这是正常行为，同一股票同一天只允许执行一次分析
- 可以等待当前工作流完成，或使用不同的股票代码测试

### 3. Docker Compose 启动失败

**解决方案**:
```bash
# 停止现有服务
docker-compose -f docker-compose.temporal.yml down

# 清理卷（如果需要）
docker-compose -f docker-compose.temporal.yml down -v

# 重新启动
docker-compose -f docker-compose.temporal.yml up -d
```

## 服务端口信息

**Docker Compose 方式**:
- **Temporal gRPC**: http://localhost:7233 (应用连接端口)
- **Temporal Web UI**: http://localhost:8080 (管理界面) 
- **PostgreSQL**: localhost:5433 (Temporal 数据库，避免与应用数据库冲突)

**访问 Web UI**:
- 浏览器打开: http://localhost:8080
- 可以查看工作流执行状态、历史记录等

## 单容器启动（仅开发测试）

```bash
# 使用官方轻量级镜像（仅用于快速测试）
docker run --rm -p 7233:7233 -p 8233:8233 temporalio/auto-setup:1.22
```

**注意**: 单容器方式数据不会持久化，重启后数据丢失。

## 验证设置

启动应用后，检查日志中是否出现：

```
[AgentsTemporalClientService] 智能体模块 Temporal 客户端已连接 | Context: namespace="default"
[AgentsWorkerService] 股票分析 Worker 启动成功 | Context: taskQueue="agents-analysis"
[AgentsWorkerService] 智能体模块 Workers 启动成功
```

## 总结

通过使用 `default` 命名空间：
- ✅ **简化配置**: 无需复杂的命名空间管理
- ✅ **开箱即用**: Temporal 默认包含 default 命名空间
- ✅ **减少错误**: 避免命名空间创建相关的问题
- ✅ **统一管理**: 所有环境使用相同配置，便于运维