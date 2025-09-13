import {
  IsString,
  IsOptional,
  IsObject,
  IsDateString,
  Length,
  Matches,
  IsEnum,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * 任务优先级枚举
 */
export enum AnalysisPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * 创建股票分析请求DTO
 * 支持混合工作流配置和高级分析选项
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
    description: "任务优先级",
    example: AnalysisPriority.MEDIUM,
    enum: AnalysisPriority,
    required: false,
  })
  @IsOptional()
  @IsEnum(AnalysisPriority)
  priority?: AnalysisPriority;

  @ApiProperty({
    description: "是否需要实时性分析",
    example: false,
    required: false,
  })
  @IsOptional()
  realtimeRequired?: boolean;

  @ApiProperty({
    description: "强制使用的执行模式",
    example: "hybrid",
    required: false,
  })
  @IsOptional()
  @IsString()
  executionMode?: string;

  @ApiProperty({
    description: "扩展参数",
    example: { 
      includeNews: true, 
      includeTechnical: true,
      analysisDepth: 'detailed',
      customParameters: {}
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
