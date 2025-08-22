import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { AbstractNewsCrawlerService } from '../interfaces/news-crawler.interface';
import { NewsRegion } from '../entities/raw-news.entity';

/**
 * 经济日报爬虫服务
 */
@Injectable()
export class JJRBCrawlerService extends AbstractNewsCrawlerService {
  constructor() {
    super();
  }


  getBaseUrl(): string {
    return 'http://paper.ce.cn/pc';
  }

  getSourceCode(): string {
    return 'jjrb';
  }

  getSourceName(): string {
    return '经济日报';
  }

  getRegion(): NewsRegion {
    return NewsRegion.DOMESTIC;
  }

  getNeedSkipNewsTitle(): string[] {
    return ['社址', '图片新闻', '投稿网站', '来稿邮箱'];
  }

  async getTargetUrls(date: string): Promise<string[]> {
    const dateObj = new Date(date);
    const yearMonth = dateObj.getFullYear() + String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    const indexUrl = `${this.getBaseUrl()}/layout/${yearMonth}/${day}/node_01.html`;
    
    this.businessLogger.httpRequest('GET', indexUrl, { date });

    try {
      const indexDoc = await this.getDocument(indexUrl);
      const $ = cheerio.load(indexDoc);
      
      const newsLinks = $('#layoutlist > li.posRelative > a');
      const urls: string[] = [];
      
      for (const link of newsLinks) {
        const href = $(link).attr('href');
        if (href) {
          const fullUrl = `${this.getBaseUrl()}/layout/${yearMonth}/${day}/${href}`;
          
          try {
            const document = await this.getDocument(fullUrl);
            const doc$ = cheerio.load(document);
            const areas = doc$('body > div.content > div.wrap > div.clearfix > div.newspaper-pic.pull-left > map > area');
            
            for (const area of areas) {
              const areaHref = doc$(area).attr('href');
              if (areaHref) {
                const processedHref = this.processPrefix(areaHref);
                urls.push(`${this.getBaseUrl()}/${processedHref}`);
              }
            }
          } catch (error) {
            this.businessLogger.httpError(fullUrl, error);
          }
        }
      }
      
      return urls;
    } catch (error) {
      this.businessLogger.httpError(indexUrl, error);
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
    const titleElement = $('#Title > p');
    return titleElement.length > 0 ? titleElement.text().trim() : null;
  }

  protected extractContent(document: string): string | null {
    const $ = cheerio.load(document);
    const contentElement = $('#ozoom > founder-content');
    return contentElement.length > 0 ? contentElement.text().trim() : null;
  }

  private processPrefix(str: string): string {
    while (str.startsWith('../')) {
      str = str.substring(3);
    }
    return str;
  }
}