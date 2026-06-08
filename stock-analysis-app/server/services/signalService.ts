import type { KlineBar, SignalDetail, SignalResult, StopLevel } from '../types';

export class SignalService {
  /**
   * Generate buy/sell signals based on technical indicators
   * Uses a weighted voting system combining multiple indicators
   */
  generateSignals(klineData: KlineBar[]): SignalResult {
    if (!klineData || klineData.length < 20) {
      return {
        overall: 'HOLD',
        strength: 0,
        details: [],
        support: 0,
        resistance: 0,
        stopLoss: { price: 0, percent: 0, reason: '数据不足' },
        takeProfit: { price: 0, percent: 0, reason: '数据不足' },
      };
    }

    const details: SignalDetail[] = [];
    let totalScore = 0;

    // Get latest bars for analysis
    const latest = klineData[klineData.length - 1];
    const prev = klineData.length > 1 ? klineData[klineData.length - 2] : null;
    const currentPrice = latest.close;

    // 1. RSI Signal
    const rsiSignal = this.analyzeRSI(latest);
    if (rsiSignal) {
      details.push(rsiSignal);
      totalScore += rsiSignal.score;
    }

    // 2. MACD Signal
    const macdSignal = this.analyzeMACD(latest, prev, klineData);
    if (macdSignal) {
      details.push(macdSignal);
      totalScore += macdSignal.score;
    }

    // 3. Bollinger Bands Signal
    const bollSignal = this.analyzeBollinger(latest);
    if (bollSignal) {
      details.push(bollSignal);
      totalScore += bollSignal.score;
    }

    // 4. MA Trend Signal
    const maSignal = this.analyzeMATrend(latest);
    if (maSignal) {
      details.push(maSignal);
      totalScore += maSignal.score;
    }

    // 5. KDJ Signal
    const kdjSignal = this.analyzeKDJ(latest, prev);
    if (kdjSignal) {
      details.push(kdjSignal);
      totalScore += kdjSignal.score;
    }

    // 6. Volume Signal
    const volumeSignal = this.analyzeVolume(latest, klineData);
    if (volumeSignal) {
      details.push(volumeSignal);
      totalScore += volumeSignal.score;
    }

    // Calculate key levels
    const { support, resistance } = this.calculateKeyLevels(klineData);

    // Calculate stop-loss and take-profit
    const stopLoss = this.calcStopLoss(klineData, currentPrice, support, totalScore);
    const takeProfit = this.calcTakeProfit(klineData, currentPrice, resistance, stopLoss, totalScore);

    // Determine overall signal
    const overall = this.determineOverall(totalScore);

    return {
      overall,
      strength: Math.round(totalScore * 10) / 10,
      details,
      support: Math.round(support * 100) / 100,
      resistance: Math.round(resistance * 100) / 100,
      stopLoss,
      takeProfit,
    };
  }

  /**
   * 计算止损价
   * 策略：取最近20日最低价、MA60支撑、当前价*0.93 三者的最大值作为止损底线
   * 如果信号偏多则宽松些，偏空则收紧
   */
  private calcStopLoss(
    klineData: KlineBar[],
    price: number,
    support: number,
    score: number,
  ): StopLevel {
    const recent = klineData.slice(-20);
    const swingLow = Math.min(...recent.map(b => b.low));

    // MA20/MA60 support
    const last = klineData[klineData.length - 1];
    const maSupport = Math.min(
      last.ma?.ma20 ?? price,
      last.ma?.ma60 ?? price,
    );

    // 固定百分比止损底线（根据信号强度调整）
    // 买入信号强 → 宽松止损（给更多波动空间）
    // 卖出信号强 → 收紧止损（尽快离场）
    const isBullish = score >= 0;
    const baseStopPercent = isBullish ? 0.93 : 0.97;  // 偏多允许跌7%，偏空只允许跌3%
    const fixedStop = price * baseStopPercent;

    // 取三者中最高的（最保守的止损位）
    let stopPrice = Math.max(swingLow * 0.995, maSupport * 0.99, fixedStop);

    // 止损不能太接近现价（避免被噪音触发），也不能太远
    const minDistance = price * 0.02;   // 至少离现价2%
    const maxDistance = price * 0.10;   // 最多离现价10%
    const actualDistance = price - stopPrice;

    if (actualDistance < minDistance) {
      stopPrice = price - minDistance;
    } else if (actualDistance > maxDistance) {
      stopPrice = price - maxDistance;
    }

    const percent = ((stopPrice - price) / price * 100);

    // 确定理由 — 三选一：最低价支撑 / 均线支撑 / 固定比例
    const candidates: { price: number; label: string }[] = [
      { price: Math.round(swingLow * 0.995 * 100) / 100, label: `跌破近期低点 ${swingLow.toFixed(2)}` },
      { price: Math.round(maSupport * 0.99 * 100) / 100, label: `跌破均线支撑 ${maSupport.toFixed(2)}` },
      { price: Math.round(fixedStop * 100) / 100, label: `固定止损 ${(baseStopPercent * 100 - 100).toFixed(0)}%` },
    ];
    const closest = candidates.reduce((a, b) =>
      Math.abs(a.price - stopPrice) < Math.abs(b.price - stopPrice) ? a : b
    );
    const reason = closest.label;

    return {
      price: Math.round(stopPrice * 100) / 100,
      percent: Math.round(percent * 100) / 100,
      reason,
    };
  }

