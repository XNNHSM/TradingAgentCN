import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BusinessLogger } from '../../common/utils/business-logger.util';

/**
 * 新闻分析缓存服务
 * 提供基于日期的新闻分析结果缓存功能
 */
@Injectable()
export class NewsAnalysisCacheService {
  private readonly businessLogger = new BusinessLogger(NewsAnalysisCacheService.name);
  private readonly CACHE_PREFIX = 'news_analysis:';
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时缓存

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  /**
   * 生成缓存键
   */
  private generateCacheKey(date: string): string {
    return `${this.CACHE_PREFIX}${date}`;
  }

  /**
   * 获取指定日期的分析结果缓存
   */
  async getCachedAnalysis(date: string): Promise<any | null> {
    try {
      const cacheKey = this.generateCacheKey(date);
      const cachedResult = await this.cacheManager.get(cacheKey);
      
      if (cachedResult) {
        this.businessLogger.serviceInfo('从缓存获取新闻分析结果', { date });
        return cachedResult;
      }
      
      return null;
    } catch (error) {
      this.businessLogger.businessError('获取缓存失败', error, { date });
      return null;
    }
  }

  /**
   * 缓存分析结果
   */
  async cacheAnalysisResult(date: string, result: any): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(date);
      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
      
      this.businessLogger.serviceInfo('新闻分析结果已缓存', { 
        date,
        ttl: this.CACHE_TTL,
        cacheKey
      });
    } catch (error) {
      this.businessLogger.businessError('缓存分析结果失败', error, { date });
    }
  }

  /**
   * 清除指定日期的缓存
   */
  async clearCache(date: string): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(date);
      await this.cacheManager.del(cacheKey);
      
      this.businessLogger.serviceInfo('清除新闻分析缓存', { date, cacheKey });
    } catch (error) {
      this.businessLogger.businessError('清除缓存失败', error, { date });
    }
  }

  /**
   * 清除所有新闻分析缓存
   */
  async clearAllCache(): Promise<void> {
    try {
      const keys = await this.cacheManager.store.keys();
      const newsAnalysisKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      for (const key of newsAnalysisKeys) {
        await this.cacheManager.del(key);
      }
      
      this.businessLogger.serviceInfo('清除所有新闻分析缓存', { 
        clearedCount: newsAnalysisKeys.length 
      });
    } catch (error) {
      this.businessLogger.businessError('清除所有缓存失败', error);
    }
  }

  /**
   * 检查缓存是否存在
   */
  async hasCache(date: string): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(date);
      const cachedResult = await this.cacheManager.get(cacheKey);
      return cachedResult !== undefined;
    } catch (error) {
      this.businessLogger.businessError('检查缓存状态失败', error, { date });
      return false;
    }
  }
}