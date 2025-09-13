/**
 * 数据质量评估组件
 * 评估 MCP 数据的质量并决定执行策略
 */

import { AnalysisState, DataQualityScore, GraphRoute } from './state-manager';

/**
 * 数据质量评估器
 */
export class DataQualityAssessor {
  
  /**
   * 评估数据质量
   */
  static assessDataQuality(state: AnalysisState): DataQualityScore {
    const mcpData = state.mcpData;
    
    // 评估各个数据维度的完整性
    const completeness = this.assessCompleteness(mcpData);
    const freshness = this.assessFreshness(mcpData);
    const consistency = this.assessConsistency(mcpData);
    
    // 计算综合评分
    const score = (completeness * 0.5) + (freshness * 0.3) + (consistency * 0.2);
    
    // 收集问题
    const issues = this.identifyIssues(mcpData, completeness, freshness, consistency);
    
    return {
      score: Math.min(Math.max(score, 0), 1),
      factors: {
        dataCompleteness: completeness,
        dataFreshness: freshness,
        dataConsistency: consistency,
      },
      issues,
    };
  }

  /**
   * 基于数据质量决定执行路由
   */
  static determineExecutionRoute(dataQuality: DataQualityScore): GraphRoute {
    if (dataQuality.score >= 0.8) {
      return 'parallel_analysis'; // 高质量数据，并行分析
    } else if (dataQuality.score >= 0.6) {
      return 'sequential_analysis'; // 中等质量，顺序分析
    } else if (dataQuality.score >= 0.4) {
      return 'data_enhancement'; // 低质量，需要数据增强
    } else {
      return 'error_recovery'; // 极低质量，错误恢复
    }
  }

  /**
   * 评估数据完整性
   */
  private static assessCompleteness(mcpData: AnalysisState['mcpData']): number {
    let completeFields = 0;
    let totalFields = 0;

    // 基础信息评估
    const basicInfoFields = ['stock_code', 'stock_name', 'industry', 'market'];
    totalFields += basicInfoFields.length;
    if (mcpData.basicInfo && typeof mcpData.basicInfo === 'object') {
      completeFields += basicInfoFields.filter(field => mcpData.basicInfo[field]).length;
    }

    // 实时数据评估
    const realtimeFields = ['price', 'change', 'volume', 'market_cap'];
    totalFields += realtimeFields.length;
    if (mcpData.realtimeData && typeof mcpData.realtimeData === 'object') {
      completeFields += realtimeFields.filter(field => 
        mcpData.realtimeData[field] !== undefined && mcpData.realtimeData[field] !== null
      ).length;
    }

    // 历史数据评估
    totalFields += 1;
    if (mcpData.historicalData && 
        mcpData.historicalData.data && 
        Array.isArray(mcpData.historicalData.data) && 
        mcpData.historicalData.data.length > 0) {
      completeFields += 1;
    }

    // 技术指标评估
    totalFields += 1;
    if (mcpData.technicalIndicators && 
        mcpData.technicalIndicators.data && 
        Array.isArray(mcpData.technicalIndicators.data) && 
        mcpData.technicalIndicators.data.length > 0) {
      completeFields += 1;
    }

    // 财务数据评估
    totalFields += 1;
    if (mcpData.financialData && 
        mcpData.financialData.data && 
        Array.isArray(mcpData.financialData.data) && 
        mcpData.financialData.data.length > 0) {
      completeFields += 1;
    }

    // 市场概况评估
    totalFields += 1;
    if (mcpData.marketOverview && typeof mcpData.marketOverview === 'object') {
      completeFields += 1;
    }

    // 新闻数据评估
    totalFields += 1;
    if (mcpData.news && 
        mcpData.news.news && 
        Array.isArray(mcpData.news.news) && 
        mcpData.news.news.length > 0) {
      completeFields += 1;
    }

    return totalFields > 0 ? completeFields / totalFields : 0;
  }

  /**
   * 评估数据新鲜度
   */
  private static assessFreshness(mcpData: AnalysisState['mcpData']): number {
    let freshnessScore = 0.5; // 默认中等新鲜度

    // 检查实时数据的新鲜度
    if (mcpData.realtimeData && mcpData.realtimeData.timestamp) {
      const timestamp = new Date(mcpData.realtimeData.timestamp);
      const now = new Date();
      const hoursDiff = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff <= 1) {
        freshnessScore = 1.0; // 1小时内，极新鲜
      } else if (hoursDiff <= 24) {
        freshnessScore = 0.8; // 24小时内，很新鲜
      } else if (hoursDiff <= 72) {
        freshnessScore = 0.6; // 3天内，较新鲜
      } else {
        freshnessScore = 0.3; // 超过3天，不够新鲜
      }
    }

    // 检查历史数据的时间范围
    if (mcpData.historicalData && mcpData.historicalData.data) {
      const dataPoints = mcpData.historicalData.data;
      if (dataPoints.length > 30) {
        freshnessScore = Math.max(freshnessScore, 0.8); // 足够的历史数据
      } else if (dataPoints.length > 10) {
        freshnessScore = Math.max(freshnessScore, 0.6); // 基本够用
      }
    }

