#!/usr/bin/env node

/**
 * 验证智能体模型配置脚本
 * 用于检查各智能体是否正确配置了对应的模型
 */

const { spawn } = require('child_process');

function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { 
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
      }
    });
  });
}

async function checkConfiguration() {
  console.log('🔧 验证智能体模型配置...\n');

  // 读取 .env 文件
  require('dotenv').config();

  const configs = [
    {
      name: '全局默认模型',
      key: 'LLM_DEFAULT_MODEL',
      recommended: 'qwen-plus',
      description: '所有智能体的fallback模型'
    },
    {
      name: '数据获取智能体',
      key: 'DATA_COLLECTOR_MODEL',
      recommended: 'qwen-turbo',
      description: '轻量模型，用于数据解析'
    },
    {
      name: '综合分析师',
      key: 'COMPREHENSIVE_ANALYST_MODEL',
      recommended: 'qwen-max',
      description: '最强模型，用于复杂分析'
    },
    {
      name: '交易策略师',
      key: 'TRADING_STRATEGIST_MODEL',
      recommended: 'qwen-plus',
      description: '平衡模型，用于策略制定'
    }
  ];

  let allCorrect = true;

  for (const config of configs) {
    const value = process.env[config.key];
    const fallback = config.key === 'LLM_DEFAULT_MODEL' ? 
      config.recommended : 
      process.env.LLM_DEFAULT_MODEL || config.recommended;

    const actualValue = value || fallback;
    const isRecommended = actualValue === config.recommended;
    
    const status = isRecommended ? '✅' : '⚠️';
    const message = isRecommended ? 
      `使用推荐模型` : 
      `使用非推荐模型 (推荐: ${config.recommended})`;

    console.log(`${status} ${config.name}`);
    console.log(`   配置变量: ${config.key}`);
    console.log(`   当前值: ${actualValue}`);
    console.log(`   状态: ${message}`);
    console.log(`   说明: ${config.description}\n`);

    if (!isRecommended && config.key !== 'LLM_DEFAULT_MODEL') {
      allCorrect = false;
    }
  }

  // 检查配置层次
  console.log('📊 配置层次检查:');
  
  const hierarchy = [
    'DATA_COLLECTOR_MODEL',
    'COMPREHENSIVE_ANALYST_MODEL', 
    'TRADING_STRATEGIST_MODEL'
  ];

  for (const key of hierarchy) {
    const specific = process.env[key];
    const fallback = process.env.LLM_DEFAULT_MODEL;
    const config = configs.find(c => c.key === key);
    const expectedValue = config ? config.recommended : 'unknown';
    
    if (specific) {
      console.log(`✅ ${key}: ${specific} (智能体专用配置)`);
    } else if (fallback) {
      console.log(`🔄 ${key}: ${fallback} (使用全局默认配置)`);
    } else {
      console.log(`⚙️  ${key}: ${expectedValue} (使用硬编码默认值)`);
    }
  }

  console.log('\n💰 成本估算:');
  
  const costs = {
    'qwen-turbo': 0.003,
    'qwen-plus': 0.012,
    'qwen-max': 0.120
  };

  const dataCollectorModel = process.env.DATA_COLLECTOR_MODEL || process.env.LLM_DEFAULT_MODEL || 'qwen-turbo';
  const comprehensiveModel = process.env.COMPREHENSIVE_ANALYST_MODEL || process.env.LLM_DEFAULT_MODEL || 'qwen-max';
  const strategistModel = process.env.TRADING_STRATEGIST_MODEL || process.env.LLM_DEFAULT_MODEL || 'qwen-plus';

  const totalCostPer1K = (costs[dataCollectorModel] || 0.012) + 
                        (costs[comprehensiveModel] || 0.120) + 
                        (costs[strategistModel] || 0.012);

  console.log(`数据获取智能体 (${dataCollectorModel}): ¥${costs[dataCollectorModel] || 0.012}/1K tokens`);
  console.log(`综合分析师 (${comprehensiveModel}): ¥${costs[comprehensiveModel] || 0.120}/1K tokens`);
  console.log(`交易策略师 (${strategistModel}): ¥${costs[strategistModel] || 0.012}/1K tokens`);
  console.log(`单次分析预估成本: ¥${totalCostPer1K.toFixed(3)}/1K tokens`);

  console.log('\n📈 配置建议:');
  
  if (allCorrect) {
    console.log('✅ 当前配置已优化，符合成本控制和性能平衡原则');
  } else {
    console.log('⚠️  建议调整配置以获得更好的成本效益平衡');
    console.log('   1. 数据获取智能体使用 qwen-turbo (成本优先)');
    console.log('   2. 综合分析师使用 qwen-max (效果优先)');  
    console.log('   3. 交易策略师使用 qwen-plus (平衡选择)');
  }

  console.log('\n🔗 相关文档:');
  console.log('   配置指南: docs/AGENT_MODEL_CONFIGURATION.md');
  console.log('   示例配置: .env.example');

  return allCorrect;
}

if (require.main === module) {
  checkConfiguration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 配置验证失败:', error.message);
      process.exit(1);
    });
}

module.exports = { checkConfiguration };