import fs from 'fs';
import path from 'path';
import { config } from '../config';
import type { KlineBar, ForecastPoint, PredictionResult } from '../types';

export interface PredictionRecord {
  code: string;
  date: string;             // 预测日期 yyyy-MM-dd
  predictDays: number;
  method: PredictionResult['method'];
  trend: PredictionResult['trend'];
  confidence: PredictionResult['confidence'];
  lastPrice: number;
  forecast: ForecastPoint[];
}

export interface BacktestResult {
  hasHistory: boolean;
  record?: PredictionRecord;
  /** 实际K线（预测期间内） */
  actualBars?: KlineBar[];
  /** 偏差指标 */
  metrics?: {
    mae: number;        // 平均绝对误差
    mse: number;        // 均方误差
    maxError: number;   // 最大偏差
    directionCorrect: boolean;  // 方向判断是否正确
    within80: number;   // 80%置信区间内比例
    within95: number;   // 95%置信区间内比例
  };
  deviationAnalysis?: string[];
  improvementTips?: string[];
}

export class PredictionHistoryService {
  private dir: string;

  constructor() {
    this.dir = path.resolve(config.cacheDir, 'predictions');
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  /** 保存预测记录 */
  save(code: string, prediction: PredictionResult, lastPrice: number): void {
    try {
      const record: PredictionRecord = {
        code,
        date: new Date().toISOString().split('T')[0],
        predictDays: prediction.forecast.length,
        method: prediction.method,
        trend: prediction.trend,
        confidence: prediction.confidence,
        lastPrice,
        forecast: prediction.forecast,
      };
      const filePath = path.join(this.dir, `${code}.json`);
      // 保留最近5次预测
      let history: PredictionRecord[] = [];
      if (fs.existsSync(filePath)) {
        try {
          history = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch {}
      }
      history.push(record);
      if (history.length > 5) history = history.slice(-5);
      fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
    } catch (err) {
      console.warn('[PredictionHistory] Save failed:', err);
    }
  }

  /** 获取历史预测记录 */
  getHistory(code: string): PredictionRecord[] {
    const filePath = path.join(this.dir, `${code}.json`);
    if (!fs.existsSync(filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return [];
    }
  }

  /** 回测最近一次预测 */
  backtest(code: string, kline: KlineBar[]): BacktestResult {
    const history = this.getHistory(code);
    if (history.length === 0) {
      return { hasHistory: false };
    }

    const record = history[history.length - 1]; // 最近一次
    if (!record.forecast || record.forecast.length === 0) {
      return { hasHistory: false };
    }

    // 提取预测期内的实际K线 (从预测日期之后)
    const predStartDate = record.date;
    const predEndDate = record.forecast[record.forecast.length - 1].date;
    const actualBars = kline.filter(
      bar => bar.date > predStartDate && bar.date <= predEndDate && bar.close != null
    );

    if (actualBars.length === 0) {
      return { hasHistory: true, record, actualBars: [] };
    }

    // 逐日对比
    const errors: number[] = [];
    let within80Count = 0;
    let within95Count = 0;
    let predictedDirection = record.trend;
    let actualDirection: 'up' | 'down' | 'sideways' = 'sideways';

    // 计算实际趋势方向
    const firstActual = actualBars[0].close;
    const lastActual = actualBars[actualBars.length - 1].close;
    const actualChange = ((lastActual - firstActual) / firstActual) * 100;
    if (actualChange > 1) actualDirection = 'up';
    else if (actualChange < -1) actualDirection = 'down';
    else actualDirection = 'sideways';

    // 对每个预测点找对应的实际值
    for (const fp of record.forecast) {
      const match = actualBars.find(bar => bar.date === fp.date);
      if (!match) continue;
      const error = Math.abs(match.close - fp.value);
      errors.push(error);

      const pctError = (match.close - fp.value) / fp.value;
      // 判断是否在置信区间内
      if (match.close >= fp.lower80 && match.close <= fp.upper80) within80Count++;
      if (match.close >= fp.lower95 && match.close <= fp.upper95) within95Count++;
    }

    if (errors.length === 0) {
      return { hasHistory: true, record, actualBars };
    }

    const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
    const mse = errors.reduce((a, b) => a + b * b, 0) / errors.length;
    const maxError = Math.max(...errors);
    const directionCorrect = (
      (predictedDirection === 'up' && actualDirection === 'up') ||
      (predictedDirection === 'down' && actualDirection === 'down') ||
      (predictedDirection === 'sideways' && actualDirection === 'sideways')
    );

    // 偏差分析
    const deviationAnalysis: string[] = [];
    const maxErrorPct = (maxError / record.lastPrice) * 100;
    const avgErrorPct = (mae / record.lastPrice) * 100;

    if (!directionCorrect) {
      deviationAnalysis.push(`方向判断错误：预测${record.trend === 'up' ? '上涨' : record.trend === 'down' ? '下跌' : '震荡'}，实际${actualDirection === 'up' ? '上涨' : actualDirection === 'down' ? '下跌' : '震荡'}`);
      if (Math.abs(actualChange) > 3) {
        deviationAnalysis.push('实际波动较大，可能受突发消息或大盘环境影响');
      }
    }

    if (maxErrorPct > 10) {
      deviationAnalysis.push(`最大偏差 ${maxErrorPct.toFixed(1)}%，预测模型未能捕捉到极端行情`);
    } else if (maxErrorPct > 5) {
      deviationAnalysis.push(`最大偏差 ${maxErrorPct.toFixed(1)}%，市场出现预期外的波动`);
    }

    if (predictedDirection === 'sideways' && Math.abs(actualChange) > 2) {
      deviationAnalysis.push('预测横盘但实际出现趋势行情，模型对趋势启动不敏感');
    }

    if (predictedDirection !== 'sideways' && Math.abs(actualChange) < 1) {
      deviationAnalysis.push('预测趋势但实际横盘整理，趋势未如期展开');
    }

    if (avgErrorPct > 3) {
      deviationAnalysis.push(`平均偏差 ${avgErrorPct.toFixed(1)}%，置信区间设置可能偏窄`);
    }

    if (deviationAnalysis.length === 0) {
      deviationAnalysis.push('预测误差在合理范围内，模型表现正常');
    }

    // 改进建议
    const improvementTips: string[] = [];
    if (!directionCorrect && Math.abs(actualChange) > 2) {
      improvementTips.push('考虑引入更多外部因素（大盘、板块热度）来修正方向判断');
    }
    if (within80Count / errors.length < 0.5) {
      improvementTips.push('置信区间过窄，建议放宽以提高覆盖能力');
    }
    if (within95Count / errors.length > 0.95) {
      improvementTips.push('置信区间过宽，建议收窄以提供更有意义的参考');
    }
    if (maxErrorPct > 10) {
      improvementTips.push('考虑加入波动率自适应机制，在高波动时扩大预测范围');
    }
    if (predictedDirection === 'sideways' && actualDirection !== 'sideways') {
      improvementTips.push('引入趋势检测前置过滤器，减少横盘误判');
    }

    const metrics = {
      mae: Math.round(mae * 100) / 100,
      mse: Math.round(mse * 100) / 100,
      maxError: Math.round(maxError * 100) / 100,
      directionCorrect,
      within80: Math.round((within80Count / errors.length) * 100),
      within95: Math.round((within95Count / errors.length) * 100),
    };

    return {
      hasHistory: true,
      record,
      actualBars,
      metrics,
      deviationAnalysis,
      improvementTips,
    };
  }
}
