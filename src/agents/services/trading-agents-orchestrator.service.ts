import { Injectable, Logger } from "@nestjs/common";
import {
  AgentContext,
  AgentResult,
  AgentType,
  TradingRecommendation,
} from "../interfaces/agent.interface";

// 智能体服务导入
import { MarketAnalystAgent } from "../analysts/market-analyst.agent";
import { FundamentalAnalystAgent } from "../analysts/fundamental-analyst.agent";
import { NewsAnalystAgent } from "../analysts/news-analyst.agent";
import { BullResearcherAgent } from "../researchers/bull-researcher.agent";
import { BearResearcherAgent } from "../researchers/bear-researcher.agent";
import { ConservativeTraderAgent } from "../traders/conservative-trader.agent";
import { AggressiveTraderAgent } from "../traders/aggressive-trader.agent";
import { ReflectionAgent } from "../reflection/reflection.agent";

/**
 * 智能体状态 - 模拟Python版本的AgentState
 */
export interface TradingAgentState {
  // 基础信息
  companyOfInterest: string;
  stockCode: string;
  stockName?: string;
  tradeDate: string;
  sessionId: string;

  // 分析报告
  marketReport?: string;
  sentimentReport?: string;
  newsReport?: string;
  fundamentalsReport?: string;

  // 辩论状态
  investmentDebateState: InvestmentDebateState;
  riskDebateState: RiskDebateState;

  // 决策结果
  investmentPlan?: string;
  traderInvestmentPlan?: string;
  finalTradeDecision?: string;

  // 消息历史
  messages: AgentMessage[];

  // 执行状态
  currentStage: WorkflowStage;
  stageProgress: Record<WorkflowStage, StageStatus>;

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 投资辩论状态
 */
export interface InvestmentDebateState {
  bullHistory: string[];
  bearHistory: string[];
  fullHistory: string[];
  currentResponse?: string;
  judgeDecision?: string;
  debateRound: number;
  maxRounds: number;
  isComplete: boolean;
}

/**
 * 风险辩论状态
 */
export interface RiskDebateState {
  riskyHistory: string[];
  safeHistory: string[];
  neutralHistory: string[];
  fullHistory: string[];
  currentResponse?: string;
  judgeDecision?: string;
  debateRound: number;
  maxRounds: number;
  isComplete: boolean;
}

/**
 * 智能体消息
 */
export interface AgentMessage {
  id: string;
  agentType: AgentType;
  agentName: string;
  content: string;
  timestamp: Date;
  stage: WorkflowStage;
  metadata?: Record<string, any>;
}

/**
 * 工作流阶段
 */
export enum WorkflowStage {
  INITIALIZATION = "initialization",
  ANALYSIS = "analysis",
  RESEARCH_DEBATE = "research_debate",
  TRADING_DECISION = "trading_decision",
  RISK_ASSESSMENT = "risk_assessment",
  FINAL_DECISION = "final_decision",
  REFLECTION = "reflection",
  COMPLETED = "completed",
}

/**
 * 阶段状态
 */
export enum StageStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped",
}

/**
 * 工作流配置
 */
export interface WorkflowConfig {
  enabledAnalysts: AgentType[];
  maxDebateRounds: number;
  maxRiskRounds: number;
  enableParallelAnalysis: boolean;
  enableRealtimeUpdates: boolean;
  timeoutConfig: {
    analysisStage: number;
    debateStage: number;
    tradingStage: number;
    reflectionStage: number;
  };
}

/**
 * 增强版交易智能体编排器
 * 基于Python版本的LangGraph实现，支持状态管理、实时更新和智能体协作
 */
@Injectable()
export class TradingAgentsOrchestratorService {
  private readonly logger = new Logger(TradingAgentsOrchestratorService.name);
  
  // 活跃会话管理
  private readonly activeSessions = new Map<string, TradingAgentState>();

  constructor(
    // 分析师团队
    private readonly marketAnalyst: MarketAnalystAgent,
    private readonly fundamentalAnalyst: FundamentalAnalystAgent,
    private readonly newsAnalyst: NewsAnalystAgent,

    // 研究员团队
    private readonly bullResearcher: BullResearcherAgent,
    private readonly bearResearcher: BearResearcherAgent,

    // 交易员团队
    private readonly conservativeTrader: ConservativeTraderAgent,
    private readonly aggressiveTrader: AggressiveTraderAgent,

    // 反思系统
    private readonly reflectionAgent: ReflectionAgent,
  ) {}

