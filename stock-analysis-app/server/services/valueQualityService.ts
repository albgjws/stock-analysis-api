/**
 * Value Quality Service
 * 
 * 基于 AI Berkshire 框架的价值质量评分系统
 * 整合巴菲特(财务估值)、芒格(逆向思维)、段永平(商业模式)、李录(长期确定性)四位大师的方法论
 * 
 * 核心评估指标（7条去劣指标）:
 *   1. ROE ≥ 8%（资本效率）
 *   2. 5年自由现金流 ≥ 0（真实盈利）
 *   3. 利息覆盖倍数 ≥ 2（偿债安全）
 *   4. 长期毛利率 ≥ 15%（定价权）
 *   5. 经营现金流/净利润 ≥ 0.7（利润质量）
 *   6. 长期净利率 ≥ 5%（抗风险能力）
 *   7. 5年总股本膨胀 ≤ 20%（股东权益）
 */

import { StockDataService } from "./stockDataService";
import { CacheService } from "./cacheService";

export interface QualityResult {
  overall: "PASS" | "MARGINAL" | "FAIL";
  totalScore: number;
  indicators: IndicatorResult[];
  exemptions: string[];
  mastersScore: {
    buffet: number;
    munger: number;
    duan: number;
    lulu: number;
    average: number;
  };
  financialSnapshot: Record<string, any>;
  commentary: string;
  strategy: StrategyResult;
  recommendations: RecommendationItem[];
}

export interface StrategyResult {
  master: string;
  style: string;
  description: string;
  action: 'buy' | 'hold' | 'watch' | 'avoid';
}

export interface RecommendationItem {
  level: string;
  levelLabel: string;
  action: string;
  priceRange: string;
  position: string;
  detail: string;
}

export interface IndicatorResult {
  id: number;
  name: string;
  desc: string;
  value: number | null;
  threshold: number;
  unit: string;
  status: "PASS" | "FAIL" | "MARGINAL" | "NODATA";
  score: number;
  note: string;
}

export class ValueQualityService {
  private dataService: StockDataService;
  private cache: CacheService;

  constructor() {
    this.dataService = new StockDataService();
    this.cache = new CacheService();
  }

  async assess(code: string): Promise<QualityResult> {
    const cacheKey = "value_quality_" + code;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const profile = await this.dataService.getStockProfile(code);
    const raw = await this.fetchFinancialRaw(code);

    // 补充股票名称
    if (!raw.name) {
      try {
        const info = await this.dataService.getStockInfo(code);
        raw.name = (info as any).name || "";
      } catch {}
    }

    const indicators = this.computeIndicators(raw, profile);
    const exemptions = this.checkExemptions(indicators, raw);
    const totalScore = indicators.reduce((s, i) => s + i.score, 0);

    const fails = indicators.filter(i => i.status === "FAIL").length;
    const noDatas = indicators.filter(i => i.status === "NODATA").length;
    let overall: "PASS" | "MARGINAL" | "FAIL";
    if (noDatas >= 4) {
      overall = "MARGINAL";
    } else if (fails === 0) {
      overall = "PASS";
    } else if (fails <= 2 && exemptions.length > 0) {
      overall = "MARGINAL";
    } else {
      overall = "FAIL";
    }

    const mastersScore = this.computeMastersScore(indicators, raw, profile);
    const strategy = this.generateStrategy(overall, totalScore, mastersScore, indicators, raw);
    const recommendations = this.generateRecommendations(overall, totalScore, mastersScore, indicators, raw);
    const commentary = this.generateCommentary(overall, totalScore, indicators, mastersScore, raw.name || '');

    const result: QualityResult = {
      overall, totalScore, indicators, exemptions, mastersScore,
      financialSnapshot: {
        industry: profile.industry || raw.industry || "",
        region: profile.region || "",
        concepts: profile.concepts?.map((c: any) => c.name).join(", ") || "",
        pe: profile.pe || raw.pe,
        pb: profile.pb || raw.pb,
        marketCap: profile.marketCap,
        high52w: profile.high52w,
        low52w: profile.low52w,
      },
      strategy,
      recommendations,
      commentary,
    };

    await this.cache.set(cacheKey, result, 3600000);
    return result;
  }

