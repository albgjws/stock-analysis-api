/**
 * 市场微观结构服务 — 订单簿/价差/VWAP/流动性分析
 * 
 * 参考《交易与交易所》(Trading and Exchanges)：
 * - 订单簿失衡(Order Book Imbalance)是短期价格预测最强信号之一
 * - 买卖价差(Bid-Ask Spread)反映流动性成本和市场质量
 * - VWAP是机构交易的核心基准
 * - 流动性冲击成本直接影响收益率
 */

export interface MicrostructureMetrics {
  averageSpread: number;       // 平均买卖价差(百分比)
  spreadVolatility: number;    // 价差波动率
  vwap: number;                // 成交量加权平均价
  vwapDeviation: number;       // 当前价偏离VWAP(%)
  orderImbalance: number;      // 订单簿失衡(-1 ~ 1, 正=买方强势)
  liquidityScore: number;      // 流动性评分(0-100)
  amihudIlliquidity: number;   // Amihud非流动性指标(越高越不流动)
  turnoverRate: number;        // 换手率(%)
  volumeProfile: string;       // 成交量分布特征
  marketImpact: number;        // 估算市场冲击成本(%)
  bidAskBounce: number;        // 买卖价差反弹强度
}

export interface IntradayMetrics {
  time: string;
  price: number;
  vwap: number;
  volume: number;
  cumulativeVolume: number;
  orderImbalance: number;
  spread: number;
}

export class MarketMicrostructureService {
  /**
   * 计算全套市场微观结构指标
   */
  calculate(
    kline: any[],
    intradayData?: any[],
    bid?: number,
    ask?: number,
    buy1Vol?: number,
    sell1Vol?: number,
  ): MicrostructureMetrics {
    if (!kline || kline.length < 2) {
      return this.emptyMetrics();
    }

    const last = kline[kline.length - 1];
    const prices = kline.map(b => b.close).filter((p: any): p is number => p != null && p > 0);
    const volumes = kline.map(b => b.volume).filter((v: any): v is number => v != null && v > 0);

    // VWAP: 用日线近似（真实VWAP需要分时数据）
    const vwap = this.calcVWAP(kline, intradayData);

    // 当前价偏离VWAP
    const currentPrice = last?.close || prices[prices.length - 1];
    const vwapDeviation = vwap > 0 ? ((currentPrice - vwap) / vwap) * 100 : 0;

    // 订单簿失衡
    const orderImbalance = this.calcOrderImbalance(buy1Vol, sell1Vol);

    // 买卖价差
    const { averageSpread, spreadVolatility } = this.calcSpreadStats(kline, bid, ask);

    // Amihud非流动性指标
    const amihudIlliquidity = this.calcAmihudIlliquidity(kline);

    // 换手率
    const turnoverRate = last?.turnoverRate || 0;

    // 流动性评分
    const liquidityScore = this.calcLiquidityScore(kline, amihudIlliquidity, averageSpread, turnoverRate);

    // 成交量分布特征
    const volumeProfile = this.analyzeVolumeProfile(volumes);

    // 市场冲击成本
    const marketImpact = this.estimateMarketImpact(kline, amihudIlliquidity);

    // 买卖价差反弹强度
    const bidAskBounce = this.calcBidAskBounce(kline);

    return {
      averageSpread: Math.round(averageSpread * 10000) / 100,
      spreadVolatility: Math.round(spreadVolatility * 10000) / 100,
      vwap: Math.round(vwap * 100) / 100,
      vwapDeviation: Math.round(vwapDeviation * 100) / 100,
      orderImbalance: Math.round(orderImbalance * 1000) / 1000,
      liquidityScore: Math.round(liquidityScore),
      amihudIlliquidity: Math.round(amihudIlliquidity * 1e9 * 1000) / 1000,
      turnoverRate: Math.round(turnoverRate * 100) / 100,
      volumeProfile,
      marketImpact: Math.round(marketImpact * 10000) / 100,
      bidAskBounce: Math.round(bidAskBounce * 100) / 100,
    };
  }

  /**
   * 计算VWAP（成交量加权平均价）
   * 用日线近似：VWAP = sum(typical_price * volume) / sum(volume)
   * typical_price = (high + low + close) / 3
   */
  private calcVWAP(kline: any[], intradayData?: any[]): number {
    // 如果有分时数据，用分时计算真实VWAP
    if (intradayData && intradayData.length > 5) {
      let volPrice = 0;
      let totalVol = 0;
      for (const tick of intradayData) {
        if (tick.price > 0 && tick.volume > 0) {
          volPrice += tick.price * tick.volume;
          totalVol += tick.volume;
        }
      }
      if (totalVol > 0) return volPrice / totalVol;
    }

    // 用日线估算
    let volPrice = 0;
    let totalVol = 0;
    for (const bar of kline) {
      if (bar.high && bar.low && bar.close && bar.volume) {
        const typicalPrice = (bar.high + bar.low + bar.close) / 3;
        volPrice += typicalPrice * bar.volume;
        totalVol += bar.volume;
      }
    }
    return totalVol > 0 ? volPrice / totalVol : 0;
  }

