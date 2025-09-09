import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MessageService } from './message.service';
import { MessageActivityImpl } from './activities/message.activity';
import { MessageActivitiesRegistration } from './activities/message-activities.registration';
import { MessageSendRecord } from './entities/message-send-record.entity';
import { DingTalkProvider } from './adapters/webhook/dingtalk.provider';
import { WeChatProvider } from './adapters/webhook/wechat.provider';

/**
 * 消息模块 - 提供统一的消息发送能力
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MessageSendRecord]),
    HttpModule,
    ConfigModule,
  ],
  providers: [
    MessageService,
    MessageActivityImpl,
    MessageActivitiesRegistration,
    DingTalkProvider,
    WeChatProvider,
  ],
  exports: [MessageService, MessageActivityImpl],
})
export class MessageModule {}