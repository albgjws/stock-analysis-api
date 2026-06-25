/**
 * 每日收盘自动回测 — 扫描所有预测记录，与实际走势对比
 * 自动记录偏差到校正系统，生成报表
 *
 * 用法（服务器 cron）：cd /root/stock-analysis-api && node daily_backtest.cjs
 * 推荐时间：每个交易日 15:05
 */
const fs = require('fs');
const path = require('path');
const { StockSDK } = require('stock-sdk');

const DATA_DIR = path.resolve(__dirname, 'data');
const PREDICTIONS_DIR = path.resolve(DATA_DIR, 'predictions');
const CORRECTIONS_DIR = path.resolve(DATA_DIR, 'corrections');
const REPORT_FILE = path.resolve(DATA_DIR, 'daily_report.json');

// ─── 校正系统（精简版） ───
function loadFactors() {
  const fp = path.join(CORRECTIONS_DIR, 'factors.json');
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')); } catch { return {}; }
}
function saveFactors(factors) {
  try {
    if (!fs.existsSync(CORRECTIONS_DIR)) fs.mkdirSync(CORRECTIONS_DIR, { recursive: true });
    fs.writeFileSync(path.join(CORRECTIONS_DIR, 'factors.json'), JSON.stringify(factors, null, 2));
  } catch {}
}
function recordError(err) {
  const factors = loadFactors();
  const key = err.marketCondition || 'neutral';
  let f = factors[key] || { driftMultiplier: 1.0, volatilityMultiplier: 1.0, confidenceBias: 0, sampleCount: 0 };
  f.sampleCount++;
  if (!err.direction) {
    f.driftMultiplier = Math.max(0.5, (f.driftMultiplier || 1.0) * 0.95);
  } else {
    f.driftMultiplier = Math.min(1.2, (f.driftMultiplier || 1.0) * 1.02);
  }
  if ((err.volatilityRatio || 1) > 1.5) {
    f.volatilityMultiplier = Math.min(2.0, (f.volatilityMultiplier || 1.0) * 1.1);
  } else if ((err.volatilityRatio || 1) < 0.5) {
    f.volatilityMultiplier = Math.max(0.5, (f.volatilityMultiplier || 1.0) * 0.95);
  }
  factors[key] = f;
  saveFactors(factors);
}

