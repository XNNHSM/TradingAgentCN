import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { AbstractNewsCrawlerService } from '../interfaces/news-crawler.interface';
import { NewsRegion } from '../entities/raw-news.entity';

/**
 * 新华每日电讯爬虫服务
 */
@Injectable()
export class XHMRDXCrawlerService extends AbstractNewsCrawlerService {
  private readonly logger = new Logger(XHMRDXCrawlerService.name);
  private readonly baseUrl: string;
  private readonly sourceCode: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.baseUrl = this.configService.get<string>('crawler.xhmrdx.baseUrl', 'http://mrdx.cn');
    this.sourceCode = this.configService.get<string>('crawler.xhmrdx.code', 'xhmrdx');
  }

  getSourceCode(): string {
    return this.sourceCode;
  }

  getSourceName(): string {
    return '新华每日电讯';
  }

  getRegion(): NewsRegion {
    return NewsRegion.DOMESTIC;
  }

  async getTargetUrls(date: string): Promise<string[]> {
    const dateStr = date.replace(/-/g, ''); // 转换为 YYYYMMDD 格式
    const indexUrl = `${this.baseUrl}/content/${dateStr}/Page01DK.htm`;
    
    this.logger.log(JSON.stringify({
      category: 'HTTP_REQUEST',
      message: `Fetching news index from URL: ${indexUrl}`,
      url: indexUrl
    }));

    try {
      const indexDoc = await this.getDocument(indexUrl);
      const $ = cheerio.load(indexDoc);
      
      const newsLinks = $('div.listdaohang ul li a');
      const urls: string[] = [];
      
      for (const link of newsLinks) {
        const daoxiang = $(link).attr('daoxiang');
        if (daoxiang) {
          urls.push(`${this.baseUrl}/content/${dateStr}/${daoxiang}`);
        }
      }
      
      return urls;
    } catch (error) {
      this.logger.error(JSON.stringify({
        category: 'HTTP_ERROR',
        message: `Error fetching news list from URL: ${indexUrl}`,
        url: indexUrl
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
    const titleElement = $('#contenttext > table > tbody > tr:nth-child(2) > td > div > strong > font');
    return titleElement.length > 0 ? titleElement.text().trim() : null;
  }

  protected extractContent(document: string): string | null {
    const $ = cheerio.load(document);
    const contentElement = $('#contenttext > div:nth-child(7)');
    return contentElement.length > 0 ? contentElement.text().trim() : null;
  }
}