import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { AbstractNewsCrawlerService, CrawlerHeaders } from '../interfaces/news-crawler.interface';
import { NewsRegion } from '../entities/raw-news.entity';

/**
 * 新闻联播爬虫服务
 */
@Injectable()
export class XWLBCrawlerService extends AbstractNewsCrawlerService {
  private readonly logger = new Logger(XWLBCrawlerService.name);
  private readonly baseUrl: string;
  private readonly sourceCode: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.baseUrl = this.configService.get<string>('crawler.xwlb.baseUrl', '');
    this.sourceCode = this.configService.get<string>('crawler.xwlb.code', 'xwlb');
  }

  getSourceCode(): string {
    return this.sourceCode;
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
    const listUrl = `${this.baseUrl}/${dateStr}.shtml`;
    
    this.logger.log(JSON.stringify({
      category: 'HTTP_REQUEST',
      message: `Fetching news list from URL: ${listUrl}`,
      url: listUrl
    }));

    try {
      const listDoc = await this.getDocument(listUrl);
      const $ = cheerio.load(listDoc);
      
      const newsLinks = $('li div a');
      this.logger.log(JSON.stringify({
        category: 'SERVICE_INFO',
        message: `Found ${newsLinks.length} potential news links`,
        url: ''
      }));
      
      const urls: string[] = [];
      
      for (const link of newsLinks) {
        const href = $(link).attr('href');
        if (href) {
          // 构建绝对URL
          let fullUrl = href;
          if (href.startsWith('/')) {
            const urlObj = new URL(this.baseUrl);
            fullUrl = `${urlObj.protocol}//${urlObj.host}${href}`;
          } else if (!href.startsWith('http')) {
            fullUrl = new URL(href, listUrl).href;
          }
          urls.push(fullUrl);
        }
      }
      
      return urls;
    } catch (error) {
      this.logger.error(JSON.stringify({
        category: 'HTTP_ERROR',
        message: `Error fetching news list from URL: ${listUrl}`,
        url: listUrl
      }));
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
}