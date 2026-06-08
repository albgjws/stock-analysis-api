import type { KlineBar, SignalResult, PredictionResult, IntradayData, StockInfo } from '../types';

export interface RecapSection {
  title: string;
  icon: string;
  content: string[];
  type?: 'normal' | 'positive' | 'negative' | 'warning' | 'info';
}

export interface MarketRecapResult {
  summary: RecapSection;
  technical: RecapSection;
  operation: RecapSection;
  outlook: RecapSection;
  /** 盘中实时分析（仅交易时段有内容） */
  realtime?: RecapSection;
}

/** 判断A股交易时段 */
function isMarketOpen(): boolean {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const time = h * 100 + m;
  // 早盘 9:30-11:30
  if (time >= 930 && time < 1130) return true;
  // 午盘 13:00-15:00
  if (time >= 1300 && time < 1500) return true;
  // 集合竞价 9:15-9:30 不纳入
  return false;
}

/** 判断是否收盘 */
function isMarketClosed(): boolean {
  return new Date().getHours() >= 15;
}

/**
 * 分析日内走势形态
 */
function analyzeIntradayPattern(prices: number[], preClose: number): string {
  if (prices.length < 10) return '数据不足';

  const open = prices[0];
  const close = prices[prices.length - 1];
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const range = ((high - low) / preClose) * 100;

  // 分段分析
  const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
  const secondHalf = prices.slice(Math.floor(prices.length / 2));
  const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const gapFromPreClose = ((open - preClose) / preClose) * 100;
  const changePct = ((close - open) / open) * 100;

  // 形态识别
  let pattern = '';
  const isUp = close >= open;
  const isHighOpen = gapFromPreClose > 0.3;
  const isLowOpen = gapFromPreClose < -0.3;
  const isUpDay = close >= preClose;

  if (Math.abs(changePct) < 0.3 && range < 2) {
    pattern = '窄幅震荡';
  } else if (isUp && isHighOpen && changePct > 0) {
    pattern = '高开高走';
  } else if (isUp && isLowOpen && changePct > 1.5) {
    pattern = '低开高走';
  } else if (!isUp && isLowOpen && changePct < 0) {
    pattern = '低开低走';
  } else if (!isUp && isHighOpen && changePct < -1.5) {
    pattern = '高开低走';
  } else if (secondHalfAvg > firstHalfAvg * 1.005 && changePct > 0) {
    pattern = '震荡上行';
  } else if (secondHalfAvg < firstHalfAvg * 0.995 && changePct < 0) {
    pattern = '震荡下行';
  } else if (close > open && low < open * 0.99) {
    pattern = '探底回升（V型）';
  } else if (close < open && high > open * 1.01) {
    pattern = '冲高回落（倒V型）';
  } else {
    pattern = '震荡整理';
  }

  return pattern;
}

/**
 * 分析成交量变化
 */
function analyzeVolume(intraday: IntradayData, kline: KlineBar[]): string {
  if (!kline || kline.length < 20) return '';

  // 使用 K线数据计算成交量，确保单位一致
  const lastBar = kline[kline.length - 1];
  const recentBars = kline.slice(-21, -1);
  const recentAvgVolume = recentBars.reduce((s, b) => s + b.volume, 0) / 20;

  if (recentAvgVolume <= 0) return '';

  const todayVolume = lastBar.volume;
  const volRatio = todayVolume / recentAvgVolume;

  if (volRatio > 1.8) return `今日成交量是近期均值的 ${volRatio.toFixed(1)} 倍，显著放量，市场参与度极高`;
  if (volRatio > 1.3) return `今日成交量是近期均值的 ${volRatio.toFixed(1)} 倍，明显放量，资金交投活跃`;
  if (volRatio > 0.7) return `今日成交量与近期均值相当（${volRatio.toFixed(1)}倍），成交温和`;
  return `今日成交量仅为近期均值的 ${volRatio.toFixed(1)} 倍，缩量明显，市场观望情绪浓厚`;
}

// ============================================================
// 盘中实时分析
// ============================================================

interface IntradayEvent {
  time: string;
  type: 'rapid_rise' | 'sharp_drop' | 'volume_spike' | 'v_reversal';
  desc: string;
  suggestion: string;
}

