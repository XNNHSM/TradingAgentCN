import { Entity, Column, Index } from "typeorm";
import { BaseEntity } from "../../../common/entities/base.entity";
import { TradingRecommendation } from "../../../agents/interfaces/agent.interface";

/**
 * 分析记录实体
 */
@Entity("analysis_records")
@Index(["stockCode", "createdAt"])
@Index(["analysisType", "createdAt"])
export class AnalysisRecord extends BaseEntity {
  @Column({
    type: "varchar",
    length: 200,
    nullable: true,
    comment: "工作流ID",
  })
  workflowId?: string;

  @Column({
    type: "varchar",
    length: 200,
    nullable: true,
    comment: "会话ID",
  })
  sessionId?: string;

  @Column({
    type: "varchar",
    length: 10,
    comment: "股票代码",
  })
  stockCode: string;

  @Column({
    type: "varchar",
    length: 100,
    nullable: true,
    comment: "股票名称",
  })
  stockName?: string;

  @Column({
    type: "varchar",
    length: 50,
    default: "full",
    comment: "分析类型",
  })
  analysisType: string;

  @Column({
    type: "json",
    comment: "分析上下文信息",
  })
  context: Record<string, any>;

  @Column({
    type: "json",
    comment: "完整分析结果",
  })
  results: Record<string, any>;

  @Column({
    type: "decimal",
    precision: 5,
    scale: 2,
    nullable: true,
    comment: "综合评分(0-100)",
  })
  averageScore?: number;

  @Column({
    type: "enum",
    enum: TradingRecommendation,
    nullable: true,
    comment: "最终交易建议",
  })
  finalRecommendation?: TradingRecommendation;

  @Column({
    type: "decimal",
    precision: 3,
    scale: 2,
    nullable: true,
    comment: "置信度(0-1)",
  })
  confidence?: number;

  @Column({
    type: "json",
    nullable: true,
    comment: "关键洞察",
  })
  keyInsights?: string[];

  @Column({
    type: "json",
    nullable: true,
    comment: "主要风险",
  })
  majorRisks?: string[];

  @Column({
    type: "timestamp",
    nullable: true,
    comment: "开始时间",
  })
  startTime?: Date;

  @Column({
    type: "int",
    comment: "执行时长(毫秒)",
  })
  executionTime: number;

  @Column({
    type: "enum",
    enum: ["success", "partial", "failed"],
    default: "success",
    comment: "执行状态",
  })
  status: "success" | "partial" | "failed";

  @Column({
    type: "text",
    nullable: true,
    comment: "错误信息",
  })
  errorMessage?: string;

  @Column({
    type: "json",
    nullable: true,
    comment: "扩展元数据",
  })
  metadata?: Record<string, any>;
}
