/**
 * 统一智能体协调服务
 * 负责协调数据获取智能体、综合分析师和交易策略师的工作流程
 * 🎯 实现MCP服务调用成本控制和智能体间的高效协作
 */

import { Injectable } from '@nestjs/common';
import { BusinessLogger } from '../../common/utils/business-logger.util';
import { DataCollectorAgent, ComprehensiveStockData } from './data-collector.agent';
import { ComprehensiveAnalystAgent } from './comprehensive-analyst.agent';
import { TradingStrategistAgent } from './trading-strategist.agent';
import { AgentContext } from '../interfaces/agent.interface';

/**
 * 统一分析结果接口
 */
export interface UnifiedAnalysisResult {
  stockCode: string;
  stockData: ComprehensiveStockData;
  comprehensiveAnalysis: string;
  tradingStrategy: string;
  finalDecision: {
    recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
    score: number; // 0-100分
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    confidence: number; // 0-100分
  };
  timestamp: string;
  executionSummary: {
    dataCollectionDuration: number;
    analysisDuration: number;
    strategyDuration: number;
    totalDuration: number;
  };
}

@Injectable()
export class UnifiedOrchestratorService {
  private readonly businessLogger = new BusinessLogger(UnifiedOrchestratorService.name);

  constructor(
    private readonly dataCollector: DataCollectorAgent,
    private readonly comprehensiveAnalyst: ComprehensiveAnalystAgent,
    private readonly tradingStrategist: TradingStrategistAgent,
  ) {}

  /**
   * 执行统一的股票分析工作流
   * 步骤: 数据获取 → 综合分析 → 交易策略 → 最终决策
   */
  async executeUnifiedAnalysis(
    stockCode: string,
    stockName?: string,
    sessionId?: string
  ): Promise<UnifiedAnalysisResult> {
    const startTime = Date.now();
    const analysisStartTime = new Date().toISOString();
    
    this.businessLogger.serviceInfo(`开始执行统一股票分析流程`, {
      stockCode,
      stockName,
      sessionId,
    });

    try {
      // 第一步: 数据获取 (唯一的MCP调用入口)
      this.businessLogger.serviceInfo('步骤1: 开始数据获取阶段');
      const dataCollectionStart = Date.now();
      
      const dataResult = await this.dataCollector.collectStockData(stockCode);
      if (!dataResult.success || !dataResult.data) {
        throw new Error(`数据获取失败: ${dataResult.error}`);
      }
      
      const dataCollectionDuration = Date.now() - dataCollectionStart;
      this.businessLogger.serviceInfo(`步骤1完成: 数据获取成功`, {
        duration: `${dataCollectionDuration}ms`,
        dataCompleteness: this.dataCollector.validateDataCompleteness(dataResult.data).completeness + '%'
      });

      // 第二步: 综合分析
      this.businessLogger.serviceInfo('步骤2: 开始综合分析阶段');
      const analysisStart = Date.now();
      
      const context: AgentContext = {
        stockCode,
        stockName,
        timeRange: {
          startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60天前
          endDate: new Date(),
        },
      };

      const comprehensiveAnalysis = await this.comprehensiveAnalyst.performAnalysis(context);
      
      const analysisDuration = Date.now() - analysisStart;
      this.businessLogger.serviceInfo(`步骤2完成: 综合分析完成`, {
        duration: `${analysisDuration}ms`,
        analysisLength: comprehensiveAnalysis.length,
      });

      // 第三步: 交易策略制定
      this.businessLogger.serviceInfo('步骤3: 开始交易策略制定阶段');
      const strategyStart = Date.now();
      
      const tradingStrategy = await this.tradingStrategist.analyzeWithComprehensiveData(
        context,
        comprehensiveAnalysis
      );
      
      const strategyDuration = Date.now() - strategyStart;
      this.businessLogger.serviceInfo(`步骤3完成: 交易策略制定完成`, {
        duration: `${strategyDuration}ms`,
        strategyLength: tradingStrategy.length,
      });

      // 第四步: 生成最终决策
      this.businessLogger.serviceInfo('步骤4: 开始最终决策生成阶段');
      const finalDecision = this.generateFinalDecision(comprehensiveAnalysis, tradingStrategy);

      const totalDuration = Date.now() - startTime;

      const result: UnifiedAnalysisResult = {
        stockCode,
        stockData: dataResult.data,
        comprehensiveAnalysis,
        tradingStrategy,
        finalDecision,
        timestamp: analysisStartTime,
        executionSummary: {
          dataCollectionDuration,
          analysisDuration,
          strategyDuration,
          totalDuration,
        },
      };

      this.businessLogger.serviceInfo(`统一分析流程执行完成`, {
        stockCode,
        totalDuration: `${totalDuration}ms`,
        recommendation: finalDecision.recommendation,
        score: finalDecision.score,
      });

      return result;

    } catch (error) {
      this.businessLogger.serviceError(`统一分析流程执行失败`, error, {
        stockCode,
        stockName,
        sessionId,
      });
      throw error;
    }
  }

