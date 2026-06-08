import { CacheService } from './cacheService';

export interface MarketContext {
  /** 大盘指数概况 */
  indices: { name: string; price: number; changePercent: number }[];
  /** 行业板块表现 */
  sectors: { name: string; changePercent: number; rank: number }[];
  /** 市场资金流向 */
  fundFlow: { mainForce: number; retail: number; northbound: number };
  /** 市场情绪 */
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface StockContext {
  /** 所属行业板块表现 */
  sectorPerformance?: { name: string; changePercent: number; rank: number };
  /** 所属概念板块表现 */
  concepts: { name: string; changePercent: number }[];
  /** 个股资金流向 */
  capitalFlow: {
    mainForceNet: number;      // 主力净流入
    retailNet: number;          // 散户净流入
    mainForceTrend: string;     // 主力资金趋势
  };
  /** 近期公告/新闻情绪 */
  newsSentiment?: 'positive' | 'negative' | 'neutral';
  /** 综合评分 (-100 ~ 100) */
  compositeScore: number;
}

export class MarketContextService {
  private cache: CacheService;

  constructor() {
    this.cache = new CacheService();
  }

  /**
   * 获取大盘行情
   */
  async getMarketIndices(): Promise<{ name: string; price: number; changePercent: number }[]> {
    const cached = await this.cache.get<{ name: string; price: number; changePercent: number }[]>('market_indices');
    if (cached) return cached;

    const { StockSDK } = require('stock-sdk');
    const sdk = new StockSDK({ retry: { maxRetries: 0 } });

    try {
      // 获取主要指数：上证、深证、创业板、科创50
      const quotes = await sdk.getSimpleQuotes(['sh000001', 'sz399001', 'sz399006', 'sh000688']);
      const result = quotes.map((q: any) => ({
        name: q.name,
        price: q.price,
        changePercent: q.changePercent,
      }));
      await this.cache.set('market_indices', result, 60000); // 缓存1分钟
      return result;
    } catch {
      return [
        { name: '上证指数', price: 0, changePercent: 0 },
        { name: '深证成指', price: 0, changePercent: 0 },
      ];
    }
  }