function detectIntradayEvents(intraday: IntradayData, preClose: number): IntradayEvent[] {
  const events: IntradayEvent[] = [];
  if (!intraday?.data || intraday.data.length < 10) return events;
  const prices = intraday.data.map(p => p.price);
  const times = intraday.data.map(p => p.time);
  const volumes = intraday.data.map(p => p.volume);
  const windowSize = 5;
  for (let i = windowSize; i < prices.length; i++) {
    const changePct = ((prices[i] - prices[i - windowSize]) / prices[i - windowSize]) * 100;
    if (changePct > 1.5) {
      const last = events[events.length - 1];
      if (last?.type === 'rapid_rise' && Math.abs(i - prices.indexOf(prices[times.indexOf(last.time)])) < 6) continue;
      events.push({ time: times[i], type: 'rapid_rise', desc: `${times[i]} 快速拉升 ${changePct.toFixed(1)}%（5分钟涨幅）`, suggestion: changePct > 2 ? '短线追涨需谨慎，观察能否突破前高' : '小幅拉升，关注量能配合' });
    }
    if (changePct < -1.5) {
      const last = events[events.length - 1];
      if (last?.type === 'sharp_drop' && Math.abs(i - prices.indexOf(prices[times.indexOf(last.time)])) < 6) continue;
      events.push({ time: times[i], type: 'sharp_drop', desc: `${times[i]} 快速跳水 ${Math.abs(changePct).toFixed(1)}%（5分钟跌幅）`, suggestion: Math.abs(changePct) > 2 ? '⚠️ 快速跳水，建议观望，跌破支撑考虑止损' : '短线回调，观察能否企稳' });
    }
  }
  const avgMinVol = volumes.reduce((s, v) => s + v, 0) / volumes.length;
  for (let i = 5; i < volumes.length; i++) {
    if (volumes[i] > avgMinVol * 4) {
      const change = ((prices[i] - prices[i - 1]) / prices[i - 1]) * 100;
      events.push({ time: times[i], type: 'volume_spike', desc: `${times[i]} 巨量成交 ${(volumes[i] / 10000).toFixed(0)}万股${change >= 0 ? '📈' : '📉'}`, suggestion: change > 0 ? '放量上攻，关注能否持续' : '放量下跌，抛压较大，暂不建议抄底' });
    }
  }
  for (let i = 10; i < prices.length; i++) {
    const seg = prices.slice(i - 10, i + 1);
    const drop = ((Math.min(...seg.slice(0, 6)) - seg[0]) / seg[0]) * 100;
    const rise = ((seg[seg.length - 1] - Math.min(...seg.slice(5))) / Math.min(...seg.slice(5))) * 100;
    if (drop < -2 && rise > 2) {
      events.push({ time: times[i], type: 'v_reversal', desc: `${times[i]} V型反转（先跌${Math.abs(drop).toFixed(1)}%后涨${rise.toFixed(1)}%）`, suggestion: 'V型反转是短线买入信号，关注突破确认' });
    }
  }
  return events.slice(-5);
}

function generateRealtimeAnalysis(intraday: IntradayData, info: StockInfo, signals: SignalResult, lastRefresh?: string): RecapSection {
  const lines: string[] = [];
  const events = detectIntradayEvents(intraday, intraday.preClose);
  const closed = new Date().getHours() >= 15;
  const timeTag = lastRefresh ? ` [${lastRefresh}]` : '';
  lines.push(`${closed ? '收盘' : '最新'}价 ${info.price.toFixed(2)}，${info.changePercent >= 0 ? '上涨' : '下跌'} ${Math.abs(info.changePercent).toFixed(2)}%${timeTag}`);
  if (events.length > 0) {
    lines.push('—— 盘中异动 ——');
    for (const evt of events) {
      const icon = evt.type === 'rapid_rise' ? '🚀' : evt.type === 'sharp_drop' ? '💥' : evt.type === 'volume_spike' ? '📊' : '🔻';
      lines.push(`${icon} ${evt.desc}`);
      if (!closed) lines.push(`   💡 ${evt.suggestion}`);
    }
  }
  if (!closed) {
    // 每5秒更新一次操作建议
    const buy = signals.overall === 'STRONG_BUY' || signals.overall === 'BUY';
    const sell = signals.overall === 'STRONG_SELL' || signals.overall === 'SELL';
    if (buy) lines.push('—— 操作参考 ——\n📈 综合信号偏多，可逢低关注');
    else if (sell) lines.push('—— 操作参考 ——\n📉 综合信号偏空，注意风险');
    else lines.push('—— 操作参考 ——\n⚪ 信号中性，多看少动');
  }
  return {
    title: closed ? '今日盘面回顾' : `⚡ 盘中实时分析${timeTag}`,
    icon: closed ? '📋' : '⚡',
    type: events.some(e => e.type === 'sharp_drop') ? 'warning' : info.changePercent >= 0 ? 'positive' : 'negative',
    content: lines,
  };
}

