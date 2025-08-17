import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class DeleteWatchlistDto {
  @ApiProperty({
    description: "股票代码",
    example: "600036",
    pattern: "^[0-9]{6}$",
  })
  @IsString({ message: "股票代码必须是字符串" })
  @Matches(/^[0-9]{6}$/, { message: "股票代码必须是6位数字" })
  stockCode: string;
}
