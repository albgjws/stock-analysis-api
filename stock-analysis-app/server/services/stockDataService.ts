import { StockSDK } from 'stock-sdk';
import { CacheService } from './cacheService';
import { config } from '../config';
import type { SearchResultItem, StockInfo, KlineBar } from '../types';

export class StockDataService {
  private sdk: StockSDK;
  private cache: CacheService;
  private stockListCache: SearchResultItem[] | null = null;

  constructor() {
    this.sdk = new StockSDK({
      retry: { maxRetries: 0 },
    });
    this.cache = new CacheService();
  }

  /**
   * Search for stocks by keyword (code, name, or pinyin)
   * 支持 A股 + 港股
   */
  async searchStocks(keyword: string): Promise<SearchResultItem[]> {
    try {
      const results = await this.sdk.search(keyword);
      return results
        .filter((r: any) =>
          r.category === 'stock' &&
          (r.type === 'GP-A' || r.type === 'GP')  // A股 + 港股
        )
        .map((r: any) => {
          const prefix = r.code.match(/^(sh|sz|bj|hk)/)?.[1] || 'sh';
          return {
            code: r.code.replace(/^(sh|sz|bj|hk)/, ''),
            name: r.name,
            market: prefix,
            type: r.type,
          };
        });
    } catch (err) {
      console.error('[StockData] Search failed:', err);
      return this.fallbackSearch(keyword);
    }
  }

  /**
   * Get real-time stock info (supports A-share + HK)
   * 高开低收直接从腾讯 fqkline API 获取，不经过 stock-sdk 缓存
   */
  async getStockInfo(code: string): Promise<StockInfo> {
    const normalized = this.normalizeCode(code);
    const isHK = normalized.startsWith('hk');

    // 获取基础行情
    const quotes = await this.sdk.getFullQuotes([normalized]);
    if (!quotes || quotes.length === 0) throw new StockNotFoundError(code);
    const q = quotes[0];
    const prevClose = q.price - (q.change || 0);

    // 直接从腾讯 API 获取今天 K线（绕过 stock-sdk 缓存和故障路径）
    let dayOpen = prevClose, dayHigh = 0, dayLow = 0, dayVolume = q.volume, dayAmount = q.amount;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      // 只用最近3天的K线，确保拿到今天的
      const url = `https://ifzq.gtimg.cn/appstock/app/fqkline/get?param=${normalized},day,2026-01-01,${todayStr},5,qfq`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const json = await resp.json() as any;
      const rawData = json?.data?.[normalized]?.qfqday || json?.data?.[normalized]?.day || [];

      if (rawData.length > 0) {
        // 找今天的K线（最后一条，date匹配今天）
        const lastBar = rawData[rawData.length - 1];
        if (lastBar && Array.isArray(lastBar) && lastBar.length >= 6) {
          const barDate = String(lastBar[0]);
          if (barDate === todayStr) {
            // 腾讯K线成交量单位是"手"，转成"股"
            dayOpen = parseFloat(lastBar[1]) || prevClose;
            dayHigh = parseFloat(lastBar[3]) || q.price;
            dayLow = parseFloat(lastBar[4]) || q.price;
            const klineVol = parseInt(lastBar[5]) || 0;
            dayVolume = klineVol * 100; // 手→股
            dayAmount = parseFloat(lastBar[6]) || 0;
          }
        }
      }
    } catch (e: any) {
      console.warn(`[StockInfo] Tencent kline failed: ${e.message}`);
    }

    // 如果腾讯K线没有今天的数据（盘中），用分时数据
    if (!dayHigh || !dayLow) {
      try {
        const timeline = await this.sdk.getTodayTimeline(normalized) as any;
        if (timeline?.data && timeline.data.length > 5) {
          const prices = timeline.data.map((p: any) => parseFloat(p.price)).filter((p: number) => p > 0 && isFinite(p));
          if (prices.length > 5) {
            dayHigh = Math.max(...prices);
            dayLow = Math.min(...prices);
            dayOpen = prices[0];
            const lp = timeline.data[timeline.data.length - 1];
            if (lp && parseFloat(lp.volume) > 0) dayVolume = parseInt(lp.volume);
          }
        }
      } catch {}
    }

    // 最终兜底
    if (!dayHigh || !dayLow) {
      dayHigh = Math.max(q.price, prevClose);
      dayLow = Math.min(q.price, prevClose);
    }
    if (!dayOpen) dayOpen = prevClose;