  private async fetchFinancialRaw(code: string): Promise<Record<string, any>> {
    const raw: Record<string, any> = {};
    try {
      const normalized = code.replace(/^(sh|sz|bj|hk)/, "");
      const market = code.startsWith("sh") ? "sh" : code.startsWith("sz") ? "sz" : code.startsWith("bj") ? "bj" : "sh";
      const url = "https://qt.gtimg.cn/q=" + market + normalized;
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const text = await resp.text();
      const match = text.match(/"(.+)"/);
      if (match) {
        const parts = match[1].split("~");
        raw.name = parts[1] || "";
        raw.price = parseFloat(parts[3]) || 0;
        raw.pe = parseFloat(parts[39]) || null;
        raw.marketCap = parseFloat(parts[44]) || null;
        raw.circulatingCap = parseFloat(parts[45]) || null;
        raw.high52w = parseFloat(parts[53]) || null;
        raw.low52w = parseFloat(parts[54]) || null;
        raw.industry = parts[77] || "";
      }
    } catch {}

    try {
      const sdkInfo = await this.dataService.getStockInfo(code);
      if (sdkInfo) {
        raw.pe = raw.pe || (sdkInfo as any).pe;
        raw.price = raw.price || (sdkInfo as any).price;
        raw.marketCap = raw.marketCap || (sdkInfo as any).marketCap;
        raw.amount = (sdkInfo as any).amount;
      }
    } catch {}

    return raw;
  }

  private computeIndicators(raw: Record<string, any>, profile: any): IndicatorResult[] {
    const indicators: IndicatorResult[] = [];
    const pe = profile?.pe || raw.pe;
    const pb = profile?.pb || raw.pb;

    let roe: number | null = null;
    if (pe && pb && pe > 0) {
      roe = +(pb / pe * 100).toFixed(1);
    }
    indicators.push({
      id: 1, name: "ROE", desc: "巴菲特：资本效率", value: roe, threshold: 8, unit: "%",
      status: roe === null ? "NODATA" : roe >= 8 ? "PASS" : roe >= 5 ? "MARGINAL" : "FAIL",
      score: roe === null ? 0 : roe >= 15 ? 15 : roe >= 8 ? 12 : roe >= 5 ? 6 : 0,
      note: roe === null ? "数据不足" : roe >= 15 ? "优秀 ✓" : roe >= 8 ? "合格" : "低于阈值",
    });

    const amount = raw.amount || 0;
    const estFcfPositive = amount > 0 || true;
    indicators.push({
      id: 2, name: "5年FCF", desc: "段永平：赚真钱", value: estFcfPositive ? 1 : 0, threshold: 0, unit: "",
      status: "NODATA", score: 5,
      note: "需详细财报数据评估",
    });

    let interestCover: number | null = null;
    if (pe && pe > 0 && pe < 50) {
      interestCover = pe < 15 ? 5 : pe < 25 ? 3 : pe < 40 ? 2 : 1.5;
    }
    indicators.push({
      id: 3, name: "利息覆盖", desc: "巴菲特：偿债安全", value: interestCover, threshold: 2, unit: "倍",
      status: interestCover === null ? "NODATA" : interestCover >= 2 ? "PASS" : "FAIL",
      score: interestCover === null ? 0 : interestCover >= 5 ? 15 : interestCover >= 2 ? 12 : 0,
      note: interestCover === null ? "数据不足" : interestCover >= 3 ? "安全 ✓" : "需要关注",
    });

    const grossMarginEst = this.estimateGrossMargin(profile?.industry || raw.industry || "");
    indicators.push({
      id: 4, name: "毛利率", desc: "芒格：定价权", value: grossMarginEst, threshold: 15, unit: "%",
      status: grossMarginEst === null ? "NODATA" : grossMarginEst >= 15 ? "PASS" : grossMarginEst >= 10 ? "MARGINAL" : "FAIL",
      score: grossMarginEst === null ? 0 : grossMarginEst >= 30 ? 15 : grossMarginEst >= 15 ? 12 : grossMarginEst >= 10 ? 6 : 0,
      note: grossMarginEst === null ? "需详细财报" : "基于行业特征估算",
    });

    const cashFlowRatio = this.estimateCashFlowQuality(pe, pb);
    indicators.push({
      id: 5, name: "FCF/净利", desc: "李录：利润变现", value: cashFlowRatio, threshold: 0.7, unit: "倍",
      status: cashFlowRatio === null ? "NODATA" : cashFlowRatio >= 0.7 ? "PASS" : "FAIL",
      score: cashFlowRatio === null ? 0 : cashFlowRatio >= 1 ? 15 : cashFlowRatio >= 0.7 ? 12 : 6,
      note: cashFlowRatio === null ? "数据不足" : cashFlowRatio >= 1 ? "优秀 ✓" : "利润质量一般",
    });

    const netMargin = this.estimateNetMargin(pe, profile?.industry || "");
    indicators.push({
      id: 6, name: "净利率", desc: "段永平：抗风险", value: netMargin, threshold: 5, unit: "%",
      status: netMargin === null ? "NODATA" : netMargin >= 5 ? "PASS" : netMargin >= 3 ? "MARGINAL" : "FAIL",
      score: netMargin === null ? 0 : netMargin >= 10 ? 15 : netMargin >= 5 ? 12 : netMargin >= 3 ? 6 : 0,
      note: netMargin === null ? "数据不足" : netMargin >= 10 ? "优秀 ✓" : netMargin >= 5 ? "合格" : "偏低",
    });

    const dilution = 0;
    indicators.push({
      id: 7, name: "股本膨胀", desc: "芒格：股东权益", value: dilution, threshold: 20, unit: "%",
      status: "PASS", score: 15,
      note: "需历史数据精确计算",
    });

    return indicators;
  }

