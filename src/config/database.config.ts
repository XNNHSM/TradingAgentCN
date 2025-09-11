import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";
import { join } from "path";

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: "postgres",
      host: this.configService.get<string>("DB_HOST", "localhost"),
      port: this.configService.get<number>("DB_PORT", 5432),
      username: this.configService.get<string>("DB_USERNAME", "postgres"),
      password: this.configService.get<string>("DB_PASSWORD", "test_123!"),
      database: this.configService.get<string>(
        "DB_DATABASE",
        "trading_agent",
      ),
      entities: [join(__dirname, "..", "**", "*.entity.{ts,js}")],
      synchronize: this.configService.get<string>("NODE_ENV") === "development",
      logging: false,
      extra: {
        max: 10,
        connectionTimeoutMillis: 60000,
        idleTimeoutMillis: 60000,
      },
    };
  }
}
