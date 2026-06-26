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
    // 1. Try stock-sdk
    try {
      const result = await this.sdk.getTodayTimeline(normalized);
      if (result?.data?.length > 0) {
        // Save to disk cache for offline fallback
        try {
          const cacheKey = `timeline_${normalized}`;
          this.cache.set(cacheKey, result, 86400000);
        } catch {}
        return result;
      }
    } catch {}

    // 2. Try disk cache
    try {
      const cacheKey = `timeline_${normalized}`;
      const cached = await this.cache.get<any>(cacheKey, true);
      if (cached?.data?.length > 0) {
        console.log(`[Timeline] Cache hit ${normalized}: ${cached.data.length} points`);
        return cached;
      }
    } catch {}

    // 3. Try reconstruct from transaction cache
    try {
      const prefix = 'trans_' + normalized + '_';
      const readdir = (await import('fs/promises')).readdir;
      const pathJoin = (await import('path')).join;
      const files = await readdir(config.cacheDir);
      const matchFile = files.filter((f: string) => f.startsWith(prefix) && f.endsWith('.json')).sort().reverse()[0];
      if (matchFile) {
        const raw = await (await import('fs/promises')).readFile(pathJoin(config.cacheDir, matchFile), 'utf-8');
        const entry = JSON.parse(raw);
        if (entry?.data?.length > 0) {
          const txData = entry.data as any[];
          // Convert transaction records back to timeline format
          const tlData = txData.map((t: any) => ({
            time: t.time,
            price: t.price,
            avgPrice: t.price,
            volume: t.volume,
            amount: t.volume * t.price * 100,
          }));
          const result2 = { data: tlData, preClose: 0 };
          // Estimate preClose from first valid price
          const firstPrice = tlData.find((d: any) => d.price > 0);
          if (tlData.length > 10) {
            const yesterdayPrice = tlData[Math.min(5, tlData.length-1)]?.price || tlData[0].price;
            result2.preClose = yesterdayPrice;
          }
          console.log(`[Timeline] Restored from tx cache ${normalized}: ${tlData.length} points`);
          return result2;
        }
      }
    } catch {}

    return { data: [], preClose: 0 };
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
    const cacheKey = `trans_${normalized}_${count}`;

    // 工具函数：转换东财格式
    const toResult = (list: any[]) => list.filter((t: any) => t && t.time && t.price > 0)
      .map((t: any) => ({
        time: t.time || '',
        price: t.price || 0,
        volume: t.volume || 0,
        amount: t.amount || 0,
        direction: t.direction ?? 2,
      }));

    // 1. 新浪API
    try {
      const url = `https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/InvestorService.getTransactionList?code=${normalized}&num=${count}`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
      const text = await resp.text();
      let list: any[];
      try { list = JSON.parse(text); } catch {
        const m = text.match(/\[.*\]/s);
        list = m ? JSON.parse(m[0]) : [];
      }
      if (list && list.length > 0) {
        const result = list.filter((t: any) => t && t.time && parseFloat(t.price) > 0)
          .map((t: any) => ({
            time: t.time || '',
            price: parseFloat(t.price) || 0,
            volume: parseInt(t.volume) || 0,
            amount: 0,
            direction: String(t.direction || '').includes('买') ? 0 : String(t.direction || '').includes('卖') ? 1 : 2,
          }));
        if (result.length > 0) {
          console.log(`[Transactions] Sina ${normalized}: ${result.length} records`);
          this.cache.set(cacheKey, result, 86400000); // 缓存1天
          return result;
        }
      }
      console.warn(`[Transactions] Sina empty for ${normalized}`);
    } catch (err: any) {
      console.warn(`[Transactions] Sina failed for ${normalized}: ${err.message}`);
    }

    // 2. 腾讯API兜底
    try {
      const url2 = `https://ifzq.gtimg.cn/appstock/app/trans/getTrans?code=${normalized}&start=0&num=${count}`;
      const resp2 = await fetch(url2, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
      const json = await resp2.json() as any;
      const dataNode = json?.data?.[normalized] || json?.data || {};
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
            console.log(`[Transactions] Tencent ${normalized}: ${recs.length} records`);
            this.cache.set(cacheKey, recs, 86400000);
            return recs;
          }
        }
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
            console.log(`[Transactions] Tencent pipe ${normalized}: ${recs.length} records`);
            this.cache.set(cacheKey, recs, 86400000);
            return recs;
          }
        }
      }
      console.warn(`[Transactions] Tencent no data for ${normalized}`);
    } catch (err2: any) {
      console.warn(`[Transactions] Tencent also failed: ${err2.message}`);
    }

    // 3. 东方财富API（多端点 + 调试日志）
    const emPrefix = normalized.startsWith('sh') ? '1.' : normalized.startsWith('sz') ? '0.' : normalized.startsWith('bj') ? '0.' : '1.';
    const emSecid = emPrefix + normalized.replace(/^(sh|sz|bj)/, '');
    const ts = Date.now();
    const emUrls = [
      `https://push2.eastmoney.com/api/qt/stock/stocktick/get?secid=${emSecid}&fields1=f1,f2,f3,f4,f5&fields2=f6,f7,f8,f9,f10,f11,f12,f13&count=${Math.min(count, 100)}&lmt=${Math.min(count, 100)}&_=${ts}`,
      `https://push2.eastmoney.com/api/qt/stock/stocktick/get?secid=${emSecid}&fields1=f1,f2,f3,f4,f5&fields2=f6,f7,f8,f9,f10,f11,f12,f13&count=${Math.min(count, 100)}&_=${ts}`,
    ];
    for (const url3 of emUrls) {
      try {
        const resp3 = await fetch(url3, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/' }, signal: AbortSignal.timeout(5000) });
        const json3 = await resp3.json() as any;
        console.log(`[Transactions] EM raw response: data=`, JSON.stringify(json3?.data).slice(0, 300));
        // 东财逐笔：v[0]=时间HHmmssfff, v[1]=价格(分), v[2]=量(股), v[3]=额, v[4]=方向(1买2卖)
        const emRaw = Array.isArray(json3?.data?.data) ? json3.data.data :
                      Array.isArray(json3?.data?.diff) ? json3.data.diff :
                      Array.isArray(json3?.data?.list) ? json3.data.list :
                      Array.isArray(json3?.data) ? json3.data : [];
        if (emRaw.length > 0) {
          const recs = emRaw.map((v: any[]) => {
            let t = String(v[0] || '');
            t = t.padStart(9, '0');
            t = t.slice(0, 2) + ':' + t.slice(2, 4);
            let p = parseFloat(v[1]) || 0;
            if (p > 1000) p = p / 100;
            let vol = parseInt(v[2]) || 0;
            vol = Math.round(vol / 100);
            return {
              time: t,
              price: p,
              volume: Math.max(1, vol),
              amount: parseFloat(v[3]) || 0,
              direction: v[4] === 1 ? 0 : v[4] === 2 ? 1 : 2,
            };
          }).filter((r: any) => r.time && r.time.length >= 4 && r.price > 0);
          if (recs.length > 0) {
            console.log(`[Transactions] EastMoney OK ${normalized}: ${recs.length} records`);
            this.cache.set(cacheKey, recs, 86400000);
            return recs;
          }
        }
        console.warn(`[Transactions] EastMoney empty for url=${url3.slice(0, 100)} raw=${JSON.stringify(json3).slice(0, 200)}`);
      } catch (err3: any) {
        console.warn(`[Transactions] EastMoney error: ${err3.message}`);
      }
    }
    // 额外尝试：东财外盘/内盘成交（历史逐笔）
    try {
      const url4 = `https://push2.eastmoney.com/api/qt/stock/stocktick/get?secid=${emSecid}&fields1=f1,f2,f3,f4,f5&fields2=f6,f7,f8,f9,f10,f11,f12,f13&count=${Math.min(count, 100)}&lmt=${Math.min(count, 100)}&ut=fa5fd1943c7b386f172d6893dbbd5c2b&d=${ts}`;
      const resp4 = await fetch(url4, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/', 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) });
      const json4 = await resp4.json() as any;
      const emRaw2 = Array.isArray(json4?.data?.data) ? json4.data.data :
                     Array.isArray(json4?.data?.diff) ? json4.data.diff : [];
      if (emRaw2.length > 0) {
        const recs = emRaw2.map((v: any[]) => ({
          time: (String(v[0] || '').padStart(9, '0').slice(0, 2) + ':' + String(v[0] || '').padStart(9, '0').slice(2, 4)),
          price: (parseFloat(v[1]) || 0) > 1000 ? (parseFloat(v[1]) || 0) / 100 : (parseFloat(v[1]) || 0),
          volume: Math.max(1, Math.round((parseInt(v[2]) || 0) / 100)),
          amount: parseFloat(v[3]) || 0,
          direction: v[4] === 1 ? 0 : v[4] === 2 ? 1 : 2,
        })).filter((r: any) => r.time && r.time.length >= 4 && r.price > 0);
        if (recs.length > 0) {
          console.log(`[Transactions] EM backup OK ${normalized}: ${recs.length} records`);
          this.cache.set(cacheKey, recs, 86400000);
          return recs;
        }
      }
    } catch { }
    console.warn(`[Transactions] All EastMoney failed for ${normalized}`);

    // 4. 尝试从缓存返回历史数据
    try {
      const cached = await this.cache.get<any[]>(cacheKey, true);
      if (cached && cached.length > 0) {
        console.log(`[Transactions] Returning cached ${normalized}: ${cached.length} records`);
        return cached;
      }
    } catch {}
    // 4b. 直接读取缓存文件（兜底）
    try {
      const cacheDir = config.cacheDir;
      const prefix = 'trans_' + normalized + '_';
      const readdir = (await import('fs/promises')).readdir;
      const pathJoin = (await import('path')).join;
      const files = await readdir(cacheDir);
      const matchFile = files.filter((f: string) => f.startsWith(prefix) && f.endsWith('.json')).sort().reverse()[0];
      if (matchFile) {
        const raw = await (await import('fs/promises')).readFile(pathJoin(cacheDir, matchFile), 'utf-8');
        const entry = JSON.parse(raw);
        if (entry?.data?.length > 0) {
          console.log('[Transactions] Direct cache ' + normalized + ': ' + entry.data.length + ' records from ' + matchFile);
          return entry.data.slice(0, count);
        }
      }
    } catch {}


    // 5. 使用stock-sdk分时数据（真实分时数据，非模拟，每分钟一条）
    try {
      const tl = await this.getTodayTimeline(code);
      if (tl?.data?.length > 0) {
        let prevVol = 0;
        const recs = tl.data
          .filter((d: any) => d.price > 0 && d.volume > 0)
          .map((d: any) => {
            // 分时返回的volume是累积量，需取当前分钟的差值
            const cumVol = d.volume || 0;
            const delta = cumVol - prevVol;
            prevVol = cumVol;
            return {
              time: d.time || '',
              price: d.price || 0,
              volume: Math.max(1, Math.round(delta / 100)), // 股→手
              amount: 0,
              direction: d.price >= (tl.preClose || 0) ? 0 : 1,
            };
          }).filter((r: any) => r.volume > 0);
        if (recs.length > 0) {
          console.log(`[Transactions] Timeline ${normalized}: ${recs.length} records`);
          this.cache.set(cacheKey, recs, 86400000);
          return recs;
        }
      }
    } catch { }

    return [];
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