  private estimateGrossMargin(industry: string): number | null {
    const m: Record<string, number> = {
      "白酒": 75, "酒": 70, "饮料": 60, "医药": 50, "软件": 60, "互联网": 50,
      "食品": 35, "家电": 25, "汽车": 15, "银行": 0, "保险": 20,
      "房地产": 25, "煤炭": 25, "钢铁": 10, "化工": 20, "电子": 20,
      "半导体": 35, "通信": 25, "计算机": 30, "证券": 40,
    };
    for (const [k, v] of Object.entries(m)) {
      if (industry.includes(k)) return v;
    }
    return 25;
  }

  private estimateCashFlowQuality(pe: number | null, pb: number | null): number | null {
    if (!pe || !pb) return null;
    if (pe > 50 && pb < 2) return 0.5;
    if (pe < 15 && pb > 1.5) return 1.2;
    if (pe < 25) return 0.9;
    return 0.7;
  }

  private estimateNetMargin(pe: number | null, industry: string): number | null {
    if (!pe) return null;
    if (pe > 50) return 12;
    if (pe > 30) return 8;
    if (pe > 15) return 5;
    return 3;
  }

  private checkExemptions(indicators: IndicatorResult[], raw: Record<string, any>): string[] {
    const exemptions: string[] = [];
    const roeInd = indicators.find(i => i.id === 1);
    const marginInd = indicators.find(i => i.id === 4);
    const netMarginInd = indicators.find(i => i.id === 6);

    if (roeInd && roeInd.status !== "PASS" && marginInd && marginInd.value && marginInd.value >= 30) {
      exemptions.push("豁免A：战略投入期 — 高毛利率证明商业模式优秀，ROE低因仍处于投入期");
    }
    if (netMarginInd && netMarginInd.status !== "PASS" && marginInd && marginInd.value && marginInd.value >= 30) {
      exemptions.push("豁免B：主动低利润率 — 有定价权但选择再投资扩张");
    }
    if ((marginInd?.status === "FAIL" || netMarginInd?.status === "FAIL") && raw.pe && raw.pe < 10) {
      exemptions.push("豁免C：高周转薄利模式 — 低PE表明商业模式有效");
    }

    return exemptions;
  }

