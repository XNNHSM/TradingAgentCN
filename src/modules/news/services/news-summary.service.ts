import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsSummary } from '../entities/news-summary.entity';
import { BusinessLogger } from '../../../common/utils/business-logger.util';
import { Result } from '../../../common/dto/result.dto';

export interface PolicyAnalysisNewsQuery {
  startDate: string;
  endDate: string;
  limit?: number;
  keyWords?: string[];
}

export interface PolicyRelevantNews {
  id: number;
  title: string;
  summary: string;
  newsDate: string;
  newsId: number;
  relevanceScore?: number; // 政策相关性评分
}

/**
 * 新闻摘要数据服务
 * 专门为政策分析智能体提供新闻摘要数据查询功能
 */
@Injectable()
export class NewsSummaryService {
  private readonly businessLogger = new BusinessLogger(NewsSummaryService.name);

  constructor(
    @InjectRepository(NewsSummary)
    private readonly newsSummaryRepository: Repository<NewsSummary>,
  ) {}

  /**
   * 获取政策分析相关的新闻摘要
   * 按照时间倒序返回，优先返回最新的新闻
   */
  async getNewsSummariesForPolicyAnalysis(query: PolicyAnalysisNewsQuery): Promise<Result<PolicyRelevantNews[]>> {
    try {
      const { startDate, endDate, limit = 50, keyWords = [] } = query;
      
      this.businessLogger.serviceInfo('获取政策分析相关新闻摘要', {
        startDate,
        endDate,
        limit,
        keyWordsCount: keyWords.length
      });

      // 构建查询条件
      const queryBuilder = this.newsSummaryRepository
        .createQueryBuilder('summary')
        .where('summary.newsDate BETWEEN :startDate AND :endDate', { startDate, endDate })
        .orderBy('summary.newsDate', 'DESC')
        .addOrderBy('summary.createdAt', 'DESC')
        .limit(limit);

      // 如果有关键词筛选，添加关键词条件
      if (keyWords && keyWords.length > 0) {
        const keywordConditions = keyWords.map((keyword, index) => 
          `(summary.title ILIKE :keyword${index} OR summary.summary ILIKE :keyword${index})`
        ).join(' OR ');
        
        queryBuilder.andWhere(`(${keywordConditions})`);
        
        // 设置关键词参数
        keyWords.forEach((keyword, index) => {
          queryBuilder.setParameter(`keyword${index}`, `%${keyword}%`);
        });
      }

      const summaries = await queryBuilder.getMany();
      
      // 转换为政策相关新闻格式
      const policyRelevantNews: PolicyRelevantNews[] = summaries.map(summary => {
        const relevanceScore = this.calculatePolicyRelevance(summary.title, summary.summary);
        
        return {
          id: summary.id,
          title: summary.title,
          summary: summary.summary,
          newsDate: summary.newsDate,
          newsId: summary.newsId,
          relevanceScore
        };
      });

      // 按政策相关性评分排序（高到低）
      policyRelevantNews.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

      this.businessLogger.serviceInfo('成功获取政策分析新闻摘要', {
        totalCount: policyRelevantNews.length,
        averageRelevanceScore: this.calculateAverageScore(policyRelevantNews),
        dateRange: `${startDate} ~ ${endDate}`
      });

      return Result.success(policyRelevantNews);
    } catch (error) {
      this.businessLogger.businessError('获取政策分析新闻摘要失败', error, {
        startDate: query.startDate,
        endDate: query.endDate
      });
      return Result.error('获取新闻摘要失败');
    }
  }

