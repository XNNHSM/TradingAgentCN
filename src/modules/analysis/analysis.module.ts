import { Module } from "@nestjs/common";
import { forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AgentsModule } from "../../agents/agents.module";
import { TemporalModule } from "../../temporal/temporal.module";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";
import { AnalysisRecord } from "./entities/analysis-record.entity";

/**
 * 分析模块 - 基于MCP统一智能体的股票分析服务
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisRecord]), 
    TemporalModule,
    forwardRef(() => AgentsModule)
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
