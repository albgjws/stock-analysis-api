/**
 * Value Quality Service
 * 
 * AI Berkshire quality-screen 自动评估服务
 * 打开股票时自动从东方财富API抓取财务数据，计算7项去劣指标
 */

import fs from "fs";
import path from "path";
import { StockDataService } from "./stockDataService";

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

export interface MastersScore {
  buffet: number;
  munger: number;
  duan: number;
  lulu: number;
  average: number;
}

export interface StrategyResult {
  master: string;
  style: string;
  description: string;
  action: "buy" | "hold" | "watch" | "avoid";
}

export interface RecommendationItem {
  level: string;
  levelLabel: string;
  action: string;
  priceRange: string;
  position: string;
  detail: string;
}

export interface QualityResult {
  overall: "PASS" | "MARGINAL" | "FAIL";
  totalScore: number;
  indicators: IndicatorResult[];
  exemptions: string[];
  mastersScore: MastersScore;
  financialSnapshot: Record<string, any>;
  commentary: string;
  strategy: StrategyResult;
  recommendations: RecommendationItem[];
}

export interface NoResultResponse {
  hasResult: false;
  code: string;
  name: string;
  prompt: string;
}

export type ValueQualityResponse = QualityResult | NoResultResponse;

/** 年度财务数据行 */
interface YearData {
  year: number;
  reportDate: string;
  totalRevenue: number;
  netProfit: number;
  roe: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  ocf: number | null;
  investCf: number | null;
  totalShares: number | null;
  interestCoverage: number | null;
  bps: number | null;
  eps: number | null;
  leverage: number | null;
  revenueGrowth: number | null;
}

export class ValueQualityService {
  private dataService: StockDataService;
  private dataDir: string;

  constructor() {
    this.dataService = new StockDataService();
    this.dataDir = path.resolve(process.cwd(), "data", "value-quality");
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch {}
  }

