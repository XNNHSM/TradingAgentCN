import { Entity, Column, Index } from "typeorm";
import { BaseEntity } from "@/common/entities/base.entity";

@Entity("watchlists")
@Index(["stockCode"], { unique: true })
export class Watchlist extends BaseEntity {
  @Column({
    type: "varchar",
    length: 10,
    comment: "股票代码",
  })
  stockCode: string;

  @Column({
    type: "varchar",
    length: 50,
    comment: "股票名称",
  })
  stockName: string;


  @Column({
    type: "varchar",
    length: 10,
    nullable: true,
    comment: "交易所代码 (SSE/SZSE)",
  })
  exchange?: string;

  @Column({
    type: "varchar",
    length: 50,
    nullable: true,
    comment: "所属行业",
  })
  industry?: string;

  @Column({
    type: "text",
    nullable: true,
    comment: "备注信息",
  })
  notes?: string;
}
