/**
 * 风险管理服务 — VaR/CVaR/Kelly准则/仓位管理
 * 
 * 参考《量化交易：如何建立自己的算法交易事业》：
 * - 资金管理是量化交易最重要的一环
 * - Kelly公式：f* = (bp - q) / b
 * - VaR: 在险价值，衡量尾部风险
 * - 最大回撤限制: 单笔亏损不超过总资金1-2%
 */

export interface RiskMetrics {
  var95: number;            // 95%置信度VaR（日收益率）
  var99: number;            // 99%置信度VaR
  cvar95: number;           // 95% CVaR（条件VaR，尾部均值）
  dailyVolatility: number;  // 日波动率
  annualVolatility: number; // 年化波动率
  sharpeRatio: number;      // 夏普比率（假设无风险利率2%）
  calmarRatio: number;      // 卡玛比率（年化收益/最大回撤）
  maxDrawdown: number;      // 最大回撤(%)
  maxDrawdownDuration: number; // 最大回撤恢复天数
  kellyFraction: number;    // Kelly最优仓位比例
  halfKellyFraction: number; // 半Kelly（更保守）
  suggestedPosition: number; // 建议仓位(%)
  skewness: number;         // 偏度
  kurtosis: number;         // 峰度（肥尾效应）
  winRate: number;          // 胜率
  profitFactor: number;     // 盈亏比
  avgWin: number;           // 平均盈利
  avgLoss: number;          // 平均亏损
}

