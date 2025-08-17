import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NewsApiService } from './news-api.service';

@Module({
  imports: [ConfigModule],
  providers: [NewsApiService],
  exports: [NewsApiService],
})
export class NewsModule {}