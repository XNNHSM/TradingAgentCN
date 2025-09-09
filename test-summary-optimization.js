// 测试优化后的摘要生成逻辑
function generateAnalysisSummary(finalDecision, stockName) {
  const { overallScore, recommendation, confidence, keyDecisionFactors, riskAssessment } = finalDecision;
  
  // 投资建议中文映射
  const recommendationMap = {
    'BUY': '买入',
    'HOLD': '持有',
    'SELL': '卖出'
  };
  
  const confidencePercent = Math.round(confidence * 100);
  
  // 根据建议类型生成不同的摘要模板
  let summary = '';
  
  if (recommendation === 'BUY') {
    summary = `建议买入${stockName ? `（${stockName}）` : ''}。综合评分${overallScore}分，主要考虑因素：${keyDecisionFactors.slice(0, 2).join('、')}。预期收益前景较好，但需注意${riskAssessment.slice(0, 1).join('、')}等风险。`;
  } else if (recommendation === 'HOLD') {
    // 优化持有建议的摘要，更详细地解释观望原因
    const positiveFactors = keyDecisionFactors.slice(0, 2);
    const riskFactors = riskAssessment.slice(0, 2);
    
    let holdReason = '';
    if (overallScore >= 50 && overallScore < 70) {
      holdReason = `评分处于中性区间（${overallScore}分），既有支撑因素：${positiveFactors.join('、')}，也存在风险：${riskFactors.join('、')}，多空力量相对平衡。`;
    } else if (overallScore < 50) {
      holdReason = `虽然评分偏低（${overallScore}分），但${positiveFactors.join('、')}等因素提供一定支撑，建议暂时持有观察，避免盲目抛售。`;
    } else {
      holdReason = `虽有积极因素${positiveFactors.join('、')}，但${riskFactors.join('、')}等风险制约了上涨空间，建议谨慎持有等待更明确的信号。`;
    }
    
    summary = `建议持有${stockName ? `（${stockName}）` : ''}。${holdReason}建议观望等待更好的买入或卖出时机。`;
  } else if (recommendation === 'SELL') {
    summary = `建议卖出${stockName ? `（${stockName}）` : ''}。综合评分${overallScore}分，主要风险因素：${riskAssessment.slice(0, 2).join('、')}。建议规避风险，及时止损。`;
  }
  
  // 添加置信度说明
  if (confidencePercent >= 80) {
    summary += `分析置信度较高（${confidencePercent}%）。`;
  } else if (confidencePercent >= 60) {
    summary += `分析置信度中等（${confidencePercent}%），建议结合其他信息综合判断。`;
  } else {
    summary += `分析置信度较低（${confidencePercent}%），建议谨慎决策并关注更多信息。`;
  }
  
  return summary;
}

// 测试数据 - 模拟实际的分析结果
const testData = {
  stockCode: '601633',
  stockName: '长城汽车',
  finalDecision: {
    overallScore: 59,
    recommendation: 'HOLD',
    confidence: 0.6,
    keyDecisionFactors: [
      '新能源汽车销量增长',
      '海外市场拓展顺利',
      '技术实力持续提升',
      '成本控制能力较强',
      '品牌影响力逐步扩大'
    ],
    riskAssessment: [
      '行业竞争加剧',
      '原材料价格波动',
      '政策变化风险',
      '市场需求不确定性'
    ]
  }
};

// 生成新的摘要
const newSummary = generateAnalysisSummary(testData.finalDecision, testData.stockName);

console.log('=== 优化前的摘要 ===');
console.log('建议持有长城汽车。综合评分59分，处于中性区间。基于9个成功智能体的分析等因素支撑当前判断，建议观望等待更好时机。分析置信度中等（60%），建议结合其他信息综合判断。');

console.log('\n=== 优化后的摘要 ===');
console.log(newSummary);

console.log('\n=== 分析对比 ===');
console.log('优化前：简单提及"中性区间"和"观望"，没有具体解释原因');
console.log('优化后：详细解释了为什么建议观望，包括：');
console.log('1. 明确指出评分处于中性区间（59分）');
console.log('2. 列出了具体的支撑因素（新能源汽车销量增长、海外市场拓展顺利）');
console.log('3. 指出了存在的风险（行业竞争加剧、原材料价格波动）');
console.log('4. 说明多空力量相对平衡的现状');
console.log('5. 给出了明确的操作建议（等待更好的买卖时机）');