import type { SearchResult, AnalysisResponse } from '../types';

const BASE_URL = '/api/stock';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

class NotFoundError extends ApiError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export async function searchStocks(query: string): Promise<SearchResult[]> {
  const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new ApiError('搜索失败', res.status);
  return res.json();
}

export async function getAnalysis(
  code: string,
  options?: { count?: number; predictDays?: number }
): Promise<AnalysisResponse> {
  const params = new URLSearchParams();
  if (options?.count) params.set('count', String(options.count));
  if (options?.predictDays) params.set('predictDays', String(options.predictDays));

  const url = `${BASE_URL}/${encodeURIComponent(code)}/analysis?${params}`;
  const res = await fetch(url);

  if (res.status === 404) throw new NotFoundError('股票未找到');
  if (!res.ok) throw new ApiError('分析加载失败', res.status);

  return res.json();
}

export async function getBacktest(code: string): Promise<any> {
  const url = `${BASE_URL}/${encodeURIComponent(code)}/backtest`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

export async function getIntraday(code: string): Promise<any> {
  const url = `${BASE_URL}/${encodeURIComponent(code)}/intraday`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError('分时数据加载失败', res.status);
  return res.json();
}

export async function getQuote(code: string): Promise<any> {
  const url = `${BASE_URL}/${encodeURIComponent(code)}/quote`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError('行情数据加载失败', res.status);
  return res.json();
}

export async function getFundFlow(code: string, days: number = 60): Promise<any[]> {
  const url = `${BASE_URL}/${encodeURIComponent(code)}/fund-flow?days=${days}`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError('资金流向加载失败', res.status);
  return res.json();
}

export async function getMarketIndices(): Promise<any[]> {
  const url = `${BASE_URL}/indices`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError('大盘指数加载失败', res.status);
  return res.json();
}

export async function getCorrectionReport(): Promise<any[]> {
  const url = `${BASE_URL}/correction-report`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

export { ApiError, NotFoundError };
