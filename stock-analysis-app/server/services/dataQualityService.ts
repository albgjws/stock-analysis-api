/**
 * 数据质量服务 — 量化交易的第一道关口
 * 
 * 参考《打开量化投资的黑箱》《利用Python进行数据分析》中的数据清洗原则：
 * - 80%的量化研究时间花在数据清洗上
 * - 金融时间序列需处理：缺失值、异常值、前向填充、停牌处理
 * - 数据来源可靠性评分，多源相互验证
 */

export interface DataQualityReport {
  overallScore: number;
  issues: DataIssue[];
  stats: DataStats;
  cleaningApplied: string[];
  sourceConfidence: 'high' | 'medium' | 'low';
}

export interface DataIssue {
  type: 'missing' | 'outlier' | 'stale' | 'gap' | 'inconsistent' | 'suspicious';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  date?: string;
  field?: string;
  value?: number;
}

export interface DataStats {
  totalBars: number;
  dateRange: { from: string; to: string };
  tradingDays: number;
  gapDays: number;
  zeroVolumeDays: number;
  outlierCount: number;
  missingFields: string[];
  stdDev: number;
  meanPrice: number;
  maxDrawdown: number;
}

export class DataQualityService {
  private static HOLIDAYS_2026 = new Set([
    '2026-01-01',
    '2026-01-26','2026-01-27','2026-01-28','2026-01-29','2026-01-30',
    '2026-04-06',
    '2026-05-01','2026-05-04','2026-05-05',
    '2026-06-08','2026-06-09','2026-06-10',
    '2026-10-01','2026-10-02','2026-10-05','2026-10-06','2026-10-07','2026-10-08',
  ]);

  analyze(kline: any[], code: string): DataQualityReport {
    const issues: DataIssue[] = [];
    const cleaningApplied: string[] = [];
    
    if (!kline || kline.length === 0) {
      return {
        overallScore: 0,
        issues: [{ type: 'missing', severity: 'critical', description: `股票 ${code} 无K线数据` }],
        stats: this.emptyStats(),
        cleaningApplied: [],
        sourceConfidence: 'low',
      };
    }

    const prices = kline.map(b => b.close).filter((p: any): p is number => p != null && !isNaN(p));
    const volumes = kline.map(b => b.volume).filter((v: any): v is number => v != null);
    const dates = kline.map(b => b.date).filter(Boolean);
    const meanPrice = prices.length > 0 ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0;
    const stdDev = prices.length > 1
      ? Math.sqrt(prices.reduce((sq: number, p: number) => sq + Math.pow(p - meanPrice, 2), 0) / (prices.length - 1))
      : 0;

    const outlierCount = this.detectOutliers(prices, code, issues);
    const zeroVolumeDays = this.detectZeroVolumes(kline, issues);
    const gapDays = this.detectGaps(dates, issues);
    this.checkConsistency(kline, issues);
    this.checkLimitPriceAnomalies(kline, issues);
    this.applyCleaning(kline, cleaningApplied, issues);
    const sourceConfidence = this.evaluateSourceConfidence(kline, issues);
    const overallScore = this.calculateOverallScore(kline, issues, outlierCount, zeroVolumeDays, gapDays);

    return {
      overallScore,
      issues,
      stats: {
        totalBars: kline.length,
        dateRange: { from: dates[0] || '', to: dates[dates.length - 1] || '' },
        tradingDays: this.countTradingDays(dates),
        gapDays,
        zeroVolumeDays,
        outlierCount,
        missingFields: Array.from(this.findMissingFields(kline)),
        stdDev: Math.round(stdDev * 10000) / 10000,
        meanPrice: Math.round(meanPrice * 100) / 100,
        maxDrawdown: this.calcMaxDrawdown(prices),
      },
      cleaningApplied,
      sourceConfidence,
    };
  }