  /**
   * 获取行业板块表现（取前5和后5）
   */
  async getSectorPerformance(): Promise<{ name: string; changePercent: number; rank: number }[]> {
    const cached = await this.cache.get<{ name: string; changePercent: number; rank: number }[]>('sector_perf');
    if (cached) return cached;

    try {
      const { StockSDK } = require('stock-sdk');
      const sdk = new StockSDK({ retry: { maxRetries: 0 } });
      const spots = await sdk.getIndustrySpot();
      if (!spots || spots.length === 0) return [];

      const sorted = spots
        .map((s: any) => ({ name: s.name, changePercent: s.changePercent, rank: 0 }))
        .sort((a: any, b: any) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

      const result = sorted.slice(0, 10);
      await this.cache.set('sector_perf', result, 60000);
      return result;
    } catch {
      return [];
    }
  }

  /**
   * 获取市场资金流向
   */
  async getMarketFundFlow(): Promise<{ mainForce: number; retail: number; northbound: number }> {
    const cached = await this.cache.get<{ mainForce: number; retail: number; northbound: number }>('mkt_flow');
    if (cached) return cached;

    try {
      const { StockSDK } = require('stock-sdk');
      const sdk = new StockSDK({ retry: { maxRetries: 0 } });

      let mainForce = 0, retail = 0, northbound = 0;

      try {
        const flow = await sdk.getMarketFundFlow();
        if (flow) {
          mainForce = flow.mainForce || 0;
          retail = flow.retail || 0;
        }
      } catch {}

      try {
        const nb = await sdk.getNorthboundFlowSummary();
        if (nb) northbound = nb.netInflow || 0;
      } catch {}

      const result = { mainForce, retail, northbound };
      await this.cache.set('mkt_flow', result, 60000);
      return result;
    } catch {
      return { mainForce: 0, retail: 0, northbound: 0 };
    }
  }

  /**
   * 获取个股综合上下文
   */
  async getStockContext(code: string, stockName: string): Promise<StockContext> {
    const { StockSDK } = require('stock-sdk');
    const sdk = new StockSDK({ retry: { maxRetries: 0 } });
    const normalized = code.startsWith('sh') || code.startsWith('sz') ? code : `sh${code}`;

    const concepts: { name: string; changePercent: number }[] = [];
    let sectorInfo: { name: string; changePercent: number; rank: number } | undefined;
    let capitalFlow = { mainForceNet: 0, retailNet: 0, mainForceTrend: '中性' };
    let compositeScore = 0;

    // 行业板块
    try {
      const spots = await sdk.getIndustrySpot();
      if (spots) {
        for (const s of spots) {
          if (s.name && stockName.includes(s.name.slice(0, 2))) {
            sectorInfo = { name: s.name, changePercent: s.changePercent || 0, rank: 0 };
            compositeScore += (s.changePercent || 0) > 0 ? 10 : -10;
            break;
          }
        }
      }
    } catch {}

    // 概念板块
    try {
      const cspots = await sdk.getConceptSpot();
      if (cspots) {
        for (const c of cspots.slice(0, 20)) {
          if (c.name && (stockName.includes(c.name.slice(0, 2)) || code.includes(c.code || ''))) {
            concepts.push({ name: c.name, changePercent: c.changePercent || 0 });
            compositeScore += (c.changePercent || 0) > 0 ? 5 : -5;
          }
        }
      }
    } catch {}

    // 资金流向
    try {
      const rawCode = code.replace(/^(sh|sz)/, '');
      const flow = await sdk.getIndividualFundFlow(normalized);
      if (flow && flow.length > 0) {
        const latest = flow[flow.length - 1];
        capitalFlow = {
          mainForceNet: latest.mainNetInflowPercent || 0,
          retailNet: latest.smallNetInflowPercent || 0,
          mainForceTrend: (latest.mainNetInflowPercent || 0) > 0 ? '净流入' : (latest.mainNetInflowPercent || 0) < 0 ? '净流出' : '中性',
        };
        compositeScore += (latest.mainNetInflowPercent || 0) > 0 ? 15 : -15;
      }
    } catch {}

    // 大盘环境影响
    try {
      const indices = await this.getMarketIndices();
      for (const idx of indices) {
        if (idx.name.includes('上证') || idx.name.includes('深证')) {
          compositeScore += idx.changePercent > 0 ? 10 : -10;
        }
      }
    } catch {}

    // 归一化
    compositeScore = Math.max(-100, Math.min(100, compositeScore));

    return {
      sectorPerformance: sectorInfo,
      concepts,
      capitalFlow,
      compositeScore,
    };
  }

  /**
   * 生成市场环境描述
   */
  async generateMarketSummary(): Promise<string[]> {
    const lines: string[] = [];

    const indices = await this.getMarketIndices();
    if (indices.length > 0) {
      const sh = indices.find(i => i.name.includes('上证'));
      const sz = indices.find(i => i.name.includes('深证'));
      if (sh) lines.push(`上证指数 ${sh.price.toFixed(1)}（${sh.changePercent >= 0 ? '+' : ''}${sh.changePercent.toFixed(2)}%）`);
      if (sz) lines.push(`深证成指 ${sz.price.toFixed(1)}（${sz.changePercent >= 0 ? '+' : ''}${sz.changePercent.toFixed(2)}%）`);
    }

    const sectors = await this.getSectorPerformance();
    if (sectors.length > 0) {
      const top = sectors.slice(0, 3);
      const bot = sectors.filter(s => s.changePercent < 0).slice(-3);
      if (top.length > 0) lines.push(`领涨板块：${top.map(s => `${s.name}(${(s.changePercent >= 0 ? '+' : '')}${s.changePercent.toFixed(1)}%)`).join('、')}`);
      if (bot.length > 0) lines.push(`领跌板块：${bot.map(s => `${s.name}(${(s.changePercent >= 0 ? '+' : '')}${s.changePercent.toFixed(1)}%)`).join('、')}`);
    }

    const flow = await this.getMarketFundFlow();
    if (flow.mainForce !== 0) {
      lines.push(`主力资金：${flow.mainForce > 0 ? '净流入' : '净流出'} ${Math.abs(flow.mainForce).toFixed(0)}亿`);
    }
    if (flow.northbound !== 0) {
      lines.push(`北向资金：${flow.northbound > 0 ? '净流入' : '净流出'} ${Math.abs(flow.northbound).toFixed(0)}亿`);
    }

    return lines;
  }
}
