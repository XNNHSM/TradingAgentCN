import {
  IsString,
  IsOptional,
  IsObject,
  IsDateString,
  Length,
  Matches,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * 创建股票分析请求DTO
 */
export class CreateAnalysisDto {
  @ApiProperty({
    description: "股票代码",
    example: "600036",
    pattern: "^[0-9]{6}$",
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/, { message: "股票代码必须是6位数字" })
  stockCode: string;

  @ApiProperty({
    description: "股票名称",
    example: "招商银行",
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  stockName?: string;

  @ApiProperty({
    description: "分析开始日期",
    example: "2024-01-01",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: "分析结束日期",
    example: "2024-01-31",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: "扩展参数",
    example: { includeNews: true, includeTechnical: true },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