  private detectOutliers(prices: number[], _code: string, issues: DataIssue[]): number {
    if (prices.length < 10) return 0;
    
    const sorted = [...prices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mad = sorted.reduce((sum, p) => sum + Math.abs(p - median), 0) / sorted.length;
    
    if (mad === 0) return 0;
    
    let count = 0;
    for (let i = 0; i < prices.length; i++) {
      const modifiedZ = 0.6745 * (prices[i] - median) / mad;
      if (Math.abs(modifiedZ) > 3.5) {
        count++;
        if (count <= 5) {
          issues.push({
            type: 'outlier',
            severity: modifiedZ > 5 ? 'critical' : 'warning',
            description: `异常价格: ${prices[i].toFixed(2)} (Modified Z=${modifiedZ.toFixed(2)})`,
            field: 'close',
            value: prices[i],
          });
        }
      }
    }
    return count;
  }

  private detectZeroVolumes(kline: any[], issues: DataIssue[]): number {
    let count = 0;
    for (const bar of kline) {
      if (bar.volume === 0 && bar.close > 0) {
        count++;
        if (count <= 3) {
          issues.push({
            type: 'suspicious',
            severity: 'warning',
            description: `零成交量但价格非零: ${bar.date || 'unknown'}`,
            date: bar.date,
            field: 'volume',
            value: 0,
          });
        }
      }
    }
    return count;
  }

  private detectGaps(dates: string[], issues: DataIssue[]): number {
    if (dates.length < 2) return 0;
    
    let gaps = 0;
    const sorted = [...dates].sort();
    
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1]);
      const d2 = new Date(sorted[i]);
      
      let expectedNext = new Date(d1);
      let daysSkipped = -1;
      while (expectedNext < d2) {
        expectedNext.setDate(expectedNext.getDate() + 1);
        if (this.isTradingDay(expectedNext)) {
          daysSkipped++;
        }
      }
      
