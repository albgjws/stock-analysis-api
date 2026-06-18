import ARIMA from 'arima';
import type { KlineBar, ForecastPoint, PredictionResult } from '../types';
import { PredictionCorrectionService } from './predictionCorrectionService';

// ARIMA's TypeScript types are wrong for auto mode — cast in constructor calls
type ArimaArgs = ConstructorParameters<typeof ARIMA>[0];

export class PredictionService {
  private correction: PredictionCorrectionService;

  constructor() {
    this.correction = new PredictionCorrectionService();
  }

  async predict(
    klineData: KlineBar[],
    predictDays: number
  ): Promise<PredictionResult> {
    if (!klineData || klineData.length < 30) {
      return {
        method: 'INSUFFICIENT_DATA',
        forecast: [],
        trend: 'sideways',
        confidence: 'low',
      };
    }

    const prices = klineData
      .map(k => k.close)
      .filter((p): p is number => p != null && !isNaN(p) && p > 0)
      .slice(-200);

    if (prices.length < 30) {
      return {
        method: 'INSUFFICIENT_DATA',
        forecast: [],
        trend: 'sideways',
        confidence: 'low',
      };
    }

    // Try ARIMA-enhanced prediction
    try {
      return this.predictWithDrift(prices, klineData, predictDays);
    } catch (err) {
      console.warn('[Prediction] Drift model failed:', err);
    }

    // Final fallback
    return this.predictWithSMA(prices, klineData, predictDays);
  }