/**
 * 分析日内走势详细描述
 */
function describeIntradayMovement(intraday: IntradayData, info: StockInfo): string {
  if (!intraday?.data || intraday.data.length === 0) return '';

  const prices = intraday.data.map(p => p.price);
  const preClose = intraday.preClose;
  const open = prices[0];
  const close = prices[prices.length - 1];
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const pattern = analyzeIntradayPattern(prices, preClose);
  const changePct = info.changePercent;

  const gapPct = ((open - preClose) / preClose) * 100;
  const intraRange = ((high - low) / preClose) * 100;

  let desc = `今日以 ${open.toFixed(2)} 开盘`;

  if (Math.abs(gapPct) > 0.3) {
    desc += gapPct > 0 ? `（高开 ${gapPct.toFixed(2)}%）` : `（低开 ${Math.abs(gapPct).toFixed(2)}%）`;
  } else {
    desc += '（平开）';
  }

  desc += `，全天呈现「${pattern}」格局，`;
  desc += `最高触及 ${high.toFixed(2)}，最低探至 ${low.toFixed(2)}，`;
  desc += `日内振幅 ${intraRange.toFixed(2)}%。`;

  if (close >= preClose) {
    desc += `最终收于 ${close.toFixed(2)}，上涨 ${changePct.toFixed(2)}%。`;
  } else {
    desc += `最终收于 ${close.toFixed(2)}，下跌 ${Math.abs(changePct).toFixed(2)}%。`;
  }

  return desc;
}

/**
 * 均线系统分析
 */
function analyzeMA(kline: KlineBar[]): string[] {
  const lines: string[] = [];
  if (kline.length === 0) return ['K线数据不足，无法分析'];
  const last = kline[kline.length - 1];
  if (!last || !last.ma) return ['均线数据不足'];

  const { ma5, ma10, ma20, ma60 } = last.ma;
  const price = last.close;
  const mas = [
    { period: 5, value: ma5 },
    { period: 10, value: ma10 },
    { period: 20, value: ma20 },
    { period: 60, value: ma60 },
  ].filter(m => m.value != null) as { period: number; value: number }[];

  if (mas.length < 2) return ['均线数据不足'];

  // 均线排列
  const sortedAsc = [...mas].sort((a, b) => a.value - b.value);
  const isBullish = sortedAsc.map(m => m.period).join(',') === [5, 10, 20, 60].filter(p =>
    mas.some(m => m.period === p)
  ).join(',') && sortedAsc.length >= 3;

  const isBearish = [...sortedAsc].reverse().map(m => m.period).join(',') === [5, 10, 20, 60].filter(p =>
    mas.some(m => m.period === p)
  ).join(',') && sortedAsc.length >= 3;

  if (isBullish) {
    lines.push('均线系统呈多头排列（5日 > 10日 > 20日 > 60日），中期趋势向好');
  } else if (isBearish) {
    lines.push('均线系统呈空头排列（5日 < 10日 < 20日 < 60日），中期趋势偏弱');
  } else {
    lines.push('均线系统交叉粘合，方向尚不明确，等待趋势选择');
  }

  // 股价相对均线位置
  const aboveMAs = mas.filter(m => price > m.value).length;
  if (aboveMAs === mas.length) {
    lines.push(`股价 ${price.toFixed(2)} 站上所有均线，多头强势区间`);
  } else if (aboveMAs >= mas.length / 2) {
    lines.push(`股价 ${price.toFixed(2)} 运行于部分均线上方，多空博弈中略微占优`);
  } else if (aboveMAs === 0) {
    lines.push(`股价 ${price.toFixed(2)} 落于所有均线下方，空头压制明显`);
  } else {
    lines.push(`股价 ${price.toFixed(2)} 在均线簇中运行，多空拉锯`);
  }

  return lines;
}

