import { Module } from "@nestjs/common";
import { forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { AgentsModule } from "../../agents/agents.module";
import { TemporalModule } from "../../temporal/temporal.module";
import { MessageModule } from "../message/message.module";
import { LangGraphIntegrationModule } from "../../agents/langgraph/integration/integration.module";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";
import { AnalysisRecord } from "./entities/analysis-record.entity";

/**
 * 分析模块 - 基于MCP统一智能体的股票分析服务
 * 集成 LangGraphJS 混合工作流架构，提供智能的工作流选择和执行
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisRecord]), 
    ConfigModule,
    TemporalModule,
    forwardRef(() => AgentsModule),
    forwardRef(() => MessageModule),
    LangGraphIntegrationModule.forRootAsync({
      enableHybridWorkflow: true,
      enableSmartRouting: true,
      enableAdaptiveLearning: true,
      enablePerformanceMonitoring: true,
      enableAutoFailover: true,
    }),
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
