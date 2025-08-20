import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateAgentExecutionRecords1692601200000 implements MigrationInterface {
    name = 'CreateAgentExecutionRecords1692601200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 创建主表（作为分表模板）
        await queryRunner.createTable(
            new Table({
                name: "agent_execution_records",
                columns: [
                    {
                        name: "id",
                        type: "varchar",
                        length: "36",
                        isPrimary: true,
                    },
                    {
                        name: "sessionId",
                        type: "varchar",
                        length: "50",
                    },
                    {
                        name: "agentType",
                        type: "enum",
                        enum: [
                            'market_analyst',
                            'fundamental_analyst', 
                            'news_analyst',
                            'bull_researcher',
                            'bear_researcher',
                            'research_manager',
                            'trader',
                            'conservative_trader',
                            'aggressive_trader',
                            'risk_manager',
                            'reflection_agent'
                        ],
                    },
                    {
                        name: "agentName",
                        type: "varchar",
                        length: "100",
                    },
                    {
                        name: "agentRole",
                        type: "varchar", 
                        length: "200",
                    },
                    {
                        name: "stockCode",
                        type: "varchar",
                        length: "20",
                    },
                    {
                        name: "stockName",
                        type: "varchar",
                        length: "100",
                        isNullable: true,
                    },
                    {
                        name: "executionDate",
                        type: "datetime",
                    },
                    {
                        name: "startTime",
                        type: "datetime",
                    },
                    {
                        name: "endTime",
                        type: "datetime",
                    },
                    {
                        name: "processingTimeMs",
                        type: "int",
                        unsigned: true,
                    },
                    {
                        name: "executionStatus",
                        type: "enum",
                        enum: ['success', 'error', 'timeout'],
                        default: "'success'",
                    },
                    {
                        name: "llmModel",
                        type: "varchar",
                        length: "50",
                    },
                    {
                        name: "inputPrompt",
                        type: "text",
                    },
                    {
                        name: "inputTokens",
                        type: "int",
                        unsigned: true,
                        isNullable: true,
                    },
                    {
                        name: "outputTokens", 
                        type: "int",
                        unsigned: true,
                        isNullable: true,
                    },
                    {
                        name: "totalTokens",
                        type: "int", 
                        unsigned: true,
                        isNullable: true,
                    },
                    {
                        name: "estimatedCost",
                        type: "decimal",
                        precision: 10,
                        scale: 6,
                        isNullable: true,
                    },
                    {
                        name: "analysisResult",
                        type: "longtext",
                    },
                    {
                        name: "structuredResult",
                        type: "json",
                        isNullable: true,
                    },
                    {
                        name: "score",
                        type: "tinyint",
                        unsigned: true,
                        isNullable: true,
                    },
                    {
                        name: "recommendation",
                        type: "enum",
                        enum: ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'],
                        isNullable: true,
                    },
                    {
                        name: "confidence",
                        type: "decimal",
                        precision: 3,
                        scale: 2,
                        isNullable: true,
                    },
                    {
                        name: "keyInsights",
                        type: "json",
                        isNullable: true,
                    },
                    {
                        name: "risks",
                        type: "json",
                        isNullable: true,
                    },
                    {
                        name: "supportingData",
                        type: "json",
                        isNullable: true,
                    },
                    {
                        name: "toolCalls",
                        type: "json",
                        isNullable: true,
                    },
                    {
                        name: "toolResults",
                        type: "json", 
                        isNullable: true,
                    },
                    {
                        name: "contextData",
                        type: "json",
                        isNullable: true,
                    },
                    {
                        name: "previousResults",
                        type: "json",
                        isNullable: true,
                    },
                    {
                        name: "metadata",
                        type: "json",
                        isNullable: true,
                    },
                    {
                        name: "errorMessage",
                        type: "text",
                        isNullable: true,
                    },
                    {
                        name: "errorStack",
                        type: "text",
                        isNullable: true,
                    },
                    {
                        name: "createdAt",
                        type: "datetime",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "updatedAt",
                        type: "datetime",
                        default: "CURRENT_TIMESTAMP",
                        onUpdate: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "deletedAt",
                        type: "datetime",
                        isNullable: true,
                    },
                    {
                        name: "version",
                        type: "int",
                        default: 1,
                    },
                    {
                        name: "analysisType",
                        type: "varchar",
                        length: "50",
                        isNullable: true,
                    },
                    {
                        name: "userAgent",
                        type: "varchar",
                        length: "20", 
                        isNullable: true,
                    },
                    {
                        name: "environment",
                        type: "varchar",
                        length: "50",
                        isNullable: true,
                    },
                ],
            }),
            true
        );

        // 索引由 Entity 装饰器自动创建
        // @Index([‘stockCode’, ‘executionDate’])
        // @Index([‘agentType’, ‘executionDate’])  
        // @Index([‘sessionId’])
        // @Index([‘executionDate’])
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("agent_execution_records");
    }
}