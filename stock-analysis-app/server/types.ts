export interface SearchResultItem {
  code: string;
  name: string;
  market: string;
  type: string;
}

export interface StockInfo {
  code: string;
  name: string;
  market: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  marketCap: number;
  open: number;
  prevClose: number;
  turnoverRate?: number;
}

export interface MAValues {
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma60?: number;
}

export interface MACDValues {
  dif: number;
  dea: number;
  macd: number;
}

export interface BollValues {
  mid: number;
  upper: number;
  lower: number;
  bandwidth?: number;
}

export interface KDJValues {
  k: number;
  d: number;
  j: number;
}

export interface KlineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  changePercent?: number;
  change?: number;
  amplitude?: number;
  turnoverRate?: number;
  timestamp: number;
  code: string;
  ma?: MAValues;
  macd?: MACDValues;
  boll?: BollValues;
  rsi?: {
    rsi6?: number;
    rsi12?: number;
    rsi24?: number;
  };
  kdj?: KDJValues;
}

export interface ForecastPoint {
  date: string;
  value: number;
  upper80: number;
  lower80: number;
  upper95: number;
  lower95: number;
}

export interface PredictionResult {
  method: 'ARIMA' | 'LINEAR_REGRESSION' | 'SMA' | 'INSUFFICIENT_DATA';
  params?: Record<string, number>;
  forecast: ForecastPoint[];
  trend: 'up' | 'down' | 'sideways';
  confidence: 'high' | 'medium' | 'low';
}

export interface SignalDetail {
  indicator: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  score: number;
  description: string;
}

export interface StopLevel {
  price: number;
  percent: number;
  reason: string;
}

export interface SignalResult {
  overall: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  strength: number;
  details: SignalDetail[];
  support: number;
  resistance: number;
  stopLoss: StopLevel;
  takeProfit: StopLevel;
}

export interface AnalysisResponse {
  info: StockInfo;
  kline: KlineBar[];
  prediction: PredictionResult;
  signals: SignalResult;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface PurchaseDetail {
  item: string;
  status: 'good' | 'neutral' | 'bad';
  comment: string;
}

export interface PurchaseAnalysisResult {
  purchasePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  rating: 'excellent' | 'good' | 'neutral' | 'risky' | 'bad';
  ratingLabel: string;
  score: number;
  details: PurchaseDetail[];
  stopLoss: StopLevel;
  takeProfit: StopLevel;
  probability: { up: number; down: number };
}
