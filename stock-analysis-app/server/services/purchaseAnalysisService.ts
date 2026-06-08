import type { KlineBar, PurchaseAnalysisResult, PurchaseDetail, StopLevel, SignalResult } from '../types';
import { SignalService } from './signalService';

export class PurchaseAnalysisService {
  private signalService = new SignalService();

  /**
   * 分析买入价是否合适，给出评价和策略
   */
  analyze(
    kline: KlineBar[],
    currentPrice: number,
    purchasePrice: number,
  ): PurchaseAnalysisResult {
    const last = kline[kline.length - 1];
    const details: PurchaseDetail[] = [];
    let score = 50; // 基础分50

    // 1. 盈亏情况
    const pnl = currentPrice - purchasePrice;
    const pnlPercent = (pnl / purchasePrice) * 100;
    details.push({
      item: '当前盈亏',
      status: pnl >= 0 ? 'good' : 'bad',
      comment: pnl >= 0
        ? `现价 ${currentPrice.toFixed(2)}，盈利 ${pnlPercent.toFixed(2)}% ✅`
        : `现价 ${currentPrice.toFixed(2)}，亏损 ${Math.abs(pnlPercent).toFixed(2)}% ⚠️`,
    });
    if (pnlPercent >= 0) score += 10; else score -= 10;

    // 2. 相对于布林带的位置
    if (last.boll) {
      const { mid, upper, lower } = last.boll;
      if (purchasePrice <= lower * 1.02) {
        details.push({
          item: '布林带位置',
          status: 'good',
          comment: `买入价 ${purchasePrice.toFixed(2)} 接近布林下轨 ${lower.toFixed(2)}，属于低吸区间 ✅`,
        });
        score += 15;
      } else if (purchasePrice <= mid) {
        details.push({
          item: '布林带位置',
          status: 'good',
          comment: `买入价 ${purchasePrice.toFixed(2)} 位于布林中轨 ${mid.toFixed(2)} 下方，估值合理 ✅`,
        });
        score += 10;
      } else if (purchasePrice <= upper * 0.97) {
        details.push({
          item: '布林带位置',
          status: 'neutral',
          comment: `买入价 ${purchasePrice.toFixed(2)} 偏向上轨 ${upper.toFixed(2)}，追高需谨慎 ⚪`,
        });
        score += 0;
      } else {
        details.push({
          item: '布林带位置',
          status: 'bad',
          comment: `买入价 ${purchasePrice.toFixed(2)} 接近布林上轨 ${upper.toFixed(2)}，追高风险较大 ❌`,
        });
        score -= 15;
      }
    }

    // 3. 相对于均线的位置
    if (last.ma) {
      const { ma5, ma10, ma20, ma60 } = last.ma;
      const mas = [ma5, ma10, ma20, ma60].filter(m => m != null) as number[];
      const sortedMas = [...mas].sort((a, b) => a - b);
      const lowestMa = sortedMas[0];
      const highestMa = sortedMas[sortedMas.length - 1];

      if (purchasePrice <= lowestMa * 1.01) {
        details.push({
          item: '均线位置',
          status: 'good',
          comment: `买入价低于所有均线，处于超卖区域，反弹预期较强 ✅`,
        });
        score += 15;
      } else if (purchasePrice <= sortedMas[Math.floor(sortedMas.length / 2)]) {
        details.push({
          item: '均线位置',
          status: 'good',
          comment: `买入价位于均线簇中下方，成本相对安全 ✅`,
        });
        score += 10;
      } else if (purchasePrice <= highestMa * 1.02) {
        details.push({
          item: '均线位置',
          status: 'neutral',
          comment: `买入价接近均线簇上沿，短期可能存在获利回吐压力 ⚪`,
        });
        score += 0;
      } else {
        details.push({
          item: '均线位置',
          status: 'bad',
          comment: `买入价远高于所有均线，偏离较大，回调风险较高 ❌`,
        });
        score -= 10;
      }
    }

    // 4. RSI 状态
    if (last.rsi) {
      const rsi = last.rsi.rsi6 ?? last.rsi.rsi12 ?? last.rsi.rsi24;
      if (rsi != null) {
        if (rsi < 35) {
          details.push({
            item: 'RSI 超卖',
            status: 'good',
            comment: `RSI ${rsi.toFixed(1)} < 35，处于超卖区域，反弹概率大 ✅`,
          });
          score += 10;
        } else if (rsi < 45) {
          details.push({
            item: 'RSI 偏低',
            status: 'good',
            comment: `RSI ${rsi.toFixed(1)}，处于偏低位置，有上行空间 ✅`,
          });
          score += 5;
        } else if (rsi < 60) {
          details.push({
            item: 'RSI 中性',
            status: 'neutral',
            comment: `RSI ${rsi.toFixed(1)}，处于中性区间 ⚪`,
          });
        } else if (rsi < 70) {
          details.push({
            item: 'RSI 偏高',
            status: 'neutral',
            comment: `RSI ${rsi.toFixed(1)}，处于偏高位置，注意回调风险 ⚪`,
          });
          score -= 5;
        } else {
          details.push({
            item: 'RSI 超买',
            status: 'bad',
            comment: `RSI ${rsi.toFixed(1)} > 70，处于超买区域，回调风险较大 ❌`,
          });
          score -= 10;
        }
      }
    }

    // 5. MACD 趋势
    if (last.macd) {
      const { dif, dea, macd } = last.macd;
      if (dif > dea && macd > 0) {
        details.push({
          item: 'MACD 趋势',
          status: 'good',
          comment: `DIF ${dif.toFixed(2)} > DEA ${dea.toFixed(2)}，MACD 多头趋势，买入时机较好 ✅`,
        });
        score += 10;
      } else if (dif > dea) {
        details.push({
          item: 'MACD 趋势',
          status: 'neutral',
          comment: `DIF ${dif.toFixed(2)} > DEA ${dea.toFixed(2)}，MACD 初步转好 ⚪`,
        });
        score += 5;
      } else if (dif < dea && macd < 0) {
        details.push({
          item: 'MACD 趋势',
          status: 'bad',
          comment: `DIF ${dif.toFixed(2)} < DEA ${dea.toFixed(2)}，MACD 空头趋势，买入后可能继续调整 ❌`,
        });
        score -= 10;
      } else {
        details.push({
          item: 'MACD 趋势',
          status: 'neutral',
          comment: `DIF ${dif.toFixed(2)} < DEA ${dea.toFixed(2)}，MACD 偏弱 ⚪`,
        });
        score -= 5;
      }
    }

    // 6. 成交量分析
    const avgVolume = kline.slice(-21, -1).reduce((s, b) => s + b.volume, 0) / 20;
    const volRatio = last.volume / avgVolume;
    if (last.changePercent != null && last.changePercent > 0 && volRatio > 1.3) {
      details.push({
        item: '成交量配合',
        status: 'good',
        comment: `量比 ${volRatio.toFixed(1)}，价涨量增，资金介入明显 ✅`,
      });
      score += 5;
    } else if (last.changePercent != null && last.changePercent < 0 && volRatio > 1.3) {
      details.push({
        item: '成交量配合',
        status: 'bad',
        comment: `量比 ${volRatio.toFixed(1)}，价跌量增，抛压较大 ❌`,
      });
      score -= 5;
    } else {
      details.push({
        item: '成交量配合',
        status: 'neutral',
        comment: `量比 ${volRatio.toFixed(1)}，成交温和 ⚪`,
      });
    }

    // 7. KDJ 信号
    if (last.kdj) {
      const { k, d, j } = last.kdj;
      if (k > d && k < 40) {
        details.push({
          item: 'KDJ 信号',
          status: 'good',
          comment: `K ${k.toFixed(1)} > D ${d.toFixed(1)}，低位金叉，买入信号 ✅`,
        });
        score += 5;
      } else if (k < d && k > 60) {
        details.push({
          item: 'KDJ 信号',
          status: 'bad',
          comment: `K ${k.toFixed(1)} < D ${d.toFixed(1)}，高位死叉，回避风险 ❌`,
        });
        score -= 5;
      } else {
        details.push({
          item: 'KDJ 信号',
          status: 'neutral',
          comment: `K ${k.toFixed(1)} / D ${d.toFixed(1)}，方向不明 ⚪`,
        });
      }
    }

    // 计算最终评级
    const clampedScore = Math.max(0, Math.min(100, score));
    const rating = this.getRating(clampedScore);
    const ratingLabel = this.getRatingLabel(rating);

    // 计算基于买入价的止损止盈
    const stopLoss = this.calcStopLossFromBuy(kline, purchasePrice, currentPrice, clampedScore);
    const takeProfit = this.calcTakeProfitFromBuy(kline, purchasePrice, currentPrice, stopLoss, clampedScore);

    // 上涨概率估算
    const upProb = this.estimateProbability(clampedScore, last);

    return {
      purchasePrice,
      currentPrice,
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: Math.round(pnlPercent * 100) / 100,
      rating,
      ratingLabel,
      score: clampedScore,
      details,
      stopLoss,
      takeProfit,
      probability: { up: upProb, down: 100 - upProb },
    };
  }

