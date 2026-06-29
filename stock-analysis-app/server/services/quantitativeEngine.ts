/**
 * 量化分析引擎 — 整合所有量化模块
 * 
 * 将数据质量、风险管理、微观结构、统计套利、
 * 因子分析、Walk-Forward回测整合为统一的量化报告
 */

import { DataQualityService, DataQualityReport } from './dataQualityService';
import { RiskManagementService, RiskMetrics } from './riskManagementService';
import { MarketMicrostructureService, MicrostructureMetrics } from './marketMicrostructureService';
import { StatisticalArbitrageService, MeanReversionSignal, MomentumSignal, WalkForwardResult, FactorAnalysis } from './statisticalArbitrageService';

export interface QuantitativeReport {
  code: string;
  timestamp: string;
  dataQuality: DataQualityReport;
  risk: RiskMetrics;
  microstructure: MicrostructureMetrics;
  meanReversion: MeanReversionSignal;
  momentum: MomentumSignal;
  walkForward: WalkForwardResult;
  factors: FactorAnalysis[];
  summary: {
    overallScore: number;          // 综合评分0-100
    riskLevel: 'low' | 'medium' | 'high';
    suitability: 'day_trading' | 'swing_trading' | 'position_trading' | 'unsuitable';
    keyInsight: string;            // 一句话核心洞察
    warnings: string[];            // 风险警告
  };
}

export class QuantitativeEngine {
  private dataQuality: DataQualityService;
  private risk: RiskManagementService;
  private microstructure: MarketMicrostructureService;
  private statisticalArbitrage: StatisticalArbitrageService;

  constructor() {
    this.dataQuality = new DataQualityService();
    this.risk = new RiskManagementService();
    this.microstructure = new MarketMicrostructureService();
    this.statisticalArbitrage = new StatisticalArbitrageService();
  }

  /**
   * 执行完整量化分析
   */
  analyze(params: {
    code: string;
    kline: any[];
    intraday?: any[];
    bid?: number;
    ask?: number;
    buy1Vol?: number;
    sell1Vol?: number;
  }): QuantitativeReport {
    const prices = params.kline
      .map(b => b.close)
      .filter((p: any): p is number => p != null && !isNaN(p) && p > 0);

    // 并行计算各模块
    const qualityReport = this.dataQuality.analyze(params.kline, params.code);
    const riskMetrics = this.risk.calculate(prices);
    const microMetrics = this.microstructure.calculate(
      params.kline, params.intraday,
      params.bid, params.ask,
      params.buy1Vol, params.sell1Vol
    );
    const meanReversion = this.statisticalArbitrage.analyzeMeanReversion(prices);
    const momentum = this.statisticalArbitrage.analyzeMomentum(prices);
    const walkForward = this.statisticalArbitrage.walkForwardTest(prices);
    const factors = this.statisticalArbitrage.analyzeFactors(prices);

    // 综合评分与总结
    const summary = this.generateSummary(qualityReport, riskMetrics, microMetrics, walkForward);

    return {
      code: params.code,
      timestamp: new Date().toISOString(),
      dataQuality: qualityReport,
      risk: riskMetrics,
      microstructure: microMetrics,
      meanReversion,
      momentum,
      walkForward,
      factors,
      summary,
    };
  }

  private generateSummary(
    quality: DataQualityReport,
    risk: RiskMetrics,
    micro: MicrostructureMetrics,
    wf: WalkForwardResult,
  ): QuantitativeReport['summary'] {
    // 综合评分
    const scores: number[] = [];
    scores.push(quality.overallScore * 0.3);       // 数据质量30%
    scores.push(Math.max(0, 100 - risk.var95 * 5) * 0.2); // VaR 20%
    scores.push(micro.liquidityScore * 0.2);         // 流动性20%
    scores.push(Math.min(100, Math.abs(wf.outSampleSharpe) * 30) * 0.15); // 回测15%
    scores.push(Math.min(100, Math.abs(risk.sharpeRatio) * 25) * 0.15);   // 夏普15%

    const totalScore = Math.round(scores.reduce((a, b) => a + b, 0));

    // 风险等级
    let riskLevel: 'low' | 'medium' | 'high';
    if (risk.annualVolatility < 20 && risk.maxDrawdown < 15) riskLevel = 'low';
    else if (risk.annualVolatility < 35 && risk.maxDrawdown < 30) riskLevel = 'medium';
    else riskLevel = 'high';

    // 适合策略
    let suitability: 'day_trading' | 'swing_trading' | 'position_trading' | 'unsuitable';
    if (risk.dailyVolatility > 2 && micro.liquidityScore > 50) suitability = 'day_trading';
    else if (risk.dailyVolatility > 1 && risk.sharpeRatio > 0) suitability = 'swing_trading';
    else if (risk.sharpeRatio > 0.3) suitability = 'position_trading';
    else suitability = 'unsuitable';

    // 核心洞察
    const keyInsight = this.generateKeyInsight(quality, risk, micro);

    // 警告
    const warnings: string[] = [];
    if (quality.overallScore < 60) warnings.push('数据质量偏低，分析结果可能不可靠');
    if (risk.var95 > 4) warnings.push(`日VaR ${risk.var95}%，尾部风险较高`);
    if (risk.maxDrawdown > 25) warnings.push(`历史最大回撤${risk.maxDrawdown}%，需严格风控`);
    if (micro.liquidityScore < 40) warnings.push('流动性较差，大额交易滑点成本高');
    if (wf.outSampleSharpe < 0) warnings.push('样本外回测为负，策略稳健性存疑');
    if (risk.kurtosis > 3) warnings.push('收益分布肥尾，极端行情风险高于正态分布预期');
    if (!wf.recommended) warnings.push('Walk-Forward测试未通过，谨慎使用机械策略');

    return {
      overallScore: totalScore,
      riskLevel,
      suitability,
      keyInsight,
      warnings,
    };
  }

  private generateKeyInsight(
    quality: DataQualityReport,
    risk: RiskMetrics,
    micro: MicrostructureMetrics,
  ): string {
    const parts: string[] = [];

    if (risk.sharpeRatio > 1) parts.push(`夏普${risk.sharpeRatio}表现优秀`);
    else if (risk.sharpeRatio > 0.5) parts.push(`夏普${risk.sharpeRatio}尚可`);
    else parts.push(`夏普${risk.sharpeRatio}偏低`);

    if (risk.annualVolatility < 20) parts.push('波动温和');
    else if (risk.annualVolatility < 35) parts.push('波动适中');
    else parts.push('波动较大');

    if (micro.liquidityScore > 70) parts.push('流动性好');
    else if (micro.liquidityScore > 40) parts.push('流动性一般');
    else parts.push('流动性差');

    if (risk.maxDrawdown < 10) parts.push('回撤控制好');
    else if (risk.maxDrawdown < 25) parts.push('回撤可控');

    return parts.join('，');
  }
}