export class RiskManagementService {
  /**
   * 计算全套风险管理指标
   */
  calculate(prices: number[]): RiskMetrics {
    if (prices.length < 20) {
      return this.emptyMetrics();
    }

    // 日收益率序列
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] > 0) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
    }
    
    if (returns.length < 10) return this.emptyMetrics();

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const n = returns.length;
    const mean = returns.reduce((a, b) => a + b, 0) / n;
    const variance = returns.reduce((sq, r) => sq + Math.pow(r - mean, 2), 0) / (n - 1);
    const stdDev = Math.sqrt(variance);
    const dailyVol = stdDev || 0.01;

    // VaR (历史模拟法，非参数)
    const var95Idx = Math.max(0, Math.floor(n * 0.05));
    const var99Idx = Math.max(0, Math.floor(n * 0.01));
    const var95 = Math.abs(sortedReturns[var95Idx]) || dailyVol * 1.65;
    const var99 = Math.abs(sortedReturns[var99Idx]) || dailyVol * 2.33;

    // CVaR (尾部损失均值)
    const tail95 = sortedReturns.slice(0, var95Idx + 1);
    const cvar95 = tail95.length > 0 
      ? Math.abs(tail95.reduce((a, b) => a + b, 0) / tail95.length)
      : var95 * 1.2;

    // 年化
    const annualVol = dailyVol * Math.sqrt(252);
    const annualReturn = mean * 252;

    // 夏普比率 (无风险利率2%)
    const sharpeRatio = annualVol > 0 
      ? (annualReturn - 0.02) / annualVol 
      : 0;

    // 最大回撤
    const { maxDD, maxDDDuration } = this.calcMaxDrawdown(prices);

    // 卡玛比率
    const calmarRatio = maxDD > 0 ? (annualReturn - 0.02) / (maxDD / 100) : 0;

    // 胜率与盈亏比
    const wins = returns.filter(r => r > 0);
    const losses = returns.filter(r => r < 0);
    const winRate = n > 0 ? wins.length / n : 0;
    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * winRate) / (avgLoss * (1 - winRate)) : 1;

    // Kelly公式: f* = (bp - q) / b
    // b = 盈亏比(avgWin/avgLoss), p = 胜率, q = 1-p
    const b = avgLoss > 0 ? avgWin / avgLoss : 1;
    const p = winRate;
    const q = 1 - p;
    const kellyFraction = b > 0 ? Math.max(0, (b * p - q) / b) : 0;
    const halfKellyFraction = kellyFraction * 0.5;

    // 建议仓位：取半Kelly和单笔最大风险(2%)的较小值
    const suggestedPosition = Math.min(
      halfKellyFraction * 100,
      2.0  // 单笔最大亏损不超过总资金2%
    );

    // 偏度与峰度
    const skewness = this.calcSkewness(returns, mean, stdDev);
    const kurtosis = this.calcKurtosis(returns, mean, stdDev);

    return {
      var95: Math.round(var95 * 10000) / 100,
      var99: Math.round(var99 * 10000) / 100,
      cvar95: Math.round(cvar95 * 10000) / 100,
      dailyVolatility: Math.round(dailyVol * 10000) / 100,
      annualVolatility: Math.round(annualVol * 10000) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      calmarRatio: Math.round(calmarRatio * 100) / 100,
      maxDrawdown: Math.round(maxDD * 100) / 100,
      maxDrawdownDuration: maxDDDuration,
      kellyFraction: Math.round(kellyFraction * 10000) / 100,
      halfKellyFraction: Math.round(halfKellyFraction * 10000) / 100,
      suggestedPosition: Math.round(suggestedPosition * 100) / 100,
      skewness: Math.round(skewness * 100) / 100,
      kurtosis: Math.round(kurtosis * 100) / 100,
      winRate: Math.round(winRate * 10000) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      avgWin: Math.round(avgWin * 100000) / 100,
      avgLoss: Math.round(avgLoss * 100000) / 100,
    };
  }

  /**
   * 计算最大回撤及恢复天数
   */
  private calcMaxDrawdown(prices: number[]): { maxDD: number; maxDDDuration: number } {
    if (prices.length < 2) return { maxDD: 0, maxDDDuration: 0 };

    let peak = prices[0];
    let peakIdx = 0;
    let maxDD = 0;
    let maxDDIdx = 0;
    let recoveryIdx = 0;
    let maxDuration = 0;

    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > peak) {
        peak = prices[i];
        peakIdx = i;
      } else {
        const dd = (peak - prices[i]) / peak;
        if (dd > maxDD) {
          maxDD = dd;
          maxDDIdx = i;
        }
      }
    }

    // 从最大回撤点寻找恢复天数
    for (let i = maxDDIdx; i < prices.length; i++) {
      if (prices[i] >= peak) {
        recoveryIdx = i;
        break;
      }
    }
    maxDuration = recoveryIdx > maxDDIdx ? recoveryIdx - maxDDIdx : prices.length - maxDDIdx;

    return { maxDD, maxDDDuration: maxDuration };
  }

  private calcSkewness(returns: number[], mean: number, stdDev: number): number {
    if (stdDev === 0 || returns.length < 3) return 0;
    const n = returns.length;
    const m3 = returns.reduce((sum, r) => sum + Math.pow(r - mean, 3), 0) / n;
    return m3 / Math.pow(stdDev, 3);
  }

  private calcKurtosis(returns: number[], mean: number, stdDev: number): number {
    if (stdDev === 0 || returns.length < 3) return 0;
    const n = returns.length;
    const m4 = returns.reduce((sum, r) => sum + Math.pow(r - mean, 4), 0) / n;
    return m4 / Math.pow(stdDev, 4) - 3; // 超额峰度
  }

  private emptyMetrics(): RiskMetrics {
    return {
      var95: 0, var99: 0, cvar95: 0,
      dailyVolatility: 0, annualVolatility: 0,
      sharpeRatio: 0, calmarRatio: 0,
      maxDrawdown: 0, maxDrawdownDuration: 0,
      kellyFraction: 0, halfKellyFraction: 0, suggestedPosition: 0,
      skewness: 0, kurtosis: 0,
      winRate: 0, profitFactor: 0,
      avgWin: 0, avgLoss: 0,
    };
  }
}
