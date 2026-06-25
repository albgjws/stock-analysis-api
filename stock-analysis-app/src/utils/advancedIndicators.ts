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

// ---------- MACD+KDJ 组合双金叉/双死叉 ----------
export interface DualGoldenCross {
  index: number;
  date: string;
  type: 'golden' | 'death'; // golden=双金叉(买入) death=双死叉(卖出)
  macdCross: boolean;       // MACD是否金叉/死叉
  kdjCross: boolean;        // KDJ是否金叉/死叉
  strength: number;         // 强度: 1=单指标确认, 2=双指标确认
  details: string;
}

/**
 * MACD + KDJ 组合双金叉/双死叉
 *
 * 在连续的几根K线内，MACD和KDJ同时或先后发出金叉/死叉信号。
 *
 * 双金叉（买入信号）：
 *   ✅ MACD金叉（DIF上穿DEA）
 *   ✅ KDJ金叉（K上穿D，且K<40低位）
 *   两者在相邻3根K线内同时出现 → 强买入信号
 *
 * 双死叉（卖出信号）：
 *   ❌ MACD死叉（DIF下穿DEA）
 *   ❌ KDJ死叉（K下穿D，且K>60高位）
 *   两者在相邻3根K线内同时出现 → 强卖出信号
 */
export function calcDualGoldenCross(kline: KlineBar[]): DualGoldenCross[] {
  const signals: DualGoldenCross[] = [];
  if (kline.length < 10) return signals;

  // 第一步：标记每个K线的MACD和KDJ十字状态
  interface CrossMark {
    index: number;
    date: string;
    macdGolden: boolean;  // MACD金叉
    macdDeath: boolean;   // MACD死叉
    kdjGolden: boolean;   // KDJ金叉(低位)
    kdjDeath: boolean;    // KDJ死叉(高位)
  }

  const marks: CrossMark[] = [];

  for (let i = 1; i < kline.length; i++) {
    const bar = kline[i];
    const prev = kline[i - 1];
    if (!bar.macd || !prev.macd || !bar.kdj || !prev.kdj) continue;

    const macdGolden = bar.macd.dif > bar.macd.dea && prev.macd.dif <= prev.macd.dea;
    const macdDeath = bar.macd.dif < bar.macd.dea && prev.macd.dif >= prev.macd.dea;
    const kdjGolden = bar.kdj.k > bar.kdj.d && prev.kdj.k <= prev.kdj.d && bar.kdj.k < 40;
    const kdjDeath = bar.kdj.k < bar.kdj.d && prev.kdj.k >= prev.kdj.d && bar.kdj.k > 60;

    if (macdGolden || macdDeath || kdjGolden || kdjDeath) {
      marks.push({ index: i, date: bar.date, macdGolden, macdDeath, kdjGolden, kdjDeath });
    }
  }

  // 第二步：在相邻3根K线内找MACD+KDJ同时出现的情况
  const WINDOW = 3;
  const used = new Set<number>();

  for (let i = 0; i < marks.length; i++) {
    if (used.has(i)) continue;
    const m = marks[i];

    for (let j = i + 1; j < marks.length && j <= i + WINDOW; j++) {
      if (used.has(j)) continue;
      const n = marks[j];

      // 双金叉检测
      const hasMacdGolden = m.macdGolden || n.macdGolden;
      const hasKdjGolden = m.kdjGolden || n.kdjGolden;
      if (hasMacdGolden && hasKdjGolden) {
        const lastIdx = Math.max(m.index, n.index);
        const strength = (m.macdGolden && m.kdjGolden) || (n.macdGolden && n.kdjGolden) ? 2 : 1;
        const parts: string[] = [];
        if (m.macdGolden || n.macdGolden) parts.push('MACD金叉');
        if (m.kdjGolden || n.kdjGolden) parts.push('KDJ低位金叉');
        signals.push({
          index: lastIdx,
          date: kline[lastIdx].date,
          type: 'golden',
          macdCross: hasMacdGolden,
          kdjCross: hasKdjGolden,
          strength,
          details: parts.join('+') + `（强度${strength}）`,
        });
        used.add(i);
        used.add(j);
        break;
      }

      // 双死叉检测
      const hasMacdDeath = m.macdDeath || n.macdDeath;
      const hasKdjDeath = m.kdjDeath || n.kdjDeath;
      if (hasMacdDeath && hasKdjDeath) {
        const lastIdx = Math.max(m.index, n.index);
        const strength = (m.macdDeath && m.kdjDeath) || (n.macdDeath && n.kdjDeath) ? 2 : 1;
        const parts: string[] = [];
        if (m.macdDeath || n.macdDeath) parts.push('MACD死叉');
        if (m.kdjDeath || n.kdjDeath) parts.push('KDJ高位死叉');
        signals.push({
          index: lastIdx,
          date: kline[lastIdx].date,
          type: 'death',
          macdCross: hasMacdDeath,
          kdjCross: hasKdjDeath,
          strength,
          details: parts.join('+') + `（强度${strength}）`,
        });
        used.add(i);
        used.add(j);
        break;
      }
    }
  }

  return signals;
}