  /**
   * 计算止盈价
   * 策略：取近期高点、布林上轨、固定盈亏比三者综合
   * 风险回报比至少 1:2（亏1赚2）
   */
  private calcTakeProfit(
    klineData: KlineBar[],
    price: number,
    resistance: number,
    stopLoss: StopLevel,
    score: number,
  ): StopLevel {
    const recent = klineData.slice(-20);
    const swingHigh = Math.max(...recent.map(b => b.high));

    // 布林带上轨阻力
    const last = klineData[klineData.length - 1];
    const bollUpper = last.boll?.upper ?? resistance;

    // 基于风险回报比的目标价（至少1:2）
    const riskAmount = price - stopLoss.price;
    const rewardRatio = score >= 0 ? 2.5 : 1.5;  // 偏多时要求更高回报
    const rrTarget = price + riskAmount * rewardRatio;

    // 取三者中最低的（最保守的止盈位）
    let tpPrice = Math.min(swingHigh * 1.01, bollUpper * 0.99, rrTarget);

    // 止盈不能太接近现价
    const minTarget = price * 1.03; // 至少涨3%
    if (tpPrice < minTarget) {
      tpPrice = minTarget;
    }

    const percent = ((tpPrice - price) / price * 100);

    // 确定理由
    let reason: string;
    const candidates: { price: number; label: string }[] = [
      { price: Math.round(swingHigh * 1.01 * 100) / 100, label: `近期高点 ${swingHigh.toFixed(2)}` },
      { price: Math.round(bollUpper * 0.99 * 100) / 100, label: `布林上轨 ${bollUpper.toFixed(2)}` },
      { price: Math.round(rrTarget * 100) / 100, label: `盈亏比 ${rewardRatio.toFixed(1)}:1` },
    ];

    // 找到最接近实际止盈价的理由
    const closest = candidates.reduce((prev, curr) =>
      Math.abs(curr.price - tpPrice) < Math.abs(prev.price - tpPrice) ? curr : prev
    );
    reason = closest.label;

    return {
      price: Math.round(tpPrice * 100) / 100,
      percent: Math.round(percent * 100) / 100,
      reason,
    };
  }

  private analyzeRSI(bar: KlineBar): SignalDetail | null {
    if (!bar.rsi) return null;

    // rsi6 (short-term) is most responsive for signals
    const rsiValue = bar.rsi.rsi6 ?? bar.rsi.rsi12 ?? bar.rsi.rsi24;
    if (rsiValue == null) return null;

    if (rsiValue < 30) {
      return {
        indicator: 'RSI',
        signal: 'BUY',
        score: 2,
        description: `RSI ${rsiValue.toFixed(1)} < 30，超卖区域，反弹概率较大`,
      };
    }
    if (rsiValue < 40) {
      return {
        indicator: 'RSI',
        signal: 'BUY',
        score: 1,
        description: `RSI ${rsiValue.toFixed(1)} 接近超卖区域`,
      };
    }
    if (rsiValue > 70) {
      return {
        indicator: 'RSI',
        signal: 'SELL',
        score: -2,
        description: `RSI ${rsiValue.toFixed(1)} > 70，超买区域，回调风险较大`,
      };
    }
    if (rsiValue > 60) {
      return {
        indicator: 'RSI',
        signal: 'SELL',
        score: -1,
        description: `RSI ${rsiValue.toFixed(1)} 接近超买区域`,
      };
    }

    return {
      indicator: 'RSI',
      signal: 'NEUTRAL',
      score: 0,
      description: `RSI ${rsiValue.toFixed(1)}，处于中性区间`,
    };
  }

