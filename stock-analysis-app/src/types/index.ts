export interface SearchResult {
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
  ma?: MAValues;
  macd?: { dif: number; dea: number; macd: number };
  boll?: { mid: number; upper: number; lower: number; bandwidth?: number };
  rsi?: { rsi6?: number; rsi12?: number; rsi24?: number };
  kdj?: { k: number; d: number; j: number };
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

export interface IntradayPoint {
  time: string;
  timestamp: number;
  price: number;
  volume: number;
  amount: number;
  avgPrice: number;
}

export interface IntradayData {
  code: string;
  date: string;
  preClose: number;
  data: IntradayPoint[];
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

export interface AnalysisResponse {
  info: StockInfo;
  kline: KlineBar[];
  prediction: PredictionResult;
  signals: SignalResult;
  /** 数据源不可用时返回的提示信息 */
  warning?: string;
}
