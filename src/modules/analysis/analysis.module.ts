import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AgentsModule } from "../../agents/agents.module";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";
import { AnalysisRecord } from "./entities/analysis-record.entity";

/**
 * 分析模块 - 提供智能体分析服务
 */
@Module({
  imports: [TypeOrmModule.forFeature([AnalysisRecord]), AgentsModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