  private analyzeMACD(bar: KlineBar, prev: KlineBar | null, allData: KlineBar[]): SignalDetail | null {
    if (!bar.macd) return null;

    const { dif, dea, macd } = bar.macd;

    if (dif == null || dea == null) return null;

    // Check if MACD histogram just turned positive or negative
    const prevMacd = prev?.macd;

    // Golden cross (DIF crosses above DEA)
    if (prevMacd && prevMacd.dif != null && prevMacd.dea != null) {
      if (dif > dea && prevMacd.dif <= prevMacd.dea) {
        return {
          indicator: 'MACD',
          signal: 'BUY',
          score: 1.5,
          description: `DIF (${dif.toFixed(2)}) 上穿 DEA (${dea.toFixed(2)})，金叉信号`,
        };
      }
      // Death cross (DIF crosses below DEA)
      if (dif < dea && prevMacd.dif >= prevMacd.dea) {
        return {
          indicator: 'MACD',
          signal: 'SELL',
          score: -1.5,
          description: `DIF (${dif.toFixed(2)}) 下穿 DEA (${dea.toFixed(2)})，死叉信号`,
        };
      }
    }

    // MACD histogram direction
    if (macd != null) {
      if (macd > 0 && dif > dea) {
        return {
          indicator: 'MACD',
          signal: 'BUY',
          score: 0.5,
          description: `DIF (${dif.toFixed(2)}) > DEA (${dea.toFixed(2)})，多头排列`,
        };
      }
      if (macd < 0 && dif < dea) {
        return {
          indicator: 'MACD',
          signal: 'SELL',
          score: -0.5,
          description: `DIF (${dif.toFixed(2)}) < DEA (${dea.toFixed(2)})，空头排列`,
        };
      }
    }

    return {
      indicator: 'MACD',
      signal: 'NEUTRAL',
      score: 0,
      description: `DIF (${dif.toFixed(2)}) / DEA (${dea.toFixed(2)})，无交叉信号`,
    };
  }

  private analyzeBollinger(bar: KlineBar): SignalDetail | null {
    if (!bar.boll || !bar.boll.upper || !bar.boll.lower || !bar.boll.mid) return null;

    const { close } = bar;
    const { upper, lower, mid } = bar.boll;

    // Price touches or breaks lower band — oversold
    if (close <= lower) {
      return {
        indicator: '布林带',
        signal: 'BUY',
        score: 1.5,
        description: `价格 (${close.toFixed(2)}) 触及下轨 (${lower.toFixed(2)})，超卖反弹信号`,
      };
    }

    // Price near lower band (within 1%)
    if (close <= lower * 1.01) {
      return {
        indicator: '布林带',
        signal: 'BUY',
        score: 1,
        description: `价格 (${close.toFixed(2)}) 接近下轨 (${lower.toFixed(2)})`,
      };
    }

    // Price touches or breaks upper band — overbought
    if (close >= upper) {
      return {
        indicator: '布林带',
        signal: 'SELL',
        score: -1.5,
        description: `价格 (${close.toFixed(2)}) 触及上轨 (${upper.toFixed(2)})，超买回调信号`,
      };
    }

    // Price near upper band (within 1%)
    if (close >= upper * 0.99) {
      return {
        indicator: '布林带',
        signal: 'SELL',
        score: -1,
        description: `价格 (${close.toFixed(2)}) 接近上轨 (${upper.toFixed(2)})`,
      };
    }

    // Price near middle band — neutral
    if (Math.abs(close - mid) / mid < 0.01) {
      return {
        indicator: '布林带',
        signal: 'NEUTRAL',
        score: 0,
        description: `价格在中轨附近，方向不明`,
      };
    }

    return null; // Skip weak signals
  }

  private analyzeMATrend(bar: KlineBar): SignalDetail | null {
    if (!bar.ma) return null;

    const { ma5, ma10, ma20, ma60 } = bar.ma;

    if (ma5 == null || ma10 == null) return null;

    // Bullish alignment: price > ma5 > ma10 > ma20
    const bullish = ma5 > ma10 && (ma20 == null || ma10 > ma20) && (ma60 == null || ma20! > ma60);
    // Bearish alignment: price < ma5 < ma10 < ma20
    const bearish = ma5 < ma10 && (ma20 == null || ma10 < ma20) && (ma60 == null || ma20! < ma60);

    if (bullish) {
      return {
        indicator: '均线趋势',
        signal: 'BUY',
        score: 1,
        description: `多头排列: MA5 (${ma5.toFixed(2)}) > MA10 (${(ma10 || 0).toFixed(2)})`,
      };
    }

    if (bearish) {
      return {
        indicator: '均线趋势',
        signal: 'SELL',
        score: -1,
        description: `空头排列: MA5 (${ma5.toFixed(2)}) < MA10 (${(ma10 || 0).toFixed(2)})`,
      };
    }

    // Check for MA crossovers
    if (ma5 > ma10) {
      return {
        indicator: '均线趋势',
        signal: 'BUY',
        score: 0.5,
        description: `MA5 (${ma5.toFixed(2)}) > MA10 (${(ma10 || 0).toFixed(2)})，短期偏多`,
      };
    }

    if (ma5 < ma10) {
      return {
        indicator: '均线趋势',
        signal: 'SELL',
        score: -0.5,
        description: `MA5 (${ma5.toFixed(2)}) < MA10 (${(ma10 || 0).toFixed(2)})，短期偏空`,
      };
    }

    return null;
  }

