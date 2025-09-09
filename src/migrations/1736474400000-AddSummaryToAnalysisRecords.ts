import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSummaryToAnalysisRecords1736474400000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "analysis_records" 
            ADD COLUMN "summary" TEXT NULL;
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN "analysis_records"."summary" IS '分析摘要：高度概括分析结果，简要说明为什么是持有/买/卖';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "analysis_records" 
            DROP COLUMN "summary";
        `);
    }
}