/**
 * MACD分析
 */
function analyzeMACD(kline: KlineBar[]): string[] {
  const lines: string[] = [];
  const last = kline[kline.length - 1];
  if (!last.macd) return ['MACD数据不足'];

  const { dif, dea, macd } = last.macd;
  const prev = kline.length > 1 ? kline[kline.length - 2].macd : null;

  // 柱状图变化趋势
  const barIncreasing = prev ? macd > prev.macd : true;

  if (dif > dea && macd > 0) {
    lines.push(`MACD处于多头区域，DIF ${dif.toFixed(2)} > DEA ${dea.toFixed(2)}，红柱${barIncreasing ? '持续放大' : '开始缩短'}，多头动能${barIncreasing ? '增强' : '衰减'}`);
  } else if (dif > dea && macd < 0) {
    lines.push(`MACD虽为负值但DIF已上穿DEA，即将金叉，空头力量减弱，关注能否形成真金叉`);
    if (barIncreasing) lines.push('绿柱持续收窄，做空动能衰减');
  } else if (dif < dea && macd < 0) {
    lines.push(`MACD处于空头区域，DIF ${dif.toFixed(2)} < DEA ${dea.toFixed(2)}，绿柱${barIncreasing ? '持续放大' : '开始收窄'}，空头动能${barIncreasing ? '增强' : '衰减'}`);
  } else {
    lines.push(`MACD方向不明，DIF ${dif.toFixed(2)} 与 DEA ${dea.toFixed(2)} 接近粘合，等待方向选择`);
  }

  return lines;
}

/**
 * RSI分析
 */
function analyzeRSI(kline: KlineBar[]): string[] {
  const lines: string[] = [];
  const last = kline[kline.length - 1];
  if (!last.rsi) return ['RSI数据不足'];

  const rsi6 = last.rsi.rsi6;
  const rsi12 = last.rsi.rsi12;
  const rsi14 = last.rsi.rsi12; // 使用rsi12作为近似14周期
  const rsi24 = last.rsi.rsi24;

  if (rsi6 != null) {
    if (rsi6 < 30) {
      lines.push(`RSI(6) = ${rsi6.toFixed(1)}，进入超卖区域（<30），短期存在技术性反弹需求`);
    } else if (rsi6 > 70) {
      lines.push(`RSI(6) = ${rsi6.toFixed(1)}，进入超买区域（>70），短期存在回调风险`);
    } else if (rsi6 < 45) {
      lines.push(`RSI(6) = ${rsi6.toFixed(1)}，处于偏低位置，仍有上行空间`);
    } else if (rsi6 > 55) {
      lines.push(`RSI(6) = ${rsi6.toFixed(1)}，处于偏高位置，追高需谨慎`);
    } else {
      lines.push(`RSI(6) = ${rsi6.toFixed(1)}，处于中性区间`);
    }
  }

  // 多周期RSI对比
  if (rsi6 != null && rsi24 != null) {
    if (rsi6 > rsi24) {
      lines.push(`短期RSI（${rsi6.toFixed(1)}）高于长期RSI（${rsi24.toFixed(1)}），短期动能偏强`);
    } else {
      lines.push(`短期RSI（${rsi6.toFixed(1)}）低于长期RSI（${rsi24.toFixed(1)}），短期动能偏弱`);
    }
  }

  return lines;
}

/**
 * 布林带分析
 */
