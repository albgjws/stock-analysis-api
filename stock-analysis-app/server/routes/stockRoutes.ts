import { Router, type Request, type Response, type NextFunction } from 'express';
import { StockDataService, StockNotFoundError } from '../services/stockDataService';

const router = Router();
const stockDataService = new StockDataService();

// GET /api/stock/search?q=keyword
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.status(400).json({ error: '请提供搜索关键词' });
      return;
    }

    const results = await stockDataService.searchStocks(q);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

export { router as stockRoutes };