  private async predictWithDrift(
    prices: number[],
    klineData: KlineBar[],
    predictDays: number
  ): Promise<PredictionResult> {
    const lastPrice = prices[prices.length - 1];

    // Calculate recent trend (last 10-20 days)
    const shortTermReturn = (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5];
    const mediumTermReturn = (prices[prices.length - 1] - prices[prices.length - 20]) / prices[prices.length - 20];

    // Weighted drift: more weight on short-term
    let dailyDrift = (shortTermReturn * 0.7 + mediumTermReturn * 0.3) / 5;

    // Historical daily volatility (standard deviation of daily returns)
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.abs(prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    let dailyVolatility = this.standardDeviation(returns.slice(-60));

    // 自适应校正：根据历史误差调整 drift 和 volatility
    try {
      const condition = await this.correction.getMarketCondition();
      const params = this.correction.getAdjustedParams(condition);
      dailyDrift *= params.driftMultiplier;
      dailyVolatility *= params.volatilityMultiplier;
    } catch {} // 校正失败不影响主流程

    // MACD柱方向修正漂移
    try {
      const last = klineData[klineData.length - 1];
      const prev = klineData.length > 1 ? klineData[klineData.length - 2] : null;
      if (last?.macd && prev?.macd) {
        const macdDelta = last.macd.macd - prev.macd.macd;
        if (macdDelta > 0) {
          dailyDrift *= 1.15;  // MACD柱变长 → 动能增强，漂移加大
        } else {
          dailyDrift *= 0.85;  // MACD柱变短 → 动能衰减，漂移减小
        }
      }
    } catch {} // 不影响主流程

    // Try ARIMA for trend direction signal only
    try {
      const arima = new (ARIMA as any)({ auto: true, p: [0, 3], d: [0, 1], q: [0, 3], verbose: false });
      arima.train(prices);
      const [arimaPreds] = arima.predict(predictDays);
      if (arimaPreds && arimaPreds.length > 0) {
        // Use ARIMA's direction, our magnitude
        const arimaMean = arimaPreds.reduce((a: number, b: number) => a + b, 0) / arimaPreds.length;
        const arimaDirection = arimaMean > lastPrice * 1.005 ? 1 :
                               arimaMean < lastPrice * 0.995 ? -1 : 0;
        // Blend ARIMA direction with our drift
        const blendedDrift = dailyDrift * 0.3 + arimaDirection * dailyVolatility * 0.7;
        return this.buildForecast(prices, klineData, predictDays, blendedDrift, dailyVolatility, 'ARIMA');
      }
    } catch {
      // Fall through to drift-only
    }

    // Drift-only prediction
    return this.buildForecast(prices, klineData, predictDays, dailyDrift, dailyVolatility, 'LINEAR_REGRESSION');
  }

  private buildForecast(
    prices: number[],
    klineData: KlineBar[],
    predictDays: number,
    dailyDrift: number,
    dailyVolatility: number,
    method: PredictionResult['method']
  ): PredictionResult {
    const lastPrice = prices[prices.length - 1];
    const lastDate = new Date(klineData[klineData.length - 1].date);

    const forecast: ForecastPoint[] = [];
    let cumulativeDrift = 0;

    for (let i = 0; i < predictDays; i++) {
      // Random walk with drift
      cumulativeDrift += dailyDrift;
      const expectedReturn = cumulativeDrift;

      // Each day's uncertainty grows with sqrt(time)
      const horizonVol = dailyVolatility * Math.sqrt(i + 1);

      // Point forecast
      const value = lastPrice * (1 + expectedReturn);

      // Confidence bands: wider as we go further out
      const band80 = (horizonVol * 1.28);
      const band95 = (horizonVol * 1.96);

      const date = this.addTradingDays(lastDate, i + 1);
      forecast.push({
        date,
        value: Math.round(value * 100) / 100,
        upper80: Math.round(Math.min(value * (1 + band80), value * 1.5) * 100) / 100,
        lower80: Math.round(Math.max(value * (1 - band80), value * 0.5) * 100) / 100,
        upper95: Math.round(Math.min(value * (1 + band95), value * 2.0) * 100) / 100,
        lower95: Math.round(Math.max(value * (1 - band95), value * 0.3) * 100) / 100,
      });
    }

    const lastForecast = forecast[forecast.length - 1];
    const trend = lastForecast.value > lastPrice * 1.02 ? 'up' as const :
                  lastForecast.value < lastPrice * 0.98 ? 'down' as const :
                  'sideways' as const;

    const confidence: 'high' | 'medium' | 'low' =
      dailyVolatility < 0.015 ? 'high' :
      dailyVolatility < 0.03  ? 'medium' : 'low';

    return { method, forecast, trend, confidence };
  }

  private predictWithSMA(
    prices: number[],
    klineData: KlineBar[],
    predictDays: number
  ): PredictionResult {
    const lastPrice = prices[prices.length - 1];
    const smaPeriod = Math.min(10, prices.length);
    const recentPrices = prices.slice(-smaPeriod);
    const avgPrice = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;

    // Use recent volatility
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.abs(prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const dailyVolatility = this.standardDeviation(returns.slice(-60)) || 0.02;

    const lastDate = new Date(klineData[klineData.length - 1].date);
    const forecast: ForecastPoint[] = [];

    for (let i = 0; i < predictDays; i++) {
      const horizonVol = dailyVolatility * Math.sqrt(i + 1);
      const date = this.addTradingDays(lastDate, i + 1);
      forecast.push({
        date,
        value: Math.round(avgPrice * 100) / 100,
        upper80: Math.round(Math.min(avgPrice * (1 + horizonVol * 1.28), avgPrice * 1.5) * 100) / 100,
        lower80: Math.round(Math.max(avgPrice * (1 - horizonVol * 1.28), avgPrice * 0.5) * 100) / 100,
        upper95: Math.round(Math.min(avgPrice * (1 + horizonVol * 1.96), avgPrice * 2.0) * 100) / 100,
        lower95: Math.round(Math.max(avgPrice * (1 - horizonVol * 1.96), avgPrice * 0.3) * 100) / 100,
      });
    }

    return {
      method: 'SMA',
      params: { period: smaPeriod },
      forecast,
      trend: avgPrice > lastPrice * 1.01 ? 'up' as const :
             avgPrice < lastPrice * 0.99 ? 'down' as const :
             'sideways' as const,
      confidence: 'low',
    };
  }

  private standardDeviation(values: number[]): number {
    if (values.length < 2) return 0.02; // default 2%
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sqDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
  }

  private addTradingDays(date: Date, days: number): string {
    const result = new Date(date);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        added++;
      }
    }
    return result.toISOString().split('T')[0];
  }
}
