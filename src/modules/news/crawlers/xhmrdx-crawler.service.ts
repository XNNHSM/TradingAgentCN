import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { AbstractNewsCrawlerService } from '../interfaces/news-crawler.interface';
import { NewsRegion } from '../entities/raw-news.entity';

/**
 * 新华每日电讯爬虫服务
 */
@Injectable()
export class XHMRDXCrawlerService extends AbstractNewsCrawlerService {
  constructor() {
    super();
  }

  getBaseUrl(): string {
    return 'http://mrdx.cn';
  }

  getSourceCode(): string {
    return 'xhmrdx';
  }

  getSourceName(): string {
    return '新华每日电讯';
  }

  getRegion(): NewsRegion {
    return NewsRegion.DOMESTIC;
  }

  async getTargetUrls(date: string): Promise<string[]> {
    const dateStr = date.replace(/-/g, ''); // 转换为 YYYYMMDD 格式
    const indexUrl = `${this.getBaseUrl()}/content/${dateStr}/Page01DK.htm`;
    
    this.businessLogger.httpRequest('GET', indexUrl, { date });

    try {
      const indexDoc = await this.getDocument(indexUrl);
      const $ = cheerio.load(indexDoc);
      
      const newsLinks = $('div.listdaohang ul li a');
      const urls: string[] = [];
      
      for (const link of newsLinks) {
        const daoxiang = $(link).attr('daoxiang');
        if (daoxiang) {
          urls.push(`${this.getBaseUrl()}/content/${dateStr}/${daoxiang}`);
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
    const titleElement = $('#contenttext > table > tbody > tr:nth-child(2) > td > div > strong > font');
    return titleElement.length > 0 ? titleElement.text().trim() : null;
  }

  protected extractContent(document: string): string | null {
    const $ = cheerio.load(document);
    const contentElement = $('#contenttext > div:nth-child(7)');
    return contentElement.length > 0 ? contentElement.text().trim() : null;
  }
}