  /**
   * 执行完整的智能体分析工作流（同步方法，适用于定时任务）
   * 类似Python版本的graph.stream()方法
   */
  async executeAnalysisWorkflow(
    context: AgentContext,
    config?: Partial<WorkflowConfig>
  ): Promise<TradingAnalysisResult> {
    const sessionId = this.generateSessionId();
    this.logger.log(`开始执行分析工作流: ${sessionId} - ${context.stockCode}`);

    try {
      // 1. 初始化状态
      const state = await this.initializeState(sessionId, context, config);
      
      // 2. 同步执行完整工作流
      await this.executeWorkflowSync(state);

      // 3. 返回最终结果
      const result = await this.buildAnalysisResult(state);
      this.logger.log(`分析工作流完成: ${sessionId} - ${context.stockCode}`);
      
      return result;
    } catch (error) {
      this.logger.error(`分析工作流失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 批量分析自选股（定时任务专用方法）
   * @param stockCodes 股票代码列表
   * @param config 工作流配置
   * @returns 分析结果列表
   */
  async analyzeWatchlistStocks(
    stockCodes: string[],
    config?: Partial<WorkflowConfig>
  ): Promise<TradingAnalysisResult[]> {
    this.logger.log(`开始批量分析自选股，共 ${stockCodes.length} 只股票`);
    
    const results: TradingAnalysisResult[] = [];
    const errors: { stockCode: string; error: string }[] = [];
    
    for (const stockCode of stockCodes) {
      try {
        this.logger.debug(`正在分析股票: ${stockCode}`);
        
        const context: AgentContext = {
          stockCode,
          timeRange: {
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
            endDate: new Date(),
          },
        };
        
        const result = await this.executeAnalysisWorkflow(context, config);
        results.push(result);
        
        this.logger.debug(`股票 ${stockCode} 分析完成`);
        
        // 添加延迟避免API限流
        await this.delay(1000);
        
      } catch (error) {
        this.logger.error(`股票 ${stockCode} 分析失败: ${error.message}`);
        errors.push({ 
          stockCode, 
          error: error.message 
        });
      }
    }
    
    this.logger.log(`批量分析完成，成功: ${results.length}, 失败: ${errors.length}`);
    
    if (errors.length > 0) {
      this.logger.warn(`分析失败的股票: ${JSON.stringify(errors)}`);
    }
    
    return results;
  }

  /**
   * 分析单只股票（定时任务专用方法）
   * @param stockCode 股票代码
   * @param stockName 股票名称（可选）
   * @param config 工作流配置
   * @returns 分析结果
   */
  async analyzeSingleStock(
    stockCode: string,
    stockName?: string,
    config?: Partial<WorkflowConfig>
  ): Promise<TradingAnalysisResult> {
    this.logger.log(`开始分析单只股票: ${stockCode} ${stockName || ''}`);
    
    const context: AgentContext = {
      stockCode,
      stockName,
      timeRange: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
        endDate: new Date(),
      },
    };
    
    return await this.executeAnalysisWorkflow(context, config);
  }

  /**
   * 获取会话状态（用于调试）
   */
  getSessionState(sessionId: string): TradingAgentState | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * 初始化分析状态
   */
  private async initializeState(
    sessionId: string,
    context: AgentContext,
    config?: Partial<WorkflowConfig>
  ): Promise<TradingAgentState> {
    const defaultConfig: WorkflowConfig = {
      enabledAnalysts: [AgentType.MARKET_ANALYST, AgentType.FUNDAMENTAL_ANALYST, AgentType.NEWS_ANALYST],
      maxDebateRounds: 3,
      maxRiskRounds: 2,
      enableParallelAnalysis: true,
      enableRealtimeUpdates: true,
      timeoutConfig: {
        analysisStage: 300000, // 5分钟
        debateStage: 600000,   // 10分钟
        tradingStage: 300000,  // 5分钟
        reflectionStage: 180000, // 3分钟
      },
    };

    const finalConfig = { ...defaultConfig, ...config };

    const state: TradingAgentState = {
      companyOfInterest: context.stockName || context.stockCode,
      stockCode: context.stockCode,
      stockName: context.stockName,
      tradeDate: new Date().toISOString().split('T')[0],
      sessionId,

      investmentDebateState: {
        bullHistory: [],
        bearHistory: [],
        fullHistory: [],
        debateRound: 0,
        maxRounds: finalConfig.maxDebateRounds,
        isComplete: false,
      },

      riskDebateState: {
        riskyHistory: [],
        safeHistory: [],
        neutralHistory: [],
        fullHistory: [],
        debateRound: 0,
        maxRounds: finalConfig.maxRiskRounds,
        isComplete: false,
      },

      messages: [],
      currentStage: WorkflowStage.INITIALIZATION,
      stageProgress: {
        [WorkflowStage.INITIALIZATION]: StageStatus.COMPLETED,
        [WorkflowStage.ANALYSIS]: StageStatus.PENDING,
        [WorkflowStage.RESEARCH_DEBATE]: StageStatus.PENDING,
        [WorkflowStage.TRADING_DECISION]: StageStatus.PENDING,
        [WorkflowStage.RISK_ASSESSMENT]: StageStatus.PENDING,
        [WorkflowStage.FINAL_DECISION]: StageStatus.PENDING,
        [WorkflowStage.REFLECTION]: StageStatus.PENDING,
        [WorkflowStage.COMPLETED]: StageStatus.PENDING,
      },

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 保存状态
    this.activeSessions.set(sessionId, state);
    this.logger.debug(`工作流状态已初始化: ${sessionId}`);

    return state;
  }

  /**
   * 同步执行工作流（用于定时任务）
   */
  private async executeWorkflowSync(state: TradingAgentState): Promise<void> {
    try {
      // 第一阶段：分析师团队并行分析
      await this.executeAnalysisStage(state);

      // 第二阶段：研究员辩论
      await this.executeResearchDebateStage(state);

      // 第三阶段：交易决策
      await this.executeTradingStage(state);

      // 第四阶段：风险评估辩论
      await this.executeRiskAssessmentStage(state);

      // 第五阶段：最终决策
      await this.executeFinalDecisionStage(state);

      // 第六阶段：反思和学习
      await this.executeReflectionStage(state);

      // 标记完成
      state.currentStage = WorkflowStage.COMPLETED;
      state.stageProgress[WorkflowStage.COMPLETED] = StageStatus.COMPLETED;
      state.updatedAt = new Date();
      
      this.logger.log(`工作流完成: ${state.sessionId} - ${state.stockCode}`);

    } catch (error) {
      this.logger.error(`工作流执行失败: ${state.sessionId}`, error);
      state.stageProgress[state.currentStage] = StageStatus.FAILED;
      state.updatedAt = new Date();
      throw error;
    }
  }

  /**
   * 执行分析师阶段
   */
  private async executeAnalysisStage(state: TradingAgentState): Promise<void> {
    this.updateStageStatus(state, WorkflowStage.ANALYSIS, StageStatus.IN_PROGRESS);

    const context: AgentContext = {
      stockCode: state.stockCode,
      stockName: state.stockName,
      timeRange: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
        endDate: new Date(),
      },
    };

    try {
      // 并行运行所有分析师
      const analysisPromises = [
        this.runMarketAnalyst(context, state),
        this.runFundamentalAnalyst(context, state),
        this.runNewsAnalyst(context, state),
      ];

      await Promise.allSettled(analysisPromises);

      this.updateStageStatus(state, WorkflowStage.ANALYSIS, StageStatus.COMPLETED);
      this.logger.debug(`分析师阶段完成: ${state.sessionId}`);

    } catch (error) {
      this.updateStageStatus(state, WorkflowStage.ANALYSIS, StageStatus.FAILED);
      throw error;
    }
  }

  /**
   * 执行研究员辩论阶段
   */
  private async executeResearchDebateStage(state: TradingAgentState): Promise<void> {
    this.updateStageStatus(state, WorkflowStage.RESEARCH_DEBATE, StageStatus.IN_PROGRESS);

    try {
      const debateState = state.investmentDebateState;
      
      while (debateState.debateRound < debateState.maxRounds && !debateState.isComplete) {
        // 多头发言
        await this.runBullResearcher(state);
        
        // 空头反驳
        await this.runBearResearcher(state);
        
        debateState.debateRound++;
        this.logger.debug(`辩论轮次 ${debateState.debateRound} 完成: ${state.sessionId}`);
        
        // 检查是否应该结束辩论
        if (await this.shouldEndDebate(state)) {
          break;
        }
      }

      // 研究经理做最终决策
      await this.runResearchManager(state);

      this.updateStageStatus(state, WorkflowStage.RESEARCH_DEBATE, StageStatus.COMPLETED);
      this.logger.debug(`研究辩论阶段完成: ${state.sessionId}`);

    } catch (error) {
      this.updateStageStatus(state, WorkflowStage.RESEARCH_DEBATE, StageStatus.FAILED);
      throw error;
    }
  }

  /**
   * 执行交易决策阶段
   */
  private async executeTradingStage(state: TradingAgentState): Promise<void> {
    this.updateStageStatus(state, WorkflowStage.TRADING_DECISION, StageStatus.IN_PROGRESS);

    try {
      const context = this.buildTradingContext(state);
      
      // 运行交易员分析
      const tradingResult = await this.conservativeTrader.analyze(context);
      
      // 更新状态
      state.traderInvestmentPlan = tradingResult.analysis;
      this.addMessage(state, {
        agentType: AgentType.CONSERVATIVE_TRADER,
        agentName: "保守型交易员",
        content: tradingResult.analysis,
        stage: WorkflowStage.TRADING_DECISION,
      });

      this.updateStageStatus(state, WorkflowStage.TRADING_DECISION, StageStatus.COMPLETED);
      this.logger.debug(`交易决策阶段完成: ${state.sessionId}`);

    } catch (error) {
      this.updateStageStatus(state, WorkflowStage.TRADING_DECISION, StageStatus.FAILED);
      throw error;
    }
  }

  /**
   * 执行风险评估阶段
   */
  private async executeRiskAssessmentStage(state: TradingAgentState): Promise<void> {
    this.updateStageStatus(state, WorkflowStage.RISK_ASSESSMENT, StageStatus.IN_PROGRESS);

    try {
      // 模拟风险辩论（简化实现）
      const context = this.buildRiskContext(state);
      
      // 运行不同风险偏好的分析
      const conservativeResult = await this.conservativeTrader.analyze(context);
      const aggressiveResult = await this.aggressiveTrader.analyze(context);

      // 更新风险辩论状态
      state.riskDebateState.safeHistory.push(conservativeResult.analysis);
      state.riskDebateState.riskyHistory.push(aggressiveResult.analysis);
      state.riskDebateState.isComplete = true;

      this.updateStageStatus(state, WorkflowStage.RISK_ASSESSMENT, StageStatus.COMPLETED);
      this.logger.debug(`风险评估阶段完成: ${state.sessionId}`);

    } catch (error) {
      this.updateStageStatus(state, WorkflowStage.RISK_ASSESSMENT, StageStatus.FAILED);
      throw error;
    }
  }

  /**
   * 执行最终决策阶段
   */
  private async executeFinalDecisionStage(state: TradingAgentState): Promise<void> {
    this.updateStageStatus(state, WorkflowStage.FINAL_DECISION, StageStatus.IN_PROGRESS);

    try {
      // 综合所有信息生成最终决策
      const finalDecision = await this.generateFinalDecision(state);
      state.finalTradeDecision = finalDecision;

      this.addMessage(state, {
        agentType: AgentType.REFLECTION_AGENT,
        agentName: "投资组合管理器",
        content: finalDecision,
        stage: WorkflowStage.FINAL_DECISION,
      });

      this.updateStageStatus(state, WorkflowStage.FINAL_DECISION, StageStatus.COMPLETED);
      this.logger.debug(`最终决策阶段完成: ${state.sessionId}`);

    } catch (error) {
      this.updateStageStatus(state, WorkflowStage.FINAL_DECISION, StageStatus.FAILED);
      throw error;
    }
  }

  /**
   * 执行反思阶段
   */
  private async executeReflectionStage(state: TradingAgentState): Promise<void> {
    this.updateStageStatus(state, WorkflowStage.REFLECTION, StageStatus.IN_PROGRESS);

    try {
      const reflectionContext = this.buildReflectionContext(state);
      const reflectionResult = await this.reflectionAgent.analyze(reflectionContext);

      this.addMessage(state, {
        agentType: AgentType.REFLECTION_AGENT,
        agentName: "反思智能体",
        content: reflectionResult.analysis,
        stage: WorkflowStage.REFLECTION,
      });

      this.updateStageStatus(state, WorkflowStage.REFLECTION, StageStatus.COMPLETED);
      this.logger.debug(`反思阶段完成: ${state.sessionId}`);

    } catch (error) {
      this.updateStageStatus(state, WorkflowStage.REFLECTION, StageStatus.FAILED);
      throw error;
    }
  }


  // ====== 辅助方法 ======

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 延迟方法，用于避免API限流
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateStageStatus(
    state: TradingAgentState,
    stage: WorkflowStage,
    status: StageStatus
  ): void {
    state.currentStage = stage;
    state.stageProgress[stage] = status;
    state.updatedAt = new Date();
    
    this.logger.debug(`工作流阶段更新: ${state.sessionId} - ${stage} -> ${status}`);
  }

  private addMessage(
    state: TradingAgentState,
    messageData: Omit<AgentMessage, 'id' | 'timestamp'>
  ): void {
    const message: AgentMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      ...messageData,
    };

    state.messages.push(message);
    state.updatedAt = new Date();
    
    this.logger.debug(`添加消息: ${state.sessionId} - ${messageData.agentName}: ${messageData.content.substring(0, 100)}...`);
  }


  // ====== 智能体执行方法 ======

  private async runMarketAnalyst(context: AgentContext, state: TradingAgentState): Promise<void> {
    try {
      const result = await this.marketAnalyst.analyze(context);
      state.marketReport = result.analysis;
      
      this.addMessage(state, {
        agentType: AgentType.MARKET_ANALYST,
        agentName: "市场分析师",
        content: result.analysis,
        stage: WorkflowStage.ANALYSIS,
      });
    } catch (error) {
      this.logger.warn(`市场分析师执行失败: ${error.message}`);
    }
  }

  private async runFundamentalAnalyst(context: AgentContext, state: TradingAgentState): Promise<void> {
    try {
      const result = await this.fundamentalAnalyst.analyze(context);
      state.fundamentalsReport = result.analysis;
      
      this.addMessage(state, {
        agentType: AgentType.FUNDAMENTAL_ANALYST,
        agentName: "基本面分析师",
        content: result.analysis,
        stage: WorkflowStage.ANALYSIS,
      });
    } catch (error) {
      this.logger.warn(`基本面分析师执行失败: ${error.message}`);
    }
  }

  private async runNewsAnalyst(context: AgentContext, state: TradingAgentState): Promise<void> {
    try {
      const result = await this.newsAnalyst.analyze(context);
      state.newsReport = result.analysis;
      
      this.addMessage(state, {
        agentType: AgentType.NEWS_ANALYST,
        agentName: "新闻分析师",
        content: result.analysis,
        stage: WorkflowStage.ANALYSIS,
      });
    } catch (error) {
      this.logger.warn(`新闻分析师执行失败: ${error.message}`);
    }
  }

  private async runBullResearcher(state: TradingAgentState): Promise<void> {
    const context = this.buildResearchContext(state);
    const result = await this.bullResearcher.analyze(context);
    
    state.investmentDebateState.bullHistory.push(result.analysis);
    state.investmentDebateState.fullHistory.push(`多头观点: ${result.analysis}`);
    
    await this.addMessage(state, {
      agentType: AgentType.BULL_RESEARCHER,
      agentName: "多头研究员",
      content: result.analysis,
      stage: WorkflowStage.RESEARCH_DEBATE,
    });
  }

  private async runBearResearcher(state: TradingAgentState): Promise<void> {
    const context = this.buildResearchContext(state);
    const result = await this.bearResearcher.analyze(context);
    
    state.investmentDebateState.bearHistory.push(result.analysis);
    state.investmentDebateState.fullHistory.push(`空头观点: ${result.analysis}`);
    
    await this.addMessage(state, {
      agentType: AgentType.BEAR_RESEARCHER,
      agentName: "空头研究员",
      content: result.analysis,
      stage: WorkflowStage.RESEARCH_DEBATE,
    });
  }

  private async runResearchManager(state: TradingAgentState): Promise<void> {
    // 简化的研究经理决策逻辑
    const debateHistory = state.investmentDebateState.fullHistory.join('\n\n');
    
    // 这里可以用一个专门的研究管理器智能体
    const decision = `基于${state.investmentDebateState.debateRound}轮辩论，综合多空双方观点：\n${debateHistory}\n\n最终投资建议：[需要具体实现]`;
    
    state.investmentDebateState.judgeDecision = decision;
    state.investmentDebateState.isComplete = true;
    
    await this.addMessage(state, {
      agentType: AgentType.RESEARCH_MANAGER,
      agentName: "研究经理",
      content: decision,
      stage: WorkflowStage.RESEARCH_DEBATE,
    });
  }

  // ====== 上下文构建方法 ======

  private buildResearchContext(state: TradingAgentState): AgentContext {
    return {
      stockCode: state.stockCode,
      stockName: state.stockName,
      previousResults: [
        {
          agentName: "市场分析师",
          agentType: AgentType.MARKET_ANALYST,
          analysis: state.marketReport || "",
          timestamp: new Date(),
        },
        {
          agentName: "基本面分析师",
          agentType: AgentType.FUNDAMENTAL_ANALYST,
          analysis: state.fundamentalsReport || "",
          timestamp: new Date(),
        },
        {
          agentName: "新闻分析师",
          agentType: AgentType.NEWS_ANALYST,
          analysis: state.newsReport || "",
          timestamp: new Date(),
        },
      ],
    };
  }

  private buildTradingContext(state: TradingAgentState): AgentContext {
    const context = this.buildResearchContext(state);
    context.metadata = {
      investmentPlan: state.investmentPlan,
      debateHistory: state.investmentDebateState.fullHistory,
    };
    return context;
  }

  private buildRiskContext(state: TradingAgentState): AgentContext {
    const context = this.buildTradingContext(state);
    context.metadata = {
      ...context.metadata,
      tradingPlan: state.traderInvestmentPlan,
    };
    return context;
  }

  private buildReflectionContext(state: TradingAgentState): AgentContext {
    return {
      stockCode: state.stockCode,
      stockName: state.stockName,
      previousResults: state.messages.map(msg => ({
        agentName: msg.agentName,
        agentType: msg.agentType,
        analysis: msg.content,
        timestamp: msg.timestamp,
      })),
      metadata: {
        finalDecision: state.finalTradeDecision,
        workflowDuration: new Date().getTime() - state.createdAt.getTime(),
      },
    };
  }

  // ====== 决策逻辑 ======

  private async shouldEndDebate(state: TradingAgentState): Promise<boolean> {
    // 简化的辩论结束逻辑
    const debateState = state.investmentDebateState;
    
    // 达到最大轮次
    if (debateState.debateRound >= debateState.maxRounds) {
      return true;
    }

    // 可以加入更复杂的逻辑，比如观点收敛检测
    return false;
  }

  private async generateFinalDecision(state: TradingAgentState): Promise<string> {
    // 简化的最终决策生成
    return `
## 最终投资决策

**股票**: ${state.stockCode} (${state.stockName})
**分析日期**: ${state.tradeDate}

### 分析摘要
- 市场分析: ${state.marketReport ? '✅ 已完成' : '❌ 未完成'}
- 基本面分析: ${state.fundamentalsReport ? '✅ 已完成' : '❌ 未完成'}
- 新闻分析: ${state.newsReport ? '✅ 已完成' : '❌ 未完成'}

### 研究辩论结果
辩论轮次: ${state.investmentDebateState.debateRound}
研究经理决策: ${state.investmentDebateState.judgeDecision || '待定'}

### 交易建议
${state.traderInvestmentPlan || '待生成'}

### 风险评估
${state.riskDebateState.isComplete ? '✅ 已完成' : '⏳ 进行中'}

**最终建议**: [需要基于所有分析结果生成具体建议]
    `.trim();
  }

  private async buildAnalysisResult(state: TradingAgentState): Promise<TradingAnalysisResult> {
    return {
      sessionId: state.sessionId,
      stockCode: state.stockCode,
      stockName: state.stockName,
      analysisDate: state.tradeDate,
      
      reports: {
        market: state.marketReport,
        fundamentals: state.fundamentalsReport,
        news: state.newsReport,
      },
      
      debate: {
        investment: state.investmentDebateState,
        risk: state.riskDebateState,
      },
      
      decisions: {
        investment: state.investmentPlan,
        trading: state.traderInvestmentPlan,
        final: state.finalTradeDecision,
      },
      
      messages: state.messages,
      executionTime: new Date().getTime() - state.createdAt.getTime(),
      completedAt: new Date(),
      
      workflow: {
        stages: state.stageProgress,
        currentStage: state.currentStage,
      },
    };
  }
}

/**
 * 最终分析结果
 */
export interface TradingAnalysisResult {
  sessionId: string;
  stockCode: string;
  stockName?: string;
  analysisDate: string;
  
  reports: {
    market?: string;
    fundamentals?: string;
    news?: string;
  };
  
  debate: {
    investment: InvestmentDebateState;
    risk: RiskDebateState;
  };
  
  decisions: {
    investment?: string;
    trading?: string;
    final?: string;
  };
  
  messages: AgentMessage[];
  executionTime: number;
  completedAt: Date;
  
  workflow: {
    stages: Record<WorkflowStage, StageStatus>;
    currentStage: WorkflowStage;
  };
}