function analyzeBollinger(kline: KlineBar[]): string[] {
  const lines: string[] = [];
  const last = kline[kline.length - 1];
  if (!last.boll) return ['布林带数据不足'];

  const { mid, upper, lower } = last.boll;
  const price = last.close;
  const bandwidth = ((upper - lower) / mid) * 100;

  // 带宽分析
  if (bandwidth < 5) {
    lines.push(`布林带宽仅 ${bandwidth.toFixed(1)}%，带宽极窄，预示变盘在即`);
  } else if (bandwidth < 10) {
    lines.push(`布林带宽 ${bandwidth.toFixed(1)}%，带宽偏窄，行情可能即将展开`);
  } else {
    lines.push(`布林带宽 ${bandwidth.toFixed(1)}%，波动率正常`);
  }

  // 价格位置
  if (price >= upper * 0.99) {
    lines.push(`股价 ${price.toFixed(2)} 触及布林上轨 ${upper.toFixed(2)}，处于超买区域，注意回调风险`);
  } else if (price <= lower * 1.01) {
    lines.push(`股价 ${price.toFixed(2)} 接近布林下轨 ${lower.toFixed(2)}，处于超卖区域，关注反弹机会`);
  } else if (price >= mid) {
    lines.push(`股价 ${price.toFixed(2)} 位于布林中轨 ${mid.toFixed(2)} 上方，运行于强势区域`);
  } else {
    lines.push(`股价 ${price.toFixed(2)} 位于布林中轨 ${mid.toFixed(2)} 下方，暂处弱势区域`);
  }

  return lines;
}

/**
 * KDJ分析
 */
function analyzeKDJ(kline: KlineBar[]): string[] {
  const lines: string[] = [];
  const last = kline[kline.length - 1];
  if (!last.kdj) return ['KDJ数据不足'];

  const { k, d, j } = last.kdj;
  const prev = kline.length > 1 ? kline[kline.length - 2].kdj : null;

  // KDJ交叉
  if (prev) {
    if (k > d && prev.k <= prev.d) {
      if (k < 40) lines.push(`KDJ在低位 ${k.toFixed(1)}/${d.toFixed(1)} 附近形成金叉，短期买入信号`);
      else lines.push(`KDJ形成金叉（K ${k.toFixed(1)} > D ${d.toFixed(1)}），短线转强`);
    } else if (k < d && prev.k >= prev.d) {
      if (k > 60) lines.push(`KDJ在高位 ${k.toFixed(1)}/${d.toFixed(1)} 附近形成死叉，短线回避信号`);
      else lines.push(`KDJ形成死叉（K ${k.toFixed(1)} < D ${d.toFixed(1)}），短线转弱`);
    } else if (k > d) {
      lines.push(`KDJ多头发散（K ${k.toFixed(1)} > D ${d.toFixed(1)}），短线偏多`);
    } else {
      lines.push(`KDJ空头发散（K ${k.toFixed(1)} < D ${d.toFixed(1)}），短线偏空`);
    }
  } else {
    if (k > d) lines.push(`KDJ多头发散（K ${k.toFixed(1)} > D ${d.toFixed(1)}）`);
    else lines.push(`KDJ空头发散（K ${k.toFixed(1)} < D ${d.toFixed(1)}）`);
  }

  // J值极端位置提示
  if (j > 100) lines.push(`J值 ${j.toFixed(1)} > 100，短线超买严重，警惕回调`);
  else if (j < 0) lines.push(`J值 ${j.toFixed(1)} < 0，短线超卖严重，关注反弹机会`);

  return lines;
}

/**
 * 成交量深度分析
 */
