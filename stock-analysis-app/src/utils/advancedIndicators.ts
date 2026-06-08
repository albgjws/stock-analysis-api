import type { KlineBar } from '../types';

// ============================================================
// 专业指标计算 — 类似同花顺/金证付费版
// ============================================================

// ---------- 三把锁信号 ----------
export interface ThreeLockSignal {
  index: number;       // K线索引
  date: string;
  type: 'buy' | 'sell';
  lockCount: 2 | 3;   // 2 = 两把锁, 3 = 三把锁
  details: string[];   // 具体哪些条件达成
}

/**
 * 三把锁 — 买入三确认 / 卖出三确认
 *
 * 买入锁：
 *   1️⃣ K线收盘站上MA20（趋势突破）
 *   2️⃣ MACD金叉（DIF上穿DEA）（动能确认）
 *   3️⃣ 成交量 > 1.5倍20日均量（资金确认）
 *
 * 卖出锁：
 *   1️⃣ K线收盘跌破MA20（趋势破位）
 *   2️⃣ MACD死叉（DIF下穿DEA）
 *   3️⃣ 成交量 > 1.3倍20日均量（放量下跌）
 */
export function calcThreeLocks(kline: KlineBar[]): ThreeLockSignal[] {
  const signals: ThreeLockSignal[] = [];

  if (kline.length < 25) return signals;

  // 计算20日均量
  const avgVolumes = kline.map((_, i) => {
    if (i < 20) return 0;
    return kline.slice(i - 20, i).reduce((s, b) => s + b.volume, 0) / 20;
  });

  for (let i = 25; i < kline.length; i++) {
    const bar = kline[i];
    const prev = kline[i - 1];
    const prev2 = kline[i - 2]; // 用于判断金叉/死叉的确认
    const avgVol = avgVolumes[i];
    const ma20 = bar.ma?.ma20;

    if (!ma20 || !bar.macd || !prev.macd || avgVol === 0) continue;

    const lockDetails: string[] = [];
    let locks = 0;

    // === 买入锁检测 ===
    // 1️⃣ 价格站上MA20
    const crossAboveMA20 = bar.close > ma20 && prev.close <= prev.ma?.ma20!;
    if (crossAboveMA20) {
      lockDetails.push(`突破MA20（${ma20.toFixed(2)}）`);
      locks++;
    } else if (bar.close > ma20 && prev.close > ma20) {
      // 已站稳MA20上方，也算半把锁
      lockDetails.push(`站上MA20（${ma20.toFixed(2)}）`);
      locks++;
    }

    // 2️⃣ MACD金叉
    const goldenCross = bar.macd.dif > bar.macd.dea && prev.macd.dif <= prev.macd.dea;
    if (goldenCross) {
      lockDetails.push(`MACD金叉（DIF ${bar.macd.dif.toFixed(2)} > DEA ${bar.macd.dea.toFixed(2)}）`);
      locks++;
    } else if (bar.macd.dif > bar.macd.dea && prev.macd.dif > prev.macd.dea) {
      // MACD持续多头
      lockDetails.push('MACD多头运行');
      locks++;
    }

    // 3️⃣ 成交量放大
    const volRatio = bar.volume / avgVol;
    if (volRatio > 1.5) {
      lockDetails.push(`放量 ${volRatio.toFixed(1)}倍`);
      locks++;
    }

    if (locks >= 2) {
      // 检查是否前一日已有相同信号（避免重复）
      const prevSignal = signals[signals.length - 1];
      const isDuplicate = prevSignal && Math.abs(prevSignal.index - i) < 3;

      if (!isDuplicate) {
        signals.push({
          index: i,
          date: bar.date,
          type: 'buy',
          lockCount: locks === 3 ? 3 : 2,
          details: lockDetails,
        });
      }
    }

    // === 卖出锁检测 ===
    const sellLockDetails: string[] = [];
    let sellLocks = 0;

    // 1️⃣ 价格跌破MA20
    const crossBelowMA20 = bar.close < ma20 && prev.close >= prev.ma?.ma20!;
    if (crossBelowMA20) {
      sellLockDetails.push(`跌破MA20（${ma20.toFixed(2)}）`);
      sellLocks++;
    } else if (bar.close < ma20 && prev.close < prev.ma?.ma20!) {
      sellLockDetails.push('MA20下方运行');
      sellLocks++;
    }

    // 2️⃣ MACD死叉
    const deadCross = bar.macd.dif < bar.macd.dea && prev.macd.dif >= prev.macd.dea;
    if (deadCross) {
      sellLockDetails.push(`MACD死叉（DIF ${bar.macd.dif.toFixed(2)} < DEA ${bar.macd.dea.toFixed(2)}）`);
      sellLocks++;
    } else if (bar.macd.dif < bar.macd.dea && prev.macd.dif < prev.macd.dea) {
      sellLockDetails.push('MACD空头运行');
      sellLocks++;
    }

    // 3️⃣ 放量下跌
    if (volRatio > 1.3 && bar.changePercent != null && bar.changePercent < 0) {
      sellLockDetails.push(`放量下跌 ${volRatio.toFixed(1)}倍`);
      sellLocks++;
    }

    if (sellLocks >= 2) {
      const prevSignal = signals[signals.length - 1];
      const isDuplicate = prevSignal && Math.abs(prevSignal.index - i) < 3;
      if (!isDuplicate) {
        signals.push({
          index: i,
          date: bar.date,
          type: 'sell',
          lockCount: sellLocks === 3 ? 3 : 2,
          details: sellLockDetails,
        });
      }
    }
  }

  return signals;
}

