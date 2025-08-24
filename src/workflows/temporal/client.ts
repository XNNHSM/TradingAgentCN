/**
 * Temporal客户端配置
 */

import { Connection, Client } from '@temporalio/client';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TemporalClientService {
  private readonly logger = new Logger(TemporalClientService.name);
  private client?: Client;
  private connection?: Connection;

  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取Temporal客户端实例
   */
  async getClient(): Promise<Client> {
    if (!this.client) {
      await this.initialize();
    }
    return this.client!;
  }

  /**
   * 初始化Temporal客户端
   */
  private async initialize(): Promise<void> {
    try {
      // 创建连接
      this.connection = await Connection.connect({
        address: `${this.configService.get('TEMPORAL_HOST', 'localhost')}:${this.configService.get('TEMPORAL_PORT', '7233')}`,
      });

      // 创建客户端
      // 根据新规范使用动态 namespace: agents-{environment}
      const environment = this.configService.get('NODE_ENV', 'dev');
      const namespace = `agents-${environment}`;
      
      this.client = new Client({
        connection: this.connection,
        namespace,
      });
      
      this.logger.log(`Temporal客户端连接到 namespace: ${namespace}`);

      this.logger.log('Temporal客户端初始化成功');
    } catch (error) {
      this.logger.error('Temporal客户端初始化失败', error.stack);
      throw error;
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.close();
        this.logger.log('Temporal连接已关闭');
      }
    } catch (error) {
      this.logger.error('关闭Temporal连接失败', error.stack);
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return !!this.client && !!this.connection;
  }
}