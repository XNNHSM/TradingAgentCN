import { IsString, IsOptional, IsEnum, IsObject, IsDateString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 创建分析请求DTO
 */
export class CreateAnalysisDto {
  @ApiProperty({ 
    description: '股票代码', 
    example: '600036',
    pattern: '^[0-9]{6}$'
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/, { message: '股票代码必须是6位数字' })
  stockCode: string;

  @ApiProperty({ 
    description: '股票名称', 
    example: '招商银行',
    required: false 
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  stockName?: string;

  @ApiProperty({ 
    description: '分析类型', 
    enum: ['full', 'quick'],
    example: 'full'
  })
  @IsEnum(['full', 'quick'])
  analysisType: 'full' | 'quick';

  @ApiProperty({ 
    description: '分析开始日期', 
    example: '2024-01-01',
    required: false 
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ 
    description: '分析结束日期', 
    example: '2024-01-31',
    required: false 
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ 
    description: '扩展参数', 
    example: { includeNews: true, includeTechnical: true },
    required: false 
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * 获取分析记录请求DTO
 */
export class GetAnalysisRecordsDto {
  @ApiProperty({ 
    description: '股票代码', 
    example: '600036',
    required: false 
  })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/, { message: '股票代码必须是6位数字' })
  stockCode?: string;

  @ApiProperty({ 
    description: '分析类型', 
    enum: ['full', 'quick'],
    required: false 
  })
  @IsOptional()
  @IsEnum(['full', 'quick'])
  analysisType?: 'full' | 'quick';

  @ApiProperty({ 
    description: '页码', 
    example: 1,
    default: 1 
  })
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ 
    description: '每页大小', 
    example: 20,
    default: 20 
  })
  @IsOptional()
  limit?: number = 20;

  @ApiProperty({ 
    description: '开始日期', 
    example: '2024-01-01',
    required: false 
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ 
    description: '结束日期', 
    example: '2024-01-31',
    required: false 
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * 获取分析详情请求DTO
 */
export class GetAnalysisDetailDto {
  @ApiProperty({ 
    description: '分析记录ID', 
    example: 1 
  })
  @IsString()
  id: string;
}