// ---------- 涨停/跌停连板预测 ----------
export interface LimitPrediction {
  isLimitUp: boolean;           // 是否涨停
  isLimitDown: boolean;         // 是否跌停
  consecutiveCount: number;     // 当前已连板数
  nextDayProb: number;          // 明日连板概率 0-100
  nextDayTrend: 'up' | 'down' | 'sideways';
  analysis: string;             // 分析文字
  factors: string[];            // 影响因素
  // 同花顺风格明细
  limitPrice: number | null;     // 涨停价/跌停价
  blockVolume: number;           // 封单量（手）
  blockAmount: number;           // 封单额（元）
  blockRatio: number | null;     // 封单占成交比(%)
  limitVolume: number;           // 涨停/跌停成交额（元）
  maxBlockAmount: number;        // 最高封单额（元）
  turnoverRate: number | null;   // 换手率(%)
  totalAmount: number;           // 今日总成交额（元）
}

/**
 * 涨停/跌停连板概率预测 + 封单详情
 *
 * 涨跌停检测：涨幅≥9.6%（非ST）或接口返回的涨跌停价
 *
 * 连板概率考虑因素：
 *   1. 今日封板强度（封单/成交比）
 *   2. 流通市值（越小越容易连板）
 *   3. 当前连板位置（1板成功率最高）
 *   4. 技术指标位置（KDJ/RSI空间）
 */
