import type { Request, Response, NextFunction } from 'express';
import { StockNotFoundError } from '../services/stockDataService';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message);

  if (err instanceof StockNotFoundError) {
    res.status(404).json({
      error: '股票未找到',
      detail: err.message,
    });
    return;
  }

  if (err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')) {
    res.status(504).json({
      error: '数据源请求超时',
      detail: '请稍后重试',
    });
    return;
  }

  if (err.message?.includes('INVALID_SYMBOL') || err.message?.includes('invalid')) {
    res.status(400).json({
      error: '无效的股票代码',
      detail: err.message,
    });
    return;
  }

  const msg = err.message?.toLowerCase() || '';

  if (msg.includes('fetch failed') || msg.includes('other side closed') || msg.includes('econnrefused')) {
    // 数据源（东方财富/腾讯）API不可用
    res.status(503).json({
      error: '行情数据源暂时不可用',
      detail: '当前网络环境下财经数据API被限制，沪市（600/603/688开头）可能正常，深市股票暂无法获取日K线数据。请尝试搜索沪市股票，或切换网络环境。',
    });
    return;
  }

  res.status(500).json({
    error: '服务器内部错误',
    detail: err.message || '请稍后重试',
  });
}