      if (daysSkipped > 0) {
        gaps += daysSkipped;
        if (gaps <= 3 && issues.length < 20) {
          issues.push({
            type: 'gap',
            severity: daysSkipped > 3 ? 'warning' : 'info',
            description: `数据缺失 ${daysSkipped} 个交易日: ${sorted[i - 1]} -> ${sorted[i]}`,
            date: sorted[i],
          });
        }
      }
    }
    return gaps;
  }

  private checkConsistency(kline: any[], issues: DataIssue[]) {
    let warned = 0;
    for (const bar of kline) {
      if (!bar.open || !bar.high || !bar.low || !bar.close) continue;
      
      if (bar.high < bar.low || bar.high < bar.open || bar.high < bar.close) {
        if (warned++ < 3) {
          issues.push({
            type: 'inconsistent',
            severity: 'critical',
            description: `OHLC逻辑错误: high=${bar.high} (${bar.date})`,
            date: bar.date,
          });
        }
      }
      if (bar.low > bar.high || bar.low > bar.open || bar.low > bar.close) {
        if (warned++ < 3) {
          issues.push({
            type: 'inconsistent',
            severity: 'critical',
            description: `OHLC逻辑错误: low=${bar.low} (${bar.date})`,
            date: bar.date,
          });
        }
      }
      if (bar.changePercent != null && bar.close != null && bar.open != null && bar.open > 0) {
        const calcChange = ((bar.close - bar.open) / bar.open) * 100;
        if (Math.abs(calcChange - bar.changePercent) > 5 && Math.abs(bar.changePercent) > 0.1) {
          if (warned++ < 3) {
            issues.push({
              type: 'inconsistent',
              severity: 'warning',
              description: `涨跌幅不一致: 计算=${calcChange.toFixed(2)}% vs 返回=${bar.changePercent.toFixed(2)}% (${bar.date})`,
              date: bar.date,
            });
          }
        }
      }
    }
  }

  private checkLimitPriceAnomalies(kline: any[], issues: DataIssue[]) {
    let warned = 0;
    for (const bar of kline) {
      if (!bar.close || !bar.prevClose || bar.prevClose <= 0) continue;
      const pctChange = ((bar.close - bar.prevClose) / bar.prevClose) * 100;
      
      if (pctChange > 10.5 || pctChange < -10.5) {
        if (warned++ < 3) {
          issues.push({
            type: 'suspicious',
            severity: 'info',
            description: `涨跌幅超过常规限制: ${pctChange.toFixed(2)}% (${bar.date})`,
            date: bar.date,
            field: 'changePercent',
            value: pctChange,
          });
        }
      }
    }
  }

  private applyCleaning(kline: any[], cleaningApplied: string[], issues: DataIssue[]) {
    let negVolFixed = 0;
    for (const bar of kline) {
      if (bar.volume < 0) {
        bar.volume = Math.abs(bar.volume);
        negVolFixed++;
      }
      if (bar.close === 0 && bar.open > 0) {
        bar.close = bar.open;
        cleaningApplied.push(`前向填充: close=0 -> ${bar.open} (${bar.date || ''})`);
      }
    }
    if (negVolFixed > 0) {
      cleaningApplied.push(`修复负成交量: ${negVolFixed} 条`);
    }
  }

  private evaluateSourceConfidence(kline: any[], issues: DataIssue[]): 'high' | 'medium' | 'low' {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const missingFields = this.findMissingFields(kline);
    
    if (criticalIssues > 5 || missingFields.size > 10 || kline.length < 20) return 'low';
    if (criticalIssues > 2 || missingFields.size > 5) return 'medium';
    return 'high';
  }

  private calculateOverallScore(
    kline: any[], issues: DataIssue[], outliers: number, zeroVols: number, gaps: number
  ): number {
    let score = 100;
    
    if (kline.length < 30) score -= 20;
    else if (kline.length < 60) score -= 10;
    else if (kline.length < 120) score -= 5;
    
    score -= outliers * 3;
    score -= zeroVols * 2;
    score -= gaps * 1.5;
    
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    score -= criticalCount * 8;
    
    const missingFields = this.findMissingFields(kline);
    score -= missingFields.size * 2;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private findMissingFields(kline: any[]): Set<string> {
    const missing = new Set<string>();
    const fields = ['open', 'high', 'low', 'close', 'volume', 'date'];
    
    for (const f of fields) {
      if (kline.some((b: any) => b[f] == null || (typeof b[f] === 'number' && isNaN(b[f])))) {
        missing.add(f);
      }
    }
    
    const indicatorFields = ['ma', 'macd', 'rsi', 'kdj', 'boll'];
    for (const f of indicatorFields) {
      if (!kline.some((b: any) => b[f] != null)) {
        missing.add(f);
      }
    }
    
    return missing;
  }

  private countTradingDays(dates: string[]): number {
    return dates.filter(d => {
      const dt = new Date(d);
      return dt.getDay() !== 0 && dt.getDay() !== 6;
    }).length;
  }

  private isTradingDay(date: Date): boolean {
    const dow = date.getDay();
    if (dow === 0 || dow === 6) return false;
    const dateStr = date.toISOString().split('T')[0];
    return !DataQualityService.HOLIDAYS_2026.has(dateStr);
  }

  private calcMaxDrawdown(prices: number[]): number {
    if (prices.length < 2) return 0;
    let peak = prices[0];
    let maxDD = 0;
    for (const p of prices) {
      if (p > peak) peak = p;
      const dd = (peak - p) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    return Math.round(maxDD * 10000) / 100;
  }

  private emptyStats(): DataStats {
    return {
      totalBars: 0, dateRange: { from: '', to: '' }, tradingDays: 0,
      gapDays: 0, zeroVolumeDays: 0, outlierCount: 0,
      missingFields: [], stdDev: 0, meanPrice: 0, maxDrawdown: 0,
    };
  }
}

