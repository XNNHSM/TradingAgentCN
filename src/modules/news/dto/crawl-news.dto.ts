import { IsOptional, IsString, IsArray, IsEnum } from 'class-validator';
import { NewsSource } from '../interfaces/news-crawler-factory.interface';

export class CrawlNewsDto {
  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsOptional()
  @IsArray()
  @IsEnum(NewsSource, { each: true })
  sources?: NewsSource[];
}