// ---------- 神奇九转 (TD Sequential) ----------
export interface TDSequentialPoint {
  index: number;
  date: string;
  count: number;     // 正数=上涨计数, 负数=下跌计数, ±9=反转预警
  price: number;     // 标注位置的价格
  isReversal: boolean; // 是否达到9转
}

/**
 * 神奇九转 — TD Sequential 简化版
 *
 * 连续统计收盘价与4日前的对比：
 *   close[i] > close[i-4] → 上涨计数+1，计数标注在K线上方
 *   close[i] < close[i-4] → 下跌计数+1，计数标注在K线下方
 *   计数达到9 → 反转预警信号
 */
export function calcTDSequential(kline: KlineBar[]): TDSequentialPoint[] {
  const points: TDSequentialPoint[] = [];
  if (kline.length < 10) return points;

  const closes = kline.map(b => b.close);
  let upCount = 0;
  let downCount = 0;

  for (let i = 4; i < closes.length; i++) {
    const higher = closes[i] > closes[i - 4];
    const lower = closes[i] < closes[i - 4];

    if (higher) {
      upCount++;
      downCount = 0;
      if (upCount >= 1 && upCount <= 9) {
        const isReversal = upCount === 9;
        const price = kline[i].high; // 标注在K线上方

        points.push({
          index: i,
          date: kline[i].date,
          count: upCount,
          price: isReversal ? price + (price - kline[i].low) * 0.3 : price,
          isReversal,
        });
      }
      if (upCount > 9) upCount = 9;
    } else if (lower) {
      downCount++;
      upCount = 0;
      if (downCount >= 1 && downCount <= 9) {
        const isReversal = downCount === 9;
        const price = kline[i].low; // 标注在K线下方

        points.push({
          index: i,
          date: kline[i].date,
          count: -downCount,
          price: isReversal ? price - (kline[i].high - price) * 0.3 : price,
          isReversal,
        });
      }
      if (downCount > 9) downCount = 9;
    } else {
      upCount = 0;
      downCount = 0;
    }
  }

  return points;
}

// ---------- 波段买卖点 ----------
export interface SwingPoint {
  index: number;
  date: string;
  type: 'buy' | 'sell';
  price: number;
  reason: string;
}

/**
 * 波段买卖点 — 基于KDJ + RSI + MACD的短期反转
 *
 * 买入：KDJ低位金叉 || RSI超卖(<30) + K线收阳
 * 卖出：KDJ高位死叉 || RSI超买(>70) + K线收阴
 */
