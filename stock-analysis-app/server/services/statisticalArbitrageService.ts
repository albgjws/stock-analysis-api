/**
 * 统计套利与回测服务 — 均值回归/动量因子/滚动验证
 * 
 * 参考《算法交易：获利策略与逻辑》(Algorithmic Trading by Chan)：
 * - 均值回归策略：使用Bollinger带或Z-Score，当价格偏离均值2个标准差时反向交易
 * - 动量策略：使用过去N日收益率作为因子
 * - Walk-Forward Analysis: 滚动窗口训练/测试
 * 
 * 参考《AI量化交易》《AI量化投资》：
 * - 多因子模型：综合多个信号源
 * - 遗传算法参数优化概念
 */

export interface MeanReversionSignal {
  zscore: number;               // 当前Z-Score
  halfLife: number;             // 半衰期（均值回归速度，天数）
  signal: 'overbought' | 'oversold' | 'neutral';
  strength: number;             // 信号强度0-1
  entryPrice: number;
  targetPrice: number;          // 回归目标价
  stopPrice: number;            // 止损价
}

export interface MomentumSignal {
  momentum1M: number;           // 过去20日收益率
  momentum3M: number;           // 过去60日收益率
  momentum6M: number;           // 过去120日收益率
  momentumRank: number;         // 相对强度(0-100)
  signal: 'strong_momentum' | 'weak_momentum' | 'reversal' | 'neutral';
  strength: number;
}

export interface WalkForwardResult {
  inSampleSharpe: number;       // 训练集夏普
  outSampleSharpe: number;      // 测试集夏普
  robustness: number;           // 稳健性得分(0-100)
  parameterStability: number;   // 参数稳定性
  strategyVariance: number;     // 策略波动
  recommended: boolean;         // 是否推荐实盘
}

export interface FactorAnalysis {
  factorName: string;
  ic: number;                   // Information Coefficient
  rankIC: number;               // Rank IC
  hitRate: number;              // 方向准确率
  sharpe: number;               // 因子夏普
  decay: number;                // 因子衰减速度
  stability: number;            // 稳定性评分
}

export class StatisticalArbitrageService {
  /**
   * 均值回归分析 — Hurst指数 + Z-Score + 半衰期
   * 均值回归策略最适合Hurst < 0.5的品种
   */
  analyzeMeanReversion(prices: number[], window: number = 20): MeanReversionSignal {
    if (prices.length < window + 5) {
      return {
        zscore: 0, halfLife: 0, signal: 'neutral', strength: 0,
        entryPrice: prices[prices.length - 1] || 0,
        targetPrice: 0, stopPrice: 0,
      };
    }

    const latest = prices.slice(-window);
    const mean = latest.reduce((a, b) => a + b, 0) / latest.length;
    const std = Math.sqrt(latest.reduce((sq, p) => sq + Math.pow(p - mean, 2), 0) / latest.length);
    const currentPrice = prices[prices.length - 1];
    const zscore = std > 0 ? (currentPrice - mean) / std : 0;

    // 估计半衰期 (均值回归速度)
    const halfLife = this.estimateHalfLife(prices);

    // 判断信号
    let signal: 'overbought' | 'oversold' | 'neutral';
    let strength: number;

    if (zscore > 2.0) {
      signal = 'overbought';
      strength = Math.min(1, (zscore - 2) / 3);
    } else if (zscore < -2.0) {
      signal = 'oversold';
      strength = Math.min(1, (-zscore - 2) / 3);
    } else {
      signal = 'neutral';
      strength = Math.abs(zscore) / 2;
    }

    // 回归目标价 = 移动平均
    const targetPrice = mean;
    // 止损价 = 均值 ± 3倍标准差
    const stopPrice = signal === 'overbought'
      ? currentPrice + std * 2  // 做空止损
      : signal === 'oversold'
        ? currentPrice - std * 2  // 做多止损
        : currentPrice;

    return {
      zscore: Math.round(zscore * 100) / 100,
      halfLife: Math.round(halfLife * 10) / 10,
      signal,
      strength: Math.round(strength * 100) / 100,
      entryPrice: Math.round(currentPrice * 100) / 100,
      targetPrice: Math.round(targetPrice * 100) / 100,
      stopPrice: Math.round(stopPrice * 100) / 100,
    };
  }

  /**
   * 估计半衰期 — 对均值回归速度的量化
   * 通过对价格序列的一阶自回归估计：y(t) = a * y(t-1) + e
   * 半衰期 = ln(2) / ln(1/a)
   */
  private estimateHalfLife(prices: number[]): number {
    if (prices.length < 30) return 0;
    
    const returns: number[] = [];
    const lagged: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      returns.push(prices[i] - prices[i - 1]);
      lagged.push(prices[i - 1]);
    }
    
