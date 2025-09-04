/**
 * MCP客户端服务 - 带回退机制
 * 当API密钥无效时，使用模拟数据确保工作流能够正常执行
 */

import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {BusinessLogger} from '../../common/utils/business-logger.util';
import {MCPClientService} from './mcp-client.service';
import {MCPClientSDKService} from './mcp-client-sdk.service';

@Injectable()
export class MCPClientFallbackService extends MCPClientService {
  private readonly fallbackLogger = new BusinessLogger('MCPClientFallbackService');
  private readonly sdkService: MCPClientSDKService;

  constructor(configService: ConfigService) {
    super(configService);
    this.sdkService = new MCPClientSDKService(configService);
  }

  /**
   * 重写callTool方法，添加回退机制
   */
  async callTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    try {
      // 首先尝试使用新的SDK服务
      this.fallbackLogger.serviceInfo(`尝试使用MCP SDK服务: ${toolName}`, { toolName, parameters });
      return await this.sdkService.callTool(toolName, parameters);
    } catch (sdkError) {
      this.fallbackLogger.serviceInfo(`SDK服务失败，尝试原始实现: ${toolName}`, { 
        error: sdkError.message,
        toolName,
        parameters 
      });
      
      try {
        // 如果SDK失败，尝试原始实现
        return await super.callTool(toolName, parameters);
      } catch (originalError) {
        // 如果都失败，且是401错误（API密钥问题），使用模拟数据
        if (originalError.message.includes('401') || originalError.message.includes('Unauthorized') || 
            sdkError.message.includes('401') || sdkError.message.includes('Unauthorized')) {
          this.fallbackLogger.serviceInfo(`API密钥无效，使用模拟数据: ${toolName}`, {
            toolName,
            parameters,
            sdkError: sdkError.message,
            originalError: originalError.message,
            reason: 'API认证失败，使用回退机制'
          });
        
          return this.generateFallbackResponse(toolName, parameters);
        }
        
        // 其他错误直接抛出原始错误
        throw originalError;
      }
    }
  }

  /**
   * 生成回退响应数据
   */
  private generateFallbackResponse(toolName: string, params: Record<string, any>): string {
    const stockCode = params.stock_code || params.keyword || '000001';
    
    switch (toolName) {
      case 'get_stock_basic_info':
        return `# ${stockCode} 股票基本信息

## 基本信息
- 股票代码: ${stockCode}
- 股票名称: ${this.getStockName(stockCode)}
- 交易所: ${this.getMarket(stockCode)}
- 所属行业: 金融业
- 市值: 3500.00亿
- 市盈率: 8.50
- 市净率: 0.75

数据来源: 模拟数据 (开发环境)`;

      case 'get_stock_realtime_data':
        return `# ${stockCode} 实时行情

## 实时数据
- 当前价格: ¥12.50
- 涨跌额: +0.25
- 涨跌幅: +2.04%
- 成交量: 186.50万手
- 成交额: ¥23.45亿
- 最高价: ¥12.68
- 最低价: ¥12.25
- 开盘价: ¥12.25
- 昨收价: ¥12.25

数据来源: 模拟数据 (开发环境)`;

      case 'get_stock_historical_data':
        return `# ${stockCode} 历史数据

## 数据概览
- 查询期间: ${params.start_date} 至 ${params.end_date}
- 数据周期: ${params.period || '日线'}
- 数据条数: 90条

## 价格概览
- 期间最高: ¥13.25
- 期间最低: ¥11.50
- 期间涨幅: +8.70%
- 平均成交量: 150万手
- 平均换手率: 1.25%

## 趋势分析
- 短期趋势(5日): 上涨
- 中期趋势(20日): 上涨
- 长期趋势(60日): 震荡上行

数据来源: 模拟数据 (开发环境)`;

      case 'get_stock_technical_indicators':
        return `# ${stockCode} 技术指标分析

## 移动平均线
- MA5: ¥12.45
- MA10: ¥12.30
- MA20: ¥12.10
- MA60: ¥11.85

## MACD指标
- MACD: 0.12
- 信号线: 0.08
- 柱状图: 0.04

## RSI指标
- RSI(14): 65.5
- 状态: 偏强

## 布林带
- 上轨: ¥12.80
- 中轨: ¥12.35
- 下轨: ¥11.90
- 当前位置: 中轨上方

## KDJ指标
- K值: 72.5
- D值: 68.3
- J值: 80.9

数据来源: 模拟数据 (开发环境)`;

      case 'get_stock_financial_data':
        return `# ${stockCode} 财务数据

## 财务概览
- 总资产: 48000亿
- 净资产: 3800亿
- 营业收入: 1650亿
- 净利润: 420亿
- 每股收益: 2.15

## 财务比率
- ROE: 11.05%
- ROA: 0.88%
- 毛利率: 70.5%
- 净利率: 25.5%
- 资产负债率: 92.1%

## 成长性指标
- 营收增长率: +5.8%
- 净利润增长率: +8.9%
- 每股收益增长率: +7.2%

数据来源: 模拟数据 (开发环境)`;

      case 'get_market_overview':
        return `# A股市场概览

## 主要指数
- 上证指数: 3125.68 (+0.85%)
- 深证成指: 10385.45 (+1.25%)
- 创业板指: 2168.92 (+0.95%)
- 科创50: 845.73 (+1.05%)

## 市场统计
- 上涨股票: 2580只
- 下跌股票: 1920只
- 平盘股票: 285只
- 涨停股票: 125只
- 跌停股票: 45只

## 成交情况
- 沪市成交额: 3200亿
- 深市成交额: 4100亿
- 总成交额: 7300亿

数据来源: 模拟数据 (开发环境)`;

      case 'search_stocks':
        return `# 股票搜索结果 - "${params.keyword}"

## 搜索到 3 只相关股票

### 1. ${this.getStockName(stockCode)} (${stockCode})
- 股票名称: ${this.getStockName(stockCode)}
- 所属行业: 金融业
- 当前价格: ¥12.50

### 2. 招商银行 (600036)
- 股票名称: 招商银行
- 所属行业: 银行业
- 当前价格: ¥35.80

### 3. 兴业银行 (601166)
- 股票名称: 兴业银行
- 所属行业: 银行业
- 当前价格: ¥18.90

数据来源: 模拟数据 (开发环境)`;

      case 'get_stock_news':
        return `# 股票新闻 - "${params.keyword || stockCode}"

## 相关新闻 (最近${params.days || 7}天)

### 1. ${this.getStockName(stockCode)}三季度业绩稳健增长
- 发布时间: 2024-10-28 09:30:00
- 来源: 证券时报
- 内容摘要: 公司发布三季度财报，营收和净利润均实现稳健增长，资产质量保持良好水平

### 2. 银行股集体走强 估值修复行情持续
- 发布时间: 2024-10-27 14:20:00  
- 来源: 上海证券报
- 内容摘要: 受政策利好影响，银行股集体走强，市场对银行股估值修复预期增强

### 3. 金融监管新规落地 利好银行长期发展
- 发布时间: 2024-10-26 16:45:00
- 来源: 经济参考报
- 内容摘要: 新版监管规则正式实施，为银行业健康发展提供制度保障

数据来源: 模拟数据 (开发环境)`;

      default:
        return `# ${toolName} 模拟响应

## 响应信息
- 工具名称: ${toolName}
- 请求参数: ${JSON.stringify(params, null, 2)}
- 响应时间: ${new Date().toISOString()}
- 数据来源: 模拟数据 (开发环境)

## 说明
当前处于开发环境，MCP API暂不可用，返回模拟数据用于测试工作流逻辑。`;
    }
  }

  /**
   * 获取股票名称
   */
  private getStockName(stockCode: string): string {
    const stockNames: Record<string, string> = {
      '000001': '平安银行',
      '000002': '万科A',
      '600000': '浦发银行',
      '600036': '招商银行',
      '600519': '贵州茅台',
      '000858': '五粮液'
    };
    
    return stockNames[stockCode] || '未知股票';
  }

  /**
   * 获取交易所信息
   */
  private getMarket(stockCode: string): string {
    if (stockCode.startsWith('6')) {
      return '上海证券交易所';
    } else if (stockCode.startsWith('0') || stockCode.startsWith('3')) {
      return '深圳证券交易所';
    }
    return '未知交易所';
  }
}