    return freshnessScore;
  }

  /**
   * 评估数据一致性
   */
  private static assessConsistency(mcpData: AnalysisState['mcpData']): number {
    let consistencyScore = 0.8; // 默认较高一致性

    const issues: string[] = [];

    // 检查股票代码一致性
    const stockCodes = new Set<string>();
    
    if (mcpData.basicInfo?.stock_code) {
      stockCodes.add(mcpData.basicInfo.stock_code.toString());
    }
    if (mcpData.realtimeData?.stock_code) {
      stockCodes.add(mcpData.realtimeData.stock_code.toString());
    }

    if (stockCodes.size > 1) {
      issues.push('不同数据源中的股票代码不一致');
      consistencyScore -= 0.3;
    }

    // 检查价格数据的一致性
    if (mcpData.realtimeData?.price && mcpData.historicalData?.data) {
      const historicalData = mcpData.historicalData.data;
      if (historicalData.length > 0) {
        const latestPrice = historicalData[historicalData.length - 1].close;
        const realtimePrice = parseFloat(mcpData.realtimeData.price);
        
        if (Math.abs(latestPrice - realtimePrice) / latestPrice > 0.1) { // 10%差异
          issues.push('实时价格与历史数据最新价格差异过大');
          consistencyScore -= 0.2;
        }
      }
    }

    // 检查数据格式一致性
    const formatIssues = this.checkDataFormatConsistency(mcpData);
    issues.push(...formatIssues);
    consistencyScore -= formatIssues.length * 0.1;

    return Math.max(0, Math.min(1, consistencyScore));
  }

  /**
   * 检查数据格式一致性
   */
  private static checkDataFormatConsistency(mcpData: AnalysisState['mcpData']): string[] {
    const issues: string[] = [];

    // 检查数值字段格式
    const numericFields = [
      { path: ['realtimeData', 'price'], name: '实时价格' },
      { path: ['realtimeData', 'volume'], name: '成交量' },
      { path: ['basicInfo', 'market_cap'], name: '市值' },
    ];

    for (const field of numericFields) {
      const value = this.getNestedValue(mcpData, field.path);
      if (value !== undefined && value !== null && isNaN(parseFloat(value))) {
        issues.push(`${field.name}格式错误，期望数值`);
      }
    }

    // 检查日期字段格式
    const dateFields = [
      { path: ['realtimeData', 'timestamp'], name: '实时数据时间戳' },
      { path: ['historicalData', 'data', '0', 'date'], name: '历史数据日期' },
    ];

    for (const field of dateFields) {
      const value = this.getNestedValue(mcpData, field.path);
      if (value && !this.isValidDate(value)) {
        issues.push(`${field.name}格式错误，期望有效日期`);
      }
    }

    return issues;
  }

  /**
   * 获取嵌套对象值
   */
  private static getNestedValue(obj: any, path: (string | number)[]): any {
    return path.reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * 验证日期格式
   */
  private static isValidDate(date: any): boolean {
    if (typeof date === 'string') {
      return !isNaN(Date.parse(date));
    }
    if (date instanceof Date) {
      return !isNaN(date.getTime());
    }
    return false;
  }

  /**
   * 识别数据问题
   */
  private static identifyIssues(
    mcpData: AnalysisState['mcpData'],
    completeness: number,
    freshness: number,
    consistency: number
  ): string[] {
    const issues: string[] = [];

    // 完整性问题
    if (completeness < 0.5) {
      issues.push('数据完整性不足，关键信息缺失');
    }
    
    if (!mcpData.basicInfo?.stock_name) {
      issues.push('股票基本信息缺失公司名称');
    }
    
    if (!mcpData.realtimeData?.price) {
      issues.push('实时价格数据缺失');
    }

    // 新鲜度问题
    if (freshness < 0.5) {
      issues.push('数据新鲜度不足，可能影响分析准确性');
    }

    // 一致性问题
    if (consistency < 0.6) {
      issues.push('数据一致性存在问题，不同数据源信息不匹配');
    }

    // 特定数据问题
    if (mcpData.historicalData?.data && mcpData.historicalData.data.length < 5) {
      issues.push('历史数据点不足，技术分析可能不准确');
    }

    if (mcpData.financialData?.data && mcpData.financialData.data.length === 0) {
      issues.push('财务数据缺失，基本面分析受限');
    }

    return issues;
  }

  /**
   * 生成数据质量报告
   */
  static generateQualityReport(dataQuality: DataQualityScore): {
    level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    summary: string;
    recommendations: string[];
  } {
    const score = dataQuality.score;
    const issues = dataQuality.issues;

    let level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    let summary: string;
    let recommendations: string[] = [];

    if (score >= 0.8) {
      level = 'excellent';
      summary = '数据质量优秀，支持全面的分析';
      recommendations = ['可以进行完整的股票分析', '建议使用并行分析模式'];
    } else if (score >= 0.6) {
      level = 'good';
      summary = '数据质量良好，基本满足分析需求';
      recommendations = ['可以进行股票分析', '建议关注缺失数据的影响'];
    } else if (score >= 0.4) {
      level = 'fair';
      summary = '数据质量一般，部分分析可能受限';
      recommendations = ['谨慎进行分析', '建议获取缺失数据后重试', '部分分析结果可能不够准确'];
    } else if (score >= 0.2) {
      level = 'poor';
      summary = '数据质量较差，分析结果可靠性较低';
      recommendations = ['建议先完善数据', '当前分析结果仅供参考', '重点关注数据完整性问题'];
    } else {
      level = 'critical';
      summary = '数据质量严重不足，无法进行有效分析';
      recommendations = ['建议终止分析', '优先解决数据问题', '检查数据源连接'];
    }

    return {
      level,
      summary,
      recommendations: [...recommendations, ...issues.map(issue => `⚠️ ${issue}`)],
    };
  }
}