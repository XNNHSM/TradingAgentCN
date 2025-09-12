import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CacheModule } from "@nestjs/cache-manager";

import { DatabaseConfig } from "./config/database.config";
import { RedisConfig } from "./config/redis.config";

// 业务模块
import { HealthModule } from "./modules/health/health.module";
import { WatchlistModule } from "./modules/watchlist/watchlist.module";
import { AnalysisModule } from "./modules/analysis/analysis.module";
import { MessageModule } from "./modules/message/message.module";
import { TemporalModule } from "./temporal/temporal.module";

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
      cache: true,
    }),

    // 数据库模块
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useClass: DatabaseConfig,
    }),

    // Redis缓存模块
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useClass: RedisConfig,
      isGlobal: true,
    }),

    // Temporal模块（全局模块，需要在业务模块之前导入）
    TemporalModule,

    // 业务模块
    HealthModule,
    WatchlistModule,
    AnalysisModule,
    MessageModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
