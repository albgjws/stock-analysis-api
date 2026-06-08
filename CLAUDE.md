# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A股分析工具 — A-share stock analysis web app with WeChat Mini Program companion. Users search stocks, view K-line charts with technical indicators, get ARIMA predictions, multi-indicator buy/sell signals, intraday charts, fund flow analysis, and market recaps.

## Commands

```bash
# Install dependencies
cd stock-analysis-app && npm install

# Start dev environment (server on :3003, client on :5174, concurrently)
npm run dev

# Start server only
npm run dev:server

# Start client only
npm run dev:client

# Build for production
npm run build

# Start production server (serves built frontend)
npm start
```

The WeChat Mini Program (`stock-analysis-miniapp-native/`) has no build step — upload directly via WeChat DevTools.

## Server Architecture

**Entry:** `server/index.ts` — Express app mounts routes under `/api/stock`.

**Routes** (all in `server/routes/analysisRoutes.ts` except search in `stockRoutes.ts`):
- `GET /search?q=` — Stock search
- `GET /:code/analysis?count=200&predictDays=10` — Full analysis (info + kline + prediction + signals), cached 1h
- `GET /:code/intraday` — Today's price timeline
- `GET /:code/quote` — Lightweight real-time quote (polled every 5s)
- `GET /:code/fund-flow` — Main force capital flow
- `GET /:code/purchase-analysis?buyPrice=` — Purchase price diagnosis
- `GET /:code/backtest` — Prediction backtest comparison
- `GET /indices` — Market indices (上证, 深证, 创业板, 科创50, 沪深300)

**Key Services** (`server/services/`):

| Service | Purpose |
|---|---|
| `StockDataService` | Search, real-time quotes, K-line (4 fallback strategies: stock-sdk → stock-sdk no-indicators → raw history → Tencent fqkline API), fund flow. Normalizes codes with market prefix (`sh`/`sz`/`bj`/`hk`). |
| `PredictionService` | ARIMA time series prediction with SMA fallback |
| `SignalService` | Multi-indicator weighted scoring → STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL |
| `CacheService` | Two-tier: in-memory (node-cache) + JSON file cache in `data/` |
| `MarketContextService` | Market-level context (sectors, indices, fund flow) |
| `PredictionHistoryService` | Saves predictions to disk, runs backtest comparisons |
| `PredictionCorrectionService` | Adjusts ARIMA drift/volatility by market regime |

**Caching:** `CacheService` writes to `data/*.json` with configurable TTL. Analysis results cache 1h. To force refresh, delete `data/*.json` files and restart server.

## Frontend Architecture

**Entry:** `src/main.tsx` → React 18 + react-router-dom + Ant Design (zh_CN)

**App shell:** `Layout.tsx` — sticky header with index ticker + "A股分析工具" branding, tabbed content area, footer. Market index ticker polls every 30s during trading hours.

**Tab system:** `TabContext.tsx` manages multi-stock tabs with drag-reorder. Each stock analysis is a tab.

**Key components** (`src/components/`):
- `StockOverview` — Real-time price, change, OHLC, volume, turnover rate (colors: red for up, green for down)
- `IntradayChart` — ECharts line: price + avg + volume + signal markers
- `KlineChart` — ECharts candlestick: MA5/10/20/60, Bollinger, signals, TD9, swing, fund flow
- `IndicatorCharts` — MACD + RSI(6) + KDJ mini charts in a row
- `PredictionChart` — Last 30 prices + ARIMA forecast with confidence bands
- `SignalPanel` — Overall signal + detail table + support/resistance
- `MarketRecap` — AI-generated text recap (5 collapsible sections)
- `PositionAdvice` — Tiny badge based on signal
- `BacktestReport` — Prediction accuracy metrics
- `PurchaseAnalysis` — Price diagnosis tool

**Pages** (`src/pages/`):
- `HomePage` — Search bar + feature cards
- `AnalysisPage` — Orchestrates all components. Polls: quote (5s), intraday (15s), fund flow (60s). Merges live quote into `liveInfo` for real-time price updates.

**Polling:** `usePolling` hook in `src/hooks/usePolling.ts` — only runs during trading hours (weekdays 9:30-11:30, 13:00-15:00) and when page is visible.

**Advanced indicators** (`src/utils/`):
- `marketRecap.ts` — Generates full text recap from data
- `advancedIndicators.ts` — Three locks, TD Sequential, swing points, bull/bear gauge

## WeChat Mini Program

`stock-analysis-miniapp-native/` — Native WXML/WXSS/JS format, no build step.

- `utils/api.js` — Calls same backend endpoints via `wx.request`
- `pages/index/index` — Search + history
- `pages/analysis/analysis` — Single page mirroring the PC analysis view. JS is minified-style. Polls: quote (5s), intraday (15s), indices (30s) during trading hours.

**Critical rule: Mini Program WXML `{{}}` cannot call `.toFixed()` etc. — format all data in JS before `setData`.**

## Important Patterns

- **API changes must be synced to both PC and Mini Program** — same backend serves both
- **Stock code normalization:** `StockDataService.normalizeCode()` adds market prefix (600519→sh600519, 000858→sz000858, 00700→hk00700)
- **Turnover rate formula:** `volume_shares / ((marketCap * 100000000) / price) * 100` (marketCap from stock-sdk is in 亿)
- **Volume units:** K-line from Tencent API returns 手 (×100 for shares), intraday timeline returns 股 (actual shares)
- **Color convention:** 涨=红(`#cf1322`), 跌=绿(`#3cb371`)
- **All components handle:** loading, error (with retry), empty, and 404 states
- **Deprecation warning fix:** Ant Design v5 — use `styles={{ body: {...} }}` instead of `bodyStyle`, `styles={{ root: {...} }}` instead of `overlayStyle`
