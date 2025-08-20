import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ComprehensiveAnalystAgent } from "./comprehensive-analyst.agent";
import { TradingStrategistAgent } from "./trading-strategist.agent";
import { MCPClientService } from "../services/mcp-client.service";
import {
  AgentContext,
  AgentResult,
  AgentType,
} from "../interfaces/agent.interface";
import { BusinessLogger } from "../../common/utils/business-logger.util";

/**
 * 统一智能体协调服务
 * 基于MCP协议的新架构，简化智能体协作流程
 */
@Injectable()
export class UnifiedOrchestratorService {
  private readonly logger = new BusinessLogger(UnifiedOrchestratorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mcpClient: MCPClientService,
    private readonly comprehensiveAnalyst: ComprehensiveAnalystAgent,
    private readonly tradingStrategist: TradingStrategistAgent,
  ) {}

  /**
   * 执行股票分析（新架构 - 基于MCP）
   * 只使用两个核心智能体：综合分析师 + 交易策略师
   */
  async analyzeStock(context: AgentContext): Promise<{
    sessionId: string;
    results: AgentResult[];
    finalRecommendation: AgentResult;
    processingTime: number;
  }> {
    const startTime = Date.now();
    const sessionId = context.metadata?.sessionId || `mcp_session_${Date.now()}`;
    
    this.logger.serviceInfo(`开始MCP股票分析: ${context.stockCode} (会话: ${sessionId})`);

    try {
      // 确保MCP客户端已连接
      if (!this.mcpClient.isConnectedToMCP()) {
        await this.mcpClient.initialize();
      }

      // 第一阶段：综合分析
      this.logger.debug("第一阶段：执行综合分析");
      const comprehensiveResult = await this.comprehensiveAnalyst.analyze({
        ...context,
        metadata: { 
          ...context.metadata, 
          sessionId,
          analysisType: 'comprehensive',
        },
      });

      // 第二阶段：制定交易策略
      this.logger.debug("第二阶段：制定交易策略");
      const strategyResult = await this.tradingStrategist.analyze({
        ...context,
        metadata: { 
          ...context.metadata, 
          sessionId,
          analysisType: 'strategy',
        },
        previousResults: [comprehensiveResult], // 传递综合分析结果
      });

      const results = [comprehensiveResult, strategyResult];
      const processingTime = Date.now() - startTime;

      // 生成最终建议
      const finalRecommendation = await this.generateFinalRecommendation(
        context,
        results,
        sessionId,
      );

      this.logger.serviceInfo(
        `MCP股票分析完成: ${context.stockCode}, 耗时: ${processingTime}ms`
      );

      return {
        sessionId,
        results,
        finalRecommendation,
        processingTime,
      };

    } catch (error) {
      this.logger.businessError("MCP股票分析失败", error);
      throw error;
    }
  }

  /**
   * 批量分析多只股票（MCP模式）
   */
  async analyzeBatch(stockCodes: string[]): Promise<{
    sessionId: string;
    results: Record<string, AgentResult[]>;
    summary: {
      total: number;
      successful: number;
      failed: number;
      processingTime: number;
    };
  }> {
    const startTime = Date.now();
    const sessionId = `mcp_batch_${Date.now()}`;
    const results: Record<string, AgentResult[]> = {};
    
    let successful = 0;
    let failed = 0;

    this.logger.serviceInfo(`开始MCP批量分析: ${stockCodes.length}只股票`);

    for (const stockCode of stockCodes) {
      try {
        const analysisResult = await this.analyzeStock({
          stockCode,
          metadata: { sessionId, analysisType: 'batch' },
        });

        results[stockCode] = analysisResult.results;
        successful++;
        
        this.logger.debug(`股票 ${stockCode} 分析完成`);
      } catch (error) {
        this.logger.warn(`股票 ${stockCode} 分析失败: ${error.message}`);
        failed++;
      }
    }

    const processingTime = Date.now() - startTime;
    
    this.logger.serviceInfo(
      `MCP批量分析完成: 成功${successful}只, 失败${failed}只, 耗时${processingTime}ms`
    );

    return {
      sessionId,
      results,
      summary: {
        total: stockCodes.length,
        successful,
        failed,
        processingTime,
      },
    };
  }

