/**
 * LLM适配器模块导出
 */

// 基础接口和抽象类
export * from "./base-llm-adapter";

// 具体适配器实现
export * from "./dashscope-adapter";

// 服务管理器现在在上级目录的 llm.service.ts 中

// 未来可以添加其他适配器
// export * from "./openai-adapter";
// export * from "./gemini-adapter";
// export * from "./claude-adapter";