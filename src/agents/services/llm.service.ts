import { Injectable, Logger, Optional } from "@nestjs/common";
import { 
  LLMServiceV2, 
  LLMConfig as LLMConfigV2
} from "./llm-adapters";

/**
 * 向后兼容的LLM响应结果接口
 */
export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost?: number;
  };
}

/**
 * 向后兼容的工具调用接口
 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}


/**
 * 向后兼容的LLM配置接口
 */
export interface LLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  tools?: any[]; // Function calling 工具定义
  toolChoice?: string; // 工具选择策略
}


/**
 * LLM服务管理器（向后兼容版本）
 * 内部使用新的LLMServiceV2，但保持旧接口以确保兼容性
 */
@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  constructor(
    @Optional() private readonly llmServiceV2?: LLMServiceV2, // 可选依赖
  ) {
    if (this.llmServiceV2) {
      this.logger.log("LLM服务已初始化，优先使用 LLMServiceV2");
    } else {
      this.logger.warn("LLMServiceV2 不可用，请检查配置");
    }
  }



  /**
   * 生成文本（优先使用新服务，保持向后兼容）
   */
  async generate(
    prompt: string,
    config?: LLMConfig & { provider?: string },
  ): Promise<string> {
    // 优先使用新服务
    if (this.llmServiceV2) {
      const newConfig: LLMConfigV2 = {
        ...config,
        toolChoice: config?.toolChoice === "auto" ? "auto" : config?.toolChoice === "none" ? "none" : undefined,
      };
      
      return await this.llmServiceV2.generate(prompt, newConfig);
    }
    
    // 如果没有新服务，抛出错误
    throw new Error("LLMServiceV2 不可用，请检查配置");
  }

  /**
   * 使用工具生成文本（优先使用新服务，保持向后兼容）
   */
  async generateWithTools(
    prompt: string,
    config?: LLMConfig & { provider?: string },
  ): Promise<LLMResponse> {
    // 优先使用新服务
    if (this.llmServiceV2) {
      const newConfig: LLMConfigV2 = {
        ...config,
        tools: config?.tools?.map(tool => ({
          type: "function" as const,
          function: {
            name: tool.function?.name || tool.name,
            description: tool.function?.description || tool.description,
            parameters: tool.function?.parameters || tool.parameters,
          },
        })),
        toolChoice: config?.toolChoice === "auto" ? "auto" : config?.toolChoice === "none" ? "none" : undefined,
      };
      
      const response = await this.llmServiceV2.generateWithDetails(prompt, newConfig);
      
      // 转换响应格式以保持兼容性
      return {
        content: response.content,
        toolCalls: response.toolCalls,
        finishReason: response.finishReason,
      };
    }
    
    // 如果没有新服务，抛出错误
    throw new Error("LLMServiceV2 不可用，请检查配置");
  }



}