  /**
   * 生成最终综合建议
   */
  private async generateFinalRecommendation(
    context: AgentContext,
    results: AgentResult[],
    sessionId: string,
  ): Promise<AgentResult> {
    const comprehensiveResult = results.find(
      r => r.agentType === AgentType.COMPREHENSIVE_ANALYST
    );
    const strategyResult = results.find(
      r => r.agentType === AgentType.TRADING_STRATEGIST
    );

    // 综合评分计算 (综合分析70% + 交易策略30%)
    const finalScore = Math.round(
      (comprehensiveResult?.score || 50) * 0.7 + 
      (strategyResult?.score || 50) * 0.3
    );

    // 提取关键信息
    const keyInsights = [
      ...(comprehensiveResult?.keyInsights || []),
      ...(strategyResult?.keyInsights || []),
    ].slice(0, 8); // 最多8个关键洞察

    const risks = [
      ...(comprehensiveResult?.risks || []),
      ...(strategyResult?.risks || []),
    ].slice(0, 5); // 最多5个风险点

    // 确定最终建议（以交易策略师的建议为主）
    const finalRecommendation = strategyResult?.recommendation || 
                               comprehensiveResult?.recommendation || 
                               'HOLD';

    // 计算综合置信度
    const finalConfidence = Math.min(
      ((comprehensiveResult?.confidence || 0.5) + 
       (strategyResult?.confidence || 0.5)) / 2,
      1.0
    );

    // 生成最终分析报告
    const finalAnalysis = this.buildFinalAnalysisReport(
      context,
      results,
      finalScore,
      finalRecommendation,
      finalConfidence,
    );

    return {
      agentName: "MCP智能投顾系统",
      agentType: AgentType.COMPREHENSIVE_ANALYST, // 使用综合类型
      analysis: finalAnalysis,
      score: finalScore,
      recommendation: finalRecommendation as any,
      confidence: finalConfidence,
      keyInsights,
      risks,
      timestamp: new Date(),
      processingTime: results.reduce((sum, r) => sum + (r.processingTime || 0), 0),
      supportingData: {
        sessionId,
        componentResults: results.map(r => ({
          agentName: r.agentName,
          agentType: r.agentType,
          score: r.score,
          recommendation: r.recommendation,
        })),
      },
    };
  }

  /**
   * 构建最终分析报告
   */
  private buildFinalAnalysisReport(
    context: AgentContext,
    results: AgentResult[],
    finalScore: number,
    recommendation: string,
    confidence: number,
  ): string {
    const comprehensiveResult = results.find(
      r => r.agentType === AgentType.COMPREHENSIVE_ANALYST
    );
    const strategyResult = results.find(
      r => r.agentType === AgentType.TRADING_STRATEGIST
    );

    return `# ${context.stockCode} - MCP智能投顾综合报告

## 📊 投资建议概览

| 项目 | 评估结果 |
|------|----------|
| **综合评分** | ${finalScore}/100分 |
| **投资建议** | **${this.getRecommendationText(recommendation)}** |
| **置信度** | ${(confidence * 100).toFixed(1)}% |
| **风险等级** | ${this.getRiskLevel(finalScore)} |

## 🎯 核心观点

### 综合分析师观点 (权重70%)
- **评分**: ${comprehensiveResult?.score || 'N/A'}/100分
- **建议**: ${this.getRecommendationText(comprehensiveResult?.recommendation)}
- **置信度**: ${((comprehensiveResult?.confidence || 0) * 100).toFixed(1)}%

### 交易策略师观点 (权重30%)  
- **评分**: ${strategyResult?.score || 'N/A'}/100分
- **建议**: ${this.getRecommendationText(strategyResult?.recommendation)}
- **置信度**: ${((strategyResult?.confidence || 0) * 100).toFixed(1)}%

## 📈 详细分析内容

### 综合市场分析
${comprehensiveResult?.analysis ? comprehensiveResult.analysis.substring(0, 1000) + '...' : '暂无数据'}

### 交易策略制定
${strategyResult?.analysis ? strategyResult.analysis.substring(0, 1000) + '...' : '暂无数据'}

## ⚠️ 风险提示
${(results.flatMap(r => r.risks || [])).slice(0, 3).map(risk => `- ${risk}`).join('\n') || '- 投资有风险，决策需谨慎'}

## 💡 投资要点
${(results.flatMap(r => r.keyInsights || [])).slice(0, 5).map((insight, index) => `${index + 1}. ${insight}`).join('\n') || '暂无关键洞察'}

---
**生成时间**: ${new Date().toLocaleString()}  
**数据来源**: 阿里云百炼MCP股票数据服务  
**分析引擎**: MCP智能投顾系统 v2.0

> 本报告由AI系统生成，仅供参考，不构成投资建议。投资者应基于自身情况做出独立判断。`;
  }

  /**
   * 获取建议文本描述
   */
  private getRecommendationText(recommendation?: string): string {
    switch (recommendation) {
      case 'STRONG_BUY':
        return '强烈买入 🚀';
      case 'BUY':
        return '买入 📈';
      case 'HOLD':
        return '持有 ⏸️';
      case 'SELL':
        return '卖出 📉';
      case 'STRONG_SELL':
        return '强烈卖出 ⚠️';
      default:
        return '持有 ⏸️';
    }
  }

  /**
   * 获取风险等级
   */
  private getRiskLevel(score: number): string {
    if (score >= 80) return '低风险 🟢';
    if (score >= 60) return '中等风险 🟡';
    if (score >= 40) return '较高风险 🟠';
    return '高风险 🔴';
  }

  /**
   * 获取服务状态
   */
  getServiceStatus(): {
    mcpConnection: boolean;
    availableAgents: string[];
    lastAnalysisTime?: Date;
  } {
    return {
      mcpConnection: this.mcpClient.isConnectedToMCP(),
      availableAgents: [
        'ComprehensiveAnalyst',
        'TradingStrategist',
      ],
      lastAnalysisTime: new Date(),
    };
  }

  /**
   * 重连MCP服务
   */
  async reconnectMCP(): Promise<void> {
    this.logger.serviceInfo("重新连接MCP服务...");
    await this.mcpClient.disconnect();
    await this.mcpClient.initialize();
    this.logger.serviceInfo("MCP服务重连成功");
  }
}