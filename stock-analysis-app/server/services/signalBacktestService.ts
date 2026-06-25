import type { KlineBar } from '../types';

export interface SignalBacktestResult {
  hasData: boolean;
  /** 按信号类型分组统计 */
  bySignal: Record<string, {
    total: number;
    hit3d: number;   // 3日后方向正确数
    hit5d: number;
    hit10d: number;
    avgReturn3d: number;
    avgReturn5d: number;
    avgReturn10d: number;
  }>;
  /** 综合统计 */
  overall: {
    totalSignals: number;
    hitRate3d: number;
    hitRate5d: number;
    hitRate10d: number;
  };
}

export class SignalBacktestService {
  /**
   * 回测买卖信号在K线历史各时点的准确率
   * 遍历K线历史，在每个时点计算综合信号，然后看未来N天的涨跌
   */
  backtestSignals(kline: KlineBar[]): SignalBacktestResult {
    if (!kline || kline.length < 50) {
      return { hasData: false, bySignal: {}, overall: { totalSignals: 0, hitRate3d: 0, hitRate5d: 0, hitRate10d: 0 } };
    }

    const bySignal: Record<string, {
      total: number; hit3d: number; hit5d: number; hit10d: number;
      sumRet3d: number; sumRet5d: number; sumRet10d: number;
    }> = {};
    const initSig = () => ({ total: 0, hit3d: 0, hit5d: 0, hit10d: 0, sumRet3d: 0, sumRet5d: 0, sumRet10d: 0 });

    // 遍历K线（留最后10根作为验证窗口）
    for (let i = 40; i < kline.length - 10; i++) {
      const bar = kline[i];
      if (!bar || !bar.close) continue;

      // 用当前时点往前看，模拟实时信号判断
      const window = kline.slice(i - 30, i + 1);
      const signals = this.computeSignals(window, bar);

      // 未来价格变化
      const p3 = kline[i + 3]?.close;
      const p5 = kline[i + 5]?.close;
      const p10 = kline[i + 10]?.close;
      const ret3d = p3 ? (p3 - bar.close) / bar.close : 0;
      const ret5d = p5 ? (p5 - bar.close) / bar.close : 0;
      const ret10d = p10 ? (p10 - bar.close) / bar.close : 0;

      // 对每个触发的信号统计
      for (const sig of signals) {
        if (!bySignal[sig.type]) bySignal[sig.type] = initSig();
        const s = bySignal[sig.type];
        s.total++;
        if (sig.direction > 0) { // 买入信号 → 上涨为命中
          if (ret3d > 0.005) s.hit3d++;
          if (ret5d > 0.008) s.hit5d++;
          if (ret10d > 0.012) s.hit10d++;
        } else { // 卖出信号 → 下跌为命中
          if (ret3d < -0.005) s.hit3d++;
          if (ret5d < -0.008) s.hit5d++;
          if (ret10d < -0.012) s.hit10d++;
        }
        s.sumRet3d += ret3d;
        s.sumRet5d += ret5d;
        s.sumRet10d += ret10d;
      }
    }

    // 转换统计结果
    const result: SignalBacktestResult['bySignal'] = {};
    let totalSignals = 0, totalHit3d = 0, totalHit5d = 0, totalHit10d = 0;

    for (const [type, s] of Object.entries(bySignal)) {
      if (s.total < 3) continue; // 样本太少不统计
      result[type] = {
        total: s.total,
        hit3d: s.hit3d,
        hit5d: s.hit5d,
        hit10d: s.hit10d,
        avgReturn3d: Math.round((s.sumRet3d / s.total) * 10000) / 10000,
        avgReturn5d: Math.round((s.sumRet5d / s.total) * 10000) / 10000,
        avgReturn10d: Math.round((s.sumRet10d / s.total) * 10000) / 10000,
      };
      totalSignals += s.total;
      totalHit3d += s.hit3d;
      totalHit5d += s.hit5d;
      totalHit10d += s.hit10d;
    }

    return {
      hasData: totalSignals > 0,
      bySignal: result,
      overall: {
        totalSignals,
        hitRate3d: totalSignals > 0 ? Math.round((totalHit3d / totalSignals) * 10000) / 100 : 0,
        hitRate5d: totalSignals > 0 ? Math.round((totalHit5d / totalSignals) * 10000) / 100 : 0,
        hitRate10d: totalSignals > 0 ? Math.round((totalHit10d / totalSignals) * 10000) / 100 : 0,
      },
    };
  }

  /**
   * 在给定K线窗口上计算触发信号
   */
  private computeSignals(window: KlineBar[], current: KlineBar): { type: string; direction: number }[] {
    const signals: { type: string; direction: number }[] = [];
    if (!current.close) return signals;

    const prev = window.length > 1 ? window[window.length - 2] : null;

    // --- RSI ---
    if (current.rsi?.rsi6 != null) {
      if (current.rsi.rsi6 < 30) signals.push({ type: 'RSI超卖', direction: 1 });    // 买入
      if (current.rsi.rsi6 > 70) signals.push({ type: 'RSI超买', direction: -1 });   // 卖出
    }

    // --- MACD金叉/死叉 ---
    if (current.macd && prev?.macd) {
      const prevDif = prev.macd.dif ?? 0, prevDea = prev.macd.dea ?? 0;
      const curDif = current.macd.dif ?? 0, curDea = current.macd.dea ?? 0;
      // 金叉：DIF上穿DEA
      if (prevDif <= prevDea && curDif > curDea) signals.push({ type: 'MACD金叉', direction: 1 });
      // 死叉：DIF下穿DEA
      if (prevDif >= prevDea && curDif < curDea) signals.push({ type: 'MACD死叉', direction: -1 });
    }

    // --- KDJ金叉/死叉 ---
    if (current.kdj && prev?.kdj) {
      const pk = prev.kdj.k ?? 50, pd = prev.kdj.d ?? 50;
      const ck = current.kdj.k ?? 50, cd = current.kdj.d ?? 50;
      if (pk <= pd && ck > cd && ck < 40) signals.push({ type: 'KDJ金叉(低位)', direction: 1 });
      if (pk >= pd && ck < cd && ck > 60) signals.push({ type: 'KDJ死叉(高位)', direction: -1 });
    }

    // --- 布林带 ---
    if (current.boll && current.close) {
      const upper = current.boll.upper, lower = current.boll.lower;
      if (lower && current.close <= lower * 1.002) signals.push({ type: '布林下轨', direction: 1 });    // 触下轨买
      if (upper && current.close >= upper * 0.998) signals.push({ type: '布林上轨', direction: -1 });   // 触上轨卖
    }

    // --- 均线排列 ---
    if (current.ma) {
      const m5 = current.ma.ma5, m10 = current.ma.ma10, m20 = current.ma.ma20;
      if (m5 && m10 && m20 && m5 > m10 && m10 > m20) signals.push({ type: '多头排列', direction: 1 });
      if (m5 && m10 && m20 && m5 < m10 && m10 < m20) signals.push({ type: '空头排列', direction: -1 });
    }

    return signals;
  }
}