  private getRating(score: number): PurchaseAnalysisResult['rating'] {
    if (score >= 80) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 45) return 'neutral';
    if (score >= 30) return 'risky';
    return 'bad';
  }

  private getRatingLabel(rating: PurchaseAnalysisResult['rating']): string {
    const map: Record<PurchaseAnalysisResult['rating'], string> = {
      excellent: '优质买入 ⭐',
      good: '合理买入 ✅',
      neutral: '中性观望 ⚪',
      risky: '追高风险 ⚠️',
      bad: '不宜买入 ❌',
    };
    return map[rating];
  }

  /**
   * 基于买入价计算止损位
   */
  private calcStopLossFromBuy(
    kline: KlineBar[],
    buyPrice: number,
    currentPrice: number,
    score: number,
  ): StopLevel {
    const recent = kline.slice(-20);
    const swingLow = Math.min(...recent.map(b => b.low));
    const last = kline[kline.length - 1];
    const maSupport = Math.min(last.ma?.ma20 ?? buyPrice, last.ma?.ma60 ?? buyPrice);

    // 根据评分决定止损幅度：评分高（买得好）给宽止损，评分低给紧止损
    const isGoodBuy = score >= 65;
    const maxLossPct = isGoodBuy ? 0.07 : 0.05; // 好买入允许亏7%，差买入只允许5%

    const fixedStop = buyPrice * (1 - maxLossPct);
    const techStop = Math.min(swingLow * 0.995, maSupport * 0.99);

    // 取较高的（亏得少的）
    let stopPrice = Math.max(fixedStop, techStop);

    // 如果当前已亏损超过止损线，用当前价*0.97硬止损
    if (currentPrice < buyPrice && (buyPrice - currentPrice) / buyPrice > maxLossPct * 0.7) {
      stopPrice = currentPrice * 0.97;
    }

    const lossPct = ((stopPrice - buyPrice) / buyPrice) * 100;

    // 寻找最接近的理由
    const candidates = [
      { price: Math.round(techStop * 100) / 100, label: `技术支撑 ${techStop.toFixed(2)}` },
      { price: Math.round(fixedStop * 100) / 100, label: `最大亏损 ${(maxLossPct * 100).toFixed(0)}%` },
    ];
    const closest = candidates.reduce((a, b) =>
      Math.abs(a.price - Math.round(stopPrice * 100) / 100) <
      Math.abs(b.price - Math.round(stopPrice * 100) / 100) ? a : b
    );

    return {
      price: Math.round(stopPrice * 100) / 100,
      percent: Math.round(lossPct * 100) / 100,
      reason: closest.label,
    };
  }

  /**
   * 基于买入价计算止盈位
   */
  private calcTakeProfitFromBuy(
    kline: KlineBar[],
    buyPrice: number,
    currentPrice: number,
    stopLoss: StopLevel,
    score: number,
  ): StopLevel {
    const recent = kline.slice(-20);
    const swingHigh = Math.max(...recent.map(b => b.high));
    const last = kline[kline.length - 1];
    const bollUpper = last.boll?.upper ?? buyPrice * 1.1;

    // 风险回报比目标
    const riskAmount = buyPrice - stopLoss.price;
    const rewardRatio = score >= 65 ? 3 : score >= 45 ? 2 : 1.5;
    const rrTarget = buyPrice + riskAmount * rewardRatio;

    // 最小目标涨幅
    const minTarget = buyPrice * 1.03;

    // 综合取最低的（最保守）
    let tpPrice = Math.min(swingHigh * 1.02, bollUpper * 0.99, rrTarget);

    if (tpPrice < minTarget) tpPrice = minTarget;

    const gainPct = ((tpPrice - buyPrice) / buyPrice) * 100;

    const candidates = [
      { price: Math.round(swingHigh * 1.02 * 100) / 100, label: `近期高点 ${swingHigh.toFixed(2)}` },
      { price: Math.round(bollUpper * 0.99 * 100) / 100, label: `布林上轨 ${bollUpper.toFixed(2)}` },
      { price: Math.round(rrTarget * 100) / 100, label: `盈亏比 ${rewardRatio}:1` },
    ];
    const closest = candidates.reduce((a, b) =>
      Math.abs(a.price - Math.round(tpPrice * 100) / 100) <
      Math.abs(b.price - Math.round(tpPrice * 100) / 100) ? a : b
    );

    return {
      price: Math.round(tpPrice * 100) / 100,
      percent: Math.round(gainPct * 100) / 100,
      reason: closest.label,
    };
  }

  /**
   * 估算上涨概率
   */
  private estimateProbability(score: number, lastBar: KlineBar): number {
    // 基础概率从评分映射
    let prob = 50 + (score - 50) * 0.4;

    // 技术指标微调
    if (lastBar.macd && lastBar.macd.dif > lastBar.macd.dea) prob += 5;
    if (lastBar.rsi) {
      const rsi = lastBar.rsi.rsi6 ?? 50;
      if (rsi < 30) prob += 8;
      else if (rsi > 70) prob -= 8;
    }
    if (lastBar.boll && lastBar.close <= lastBar.boll.lower * 1.01) prob += 5;
    if (lastBar.kdj && lastBar.kdj.k > lastBar.kdj.d) prob += 3;

    return Math.max(10, Math.min(90, Math.round(prob)));
  }
}
