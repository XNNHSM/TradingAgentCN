/**
 * 增强版股票分析工作流测试
 * 测试新的三阶段工作流：数据收集 -> 专业分析 -> 决策整合
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Connection, WorkflowHandle, Client } from '@temporalio/client';
import { enhancedStockAnalysisWorkflow } from '../orchestrators/enhanced-stock-analysis.workflow';
import type { EnhancedStockAnalysisInput, EnhancedStockAnalysisResult } from '../orchestrators/enhanced-stock-analysis.workflow';

describe('增强版股票分析工作流测试', () => {
  let module: TestingModule;
  let configService: ConfigService;
  let client: Client;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                TEMPORAL_HOST: 'localhost:7233',
                TEMPORAL_NAMESPACE: 'default',
                LLM_DEFAULT_MODEL: 'qwen-turbo',
                LLM_DEFAULT_TIMEOUT: 30,
                DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || 'mock-api-key',
                NODE_ENV: 'test',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
    
    // 创建Temporal客户端
    const connection = await Connection.connect({
      address: configService.get('TEMPORAL_HOST', 'localhost:7233'),
    });
    
    client = new Client({
      connection,
      namespace: configService.get('TEMPORAL_NAMESPACE', 'default'),
    });
  });

  afterAll(async () => {
    await module.close();
  });

  describe('增强版股票分析工作流', () => {
    it('应该成功执行完整的三阶段分析流程', async () => {
      const input: EnhancedStockAnalysisInput = {
        stockCode: '000001',
        stockName: '平安银行',
        sessionId: `test_session_${Date.now()}`,
        metadata: {
          testMode: true,
          analysisType: 'enhanced_comprehensive',
          requestedBy: 'test_user',
        },
      };

      // 生成唯一的工作流ID
      const workflowId = `enhanced-stock-analysis-${input.stockCode}-${Date.now()}`;

      try {
        // 启动工作流
        const handle = await client.workflow.start(
          enhancedStockAnalysisWorkflow,
          {
            args: [input],
            taskQueue: 'stock-analysis',
            workflowId,
            workflowRunTimeout: '10m',
          }
        );

        console.log(`增强版工作流已启动: ${workflowId}`);

        // 等待工作流完成
        const result = await handle.result() as EnhancedStockAnalysisResult;

        // 验证结果结构
        expect(result).toBeDefined();
        expect(result.sessionId).toBe(input.sessionId);
        expect(result.stockCode).toBe(input.stockCode);
        expect(result.stockName).toBe(input.stockName);

        // 验证三个分析阶段结果
        expect(result.stage1DataCollection).toBeDefined();
        expect(result.stage1DataCollection.stageName).toBe('数据收集阶段');
        expect(result.stage1DataCollection.results).toHaveLength(4); // BasicData, Technical, Fundamental, News

        expect(result.stage2ProfessionalAnalysis).toBeDefined();
        expect(result.stage2ProfessionalAnalysis.stageName).toBe('专业分析阶段');
        expect(result.stage2ProfessionalAnalysis.results).toHaveLength(4); // Industry, Competitive, Valuation, Risk

        expect(result.stage3DecisionIntegration).toBeDefined();
        expect(result.stage3DecisionIntegration.stageName).toBe('决策整合阶段');
        expect(result.stage3DecisionIntegration.results).toHaveLength(1); // UnifiedOrchestrator

        // 验证MCP数据汇总
        expect(result.mcpDataSummary).toBeDefined();
        expect(result.mcpDataSummary.basicInfo).toBeDefined();
        expect(result.mcpDataSummary.realtimeData).toBeDefined();

        // 验证最终决策
        expect(result.finalDecision).toBeDefined();
        expect(result.finalDecision.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.finalDecision.overallScore).toBeLessThanOrEqual(100);
        expect(['BUY', 'HOLD', 'SELL', 'STRONG_BUY', 'STRONG_SELL']).toContain(result.finalDecision.recommendation);

        console.log('\n=== 增强版股票分析结果 ===');
        console.log(`股票代码: ${result.stockCode}`);
        console.log(`总处理时间: ${result.totalProcessingTime}ms`);
        console.log(`最终评分: ${result.finalDecision.overallScore}`);
        console.log(`投资建议: ${result.finalDecision.recommendation}`);
        console.log(`置信度: ${(result.finalDecision.confidence * 100).toFixed(1)}%`);

        console.log('\n=== 各阶段处理时间 ===');
        console.log(`数据收集阶段: ${result.stage1DataCollection.processingTime}ms`);
        console.log(`专业分析阶段: ${result.stage2ProfessionalAnalysis.processingTime}ms`);
        console.log(`决策整合阶段: ${result.stage3DecisionIntegration.processingTime}ms`);

        console.log('\n=== 智能体分析结果数量 ===');
        console.log(`第一阶段智能体数量: ${result.stage1DataCollection.results.length}`);
        console.log(`第二阶段智能体数量: ${result.stage2ProfessionalAnalysis.results.length}`);
        console.log(`第三阶段智能体数量: ${result.stage3DecisionIntegration.results.length}`);

      } catch (error) {
        console.error('增强版工作流执行失败:', error);
        
        // 如果工作流失败，尝试获取详细错误信息
        if (error.cause) {
          console.error('详细错误信息:', error.cause);
        }
        
        throw error;
      }
    }, 600000); // 10分钟超时

    it('应该正确处理缺少股票名称的情况', async () => {
      const input: EnhancedStockAnalysisInput = {
        stockCode: '600036',
        sessionId: `test_session_no_name_${Date.now()}`,
        metadata: {
          testMode: true,
        },
      };

      const workflowId = `enhanced-stock-analysis-no-name-${input.stockCode}-${Date.now()}`;

      const handle = await client.workflow.start(
        enhancedStockAnalysisWorkflow,
        {
          args: [input],
          taskQueue: 'stock-analysis',
          workflowId,
          workflowRunTimeout: '10m',
        }
      );

      const result = await handle.result() as EnhancedStockAnalysisResult;
      
      expect(result).toBeDefined();
      expect(result.stockCode).toBe(input.stockCode);
      // 股票名称应该从basicInfo中获取
      expect(result.stockName).toBeDefined();
    }, 600000);

    it('应该正确验证工作流的阶段性架构', async () => {
      const input: EnhancedStockAnalysisInput = {
        stockCode: '000002',
        stockName: '万科A',
        sessionId: `test_architecture_${Date.now()}`,
        metadata: {
          testMode: true,
        },
      };

      const workflowId = `enhanced-architecture-test-${Date.now()}`;

      const handle = await client.workflow.start(
        enhancedStockAnalysisWorkflow,
        {
          args: [input],
          taskQueue: 'stock-analysis',
          workflowId,
          workflowRunTimeout: '10m',
        }
      );

      const result = await handle.result() as EnhancedStockAnalysisResult;

      // 验证按需调用架构
      // 第一阶段：MCP数据获取 + 基础智能体分析
      const stage1Agents = result.stage1DataCollection.results.map(r => r.agentName);
      expect(stage1Agents).toContain('基础数据智能体');
      expect(stage1Agents).toContain('技术分析师');
      expect(stage1Agents).toContain('基本面分析师');
      expect(stage1Agents).toContain('新闻分析师');

      // 第二阶段：专业化分析（基于第一阶段数据，无MCP调用）
      const stage2Agents = result.stage2ProfessionalAnalysis.results.map(r => r.agentName);
      expect(stage2Agents.length).toBeGreaterThan(0);

      // 第三阶段：决策整合（无MCP调用，纯整合分析）
      const stage3Agents = result.stage3DecisionIntegration.results.map(r => r.agentName);
      expect(stage3Agents).toContain('MCP智能投顾系统');

      // 验证数据流转：第一阶段的MCP数据应该被传递到后续阶段
      expect(result.mcpDataSummary).toBeDefined();
      expect(Object.keys(result.mcpDataSummary).length).toBeGreaterThan(0);

      console.log('\n=== 架构验证结果 ===');
      console.log('第一阶段智能体:', stage1Agents);
      console.log('第二阶段智能体:', stage2Agents);
      console.log('第三阶段智能体:', stage3Agents);
      console.log('MCP数据类型:', Object.keys(result.mcpDataSummary));
    }, 600000);
  });
});