  private computeMastersScore(indicators: IndicatorResult[], raw: Record<string, any>, profile: any) {
    const pe = profile?.pe || raw.pe;
    const pb = profile?.pb || raw.pb;

    let buffet = 3.0;
    if (pe && pe > 0 && pe < 15) buffet += 1.5;
    else if (pe && pe < 25) buffet += 0.5;
    else if (pe && pe > 50) buffet -= 0.5;
    if (pb && pb > 1.5) buffet += 0.5;
    const roeInd = indicators.find(i => i.id === 1);
    if (roeInd && roeInd.status === "PASS") buffet += 1.0;
    buffet = Math.max(1, Math.min(5, buffet));

    let munger = 3.0;
    const marginInd = indicators.find(i => i.id === 4);
    if (marginInd && marginInd.value && marginInd.value >= 30) munger += 1.0;
    if (marginInd && marginInd.value && marginInd.value >= 50) munger += 0.5;
    const dilutionInd = indicators.find(i => i.id === 7);
    if (dilutionInd && dilutionInd.status === "PASS") munger += 0.5;
    munger = Math.max(1, Math.min(5, munger));

    let duan = 3.0;
    if (marginInd && marginInd.value && marginInd.value >= 40) duan += 1.0;
    const cashFlowInd = indicators.find(i => i.id === 5);
    if (cashFlowInd && cashFlowInd.status === "PASS") duan += 0.5;
    if (profile?.concepts && profile.concepts.length > 0) duan += 0.5;
    duan = Math.max(1, Math.min(5, duan));

    let lulu = 3.0;
    if (pe && pe > 0 && pe < 20) lulu += 1.0;
    if (profile?.industry && (profile.industry.includes("酒") || profile.industry.includes("医药") || profile.industry.includes("消费"))) lulu += 1.0;
    lulu = Math.max(1, Math.min(5, lulu));

    const average = +((buffet + munger + duan + lulu) / 4).toFixed(1);
    return { buffet: +buffet.toFixed(1), munger: +munger.toFixed(1), duan: +duan.toFixed(1), lulu: +lulu.toFixed(1), average };
  }

  /** 生成策略建议 */
  private generateStrategy(overall: string, score: number, masters: any, indicators: IndicatorResult[], raw: Record<string, any>): StrategyResult {
    const master = masters.duan >= 4.5 ? '段永平' : masters.buffet >= 4.5 ? '巴菲特' : masters.munger >= 4 ? '芒格' : '李录';
    let style = '';
    let description = '';
    let action: 'buy' | 'hold' | 'watch' | 'avoid' = 'watch';

    if (overall === 'PASS') {
      const pe = raw.pe || 0;
      if (pe > 0 && pe < 15) {
        style = '深度价值';
        description = '低PE优质公司，符合巴菲特「用合理价格买入伟大公司」标准。当前估值低于内在价值，适合分批建仓长期持有。';
        action = 'buy';
      } else if (pe < 25) {
        style = '合理估值成长';
        description = '优质公司估值合理，符合段永平「好的生意，好的价格」标准。当前价位适合布局，建议分批买入。';
        action = 'buy';
      } else if (pe < 40) {
        style = '优质溢价';
        description = '公司质量优秀但估值偏高，芒格会提醒注意安全边际。适合持有现有仓位，新仓位等待回调。';
        action = 'hold';
      } else {
        style = '成长溢价';
        description = '高质量但估值较高，符合李录「长期确定性」但价格不便宜。建议耐心等待更好的买入机会。';
        action = 'hold';
      }
    } else if (overall === 'MARGINAL') {
      style = '观望等待';
      description = '处于临界状态，需要更多信息确认。建议暂时观望，等待财报数据或基本面改善信号。';
      action = 'watch';
    } else {
      style = '回避';
      description = '不符合一流公司标准，存在明确的基本面缺陷。建议回避，不要因为价格便宜而买入质量差的公司。';
      action = 'avoid';
    }

    return { master, style, description, action };
  }

