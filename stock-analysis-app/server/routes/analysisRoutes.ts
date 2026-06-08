import { Router, type Request, type Response, type NextFunction } from 'express';
import { StockDataService, StockNotFoundError } from '../services/stockDataService';
import { PredictionService } from '../services/predictionService';
import { SignalService } from '../services/signalService';
import { PurchaseAnalysisService } from '../services/purchaseAnalysisService';
import { CacheService } from '../services/cacheService';
import { PredictionHistoryService } from '../services/predictionHistoryService';
import { config } from '../config';
import type { PredictionResult, SignalResult } from '../types';

const router = Router();
const stockDataService = new StockDataService();
const predictionService = new PredictionService();
const signalService = new SignalService();
const purchaseAnalysisService = new PurchaseAnalysisService();
const cache = new CacheService();
const predHistoryService = new PredictionHistoryService();

// GET /api/stock/:code/intraday — 当日分时图数据
router.get('/:code/intraday', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const data = await stockDataService.getTodayTimeline(code);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/stock/:code/quote — 实时行情（轻量，用于轮询）
router.get('/:code/quote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const info = await stockDataService.getStockInfo(code);
    res.json({
      price: info.price,
      change: info.change,
      changePercent: info.changePercent,
      high: info.high,
      low: info.low,
      open: info.open,
      prevClose: info.prevClose,
      volume: info.volume,
      amount: info.amount,
      marketCap: info.marketCap,
      turnoverRate: info.turnoverRate,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/stock/:code/fund-flow — 主力资金流向
router.get('/:code/fund-flow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const days = Math.min(Math.max(Number(req.query.days) || 60, 10), 120);
    const data = await stockDataService.getFundFlow(code);
    // 只返回最近的 days 条
    res.json(data.slice(-days));
  } catch (err) {
    next(err);
  }
});

// GET /api/stock/:code/purchase-analysis?buyPrice=26.03
router.get('/:code/purchase-analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const buyPrice = Number(req.query.buyPrice);

    if (!buyPrice || buyPrice <= 0) {
      res.status(400).json({ error: '请提供有效的买入价（buyPrice）' });
      return;
    }

    const count = 200;
    const info = await stockDataService.getStockInfo(code);
    const kline = await stockDataService.getKlineWithIndicators(code, {
      count,
      fq: 'qfq',
      indicators: {
        ma: { periods: [5, 10, 20, 60] },
        macd: { fast: 12, slow: 26, signal: 9 },
        boll: { period: 20, stdDev: 2 },
        rsi: { period: 14 },
        kdj: { period: 9, kPeriod: 3, dPeriod: 3 },
      },
    });

    const result = purchaseAnalysisService.analyze(kline, info.price, buyPrice);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/stock/:code/analysis?period=daily&count=200&predictDays=10
router.get('/:code/analysis', async (req: Request, res: Response, next: NextFunction) => {
  const { code } = req.params;

  // Validate parameters
  if (!code || code.trim().length === 0) {
    res.status(400).json({ error: '请提供股票代码' });
    return;
  }

  const count = Math.min(
    Math.max(Number(req.query.count) || config.defaultKlineCount, 30),
    config.maxKlineCount
  );
  const predictDays = Math.min(
    Math.max(Number(req.query.predictDays) || config.defaultPredictDays, 1),
    config.maxPredictDays
  );

  const cacheKey = `analysis_${code}_${count}_${predictDays}`;

  try {
    // Check if analysis is cached
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    // 1. Get stock info（必须成功，否则无法继续）
    const info = await stockDataService.getStockInfo(code);

    // 2. Get K-line with indicators（可能失败，尤其是港股）
    let kline: any[] = [];
    let klineWarning = '';
    try {
      kline = await stockDataService.getKlineWithIndicators(code, {
        count,
        fq: 'qfq',
        indicators: {
          ma: { periods: [5, 10, 20, 60] },
          macd: { fast: 12, slow: 26, signal: 9 },
          boll: { period: 20, stdDev: 2 },
          rsi: { period: 14 },
          kdj: { period: 9, kPeriod: 3, dPeriod: 3 },
        },
      });
    } catch (err: any) {
      console.warn(`[Analysis] K-line unavailable for ${code}: ${err.message}`);
      klineWarning = '日K线数据暂不可用，部分功能受限';
    }

    // 3. Run prediction（K线数据不足时跳过）
    let prediction: PredictionResult = {
      method: 'INSUFFICIENT_DATA',
      forecast: [],
      trend: 'sideways',
      confidence: 'low',
    }
    if (kline.length >= 30) {
      try {
        prediction = await predictionService.predict(kline, predictDays);
      } catch {
        console.warn(`[Analysis] Prediction failed for ${code}`);
      }
    }

    // 4. Generate signals
    let signals: SignalResult = {
      overall: 'HOLD',
      strength: 0,
      details: [],
      support: info.price * 0.95,
      resistance: info.price * 1.05,
      stopLoss: { price: info.price * 0.93, percent: -7, reason: '数据不足' },
      takeProfit: { price: info.price * 1.07, percent: 7, reason: '数据不足' },
    }
    if (kline.length >= 20) {
      try {
        const analysisKline = kline.slice(-120);
        signals = signalService.generateSignals(analysisKline);
      } catch {
        console.warn(`[Analysis] Signal generation failed for ${code}`);
      }
    }

    // 保存预测记录用于回测
    predHistoryService.save(code, prediction, info.price);

    const result: any = { info, kline, prediction, signals };
    if (klineWarning) result.warning = klineWarning;

    // Cache the result（即使K线失败也缓存info部分）
    if (kline.length > 0) {
      await cache.set(cacheKey, result, config.cacheTTL.dailyKline);
    }

    res.json(result);
  } catch (err) {
    // Try to return stale cache data as fallback when data source is unavailable
    console.warn(`[Analysis] Failed to fetch fresh data for ${code}, trying stale cache...`);
    const staleData = await cache.get<any>(cacheKey, true);
    if (staleData) {
      console.log(`[Analysis] Returning stale cached data for ${code}`);
      res.json({ ...staleData, warning: '当前数据源暂时不可用，显示的是缓存数据' });
      return;
    }
    next(err);
  }
});

// GET /api/stock/:code/backtest — 预测回测
router.get('/:code/backtest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const count = Math.min(
      Math.max(Number(req.query.count) || config.defaultKlineCount, 30),
      config.maxKlineCount
    );
    const kline = await stockDataService.getKlineWithIndicators(code, {
      count,
      fq: 'qfq',
      indicators: { ma: { periods: [5] } },
    });
    const result = predHistoryService.backtest(code, kline);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/market/indices — 大盘指数行情
router.get('/indices', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const url = 'https://qt.gtimg.cn/q=sh000001,sz399001,sz399006,sh000688,sz399300';
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const buf = Buffer.from(await resp.arrayBuffer());
    // 硬编码中文名（避免GBK解码问题）
    const NAME_MAP: Record<string, string> = {
      '000001': '上证指数',
      '399001': '深证成指',
      '399006': '创业板指',
      '000688': '科创50',
      '399300': '沪深300',
    };
    const text = buf.toString('utf-8');
    const lines = text.split('\n').filter(Boolean);
    const result = lines.map((line: string) => {
      // v_sh000001="...~...~..."
      const m = line.match(/^v_([a-z]+)(\d+)="(.+)/);
      if (!m) return null;
      const codeNum = m[2]; // e.g. "000001"
      const parts = m[3].split('~');
      return {
        name: NAME_MAP[codeNum] || codeNum,
        code: m[1] + codeNum,
        price: parseFloat(parts[3]) || 0,
        change: parseFloat(parts[31]) || 0,
        changePercent: parseFloat(parts[32]) || 0,
        open: parseFloat(parts[5]) || 0,
        high: parseFloat(parts[33]) || 0,
        low: parseFloat(parts[34]) || 0,
      };
    }).filter(Boolean);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export { router as analysisRoutes };
