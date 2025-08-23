import { AbstractNewsCrawlerService } from './news-crawler.interface';

export enum NewsSource {
  XWLB = 'xwlb',        // 新闻联播
}

export interface INewsCrawlerFactory {
  /**
   * 根据新闻源代码创建对应的爬虫服务
   */
  createCrawler(source: NewsSource): AbstractNewsCrawlerService;

  /**
   * 获取所有支持的新闻源
   */
  getSupportedSources(): NewsSource[];

  /**
   * 检查是否支持指定的新闻源
   */
  isSourceSupported(source: string): boolean;
}

export abstract class AbstractNewsCrawlerFactory implements INewsCrawlerFactory {
  abstract createCrawler(source: NewsSource): AbstractNewsCrawlerService;
  
  getSupportedSources(): NewsSource[] {
    return Object.values(NewsSource);
  }
  
  isSourceSupported(source: string): boolean {
    return Object.values(NewsSource).includes(source as NewsSource);
  }
}