export function calcLimitPrediction(
  kline: KlineBar[],
  info: { price: number; changePercent: number; volume: number; marketCap: number; prevClose?: number; limitUp?: number | null; limitDown?: number | null; turnoverRate?: number | null; sell1Vol?: number; buy1Vol?: number },
  extras?: {
    intraday?: any;
  }
): LimitPrediction | null {
  if (!kline || kline.length < 5) return null;

  // 优先使用接口返回的涨跌停价
  let isLimitUp = false, isLimitDown = false;
  if (info.limitUp != null && info.price >= info.limitUp - 0.01) isLimitUp = true;
  if (info.limitDown != null && info.price <= info.limitDown + 0.01) isLimitDown = true;

  // 降级：没有涨跌停价时用百分比判断
  if (!isLimitUp && !isLimitDown && !info.limitUp && !info.limitDown) {
    const lastBar = kline[kline.length - 1];
    const prevBar = kline.length > 1 ? kline[kline.length - 2] : null;
    if (!lastBar || !prevBar) return null;
    const klineChgPct = ((lastBar.close - prevBar.close) / prevBar.close) * 100;
    const chgPct = info.changePercent;
    const effectivePct = Math.abs(chgPct) > Math.abs(klineChgPct) * 1.5 ? klineChgPct : chgPct;
    const limitPct = 9.6;
    isLimitUp = effectivePct >= limitPct;
    isLimitDown = effectivePct <= -limitPct;
  }

  if (!isLimitUp && !isLimitDown) return null;

  const limitPct = 9.6;

  // 计算成交量比率（今日量 / 20日均量）
  const recentVols = kline.slice(-20).map(b => b.volume);
  const avgVol = recentVols.reduce((s, v) => s + v, 0) / recentVols.length;
  const volRatio = avgVol > 0 ? info.volume / avgVol : 1;

  // 计算前几日的涨幅来判断已连板数
  let consecutiveCount = 1;
  const dir = isLimitUp ? 1 : -1;
  for (let i = kline.length - 2; i >= 0 && i >= kline.length - 6; i--) {
    const bar = kline[i];
    const prev = i > 0 ? kline[i - 1] : null;
    if (prev && prev.close > 0) {
      const pct = (bar.close - prev.close) / prev.close * 100;
      if (dir > 0 && pct >= limitPct - 1) consecutiveCount++;
      else if (dir < 0 && pct <= -(limitPct - 1)) consecutiveCount++;
      else break;
    } else break;
  }

  // 计算连板概率
  let prob = 50;
  const factors: string[] = [];

  // 因子1：成交量（缩量封板→强）
  if (isLimitUp) {
    if (volRatio < 0.5) { prob += 20; factors.push('缩量封板，筹码锁定良好'); }
    else if (volRatio < 0.8) { prob += 15; factors.push('量能适中，封板质量较高'); }
    else if (volRatio < 1.2) { prob += 5; factors.push('量能正常'); }
    else { prob -= 10; factors.push('放量封板，分歧较大'); }
  } else {
    if (volRatio < 0.5) { prob += 5; factors.push('缩量跌停，抛压未释放充分'); }
    else { prob += 10; factors.push('放量跌停，抛压释放充分'); }
  }

  // 因子2：流通市值（小盘股更容易连板）
  const cap = info.marketCap || 0;
  if (cap > 0) {
    if (cap < 30) { prob += 15; factors.push('小盘股，连板弹性大'); }
    else if (cap < 80) { prob += 8; factors.push('中盘股，有一定连板潜力'); }
    else if (cap < 200) { prob += 0; }
    else { prob -= 10; factors.push('大盘股，连板难度较大'); }
  }

  // 因子3：连板位置
  if (consecutiveCount === 1) { prob += 10; factors.push('首板，上涨空间大'); }
  else if (consecutiveCount === 2) { prob += 5; factors.push('二板，市场关注度高'); }
  else if (consecutiveCount === 3) { prob -= 5; factors.push('三板，分歧加大'); }
  else { prob -= Math.min(20, consecutiveCount * 5); factors.push(`${consecutiveCount}板，高位风险加大`); }

  // 因子4：KDJ位置（J值空间）
  const last = kline[kline.length - 1];
  if (last?.kdj?.j != null && isLimitUp) {
    const j = last.kdj.j;
    if (j < 60) { prob += 10; factors.push('KDJ仍有上行空间'); }
    else if (j < 80) { prob += 5; factors.push('KDJ偏高但仍有空间'); }
    else { prob -= 10; factors.push('KDJ严重超买，回调风险大'); }
  }

  // 因子5：RSI位置（超卖超买修正）
  if (last?.rsi?.rsi6 != null) {
    const rsi6 = last.rsi.rsi6;
    if (isLimitUp) {
      if (rsi6 > 80) { prob -= 8; factors.push('RSI严重超买，注意炸板风险'); }
      else if (rsi6 < 40) { prob += 8; factors.push('RSI低位，上涨空间充足'); }
    } else {
      if (rsi6 < 20) { prob -= 5; factors.push('RSI深度超卖，跌停可能打开'); }
    }
  }

  // 限幅
  prob = Math.max(5, Math.min(95, prob));

  const nextDayTrend = isLimitUp ? (prob > 50 ? 'up' : 'sideways') : (prob > 50 ? 'down' : 'sideways');

  const limitLabel = isLimitUp ? (consecutiveCount === 1 ? '首板' : `${consecutiveCount}连板`) : (consecutiveCount === 1 ? '首跌' : `${consecutiveCount}连跌`);
  const analysis = isLimitUp
    ? `${limitLabel}，明日连板概率${prob}%。${factors[0] || ''}`
    : `今日${isLimitDown ? '跌停' : ''}，明日继续跌停概率${prob}%。${factors[0] || ''}`;

  // ─── 封单明细数据 ───
  const limitPrice = isLimitUp ? (info.limitUp ?? null) : (info.limitDown ?? null);

  // 封单量（涨停=卖一量，跌停=买一量），单位：手
  const blockVolume = isLimitUp ? (info.sell1Vol || 0) : (info.buy1Vol || 0);

  // 封单额（元）= 封单量(手) × 100 × 涨停价
  const blockAmount = limitPrice ? blockVolume * 100 * limitPrice : 0;

  // 涨停成交额：分时数据中涨停价成交额
  let limitVolume = 0;
  let totalAmount = info.volume ? info.volume * info.price : 0;
  if (extras?.intraday?.data && limitPrice) {
    let prevVol = 0;
    for (const p of extras.intraday.data) {
      if (p.volume && p.price != null) {
        const delta = p.volume - prevVol;
        prevVol = p.volume;
        if (Math.abs(p.price - limitPrice) < 0.02) {
          limitVolume += delta * p.price;
        }
      }
    }
  }
  if (limitVolume === 0 && limitPrice) {
    limitVolume = info.volume * limitPrice;
  }
  if (extras?.intraday?.data && extras.intraday.data.length > 0) {
    const last = extras.intraday.data[extras.intraday.data.length - 1];
    if (last.amount > 0) totalAmount = last.amount;
  }

  // 封单占成交比(%) = 封单额 / 总成交额
  const blockRatio = totalAmount > 0 && blockAmount > 0
    ? Math.round((blockAmount / totalAmount) * 10000) / 100
    : null;

  const maxBlockAmount = blockAmount;

  return {
    isLimitUp,
    isLimitDown,
    consecutiveCount,
    nextDayProb: prob,
    nextDayTrend,
    analysis,
    factors,
    limitPrice,
    blockVolume,
    blockAmount,
    blockRatio,
    limitVolume,
    maxBlockAmount,
    turnoverRate: info.turnoverRate ?? null,
    totalAmount,
  };
}

