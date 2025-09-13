/**
 * 数据收集节点
 * 负责并行收集所有必要的 MCP 数据
 */

import { AnalysisState, AnalysisError } from '../state-manager';
import { BusinessLogger, LogCategory } from '../../../common/utils/business-logger.util';

/**
 * 数据收集节点
 * 并行获取所有必要的 MCP 数据
 */
export class DataCollectionNode {
  private readonly logger: BusinessLogger;

  constructor(
    private readonly mcpClientService: any
  ) {
    this.logger = new BusinessLogger(DataCollectionNode.name);
  }

  /**
   * 创建数据收集节点函数
   */
  createNode(): (state: AnalysisState) => Promise<Partial<AnalysisState>> {
    return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
      const startTime = Date.now();
      
      this.logger.serviceInfo('开始数据收集阶段', {
        stockCode: state.stockCode,
        sessionId: state.sessionId,
      });

      try {
        // 并行收集所有 MCP 数据
        const mcpData = await this.collectAllMcpData(state.stockCode);
        
        // 验证数据完整性
        const validation = this.validateMcpData(mcpData);
        
        if (!validation.valid) {
          this.logger.warn(LogCategory.SERVICE_ERROR, 'MCP 数据验证失败', undefined, {
            stockCode: state.stockCode,
            errors: validation.errors,
          });
          
          // 添加数据质量错误
          const dataError: AnalysisError = {
            agentName: 'DataCollectionNode',
            error: `数据收集失败: ${validation.errors.join(', ')}`,
            type: 'DATA_ERROR',
            timestamp: new Date(),
            retryable: true,
          };

          return {
            mcpData,
            currentStage: 'data_collection_completed_with_errors',
            errors: [...(state.errors || []), dataError],
            processingTime: Date.now() - startTime,
          };
        }

        this.logger.serviceInfo('数据收集完成', {
          stockCode: state.stockCode,
          dataFields: Object.keys(mcpData).filter(key => mcpData[key] !== null),
          processingTime: Date.now() - startTime,
        });

        return {
          mcpData,
          currentStage: 'data_collection_completed',
          processingTime: Date.now() - startTime,
        };

      } catch (error) {
        return this.handleDataCollectionError(error, state, startTime);
      }
    };
  }

  /**
   * 并行收集所有 MCP 数据
   */
  private async collectAllMcpData(stockCode: string): Promise<AnalysisState['mcpData']> {
    // 设置超时时间
    const timeout = 30000; // 30秒超时
    
    // 构建所有数据获取任务
    const dataTasks = [
      this.safeCallMCP('getStockBasicInfo', () => 
        this.mcpClientService.callTool('get_stock_basic_info', { stock_code: stockCode }),
        { stock_name: stockCode, stock_code: stockCode, industry: '未知', market: '未知' }
      ),
      
      this.safeCallMCP('getStockRealtimeData', () => 
        this.mcpClientService.callTool('get_stock_realtime_data', { stock_code: stockCode }),
        { price: 0, change: 0, change_percent: 0, volume: 0, market_cap: 0, timestamp: new Date().toISOString() }
      ),
      
      this.safeCallMCP('getStockHistoricalData', () => 
        this.mcpClientService.callTool('get_stock_historical_data', {
          stock_code: stockCode,
          start_date: this.getDateBefore(90),
          end_date: this.getTodayDate(),
          period: 'daily',
        }),
        { data: [], message: '历史数据获取失败' }
      ),
      
      this.safeCallMCP('getStockTechnicalIndicators', () => 
        this.mcpClientService.callTool('get_stock_technical_indicators', {
          stock_code: stockCode,
          indicators: ['MA5', 'MA10', 'MA20', 'RSI', 'MACD', 'BOLL_UPPER', 'BOLL_MIDDLE', 'BOLL_LOWER'],
          start_date: this.getDateBefore(90),
          end_date: this.getTodayDate(),
        }),
        { data: [], message: '技术指标获取失败' }
      ),
      
      this.safeCallMCP('getStockFinancialData', () => 
        this.mcpClientService.callTool('get_stock_financial_data', {
          stock_code: stockCode,
          report_type: 'annual',
          period: '2023',
        }),
        { data: [], message: '财务数据获取失败' }
      ),
      
      this.safeCallMCP('getMarketOverview', () => 
        this.mcpClientService.callTool('get_market_overview', { 
          symbol: this.formatStockSymbol(stockCode) 
        }),
        { market_trend: '未知', major_indices: [], message: '市场概况获取失败' }
      ),
      
      this.safeCallMCP('getStockNews', () => 
        this.mcpClientService.callTool('get_stock_news', {
          stock_code: stockCode,
          start_date: this.getDateBefore(7),
          end_date: this.getTodayDate(),
          limit: 10,
        }),
        { news: [], message: '新闻数据获取失败' }
      ),
    ];

    // 使用 Promise.allSettled 并行执行所有任务
    const results = await Promise.allSettled(dataTasks.map(task => 
      Promise.race([
        task,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Data collection timeout')), timeout)
        )
      ])
    ));

    // 处理结果
    const mcpData: AnalysisState['mcpData'] = {
      basicInfo: null,
      realtimeData: null,
      historicalData: null,
      technicalIndicators: null,
      financialData: null,
      marketOverview: null,
      news: null,
    };

    const dataFields = [
      'basicInfo', 'realtimeData', 'historData', 'technicalIndicators', 
      'financialData', 'marketOverview', 'news'
    ];

    results.forEach((result, index) => {
      const fieldName = dataFields[index];
      
      if (result.status === 'fulfilled') {
        mcpData[fieldName as keyof AnalysisState['mcpData']] = result.value;
      } else {
        this.logger.warn(LogCategory.SERVICE_ERROR, `MCP 数据获取失败: ${fieldName}`, undefined, {
          error: result.reason.message,
          stockCode,
        });
        // 保持 null 值，后续由验证逻辑处理
      }
    });

    return mcpData;
  }

  /**
   * 安全调用 MCP 服务
   */
  private async safeCallMCP<T>(
    functionName: string,
    mcpCall: () => Promise<T>,
    defaultValue: T
  ): Promise<T> {
    try {
      const result = await mcpCall();
      return result || defaultValue;
    } catch (error) {
      this.logger.warn(LogCategory.SERVICE_ERROR, `MCP 调用失败: ${functionName}`, undefined, {
        error: error.message,
        stack: error.stack,
      });
      return defaultValue;
    }
  }

  /**
   * 验证 MCP 数据完整性
   */
  private validateMcpData(mcpData: AnalysisState['mcpData']): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 必要数据检查
    const essentialChecks = [
      { 
        name: '基本信息', 
        data: mcpData.basicInfo, 
        requiredFields: ['stock_code', 'stock_name'] 
      },
      { 
        name: '实时数据', 
        data: mcpData.realtimeData, 
        requiredFields: ['price'] 
      },
    ];

    for (const check of essentialChecks) {
      if (!check.data || typeof check.data !== 'object') {
        errors.push(`${check.name}数据缺失或格式错误`);
        continue;
      }

      const missingFields = check.requiredFields.filter(field => !check.data[field]);
      if (missingFields.length > 0) {
        errors.push(`${check.name}缺少必要字段: ${missingFields.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 处理数据收集错误
   */
  private handleDataCollectionError(
    error: any, 
    state: AnalysisState, 
    startTime: number
  ): Partial<AnalysisState> {
    const processingTime = Date.now() - startTime;
    const errorMessage = error.message || '数据收集失败';

    this.logger.serviceError('数据收集阶段失败', error as Error, {
      stockCode: state.stockCode,
      sessionId: state.sessionId,
      processingTime,
    });

    const dataError: AnalysisError = {
      agentName: 'DataCollectionNode',
      error: errorMessage,
      type: 'DATA_ERROR',
      timestamp: new Date(),
      retryable: true,
    };

    // 返回部分数据，让后续节点能够继续处理
    return {
      mcpData: state.mcpData, // 保持原有数据
      currentStage: 'data_collection_failed',
      errors: [...(state.errors || []), dataError],
      processingTime,
    };
  }

  /**
   * 格式化股票代码
   */
  private formatStockSymbol(stockCode: string): string {
    if (stockCode.startsWith('SH') || stockCode.startsWith('SZ')) {
      return stockCode;
    }
    
    // 6、9开头 → SH；0、3开头 → SZ
    if (stockCode.startsWith('6') || stockCode.startsWith('9')) {
      return `SH${stockCode}`;
    } else {
      return `SZ${stockCode}`;
    }
  }

  /**
   * 获取今天日期字符串
   */
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 获取指定天数前的日期字符串
   */
  private getDateBefore(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  /**
   * 获取数据收集统计信息
   */
  getDataCollectionStats(mcpData: AnalysisState['mcpData']): {
    totalFields: number;
    availableFields: number;
    completeness: number;
    fieldStatus: Record<string, boolean>;
  } {
    const fields = [
      'basicInfo', 'realtimeData', 'historicalData', 
      'technicalIndicators', 'financialData', 'marketOverview', 'news'
    ];

    const fieldStatus: Record<string, boolean> = {};
    let availableFields = 0;

    for (const field of fields) {
      const hasData = mcpData[field as keyof AnalysisState['mcpData']] !== null;
      fieldStatus[field] = hasData;
      if (hasData) {
        availableFields++;
      }
    }

    return {
      totalFields: fields.length,
      availableFields,
      completeness: availableFields / fields.length,
      fieldStatus,
    };
  }
}