function analyzeVolumeDetail(kline: KlineBar[]): string[] {
  const lines: string[] = [];
  if (kline.length < 20) return ['成交量数据不足'];

  const recent10 = kline.slice(-10);
  const prev10 = kline.slice(-20, -10);

  const avgVolRecent = recent10.reduce((s, b) => s + b.volume, 0) / recent10.length;
  const avgVolPrev = prev10.reduce((s, b) => s + b.volume, 0) / prev10.length;
  const last = recent10[recent10.length - 1];

  // 量能趋势
  const volTrend = avgVolRecent / avgVolPrev;
  if (volTrend > 1.5) {
    lines.push(`近10日成交量较前10日放大 ${((volTrend - 1) * 100).toFixed(0)}%，资金加速入场，市场活跃度显著提升`);
  } else if (volTrend > 1.2) {
    lines.push(`近10日成交量较前10日放大 ${((volTrend - 1) * 100).toFixed(0)}%，量能温和放大`);
  } else if (volTrend < 0.7) {
    lines.push(`近10日成交量较前10日萎缩 ${((1 - volTrend) * 100).toFixed(0)}%，市场交投清淡，观望情绪浓厚`);
  } else if (volTrend < 0.9) {
    lines.push(`近10日成交量较前10日略有萎缩，量能不足可能制约反弹高度`);
  } else {
    lines.push('近10日成交量与前期基本持平，量能变化不大');
  }

  // 价量配合
  if (last.changePercent != null) {
    if (last.changePercent > 0 && last.volume > avgVolRecent * 1.3) {
      lines.push(`今日价涨量增（涨幅 ${last.changePercent.toFixed(2)}%），量价配合良好，上涨具有可持续性`);
    } else if (last.changePercent > 0 && last.volume < avgVolRecent * 0.7) {
      lines.push(`今日虽然上涨但成交量不足，上涨缺乏量能支撑，需警惕量价背离`);
    } else if (last.changePercent < 0 && last.volume > avgVolRecent * 1.3) {
      lines.push(`今日价跌量增，抛压较大，调整可能延续`);
    } else if (last.changePercent < 0 && last.volume < avgVolRecent * 0.7) {
      lines.push(`今日缩量下跌，做空动能有限，杀跌意愿不强`);
    }
  }

  return lines;
}

/**
 * 生成操作建议
 */
function generateOperationAdvice(signals: SignalResult, prediction: PredictionResult): string[] {
  const lines: string[] = [];

  // 综合信号建议
  switch (signals.overall) {
    case 'STRONG_BUY':
      lines.push('【强烈买入】综合技术指标全面偏多，建议积极布局，可分批次建仓');
      break;
    case 'BUY':
      lines.push('【买入】多项技术指标发出买入信号，可逢低适当介入');
      break;
    case 'HOLD':
      lines.push('【持有观望】多空信号交织，建议持股不动或空仓等待，暂不操作');
      break;
    case 'SELL':
      lines.push('【卖出】多项技术指标转弱，建议减仓锁定利润或止损离场');
      break;
    case 'STRONG_SELL':
      lines.push('【强烈卖出】技术面全面恶化，建议清仓离场，等待企稳后再考虑介入');
      break;
  }

  // 关键价位
  lines.push(`短线支撑位：${signals.support.toFixed(2)}，阻力位：${signals.resistance.toFixed(2)}`);

  // 止损止盈
  lines.push(`建议止损价：${signals.stopLoss.price.toFixed(2)}（${signals.stopLoss.reason}）`);
  lines.push(`建议止盈价：${signals.takeProfit.price.toFixed(2)}（${signals.takeProfit.reason}）`);

  // 趋势预测
  const trendMap: Record<string, string> = {
    up: '预测后市震荡上行',
    down: '预测后市仍有调整压力',
    sideways: '预测后市维持震荡整理',
  };
  lines.push(`${trendMap[prediction.trend] || '后市方向尚不明确'}（${prediction.method}模型，置信度：${prediction.confidence === 'high' ? '高' : prediction.confidence === 'medium' ? '中' : '低'}）`);

  return lines;
}

/**
 * 生成后市预测
 */
