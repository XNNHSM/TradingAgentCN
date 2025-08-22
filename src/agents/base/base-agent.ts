import { Logger } from "@nestjs/common";
import {
  IAgent,
  AgentType,
  AgentStatus,
  AgentContext,
  AgentResult,
  AgentConfig,
  TradingRecommendation,
} from "../interfaces/agent.interface";
import { LLMService, LLMConfig, LLMResponse } from "../services/llm.service";
import { AgentExecutionRecordService } from "../services/agent-execution-record.service";

/**
 * 智能体基础抽象类
 */
export abstract class BaseAgent implements IAgent {
  protected readonly logger: Logger;
  protected status: AgentStatus = AgentStatus.IDLE;
  protected config: AgentConfig;

  constructor(
    public readonly name: string,
    public readonly type: AgentType,
    public readonly role: string,
    protected readonly llmService: LLMService,
    protected readonly dataToolkit?: any, // 保持兼容性，但已废弃
    config: Partial<AgentConfig> = {},
    protected readonly executionRecordService?: AgentExecutionRecordService,
  ) {
    this.logger = new Logger(this.constructor.name);
    this.config = {
      model: "qwen-plus",
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 90, // 增加到90秒，适应复杂分析任务
      retryCount: 3,
      systemPrompt: "",
      ...config,
    };
  }

  /**
   * 执行分析任务（支持 function calling）
   */
  async analyze(context: AgentContext): Promise<AgentResult> {
    const startTime = new Date();
    this.status = AgentStatus.ANALYZING;
    
    // 生成会话ID（如果context中没有）
    const sessionId = context.metadata?.sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    this.logger.log(
      `开始分析股票: ${context.stockCode} - ${context.stockName || "Unknown"} (Session: ${sessionId})`,
    );

    let llmResponse: LLMResponse;
    let prompt: string;
    let toolCalls: any[] = [];
    let toolResults: any[] = [];
    let result: AgentResult;
    let errorMessage: string;
    let errorStack: string;

    try {
      // 预处理上下文
      const processedContext = await this.preprocessContext(context);

      // 构建提示词
      prompt = await this.buildPrompt(processedContext);

      let analysis: string;

      // 先检查子类是否重写了performAnalysis方法（MCP模式）
      if (this.hasCustomPerformAnalysis()) {
        // 使用子类的自定义分析方法（MCP模式）
        analysis = await this.performAnalysis(processedContext);
        
        // 创建简化的LLMResponse
        llmResponse = {
          content: analysis,
          finishReason: 'stop',
          usage: {
            inputTokens: Math.floor(prompt.length / 4), // 粗略估算
            outputTokens: Math.floor(analysis.length / 4),
            totalTokens: Math.floor((prompt.length + analysis.length) / 4),
          }
        };
      } else if (this.dataToolkit) {
        // 传统的function calling模式
        // 获取可用工具
        const tools = this.dataToolkit.getToolDefinitions();

        // 调用LLM进行分析（支持工具调用）
        llmResponse = await this.callLLMWithTools(prompt, tools);

        // 记录工具调用
        if (llmResponse.toolCalls) {
          toolCalls = llmResponse.toolCalls;
        }

        // 处理工具调用
        const enhancedResponse = await this.processToolCalls(
          llmResponse,
          processedContext,
        );

        analysis = enhancedResponse.content;
        
        // 记录工具调用结果
        if (enhancedResponse.toolCalls) {
          toolResults = enhancedResponse.toolCalls.map(call => ({
            id: call.id,
            function: call.function.name,
            result: 'Tool execution completed', // 可以更详细地记录结果
          }));
        }
      } else {
        // 传统方式调用LLM
        const analysisResult = await this.callLLM(prompt);
        analysis = analysisResult;
        
        // 创建简化的LLMResponse
        llmResponse = {
          content: analysis,
          finishReason: 'stop',
          usage: {
            inputTokens: Math.floor(prompt.length / 4), // 粗略估算
            outputTokens: Math.floor(analysis.length / 4),
            totalTokens: Math.floor((prompt.length + analysis.length) / 4),
          }
        };
      }

      // 后处理分析结果
      result = await this.postprocessResult(analysis, processedContext);

      // 记录处理时间
      const endTime = new Date();
      result.processingTime = endTime.getTime() - startTime.getTime();
      result.timestamp = endTime;
      result.agentName = this.name;
      result.agentType = this.type;

      this.status = AgentStatus.COMPLETED;
      this.logger.log(`分析完成，耗时: ${result.processingTime}ms`);

      // 保存执行记录
      if (this.executionRecordService) {
        try {
          await this.executionRecordService.createExecutionRecord({
            sessionId,
            agentType: this.type,
            agentName: this.name,
            agentRole: this.role,
            stockCode: context.stockCode,
            stockName: context.stockName,
            context: processedContext,
            llmModel: this.config.model,
            inputPrompt: prompt,
            llmResponse,
            result,
            startTime,
            endTime,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            toolResults: toolResults.length > 0 ? toolResults : undefined,
            analysisType: context.metadata?.analysisType || 'single',
            environment: process.env.NODE_ENV || 'development',
          });
        } catch (recordError) {
          this.logger.warn(`保存执行记录失败: ${recordError.message}`);
          // 不影响主要流程
        }
      }

      return result;
      
    } catch (error) {
      this.status = AgentStatus.ERROR;
      errorMessage = error.message;
      errorStack = error.stack;
      
      this.logger.error(`分析失败: ${error.message}`, error.stack);

      // 创建错误结果
      const endTime = new Date();
      result = {
        agentName: this.name,
        agentType: this.type,
        analysis: `分析过程中发生错误: ${error.message}`,
        timestamp: endTime,
        processingTime: endTime.getTime() - startTime.getTime(),
        confidence: 0,
        score: 0,
      };

      // 保存错误执行记录
      if (this.executionRecordService) {
        try {
          await this.executionRecordService.createExecutionRecord({
            sessionId,
            agentType: this.type,
            agentName: this.name,
            agentRole: this.role,
            stockCode: context.stockCode,
            stockName: context.stockName,
            context,
            llmModel: this.config.model,
            inputPrompt: prompt || '构建提示词时出错',
            llmResponse: llmResponse || {
              content: '',
              finishReason: 'error',
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
            },
            result,
            startTime,
            endTime,
            toolCalls,
            toolResults,
            analysisType: context.metadata?.analysisType || 'single',
            environment: process.env.NODE_ENV || 'development',
            errorMessage,
            errorStack,
          });
        } catch (recordError) {
          this.logger.warn(`保存错误执行记录失败: ${recordError.message}`);
        }
      }

      throw error; // 重新抛出原错误
    }
  }

