import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum NewsRegion {
  DOMESTIC = 'domestic',    // 国内新闻
  INTERNATIONAL = 'international'  // 国外新闻
}

@Entity('raw_news')
@Index('idx_raw_news_news_date', ['newsDate'])
@Index('idx_raw_news_analyzed', ['analyzed'])
@Index('idx_raw_news_news_date_analyzed', ['newsDate', 'analyzed'])
@Index('idx_raw_news_region', ['region'])
export class RawNews extends BaseEntity {
  @Column({ nullable: false })
  title: string;

  @Column({ type: 'text', nullable: false })
  content: string;

  @Column({ nullable: false, unique: true })
  url: string;

  @Column({ name: 'source_code', length: 50, nullable: false })
  sourceCode: string;

  @Column({ name: 'source_name', length: 50 })
  sourceName: string;

  @Column({ name: 'news_date', type: 'date', nullable: false })
  newsDate: string;

  @Column({ default: false })
  analyzed: boolean;

  @Column({
    type: 'enum',
    enum: NewsRegion,
    default: NewsRegion.DOMESTIC,
    comment: '新闻地区：国内/国外'
  })
  region: NewsRegion;
}