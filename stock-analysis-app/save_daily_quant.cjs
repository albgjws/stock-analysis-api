const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

// 读取配置
const ROOT = __dirname;
const TRACK_FILE = path.join(ROOT, "data", "tracked_codes.json");
const DB_PATH = path.join(ROOT, "data", "stock_analysis.db");

/**
 * 初始化数据库架构（包含量化分析表）
 */
function initDB(db) {
  db.exec(`
    -- K线缓存（已有）
    CREATE TABLE IF NOT EXISTS kline_cache (
      code TEXT NOT NULL,
      trade_date TEXT NOT NULL,
      period TEXT DEFAULT 'daily',
      open_price REAL DEFAULT 0,
      close_price REAL DEFAULT 0,
      high_price REAL DEFAULT 0,
      low_price REAL DEFAULT 0,
      volume INTEGER DEFAULT 0,
      amount REAL DEFAULT 0,
      ma5 REAL, ma10 REAL, ma20 REAL, ma60 REAL,
      macd_dif REAL, macd_dea REAL, macd_bar REAL,
      rsi6 REAL, rsi14 REAL,
      kdj_k REAL, kdj_d REAL, kdj_j REAL,
      boll_up REAL, boll_mid REAL, boll_down REAL,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (code, trade_date, period)
    );

    -- 量化分析报告（新增）
    CREATE TABLE IF NOT EXISTS quantitative_reports (
      code TEXT NOT NULL,
      report_date TEXT NOT NULL,
      overall_score INTEGER DEFAULT 0,
      data_quality_score INTEGER DEFAULT 0,
      var95 REAL DEFAULT 0,
      sharpe_ratio REAL DEFAULT 0,
      annual_volatility REAL DEFAULT 0,
      max_drawdown REAL DEFAULT 0,
      kelly_fraction REAL DEFAULT 0,
      liquidity_score INTEGER DEFAULT 0,
      vwap REAL DEFAULT 0,
      order_imbalance REAL DEFAULT 0,
      mean_reversion_zscore REAL DEFAULT 0,
      momentum_1m REAL DEFAULT 0,
      momentum_3m REAL DEFAULT 0,
      momentum_6m REAL DEFAULT 0,
      out_sample_sharpe REAL DEFAULT 0,
      risk_level TEXT DEFAULT 'medium',
      suitability TEXT DEFAULT 'swing_trading',
      key_insight TEXT DEFAULT '',
      warnings TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (code, report_date)
    );

    -- 因子分析数据（新增）
    CREATE TABLE IF NOT EXISTS factor_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      report_date TEXT NOT NULL,
      factor_name TEXT NOT NULL,
      ic REAL DEFAULT 0,
      rank_ic REAL DEFAULT 0,
      hit_rate REAL DEFAULT 0,
      sharpe REAL DEFAULT 0,
      decay REAL DEFAULT 0,
      stability INTEGER DEFAULT 0
    );

    -- 微观结构数据（新增）
    CREATE TABLE IF NOT EXISTS microstructure_data (
      code TEXT NOT NULL,
      trade_date TEXT NOT NULL,
      avg_spread REAL DEFAULT 0,
      vwap REAL DEFAULT 0,
      vwap_deviation REAL DEFAULT 0,
      order_imbalance REAL DEFAULT 0,
      liquidity_score INTEGER DEFAULT 0,
      amihud_illiquidity REAL DEFAULT 0,
      volume_profile TEXT DEFAULT '',
      market_impact REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (code, trade_date)
    );

    -- 回测结果表（新增）
    CREATE TABLE IF NOT EXISTS backtest_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      backtest_date TEXT NOT NULL,
      in_sample_sharpe REAL DEFAULT 0,
      out_sample_sharpe REAL DEFAULT 0,
      robustness INTEGER DEFAULT 0,
      parameter_stability INTEGER DEFAULT 0,
      strategy_variance REAL DEFAULT 0,
      recommended INTEGER DEFAULT 0
    );

    -- 尾部风险事件记录（新增）
    CREATE TABLE IF NOT EXISTS tail_risk_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT,
      event_date TEXT NOT NULL,
      event_type TEXT NOT NULL,  -- 'gap_down', 'limit_down', 'flash_crash', 'high_volatility'
      price_change REAL DEFAULT 0,
      volume_spike REAL DEFAULT 0,
      recovery_days INTEGER DEFAULT 0,
      description TEXT DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_quant_date ON quantitative_reports(report_date);
    CREATE INDEX IF NOT EXISTS idx_factor_code ON factor_analysis(code, report_date);
    CREATE INDEX IF NOT EXISTS idx_micro_date ON microstructure_data(trade_date);
    CREATE INDEX IF NOT EXISTS idx_tail_event ON tail_risk_events(event_date, event_type);
  `);
  console.log("鉁? SQLite schema initialized with quantitative tables");
}

/**
 * 保存量化报告到 SQLite
 */
