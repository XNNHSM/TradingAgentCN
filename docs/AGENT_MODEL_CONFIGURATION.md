# 智能体模型配置指南

## 🎯 配置原则

### 分层配置架构
```
智能体专用配置 → 全局默认配置 → 硬编码默认值
```

### 模型选择策略
根据智能体的职责和复杂度，选择合适的模型：

| 智能体类型 | 推荐模型 | 配置变量 | 硬编码默认值 | 说明 |
|-----------|----------|----------|-------------|------|
| 数据获取智能体 | qwen-turbo | `DATA_COLLECTOR_MODEL` | qwen-turbo | 轻量模型，主要用于数据解析和简单分析 |
| 综合分析师 | qwen-max | `COMPREHENSIVE_ANALYST_MODEL` | qwen-max | 最强模型，需要复杂的多维分析能力 |
| 交易策略师 | qwen-plus | `TRADING_STRATEGIST_MODEL` | qwen-plus | 平衡模型，策略制定需要逻辑推理能力 |

## 🔧 环境变量配置

### 全局默认配置
```bash
# 默认LLM模型 (所有智能体的fallback)
LLM_DEFAULT_MODEL=qwen-plus

# 默认LLM参数
LLM_DEFAULT_TEMPERATURE=0.7
LLM_DEFAULT_MAX_TOKENS=4000
LLM_DEFAULT_TIMEOUT=60
LLM_MAX_RETRIES=3
```

### 智能体专用配置

#### 数据获取智能体
```bash
# 模型配置 - 使用轻量模型以降低成本
DATA_COLLECTOR_MODEL=qwen-turbo
DATA_COLLECTOR_TEMPERATURE=0.3  # 低温度，更准确的解析
DATA_COLLECTOR_MAX_TOKENS=2000  # 较少token，主要用于数据解析
DATA_COLLECTOR_TIMEOUT=30       # 较短超时
DATA_COLLECTOR_RETRY_COUNT=2    # 较少重试
```

#### 综合分析师
```bash
# 模型配置 - 使用最强模型进行复杂分析
COMPREHENSIVE_ANALYST_MODEL=qwen-max
COMPREHENSIVE_ANALYST_TEMPERATURE=0.7  # 标准温度，保持分析的创造性
COMPREHENSIVE_ANALYST_MAX_TOKENS=4000  # 大token，支持详细分析
COMPREHENSIVE_ANALYST_TIMEOUT=60       # 标准超时
COMPREHENSIVE_ANALYST_RETRY_COUNT=3    # 标准重试
```

#### 交易策略师
```bash
# 模型配置 - 使用平衡模型进行策略制定
TRADING_STRATEGIST_MODEL=qwen-plus
TRADING_STRATEGIST_TEMPERATURE=0.6     # 稍低温度，策略更稳定
TRADING_STRATEGIST_MAX_TOKENS=3000     # 适中token，策略描述需要一定篇幅
TRADING_STRATEGIST_TIMEOUT=45          # 稍短超时
TRADING_STRATEGIST_RETRY_COUNT=3       # 标准重试
```

## 📊 配置优先级

### 配置读取顺序
1. **智能体专用配置**: `{AGENT_NAME}_MODEL`
2. **全局默认配置**: `LLM_DEFAULT_MODEL`
3. **硬编码默认值**: 代码中指定的默认值

### 配置示例
```typescript
// 以综合分析师为例
const model = configService.get<string>(
  "COMPREHENSIVE_ANALYST_MODEL",        // 1. 优先使用智能体专用配置
  configService.get<string>(
    "LLM_DEFAULT_MODEL",                // 2. 其次使用全局默认配置
    "qwen-max"                          // 3. 最后使用硬编码默认值
  )
);
```

## 💰 成本优化建议

### 模型成本对比 (每1K tokens)
- **qwen-turbo**: ¥0.003 (最便宜，适合数据解析)
- **qwen-plus**: ¥0.012 (平衡性价比，适合策略制定)  
- **qwen-max**: ¥0.120 (最贵但能力最强，适合复杂分析)

### 成本优化策略
1. **数据获取智能体**: 使用 qwen-turbo，降低数据解析成本
2. **综合分析师**: 使用 qwen-max，确保分析质量
3. **交易策略师**: 使用 qwen-plus，平衡成本与效果

### 预期成本节约
```
原方案: 所有智能体都用 qwen-plus
优化方案: 分层模型策略
节约比例: 约 30-40% 的LLM调用成本
```

## ⚙️ 实际配置示例

### 开发环境 (.env.development)
```bash
# 开发环境可以使用更便宜的模型进行测试
LLM_DEFAULT_MODEL=qwen-plus
DATA_COLLECTOR_MODEL=qwen-turbo
COMPREHENSIVE_ANALYST_MODEL=qwen-plus  # 开发时不需要最强模型
TRADING_STRATEGIST_MODEL=qwen-turbo    # 开发时可以降级
```

### 生产环境 (.env.production)
```bash
# 生产环境使用推荐的模型配置
LLM_DEFAULT_MODEL=qwen-plus
DATA_COLLECTOR_MODEL=qwen-turbo
COMPREHENSIVE_ANALYST_MODEL=qwen-max   # 生产环境使用最强分析能力
TRADING_STRATEGIST_MODEL=qwen-plus
```

## 🔄 动态配置调整

### 运行时模型切换
系统支持在运行时动态调整模型配置，无需重启应用：

1. 更新环境变量或配置文件
2. 下次智能体实例化时会读取新配置
3. 通过监控指标评估效果

### A/B测试支持
可以通过配置文件进行A/B测试：
```bash
# A组配置
COMPREHENSIVE_ANALYST_MODEL=qwen-max

# B组配置  
COMPREHENSIVE_ANALYST_MODEL=qwen-plus
```

## 📈 性能监控

### 关键指标
- **响应时间**: 不同模型的平均响应时间
- **成本消耗**: 每次分析的token消耗和费用
- **质量评估**: 分析结果的准确性和有用性

### 建议监控方式
```typescript
// 在执行记录中记录模型信息
{
  agentType: 'COMPREHENSIVE_ANALYST',
  llmModel: 'qwen-max',
  inputTokens: 1200,
  outputTokens: 800,
  totalCost: 0.24,  // 基于token数计算的成本
}
```

## 🎯 最佳实践

1. **根据任务复杂度选择模型**: 简单任务用便宜模型，复杂分析用强模型
2. **定期评估成本效益**: 监控不同模型的效果和成本
3. **分环境配置**: 开发环境可以使用cheaper模型降低成本
4. **预留调优空间**: 支持动态调整配置进行优化
5. **文档化决策**: 记录每个智能体选择特定模型的原因