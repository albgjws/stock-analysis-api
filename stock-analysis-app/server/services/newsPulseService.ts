import { StockDataService } from './stockDataService';

export interface NewsPulseResult {
  hasResult: boolean;
  priceAlert: string;
  priceAlertDetail: string;
  capitalFlowAnalysis: string;
  sectorContext: string;
  concepts: { name: string; changePercent: number }[];
  compositeScore: number;
  sentiment: string;
  summary: string;
}

export class NewsPulseService {
  private stockDataService: StockDataService;

  constructor() {
    this.stockDataService = new StockDataService();
  }

  async analyze(code: string): Promise<NewsPulseResult> {
    let stockName = '';
    let info: any = {};
    try {
      info = await this.stockDataService.getStockInfo(code);
      stockName = (info as any).name || '';
    } catch (e: any) {
      console.warn('[NewsPulse] \u83b7\u53d6\u80a1\u7968\u4fe1\u606f\u5931\u8d25:', e.message);
    }

    // \u4ef7\u683c\u5f02\u52a8\u68c0\u6d4b
    let priceAlert = '\u5e73\u9759';
    let priceAlertDetail = '\u8fd1\u671f\u4ef7\u683c\u8d70\u52bf\u5e73\u7a33\uff0c\u65e0\u660e\u663e\u5f02\u52a8\u3002';
    try {
      const timeline = await this.stockDataService.getTodayTimeline(code);
      if (timeline?.data?.length > 0) {
        const prices = timeline.data
          .map((p: any) => p.price || p.currentPrice || 0)
          .filter((v: number) => v > 0);
        if (prices.length > 0) {
          const maxP = Math.max(...prices);
          const minP = Math.min(...prices);
          const firstP = prices[0] || 1;
          const range = ((maxP - minP) / firstP) * 100;
          const latestP = prices[prices.length - 1];
          const changeP = ((latestP - firstP) / firstP) * 100;

          if (range > 5) {
            priceAlert = '\u91cd\u5927\u5f02\u52a8';
            priceAlertDetail = '\u4eca\u65e5\u632f\u5e45 ' + range.toFixed(1) + '%\uff0c\u6da8\u8dcc\u5e45 ' + (changeP >= 0 ? '+' : '') + changeP.toFixed(1) + '%\uff0c\u6ce2\u52a8\u5267\u70c8\u3002';
          } else if (range > 3) {
            priceAlert = '\u660e\u663e\u5f02\u52a8';
            priceAlertDetail = '\u4eca\u65e5\u632f\u5e45 ' + range.toFixed(1) + '%\uff0c\u6da8\u8dcc\u5e45 ' + (changeP >= 0 ? '+' : '') + changeP.toFixed(1) + '%\uff0c\u6ce2\u52a8\u8f83\u5927\u3002';
          } else if (range > 1.5) {
            priceAlert = '\u8f7b\u5fae\u5f02\u52a8';
            priceAlertDetail = '\u4eca\u65e5\u632f\u5e45 ' + range.toFixed(1) + '%\uff0c\u6da8\u8dcc\u5e45 ' + (changeP >= 0 ? '+' : '') + changeP.toFixed(1) + '%\uff0c\u5b58\u5728\u4e00\u5b9a\u6ce2\u52a8\u3002';
          } else {
            priceAlert = '\u5e73\u9759';
            priceAlertDetail = '\u4eca\u65e5\u632f\u5e45 ' + range.toFixed(1) + '%\uff0c\u6da8\u8dcc\u5e45 ' + (changeP >= 0 ? '+' : '') + changeP.toFixed(1) + '%\uff0c\u4ef7\u683c\u8d70\u52bf\u5e73\u7a33\u3002';
          }
        }
      }
    } catch (e: any) {
      console.warn('[NewsPulse] \u83b7\u53d6\u5206\u65f6\u6570\u636e\u5931\u8d25:', e.message);
    }

    // \u7efc\u5408\u8bc4\u5206
    let compositeScore = 0;

    // \u8d44\u91d1\u6d41\u5411
    let capitalFlowAnalysis = '\u6682\u65e0\u8d44\u91d1\u6d41\u5411\u6570\u636e\u3002';
    try {
      const flowData = await this.stockDataService.getFundFlow(code);
      if (flowData && flowData.length > 0) {
        const latest = flowData[flowData.length - 1];
        const mainNet = latest.mainNetInflowPercent || 0;
        const trendText = mainNet > 0 ? '\u4e3b\u529b\u51c0\u6d41\u5165 ' + mainNet.toFixed(1) + '%' :
                          mainNet < 0 ? '\u4e3b\u529b\u51c0\u6d41\u51fa ' + Math.abs(mainNet).toFixed(1) + '%' : '\u4e3b\u529b\u8d44\u91d1\u6301\u5e73';
        capitalFlowAnalysis = '\u4e3b\u529b\u8d44\u91d1' + (mainNet > 0 ? '\u5448\u51c0\u6d41\u5165\u6001\u52bf' : mainNet < 0 ? '\u5448\u51c0\u6d41\u51fa\u6001\u52bf' : '\u76f8\u5bf9\u5e73\u7a33') + '\uff08' + trendText + ')\u3002';
        compositeScore += mainNet > 0 ? 15 : mainNet < 0 ? -15 : 0;
      }
    } catch (e: any) {
      console.warn('[NewsPulse] \u83b7\u53d6\u8d44\u91d1\u6d41\u5411\u5931\u8d25:', e.message);
    }

    // \u884c\u4e1a\u677f\u5757 + \u6982\u5ff5\u677f\u5757
    let sectorContext = '\u6682\u65e0\u884c\u4e1a\u677f\u5757\u6570\u636e\u3002';
    const concepts: { name: string; changePercent: number }[] = [];
    try {
      const { StockSDK } = require('stock-sdk');
      const sdk = new StockSDK({ retry: { maxRetries: 0 } });

      // \u884c\u4e1a\u677f\u5757
      const spots = await sdk.getIndustrySpot();
      if (spots && spots.length > 0 && info?.name) {
        const sn = info.name;
        // \u9010\u4e2a\u5339\u914d\u80a1\u7968\u540d\u79f0\u4e0e\u884c\u4e1a\u540d\u79f0
        for (const s of spots) {
          if (s.name && sn.includes(s.name.slice(0, 2))) {
            sectorContext = '\u6240\u5c5e\u884c\u4e1a\u300c' + s.name + '\u300d\u5f53\u65e5\u6da8\u8dcc\u5e45 ' + (s.changePercent >= 0 ? '+' : '') + (s.changePercent || 0).toFixed(1) + '%\uff0c' + ((s.changePercent || 0) > 1 ? '\u8868\u73b0\u5f3a\u52bf' : (s.changePercent || 0) < -1 ? '\u8868\u73b0\u8f83\u5f31' : '\u8868\u73b0\u5e73\u7a33') + '\u3002';
            compositeScore += (s.changePercent || 0) > 0 ? 10 : -10;
            break;
          }
        }
      }

      // \u6982\u5ff5\u677f\u5757
      const cspots = await sdk.getConceptSpot();
      if (cspots && cspots.length > 0 && info?.name) {
        const sn = info.name;
        for (const c of cspots.slice(0, 30)) {
          if (c.name) {
            const shortName = c.name.length >= 2 ? c.name.slice(0, 2) : c.name;
            if (sn.includes(shortName)) {
              concepts.push({ name: c.name, changePercent: c.changePercent || 0 });
              compositeScore += (c.changePercent || 0) > 0 ? 5 : -5;
            }
          }
        }
      }
    } catch (e: any) {
      console.warn('[NewsPulse] \u83b7\u53d6\u677f\u5757\u6570\u636e\u5931\u8d25:', e.message);
    }

    // \u7efc\u5408\u5224\u65ad
    let sentiment = '\u4e2d\u6027';
    if (compositeScore >= 20) sentiment = '\u79ef\u6781';
    else if (compositeScore <= -20) sentiment = '\u6d88\u6781';

    let summary = '';
    const displayName = stockName || code;
    if (priceAlert !== '\u5e73\u9759' && sentiment === '\u6d88\u6781') {
      summary = '\u26a0\ufe0f ' + displayName + '\u51fa\u73b0' + priceAlert + '\uff0c\u53e0\u52a0\u8d44\u91d1\u9762\u504f\u5f31\uff0c\u5efa\u8bae\u4fdd\u6301\u8c28\u614e\u3002';
    } else if (priceAlert !== '\u5e73\u9759' && sentiment === '\u79ef\u6781') {
      summary = '\U0001f4c8 ' + displayName + '\u51fa\u73b0' + priceAlert + '\uff0c\u4f46\u8d44\u91d1\u9762\u548c\u677f\u5757\u8868\u73b0\u79ef\u6781\uff0c\u53ef\u5173\u6ce8\u540e\u7eed\u8d70\u52bf\u3002';
    } else if (sentiment === '\u79ef\u6781') {
      summary = '\u2705 ' + displayName + '\u5f53\u524d\u5e02\u573a\u73af\u5883\u504f\u79ef\u6781\uff0c\u8d44\u91d1\u9762\u548c\u677f\u5757\u8868\u73b0\u5747\u8f83\u4e3a\u6709\u5229\u3002';
    } else if (sentiment === '\u6d88\u6781') {
      summary = '\u26a0\ufe0f ' + displayName + '\u5f53\u524d\u5e02\u573a\u73af\u5883\u504f\u5f31\uff0c\u8d44\u91d1\u9762\u8868\u73b0\u4e0d\u4f73\uff0c\u9700\u8b66\u60d5\u98ce\u9669\u3002';
    } else {
      summary = '\u2796 ' + displayName + '\u5f53\u524d\u5e02\u573a\u73af\u5883\u4e2d\u6027\uff0c\u65e0\u660e\u663e\u5f02\u52a8\u4fe1\u53f7\uff0c\u7ef4\u6301\u6b63\u5e38\u5173\u6ce8\u3002';
    }

    const hasResult = concepts.length > 0 ||
      sectorContext.indexOf('\u6682\u65e0') === -1 ||
      capitalFlowAnalysis.indexOf('\u6682\u65e0') === -1;

    return {
      hasResult: true,
      priceAlert,
      priceAlertDetail,
      capitalFlowAnalysis,
      sectorContext,
      concepts,
      compositeScore,
      sentiment,
      summary,
    };
  }
}
