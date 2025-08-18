# LLM适配器架构

基于Python版本设计的可扩展LLM适配器系统，支持多种大语言模型提供商。

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLMServiceV2 (服务管理器)                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ • 多提供商管理     • 错误处理和重试   • 健康检查和监控    │ │
│  │ • 负载均衡和后备   • 统计和日志记录   • 配置热更新        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ DashScopeAdapter│ │ OpenAIAdapter   │ │ GeminiAdapter   │
│ (阿里百炼)      │ │ (未来扩展)      │ │ (未来扩展)      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
            │                 │                 │
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   DashScope     │ │   OpenAI API    │ │   Google AI     │
│   API           │ │                 │ │   Studio        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## 🎯 设计特性

### 1. 可扩展架构
- **基础适配器抽象**: `BaseLLMAdapter` 定义了统一接口
- **插件式设计**: 新适配器只需继承基类即可集成
- **配置驱动**: 通过环境变量控制行为

### 2. 高可用性
- **主备切换**: 主提供商失败时自动切换到备用
- **健康检查**: 定期检查提供商可用性
- **重试机制**: 支持指数退避重试

### 3. 完整监控
- **统计信息**: 请求次数、成功率、平均响应时间
- **详细日志**: 结构化日志，便于监控和调试
- **成本追踪**: 自动计算Token使用成本

## 🚀 快速开始

### 1. 基本使用

```typescript
import { LLMServiceV2 } from './llm-adapters';

// 注入服务
constructor(private readonly llmService: LLMServiceV2) {}

// 简单文本生成
const response = await this.llmService.generate("你好，世界！", {
  model: "qwen-plus",
  temperature: 0.7,
  maxTokens: 100,
});

// 详细响应（包含使用统计）
const detailResponse = await this.llmService.generateWithDetails("分析股票", {
  model: "qwen-max",
  temperature: 0.6,
  maxTokens: 2000,
});

console.log(`用了 ${detailResponse.usage?.totalTokens} 个token`);
console.log(`成本: $${detailResponse.usage?.cost}`);
```

### 2. 工具调用 (Function Calling)

```typescript
const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_stock_data",
      description: "获取股票数据",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "股票代码" },
          days: { type: "number", description: "天数" }
        },
        required: ["symbol"]
      }
    }
  }
];

const response = await this.llmService.generateWithDetails(
  "帮我分析平安银行(000001)最近的表现", 
  {
    model: "qwen-plus",
    tools,
    toolChoice: "auto"
  }
);

if (response.toolCalls) {
  console.log("模型想调用工具:", response.toolCalls);
}
```

### 3. 批量处理

```typescript
const prompts = [
  "分析苹果公司",
  "分析特斯拉",
  "分析微软"
];

const responses = await this.llmService.generateBatch(prompts, {
  model: "qwen-turbo",
  concurrency: 3, // 并发数
  maxTokens: 500
});

responses.forEach((response, index) => {
  console.log(`${prompts[index]}: ${response.content}`);
});
```

## 🛠️ 配置

### 环境变量

```bash
# 基础配置
LLM_PRIMARY_PROVIDER=dashscope          # 主提供商
LLM_FALLBACK_PROVIDERS=openai,gemini    # 备用提供商（逗号分隔）
LLM_ENABLE_FALLBACK=true                # 启用备用切换
LLM_MAX_RETRIES=3                       # 最大重试次数
LLM_RETRY_DELAY=1000                    # 重试延迟(ms)
LLM_HEALTH_CHECK_INTERVAL=300000        # 健康检查间隔(ms)

# DashScope配置
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxx       # API密钥
DASHSCOPE_BASE_URL=https://...          # API基础URL(可选)
DASHSCOPE_STANDARD_MODEL=qwen-plus      # 默认模型
```

### 代码配置

```typescript
// 在agents.module.ts中配置
@Module({
  providers: [
    DashScopeAdapter,
    // OpenAIAdapter,    // 未来添加
    // GeminiAdapter,    // 未来添加
    LLMServiceV2,
  ],
})
export class AgentsModule {}
```

## 📊 监控和统计

### 1. 服务状态

```typescript
// 获取整体统计
const stats = this.llmService.getServiceStats();
console.log(stats);
// {
//   totalAdapters: 1,
//   availableAdapters: 1,
//   primaryProvider: "dashscope",
//   fallbackEnabled: true
// }

// 获取提供商详细状态
const providerStatus = this.llmService.getProviderStatus();
providerStatus.forEach(status => {
  console.log(`${status.name}: ${status.available ? '可用' : '不可用'}`);
  console.log(`成功率: ${(1 - status.totalFailures/status.totalRequests) * 100}%`);
  console.log(`平均响应时间: ${status.averageResponseTime}ms`);
});
```

### 2. 健康检查

```typescript
// 手动触发健康检查
const healthResults = await this.llmService.triggerHealthCheck();
healthResults.forEach((healthy, provider) => {
  console.log(`${provider}: ${healthy ? '健康' : '异常'}`);
});
```

### 3. 成本监控

```typescript
// 获取支持的模型和定价
const allModels = this.llmService.getAllSupportedModels();
allModels.forEach((models, provider) => {
  models.forEach(model => {
    console.log(`${provider}/${model.name}: $${model.costPer1kInputTokens}/1k input tokens`);
  });
});
```