  /**
   * 获取智能体状态
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * 预处理上下文信息 - 子类可以重写
   */
  protected async preprocessContext(
    context: AgentContext,
  ): Promise<AgentContext> {
    return context;
  }

  /**
   * 构建提示词 - 子类必须实现
   */
  protected abstract buildPrompt(context: AgentContext): Promise<string>;

  /**
   * 执行分析 - 子类可以重写（用于MCP模式）
   * 如果子类重写了这个方法，将跳过传统的tool calling流程
   */
  protected async performAnalysis(context: AgentContext): Promise<string> {
    // 默认实现：使用传统的LLM调用
    const prompt = await this.buildPrompt(context);
    return await this.callLLM(prompt);
  }

  /**
   * 检查子类是否重写了performAnalysis方法
   */
  private hasCustomPerformAnalysis(): boolean {
    // 检查子类是否有自己的performAnalysis实现
    return this.performAnalysis !== BaseAgent.prototype.performAnalysis;
  }

  /**
   * 调用LLM进行分析
   */
  protected async callLLM(prompt: string): Promise<string> {
    const fullPrompt = this.config.systemPrompt
      ? `${this.config.systemPrompt}\n\n${prompt}`
      : prompt;

    const llmConfig: LLMConfig = {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      timeout: this.config.timeout * 1000, // 转换为毫秒
    };

    let lastError: Error;

    // 重试机制
    for (let attempt = 1; attempt <= this.config.retryCount; attempt++) {
      try {
        this.logger.debug(`LLM调用尝试 ${attempt}/${this.config.retryCount}`);
        return await this.llmService.generate(fullPrompt, llmConfig);
      } catch (error) {
        lastError = error;
        const isTimeoutError = error.message.includes('timeout') || 
                              error.message.includes('aborted due to timeout');
        
        this.logger.warn(
          `LLM调用失败 (尝试 ${attempt}/${this.config.retryCount}): ${error.message}${isTimeoutError ? ' [超时错误]' : ''}`,
        );

        if (attempt < this.config.retryCount) {
          // 如果是超时错误，增加重试延迟时间
          const baseDelay = Math.pow(2, attempt - 1) * 1000;
          const delay = isTimeoutError ? baseDelay * 2 : baseDelay;
          
          this.logger.debug(`等待 ${delay}ms 后重试...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * 调用LLM（支持工具调用）
   */
  protected async callLLMWithTools(
    prompt: string,
    tools: any[],
  ): Promise<LLMResponse> {
    const fullPrompt = this.config.systemPrompt
      ? `${this.config.systemPrompt}\n\n${prompt}`
      : prompt;

    const llmConfig = {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      timeout: this.config.timeout * 1000,
      tools,
      toolChoice: "auto" as "auto", // 让模型自动决定是否调用工具
    };

    this.logger.debug(
      "开始LLM调用，支持以下工具：",
      (tools || []).map((t) => t.function?.name || t.name || "未知工具"),
    );

    return await this.llmService.generateWithTools(fullPrompt, llmConfig);
  }

  /**
   * 处理工具调用
   */
  protected async processToolCalls(
    llmResponse: LLMResponse,
    _context: AgentContext,
  ): Promise<LLMResponse> {
    if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
      return llmResponse;
    }

    if (!this.dataToolkit) {
      this.logger.warn("收到工具调用请求，但数据工具包不可用");
      return llmResponse;
    }

    this.logger.debug(`处理 ${llmResponse.toolCalls.length} 个工具调用`);

    let enhancedContent = llmResponse.content;

    // 执行所有工具调用
    for (const toolCall of llmResponse.toolCalls) {
      try {
        const functionName = toolCall.function.name;
        const arguments_ = JSON.parse(toolCall.function.arguments);

        this.logger.debug(`执行工具: ${functionName}`, arguments_);

        const toolResult = await this.dataToolkit.executeTool(
          functionName,
          arguments_,
        );

        // 将工具结果添加到内容中
        enhancedContent += `\n\n## 数据获取结果 - ${functionName}\n\n${toolResult}`;
      } catch (error) {
        this.logger.error(`工具调用失败: ${toolCall.function.name}`, error);
        enhancedContent += `\n\n工具调用失败 (${toolCall.function.name}): ${error.message}`;
      }
    }

    return {
      ...llmResponse,
      content: enhancedContent,
    };
  }

  /**
   * 后处理分析结果 - 子类可以重写
   */
  protected async postprocessResult(
    analysis: string,
    _context: AgentContext,
  ): Promise<AgentResult> {
    // 基础结果结构
    const result: AgentResult = {
      agentName: this.name,
      agentType: this.type,
      analysis,
      timestamp: new Date(),
    };

    // 尝试从分析文本中提取结构化信息
    try {
      result.score = this.extractScore(analysis);
      result.confidence = this.extractConfidence(analysis);
      result.recommendation = this.extractRecommendation(analysis);
      result.keyInsights = this.extractKeyInsights(analysis);
      result.risks = this.extractRisks(analysis);
    } catch (error) {
      this.logger.warn(`提取结构化信息失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 从分析文本中提取评分
   */
  protected extractScore(analysis: string): number {
    // 查找评分模式，如 "评分: 85" 或 "得分：75分"
    const scorePattern = /(?:评分|得分)[:：]\s*(-?\d+)/i;
    const match = analysis.match(scorePattern);

    if (match) {
      const score = parseInt(match[1], 10);
      return Math.max(0, Math.min(100, score)); // 限制在0-100范围内
    }

    return 50; // 默认中性评分
  }

  /**
   * 从分析文本中提取置信度
   */
  protected extractConfidence(analysis: string): number {
    // 查找置信度模式，如 "置信度: 0.8" 或 "可信度：85%"
    const confidencePatterns = [
      /(?:置信度|可信度)[:：]\s*(-?\d+)%/i, // 先匹配百分比（包含负数）
      /(?:置信度|可信度)[:：]\s*(-?[0-9.]+)/i, // 再匹配小数（包含负数）
    ];

    for (const pattern of confidencePatterns) {
      const match = analysis.match(pattern);
      if (match) {
        let confidence = parseFloat(match[1]);

        // 如果是百分比形式，转换为0-1范围
        if (pattern.source.includes("%")) {
          confidence = confidence / 100;
        }

        return Math.max(0, Math.min(1, confidence));
      }
    }

    return 0.7; // 默认置信度
  }

  /**
   * 从分析文本中提取交易建议
   */
  protected extractRecommendation(analysis: string): TradingRecommendation {
    const text = analysis.toLowerCase();

    if (text.includes("强烈买入") || text.includes("强买")) {
      return TradingRecommendation.STRONG_BUY;
    } else if (text.includes("买入") || text.includes("建议购买")) {
      return TradingRecommendation.BUY;
    } else if (text.includes("强烈卖出") || text.includes("强卖")) {
      return TradingRecommendation.STRONG_SELL;
    } else if (text.includes("卖出") || text.includes("建议出售")) {
      return TradingRecommendation.SELL;
    } else {
      return TradingRecommendation.HOLD;
    }
  }

  /**
   * 从分析文本中提取关键洞察
   */
  protected extractKeyInsights(analysis: string): string[] {
    const insights: string[] = [];

    // 查找关键洞察部分
    const insightPatterns = [
      /(?:关键洞察|核心观点|重要发现)[:：]\s*([^。]+)/gi,
      /(?:主要观点|核心结论)[:：]\s*([^。]+)/gi,
    ];

    for (const pattern of insightPatterns) {
      let match;
      while ((match = pattern.exec(analysis)) !== null) {
        insights.push(match[1].trim());
      }
    }

    // 如果没有找到明确的洞察标记，尝试提取要点
    if (insights.length === 0) {
      const bulletPoints = analysis.match(/[•·-]\s*([^。\n]+)/g);
      if (bulletPoints) {
        insights.push(
          ...bulletPoints.map((point) => point.replace(/^[•·-]\s*/, "").trim()),
        );
      }
    }

    return insights.slice(0, 5); // 限制数量
  }

  /**
   * 从分析文本中提取风险提示
   */
  protected extractRisks(analysis: string): string[] {
    const risks: string[] = [];

    // 查找风险相关内容
    const riskPatterns = [
      /(?:风险|注意|警告|风险提示)[:：]\s*([^。]+)/gi,
      /(?:需要注意|存在风险)[:：]\s*([^。]+)/gi,
    ];

    for (const pattern of riskPatterns) {
      let match;
      while ((match = pattern.exec(analysis)) !== null) {
        risks.push(match[1].trim());
      }
    }

    return risks.slice(0, 3); // 限制数量
  }

  /**
   * 验证分析结果的完整性
   */
  protected validateResult(result: AgentResult): boolean {
    if (!result.analysis || result.analysis.trim().length === 0) {
      this.logger.warn("分析结果为空");
      return false;
    }

    if (result.analysis.length < 50) {
      this.logger.warn("分析结果过短，可能不完整");
      return false;
    }

    return true;
  }

  /**
   * 格式化分析结果用于显示
   */
  protected formatResult(result: AgentResult): string {
    const sections = [
      `## ${this.name} 分析报告`,
      `**股票代码**: ${result.agentName}`,
      `**分析时间**: ${result.timestamp.toLocaleString()}`,
      `**评分**: ${result.score || "N/A"}`,
      `**置信度**: ${((result.confidence || 0) * 100).toFixed(1)}%`,
      `**建议**: ${result.recommendation || "HOLD"}`,
      "",
      "### 分析内容",
      result.analysis,
    ];

    if (result.keyInsights && result.keyInsights.length > 0) {
      sections.push("", "### 关键洞察");
      result.keyInsights.forEach((insight) => {
        sections.push(`- ${insight}`);
      });
    }

    if (result.risks && result.risks.length > 0) {
      sections.push("", "### 风险提示");
      result.risks.forEach((risk) => {
        sections.push(`- ${risk}`);
      });
    }

    return sections.join("\n");
  }
}