function saveQuantitativeReport(db, code, report, today) {
  try {
    const r = report;
    const upsertReport = db.prepare(`
      INSERT OR REPLACE INTO quantitative_reports
        (code, report_date, overall_score, data_quality_score, var95, sharpe_ratio,
         annual_volatility, max_drawdown, kelly_fraction, liquidity_score,
         vwap, order_imbalance, mean_reversion_zscore, momentum_1m, momentum_3m, momentum_6m,
         out_sample_sharpe, risk_level, suitability, key_insight, warnings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    upsertReport.run(
      code, today,
      r.summary?.overallScore || 0,
      r.dataQuality?.overallScore || 0,
      r.risk?.var95 || 0,
      r.risk?.sharpeRatio || 0,
      r.risk?.annualVolatility || 0,
      r.risk?.maxDrawdown || 0,
      r.risk?.kellyFraction || 0,
      r.microstructure?.liquidityScore || 0,
      r.microstructure?.vwap || 0,
      r.microstructure?.orderImbalance || 0,
      r.meanReversion?.zscore || 0,
      r.momentum?.momentum1M || 0,
      r.momentum?.momentum3M || 0,
      r.momentum?.momentum6M || 0,
      r.walkForward?.outSampleSharpe || 0,
      r.summary?.riskLevel || 'medium',
      r.summary?.suitability || 'swing_trading',
      r.summary?.keyInsight || '',
      JSON.stringify(r.summary?.warnings || [])
    );

    // 保存因子分析
    if (r.factors && r.factors.length > 0) {
      const upsertFactor = db.prepare(`
        INSERT INTO factor_analysis (code, report_date, factor_name, ic, rank_ic, hit_rate, sharpe, decay, stability)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const f of r.factors) {
        upsertFactor.run(code, today, f.factorName, f.ic, f.rankIC, f.hitRate, f.sharpe, f.decay, f.stability);
      }
    }

    // 保存微观结构
    const upsertMicro = db.prepare(`
      INSERT OR REPLACE INTO microstructure_data
        (code, trade_date, avg_spread, vwap, vwap_deviation, order_imbalance, liquidity_score, amihud_illiquidity, volume_profile, market_impact)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const m = r.microstructure;
    upsertMicro.run(code, today, m?.averageSpread || 0, m?.vwap || 0, m?.vwapDeviation || 0, m?.orderImbalance || 0,
      m?.liquidityScore || 0, m?.amihudIlliquidity || 0, m?.volumeProfile || '', m?.marketImpact || 0);

    return true;
  } catch (e) {
    console.error("鉂? Save quantitative report failed:", e.message);
    return false;
  }
}

async function main() {
  console.log("\n钀嶏笍 QuantDaily 鈥? 每日量化数据采集\n");

  if (!fs.existsSync(TRACK_FILE)) { console.log("馃摥 No tracked codes"); return; }
  const raw = fs.readFileSync(TRACK_FILE, "utf-8").trim();
  if (!raw) { console.log("馃摥 No tracked codes"); return; }

  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set();
  const codes = [];
  raw.split("\n").forEach((l) => {
    try {
      const o = JSON.parse(l);
      if (o.time.slice(0, 10) === today) {
        const n = o.code.replace(/[^a-zA-Z0-9]/g, "");
        if (!seen.has(n)) { seen.add(n); codes.push(n); }
      }
    } catch (e) {}
  });

  if (!codes.length) { console.log("馃摥 No queries today"); return; }
  console.log("馃搳 Today codes:", codes.length, codes.join(", "));

  // 连接 SQLite
  const db = new Database(DB_PATH);
  initDB(db);

  for (const code of codes) {
    try {
      console.log("\n馃搱 Processing:", code);

      // 获取K线数据
      const sdk = require("stock-sdk");
      const kline = await sdk.getKlineWithIndicators({ code, count: 200 });

      if (!kline || !kline.length) { console.log("  鈿狅笍 No data"); continue; }

      // 批量写入K线
      const insKline = db.prepare(`
        INSERT OR REPLACE INTO kline_cache
          (code, trade_date, period, open_price, close_price, high_price, low_price, volume, amount,
           ma5, ma10, ma20, ma60, macd_dif, macd_dea, macd_bar, rsi6, rsi14, kdj_k, kdj_d, kdj_j, boll_up, boll_mid, boll_down)
        VALUES (?, 'daily', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      // ... 写入逻辑略（同 save_daily_data_sqlite.cjs）

      // 调用量化引擎
      try {
        const { QuantitativeEngine } = require("./server/services/quantitativeEngine");
        const engine = new QuantitativeEngine();
        const report = engine.analyze({
          code,
          kline,
        });
        saveQuantitativeReport(db, code, report, today);
        console.log("   鉁? Quantitative report saved [score:", report.summary?.overallScore, "]");
      } catch (qeErr) {
        console.log("   鈿狅笍 Quant engine:", qeErr.message);
      }
    } catch (e) {
      console.log("   鉂? Error:", e.message);
    }
  }

  fs.writeFileSync(TRACK_FILE, "");
  db.close();
  console.log("\n鉁? QuantDaily done!");
}

main().catch((e) => { console.error("鉂?", e.message); process.exit(1); });