  /**
   * 生成最终决策
   * 基于综合分析和交易策略的结果
   */
  private generateFinalDecision(
    comprehensiveAnalysis: string,
    tradingStrategy: string
  ): UnifiedAnalysisResult['finalDecision'] {
    // 从综合分析中提取评分和建议
    const analysisScore = this.extractScoreFromAnalysis(comprehensiveAnalysis);
    const analysisRecommendation = this.extractRecommendationFromAnalysis(comprehensiveAnalysis);
    
    // 从交易策略中提取推荐策略
    const strategyRecommendation = this.extractRecommendationFromStrategy(tradingStrategy);
    
    // 权重化决策: 综合分析70% + 交易策略30%
    const finalScore = Math.round(analysisScore * 0.7 + (analysisScore * 0.3)); // 简化版本，实际应该从策略中也提取评分
    
    // 决策逻辑
    let recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
    let confidence: number;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';

    if (finalScore >= 75) {
      recommendation = 'BUY';
      confidence = Math.min(95, finalScore + 10);
      riskLevel = finalScore >= 85 ? 'MEDIUM' : 'HIGH';
    } else if (finalScore >= 60) {
      recommendation = 'HOLD';
      confidence = Math.min(80, finalScore);
      riskLevel = 'MEDIUM';
    } else if (finalScore >= 40) {
      recommendation = 'WAIT';
      confidence = Math.max(50, finalScore);
      riskLevel = 'MEDIUM';
    } else {
      recommendation = 'SELL';
      confidence = Math.max(60, 100 - finalScore);
      riskLevel = 'HIGH';
    }

    // 综合考虑分析师和策略师的建议一致性
    if (analysisRecommendation !== strategyRecommendation) {
      confidence = Math.max(50, confidence - 15); // 降低置信度
    }

    return {
      recommendation,
      score: finalScore,
      riskLevel,
      confidence,
    };
  }

  /**
   * 从综合分析中提取评分
   */
  private extractScoreFromAnalysis(analysis: string): number {
    // 查找评分模式: "XX分"、"XX/100"、"得分：XX"等
    const scorePatterns = [
      /综合得分.*?(\d+)/i,
      /总分.*?(\d+)/i,
      /评分.*?(\d+)/i,
      /(\d+)分/g,
      /(\d+)\/100/g,
    ];

    for (const pattern of scorePatterns) {
      const matches = analysis.match(pattern);
      if (matches) {
        const score = parseInt(matches[1]);
        if (score >= 0 && score <= 100) {
          return score;
        }
      }
    }

    // 默认返回中性评分
    return 60;
  }

  /**
   * 从综合分析中提取建议
   */
  private extractRecommendationFromAnalysis(analysis: string): string {
    const buyPatterns = /买入|推荐|看好/i;
    const sellPatterns = /卖出|减持|看空/i;
    const holdPatterns = /持有|维持|观望/i;

    if (buyPatterns.test(analysis)) return 'BUY';
    if (sellPatterns.test(analysis)) return 'SELL';
    if (holdPatterns.test(analysis)) return 'HOLD';
    
    return 'WAIT';
  }

  /**
   * 从交易策略中提取建议
   */
  private extractRecommendationFromStrategy(strategy: string): string {
    const buyPatterns = /买入|建议购买|推荐策略.*买/i;
    const sellPatterns = /卖出|建议出售|推荐策略.*卖/i;
    const holdPatterns = /持有|维持|保守策略/i;

    if (buyPatterns.test(strategy)) return 'BUY';
    if (sellPatterns.test(strategy)) return 'SELL';
    if (holdPatterns.test(strategy)) return 'HOLD';
    
    return 'WAIT';
  }

  /**
   * 获取服务状态
   */
  getServiceStatus(): {
    dataCollectorReady: boolean;
    comprehensiveAnalystReady: boolean;
    tradingStrategistReady: boolean;
    allAgentsReady: boolean;
  } {
    const dataCollectorReady = !!this.dataCollector;
    const comprehensiveAnalystReady = !!this.comprehensiveAnalyst;
    const tradingStrategistReady = !!this.tradingStrategist;

    return {
      dataCollectorReady,
      comprehensiveAnalystReady,
      tradingStrategistReady,
      allAgentsReady: dataCollectorReady && comprehensiveAnalystReady && tradingStrategistReady,
    };
  }
}