# TradingAgentCN 智能体系统使用指南

## 📖 概述

TradingAgentCN 智能体系统是一个基于多智能体协作的股票分析决策系统，通过不同角色的AI智能体协同工作，为投资者提供全方位的股票分析和交易建议。

## 🏗️ 智能体架构

### 智能体层次结构

```
交易智能体系统/
├── 分析师团队
│   ├── 市场分析师 (技术分析)
│   ├── 基本面分析师 (财务分析)
│   └── 新闻分析师 (情绪分析)
├── 研究团队
│   ├── 多头研究员 (乐观观点)
│   └── 空头研究员 (风险分析)
├── 交易团队
│   ├── 保守型交易员 (风险控制)
│   └── 激进型交易员 (收益优化)
└── 反思系统
    └── 反思智能体 (质量控制)
```

### 工作流程

1. **分析师阶段** (并行执行)
   - 市场分析师: 技术指标分析
   - 基本面分析师: 财务数据分析
   - 新闻分析师: 新闻情绪分析

2. **研究员阶段** (基于分析师结果)
   - 多头研究员: 构建看涨论据
   - 空头研究员: 识别风险因素

3. **交易员阶段** (综合决策)
   - 保守型交易员: 风险控制导向
   - 激进型交易员: 收益优化导向

4. **反思阶段** (质量控制)
   - 反思智能体: 综合评估和质量控制

## 🚀 快速开始

### 1. 环境配置

复制环境配置文件：
```bash
cp .env.example .env
```

配置必需的API密钥：
```bash
# 阿里云百炼API密钥 (必需)
DASHSCOPE_API_KEY=your_dashscope_api_key_here

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_mysql_password
DB_DATABASE=trading_agent_cn

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 2. 获取百炼API密钥

1. 访问 [阿里云百炼控制台](https://dashscope.console.aliyun.com/)
2. 注册/登录阿里云账号
3. 开通百炼服务
4. 创建API密钥
5. 将密钥配置到 `.env` 文件中

### 3. 启动服务

```bash
# 安装依赖
npm install

# 启动开发模式
npm run start:dev
```

## 📊 API 使用指南

### 基础接口

访问 API 文档: http://localhost:3000/api-docs

### 核心接口

#### 1. 快速分析
```http
POST /api/v1/analysis/quick
Content-Type: application/json

{
  "stockCode": "600036",
  "stockName": "招商银行"
}
```

#### 2. 完整分析
```http
POST /api/v1/analysis/full
Content-Type: application/json

{
  "stockCode": "600036",
  "stockName": "招商银行"
}
```

#### 3. 获取分析记录
```http
POST /api/v1/analysis/list
Content-Type: application/json

{
  "page": 1,
  "limit": 20,
  "stockCode": "600036"
}
```

#### 4. 获取分析详情
```http
POST /api/v1/analysis/detail
Content-Type: application/json

{
  "id": "1"
}
```

## 🎯 智能体详细说明

### 分析师团队

#### 市场分析师 (MarketAnalystAgent)
- **职责**: 技术指标分析
- **分析内容**: 移动平均线、MACD、RSI、布林带等
- **输出**: 技术面评分、趋势分析、支撑阻力位

#### 基本面分析师 (FundamentalAnalystAgent)
- **职责**: 公司基本面分析
- **分析内容**: 财务比率、盈利能力、成长性、估值
- **输出**: 基本面评分、财务健康度、投资价值

#### 新闻分析师 (NewsAnalystAgent)
- **职责**: 新闻情绪分析
- **分析内容**: 公司新闻、行业动态、市场情绪
- **输出**: 情绪评分、舆论影响、催化剂事件

### 研究团队

#### 多头研究员 (BullResearcherAgent)
- **职责**: 构建看涨投资论据
- **特点**: 专注于挖掘投资机会和上涨潜力
- **输出**: 投资亮点、增长潜力、竞争优势

#### 空头研究员 (BearResearcherAgent)
- **职责**: 识别投资风险和问题
- **特点**: 谨慎评估，重点关注风险因素
- **输出**: 风险评估、估值担忧、负面因素

### 交易团队

#### 保守型交易员 (ConservativeTraderAgent)
- **特点**: 风险控制为第一要务
- **决策原则**: 风险第一，收益第二
- **输出**: 风险评级、止损建议、仓位控制

#### 激进型交易员 (AggressiveTraderAgent)
- **特点**: 专注于捕捉高收益机会
- **决策原则**: 追求收益，适度承担风险
- **输出**: 收益潜力、目标价位、催化剂因素

### 反思系统

#### 反思智能体 (ReflectionAgent)
- **职责**: 质量控制和综合评估
- **功能**: 分析质量评估、逻辑一致性检查、改进建议
- **输出**: 团队表现评估、最终建议、关键洞察

## 📋 分析结果解读

### 评分系统
- **0-30分**: 不建议投资，风险较高
- **31-50分**: 谨慎观望，存在不确定性
- **51-70分**: 可以考虑，适度投资
- **71-90分**: 较好机会，建议投资
- **91-100分**: 优质标的，强烈推荐

### 交易建议
- **强烈买入**: 多方面指标优秀，建议大仓位
- **买入**: 整体偏好，建议适度投资
- **持有**: 维持现状，观察后续发展
- **卖出**: 存在风险，建议减仓
- **强烈卖出**: 风险较大，建议清仓

### 置信度
- **0-0.3**: 低置信度，结论存在较大不确定性
- **0.3-0.7**: 中等置信度，结论基本可信
- **0.7-1.0**: 高置信度，结论较为可靠

## ⚙️ 配置说明

### 智能体配置
可通过环境变量调整智能体行为：

```bash
# 默认超时时间(秒)
AGENT_DEFAULT_TIMEOUT=30

