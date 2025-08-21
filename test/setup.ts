/**
 * Jest测试环境设置
 */

// 引入dotenv以加载环境变量
import * as dotenv from 'dotenv';

// 设置测试超时时间
jest.setTimeout(30000);

// 加载测试环境变量
// 1. 首先尝试加载 .env.test 文件
// 2. 如果不存在，则加载 .env 文件
// 3. 最后使用系统环境变量
dotenv.config({ path: '.env.test' });
dotenv.config({ path: '.env' });

// 设置测试环境标识
process.env.NODE_ENV = 'test';

// 验证关键环境变量是否存在（不输出敏感信息）
const hasValidApiKey = process.env.DASHSCOPE_API_KEY && 
                      process.env.DASHSCOPE_API_KEY !== 'your_dashscope_api_key_here' &&
                      process.env.DASHSCOPE_API_KEY.length > 10; // 基本长度验证

if (hasValidApiKey) {
  console.log('✓ 检测到有效的API密钥，将运行完整的API测试');
} else {
  console.log('⚠ 未检测到有效的API密钥，将跳过真实API测试');
  console.log('💡 提示：请配置相关环境变量以运行完整测试');
  console.log('💡 查看 TEST_SETUP.md 了解详细配置说明');
}

// 全局测试配置
global.console = {
  ...console,
  // 在测试时减少日志输出
  log: process.env.DEBUG_TESTS === 'true' ? console.log : jest.fn(),
  debug: process.env.DEBUG_TESTS === 'true' ? console.debug : jest.fn(),
  info: process.env.DEBUG_TESTS === 'true' ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
};