  private analyzeKDJ(bar: KlineBar, prev: KlineBar | null): SignalDetail | null {
    if (!bar.kdj) return null;

    const { k, d, j } = bar.kdj;
    if (k == null || d == null) return null;

    // KDJ golden cross at low position
    if (k > d && prev?.kdj != null && prev.kdj.k <= prev.kdj.d && k < 40) {
      return {
        indicator: 'KDJ',
        signal: 'BUY',
        score: 1,
        description: `K (${k.toFixed(1)}) 上穿 D (${d.toFixed(1)})，低位金叉`,
      };
    }

    // KDJ death cross at high position
    if (k < d && prev?.kdj != null && prev.kdj.k >= prev.kdj.d && k > 60) {
      return {
        indicator: 'KDJ',
        signal: 'SELL',
        score: -1,
        description: `K (${k.toFixed(1)}) 下穿 D (${d.toFixed(1)})，高位死叉`,
      };
    }

    // J value extremes
    if (j != null) {
      if (j < 0) {
        return {
          indicator: 'KDJ',
          signal: 'BUY',
          score: 1,
          description: `J值 ${j.toFixed(1)} < 0，超卖`,
        };
      }
      if (j > 100) {
        return {
          indicator: 'KDJ',
          signal: 'SELL',
          score: -1,
          description: `J值 ${j.toFixed(1)} > 100，超买`,
        };
      }
    }

    return {
      indicator: 'KDJ',
      signal: 'NEUTRAL',
      score: 0,
      description: `K:${k.toFixed(1)} D:${d.toFixed(1)} J:${(j || 0).toFixed(1)}`,
    };
  }

  private analyzeVolume(bar: KlineBar, allData: KlineBar[]): SignalDetail | null {
    // Calculate average volume of last 20 days (excluding current)
    const recentBars = allData.slice(-21, -1);
    if (recentBars.length < 5) return null;

    const avgVolume = recentBars.reduce((sum, b) => sum + b.volume, 0) / recentBars.length;
    const volumeRatio = bar.volume / avgVolume;

    // Significant volume increase with price up
    if (volumeRatio > 1.5 && bar.changePercent != null && bar.changePercent > 0) {
      return {
        indicator: '成交量',
        signal: 'BUY',
        score: 0.5,
        description: `成交量 ${(volumeRatio).toFixed(1)}倍于均量，价涨量增`,
      };
    }

    // Significant volume increase with price down
    if (volumeRatio > 1.5 && bar.changePercent != null && bar.changePercent < 0) {
      return {
        indicator: '成交量',
        signal: 'SELL',
        score: -0.5,
        description: `成交量 ${(volumeRatio).toFixed(1)}倍于均量，价跌量增`,
      };
    }

    // Volume contraction
    if (volumeRatio < 0.5) {
      return {
        indicator: '成交量',
        signal: 'NEUTRAL',
        score: 0,
        description: `成交量萎缩，市场观望情绪浓厚`,
      };
    }

    return null;
  }

  private calculateKeyLevels(klineData: KlineBar[]): { support: number; resistance: number } {
    const last = klineData[klineData.length - 1];
    const price = last.close;

    // 使用最近20根K线，更贴近当前价格
    const recent = klineData.slice(-20);
    const lows = recent.map(b => b.low);
    const highs = recent.map(b => b.high);

    const minLow = Math.min(...lows);
    const maxHigh = Math.max(...highs);

    // 平均波动幅度
    const avgRange = recent.reduce((s, b) => s + (b.high - b.low), 0) / recent.length;

    // 布林带参考
    const bollLower = last.boll?.lower ?? price * 0.9;
    const bollUpper = last.boll?.upper ?? price * 1.1;

    // 支撑位 = 近期最低价、布林下轨、现价*0.93 三者取最高，再限制范围
    let support = Math.max(minLow, bollLower, price * 0.93);
    support = Math.max(support, price * 0.90);  // 最多跌10%
    support = Math.min(support, price * 0.97);  // 至少跌3%

    // 阻力位 = 近期最高价、布林上轨、现价*1.07 三者取最低，再限制范围
    let resistance = Math.min(maxHigh, bollUpper, price * 1.07);
    resistance = Math.min(resistance, price * 1.10);  // 最多涨10%
    resistance = Math.max(resistance, price * 1.03);  // 至少涨3%

    return {
      support: Math.round(support * 100) / 100,
      resistance: Math.round(resistance * 100) / 100,
    };
  }

  private determineOverall(score: number): SignalResult['overall'] {
    if (score >= 5) return 'STRONG_BUY';
    if (score >= 2) return 'BUY';
    if (score <= -5) return 'STRONG_SELL';
    if (score <= -2) return 'SELL';
    return 'HOLD';
  }
}
