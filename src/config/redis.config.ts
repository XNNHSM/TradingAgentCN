import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';

@Injectable()
export class RedisConfig implements CacheOptionsFactory {
  constructor(private configService: ConfigService) {}

  createCacheOptions(): CacheModuleOptions {
    return {
      store: 'memory', // 临时使用内存存储，避免Redis依赖问题
      ttl: 300, // 默认缓存5分钟
      max: 1000, // 最大缓存数量
      isGlobal: true,
    };
  }
}