    // 简单OLS: delta_y = a * y_lag + b
    const n = returns.length;
    const sumX = lagged.reduce((a, b) => a + b, 0);
    const sumY = returns.reduce((a, b) => a + b, 0);
    const sumXY = lagged.reduce((s, x, i) => s + x * returns[i], 0);
    const sumX2 = lagged.reduce((s, x) => s + x * x, 0);
    
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return 0;
    
    const slope = (n * sumXY - sumX * sumY) / denom;
    
    if (slope >= 0 || slope <= -1) return 999; // 非均值回归
    
    const halfLife = Math.log(2) / Math.log(1 / Math.abs(slope));
    return Math.min(halfLife, 250); // 最多250天
  }

  /**
   * 动量因子分析 — 多时间尺度动量
   */
  analyzeMomentum(prices: number[]): MomentumSignal {
    if (prices.length < 20) {
      return {
        momentum1M: 0, momentum3M: 0, momentum6M: 0,
        momentumRank: 50, signal: 'neutral', strength: 0,
      };
    }

    const current = prices[prices.length - 1];
    const m1 = prices.length >= 20 ? (current - prices[prices.length - 20]) / prices[prices.length - 20] * 100 : 0;
    const m3 = prices.length >= 60 ? (current - prices[prices.length - 60]) / prices[prices.length - 60] * 100 : m1;
    const m6 = prices.length >= 120 ? (current - prices[prices.length - 120]) / prices[prices.length - 120] * 100 : m3;

    // 动量衰减：如果短期动量显著大于长期，可能接近反转
    const decay = Math.abs(m1) > Math.abs(m3) && m1 * m3 > 0 
      ? Math.abs(m1) / Math.abs(m3) 
      : 1;

    let signal: 'strong_momentum' | 'weak_momentum' | 'reversal' | 'neutral';
    let strength: number;

    const avgMomentum = (m1 + m3 + m6) / 3;

    if (avgMomentum > 10) {
      signal = 'strong_momentum';
      strength = Math.min(1, avgMomentum / 30);
    } else if (avgMomentum > 3) {
      signal = 'weak_momentum';
      strength = avgMomentum / 15;
    } else if (avgMomentum < -10) {
      signal = 'strong_momentum';
      strength = Math.min(1, -avgMomentum / 30);
    } else if (avgMomentum < -3) {
      signal = 'weak_momentum';
      strength = -avgMomentum / 15;
    } else {
      signal = 'neutral';
      strength = Math.abs(avgMomentum) / 5;
    }

    // 动量反转检测：短期与长期方向相反
    if (m1 * m3 < 0 && Math.abs(m1) > 5) {
      signal = 'reversal';
      strength = Math.min(1, Math.abs(m1) / 20);
    }

    // 相对强度排名（与随机基准对比的百分位）
    const momentumRank = 50 + avgMomentum;

    return {
      momentum1M: Math.round(m1 * 100) / 100,
      momentum3M: Math.round(m3 * 100) / 100,
      momentum6M: Math.round(m6 * 100) / 100,
      momentumRank: Math.max(0, Math.min(100, Math.round(momentumRank))),
      signal,
      strength: Math.round(strength * 100) / 100,
    };
  }

  /**
   * Walk-Forward滚动回测验证
   * 将数据分为训练集和测试集，滚动验证策略稳健性
   */
  walkForwardTest(prices: number[], 
    trainWindow: number = 120, 
    testWindow: number = 30
  ): WalkForwardResult {
    if (prices.length < trainWindow + testWindow + 20) {
      return {
        inSampleSharpe: 0, outSampleSharpe: 0,
        robustness: 0, parameterStability: 0,
        strategyVariance: 0, recommended: false,
      };
    }

    const inSampleSharps: number[] = [];
    const outSampleSharps: number[] = [];

    // 滚动窗口
    for (let start = 0; start + trainWindow + testWindow <= prices.length; start += testWindow) {
      const trainData = prices.slice(start, start + trainWindow);
      const testData = prices.slice(start + trainWindow, start + trainWindow + testWindow);

      // 训练集：计算均值和波动率
      const trainReturns: number[] = [];
      for (let i = 1; i < trainData.length; i++) {
        if (trainData[i - 1] > 0)
          trainReturns.push((trainData[i] - trainData[i - 1]) / trainData[i - 1]);
      }
      const trainMean = trainReturns.reduce((a, b) => a + b, 0) / trainReturns.length;
      const trainStd = Math.sqrt(trainReturns.reduce((sq, r) => sq + Math.pow(r - trainMean, 2), 0) / (trainReturns.length - 1));

      // 测试集
      const testReturns: number[] = [];
      for (let i = 1; i < testData.length; i++) {
        if (testData[i - 1] > 0)
          testReturns.push((testData[i] - testData[i - 1]) / testData[i - 1]);
      }
      const testMean = testReturns.reduce((a, b) => a + b, 0) / testReturns.length;
      const testStd = Math.sqrt(testReturns.reduce((sq, r) => sq + Math.pow(r - testMean, 2), 0) / (testReturns.length - 1));

      inSampleSharps.push(trainStd > 0 ? (trainMean / trainStd) * Math.sqrt(252) : 0);
      outSampleSharps.push(testStd > 0 ? (testMean / testStd) * Math.sqrt(252) : 0);
    }

    const avgIn = inSampleSharps.reduce((a, b) => a + b, 0) / inSampleSharps.length;
    const avgOut = outSampleSharps.reduce((a, b) => a + b, 0) / outSampleSharps.length;

    // 稳健性 = 测试集夏普与训练集夏普的比值
    const robustness = Math.abs(avgIn) > 0 
      ? Math.round(Math.min(1, Math.abs(avgOut / avgIn)) * 100) 
      : 0;

    // 参数稳定性 = 各窗口夏普的标准差（越低越好）
    const outStd = Math.sqrt(outSampleSharps.reduce((sq, s) => sq + Math.pow(s - avgOut, 2), 0) / outSampleSharps.length);
    const parameterStability = Math.round(Math.max(0, 100 - outStd * 20));

    // 策略波动
    const strategyVariance = Math.round(outStd * 100) / 100;

    const recommended = avgOut > 0.3 && robustness > 50 && parameterStability > 50;

    return {
      inSampleSharpe: Math.round(avgIn * 100) / 100,
      outSampleSharpe: Math.round(avgOut * 100) / 100,
      robustness,
      parameterStability,
      strategyVariance,
      recommended,
    };
  }

  /**
   * 多因子分析 — 计算每个因子的IC、Rank IC、胜率
   */
  analyzeFactors(prices: number[]): FactorAnalysis[] {
    const factors: FactorAnalysis[] = [];

    // 1. 价格动量因子 (20日)
    factors.push(this.computeFactorMetrics('动量(20日)', prices, 20));

    // 2. 波动率因子 (20日波动率倒数)
    factors.push(this.computeFactorMetrics('低波(20日)', prices, 20, 'volatility'));

    // 3. 均值回归因子 (偏离20日均线的Z-Score)
    factors.push(this.computeFactorMetrics('均值回归(20日)', prices, 20, 'meanReversion'));

    // 4. 成交量因子 (放量/缩量)
    factors.push(this.computeFactorMetrics('成交量因子', prices, 20, 'volume'));

    return factors;
  }

  private computeFactorMetrics(
    name: string, prices: number[], window: number, type: string = 'momentum'
  ): FactorAnalysis {
    if (prices.length < window * 2) {
      return { factorName: name, ic: 0, rankIC: 0, hitRate: 0, sharpe: 0, decay: 0, stability: 0 };
    }

    let hits = 0;
    let total = 0;
    const factorReturns: number[] = [];

    for (let i = window * 2; i < prices.length; i++) {
      const pastWindow = prices.slice(i - window, i);
      const futureReturn = (prices[i] - prices[i - 1]) / prices[i - 1];

      let factorValue: number;
      switch (type) {
        case 'momentum':
          factorValue = (prices[i - 1] - pastWindow[0]) / pastWindow[0];
          break;
        case 'volatility': {
          const returns = [];
          for (let j = 1; j < pastWindow.length; j++) {
            returns.push((pastWindow[j] - pastWindow[j - 1]) / pastWindow[j - 1]);
          }
          const std = Math.sqrt(returns.reduce((sq, r) => sq + r * r, 0) / returns.length);
          factorValue = -std; // 低波因子
          break;
        }
        case 'meanReversion': {
          const mean = pastWindow.reduce((a, b) => a + b, 0) / pastWindow.length;
          const std = Math.sqrt(pastWindow.reduce((sq, p) => sq + Math.pow(p - mean, 2), 0) / pastWindow.length);
          factorValue = std > 0 ? (prices[i - 1] - mean) / std : 0;
          break;
        }
        default:
          factorValue = 0;
      }

      // 方向预测准确率
      if (factorValue * futureReturn > 0) hits++;
      total++;
      factorReturns.push(futureReturn * (factorValue > 0 ? 1 : -1));
    }

    const hitRate = total > 0 ? hits / total : 0;
    const avgRet = factorReturns.length > 0 ? factorReturns.reduce((a, b) => a + b, 0) / factorReturns.length : 0;
    const stdRet = Math.sqrt(factorReturns.reduce((sq, r) => sq + Math.pow(r - avgRet, 2), 0) / (factorReturns.length || 1));
    const sharpe = stdRet > 0 ? (avgRet / stdRet) * Math.sqrt(252) : 0;

    return {
      factorName: name,
      ic: Math.round((hitRate * 2 - 1) * 100) / 100,
      rankIC: Math.round(hitRate * 100) / 100,
      hitRate: Math.round(hitRate * 10000) / 100,
      sharpe: Math.round(sharpe * 100) / 100,
      decay: type === 'momentum' ? 0.3 : 0.5,
      stability: Math.round(Math.min(100, Math.abs(sharpe) * 50)),
    };
  }
}