  async assess(code: string): Promise<ValueQualityResponse> {
    const cleanCode = code.replace(/^(sh|sz|bj|hk)/, "");
    const filePath = path.join(this.dataDir, cleanCode + ".json");

    // 检查是否存在已保存的结果
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(raw) as QualityResult;
      }
    } catch (err: any) {
      console.warn(`[ValueQuality] Failed to read cached: ${err.message}`);
    }

    // 无缓存 -> 自动抓取数据并执行评估
    console.log(`[ValueQuality] Auto-assessing ${cleanCode}...`);
    try {
      const result = await this.autoAssess(code);
      return result;
    } catch (err: any) {
      console.error(`[ValueQuality] Auto-assess failed: ${err.message}`);
      // 降级：返回无结果提示
      let name = "";
      try {
        const info = await this.dataService.getStockInfo(code);
        name = (info as any).name || "";
      } catch {}
      return {
        hasResult: false,
        code: cleanCode,
        name,
        prompt: `自动评估失败：${err.message}。请稍后重试。`,
      };
    }
  }

  async saveResult(code: string, result: QualityResult): Promise<void> {
    const cleanCode = code.replace(/^(sh|sz|bj|hk)/, "");
    const filePath = path.join(this.dataDir, cleanCode + ".json");
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(result, null, 2), "utf-8");
      console.log(`[ValueQuality] Saved for ${cleanCode}`);
    } catch (err: any) {
      console.error(`[ValueQuality] Save failed: ${err.message}`);
      throw err;
    }
  }

  // ===================== 自动评估 =====================

  async autoAssess(code: string): Promise<QualityResult> {
    const cleanCode = code.replace(/^(sh|sz|bj|hk)/, "");
    const market = code.startsWith("sh") ? "1" : "0";

    // 1. 获取股票基本信息
    let name = cleanCode;
    let info: any = {};
    try {
      info = await this.dataService.getStockInfo(code);
      name = (info as any).name || cleanCode;
    } catch {}

    // 2. 获取15年年度财务数据
    const yearDataList = await this.fetchFinancialData(cleanCode, market);
    if (yearDataList.length < 3) {
      throw new Error(`获取 ${name}(${cleanCode}) 财务数据不足`);
    }

    // 3. 计算7项指标
    const indicators = this.computeIndicators(yearDataList, name);
    const exemptResults = this.checkExemptions(indicators, yearDataList);

    // 4. 统计结果
    const failCount = indicators.filter(i => i.status === "FAIL").length;
    const marginalCount = indicators.filter(i => i.status === "MARGINAL").length;
    const totalScore = indicators.reduce((s, i) => s + i.score, 0);

    // 官方去劣筛选逻辑：FAIL >= 2 直接排除；FAIL = 1 边界通过(需豁免)；全部通过或仅微量边界为通过
    const overall: "PASS" | "MARGINAL" | "FAIL" =
      failCount >= 2 ? "FAIL" :
      failCount === 1 ? "MARGINAL" :
      marginalCount >= 3 ? "MARGINAL" :
      "PASS";

    // 5. 构建财务快照
    const last = yearDataList[0];
    const financialSnapshot: Record<string, any> = {
      "最新营收": last.totalRevenue ? (last.totalRevenue / 1e8).toFixed(2) + "亿" : "N/A",
      "最新净利润": last.netProfit ? (last.netProfit / 1e8).toFixed(2) + "亿" : "N/A",
      "最新毛利率": last.grossMargin !== null ? last.grossMargin.toFixed(2) + "%" : "N/A",
      "最新净利率": last.netMargin !== null ? last.netMargin.toFixed(2) + "%" : "N/A",
      "最新ROE": last.roe !== null ? last.roe.toFixed(2) + "%" : "N/A",
      "最新EPS": last.eps !== null ? last.eps.toFixed(2) : "N/A",
      "BPS": last.bps !== null ? last.bps.toFixed(2) : "N/A",
      "负债率": last.leverage !== null ? last.leverage.toFixed(1) + "%" : "N/A",
      "数据年份": last.year + "年报",
    };
    if (info.price) financialSnapshot["当前价"] = info.price;
    if (info.marketCap) financialSnapshot["市值"] = (info.marketCap * 1e8).toLocaleString() + "亿";
    if ((info as any).pe) financialSnapshot["PE"] = (info as any).pe;
    if ((info as any).pb) financialSnapshot["PB"] = (info as any).pb;

    // 6. 生成大师评分、策略、建议
    const mastersScore = this.computeMastersScore(indicators);
    const strategy = this.generateStrategy(overall, indicators, name);
    const recommendations = this.generateRecommendations(overall, indicators, info);
    const commentary = this.generateCommentary(name, cleanCode, overall, indicators, exemptResults);

    const result: QualityResult = {
      overall,
      totalScore,
      indicators,
      exemptions: exemptResults,
      mastersScore,
      financialSnapshot,
      commentary,
      strategy,
      recommendations,
    };

    // 7. 保存到文件
    await this.saveResult(code, result);
    return result;
  }

  // ===================== 财务数据抓取 =====================

  private async fetchFinancialData(code: string, market: string): Promise<YearData[]> {
    const secId = market + "." + code;
    const encodedSecId = encodeURIComponent(code + "." + (market === "0" ? "SZ" : "SH"));

    // 从东方财富数据中心API获取年报数据
    const columns = [
      "SECUCODE", "REPORT_DATE", "REPORT_TYPE",
      "TOTALOPERATEREVE", "PARENTNETPROFIT",
      "ROEJQ", "BPS", "EPSJB",
      "XSMLL", "XSJLL",
      "NETCASH_OPERATE_PK", "NETCASH_INVEST_PK",
      "TOTAL_SHARE", "INTSTCOVRATE", "ZCFZL",
      "DJD_TOI_YOY"
    ].join(",");

    const url = "https://datacenter-web.eastmoney.com/api/data/v1/get?" +
      "reportName=RPT_F10_FINANCE_MAINFINADATA" +
      "&columns=" + columns +
      "&pageNumber=1&pageSize=15" +
      "&sortTypes=-1&sortColumns=REPORT_DATE" +
      "&source=HSF10&client=PC" +
      "&filter=(SECUCODE=%22" + encodedSecId + "%22)(REPORT_TYPE=%22%E5%B9%B4%E6%8A%A5%22)";

    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://emweb.securities.eastmoney.com/"
      }
    });
    const data: any = await resp.json();

    if (!data.success || !data.result?.data) {
      throw new Error("无法获取财务数据: " + (data.message || "未知错误"));
    }

    const yearList: YearData[] = [];
    for (const item of data.result.data) {
      const year = parseInt(item.REPORT_DATE.substring(0, 4));
      if (isNaN(year)) continue;
      yearList.push({
        year,
        reportDate: item.REPORT_DATE,
        totalRevenue: item.TOTALOPERATEREVE || 0,
        netProfit: item.PARENTNETPROFIT || 0,
        roe: item.ROEJQ ?? null,
        grossMargin: item.XSMLL ?? null,
        netMargin: item.XSJLL ?? null,
        ocf: item.NETCASH_OPERATE_PK ?? null,
        investCf: item.NETCASH_INVEST_PK ?? null,
        totalShares: item.TOTAL_SHARE ?? null,
        interestCoverage: item.INTSTCOVRATE ?? null,
        bps: item.BPS ?? null,
        eps: item.EPSJB ?? null,
        leverage: item.ZCFZL ?? null,
        revenueGrowth: item.DJD_TOI_YOY ?? null,
      });
    }

    return yearList;
  }

  // ===================== 7项指标计算 =====================

  private computeIndicators(years: YearData[], name: string): IndicatorResult[] {
    // 取最近10年
    const recent10 = years.slice(0, 10).reverse();
    const recent5 = years.slice(0, 5);

    // --- 指标1: 10年平均ROE ---
    const roeValues = recent10.filter(y => y.roe !== null).map(y => y.roe!);
    const avgROE = roeValues.length >= 5 ? roeValues.reduce((a, b) => a + b, 0) / roeValues.length : null;
    const roeDataStr = recent10.map(y => y.year + "年 " + (y.roe !== null ? y.roe.toFixed(1) + "%" : "N/A")).join(", ");

    // --- 指标2: 5年累计自由现金流 ---
    const fcfValues = recent5.map(y => (y.ocf !== null ? y.ocf : 0) + (y.investCf !== null ? y.investCf : 0));
    const cumFCF = fcfValues.reduce((a, b) => a + b, 0);
    const fcfDataStr = recent5.map(y => y.year + "年 " + ((y.ocf !== null ? y.ocf + (y.investCf !== null ? y.investCf : 0) : 0) / 1e8).toFixed(1) + "亿").join(", ");

    // --- 指标3: 利息覆盖倍数 ---
    const icValues = years.filter(y => y.interestCoverage !== null).map(y => y.interestCoverage!);
    const latestIC = icValues.length > 0 ? icValues[0] : null;

    // --- 指标4: 长期毛利率 ---
    const grossValues = recent10.filter(y => y.grossMargin !== null).map(y => y.grossMargin!);
    const avgGross = grossValues.length >= 5 ? grossValues.reduce((a, b) => a + b, 0) / grossValues.length : null;
    const grossDataStr = recent10.map(y => y.year + "年 " + (y.grossMargin !== null ? y.grossMargin.toFixed(1) + "%" : "N/A")).join(", ");

    // --- 指标5: 经营现金流/净利润 ---
    const ocfnpValues = recent5.map(y => {
      if (y.ocf !== null && y.netProfit > 0) return y.ocf / y.netProfit;
      return null;
    }).filter(v => v !== null) as number[];
    const avgOcfNp = ocfnpValues.length >= 3 ? ocfnpValues.reduce((a, b) => a + b, 0) / ocfnpValues.length : null;
    const ocfnpDataStr = recent5.map((y, i) => {
      const ratio = y.ocf !== null && y.netProfit > 0 ? (y.ocf / y.netProfit).toFixed(2) : "N/A";
      return y.year + "年 " + ratio;
    }).join(", ");

    // --- 指标6: 长期净利率 ---
    const netValues = recent10.filter(y => y.netMargin !== null).map(y => y.netMargin!);
    const avgNet = netValues.length >= 5 ? netValues.reduce((a, b) => a + b, 0) / netValues.length : null;
    const netDataStr = recent10.map(y => y.year + "年 " + (y.netMargin !== null ? y.netMargin.toFixed(1) + "%" : "N/A")).join(", ");

    // --- 指标7: 5年总股本膨胀 ---
    const shareValues = years.filter(y => y.totalShares !== null).map(y => y.totalShares!);
    const shareChange = shareValues.length >= 2
      ? ((shareValues[0] - shareValues[shareValues.length - 1]) / shareValues[shareValues.length - 1]) * 100
      : null;

    const indicators: IndicatorResult[] = [];

    // 指标1: ROE
    const roeStatus: "PASS" | "FAIL" | "MARGINAL" = avgROE !== null && avgROE >= 8 ? "PASS" : avgROE !== null && avgROE >= 6 ? "MARGINAL" : "FAIL";
    indicators.push({
      id: 1, name: "10年平均ROE",
      desc: "资本效率——股东的钱能不能跑赢机会成本",
      value: avgROE !== null ? parseFloat(avgROE.toFixed(2)) : null,
      threshold: 8, unit: "%",
      status: roeStatus, score: roeStatus === "PASS" ? 15 : roeStatus === "MARGINAL" ? 6 : 3,
      note: `平均${avgROE !== null ? avgROE.toFixed(2) + "%" : "数据不足"}，阈值8%。历史数据: ${roeDataStr}`
    });

    // 指标2: FCF
    const fcfStatus: "PASS" | "FAIL" = cumFCF >= 0 ? "PASS" : "FAIL";
    indicators.push({
      id: 2, name: "5年累计自由现金流",
      desc: "真金白银——利润是不是纸面富贵",
      value: parseFloat((cumFCF / 1e8).toFixed(2)),
      threshold: 0, unit: "亿",
      status: fcfStatus, score: fcfStatus === "PASS" ? 15 : 2,
      note: `5年累计${cumFCF >= 0 ? "为" : ""}${(cumFCF / 1e8).toFixed(2)}亿，需为正。各年: ${fcfDataStr}`
    });

    // 指标3: 利息覆盖
    const icStatus: "PASS" | "FAIL" | "MARGINAL" = latestIC !== null && latestIC >= 2 ? "PASS" : latestIC !== null && latestIC >= 1 ? "MARGINAL" : "FAIL";
    indicators.push({
      id: 3, name: "利息覆盖倍数",
      desc: "偿债安全——还利息的能力",
      value: latestIC !== null ? parseFloat(latestIC.toFixed(1)) : null,
      threshold: 2, unit: "x",
      status: icStatus, score: icStatus === "PASS" ? 15 : icStatus === "MARGINAL" ? 8 : 3,
      note: latestIC !== null ? `最新${latestIC.toFixed(1)}x，阈值≥2x` : "数据不足"
    });

    // 指标4: 毛利率
    const grossStatus: "PASS" | "FAIL" | "MARGINAL" = avgGross !== null && avgGross >= 15 ? "PASS" : avgGross !== null && avgGross >= 10 ? "MARGINAL" : "FAIL";
    indicators.push({
      id: 4, name: "长期毛利率",
      desc: "定价权——产品/服务有没有差异化",
      value: avgGross !== null ? parseFloat(avgGross.toFixed(2)) : null,
      threshold: 15, unit: "%",
      status: grossStatus, score: grossStatus === "PASS" ? 15 : grossStatus === "MARGINAL" ? 8 : 3,
      note: `平均${avgGross !== null ? avgGross.toFixed(2) + "%" : "数据不足"}，阈值15%。各年: ${grossDataStr}`
    });

    // 指标5: OCF/NI
    const ocfStatus: "PASS" | "FAIL" | "MARGINAL" = avgOcfNp !== null && avgOcfNp >= 0.7 ? "PASS" : avgOcfNp !== null && avgOcfNp >= 0.5 ? "MARGINAL" : "FAIL";
    indicators.push({
      id: 5, name: "经营现金流/净利润",
      desc: "利润质量——赚到的利润能不能收回现金",
      value: avgOcfNp !== null ? parseFloat(avgOcfNp.toFixed(2)) : null,
      threshold: 0.7, unit: "",
      status: ocfStatus, score: ocfStatus === "PASS" ? 15 : ocfStatus === "MARGINAL" ? 8 : 3,
      note: `5年均值${avgOcfNp !== null ? avgOcfNp.toFixed(2) : "N/A"}，阈值≥0.7。各年: ${ocfnpDataStr}`
    });

    // 指标6: 净利率
    const netStatus: "PASS" | "FAIL" | "MARGINAL" = avgNet !== null && avgNet >= 5 ? "PASS" : avgNet !== null && avgNet >= 3 ? "MARGINAL" : "FAIL";
    indicators.push({
      id: 6, name: "长期净利率",
      desc: "抗风险能力——收入波动时利润是否归零",
      value: avgNet !== null ? parseFloat(avgNet.toFixed(2)) : null,
      threshold: 5, unit: "%",
      status: netStatus, score: netStatus === "PASS" ? 15 : netStatus === "MARGINAL" ? 8 : 3,
      note: `平均${avgNet !== null ? avgNet.toFixed(2) + "%" : "数据不足"}，阈值5%。各年: ${netDataStr}`
    });

    // 指标7: 股本膨胀
    const shareStatus: "PASS" | "FAIL" = shareChange !== null && shareChange <= 20 ? "PASS" : "FAIL";
    indicators.push({
      id: 7, name: "5年总股本膨胀",
      desc: "股东利益——管理层是否在稀释你的权益",
      value: shareChange !== null ? parseFloat(shareChange.toFixed(1)) : null,
      threshold: 20, unit: "%",
      status: shareStatus, score: shareStatus === "PASS" ? 15 : 0,
      note: shareChange !== null ? `总股本变化${shareChange.toFixed(1)}%，阈值≤20%` : "数据不足"
    });

    return indicators;
  }

  // ===================== 豁免检查 =====================

  private checkExemptions(indicators: IndicatorResult[], years: YearData[]): string[] {
    const exemptions: string[] = [];

    // 获取关键数据
    const roeInd = indicators.find(i => i.id === 1);
    const grossInd = indicators.find(i => i.id === 4);
    const netInd = indicators.find(i => i.id === 6);
    const ocfInd = indicators.find(i => i.id === 5);

    const latest2Years = years.slice(0, 2);
    const avgGross = grossInd?.value ?? 0;
    const avgNet = netInd?.value ?? 0;
    const avgRoe = roeInd?.value ?? 0;
    const avgOcfNi = ocfInd?.value ?? 0;

    // 检查最近2年经营现金流是否为正
    const recentOcfPositive = latest2Years.every(y => y.ocf !== null && y.ocf > 0);
    // 上市时间(简化: 用最早数据年份判断)
    const earliestYear = years.length > 0 ? Math.min(...years.map(y => y.year)) : 0;
    const listedLessThan10Y = (new Date().getFullYear() - earliestYear) < 10;

    // 豁免A: 战略投入期豁免(适用于ROE)
    if ((roeInd?.status === "FAIL" || roeInd?.status === "MARGINAL") && listedLessThan10Y && avgGross > 30 && recentOcfPositive) {
      exemptions.push("豁免A(战略投入期): ROE因投入期不达标，但毛利率>30%且经营现金流为正，豁免通过");
      roeInd.status = "PASS";
      roeInd.score = 10;
      roeInd.note += " 【豁免A通过】";
    }

    // 豁免B: 主动低利润率豁免(适用于净利率)
    if ((netInd?.status === "FAIL" || netInd?.status === "MARGINAL") && avgGross > 30) {
      // 检查最近2年净利率是否回升至5%以上
      const recentNetRising = latest2Years.every(y => y.netMargin !== null && y.netMargin >= 5);
      if (recentNetRising) {
        exemptions.push("豁免B(主动低利润率): 净利率虽低但毛利率>30%有定价权，近年已回升至5%以上，豁免通过");
        netInd!.status = "PASS";
        netInd!.score = 10;
        netInd!.note += " 【豁免B通过】";
      }
    }

    // 豁免C: 高周转薄利模式豁免(适用于毛利率和净利率)
    if (avgRoe > 20 && avgOcfNi > 1.0) {
      exemptions.push("豁免C(高周转薄利): ROE>20%且OCF/NI>1.0，属于高周转薄利模式，豁免毛利率和净利率");
      if (grossInd?.status === "FAIL" || grossInd?.status === "MARGINAL") {
        grossInd!.status = "PASS";
        grossInd!.score = Math.max(grossInd!.score, 10);
        grossInd!.note += " 【豁免C通过】";
      }
      if (netInd?.status === "FAIL" || netInd?.status === "MARGINAL") {
        netInd!.status = "PASS";
        netInd!.score = Math.max(netInd!.score, 10);
        netInd!.note += " 【豁免C通过】";
      }
    }

    return exemptions;
  }

  // ===================== 大师评分 =====================

  private computeMastersScore(indicators: IndicatorResult[]): MastersScore {
    const failCount = indicators.filter(i => i.status === "FAIL").length;
    const marginalCount = indicators.filter(i => i.status === "MARGINAL").length;
    const passCount = indicators.filter(i => i.status === "PASS").length;

    // 根据整体判定调整基础分：排除→低分，通过→高分
    let baseScore: number;
    if (failCount >= 2) {
      baseScore = 1;  // 排除
    } else if (failCount === 1) {
      baseScore = 2;  // 边界
    } else if (marginalCount >= 3) {
      baseScore = 2;  // 多项边界
    } else {
      baseScore = Math.min(5, Math.max(3, Math.round(passCount * 5 / 7)));
    }

    return {
      buffet: Math.min(5, baseScore + (indicators[0]?.status === "PASS" ? (failCount >= 2 ? 0 : 1) : 0)),
      munger: Math.min(5, baseScore + (indicators[4]?.status === "PASS" ? (failCount >= 2 ? 0 : 1) : 0)),
      duan: Math.min(5, baseScore + (indicators[3]?.status === "PASS" ? (failCount >= 2 ? 0 : 1) : 0)),
      lulu: Math.min(5, baseScore + (indicators[6]?.status === "PASS" ? (failCount >= 2 ? 0 : 1) : 0)),
      average: 0,
    };
  }

  // ===================== 策略生成 =====================

  private generateStrategy(overall: string, indicators: IndicatorResult[], name: string): StrategyResult {
    const failItems = indicators.filter(i => i.status === "FAIL");
    const passItems = indicators.filter(i => i.status === "PASS");

    if (overall === "PASS") {
      return {
        master: "巴菲特-芒格",
        style: "质量达标——可继续深入",
        description: `${name}通过了7项去劣筛选（快速排除通过）。若股价异动，可用 news-pulse 归因。值得深入时，再运行 investment-research 或 investment-team 做后续研究。`,
        action: "watch",
      };
    } else if (overall === "MARGINAL") {
      return {
        master: "段永平-李录",
        style: "边界通过——谨慎决策",
        description: `${name}去劣筛选处于边界状态，建议用 news-pulse 监控异动。若认为结果值得深入，再运行 investment-research 或 investment-team 做后续研究。`, 
        action: "watch",
      };
    } else {
      const failReasons = failItems.map(i => i.name).join("、");
      return {
        master: "巴菲特-芒格",
        style: "排除——不满足一流公司标准",
        description: `${name}未通过去劣筛选（快速排除），问题指标: ${failReasons}。通常应停止研究。若发生重大股价异动，可用 news-pulse 归因判断是否有实质变化。`,
        action: "avoid",
      };
    }
  }

  // ===================== 分层建议 =====================

  private generateRecommendations(
    overall: string,
    indicators: IndicatorResult[],
    info: any
  ): RecommendationItem[] {
    const price = info?.price || 0;
    const pe = (info as any)?.pe || null;

    if (overall === "PASS") {
      return [
        { level: "A", levelLabel: "值得继续", action: "运行 investment-research", priceRange: pe && pe < 15 ? "估值合理区间" : "等待估值回落", position: "不超过10%", detail: "质量达标，值得用四大师框架深入分析" },
        { level: "B", levelLabel: "异动监控", action: "运行 news-pulse", priceRange: pe && pe < 20 ? "当前价附近" : "观望", position: "不超过5%", detail: "质量好，关注股价异动归因" },
        { level: "C", levelLabel: "团队分析", action: "运行 investment-team", priceRange: "低于买入价15%", position: "清仓", detail: "让四角色并行分析确认" },
      ];
    } else if (overall === "MARGINAL") {
      return [
        { level: "A", levelLabel: "深入条件", action: "若值得→investment-research", priceRange: "等待更多信号", position: "0%", detail: "边界通过，仅当认为值得深入时运行" },
        { level: "B", levelLabel: "异动监控", action: "运行 news-pulse", priceRange: price ? "当前价附近" : "N/A", position: "不超过3%", detail: "先用 news-pulse 归因判断是否有催化剂" },
        { level: "C", levelLabel: "止损/回避", action: "回避", priceRange: price ? "当前价" : "N/A", position: "不持仓", detail: "质量存疑" },
      ];
    } else {
      return [
        { level: "A", levelLabel: "暂时排除", action: "停止研究", priceRange: "等待ROE/FCF改善", position: "0%", detail: "去劣筛选未通过，通常应停止研究" },
        { level: "B", levelLabel: "异动监控", action: "运行 news-pulse", priceRange: "仅当股价剧烈波动时", position: "0%", detail: "发生重大异动时用 news-pulse 判断是否有实质变化" },
        { level: "C", levelLabel: "止损/回避", action: "回避", priceRange: price ? "当前价" : "N/A", position: "不持仓", detail: "去劣筛选不通过" },
      ];
    }
  }

  // ===================== 评语生成 =====================

  private generateCommentary(
    name: string, code: string,
    overall: string, indicators: IndicatorResult[],
    exemptions: string[]
  ): string {
    const pass = indicators.filter(i => i.status === "PASS").length;
    const fail = indicators.filter(i => i.status === "FAIL").length;
    const marginal = indicators.filter(i => i.status === "MARGINAL").length;

    const failNames = indicators.filter(i => i.status === "FAIL").map(i => i.name).join("、");
    const marginalNames = indicators.filter(i => i.status === "MARGINAL").map(i => i.name).join("、");

    let summary = `${name}(${code})在7项去劣指标中：${pass}项通过`;
    if (marginal > 0) summary += `、${marginal}项边界`;
    if (fail > 0) summary += `、${fail}项未通过`;
    summary += "。";

    if (overall === "PASS") summary += " 整体通过筛选，具备一流公司的基本财务特质。";
    else if (overall === "MARGINAL") summary += ` 整体处于临界状态。${marginalNames ? "关注指标: " + marginalNames : ""}`;
    else summary += ` 整体未通过筛选。问题指标: ${failNames}。`;

    if (exemptions.length > 0) summary += " 触发" + exemptions.length + "项豁免规则。";

    summary += " ｜AI Berkshire 流程：先用 /quality-screen 快速排除 → 股价异动时用 /news-pulse 归因 → 值得深入时用 /investment-research 或 $investment-team 继续研究。注意：去劣筛选仅评估财务指标，不评估管理层。需另用 management-deep-dive 评估管理层。";

    return summary;
  }

  // ===================== 手动重算 =====================

  async recalculate(code: string): Promise<QualityResult> {
    const result = await this.autoAssess(code);
    return result;
  }
}
