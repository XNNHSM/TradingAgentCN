import { Entity, Column, Index, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RawNews } from './raw-news.entity';

@Entity('news_summary')
@Index('idx_news_summary_news_id', ['newsId'])
@Index('idx_news_summary_news_date', ['newsDate'])
@Index('idx_news_summary_news_date_desc', ['newsDate'], { unique: false })
export class NewsSummary extends BaseEntity {
  @Column({ name: 'news_id', nullable: false, unique: true, comment: '新闻ID，与原新闻一对一关系' })
  newsId: number;

  @Column({ nullable: false, comment: '新闻标题' })
  title: string;

  @Column({ type: 'text', nullable: false, comment: '新闻摘要' })
  summary: string;

  @Column({ name: 'news_date', type: 'date', nullable: false, comment: '新闻内容描述的日期' })
  newsDate: string;

  @OneToOne(() => RawNews)
  @JoinColumn({ name: 'news_id' })
  news: RawNews;
}