async function getMarketCondition() {
  try {
    const resp = await fetch('https://qt.gtimg.cn/q=sh000001', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await resp.text();
    const m = text.match(/~([\d.]+)~([\d.]+)~([\d.]+)~/);
    if (m) {
      const pct = parseFloat(m[3]) || 0;
      if (pct > 0.5) return 'bull';
      if (pct < -0.5) return 'bear';
    }
  } catch {}
  return 'neutral';
}

// ─── 回测单只股票最近一次预测 ───
function backtestRecord(record, kline) {
  if (!record.forecast || record.forecast.length === 0) return null;
  const predStartDate = record.date;
  const predEndDate = record.forecast[record.forecast.length - 1].date;
  const actualBars = kline.filter(b => b.date > predStartDate && b.date <= predEndDate && b.close != null);
  if (actualBars.length === 0) return null;

  const errors = [];
  let within80 = 0, within95 = 0;
  for (const fp of record.forecast) {
    const match = actualBars.find(b => b.date === fp.date);
    if (!match) continue;
    errors.push(Math.abs(match.close - fp.value));
    if (match.close >= fp.lower80 && match.close <= fp.upper80) within80++;
    if (match.close >= fp.lower95 && match.close <= fp.upper95) within95++;
  }
  if (errors.length === 0) return null;

  const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
  const firstActual = actualBars[0].close;
  const lastActual = actualBars[actualBars.length - 1].close;
  const actualChange = ((lastActual - firstActual) / firstActual) * 100;
  let actualDirection = 'sideways';
  if (actualChange > 1) actualDirection = 'up';
  else if (actualChange < -1) actualDirection = 'down';

  const directionCorrect = (
    (record.trend === 'up' && actualDirection === 'up') ||
    (record.trend === 'down' && actualDirection === 'down') ||
    (record.trend === 'sideways' && actualDirection === 'sideways')
  );

  const predictedChange = record.forecast.length > 0
    ? ((record.forecast[record.forecast.length - 1].value - record.lastPrice) / record.lastPrice) * 100
    : 0;

  return {
    code: record.code,
    date: record.date,
    method: record.method,
    predictedTrend: record.trend,
    actualTrend: actualDirection,
    directionCorrect,
    mae: Math.round(mae * 100) / 100,
    predictedChange: Math.round(predictedChange * 100) / 100,
    actualChange: Math.round(actualChange * 100) / 100,
    within80Rate: errors.length > 0 ? Math.round((within80 / errors.length) * 100) : 0,
    within95Rate: errors.length > 0 ? Math.round((within95 / errors.length) * 100) : 0,
    maxError: Math.round(Math.max(...errors) * 100) / 100,
    sampleCount: errors.length,
    lastPrice: record.lastPrice,
    volatilityRatio: kline.length > 20 ? 1.0 : 1.0,
  };
}

// ─── 主流程 ───
async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`\n══════════════════════════════════════`);
  console.log(`  每日自动回测  ${today}`);
  console.log(`══════════════════════════════════════`);

  if (!fs.existsSync(PREDICTIONS_DIR)) {
    console.log('📭 data/predictions/ 目录不存在，跳过');
    return;
  }

  const files = fs.readdirSync(PREDICTIONS_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('📭 没有预测记录文件');
    return;
  }

  console.log(`📂 发现 ${files.length} 个股票文件\n`);

  const sdk = new StockSDK({ retry: { maxRetries: 1 } });
  const marketCondition = await getMarketCondition();
  console.log(`📊 大盘环境: ${marketCondition === 'bull' ? '偏多' : marketCondition === 'bear' ? '偏空' : '震荡'}\n`);

  const results = [];
  let totalBacktested = 0, totalDirectionCorrect = 0, totalMae = 0;

  for (const file of files) {
    const code = file.replace('.json', '');
    try {
      const history = JSON.parse(fs.readFileSync(path.join(PREDICTIONS_DIR, file), 'utf-8'));
      if (!Array.isArray(history) || history.length === 0) continue;

      // 取最近一次未回测或预测期已结束的记录
      const latest = history[history.length - 1];
      const predEndDate = latest.forecast?.[latest.forecast.length - 1]?.date;
      if (!predEndDate || predEndDate > today) {
        console.log(`⏳ ${code} · 预测期未结束（至 ${predEndDate}），跳过`);
        continue;
      }

      console.log(`📈 ${code} · 获取K线...`);
      const kline = await sdk.getKlineWithIndicators(code, {
        count: 300,
        indicators: { ma: { periods: [5] } },
      });
      if (!kline || kline.length === 0) {
        console.log(`   ⚠️ K线获取失败`);
        continue;
      }

      const bt = backtestRecord(latest, kline);
      if (!bt) {
        console.log(`   ⏳ 实际数据不足，无法回测`);
        continue;
      }

      // 记录到校正系统
      recordError({
        date: latest.date,
        code,
        predictedChange: bt.predictedChange,
        actualChange: bt.actualChange,
        error: bt.mae,
        direction: bt.directionCorrect,
        volatilityRatio: bt.volatilityRatio,
        marketCondition,
      });

      const dirIcon = bt.directionCorrect ? '✅' : '❌';
      console.log(`   ${dirIcon} 预测:${bt.predictedTrend}→实际:${bt.actualTrend} · MAE:¥${bt.mae} · 方向${bt.directionCorrect ? '正确' : '错误'}`);

      totalBacktested++;
      if (bt.directionCorrect) totalDirectionCorrect++;
      totalMae += bt.mae;
      results.push(bt);

    } catch (err) {
      console.log(`   ❌ 失败: ${err.message}`);
    }
    // 加一点延迟避免API限流
    await new Promise(r => setTimeout(r, 500));
  }

  // ─── 生成汇总报表 ───
  const report = {
    date: today,
    marketCondition,
    totalStocks: files.length,
    backtestedCount: totalBacktested,
    directionCorrectRate: totalBacktested > 0 ? Math.round((totalDirectionCorrect / totalBacktested) * 10000) / 100 : 0,
    avgMae: totalBacktested > 0 ? Math.round((totalMae / totalBacktested) * 100) / 100 : 0,
    details: results,
    correctionFactors: loadFactors(),
  };

  try {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log(`\n📁 报表已保存: ${REPORT_FILE}`);
  } catch {}

  console.log(`\n══════════════════════════════════════`);
  console.log(`  完成！回测 ${totalBacktested} 次`);
  console.log(`  方向正确率: ${report.directionCorrectRate}%`);
  console.log(`  平均误差: ¥${report.avgMae}`);
  console.log(`══════════════════════════════════════`);

  // 如果方向正确率过低，输出告警
  if (totalBacktested > 3 && report.directionCorrectRate < 40) {
    console.log(`\n⚠️  ⚠️  方向正确率低于40%！建议检查预测参数`);
  }
  if (report.avgMae > 2) {
    console.log(`⚠️  平均误差偏大（¥${report.avgMae}），建议放宽置信区间`);
  }
}

main().catch(e => { console.error('❌ 脚本失败:', e.message); process.exit(1); });