  /**
   * 订单簿失衡指标 (Order Book Imbalance)
   * OI = (buyVolume - sellVolume) / (buyVolume + sellVolume)
   * 正=买方挂单多，短期看涨；负=卖方挂单多，短期看跌
   */
  private calcOrderImbalance(buy1Vol?: number, sell1Vol?: number): number {
    if (buy1Vol == null || sell1Vol == null || (buy1Vol + sell1Vol) === 0) return 0;
    return (buy1Vol - sell1Vol) / (buy1Vol + sell1Vol);
  }

  /**
   * 计算买卖价差统计
   * 用K线的最高最低价估算有效价差
   */
  private calcSpreadStats(kline: any[], bid?: number, ask?: number):
    { averageSpread: number; spreadVolatility: number } {
    
    // 真实买卖价差
    if (bid && ask && ask > bid) {
      const spread = (ask - bid) / ((ask + bid) / 2);
      return { averageSpread: spread, spreadVolatility: 0 };
    }

    // 用K线估算：有效价差 ≈ (high - low) / close 的中位数
    const spreads: number[] = [];
    for (const bar of kline.slice(-30)) {
      if (bar.high && bar.low && bar.close && bar.high > bar.low) {
        const barSpread = (bar.high - bar.low) / bar.close;
        // 排除异常大的价差（涨跌停日）
        if (barSpread < 0.1) {
          spreads.push(barSpread);
        }
      }
    }

    if (spreads.length < 2) return { averageSpread: 0.02, spreadVolatility: 0.01 };

    const n = spreads.length;
    const mean = spreads.reduce((a, b) => a + b, 0) / n;
    const variance = spreads.reduce((sq, s) => sq + Math.pow(s - mean, 2), 0) / (n - 1);

    return {
      averageSpread: mean,
      spreadVolatility: Math.sqrt(variance),
    };
  }

  /**
   * Amihud非流动性指标
   * ILLIQ = mean(|return| / volume) 越大越不流动
   * 衡量单位成交量对价格的冲击
   */
  private calcAmihudIlliquidity(kline: any[]): number {
    const values: number[] = [];
    for (let i = 1; i < kline.length; i++) {
      const prev = kline[i - 1];
      const cur = kline[i];
      if (prev.close > 0 && cur.volume > 0) {
        const ret = Math.abs((cur.close - prev.close) / prev.close);
        values.push(ret / (cur.volume * cur.close));
      }
    }
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * 流动性综合评分
   */
  private calcLiquidityScore(
    kline: any[], amihud: number, spread: number, turnoverRate: number
  ): number {
    let score = 50;

    // Amihud低=流动性好
    if (amihud < 1e-10) score += 20;
    else if (amihud < 1e-9) score += 10;
    else if (amihud > 1e-8) score -= 15;

    // 价差小=流动性好
    if (spread < 0.01) score += 15;
    else if (spread < 0.02) score += 5;
    else if (spread > 0.03) score -= 10;

    // 换手率高=流动性好
    if (turnoverRate > 3) score += 15;
    else if (turnoverRate > 1) score += 5;
    else if (turnoverRate < 0.3) score -= 10;

    // 数据量
    if (kline.length < 30) score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 成交量分布特征
   */
  private analyzeVolumeProfile(volumes: number[]): string {
    if (volumes.length < 10) return '数据不足';
    
    const recent = volumes.slice(-10);
    const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const ratio = recentAvg / avg;

    if (ratio > 1.5) return '近期放量';
    if (ratio > 1.2) return '温和放量';
    if (ratio < 0.7) return '近期缩量';
    if (ratio < 0.85) return '温和缩量';
    return '成交量平稳';
  }

  /**
   * 估算市场冲击成本
   * 参考Kyle's lambda模型
   */
  private estimateMarketImpact(kline: any[], amihud: number): number {
    const last = kline[kline.length - 1];
    if (!last?.volume || !last?.close) return 0.001;
    
    // 假设交易量为日成交量的1%
    const tradeSize = last.volume * 0.01 * last.close;
    const impact = amihud * tradeSize;
    
    return Math.min(impact, 0.02); // 最大2%
  }

  /**
   * 买卖价差反弹强度 (Bid-Ask Bounce)
   * 衡量市场微观结构噪声（正=存在反弹效应）
   */
  private calcBidAskBounce(kline: any[]): number {
    let posChanges = 0;
    let negChanges = 0;
    let totalPairs = 0;
    
    for (let i = 2; i < kline.length; i++) {
      const r1 = kline[i - 1].close - kline[i - 2].close;
      const r2 = kline[i].close - kline[i - 1].close;
      if (r1 > 0 && r2 < 0) posChanges++;
      if (r1 < 0 && r2 > 0) negChanges++;
      totalPairs++;
    }
    
    return totalPairs > 0 ? (posChanges + negChanges) / totalPairs : 0;
  }

  private emptyMetrics(): MicrostructureMetrics {
    return {
      averageSpread: 0, spreadVolatility: 0,
      vwap: 0, vwapDeviation: 0,
      orderImbalance: 0, liquidityScore: 0,
      amihudIlliquidity: 0, turnoverRate: 0,
      volumeProfile: '数据不足', marketImpact: 0,
      bidAskBounce: 0,
    };
  }
}
