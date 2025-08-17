import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";
import { join } from "path";

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: "mysql",
      host: this.configService.get<string>("DB_HOST", "localhost"),
      port: this.configService.get<number>("DB_PORT", 3306),
      username: this.configService.get<string>("DB_USERNAME", "root"),
      password: this.configService.get<string>("DB_PASSWORD", ""),
      database: this.configService.get<string>(
        "DB_DATABASE",
        "trading_agent_cn",
      ),
      entities: [join(__dirname, "..", "**", "*.entity.{ts,js}")],
      synchronize: this.configService.get<string>("NODE_ENV") === "development",
      logging: this.configService.get<string>("NODE_ENV") === "development",
      timezone: "+08:00",
      charset: "utf8mb4",
      extra: {
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000,
      },
    };
  }
}
