import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { Cache } from 'cache-manager';

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getHealthInfo() {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      },
    };
  }

  async checkDatabase() {
    try {
      // 执行简单查询检查数据库连接
      await this.dataSource.query('SELECT 1');
      return {
        status: 'healthy',
        responseTime: Date.now(),
        connection: 'active',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connection: 'failed',
      };
    }
  }

  async checkRedis() {
    try {
      // 检查Redis连接
      const testKey = 'health_check_test';
      const testValue = Date.now().toString();
      
      await this.cacheManager.set(testKey, testValue, 1000); // 1秒过期
      const retrievedValue = await this.cacheManager.get(testKey);
      
      if (retrievedValue === testValue) {
        await this.cacheManager.del(testKey);
        return {
          status: 'healthy',
          responseTime: Date.now(),
          connection: 'active',
        };
      } else {
        throw new Error('Redis value mismatch');
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connection: 'failed',
      };
    }
  }
}