# 最大重试次数
AGENT_MAX_RETRIES=3

# 创造性参数(0-1)
AGENT_DEFAULT_TEMPERATURE=0.7

# 最大输出长度
AGENT_DEFAULT_MAX_TOKENS=2000
```

### LLM配置
主要使用阿里云百炼，支持以下模型：
- `qwen-turbo`: 快速响应
- `qwen-plus`: 平衡性能 (默认)
- `qwen-max`: 最高质量
- `qwen-max-longcontext`: 长文本处理

## 🔧 开发和扩展

### 添加新智能体

1. 创建智能体类：
```typescript
import { Injectable } from '@nestjs/common';
import { BaseAgent } from '../base/base-agent';

@Injectable()
export class MyCustomAgent extends BaseAgent {
  constructor(llmService: LLMService) {
    super('自定义智能体', AgentType.CUSTOM, '智能体描述', llmService, config);
  }

  protected async buildPrompt(context: AgentContext): Promise<string> {
    // 构建提示词逻辑
  }
}
```

2. 注册到智能体模块：
```typescript
// agents.module.ts
@Module({
  providers: [
    // ... 其他智能体
    MyCustomAgent,
  ],
  exports: [
    // ... 其他导出
    MyCustomAgent,
  ],
})
export class AgentsModule {}
```

### 自定义分析流程

可在 `AgentOrchestratorService` 中定义新的分析流程：

```typescript
async executeCustomAnalysis(context: AgentContext): Promise<CustomResult> {
  // 自定义分析逻辑
}
```

## 📝 使用示例

### 基本使用示例

```javascript
// 快速分析招商银行
const quickResult = await fetch('http://localhost:3000/api/v1/analysis/quick', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stockCode: '600036',
    stockName: '招商银行'
  })
});

const analysis = await quickResult.json();
console.log('分析结果:', analysis);
```

### 完整分析示例

```javascript
// 完整分析平安银行
const fullResult = await fetch('http://localhost:3000/api/v1/analysis/full', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stockCode: '000001',
    stockName: '平安银行'
  })
});

const analysis = await fullResult.json();
console.log('完整分析:', analysis.data.results);
```

## 🚨 注意事项

1. **API密钥安全**: 确保API密钥安全，不要泄露到公共代码库
2. **请求频率**: 注意LLM API的调用频率限制
3. **数据更新**: 确保输入的股票数据是最新的
4. **结果解读**: 分析结果仅供参考，不构成投资建议
5. **风险控制**: 任何投资都存在风险，请谨慎决策

## 🆘 故障排除

### 常见问题

#### 1. API密钥错误
```
错误: DASHSCOPE_API_KEY 未配置
解决: 检查 .env 文件中的API密钥配置
```

#### 2. 数据库连接失败
```
错误: connect ECONNREFUSED 127.0.0.1:3306
解决: 确保MySQL服务正在运行并且配置正确
```

#### 3. Redis连接失败
```
错误: connect ECONNREFUSED 127.0.0.1:6379
解决: 确保Redis服务正在运行
```

#### 4. 分析超时
```
错误: 分析执行超时
解决: 增加 AGENT_DEFAULT_TIMEOUT 值或检查网络连接
```

### 日志调试

启用详细日志：
```bash
LOG_LEVEL=debug npm run start:dev
```

查看智能体执行日志：
```bash
# 过滤智能体相关日志
npm run start:dev 2>&1 | grep "Agent"
```

## 📞 技术支持

如有问题，请：
1. 查看本文档的故障排除部分
2. 检查系统日志
3. 提交Issue到项目仓库
4. 联系技术团队

---

🚀 **TradingAgentCN** - 让AI智能体助力投资决策！