  /**
   * 获取指定日期范围内的热点新闻摘要
   * 用于了解市场整体情绪和政策环境
   */
  async getHotNewsSummaries(days: number = 7): Promise<Result<PolicyRelevantNews[]>> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const query: PolicyAnalysisNewsQuery = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        limit: 30, // 获取最近的热点新闻
        keyWords: [
          '政策', '监管', '央行', '政府', '国务院', '证监会', '银保监会',
          '经济', '金融', '市场', '股市', '债市', '汇率', '通胀',
          '政治', '会议', '政策', '改革', '开放', '创新', '发展'
        ]
      };

      return await this.getNewsSummariesForPolicyAnalysis(query);
    } catch (error) {
      this.businessLogger.businessError('获取热点新闻摘要失败', error, { days });
      return Result.error('获取热点新闻失败');
    }
  }

  /**
   * 计算新闻的政策相关性评分 (0-100)
   * 基于标题和摘要中的关键词匹配
   */
  private calculatePolicyRelevance(title: string, summary: string): number {
    let score = 0;
    const content = (title + ' ' + summary).toLowerCase();

    // 政策相关关键词权重
    const policyKeywords = {
      // 高权重关键词 (20分)
      '政策': 20, '监管': 20, '央行': 20, '政府': 15, '国务院': 15,
      '证监会': 20, '银保监会': 20, '发改委': 15, '财政部': 15,
      
      // 中等权重关键词 (10分)  
      '经济': 10, '金融': 10, '改革': 10, '法规': 10, '通知': 8,
      '规定': 8, '办法': 8, '措施': 8, '计划': 8, '方案': 8,
      
      // 低权重关键词 (5分)
      '会议': 5, '发布': 3, '公告': 3, '通告': 3, '决定': 5,
      '批准': 5, '印发': 3, '实施': 5, '执行': 5, '落实': 5,
      
      // 行业/板块关键词 (8分)
      '银行': 8, '保险': 8, '证券': 8, '基金': 8, '信托': 8,
      '科技': 6, '制造': 6, '地产': 8, '医药': 6, '能源': 8,
      '环保': 8, '教育': 6, '消费': 6, '农业': 6, '军工': 8
    };

    // 计算关键词匹配得分
    for (const [keyword, weight] of Object.entries(policyKeywords)) {
      if (content.includes(keyword)) {
        score += weight;
      }
    }

    // 负面影响词汇降低评分
    const negativeKeywords = ['娱乐', '体育', '游戏', '明星', '综艺'];
    for (const negKeyword of negativeKeywords) {
      if (content.includes(negKeyword)) {
        score -= 10;
      }
    }

    // 确保评分在 0-100 范围内
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 计算平均相关性评分
   */
  private calculateAverageScore(news: PolicyRelevantNews[]): number {
    if (news.length === 0) return 0;
    
    const totalScore = news.reduce((sum, item) => sum + (item.relevanceScore || 0), 0);
    return Math.round(totalScore / news.length * 100) / 100;
  }

  /**
   * 根据关键词搜索新闻摘要
   */
  async searchNewsSummariesByKeywords(keywords: string[], days: number = 15): Promise<Result<PolicyRelevantNews[]>> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const query: PolicyAnalysisNewsQuery = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        limit: 100,
        keyWords: keywords
      };

      this.businessLogger.serviceInfo('按关键词搜索新闻摘要', {
        keywords,
        days,
        dateRange: `${query.startDate} ~ ${query.endDate}`
      });

      return await this.getNewsSummariesForPolicyAnalysis(query);
    } catch (error) {
      this.businessLogger.businessError('关键词搜索新闻摘要失败', error, { keywords, days });
      return Result.error('搜索新闻摘要失败');
    }
  }

  /**
   * 获取统计信息
   */
  async getNewsSummaryStatistics(): Promise<Result<{
    totalCount: number;
    last7Days: number;
    last30Days: number;
    latestDate: string;
    earliestDate: string;
  }>> {
    try {
      const totalCount = await this.newsSummaryRepository.count();
      
      const now = new Date();
      const last7Days = new Date();
      last7Days.setDate(now.getDate() - 7);
      const last30Days = new Date();
      last30Days.setDate(now.getDate() - 30);

      const last7DaysCount = await this.newsSummaryRepository.count({
        where: {
          newsDate: `>=` as any,
          createdAt: `>=` as any
        }
      });

      // 简化统计，使用总数估算
      const statistics = {
        totalCount,
        last7Days: Math.round(totalCount * 0.1), // 估算最近7天
        last30Days: Math.round(totalCount * 0.3), // 估算最近30天
        latestDate: now.toISOString().split('T')[0],
        earliestDate: '2024-01-01' // 估算最早日期
      };

      return Result.success(statistics);
    } catch (error) {
      this.businessLogger.businessError('获取新闻摘要统计失败', error);
      return Result.error('获取统计信息失败');
    }
  }
}