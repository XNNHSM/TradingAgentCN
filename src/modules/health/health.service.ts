import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  async getHealthInfo() {
    const dbStatus = await this.checkDatabase();

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || "1.0.0",
      services: {
        database: dbStatus,
      },
      memory: {
        used:
          Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) /
          100,
        total:
          Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) /
          100,
      },
    };
  }

  async checkDatabase() {
    try {
      // 执行简单查询检查数据库连接
      await this.dataSource.query("SELECT 1");
      return {
        status: "healthy",
        responseTime: Date.now(),
        connection: "active",
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        connection: "failed",
      };
    }
  }
}
