# 测试环境配置指南

## 环境变量配置

### 方式1: 使用 .env 文件（推荐）
1. 复制 `.env.example` 为 `.env`
2. 在 `.env` 文件中设置您的API密钥：
```bash
DASHSCOPE_API_KEY=your_actual_api_key_here
```

### 方式2: 使用系统环境变量
```bash
export DASHSCOPE_API_KEY=your_actual_api_key_here
```

### 方式3: 在测试时临时设置
```bash
DASHSCOPE_API_KEY=your_api_key npm test
```

## 测试配置文件

### .env.test
专门用于测试环境的配置文件，包含：
- 测试用数据库配置
- LLM服务配置
- 其他测试专用设置

**注意**: `.env.test` 不包含API密钥，API密钥会从 `.env` 文件或系统环境变量继承。

### test/setup.ts
Jest测试环境设置文件，负责：
- 加载环境变量（.env.test → .env → 系统环境变量）
- 设置测试超时时间
- 配置测试日志级别
- 验证API密钥可用性

## 运行测试

### 运行所有测试
```bash
npm test
```

### 运行特定测试文件
```bash
npm test -- src/agents/services/llm.service.spec.ts
```

### 运行测试并查看覆盖率
```bash
npm run test:cov
```

### 调试模式运行测试
```bash
npm run test:debug
```

## 测试模式说明

### 1. 完整API测试模式
- 条件：检测到有效的 `DASHSCOPE_API_KEY`
- 行为：运行所有测试，包括真实API调用
- 输出：`✓ 检测到有效的DASHSCOPE_API_KEY，将运行完整的API测试`

### 2. 模拟测试模式  
- 条件：未设置API密钥或密钥无效
- 行为：跳过真实API调用测试，运行基础功能测试
- 输出：`⚠ 未检测到有效的DASHSCOPE_API_KEY，将跳过真实API测试`

## 🔐 安全注意事项

⚠️ **重要：绝不要将API密钥提交到版本控制！**

### 安全文件管理
1. **敏感文件排除**
   - `.env` 文件已在 `.gitignore` 中排除
   - 只有 `.env.example` 和 `.env.test` 会被提交到git
   - `.env.test` 仅包含非敏感的配置参数

2. **API密钥配置**
   - ✅ 正确：在 `.env` 文件中配置
   - ✅ 正确：使用系统环境变量
   - ❌ 错误：写在代码文件中
   - ❌ 错误：写在 `.env.test` 中

3. **团队协作**
   - 每个开发者维护自己的 `.env` 文件
   - 使用 `.env.example` 作为配置模板
   - 在CI/CD中使用安全的环境变量管理

4. **测试隔离**
   - 测试环境使用独立的数据库（`trading_agent_test`）
   - 测试环境使用独立的Redis数据库（DB 1）

### 检查清单 ✅
- [ ] `.env` 文件未被提交到git
- [ ] API密钥仅存储在本地 `.env` 文件或系统环境变量中
- [ ] 代码中无硬编码的密钥或敏感信息
- [ ] `.env.test` 仅包含非敏感配置

## 故障排除

### 问题：测试超时
```bash
# 增加测试超时时间
npm test -- --testTimeout=60000
```

### 问题：API调用失败
1. 检查API密钥是否正确设置
2. 检查网络连接
3. 检查阿里云百炼服务状态

### 问题：模块找不到错误
```bash
# 清理并重新安装依赖
npm ci
```

### 问题：环境变量未加载
1. 确认 `.env` 文件位于项目根目录
2. 确认文件格式正确（`KEY=value`，无空格）
3. 确认 `dotenv` 依赖已安装