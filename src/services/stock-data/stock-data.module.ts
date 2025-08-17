import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { StockDataService } from "./stock-data.service";

/**
 * 股票数据模块 - 直接集成多数据源
 */
@Module({
  imports: [ConfigModule],
  providers: [StockDataService],
  exports: [StockDataService],
})
export class StockDataModule {}