export function calcSwingPoints(kline: KlineBar[]): SwingPoint[] {
  const points: SwingPoint[] = [];
  if (kline.length < 10) return points;

  for (let i = 3; i < kline.length; i++) {
    const bar = kline[i];
    const prev = kline[i - 1];

    // 买入点
    if (bar.kdj && prev.kdj) {
      const kdjBuy = bar.kdj.k > bar.kdj.d && prev.kdj.k <= prev.kdj.d && bar.kdj.k < 40;
      if (kdjBuy) {
        points.push({
          index: i,
          date: bar.date,
          type: 'buy',
          price: bar.low,
          reason: `KDJ低位金叉（K ${bar.kdj.k.toFixed(1)} > D ${bar.kdj.d.toFixed(1)}）`,
        });
        continue;
      }
    }

    // RSI超卖买入
    if (bar.rsi) {
      const rsi = bar.rsi.rsi6 ?? bar.rsi.rsi12 ?? 50;
      if (rsi < 30 && bar.changePercent != null && bar.changePercent > 0) {
        // 检查是否与已有买入点间隔足够
        const lastBuy = points.filter(p => p.type === 'buy').pop();
        if (!lastBuy || i - lastBuy.index > 5) {
          points.push({
            index: i,
            date: bar.date,
            type: 'buy',
            price: bar.low,
            reason: `RSI超卖反弹（RSI ${rsi.toFixed(1)}）`,
          });
          continue;
        }
      }
    }

    // 卖出点
    if (bar.kdj && prev.kdj) {
      const kdjSell = bar.kdj.k < bar.kdj.d && prev.kdj.k >= prev.kdj.d && bar.kdj.k > 60;
      if (kdjSell) {
        points.push({
          index: i,
          date: bar.date,
          type: 'sell',
          price: bar.high,
          reason: `KDJ高位死叉（K ${bar.kdj.k.toFixed(1)} < D ${bar.kdj.d.toFixed(1)}）`,
        });
        continue;
      }
    }

    // RSI超买卖出
    if (bar.rsi && !bar.kdj) {
      const rsi = bar.rsi.rsi6 ?? bar.rsi.rsi12 ?? 50;
      if (rsi > 70 && bar.changePercent != null && bar.changePercent < 0) {
        const lastSell = points.filter(p => p.type === 'sell').pop();
        if (!lastSell || i - lastSell.index > 5) {
          points.push({
            index: i,
            date: bar.date,
            type: 'sell',
            price: bar.high,
            reason: `RSI超买回调（RSI ${rsi.toFixed(1)}）`,
          });
        }
      }
    }
  }

  return points;
}

// ---------- 多空综合对比 ----------
export interface BullBearGauge {
  score: number;       // -100 ~ +100
  status: 'strong_bull' | 'bull' | 'neutral' | 'bear' | 'strong_bear';
  shortTerm: number;   // 短期得分
  mediumTerm: number;  // 中期得分
}

/**
 * 多空综合对比 — 整合多项指标的加权评分
 */
