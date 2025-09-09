import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsObject, IsArray } from 'class-validator';

/**
 * 消息类型枚举
 */
export enum MessageType {
  TEXT = 'text',
  MARKDOWN = 'markdown',
  HTML = 'html'
}

/**
 * 消息发送请求DTO
 */
export class SendMessageDto {
  @ApiProperty({ description: '消息标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: '消息内容' })
  @IsString()
  content: string;

  @ApiProperty({ enum: MessageType, description: '消息类型', default: MessageType.TEXT })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType = MessageType.TEXT;

  @ApiProperty({ description: '目标标识（如webhook URL、手机号等）' })
  @IsOptional()
  @IsString()
  target?: string;

  @ApiProperty({ description: '提供者类型（如dingtalk、wechat等）' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({ description: '附加数据' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * 批量发送消息请求DTO
 */
export class SendBatchMessageDto {
  @ApiProperty({ description: '消息标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: '消息内容' })
  @IsString()
  content: string;

  @ApiProperty({ enum: MessageType, description: '消息类型', default: MessageType.TEXT })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType = MessageType.TEXT;

  @ApiProperty({ description: '目标标识列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  targets: string[];

  @ApiProperty({ description: '提供者类型' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({ description: '附加数据' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * Webhook配置DTO
 */
export class WebhookConfigDto {
  @ApiProperty({ description: 'Webhook URL' })
  @IsString()
  webhookUrl: string;

  @ApiProperty({ description: '密钥（可选）' })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiProperty({ description: '超时时间（毫秒）', default: 5000 })
  @IsOptional()
  timeout?: number = 5000;

  @ApiProperty({ description: '重试次数', default: 3 })
  @IsOptional()
  retryTimes?: number = 3;
}

/**
 * 钉钉机器人配置DTO
 */
export class DingTalkConfigDto extends WebhookConfigDto {
  @ApiProperty({ description: '是否启用', default: true })
  @IsOptional()
  enabled?: boolean = true;

  @ApiProperty({ description: '钉钉机器人的access_token' })
  @IsString()
  accessToken: string;

  @ApiProperty({ description: '密钥（可选）' })
  @IsOptional()
  @IsString()
  secret?: string;
}

/**
 * 企业微信机器人配置DTO
 */
export class WeChatConfigDto extends WebhookConfigDto {
  @ApiProperty({ description: '是否启用', default: true })
  @IsOptional()
  enabled?: boolean = true;

  @ApiProperty({ description: '企业微信机器人的webhook URL' })
  @IsString()
  webhookUrl: string;
}

/**
 * 消息提供者配置DTO
 */
export class ProviderConfigDto {
  @ApiProperty({ description: '提供者类型' })
  @IsString()
  type: string;

  @ApiProperty({ description: '是否启用' })
  @IsOptional()
  enabled?: boolean = true;

  @ApiProperty({ description: '配置参数' })
  @IsObject()
  config: Record<string, any>;
}