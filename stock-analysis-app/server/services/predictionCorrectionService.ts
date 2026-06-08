import fs from 'fs';
import path from 'path';
import { config } from '../config';

interface PredictionError {
  date: string;
  code: string;
  predictedChange: number;
  actualChange: number;
  error: number;
  direction: boolean;          // 方向是否正确
  volatilityRatio: number;     // 实际波动 / 预测波动
  marketCondition: 'bull' | 'bear' | 'neutral';
}

interface CorrectionFactors {
  driftMultiplier: number;     // 漂移调整系数
  volatilityMultiplier: number; // 波动率调整系数
  confidenceBias: number;      // 置信度偏差
  sampleCount: number;
}

export class PredictionCorrectionService {
  private dir: string;
  private factors: Map<string, CorrectionFactors> = new Map();

  constructor() {
    this.dir = path.resolve(config.cacheDir, 'corrections');
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
    this.loadFactors();
  }

  private getFactorPath(): string {
    return path.join(this.dir, 'factors.json');
  }

  private loadFactors() {
    try {
      if (fs.existsSync(this.getFactorPath())) {
        const data = JSON.parse(fs.readFileSync(this.getFactorPath(), 'utf-8'));
        for (const [key, val] of Object.entries(data)) {
          this.factors.set(key, val as CorrectionFactors);
        }
      }
    } catch {}
  }

  private saveFactors() {
    try {
      const obj: Record<string, CorrectionFactors> = {};
      for (const [key, val] of this.factors.entries()) {
        obj[key] = val;
      }
      fs.writeFileSync(this.getFactorPath(), JSON.stringify(obj, null, 2));
    } catch {}
  }

  /**
   * 记录预测误差，更新校正因子
   */
  recordError(error: PredictionError) {
    // 按市场环境分组
    const key = error.marketCondition;
    let f = this.factors.get(key) || {
      driftMultiplier: 1.0,
      volatilityMultiplier: 1.0,
      confidenceBias: 0,
      sampleCount: 0,
    };

    f.sampleCount++;

    // 调整漂移系数：如果预测方向总错，减小漂移强度
    if (!error.direction) {
      f.driftMultiplier *= 0.95;  // 方向错了，保守一些
    } else {
      f.driftMultiplier = Math.min(f.driftMultiplier * 1.02, 1.2);  // 方向对了，可适当乐观
    }

    // 调整波动率系数：如果实际波动比预测大，扩大波动率
    if (error.volatilityRatio > 1.5) {
      f.volatilityMultiplier *= 1.1;
    } else if (error.volatilityRatio < 0.5) {
      f.volatilityMultiplier *= 0.95;
    }

    // 限制范围
    f.driftMultiplier = Math.max(0.5, Math.min(1.5, f.driftMultiplier));
    f.volatilityMultiplier = Math.max(0.5, Math.min(2.0, f.volatilityMultiplier));

    this.factors.set(key, f);
    this.saveFactors();
  }

  /**
   * 获取校正后的预测参数
   */
  getAdjustedParams(marketCondition: 'bull' | 'bear' | 'neutral'): {
    driftMultiplier: number;
    volatilityMultiplier: number;
    confidenceBias: number;
  } {
    const f = this.factors.get(marketCondition) || {
      driftMultiplier: 1.0,
      volatilityMultiplier: 1.0,
      confidenceBias: 0,
      sampleCount: 0,
    };

    return {
      driftMultiplier: f.driftMultiplier,
      volatilityMultiplier: f.volatilityMultiplier,
      confidenceBias: f.confidenceBias,
    };
  }

  /**
   * 判断当前市场环境
   */
  async getMarketCondition(): Promise<'bull' | 'bear' | 'neutral'> {
    try {
      const { StockSDK } = require('stock-sdk');
      const sdk = new StockSDK({ retry: { maxRetries: 0 } });
      const quotes = await sdk.getSimpleQuotes(['sh000001']);
      if (quotes && quotes.length > 0) {
        const pct = quotes[0].changePercent || 0;
        if (pct > 0.5) return 'bull';
        if (pct < -0.5) return 'bear';
      }
    } catch {}
    return 'neutral';
  }

  /**
   * 生成自适应校正报告
   */
  getCorrectionReport(): { factor: string; driftMultiplier: number; volMultiplier: number; count: number }[] {
    const report: { factor: string; driftMultiplier: number; volMultiplier: number; count: number }[] = [];
    for (const [key, val] of this.factors.entries()) {
      report.push({
        factor: key === 'bull' ? '牛市环境' : key === 'bear' ? '熊市环境' : '震荡环境',
        driftMultiplier: val.driftMultiplier,
        volMultiplier: val.volatilityMultiplier,
        count: val.sampleCount,
      });
    }
    return report;
  }
}
