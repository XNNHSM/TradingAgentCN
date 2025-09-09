/**
 * 摘要生成功能测试脚本
 * 用于验证 createPartialSuccessResult 方法和摘要生成服务的集成
 */

import { SummaryGenerationService } from './src/common/services/summary-generation.service';
import { LLMService } from './src/agents/services/llm.service';
import { ConfigService } from '@nestjs/config';
import { ContentType } from './src/common/interfaces/summary-generation.interface';

// 模拟依赖项
const mockLLMService = {
  generateText: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

// 创建测试实例
const summaryService = new SummaryGenerationService(
  mockConfigService as any,
  mockLLMService as any
);

// 测试用例
async function runTests() {
  console.log('🧪 开始测试摘要生成功能...\n');

  // 测试1: 新闻内容摘要生成
  console.log('📰 测试1: 新闻内容摘要生成');
  const newsInput = {
    content: `【重磅消息】央行宣布降准0.5个百分点，释放流动性约1万亿元。此次降准旨在支持实体经济发展，降低企业融资成本。 
    专家表示，这将有助于稳定市场预期，促进经济平稳运行。降准后，大型银行存款准备金率为6.5%，中小银行存款准备金率为5%。`,
    title: '央行宣布降准0.5个百分点 释放流动性约1万亿元',
    contentType: ContentType.NEWS,
    source: '新华社',
    publishTime: '2024-01-01',
    maxTokens: 300,
    language: 'zh'
  };

  // Mock LLM响应
  mockLLMService.generateText.mockResolvedValue({
    success: true,
    content: JSON.stringify({
      summary: '央行宣布降准0.5个百分点，释放流动性约1万亿元，旨在支持实体经济发展，降低企业融资成本，有助于稳定市场预期。',
      keyPoints: [
        '央行降准0.5个百分点',
        '释放流动性约1万亿元',
        '支持实体经济发展',
        '降低企业融资成本'
      ],
      sentiment: 'positive',
      category: '经济新闻',
      tags: ['央行', '降准', '流动性', '经济']
    }),
    tokenUsage: {
      input: 150,
      output: 80,
      total: 230
    }
  });

  try {
    const result = await summaryService.generate(newsInput);
    console.log('✅ 新闻摘要生成成功:');
    console.log(`   摘要: ${result.summary}`);
    console.log(`   关键点: ${result.keyPoints?.join(', ')}`);
    console.log(`   情感倾向: ${result.sentiment}`);
    console.log(`   处理时间: ${result.processingTime}ms\n`);
  } catch (error) {
    console.log('❌ 新闻摘要生成失败:', error.message, '\n');
  }

  // 测试2: 政策内容摘要生成
  console.log('📋 测试2: 政策内容摘要生成');
  const policyInput = {
    content: `关于进一步优化营商环境促进市场主体发展的若干措施
    
    第一条：简化企业开办流程
    （一）推行"一网通办"服务模式，实现企业开办全流程网上办理。
    （二）压缩企业开办时间，将企业开办时间压缩至1个工作日内。
    
    第二条：减轻企业负担
    （一）降低企业用电成本，对中小企业实行阶段性优惠电价。
    （二）减免行政事业性收费，取消一批涉企收费项目。
    
    第三条：优化金融服务
    （一）加大对小微企业信贷支持力度，确保小微企业贷款增速高于各项贷款平均增速。
    （二）完善融资担保体系，降低企业融资担保费用。`,
    title: '关于进一步优化营商环境促进市场主体发展的若干措施',
    contentType: ContentType.POLICY,
    source: '国务院',
    publishTime: '2024-01-01',
    maxTokens: 400,
    language: 'zh'
  };

  mockLLMService.generateText.mockResolvedValue({
    success: true,
    content: JSON.stringify({
      summary: '该政策旨在优化营商环境，主要措施包括简化企业开办流程、减轻企业负担和优化金融服务，具体涵盖"一网通办"、压缩开办时间、降低用电成本、减免收费、加大信贷支持等方面。',
      keyPoints: [
        '简化企业开办流程，推行"一网通办"',
        '压缩企业开办时间至1个工作日',
        '降低企业用电成本，减免行政收费',
        '加大小微企业信贷支持力度',
        '完善融资担保体系'
      ],
      sentiment: 'positive',
      category: '经济政策',
      tags: ['营商环境', '企业发展', '政策支持']
    }),
    tokenUsage: {
      input: 200,
      output: 120,
      total: 320
    }
  });

  try {
    const result = await summaryService.generate(policyInput);
    console.log('✅ 政策摘要生成成功:');
    console.log(`   摘要: ${result.summary}`);
    console.log(`   关键点: ${result.keyPoints?.join(', ')}`);
    console.log(`   情感倾向: ${result.sentiment}`);
    console.log(`   处理时间: ${result.processingTime}ms\n`);
  } catch (error) {
    console.log('❌ 政策摘要生成失败:', error.message, '\n');
  }

  // 测试3: 热搜内容摘要生成
  console.log('🔥 测试3: 热搜内容摘要生成');
  const hotSearchInput = {
    content: `#某明星演唱会门票秒罄# 昨晚，某明星的巡回演唱会门票开售后仅30秒就全部售罄，引发网友热议。 
    很多粉丝表示没有抢到票非常失望，纷纷在社交媒体上表达自己的心情。也有网友质疑是否存在黄牛倒票现象。
    该明星工作室随后发文感谢粉丝支持，并表示会考虑增加场次满足粉丝需求。`,
    title: '某明星演唱会门票30秒售罄引热议',
    contentType: ContentType.HOT_SEARCH,
    source: '微博热搜',
    publishTime: '2024-01-01',
    maxTokens: 250,
    language: 'zh'
  };

  mockLLMService.generateText.mockResolvedValue({
    success: true,
    content: JSON.stringify({
      summary: '某明星演唱会门票开售后30秒内售罄，引发网友热议。粉丝表达失望情绪，质疑黄牛倒票现象，工作室表示考虑增加场次。',
      keyPoints: [
        '演唱会门票30秒售罄',
        '粉丝表达失望情绪',
        '质疑黄牛倒票现象',
        '工作室考虑增加场次'
      ],
      sentiment: 'neutral',
      category: '娱乐热点',
      tags: ['演唱会', '明星', '门票', '热搜']
    }),
    tokenUsage: {
      input: 120,
      output: 70,
      total: 190
    }
  });

  try {
    const result = await summaryService.generate(hotSearchInput);
    console.log('✅ 热搜摘要生成成功:');
    console.log(`   摘要: ${result.summary}`);
    console.log(`   关键点: ${result.keyPoints?.join(', ')}`);
    console.log(`   情感倾向: ${result.sentiment}`);
    console.log(`   处理时间: ${result.processingTime}ms\n`);
  } catch (error) {
    console.log('❌ 热搜摘要生成失败:', error.message, '\n');
  }

  // 测试4: 错误处理
  console.log('🚨 测试4: 错误处理');
  mockLLMService.generateText.mockResolvedValue({
    success: false,
    error: 'LLM服务暂时不可用'
  });

  try {
    const result = await summaryService.generate(newsInput);
    console.log('✅ 错误处理测试通过:');
    console.log(`   成功: ${result.success}`);
    console.log(`   错误信息: ${result.error}\n`);
  } catch (error) {
    console.log('❌ 错误处理测试失败:', error.message, '\n');
  }

  console.log('🎉 所有测试完成！');
}

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };