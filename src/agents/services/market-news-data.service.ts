import {Injectable} from '@nestjs/common';
import {NewsSummaryService, PolicyRelevantNews} from '../../modules/news/services/news-summary.service';
import {BusinessLogger} from '../../common/utils/business-logger.util';
import {Result} from '../../common/dto/result.dto';
import {DateTimeUtil} from '../../common/utils/date-time.util';

/**
 * 市场新闻数据服务
 * 为新闻分析智能体提供市场新闻数据获取功能
 */
@Injectable()
export class MarketNewsDataService {
  private readonly businessLogger = new BusinessLogger(MarketNewsDataService.name);

  constructor(
    private readonly newsSummaryService: NewsSummaryService
  ) {}

  /**
   * 获取指定日期范围内的市场新闻摘要
   */
  async getMarketNewsSummaries(startDate: string, endDate: string): Promise<Result<PolicyRelevantNews[]>> {
    try {
      this.businessLogger.serviceInfo('获取市场新闻摘要', {
        startDate,
        endDate
      });

      // 验证日期格式
      if (!DateTimeUtil.isValidDate(startDate) || !DateTimeUtil.isValidDate(endDate)) {
        return Result.error('日期格式无效');
      }

      // 验证日期范围
      if (new Date(startDate) > new Date(endDate)) {
        return Result.error('开始日期不能晚于结束日期');
      }

      // 计算日期范围天数
      const daysDiff = DateTimeUtil.getDaysDifference(startDate, endDate);
      if (daysDiff > 30) {
        return Result.error('日期范围不能超过30天');
      }

      // 使用新闻摘要服务的查询功能
      const result = await this.newsSummaryService.getNewsSummariesForPolicyAnalysis({
        startDate,
        endDate,
        limit: 100, // 限制新闻数量
        keyWords: [
          // 政策相关关键词
          '政策', '监管', '央行', '政府', '国务院', '证监会', '银保监会', '发改委', '财政部',
          // 经济金融关键词
          '经济', '金融', '市场', '股市', '债市', '汇率', '通胀', '利率', '货币',
          // 行业相关关键词
          '银行', '保险', '证券', '科技', '制造', '地产', '医药', '能源', '环保', '消费',
          // 发展相关关键词
          '改革', '开放', '创新', '发展', '投资', '建设', '规划', '战略'
        ]
      });

      if (result.code === 0) {
        this.businessLogger.serviceInfo('成功获取市场新闻摘要', {
          newsCount: result.data?.length || 0,
          dateRange: `${startDate} ~ ${endDate}`
        });
      }

      return result;
    } catch (error) {
      this.businessLogger.businessError('获取市场新闻摘要失败', error, {
        startDate,
        endDate
      });
      return Result.error('获取市场新闻摘要失败');
    }
  }

  /**
   * 获取最近N天的市场新闻摘要
   */
  async getRecentMarketNewsSummaries(days: number = 7): Promise<Result<PolicyRelevantNews[]>> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const startDateStr = DateTimeUtil.formatDate(startDate);
      const endDateStr = DateTimeUtil.formatDate(endDate);

      return await this.getMarketNewsSummaries(startDateStr, endDateStr);
    } catch (error) {
      this.businessLogger.businessError('获取最近市场新闻摘要失败', error, { days });
      return Result.error('获取最近市场新闻摘要失败');
    }
  }

  /**
   * 获取今日市场新闻摘要
   */
  async getTodayMarketNewsSummaries(): Promise<Result<PolicyRelevantNews[]>> {
    try {
      const today = DateTimeUtil.formatDate(new Date());
      return await this.getMarketNewsSummaries(today, today);
    } catch (error) {
      this.businessLogger.businessError('获取今日市场新闻摘要失败', error);
      return Result.error('获取今日市场新闻摘要失败');
    }
  }

  /**
   * 按关键词搜索市场新闻
   */
  async searchMarketNewsByKeywords(keywords: string[], days: number = 15): Promise<Result<PolicyRelevantNews[]>> {
    try {
      this.businessLogger.serviceInfo('按关键词搜索市场新闻', {
        keywords,
        days
      });

      return await this.newsSummaryService.searchNewsSummariesByKeywords(keywords, days);
    } catch (error) {
      this.businessLogger.businessError('搜索市场新闻失败', error, { keywords, days });
      return Result.error('搜索市场新闻失败');
    }
  }

  /**
   * 获取市场新闻统计信息
   */
  async getMarketNewsStatistics(): Promise<Result<{
    totalCount: number;
    last7Days: number;
    last30Days: number;
    latestDate: string;
    earliestDate: string;
  }>> {
    try {
      return await this.newsSummaryService.getNewsSummaryStatistics();
    } catch (error) {
      this.businessLogger.businessError('获取市场新闻统计失败', error);
      return Result.error('获取市场新闻统计失败');
    }
  }
}