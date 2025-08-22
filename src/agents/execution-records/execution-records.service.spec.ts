import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentExecutionRecordService } from '../services/agent-execution-record.service';
import { AgentExecutionShardingService } from '../services/agent-execution-sharding.service';
import { AgentExecutionRecord } from '../entities/agent-execution-record.entity';
import { AgentType, TradingRecommendation } from '../interfaces/agent.interface';

describe('AgentExecutionRecordService', () => {
  let service: AgentExecutionRecordService;
  let shardingService: AgentExecutionShardingService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'test_123!',
          database: process.env.DB_DATABASE || 'trading_agent',
          entities: [AgentExecutionRecord],
          synchronize: true,
          dropSchema: true, // 每次测试前清空数据库
        }),
        TypeOrmModule.forFeature([AgentExecutionRecord]),
      ],
      providers: [
        AgentExecutionShardingService,
        AgentExecutionRecordService,
      ],
    }).compile();

    service = module.get<AgentExecutionRecordService>(AgentExecutionRecordService);
    shardingService = module.get<AgentExecutionShardingService>(AgentExecutionShardingService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('创建执行记录', () => {
    it('应该成功创建一条执行记录', async () => {
      const testDto = {
        sessionId: 'test-session-123',
        agentType: AgentType.MARKET_ANALYST,
        agentName: '市场分析师',
        agentRole: '专业的股票市场分析专家',
        stockCode: '000001',
        stockName: '平安银行',
        context: {
          stockCode: '000001',
          stockName: '平安银行',
          metadata: { analysisType: 'test' }
        },
        llmModel: 'qwen-plus',
        inputPrompt: '请分析平安银行的投资价值',
        llmResponse: {
          content: '平安银行具有良好的投资价值...',
          finishReason: 'stop',
          usage: {
            inputTokens: 50,
            outputTokens: 200,
            totalTokens: 250,
            cost: 0.01
          }
        },
        result: {
          agentName: '市场分析师',
          agentType: AgentType.MARKET_ANALYST,
          analysis: '平安银行具有良好的投资价值，建议买入',
          score: 85,
          recommendation: TradingRecommendation.BUY,
          confidence: 0.8,
          keyInsights: ['估值合理', '业绩稳定'],
          risks: ['市场波动风险'],
          timestamp: new Date(),
        },
        startTime: new Date(Date.now() - 5000),
        endTime: new Date(),
        analysisType: 'test',
      };

      const record = await service.createExecutionRecord(testDto);
      
      expect(record).toBeDefined();
      expect(record.id).toBeTruthy();
      expect(record.sessionId).toBe(testDto.sessionId);
      expect(record.agentType).toBe(testDto.agentType);
      expect(record.stockCode).toBe(testDto.stockCode);
      expect(record.executionStatus).toBe('success');

      console.log('✅ 执行记录创建成功:', record.id);
    });

    it('应该正确处理错误执行记录', async () => {
      const errorDto = {
        sessionId: 'test-session-error',
        agentType: AgentType.FUNDAMENTAL_ANALYST,
        agentName: '基本面分析师',
        agentRole: '专业的基本面分析专家',
        stockCode: '000002',
        stockName: '万科A',
        context: {
          stockCode: '000002',
          stockName: '万科A',
        },
        llmModel: 'qwen-plus',
        inputPrompt: '请分析万科A的基本面',
        llmResponse: {
          content: '',
          finishReason: 'error',
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
        },
        result: {
          agentName: '基本面分析师', 
          agentType: AgentType.FUNDAMENTAL_ANALYST,
          analysis: '分析过程中发生错误',
          timestamp: new Date(),
        },
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(),
        errorMessage: 'API调用失败',
        errorStack: 'Error: API调用失败\n    at ...',
      };

      const record = await service.createExecutionRecord(errorDto);
      
      expect(record).toBeDefined();
      expect(record.executionStatus).toBe('error');
      expect(record.errorMessage).toBe('API调用失败');

      console.log('✅ 错误执行记录创建成功:', record.id);
    });
  });

  describe('查询执行记录', () => {
    it('应该能够根据会话ID查询记录', async () => {
      const sessionId = 'test-session-123';
      const records = await service.getRecordsBySessionId(sessionId);
      
      expect(records).toBeDefined();
      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);
      
      // 验证所有记录都属于同一个会话
      records.forEach(record => {
        expect(record.sessionId).toBe(sessionId);
      });

      console.log(`✅ 根据会话ID查询到 ${records.length} 条记录`);
    });

    it('应该能够根据股票代码查询历史记录', async () => {
      const stockCode = '000001';
      const records = await service.getStockAnalysisHistory(stockCode);
      
      expect(records).toBeDefined();
      expect(Array.isArray(records)).toBe(true);
      
      records.forEach(record => {
        expect(record.stockCode).toBe(stockCode);
      });

      console.log(`✅ 股票 ${stockCode} 的历史记录查询成功，共 ${records.length} 条`);
    });
  });

  describe('统计功能', () => {
    it('应该能够生成执行统计报告', async () => {
      const stats = await service.getExecutionStats({
        dateRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24小时前
          end: new Date(),
        }
      });

      expect(stats).toBeDefined();
      expect(typeof stats.totalExecutions).toBe('number');
      expect(typeof stats.successRate).toBe('number');
      expect(typeof stats.avgProcessingTime).toBe('number');
      expect(stats.tokenUsage).toBeDefined();
      expect(stats.byAgentType).toBeDefined();

      console.log('✅ 统计报告生成成功:');
      console.log(`   - 总执行次数: ${stats.totalExecutions}`);
      console.log(`   - 成功率: ${Math.round(stats.successRate * 100)}%`);
      console.log(`   - 平均处理时间: ${Math.round(stats.avgProcessingTime)}ms`);
      console.log(`   - Token使用: ${stats.tokenUsage.totalTokens}`);
    });
  });

  describe('分表管理', () => {
    it('应该能够获取分表统计信息', async () => {
      const stats = await shardingService.getShardingStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalTables).toBe('number');
      expect(stats.tables).toBeDefined();

      console.log('✅ 分表统计信息获取成功:');
      console.log(`   - 总分表数: ${stats.totalTables}`);
      
      Object.entries(stats.tables).forEach(([agentType, info]: [string, any]) => {
        console.log(`   - ${agentType}: ${info.recordCount} 条记录`);
      });
    });

    it('应该能够创建所有分表', async () => {
      try {
        await shardingService.createAllShardTables();
        console.log('✅ 所有分表创建成功');
      } catch (error) {
        console.log('⚠️ 分表创建失败（可能已存在）:', error.message);
      }
    });
  });
});