import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsNumber, Min, Max } from "class-validator";
import { Transform } from "class-transformer";

export class GetWatchlistDto {
  @ApiProperty({
    description: "页码（从1开始）",
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber({}, { message: "页码必须是数字" })
  @Min(1, { message: "页码不能小于1" })
  page?: number = 1;

  @ApiProperty({
    description: "每页数量",
    example: 20,
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber({}, { message: "每页数量必须是数字" })
  @Min(1, { message: "每页数量不能小于1" })
  @Max(100, { message: "每页数量不能超过100" })
  limit?: number = 20;
}
