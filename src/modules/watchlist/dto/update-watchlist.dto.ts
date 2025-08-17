import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsBoolean,
  IsNumber,
  IsOptional,
  Length,
  Min,
} from "class-validator";

export class UpdateWatchlistDto {
  @ApiProperty({
    description: "股票代码（用于标识要更新的记录）",
    example: "600036",
  })
  @IsString({ message: "股票代码必须是字符串" })
  stockCode: string;

  @ApiProperty({
    description: "是否持仓",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: "是否持仓必须是布尔值" })
  isHolding?: boolean;

  @ApiProperty({
    description: "持仓数量",
    example: 200,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "持仓数量必须是数字" })
  @Min(0, { message: "持仓数量不能为负数" })
  holdingQuantity?: number;

  @ApiProperty({
    description: "持仓价格",
    example: 46.5,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "持仓价格必须是数字" })
  @Min(0, { message: "持仓价格不能为负数" })
  holdingPrice?: number;

  @ApiProperty({
    description: "股票名称",
    example: "招商银行",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "股票名称必须是字符串" })
  @Length(1, 50, { message: "股票名称长度必须在1-50字符之间" })
  stockName?: string;

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