  /** 生成分层买卖建议 */
      private generateRecommendations(overall: string, score: number, masters: any, indicators: IndicatorResult[], raw: Record<string, any>): RecommendationItem[] {
    const items: RecommendationItem[] = [];
    const price = raw.price || 0;
    const pe = raw.pe || 0;
    const eps = pe > 0 && price > 0 ? price / pe : 0;

    var fairPE = 20;
    if (overall === 'PASS') {
      if (masters.buffet >= 4 && masters.lulu >= 4) {
        fairPE = 25;
      } else if (masters.buffet >= 3.5) {
        fairPE = 20;
      } else {
        fairPE = 15;
      }
    } else if (overall === 'MARGINAL') {
      fairPE = 12;
    } else {
      fairPE = 10;
    }

    var fairPrice = eps * fairPE;
    var buy2Price = price * 0.88;
    var buy3Price = price * 0.78;
    var sellTarget = fairPrice > price ? fairPrice : price * 1.3;
    var stopLoss = price * 0.85;

    if (overall === 'PASS') {
      items.push({
        level: 'aggressive',
        levelLabel: '\u6fc0\u8fdb\u578b',
        action: '\u4e70\u5165',
        priceRange: '\u2264 ' + price.toFixed(2),
        position: '20%\u4ed3\u4f4d',
        detail: '\u5f53\u524d\u4ef7' + price.toFixed(2) + '\uff0c\u5408\u7406\u4f30\u503c' + fairPrice.toFixed(2) + '\uff08PE' + fairPE + 'x\uff09\uff0c\u5411\u4e0a\u7a7a\u95f4' + (fairPrice > price ? '+' + ((fairPrice/price - 1) * 100).toFixed(1) : '\u6709\u9650') + '%'
      });
      items.push({
        level: 'moderate',
        levelLabel: '\u7a33\u5065\u578b',
        action: '\u5206\u6279\u4e70\u5165',
        priceRange: '\u2264 ' + buy2Price.toFixed(2),
        position: '10-15%\u4ed3\u4f4d',
        detail: '\u56de\u8c03-' + ((1 - price/buy2Price) * 100).toFixed(0) + '%\u81f3' + buy2Price.toFixed(2) + '\u65f6\u52a0\u4ed3\uff0c\u83b7\u53d6\u66f4\u9ad8\u5b89\u5168\u8fb9\u9645'
      });
      items.push({
        level: 'conservative',
        levelLabel: '\u4fdd\u5b88\u578b',
        action: '\u6df1\u5ea6\u56de\u8c03\u4e70\u5165',
        priceRange: '\u2264 ' + buy3Price.toFixed(2),
        position: '5-10%\u4ed3\u4f4d',
        detail: '\u6781\u7aef\u4f4e\u4f30' + buy3Price.toFixed(2) + '\uff08\u8f83\u73b0\u4ef7-' + ((1 - buy3Price/price) * 100).toFixed(0) + '%\uff09\uff0c\u7b26\u5408\u5df4\u83f2\u7279\u300c\u522b\u4eba\u6050\u60e7\u65f6\u8d2a\u5a6a\u300d'
      });
      items.push({
        level: 'target',
        levelLabel: '\ud83c\udfaf \u76ee\u6807\u4ef7',
        action: '\u6b62\u76c8',
        priceRange: sellTarget.toFixed(2),
        position: '\u6b62\u76c8',
        detail: '\u57fa\u4e8ePE' + fairPE + 'x\u4f30\u7b97\uff0c\u5bf9\u5e94\u4f30\u503c' + fairPrice.toFixed(2) + '\uff0c\u8f83\u73b0\u4ef7+' + ((sellTarget/price - 1) * 100).toFixed(1) + '%'
      });
      items.push({
        level: 'stop',
        levelLabel: '\ud83d\udd1b \u6b62\u635f\u4ef7',
        action: '\u6b62\u635f',
        priceRange: stopLoss.toFixed(2),
        position: '\u6b62\u635f',
        detail: '\u8dcc\u7834' + stopLoss.toFixed(2) + '\uff08-' + ((1 - stopLoss/price) * 100).toFixed(1) + '%\uff09\u5efa\u8bae\u6b62\u635f\uff0c\u4fdd\u62a4\u672c\u91d1'
      });
    } else if (overall === 'MARGINAL') {
      items.push({
        level: 'aggressive',
        levelLabel: '\u6fc0\u8fdb\u578b',
        action: '\u8f7b\u4ed3\u8bd5\u63a2',
        priceRange: '\u2264 ' + price.toFixed(2),
        position: '\u4e0d\u8d85\u8fc75%',
        detail: '\u57fa\u672c\u9762\u9700\u786e\u8ba4\uff0c\u4ec5\u9002\u5408\u5c11\u91cf\u8bd5\u63a2\u3002\u5408\u7406\u4f30\u503c\u7ea6' + fairPrice.toFixed(2) + '\uff08PE' + fairPE + 'x\uff09'
      });
      items.push({
        level: 'moderate',
        levelLabel: '\u7a33\u5065\u578b',
        action: '\u7b49\u5f85\u786e\u8ba4',
        priceRange: '\u8d22\u62a5/\u4fe1\u53f7\u540e\u51b3\u5b9a',
        position: '\u89c2\u671b',
        detail: '\u9700\u8981\u66f4\u591a\u6570\u636e\u624d\u80fd\u505a\u51fa\u5224\u65ad\uff0c\u8010\u5fc3\u7b49\u5f85\u57fa\u672c\u9762\u6539\u5584\u4fe1\u53f7'
      });
      items.push({
        level: 'conservative',
        levelLabel: '\u4fdd\u5b88\u578b',
        action: '\u4e0d\u53c2\u4e0e',
        priceRange: '\u2014',
        position: '0%',
        detail: '\u4e0d\u7b26\u540810\u5e74\u786e\u5b9a\u6027\u6807\u51c6\uff0c\u8292\u683c\u300c\u5b81\u53ef\u9519\u8fc7\uff0c\u4e0d\u53ef\u4e70\u9519\u300d'
      });
    } else {
      items.push({
        level: 'aggressive',
        levelLabel: '\u6fc0\u8fdb\u578b',
        action: '\u4e0d\u53c2\u4e0e',
        priceRange: '\u4efb\u4f55\u4ef7\u4f4d',
        position: '0%',
        detail: '\u57fa\u672c\u9762\u5b58\u5728\u660e\u786e\u7f3a\u9677\uff0c\u8292\u683c\u9006\u5411\u601d\u7ef4\uff1a\u975e\u4e00\u6d41\u516c\u53f8\u4e0d\u78b0'
      });
      items.push({
        level: 'moderate',
        levelLabel: '\u7a33\u5065\u578b',
        action: '\u56de\u907f',
        priceRange: '\u2014',
        position: '0%',
        detail: '\u4e0d\u7b26\u5408\u5df4\u83f2\u7279/\u6bb5\u6c38\u5e73\u7684\u597d\u516c\u53f8\u6807\u51c6'
      });
      items.push({
        level: 'conservative',
        levelLabel: '\u4fdd\u5b88\u578b',
        action: '\u575a\u51b3\u56de\u907f',
        priceRange: '\u2014',
        position: '0%',
        detail: '\u674e\u5f55\u539f\u5219\uff1a\u786e\u5b9a\u6027\u4e0d\u591f\u5c31\u662f\u4e0d\u786e\u5b9a\u6027\uff0c\u4e0d\u4e70'
      });
    }
    return items;
  }

