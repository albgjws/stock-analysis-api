/**
 * 收盘存库脚本 — 读取 data/analysis_*.json 缓存文件
 * 提取当天的股票K线数据存到 SQLite
 *
 * 用法：cd 项目目录 && node save_daily_data.cjs
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_PATH = path.resolve(DATA_DIR, 'stock_analysis.db');

function initDB(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kline_cache (
      code TEXT NOT NULL, trade_date TEXT NOT NULL,
      period TEXT DEFAULT 'daily',
      open_price REAL, close_price REAL, high_price REAL, low_price REAL,
      volume INTEGER DEFAULT 0, amount REAL DEFAULT 0,
      ma5 REAL, ma10 REAL, ma20 REAL, ma60 REAL,
      macd_dif REAL, macd_dea REAL, macd_bar REAL,
      rsi6 REAL, rsi14 REAL,
      kdj_k REAL, kdj_d REAL, kdj_j REAL,
      boll_up REAL, boll_mid REAL, boll_down REAL,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (code, trade_date, period)
    );
    CREATE TABLE IF NOT EXISTS scan_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL, name TEXT DEFAULT '',
      scan_date TEXT NOT NULL,
      signal_type TEXT DEFAULT 'HOLD',
      signal_strength REAL DEFAULT 0,
      strategy_name TEXT DEFAULT '',
      price REAL DEFAULT 0, change_percent REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) { console.log('❌ data/ 目录不存在'); return; }

  const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('analysis_') && f.endsWith('.json'));
  if (!files.length) { console.log('📭 没有 analysis_*.json 缓存文件'); return; }

  // 从文件名提取股票代码
  const codes = [];
  for (const file of files) {
    const m = file.match(/^analysis_(.+?)_\d+_\d+\.json$/);
    if (m) codes.push(m[1]);
  }
  if (!codes.length) { console.log('📭 未能提取股票代码'); return; }

  const today = new Date().toISOString().slice(0, 10);
  console.log('📊 缓存文件发现', codes.length, '只股票');
  console.log('   ', codes.join(', '));

  const db = new Database(DB_PATH);
  initDB(db);
  console.log('✅ 连上 SQLite');

  const sdk = new (require('stock-sdk').StockSDK)();

  const insKline = db.prepare(`INSERT OR REPLACE INTO kline_cache
    (code, trade_date, period, open_price, close_price, high_price, low_price, volume, amount,
     ma5, ma10, ma20, ma60, macd_dif, macd_dea, macd_bar, rsi6, rsi14, kdj_k, kdj_d, kdj_j, boll_up, boll_mid, boll_down)
    VALUES (?, ?, 'daily', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const insSignal = db.prepare(`INSERT INTO scan_results
    (code, name, scan_date, signal_type, signal_strength, strategy_name, price, change_percent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  let totalKline = 0, totalSignal = 0;

  for (const code of codes) {
    try {
      console.log('\n📈', code, '...');
      const kline = await sdk.getKlineWithIndicators({ code, count: 200 });
      if (!kline || !kline.length) { console.log('   ⚠️ 无数据'); continue; }

      const insBatch = db.transaction((rows) => {
        let n = 0;
        for (const bar of rows) {
          const d = bar.timestamp ? new Date(bar.timestamp).toISOString().slice(0,10) : '';
          if (!d || d > today) continue;
          insKline.run(code, d,
            bar.open, bar.close, bar.high, bar.low,
            bar.volume||0, bar.amount||0,
            bar.ma?.ma5, bar.ma?.ma10, bar.ma?.ma20, bar.ma?.ma60,
            bar.macd?.dif, bar.macd?.dea, bar.macd?.macd,
            bar.rsi?.rsi6, bar.rsi?.rsi14,
            bar.kdj?.k, bar.kdj?.d, bar.kdj?.j,
            bar.boll?.up, bar.boll?.mid, bar.boll?.down
          );
          n++;
        }
        return n;
      });

      const n = insBatch(kline);
      totalKline += n;
      console.log('   ✅ K线', n, '条');

      // 信号
      const last = kline[kline.length - 1];
      if (last) {
        let st = 0, strat = [], sig = 'HOLD';
        if (last.rsi?.rsi6 < 30) { st += 2; strat.push('RSI超卖'); }
        if (last.rsi?.rsi6 > 70) { st -= 2; strat.push('RSI超买'); }
        const prev = kline.length > 1 ? kline[kline.length - 2] : null;
        if (prev?.macd && last.macd?.dif > last.macd?.dea && prev.macd.dif <= prev.macd.dea) { st += 1.5; strat.push('MACD金叉'); }
        if (prev?.macd && last.macd?.dif < last.macd?.dea && prev.macd.dif >= prev.macd.dea) { st -= 1.5; strat.push('MACD死叉'); }
        if (last.kdj?.k && last.kdj?.d) {
          if (prev?.kdj && last.kdj.k > last.kdj.d && prev.kdj.k <= prev.kdj.d && last.kdj.k < 40) { st += 1; strat.push('KDJ低位金叉'); }
          if (prev?.kdj && last.kdj.k < last.kdj.d && prev.kdj.k >= prev.kdj.d && last.kdj.k > 60) { st -= 1; strat.push('KDJ高位死叉'); }
        }
        if (st >= 2) sig = 'BUY'; else if (st <= -2) sig = 'SELL';
        insSignal.run(code, code, today, sig, st, strat.join(','), last.close, last.changePercent||0);
        totalSignal++;
        console.log('   ✅ 信号:', sig, '(强度:'+st+')');
      }
    } catch (e) {
      console.log('   ❌', e.message);
    }
  }

  db.close();
  console.log('\n✅ 完成！K线', totalKline, '条, 信号', totalSignal, '条');
  console.log('   数据库:', DB_PATH);
}
main().catch(e => { console.error('❌ 脚本失败:', e.message); process.exit(1); });
