import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { AbstractNewsCrawlerService, CrawlerHeaders } from '../interfaces/news-crawler.interface';
import { NewsRegion } from '../entities/raw-news.entity';
import { NewsLink, NewsContent } from '../../../temporal/workflows/news/news.activities';

/**
 * 新闻联播爬虫服务
 */
@Injectable()
export class XWLBCrawlerService extends AbstractNewsCrawlerService {
  constructor() {
    super();
  }

  getBaseUrl(): string {
    return "https://tv.cctv.com/lm/xwlb/day";
  }

  getSourceCode(): string {
    return 'xwlb';
  }

  getSourceName(): string {
    return '新闻联播';
  }

  getRegion(): NewsRegion {
    return NewsRegion.DOMESTIC;
  }

  getNeedSkipNewsTitle(): string[] {
    return ['《新闻联播》'];
  }

  protected getHeaders(): CrawlerHeaders {
    const baseHeaders = super.getHeaders();
    return {
      ...baseHeaders,
      'Referer': 'https://tv.cctv.com/',
    };
  }

  async getTargetUrls(date: string): Promise<string[]> {
    const dateStr = date.replace(/-/g, ''); // 转换为 YYYYMMDD 格式
    const listUrl = `${this.getBaseUrl()}/${dateStr}.shtml`;
    
    this.businessLogger.httpRequest('GET', listUrl, { date });

    try {
      const listDoc = await this.getDocument(listUrl);
      const $ = cheerio.load(listDoc);
      
      const newsLinks = $('li div a');
      this.businessLogger.serviceInfo(`Found ${newsLinks.length} potential news links`, { 
        count: newsLinks.length,
        date 
      });
      
      const urls: string[] = [];
      
      for (const link of newsLinks) {
        const href = $(link).attr('href');
        if (href) {
          // 构建绝对URL
          let fullUrl = href;
          if (href.startsWith('/')) {
            const urlObj = new URL(this.getBaseUrl());
            fullUrl = `${urlObj.protocol}//${urlObj.host}${href}`;
          } else if (!href.startsWith('http')) {
            fullUrl = new URL(href, listUrl).href;
          }
          urls.push(fullUrl);
        }
      }
      
      return urls;
    } catch (error) {
      this.businessLogger.httpError(listUrl, error);
      return [];
    }
  }

  async getDocument(url: string): Promise<string> {
    const response = await axios.get(url, {
      headers: this.getHeaders(),
      timeout: 10000,
    });
    return response.data;
  }

  protected extractTitle(document: string): string | null {
    const $ = cheerio.load(document);
    let title = $('title').text();
    
    if (title.startsWith('[视频]')) {
      title = title.substring(4).trim();
    }
    
    return title || null;
  }

  protected extractContent(document: string): string | null {
    const $ = cheerio.load(document);
    const contentArea = $('div.content_area');
    
    if (contentArea.length === 0) {
      return null;
    }
    
    let content = contentArea.text().trim();
    
    if (content.startsWith('央视网消息（新闻联播）：')) {
      content = content.substring('央视网消息（新闻联播）：'.length);
    }
    
    return content || null;
  }

  /**
   * 爬取单个新闻的详细内容
   * 实现粒度化爬取功能，支持Temporal子工作流
   */
  async crawlSingleNews(newsLink: NewsLink): Promise<NewsContent> {
    try {
      this.businessLogger.serviceInfo(`爬取单个新闻: ${newsLink.title || newsLink.url}`, {
        source: this.getSourceCode(),
        url: newsLink.url
      });

      const document = await this.getDocument(newsLink.url);
      const title = this.extractTitle(document);
      const content = this.extractContent(document);

      if (!title || !content) {
        throw new Error(`无法从页面提取标题或内容: ${newsLink.url}`);
      }

      const newsContent: NewsContent = {
        title,
        content,
        url: newsLink.url,
        publishTime: newsLink.publishTime,
        source: this.getSourceCode()
      };

      this.businessLogger.serviceInfo(`单个新闻爬取成功: ${title}`, {
        source: this.getSourceCode(),
        url: newsLink.url,
        titleLength: title.length,
        contentLength: content.length
      });

      return newsContent;
    } catch (error) {
      this.businessLogger.serviceError(`单个新闻爬取失败: ${newsLink.url}`, error, {
        source: this.getSourceCode(),
        url: newsLink.url,
        title: newsLink.title
      });
      throw error;
    }
  }
}