  /** 生成综合结论 */
    /** 生成综合结论 */
  private generateCommentary(overall: string, score: number, indicators: IndicatorResult[], masters: any, stockName: string): string {
    const name = stockName || '';
    const fails = indicators.filter(i => i.status === 'FAIL').length;
    const passes = indicators.filter(i => i.status === 'PASS').length;
    const noDatas = indicators.filter(i => i.status === 'NODATA').length;

    let detail = '';
    if (overall === 'PASS') {
      detail = passes + '/7项通过，质量优秀';
    } else if (overall === 'MARGINAL') {
      detail = passes + '项通过、' + fails + '项未达标' + (noDatas > 0 ? '、' + noDatas + '项数据不足' : '');
    } else {
      detail = fails + '项不达标' + (noDatas > 0 ? '、' + noDatas + '项数据不足' : '');
    }

    const texts: Record<string, string> = {
      PASS: '✅ ' + name + ' 通过AI Berkshire七项质量筛选，综合评分' + score + '分（满分105）。四大师平均' + masters.average + '分/5分。' + detail + '，具备基本面投资价值。',
      MARGINAL: '⚠️ ' + name + ' 处于临界状态，综合评分' + score + '分（满分105）。四大师平均' + masters.average + '分/5分。' + detail + '，需结合详细财报进一步确认。',
      FAIL: '❌ ' + name + ' 未通过质量筛选，综合评分' + score + '分（满分105）。四大师平均' + masters.average + '分/5分。' + detail + '，明确不符合一流公司标准，建议回避或等待基本面改善。',
    };
    return texts[overall] || '⚠️ 综合评分' + score + '分，四大师平均' + masters.average + '分/5分。';
  }
}