export function calcBullBearGauge(kline: KlineBar[]): BullBearGauge | null {
  if (kline.length < 60) return null;

  const last = kline[kline.length - 1];
  const prev20 = kline.slice(-20);
  let score = 0;

  // MA趋势 (±20)
  if (last.ma) {
    const { ma5, ma10, ma20, ma60 } = last.ma;
    if (ma5 && ma10 && ma20) {
      if (ma5 > ma10 && ma10 > ma20) score += 20;
      else if (ma5 < ma10 && ma10 < ma20) score -= 20;
      else if (ma5 > ma20) score += 5;
      else score -= 5;
    }
    if (ma60 && last.close > ma60) score += 5;
    else if (ma60) score -= 5;
  }

  // MACD (±20)
  if (last.macd) {
    const { dif, dea, macd } = last.macd;
    if (dif > dea && macd > 0) score += 15;
    else if (dif > dea) score += 5;
    else if (dif < dea && macd < 0) score -= 15;
    else score -= 5;

    // MACD柱变化
    const prev = kline.length > 1 ? kline[kline.length - 2].macd : null;
    if (prev && macd > prev.macd) score += 5;
    else if (prev) score -= 5;
  }

  // RSI (±15)
  if (last.rsi) {
    const rsi = last.rsi.rsi6 ?? last.rsi.rsi12 ?? 50;
    if (rsi > 60) score += 10;
    else if (rsi > 50) score += 5;
    else if (rsi < 40) score -= 10;
    else if (rsi < 50) score -= 5;
  }

  // KDJ (±15)
  if (last.kdj) {
    if (last.kdj.k > last.kdj.d) score += 10;
    else score -= 10;
    if (last.kdj.j > 80) score -= 5;  // 超买减分
    if (last.kdj.j < 20) score += 5;  // 超卖加分
  }

  // 成交量趋势 (±10)
  const avgVol10 = prev20.slice(-10).reduce((s, b) => s + b.volume, 0) / 10;
  const avgVol20 = prev20.reduce((s, b) => s + b.volume, 0) / 20;
  if (avgVol10 > avgVol20 * 1.2) score += 10;
  else if (avgVol10 < avgVol20 * 0.8) score -= 5;

  // 布林带 (±10)
  if (last.boll) {
    const pos = (last.close - last.boll.lower) / (last.boll.upper - last.boll.lower);
    if (pos > 0.8) score -= 5;  // 接近上轨
    else if (pos < 0.2) score += 5;  // 接近下轨
  }

  // 归一化
  const clampedScore = Math.max(-100, Math.min(100, score));

  let status: BullBearGauge['status'];
  if (clampedScore >= 60) status = 'strong_bull';
  else if (clampedScore >= 25) status = 'bull';
  else if (clampedScore <= -60) status = 'strong_bear';
  else if (clampedScore <= -25) status = 'bear';
  else status = 'neutral';

  return {
    score: clampedScore,
    status,
    shortTerm: score,
    mediumTerm: score, // 简化处理
  };
}

// ---------- 主力量能对比 ----------
export interface VolumePower {
  buyPower: number;   // 主动买入比例
  sellPower: number;  // 主动卖出比例
  ratio: number;      // 多空比
}

/**
 * 量能对比 — 用上涨/下跌日的成交量估算买卖力量
 */
export function calcVolumePower(kline: KlineBar[], days: number = 20): VolumePower | null {
  if (kline.length < days) return null;

  const recent = kline.slice(-days);
  let buyVol = 0;
  let sellVol = 0;
  let totalVol = 0;

  for (const bar of recent) {
    totalVol += bar.volume;
    if (bar.changePercent != null) {
      if (bar.changePercent > 0) {
        buyVol += bar.volume;
      } else if (bar.changePercent < 0) {
        sellVol += bar.volume;
      } else {
        // 平盘，各分一半
        buyVol += bar.volume / 2;
        sellVol += bar.volume / 2;
      }
    }
  }

  if (totalVol === 0) return null;

  const buyPower = (buyVol / totalVol) * 100;
  const sellPower = (sellVol / totalVol) * 100;

  return {
    buyPower: Math.round(buyPower * 10) / 10,
    sellPower: Math.round(sellPower * 10) / 10,
    ratio: Math.round((buyPower / sellPower) * 100) / 100,
  };
}

// ---------- 统一返回值 ----------
export interface AdvancedSignals {
  threeLocks: ThreeLockSignal[];
  tdSequential: TDSequentialPoint[];
  swingPoints: SwingPoint[];
  bullBear: BullBearGauge | null;
  volumePower: VolumePower | null;
}

/**
 * 计算所有专业指标
 */
export function calcAllAdvancedSignals(kline: KlineBar[]): AdvancedSignals {
  return {
    threeLocks: calcThreeLocks(kline),
    tdSequential: calcTDSequential(kline),
    swingPoints: calcSwingPoints(kline),
    bullBear: calcBullBearGauge(kline),
    volumePower: calcVolumePower(kline),
  };
}
