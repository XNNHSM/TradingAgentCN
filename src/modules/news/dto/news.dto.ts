import { IsOptional, IsString, IsBoolean, IsEnum, IsDateString, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { NewsRegion } from '../entities/raw-news.entity';

export class CreateNewsDto {
  @IsString()
  @Length(1, 500)
  title: string;

  @IsString()
  @Length(1, 10000)
  content: string;

  @IsString()
  url: string;

  @IsString()
  @Length(1, 50)
  sourceCode: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  sourceName?: string;

  @IsDateString()
  newsDate: string;

  @IsOptional()
  @IsBoolean()
  analyzed?: boolean;

  @IsOptional()
  @IsEnum(NewsRegion)
  region?: NewsRegion;
}

export class UpdateNewsDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 10000)
  content?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  sourceCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  sourceName?: string;

  @IsOptional()
  @IsDateString()
  newsDate?: string;

  @IsOptional()
  @IsBoolean()
  analyzed?: boolean;

  @IsOptional()
  @IsEnum(NewsRegion)
  region?: NewsRegion;
}

export class QueryNewsDto {
  @IsOptional()
  @IsString()
  sourceCode?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  analyzed?: boolean;

  @IsOptional()
  @IsEnum(NewsRegion)
  region?: NewsRegion;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}