    // 成交额
    if (dayAmount <= 0 || dayAmount > 1e12) dayAmount = q.amount;
    if (!isHK && dayAmount < 1e12) dayAmount = dayAmount * 10000;

    // 直接从腾讯 qt 接口取换手率、涨跌停价、封单量、市值等 stock-sdk 可能没映射的字段
    let tencentTurnoverRate: number | null = null;
    let tencentLimitUp: number | null = null;
    let tencentLimitDown: number | null = null;
    let tencentSell1Vol = 0; // 卖一量（封单量）
    let tencentBuy1Vol = 0;  // 买一量（封单量）
    let tencentMarketCap: number | null = null; // 总市值（元）
    try {
      const resp = await fetch(`https://qt.gtimg.cn/q=${normalized}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const text = await resp.text();
      const m = text.match(/"(.*)"/);
      if (m) {
        const parts = m[1].split('~');
        if (parts.length > 48) {
          tencentTurnoverRate = parseFloat(parts[38]) || null;
          // 合理性检查：换手率合理范围 0-100%
          if (tencentTurnoverRate != null && (tencentTurnoverRate < 0 || tencentTurnoverRate > 100)) {
            console.warn(`[TencentRaw] ${normalized}: 换手率异常 ${tencentTurnoverRate}%，忽略使用计算值`);
            tencentTurnoverRate = null;
          }
          tencentLimitUp = parseFloat(parts[47]) || null;
          tencentLimitDown = parseFloat(parts[48]) || null;
          tencentSell1Vol = parseInt(parts[10]) || 0;
          tencentBuy1Vol = parseInt(parts[9]) || 0;
          tencentMarketCap = parseFloat(parts[44]) || null; // 总市值（元）
          console.log(`[TencentRaw] ${normalized}: 换手率=${tencentTurnoverRate}% 涨停=${tencentLimitUp} 跌停=${tencentLimitDown} 卖一量=${tencentSell1Vol}手 市值=${tencentMarketCap}`);
        }
      }
    } catch (e: any) {
      console.warn(`[TencentRaw] Failed: ${e.message}`);
    }

    // 换手率：优先取腾讯API原始值
    let turnoverRate = tencentTurnoverRate;
    if (turnoverRate == null) {
      // 降级计算
      const volumeShares = dayVolume;
      const totalShares = q.price > 0 ? ((q.marketCap ?? 0) * 100000000 / q.price) : 0;
      turnoverRate = totalShares > 0 ? (volumeShares / totalShares) * 100 : 0;
    }

    // 调试日志
    console.log(`[StockInfo] ${normalized}: price=${q.price} open=${dayOpen} high=${dayHigh} low=${dayLow} vol=${dayVolume} mcap=${q.marketCap} turnover=${turnoverRate.toFixed(4)}%`);

    return {
      code: q.code,
      name: q.name,
      market: normalized.slice(0, 2),
      price: q.price,
      change: q.change,
      changePercent: q.changePercent,
      high: Math.round(dayHigh * 100) / 100,
      low: Math.round(dayLow * 100) / 100,
      volume: dayVolume,
      amount: dayAmount,
      marketCap: tencentMarketCap ?? ((q.marketCap ?? 0) * (isHK ? 1 : 100000000)),
      open: Math.round(dayOpen * 100) / 100,
      prevClose: q.price - (q.change || 0),
      turnoverRate: Math.round(turnoverRate * 100) / 100,
      bid: (q as any).bid || (tencentBuy1Vol > 0 ? [{ price: (q as any).bid?.[0]?.price || 0, volume: tencentBuy1Vol }] : null),
      ask: (q as any).ask || (tencentSell1Vol > 0 ? [{ price: (q as any).ask?.[0]?.price || 0, volume: tencentSell1Vol }] : null),
      limitUp: (q as any).limitUp || tencentLimitUp || null,
      limitDown: (q as any).limitDown || tencentLimitDown || null,
      // 腾讯原生封单数据（手）
      buy1Vol: tencentBuy1Vol,
      sell1Vol: tencentSell1Vol,
    };
  }

  /**
   * Get K-line data with technical indicators
   */
  async getKlineWithIndicators(
    code: string,
    options: {
      count?: number;
      fq?: 'qfq' | 'hfq' | '';
      indicators?: Record<string, any>;
    } = {}
  ): Promise<KlineBar[]> {
    const normalized = this.normalizeCode(code);
    const count = Math.min(options.count || config.defaultKlineCount, config.maxKlineCount);
    const fq = options.fq || 'qfq';

    const cacheKey = `kline_${normalized}_${count}_${fq}`;

    // Check cache
    const cached = await this.cache.get<KlineBar[]>(cacheKey);
    if (cached) return cached;

    // 数据源不可用时5分钟内不再重试
    const failKey = "kline_fail_" + normalized;
    const failed = await this.cache.get(failKey);
    if (failed) {
      throw new Error("数据源暂时不可用: " + normalized);
    }

    // Retry with different approaches
    let kline: any = null;
    const errors: string[] = [];
    const isHK = normalized.startsWith('hk');

    // 港股优先尝试 HK 专用接口
    if (isHK) {
      try {
        const rawKline = await this.sdk.getHKHistoryKline(normalized, {
          count: Math.max(count, 300),
        } as any);
        if (rawKline && rawKline.length > 0) {
          kline = rawKline.map((bar: any) => ({
            date: bar.date,
            open: bar.open,
            close: bar.close,
            high: bar.high,
            low: bar.low,
            volume: bar.volume || 0,
            amount: bar.amount || 0,
            changePercent: bar.changePercent,
            change: bar.change,
          }));
        }
      } catch (err: any) {
        errors.push(`HK-kline: ${err.message}`);
      }
    }

    // 尝试1: 标准带指标请求
    try {
      kline = await this.sdk.getKlineWithIndicators(normalized, {
        count: Math.max(count, 300),
        fq,
        indicators: options.indicators || {
          ma: { periods: [5, 10, 20, 60] },
          macd: { fast: 12, slow: 26, signal: 9 },
          boll: { period: 20, stdDev: 2 },
          rsi: { period: 14 },
          kdj: { period: 9, kPeriod: 3, dPeriod: 3 },
        },
      } as any);
    } catch (err: any) {
      errors.push(err.message);
    }

    // 尝试2: 如果不带指标（纯K线数据）
    if (!kline || kline.length === 0) {
      await this.cache.set(failKey, true, 5 * 60 * 1000);
      try {
        kline = await this.sdk.getKlineWithIndicators(normalized, {
          count: Math.max(count, 300),
          fq,
          indicators: { ma: { periods: [5] } },
        } as any);
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    // 尝试3: 用 historyKline（原始K线，不含技术指标）
    if (!kline || kline.length === 0) {
      try {
        const rawKline = await this.sdk.getHistoryKline(normalized, {
          count: Math.max(count, 300),
          fq,
        } as any);
        if (rawKline && rawKline.length > 0) {
          // 手动补充基础字段
          kline = rawKline.map((bar: any) => ({
            ...bar,
            ma: undefined,
            macd: undefined,
            boll: undefined,
            rsi: undefined,
            kdj: undefined,
          }));
        }
      } catch (err: any) {
        errors.push(err.message);
      }
    }


    // 尝试4: 腾讯 fqkline API（备选数据源）
    if (!kline || kline.length === 0) {
      try {
        const today = new Date();
        const past = new Date(today);
        past.setDate(past.getDate() - Math.max(count, 60));
        const start = past.toISOString().split('T')[0];
        const end = today.toISOString().split('T')[0];
        const fqParam = fq === "qfq" ? "qfq" : "";
        const url = "https://ifzq.gtimg.cn/appstock/app/fqkline/get?param=" + normalized + ",day," + start + "," + end + "," + count + "," + fqParam;
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        const json = await res.json();
        const rawData = json?.data?.[normalized]?.qfqday || json?.data?.[normalized]?.day || [];

        if (rawData && rawData.length > 0) {
          kline = rawData.map((bar: any) => {
            if (!Array.isArray(bar) || bar.length < 6) return null;
            return {
              date: bar[0],
              open: parseFloat(bar[1]),
              close: parseFloat(bar[2]),
              high: parseFloat(bar[3]),
              low: parseFloat(bar[4]),
              volume: parseFloat(bar[5]) || 0,
              amount: parseFloat(bar[6]) || 0,
              changePercent: undefined,
              change: undefined,
            };
          }).filter(Boolean);
          console.log("[TencentKline] Got " + kline.length + " bars for " + normalized);
        }
      } catch (err: any) {
        errors.push("Tencent: " + err.message);
      }
    }

    if (!kline || kline.length === 0) {
      throw new Error(
        `无法获取K线数据: ${errors.join('; ')}`
      );
    }

    const result = kline.slice(-count).map((bar: any) => ({
      date: bar.date,
      open: bar.open,
      close: bar.close,
      high: bar.high,
      low: bar.low,
      volume: bar.volume,
      amount: bar.amount,
      changePercent: bar.changePercent,
      change: bar.change,
      amplitude: bar.amplitude,
      turnoverRate: bar.turnoverRate,
      timestamp: bar.timestamp,
      code: bar.code,
      ma: bar.ma || undefined,
      macd: bar.macd || undefined,
      boll: bar.boll || undefined,
      rsi: bar.rsi || undefined,
      kdj: bar.kdj || undefined,
    }));

    // Cache the result
    await this.cache.set(cacheKey, result, config.cacheTTL.dailyKline);

    return result;
  }

  /**
   * Get today's intraday timeline data (including pre-market 9:15-9:25)
   */
  async getTodayTimeline(code: string): Promise<any> {
    const normalized = this.normalizeCode(code);
    try {
      const result = await this.sdk.getTodayTimeline(normalized);
      if (result?.data?.length > 0) {
        try {
          const existingTimes = new Set(result.data.map((d: any) => d.time));
          const hasPreMarket = Array.from(existingTimes).some((t: string) => t.startsWith('09:1'));
          if (!hasPreMarket) {
            // 直接调腾讯 5分K线 API 获取集合竞价数据
            const today = new Date().toISOString().split('T')[0];
            const url = `https://ifzq.gtimg.cn/appstock/app/fqkline/get?param=${normalized},5min,${today},${today},5,qfq`;
            const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const json = await resp.json() as any;
            const k5 = json?.data?.[normalized]?.['5min'] || [];
            const preOpen: any[] = [];
            for (const item of k5) {
              if (!Array.isArray(item) || item.length < 6) continue;
              const ds = String(item[0]);
              const hhmm = ds.length >= 10 ? ds.slice(-4, -2) + ':' + ds.slice(-2) : '';
              const closeP = parseFloat(item[2]) || 0;
              const highP = parseFloat(item[3]) || 0;
              const lowP = parseFloat(item[4]) || 0;
              const vol = parseInt(item[5]) || 0;
              if (['09:15','09:20','09:25'].includes(hhmm) && closeP > 0) {
                preOpen.push({ time: hhmm, price: closeP, avgPrice: (highP + lowP) / 2 || closeP, volume: vol, amount: vol * closeP });
              }
            }
            if (preOpen.length > 0) {
              result.data = [...preOpen, ...result.data];
            }
          }
        } catch {}
      }
      return result;
    } catch {
      return this.sdk.getTodayTimeline(normalized);
    }
  }

  /**
   * Get individual stock fund flow (主力资金流向)
   * 港股可能不支持，返回空数组
   */
  async getFundFlow(code: string): Promise<any[]> {
    const normalized = this.normalizeCode(code);
    if (normalized.startsWith('hk')) return []; // 港股暂无资金流向数据
    try {
      return await this.sdk.getIndividualFundFlow(normalized);
    } catch {
      return [];
    }
  }

  /**
   * Get real-time transaction records (逐笔成交)
   * 使用新浪API，格式简单可靠
   * URL: https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/InvestorService.getTransactionList?code=sh600519&num=30
   * 返回: [{"time":"14:59:59","price":180.00,"volume":100,"direction":"买"}, ...]
   */
  async getTransactions(code: string, count: number = 30): Promise<any[]> {
    const normalized = this.normalizeCode(code);
    const url = `https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/InvestorService.getTransactionList?code=${normalized}&num=${count}`;
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
      const text = await resp.text();
      // 新浪返回JSONP或JSON，先尝试JSON.parse
      let list: any[];
      try { list = JSON.parse(text); } catch {
        // 可能是JSONP: var xxx=[...]; 提取数组
        const m = text.match(/\[.*\]/s);
        list = m ? JSON.parse(m[0]) : [];
      }
      if (!list || list.length === 0) {
        console.warn(`[Transactions] Sina empty for ${normalized}`);
        return [];
      }
      console.log(`[Transactions] Sina ${normalized}: ${list.length} records, sample:`, JSON.stringify(list[0]).slice(0, 150));
      // 转换格式
      return list.filter((t: any) => t && t.time && parseFloat(t.price) > 0)
        .map((t: any) => ({
          time: t.time || '',
          price: parseFloat(t.price) || 0,
          volume: parseInt(t.volume) || 0,
          amount: 0,
          direction: String(t.direction || '').includes('买') ? 0 : String(t.direction || '').includes('卖') ? 1 : 2,
        }));
    } catch (err: any) {
      console.warn(`[Transactions] Sina failed for ${normalized}: ${err.message}`);
      // 兜底：腾讯API
      try {
        const url2 = `https://ifzq.gtimg.cn/appstock/app/trans/getTrans?code=${normalized}&start=0&num=${count}`;
        const resp2 = await fetch(url2, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
        const json = await resp2.json() as any;
        const dataNode = json?.data?.[normalized] || json?.data || {};
        // 遍历所有字段
        for (const key of Object.keys(dataNode)) {
          const val = dataNode[key];
          if (Array.isArray(val)) {
            const recs = val.filter((v: any) => Array.isArray(v) && v.length >= 3)
              .map((v: any[]) => ({
                time: String(v[0] || ''),
                price: parseFloat(v[1]) || 0,
                volume: parseInt(v[2]) || 0,
                amount: parseFloat(v[3]) || 0,
                direction: String(v[4] || '').toUpperCase() === 'B' ? 0 : String(v[4] || '').toUpperCase() === 'S' ? 1 : 2,
              })).filter((r: any) => r.time && r.price > 0);
            if (recs.length > 0) {
              console.log(`[Transactions] Tencent fallback ${normalized}: ${recs.length} records`);
              return recs;
            }
          }
          // 字符串管道格式
          if (typeof val === 'string' && val.includes('|')) {
            const lines = val.split(';');
            const recs = lines.map(l => l.split('|'))
              .filter(p => p.length >= 3)
              .map(p => ({
                time: p[0] || '',
                price: parseFloat(p[1]) || 0,
                volume: parseInt(p[2]) || 0,
                amount: parseFloat(p[3]) || 0,
                direction: String(p[4] || '').toUpperCase() === 'B' ? 0 : String(p[4] || '').toUpperCase() === 'S' ? 1 : 2,
              })).filter((r: any) => r.time && r.price > 0);
            if (recs.length > 0) {
              console.log(`[Transactions] Tencent pipe fallback ${normalized}: ${recs.length} records`);
              return recs;
            }
          }
        }
        console.warn(`[Transactions] Tencent no data for ${normalized}`);
        return [];
      } catch (err2: any) {
        console.warn(`[Transactions] Tencent also failed: ${err2.message}`);
        return [];
      }
    }
  }

  /**
   * Get a simple stock code list for local search fallback
   */
  async getStockCodeList(): Promise<SearchResultItem[]> {
    if (this.stockListCache) return this.stockListCache;

    const cacheKey = 'stock_code_list';
    const cached = await this.cache.get<SearchResultItem[]>(cacheKey);
    if (cached) {
      this.stockListCache = cached;
      return cached;
    }

    try {
      const codes = await this.sdk.getAShareCodeList();
      const list = codes.map((c: any) => ({
        code: c.code.replace(/^(sh|sz|bj)/, ''),
        name: c.name || '',
        market: c.market || c.code.match(/^(sh|sz|bj)/)?.[1] || 'sh',
        type: 'GP-A',
      }));

      await this.cache.set(cacheKey, list, config.cacheTTL.stockList);
      this.stockListCache = list;
      return list;
    } catch {
      return [];
    }
  }

  /**
   * Normalize stock code to include market prefix
   * A股: "600519" -> "sh600519", "000858" -> "sz000858"
   * 港股: "00700" -> "hk00700", 或已有 "hk" 前缀
   */
  private normalizeCode(code: string): string {
    // Already has prefix
    if (/^(sh|sz|bj|hk)/.test(code)) return code;

    const codeNum = code.replace(/\D/g, '');
    const prefix = this.getMarketPrefix(codeNum);
    return `${prefix}${codeNum}`;
  }

  private getMarketPrefix(code: string): string {
    // 港股代码通常为5位数字
    if (code.length <= 5 && /^\d{1,5}$/.test(code)) return 'hk';
    // A股：6位数字
    if (code.startsWith('6')) return 'sh';
    if (code.startsWith('0') || code.startsWith('3') || code.startsWith('2')) return 'sz';
    if (code.startsWith('8') || code.startsWith('4')) return 'bj';
    return 'sh'; // default
  }

  private async fallbackSearch(keyword: string): Promise<SearchResultItem[]> {
    const list = await this.getStockCodeList();
    const kw = keyword.toLowerCase();

    return list.filter(
      item =>
        item.code.includes(kw) ||
        item.name.toLowerCase().includes(kw) ||
        item.name.includes(kw)
    ).slice(0, 20);
  }
}

export class StockNotFoundError extends Error {
  constructor(code: string) {
    super(`Stock not found: ${code}`);
    this.name = 'StockNotFoundError';
  }
}