// ---------- 收盘评分（明日看涨概率）----------
export interface CloseRating {
  score: number;
  upProb: number;
  rating: 'strong_bull' | 'bull' | 'neutral' | 'bear' | 'strong_bear';
  ratingLabel: string;
  details: { name: string; score: number; maxScore: number; status: string }[];
  summary: string;
}

export function calcCloseRating(kline: KlineBar[], fundFlow?: any[] | null): CloseRating | null {
  if (!kline || kline.length < 20) return null;
  const last = kline[kline.length - 1];
  const prev = kline.length > 1 ? kline[kline.length - 2] : null;
  if (!last) return null;
  const details: { name: string; score: number; maxScore: number; status: string }[] = [];
  let total = 0;

  if (last.kdj) {
    let s = 0;
    if (last.kdj.k > last.kdj.d && last.kdj.k < 40) s = 18;
    else if (last.kdj.k > last.kdj.d && last.kdj.k < 60) s = 12;
    else if (last.kdj.k > last.kdj.d) s = 6;
    else if (last.kdj.k < last.kdj.d && last.kdj.k > 60) s = -18;
    else if (last.kdj.k < last.kdj.d) s = -8;
    if (last.kdj.j > 100) s -= 5;
    if (last.kdj.j < 0) s += 5;
    total += s; details.push({ name: 'KDJ', score: s, maxScore: 20, status: s > 0 ? 'good' : 'bad' });
  }

  if (last.macd && prev?.macd) {
    let s = 0;
    if (last.macd.dif > last.macd.dea && last.macd.macd > 0) s = 12;
    else if (last.macd.dif > last.macd.dea) s = 6;
    else if (last.macd.dif < last.macd.dea && last.macd.macd < 0) s = -12;
    else s = -6;
    if (last.macd.macd > prev.macd.macd) s += 3; else s -= 3;
    total += s; details.push({ name: 'MACD', score: s, maxScore: 15, status: s > 0 ? 'good' : 'bad' });
  }

  if (last.rsi?.rsi6 != null) {
    const r = last.rsi.rsi6;
    let s = r < 30 ? 12 : r < 45 ? 8 : r < 55 ? 2 : r < 70 ? -4 : -12;
    total += s; details.push({ name: 'RSI', score: s, maxScore: 15, status: s > 0 ? 'good' : 'bad' });
  }

  if (last.ma) {
    const { ma5, ma10, ma20, ma60 } = last.ma;
    let s = 0;
    if (ma5 && ma10 && ma20) {
      if (last.close > ma5 && ma5 > ma10 && ma10 > ma20) s = 15;
      else if (last.close > ma5 && ma5 > ma10) s = 10;
      else if (last.close > ma20) s = 5;
      else if (ma60 && last.close < ma60) s = -15;
      else if (last.close < ma20) s = -10;
      else if (last.close < ma10) s = -5;
    }
    total += s; details.push({ name: '均线', score: s, maxScore: 15, status: s > 0 ? 'good' : 'bad' });
  }

  if (kline.length >= 20) {
    const avgVol20 = kline.slice(-20).reduce((a, b) => a + b.volume, 0) / 20;
    const vr = avgVol20 > 0 ? last.volume / avgVol20 : 1;
    const dir = last.changePercent ?? 0;
    let s = 0;
    if (dir > 0 && vr > 1.5) s = 12;
    else if (dir > 0 && vr > 1) s = 8;
    else if (dir > 0) s = 4;
    else if (dir < 0 && vr < 0.7) s = 4;
    else if (dir < 0 && vr > 1.5) s = -12;
    else if (dir < 0) s = -6;
    total += s; details.push({ name: '成交量', score: s, maxScore: 15, status: s > 0 ? 'good' : 'bad' });
  }

  if (last.boll) {
    const pos = (last.close - last.boll.lower) / (last.boll.upper - last.boll.lower);
    let s = pos < 0.1 ? 8 : pos < 0.3 ? 5 : pos < 0.5 ? 2 : pos < 0.7 ? -2 : pos < 0.9 ? -5 : -8;
    total += s; details.push({ name: '布林带', score: s, maxScore: 10, status: s > 0 ? 'good' : 'bad' });
  }

  if (fundFlow && fundFlow.length > 0) {
    const m = fundFlow[fundFlow.length - 1]?.mainNetInflowPercent || 0;
    let s = m > 1 ? 5 : m > 0 ? 2 : m > -1 ? -2 : -5;
    total += s; details.push({ name: '主力资金', score: s, maxScore: 5, status: s > 0 ? 'good' : 'bad' });
  }

  const score = Math.max(-100, Math.min(100, total));
  const upProb = Math.round(((score + 100) / 200) * 100);
  let rating: CloseRating['rating'], ratingLabel: string;
  if (score >= 50) { rating = 'strong_bull'; ratingLabel = '强烈看涨'; }
  else if (score >= 20) { rating = 'bull'; ratingLabel = '看涨'; }
  else if (score <= -50) { rating = 'strong_bear'; ratingLabel = '强烈看跌'; }
  else if (score <= -20) { rating = 'bear'; ratingLabel = '看跌'; }
  else { rating = 'neutral'; ratingLabel = '中性震荡'; }

  const good = details.filter(d => d.score > 0).length;
  const bad = details.filter(d => d.score < 0).length;
  const summary = good >= 5 ? '多项指标共振向好，明日看涨概率较高'
    : bad >= 5 ? '多项指标偏空，注意回调风险'
    : good > bad ? '指标偏多，谨慎看涨'
    : bad > good ? '指标偏空，注意风险'
    : '指标中性，方向不明确';
  return { score, upProb, rating, ratingLabel, details, summary };
}

// ---------- 统一返回值 ----------
export interface AdvancedSignals {
  threeLocks: ThreeLockSignal[];
  tdSequential: TDSequentialPoint[];
  swingPoints: SwingPoint[];
  bullBear: BullBearGauge | null;
  volumePower: VolumePower | null;
  dualGoldenCross: DualGoldenCross[];
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
    dualGoldenCross: calcDualGoldenCross(kline),
  };
}
