import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  Matches,
  Length,
} from "class-validator";

export class CreateWatchlistDto {
  @ApiProperty({
    description: "股票代码",
    example: "600036",
    pattern: "^[0-9]{6}$",
  })
  @IsString({ message: "股票代码必须是字符串" })
  @Matches(/^[0-9]{6}$/, { message: "股票代码必须是6位数字" })
  stockCode: string;

  @ApiProperty({
    description: "股票名称",
    example: "招商银行",
  })
  @IsString({ message: "股票名称必须是字符串" })
  @Length(1, 50, { message: "股票名称长度必须在1-50字符之间" })
  stockName: string;


  @ApiProperty({
    description: "交易所代码",
    example: "SSE",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "交易所代码必须是字符串" })
  exchange?: string;

  @ApiProperty({
    description: "所属行业",
    example: "银行",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "所属行业必须是字符串" })
  @Length(0, 50, { message: "所属行业长度不能超过50字符" })
  industry?: string;

  @ApiProperty({
    description: "备注信息",
    example: "长期持有的优质银行股",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "备注信息必须是字符串" })
  notes?: string;
}
