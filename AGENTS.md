# AGENTS.md

本文件指导 Codex（Codex.ai/code）在此仓库中工作。

## 项目概述

股票分析工具 — A股技术分析网页应用 + 微信小程序版。用户搜索股票代码/名称，查看K线图及技术指标（MA/MACD/RSI/KDJ/布林带），ARIMA价格预测，多指标买卖信号，分时走势，主力资金流向，以及市场复盘分析。

## 常用命令

```bash
# 安装依赖
cd stock-analysis-app && npm install

# 启动开发环境（服务器:3003 + 客户端:5174，并行启动）
npm run dev

# 仅启动服务端
npm run dev:server

# 仅启动客户端
npm run dev:client

# 生产构建
npm run build

# 启动生产服务（提供前端静态文件）
npm start
```

微信小程序（`stock-analysis-miniapp-native/`）无需构建步骤，直接通过微信开发者工具上传。

## 后端架构

**入口:** `server/index.ts` — Express 应用，路由挂载在 `/api/stock` 下。

**路由**（搜索在 `stockRoutes.ts`，其余在 `analysisRoutes.ts`）:
- `GET /search?q=` — 股票搜索
- `GET /:code/analysis?count=200&predictDays=10` — 完整分析（信息 + K线 + 预测 + 信号），缓存1小时
- `GET /:code/intraday` — 当日分时数据
- `GET /:code/quote` — 轻量实时行情（每5秒轮询）
- `GET /:code/fund-flow` — 主力资金流向
- `GET /:code/purchase-analysis?buyPrice=` — 买入价诊断
- `GET /:code/backtest` — 预测回测对比
- `GET /indices` — 大盘指数（上证、深证、创业板、科创50、沪深300）

**核心服务**（`server/services/`）:

| 服务 | 功能 |
|---|---|
| `StockDataService` | 搜索、实时行情、K线（4级降级策略：stock-sdk → 无指标 → 原始K线 → 腾讯fqkline API）、资金流向。自动标准化代码前缀（`sh`/`sz`/`bj`/`hk`）。 |
| `PredictionService` | ARIMA时间序列预测，SMA降级兜底 |
| `SignalService` | 多指标加权评分 → STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL |
| `CacheService` | 双层缓存：内存（node-cache）+ JSON文件缓存到 `data/` 目录 |
| `MarketContextService` | 市场级别上下文（板块、指数、资金流向） |
| `PredictionHistoryService` | 保存预测记录到磁盘，运行回测对比 |
| `PredictionCorrectionService` | 根据市场状态调整ARIMA漂移/波动系数 |

**缓存:** `CacheService` 写入 `data/*.json`，TTL可配置。分析结果缓存1小时。如需强制刷新，删除 `data/*.json` 后重启服务。

## 前端架构

**入口:** `src/main.tsx` → React 18 + react-router-dom + Ant Design（中文）

**应用壳:** `Layout.tsx` — 固定顶部导航栏（大盘指数 + "股票分析工具"标题）、标签页内容区、底部免责声明。大盘指数每30秒轮询一次（仅交易时段）。

**标签系统:** `TabContext.tsx` 管理多只股票标签，支持拖拽排序。每只股票的分析是一个标签。

**关键组件**（`src/components/`）:
- `StockOverview` — 实时价格、涨跌幅、高开低收、成交量、换手率（红涨绿跌）
- `IntradayChart` — ECharts折线图：价格 + 均价 + 成交量 + 买卖信号标记
- `KlineChart` — ECharts K线图：MA5/10/20/60、布林带、买卖信号、神奇九转、波段点、资金流向
- `IndicatorCharts` — MACD + RSI(6) + KDJ 三行迷你图表
- `PredictionChart` — 最近30天价格 + ARIMA预测 + 置信区间
- `SignalPanel` — 综合信号 + 详情表格 + 支撑/阻力位
- `MarketRecap` — 自动生成的文字复盘（5个可折叠板块）
- `PositionAdvice` — 基于信号的建仓/减仓小徽章
- `BacktestReport` — 预测准确度指标
- `PurchaseAnalysis` — 买入价诊断工具

**页面**（`src/pages/`）:
- `HomePage` — 搜索栏 + 功能卡片
- `AnalysisPage` — 组装所有组件。轮询：行情（5秒）、分时（15秒）、资金流向（60秒）。合并实时行情到 `liveInfo` 实现价格实时更新。

**轮询:** `usePolling` hook（`src/hooks/usePolling.ts`）— 仅在交易时段（工作日 9:30-11:30、13:00-15:00）且页面可见时运行。

**高级指标工具**（`src/utils/`）:
- `marketRecap.ts` — 从数据生成完整文字复盘
- `advancedIndicators.ts` — 三把锁、TD Sequential、波段买卖点、多空力量对比

## 微信小程序

`stock-analysis-miniapp-native/` — 原生 WXML/WXSS/JS 格式，无构建步骤。

- `utils/api.js` — 通过 `wx.request` 调用后端接口
- `pages/index/index` — 搜索 + 历史记录
- `pages/analysis/analysis` — 单页完整分析视图，对标PC端。JS代码为压缩风格。数据类型/价格、分时、指数字段以此轮询（5秒/15秒/30秒），仅交易时段运行。

**重要规则：小程序 WXML 的 `{{}}` 中不能调用 `.toFixed()` 等方法 — 所有数据在 JS 中格式化好后再 `setData`。**

## 重要模式

- **API 改动必须同步到 PC 和小程序两端** — 同一个后端服务支撑两端
- **股票代码标准化:** `StockDataService.normalizeCode()` 自动添加市场前缀（600519→sh600519, 000858→sz000858, 00700→hk00700）
- **换手率公式:** `volume_shares / ((marketCap * 100000000) / price) * 100`（stock-sdk 的 marketCap 单位为"亿"）
- **成交量单位:** 腾讯 API K线返回"手"（×100得股数），分时返回"股"（直接用）
- **颜色规则:** 涨=红（`#cf1322`）、跌=绿（`#3cb371`）
- **状态覆盖:** 所有组件需处理：加载中、错误（带重试）、空数据、404 四种状态
- **Ant Design v5 兼容:** 使用 `styles={{ body: {...} }}` 替代 `bodyStyle`，`styles={{ root: {...} }}` 替代 `overlayStyle`
- **修改规则:** 每次修改需要同步修改PC端盒小程序端
