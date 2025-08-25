# 超时配置指南

## 🚨 问题描述

如果你看到以下错误信息：
```
[Nest] ERROR [DashScopeProvider] 百炼API调用失败: The operation was aborted due to timeout
[Nest] ERROR [LLMService] 文本生成失败，耗时: 30007ms, 错误: The operation was aborted due to timeout
```

这表示LLM API调用超时了。

## ⚙️ 解决方案

### 1. 调整全局超时设置

在 `.env` 文件中增加超时时间：

```bash
# LLM默认超时时间（秒）
LLM_DEFAULT_TIMEOUT=90  # 从30秒增加到90秒

# 其他相关配置
LLM_MAX_RETRIES=3       # 重试次数
```

### 2. 针对特定智能体调整超时

对于需要更长处理时间的智能体：

```bash
# 基本面分析师（通常需要更多时间）
FUNDAMENTAL_ANALYST_TIMEOUT=120

# 反思智能体（需要综合分析所有结果）
REFLECTION_AGENT_TIMEOUT=90

# 市场分析师
MARKET_ANALYST_TIMEOUT=60
```

### 3. 网络环境优化

#### 国内网络环境
```bash
# 考虑网络延迟，适当增加超时时间
LLM_DEFAULT_TIMEOUT=120
```

#### 海外网络环境
```bash
# 网络条件好，可以使用较短超时
LLM_DEFAULT_TIMEOUT=60
```

## 🔧 推荐配置

### 开发环境
```bash
LLM_DEFAULT_TIMEOUT=120
LLM_MAX_RETRIES=3
```

### 生产环境
```bash
LLM_DEFAULT_TIMEOUT=90
LLM_MAX_RETRIES=2
```

### 测试环境
```bash
LLM_DEFAULT_TIMEOUT=60
LLM_MAX_RETRIES=1
```

## 📊 性能考虑

### 复杂度与超时时间对应

| 分析复杂度 | 推荐超时时间 | 适用场景 |
|-----------|-------------|----------|
| 简单 | 30-45秒 | 市场快讯、简单技术分析 |
| 中等 | 60-90秒 | 标准股票分析、新闻分析 |
| 复杂 | 90-120秒 | 基本面深度分析、综合报告 |
| 极复杂 | 120-180秒 | 多股票对比、行业分析 |

## 🚀 重试机制

系统内置智能重试机制：

1. **指数退避**: 重试间隔逐渐增加
2. **超时感知**: 超时错误会有更长的重试间隔
3. **错误分类**: 区分网络错误和API错误

## 🛠️ 故障排除

### 检查网络连接
```bash
# 测试阿里云百炼API连通性
curl -I https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
```

### 验证API密钥
```bash
# 检查环境变量
echo $DASHSCOPE_API_KEY
```

### 日志分析
查看详细日志了解超时发生的具体环节：
```bash
# 设置调试级别日志
LOG_LEVEL=debug
```

## 📈 监控和优化

### 性能指标
- **平均响应时间**: 监控LLM调用的平均耗时
- **超时率**: 计算超时请求的比例
- **重试成功率**: 重试后成功的比例

### 优化建议
1. **分批处理**: 对于大量数据，考虑分批调用
2. **缓存策略**: 启用适当的缓存减少重复调用
3. **并发控制**: 控制并发请求数量避免API限流

## 🔗 相关配置

完整配置示例请参考：
- [环境变量配置文档](../README.md#环境变量配置)
- [智能体配置指南](./AGENT_CONFIGURATION.md)
- [性能调优指南](./PERFORMANCE_TUNING.md)

## 💡 最佳实践

1. **渐进式调整**: 从较小的超时值开始，逐步增加
2. **环境区分**: 不同环境使用不同的超时配置
3. **监控告警**: 设置超时率告警阈值
4. **优雅降级**: 超时时提供基础分析结果

---

如果问题仍然存在，请检查：
- 网络连接稳定性
- API密钥有效性
- 服务器资源使用情况
- 阿里云百炼服务状态