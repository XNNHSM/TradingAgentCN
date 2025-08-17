import { Injectable, Logger } from "@nestjs/common";
import {
  AgentContext,
  AgentResult,
  AgentType,
  TradingRecommendation,
} from "../interfaces/agent.interface";

// 分析师
import { MarketAnalystAgent } from "../analysts/market-analyst.agent";
import { FundamentalAnalystAgent } from "../analysts/fundamental-analyst.agent";
import { NewsAnalystAgent } from "../analysts/news-analyst.agent";

// 研究员
import { BullResearcherAgent } from "../researchers/bull-researcher.agent";
import { BearResearcherAgent } from "../researchers/bear-researcher.agent";

// 交易员
import { ConservativeTraderAgent } from "../traders/conservative-trader.agent";
import { AggressiveTraderAgent } from "../traders/aggressive-trader.agent";

// 反思
import { ReflectionAgent } from "../reflection/reflection.agent";

/**
 * 智能体编排器 - 协调多智能体工作流
 */
@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);

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
   * 执行完整的多智能体分析流程
   */
  async executeFullAnalysis(context: AgentContext): Promise<AnalysisResult> {
    const startTime = Date.now();
    this.logger.log(`开始执行完整分析流程: ${context.stockCode}`);

    try {
      // 第一阶段：基础分析师并行工作
      const analystResults = await this.runAnalystsPhase(context);

      // 第二阶段：研究员基于分析师结果进行研究
      const researchResults = await this.runResearchPhase(
        context,
        analystResults,
      );

      // 第三阶段：交易员基于所有结果做决策
      const tradingResults = await this.runTradingPhase(context, [
        ...analystResults,
        ...researchResults,
      ]);

      // 第四阶段：反思智能体进行质量控制
      const reflectionResult = await this.runReflectionPhase(context, [
        ...analystResults,
        ...researchResults,
        ...tradingResults,
      ]);

      const totalTime = Date.now() - startTime;
      this.logger.log(`完整分析流程执行完成，总耗时: ${totalTime}ms`);

      return {
        stockCode: context.stockCode,
        stockName: context.stockName,
        analystResults,
        researchResults,
        tradingResults,
        reflectionResult,
        summary: this.generateSummary(
          [...analystResults, ...researchResults, ...tradingResults],
          reflectionResult,
        ),
        executionTime: totalTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`分析流程执行失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 第一阶段：运行分析师团队
   */
  private async runAnalystsPhase(
    context: AgentContext,
  ): Promise<AgentResult[]> {
    this.logger.debug("执行分析师阶段...");

    const analystsPromises = [
      this.marketAnalyst.analyze(context),
      this.fundamentalAnalyst.analyze(context),
      this.newsAnalyst.analyze(context),
    ];

    const results = await Promise.allSettled(analystsPromises);
    const successResults = results
      .filter(
        (result): result is PromiseFulfilledResult<AgentResult> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);

    // 记录失败的分析师
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const agentNames = ["市场分析师", "基本面分析师", "新闻分析师"];
        this.logger.warn(`${agentNames[index]} 分析失败: ${result.reason}`);
      }
    });

    this.logger.debug(`分析师阶段完成，成功: ${successResults.length}/3`);
    return successResults;
  }

  /**
   * 第二阶段：运行研究员团队
   */
  private async runResearchPhase(
    context: AgentContext,
    analystResults: AgentResult[],
  ): Promise<AgentResult[]> {
    this.logger.debug("执行研究员阶段...");

    const researchContext = {
      ...context,
      previousResults: analystResults,
    };

    const researchPromises = [
      this.bullResearcher.analyze(researchContext),
      this.bearResearcher.analyze(researchContext),
    ];

    const results = await Promise.allSettled(researchPromises);
    const successResults = results
      .filter(
        (result): result is PromiseFulfilledResult<AgentResult> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);

    // 记录失败的研究员
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const agentNames = ["多头研究员", "空头研究员"];
        this.logger.warn(`${agentNames[index]} 分析失败: ${result.reason}`);
      }
    });

    this.logger.debug(`研究员阶段完成，成功: ${successResults.length}/2`);
    return successResults;
  }

  /**
   * 第三阶段：运行交易员团队
   */
  private async runTradingPhase(
    context: AgentContext,
    previousResults: AgentResult[],
  ): Promise<AgentResult[]> {
    this.logger.debug("执行交易员阶段...");

    const tradingContext = {
      ...context,
      previousResults,
    };

    const tradingPromises = [
      this.conservativeTrader.analyze(tradingContext),
      this.aggressiveTrader.analyze(tradingContext),
    ];

    const results = await Promise.allSettled(tradingPromises);
    const successResults = results
      .filter(
        (result): result is PromiseFulfilledResult<AgentResult> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);

    // 记录失败的交易员
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const agentNames = ["保守型交易员", "激进型交易员"];
        this.logger.warn(`${agentNames[index]} 分析失败: ${result.reason}`);
      }
    });

    this.logger.debug(`交易员阶段完成，成功: ${successResults.length}/2`);
    return successResults;
  }

  /**
   * 第四阶段：运行反思智能体
   */
  private async runReflectionPhase(
    context: AgentContext,
    allResults: AgentResult[],
  ): Promise<AgentResult> {
    this.logger.debug("执行反思阶段...");

    const reflectionContext = {
      ...context,
      previousResults: allResults,
    };

    return await this.reflectionAgent.analyze(reflectionContext);
  }

  /**
   * 生成分析摘要
   */
  private generateSummary(
    allResults: AgentResult[],
    reflectionResult: AgentResult,
  ): AnalysisSummary {
    const scores = allResults.filter((r) => r.score).map((r) => r.score!);
    const recommendations = allResults
      .filter((r) => r.recommendation)
      .map((r) => r.recommendation!);

    // 计算统计信息
    const avgScore =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

    // 统计建议分布
    const recommendationCounts = recommendations.reduce(
      (acc, rec) => {
        acc[rec] = (acc[rec] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // 确定主导建议
    const dominantRecommendation = Object.keys(recommendationCounts).reduce(
      (a, b) => (recommendationCounts[a] > recommendationCounts[b] ? a : b),
    );

    // 收集所有洞察和风险
    const allInsights: string[] = [];
    const allRisks: string[] = [];

    allResults.forEach((result) => {
      if (result.keyInsights) allInsights.push(...result.keyInsights);
      if (result.risks) allRisks.push(...result.risks);
    });

    return {
      averageScore: Math.round(avgScore * 10) / 10,
      scoreRange: { min: minScore, max: maxScore },
      dominantRecommendation: dominantRecommendation as TradingRecommendation,
      recommendationDistribution: recommendationCounts,
      consensus: this.calculateConsensus(recommendations),
      keyInsights: [...new Set(allInsights)].slice(0, 5), // 去重并限制数量
      majorRisks: [...new Set(allRisks)].slice(0, 5), // 去重并限制数量
      teamConsistency: reflectionResult.supportingData?.teamConsistency || null,
      finalRecommendation:
        reflectionResult.recommendation ||
        (dominantRecommendation as TradingRecommendation),
      confidence: reflectionResult.confidence || 0.7,
    };
  }

  /**
   * 计算团队一致性
   */
  private calculateConsensus(recommendations: TradingRecommendation[]): number {
    if (recommendations.length === 0) return 0;

    const counts = recommendations.reduce(
      (acc, rec) => {
        acc[rec] = (acc[rec] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const maxCount = Math.max(...Object.values(counts));
    return maxCount / recommendations.length;
  }

  /**
   * 快速分析 - 仅运行核心分析师
   */
  async executeQuickAnalysis(
    context: AgentContext,
  ): Promise<QuickAnalysisResult> {
    this.logger.log(`开始执行快速分析: ${context.stockCode}`);
    const startTime = Date.now();

    try {
      // 并行运行核心分析师
      const corePromises = [
        this.marketAnalyst.analyze(context),
        this.fundamentalAnalyst.analyze(context),
      ];

      const results = await Promise.allSettled(corePromises);
      const successResults = results
        .filter(
          (result): result is PromiseFulfilledResult<AgentResult> =>
            result.status === "fulfilled",
        )
        .map((result) => result.value);

      // 基于核心分析师结果运行一个交易员
      const tradingContext = { ...context, previousResults: successResults };
      const tradingResult =
        await this.conservativeTrader.analyze(tradingContext);

      const totalTime = Date.now() - startTime;
      this.logger.log(`快速分析完成，耗时: ${totalTime}ms`);

      return {
        stockCode: context.stockCode,
        stockName: context.stockName,
        coreResults: successResults,
        tradingResult,
        quickSummary: this.generateQuickSummary(successResults, tradingResult),
        executionTime: totalTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`快速分析失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 生成快速分析摘要
   */
  private generateQuickSummary(
    coreResults: AgentResult[],
    tradingResult: AgentResult,
  ): QuickSummary {
    const allResults = [...coreResults, tradingResult];
    const scores = allResults.filter((r) => r.score).map((r) => r.score!);
    const avgScore =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;

    return {
      averageScore: Math.round(avgScore * 10) / 10,
      recommendation:
        tradingResult.recommendation || TradingRecommendation.HOLD,
      confidence: tradingResult.confidence || 0.7,
      keyPoints: allResults.flatMap((r) => r.keyInsights || []).slice(0, 3),
      mainRisks: allResults.flatMap((r) => r.risks || []).slice(0, 2),
    };
  }
}

/**
 * 完整分析结果
 */
export interface AnalysisResult {
  stockCode: string;
  stockName?: string;
  analystResults: AgentResult[];
  researchResults: AgentResult[];
  tradingResults: AgentResult[];
  reflectionResult: AgentResult;
  summary: AnalysisSummary;
  executionTime: number;
  timestamp: Date;
}

/**
 * 分析摘要
 */
export interface AnalysisSummary {
  averageScore: number;
  scoreRange: { min: number; max: number };
  dominantRecommendation: TradingRecommendation;
  recommendationDistribution: Record<string, number>;
  consensus: number; // 0-1，一致性程度
  keyInsights: string[];
  majorRisks: string[];
  teamConsistency: any;
  finalRecommendation: TradingRecommendation;
  confidence: number;
}

/**
 * 快速分析结果
 */
export interface QuickAnalysisResult {
  stockCode: string;
  stockName?: string;
  coreResults: AgentResult[];
  tradingResult: AgentResult;
  quickSummary: QuickSummary;
  executionTime: number;
  timestamp: Date;
}

/**
 * 快速摘要
 */
export interface QuickSummary {
  averageScore: number;
  recommendation: TradingRecommendation;
  confidence: number;
  keyPoints: string[];
  mainRisks: string[];
}