## 🔧 添加新的适配器

### 1. 创建适配器类

```typescript
// src/agents/services/llm-adapters/openai-adapter.ts
import { BaseLLMAdapter } from './base-llm-adapter';

export class OpenAIAdapter extends BaseLLMAdapter {
  constructor(private readonly configService: ConfigService) {
    super("openai");
  }

  async initialize(): Promise<void> {
    // 初始化逻辑
  }

  isAvailable(): boolean {
    // 检查API密钥等
    return !!this.apiKey;
  }

  async generateWithDetails(
    prompt: string | LLMMessage[],
    config?: LLMConfig,
  ): Promise<LLMResponse> {
    // 实现OpenAI API调用
  }

  getSupportedModels(): ModelInfo[] {
    return [
      {
        name: "gpt-4",
        description: "GPT-4",
        contextLength: 8192,
        supportsFunctionCalling: true,
        costPer1kInputTokens: 0.03,
        costPer1kOutputTokens: 0.06,
        recommendedFor: ["复杂推理", "代码生成"]
      }
    ];
  }

  getDefaultModel(): string {
    return "gpt-4";
  }
}
```

### 2. 注册适配器

```typescript
// src/agents/services/llm-adapters/llm-service-v2.ts
constructor(
  private readonly dashScopeAdapter: DashScopeAdapter,
  private readonly openaiAdapter: OpenAIAdapter, // 添加新适配器
) {
  this.loadConfiguration();
}

private async initializeAdapters(): Promise<void> {
  const adapters = [
    this.dashScopeAdapter,
    this.openaiAdapter, // 注册新适配器
  ];
  // ...
}
```

### 3. 更新模块配置

```typescript
// src/agents/agents.module.ts
@Module({
  providers: [
    DashScopeAdapter,
    OpenAIAdapter, // 添加到providers
    LLMServiceV2,
  ],
})
export class AgentsModule {}
```

## 🧪 测试

### 单元测试

```bash
# 测试特定适配器
npm test -- --testPathPattern="dashscope-adapter.spec.ts"

# 测试集成功能
npm test -- --testPathPattern="llm-integration.spec.ts"
```

### 性能测试

```typescript
// 测试批量处理性能
const startTime = Date.now();
const responses = await llmService.generateBatch(
  Array(10).fill("测试消息"),
  { concurrency: 5 }
);
console.log(`批量处理耗时: ${Date.now() - startTime}ms`);
```

## 🔍 故障排查

### 常见问题

1. **适配器初始化失败**
   ```
   检查: API密钥配置、网络连接、模块依赖
   ```

2. **所有提供商不可用**
   ```
   检查: 健康检查日志、API限额、网络问题
   ```

3. **工具调用失败**
   ```
   检查: 工具定义格式、模型是否支持Function Calling
   ```

4. **成本过高**
   ```
   检查: 模型选择、token使用量、批处理优化
   ```

### 调试技巧

```typescript
// 启用详细日志
process.env.LOG_LEVEL = "debug";

// 查看提供商状态
console.log(llmService.getProviderStatus());

// 检查模型支持
const models = llmService.getAllSupportedModels();
console.log(models.get("dashscope"));
```

## 🚀 最佳实践

### 1. 模型选择
- **qwen-turbo**: 快速响应，适合简单任务
- **qwen-plus**: 平衡性价比，适合大多数场景
- **qwen-max**: 最强性能，适合复杂分析

### 2. 错误处理
```typescript
try {
  const response = await llmService.generate(prompt, config);
  return response;
} catch (error) {
  if (error.message.includes("API")) {
    // API相关错误，可能需要重试或切换提供商
    logger.warn("API调用失败，已自动处理");
  } else {
    // 其他错误，需要人工介入
    logger.error("系统错误", error);
    throw error;
  }
}
```

### 3. 性能优化
- 合理设置 `maxTokens` 控制成本
- 使用批量处理提高吞吐量
- 选择合适的 `temperature` 值
- 启用缓存减少重复调用

### 4. 监控告警
```typescript
// 设置成功率告警
const status = llmService.getProviderStatus();
status.forEach(provider => {
  const successRate = 1 - (provider.totalFailures / provider.totalRequests);
  if (successRate < 0.95) {
    // 发送告警
    logger.error(`${provider.name} 成功率过低: ${successRate * 100}%`);
  }
});
```

## 🛣️ 发展路线图

### 短期目标
- [x] DashScope适配器完整实现
- [ ] OpenAI适配器实现
- [ ] Claude适配器实现
- [ ] 请求缓存机制

### 中期目标
- [ ] 流式响应支持
- [ ] 图像和多模态支持
- [ ] 更详细的成本分析
- [ ] A/B测试框架

### 长期目标
- [ ] 自动模型选择
- [ ] 智能负载均衡
- [ ] 实时性能优化
- [ ] 企业级管控台

## 📝 更新日志

### v2.0.0 (2025-08-18)
- 🎉 首次发布可扩展LLM适配器架构
- ✅ DashScope适配器完整实现
- ✅ 多提供商支持和自动切换
- ✅ 健康检查和监控系统
- ✅ 完整的测试覆盖

### 贡献指南

欢迎贡献新的适配器或功能改进！请确保：
1. 遵循现有代码风格
2. 添加完整的单元测试
3. 更新相关文档
4. 性能测试通过