function generateOutlook(prediction: PredictionResult, signals: SignalResult): string[] {
  const lines: string[] = [];

  if (prediction.forecast.length > 0) {
    const lastForecast = prediction.forecast[prediction.forecast.length - 1];
    const firstForecast = prediction.forecast[0];
    const predictedChange = ((lastForecast.value - firstForecast.value) / firstForecast.value) * 100;

    lines.push(`基于${prediction.method}模型预测，未来${prediction.forecast.length}个交易日预计变动 ${predictedChange >= 0 ? '+' : ''}${predictedChange.toFixed(2)}%）`);

    // 置信区间描述
    const upperRange = lastForecast.upper95;
    const lowerRange = lastForecast.lower95;
    const rangeWidth = ((upperRange - lowerRange) / lastForecast.value) * 100;
    if (rangeWidth > 20) {
      lines.push(`95%置信区间较宽（${lowerRange.toFixed(2)} ~ ${upperRange.toFixed(2)}），表明市场不确定性较大，预测仅供参考`);
    } else {
      lines.push(`95%置信区间：[${lowerRange.toFixed(2)} ~ ${upperRange.toFixed(2)}]`);
    }
  }

  // 综合判断
  const isOverallBullish = signals.overall === 'STRONG_BUY' || signals.overall === 'BUY' || (signals.overall === 'HOLD' && prediction.trend === 'up');
  const isOverallBearish = signals.overall === 'STRONG_SELL' || signals.overall === 'SELL' || (signals.overall === 'HOLD' && prediction.trend === 'down');

  if (isOverallBullish) {
    lines.push('综合技术面与模型预测，后市偏向乐观。操作上可持股待涨或逢低加仓，但需注意控制仓位，设好止损');
  } else if (isOverallBearish) {
    lines.push('综合技术面与模型预测，后市偏向谨慎。建议控制仓位，以防御为主，等待趋势明朗后再行操作');
  } else {
    lines.push('技术面信号与模型预测存在分歧，后市方向尚不明确。建议多看少动，等待市场给出明确方向信号');
  }

  // 风险提示
  lines.push('⚠️ 以上分析基于历史数据和技术指标，不构成投资建议。股市有风险，投资需谨慎');

  return lines;
}

/**
 * 生成完整复盘报告
 */
export function generateMarketRecap(
  info: StockInfo,
  kline: KlineBar[],
  signals: SignalResult,
  prediction: PredictionResult,
  intraday: IntradayData | null,
  lastRefresh?: string,
): MarketRecapResult {
  // === 1. 今日行情综述 ===
  const summaryLines: string[] = [];

  if (intraday && intraday.data?.length > 0) {
    summaryLines.push(describeIntradayMovement(intraday, info));
    summaryLines.push(analyzeVolume(intraday, kline));
  } else {
    const last = kline[kline.length - 1];
    summaryLines.push(`今日最新价 ${info.price.toFixed(2)}，涨跌幅 ${info.changePercent >= 0 ? '+' : ''}${info.changePercent.toFixed(2)}%`);
    summaryLines.push(`开盘 ${info.open.toFixed(2)} / 最高 ${info.high.toFixed(2)} / 最低 ${info.low.toFixed(2)} / 收盘 ${info.price.toFixed(2)}`);
  }

  const isPositiveDay = info.changePercent >= 0;
  const summary: RecapSection = {
    title: '今日行情综述',
    icon: isPositiveDay ? '📈' : '📉',
    type: isPositiveDay ? 'positive' : 'negative',
    content: summaryLines,
  };

  // === 2. 技术面分析 ===
  const techLines: string[] = [];
  if (kline.length === 0) {
    techLines.push('K线数据暂不可用，无法进行技术面分析');
  } else {
    techLines.push(...analyzeMA(kline));
    techLines.push(...analyzeMACD(kline));
    techLines.push(...analyzeRSI(kline));
    techLines.push(...analyzeBollinger(kline));
    techLines.push(...analyzeKDJ(kline));
    techLines.push(...analyzeVolumeDetail(kline));
  }

  const technical: RecapSection = {
    title: '技术面分析',
    icon: '🔬',
    type: 'info',
    content: techLines,
  };

  // === 3. 操作建议 ===
  const isBuy = signals.overall === 'STRONG_BUY' || signals.overall === 'BUY';
  const isSell = signals.overall === 'STRONG_SELL' || signals.overall === 'SELL';
  const operation: RecapSection = {
    title: '操作建议',
    icon: isBuy ? '💎' : isSell ? '⚠️' : '📋',
    type: isBuy ? 'positive' : isSell ? 'negative' : 'warning',
    content: generateOperationAdvice(signals, prediction),
  };

  // === 4. 后市预测 ===
  const outlook: RecapSection = {
    title: '后市预测',
    icon: '🔮',
    type: 'info',
    content: generateOutlook(prediction, signals),
  };

  // === 5. 盘中实时（或盘后回顾） ===
  let realtime: RecapSection | undefined;
  if (intraday && intraday.data && intraday.data.length > 0) {
    realtime = generateRealtimeAnalysis(intraday, info, signals, lastRefresh);
  }

  return { summary, technical, operation, outlook, realtime };
}
