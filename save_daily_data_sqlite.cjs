const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const TRACK_FILE = '/root/stock-analysis-api/stock-analysis-app/data/tracked_codes.json';
const DB_PATH = '/root/stock-analysis-api/stock-analysis-app/data/stock_analysis.db';
const sdk = require('stock-sdk');

// 初始化数据库（自动建表）
function initDB(db) {
  db.exec(`
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
      ma5 REAL,
      ma10 REAL,
      ma20 REAL,
      ma60 REAL,
      macd_dif REAL,
      macd_dea REAL,
      macd_bar REAL,
      rsi6 REAL,
      rsi14 REAL,
      kdj_k REAL,
      kdj_d REAL,
      kdj_j REAL,
      boll_up REAL,
      boll_mid REAL,
      boll_down REAL,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (code, trade_date, period)
    );
    CREATE TABLE IF NOT EXISTS scan_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      name TEXT DEFAULT '',
      scan_date TEXT NOT NULL,
      signal_type TEXT DEFAULT 'HOLD',
      signal_strength REAL DEFAULT 0,
      strategy_name TEXT DEFAULT '',
      price REAL DEFAULT 0,
      change_percent REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_scan_date ON scan_results(scan_date);
    CREATE INDEX IF NOT EXISTS idx_code_date ON scan_results(code, scan_date);
  `);
}

async function main() {
  // 读追踪文件
  if (!fs.existsSync(TRACK_FILE)) { console.log('📭 今日无查询记录'); return; }
  const raw = fs.readFileSync(TRACK_FILE, 'utf-8').trim();
  if (!raw) { console.log('📭 今日无查询记录'); return; }

  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set(), codes = [];
  raw.split('\n').forEach(l => {
    try {
      const o = JSON.parse(l);
      if (o.time.slice(0, 10) === today) {
        const n = o.code.replace(/[^a-zA-Z0-9]/g, '');
        if (!seen.has(n)) { seen.add(n); codes.push(n); }
      }
    } catch (e) {}
  });
  if (!codes.length) { console.log('📭 今日无查询记录'); return; }

  console.log('📊 今日查询股票:', codes.length, '只');
  console.log('   ', codes.join(', '));

  // 连 SQLite
  const db = new Database(DB_PATH);
  initDB(db);
  console.log('✅ 连上 SQLite (stock_analysis.db)');

  // 开始事务（批量写入快100倍）
  const insKline = db.prepare(`
    INSERT INTO kline_cache
      (code, trade_date, period, open_price, close_price, high_price, low_price, volume, amount,
       ma5, ma10, ma20, ma60, macd_dif, macd_dea, macd_bar,
       rsi6, rsi14, kdj_k, kdj_d, kdj_j,
       boll_up, boll_mid, boll_down)
    VALUES (?, ?, 'daily', ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?)
    ON CONFLICT(code, trade_date, period) DO UPDATE SET
      open_price=excluded.open_price, close_price=excluded.close_price,
      high_price=excluded.high_price, low_price=excluded.low_price,
      volume=excluded.volume, amount=excluded.amount
  `);

  const insSignal = db.prepare(`
    INSERT INTO scan_results
      (code, name, scan_date, signal_type, signal_strength, strategy_name, price, change_percent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const code of codes) {
    try {
      console.log('\n📈 处理:', code);
      const kline = await sdk.getKlineWithIndicators({ code, count: 200 });
      if (!kline || !kline.length) { console.log('   ⚠️ 无数据'); continue; }

      // 批量写入K线
      const insertMany = db.transaction((rows) => {
        let n = 0;
        for (const bar of rows) {
          const d = bar.timestamp ? new Date(bar.timestamp).toISOString().slice(0, 10) : '';
          if (!d || d > today) continue;
          insKline.run(
            code, d, bar.open, bar.close, bar.high, bar.low,
            bar.volume || 0, bar.amount || 0,
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

      const count = insertMany(kline);
      console.log('   ✅ K线:', count, '条');

      // 信号写入
      const last = kline[kline.length - 1];
      if (last) {
        let strength = 0, strategies = [], sigType = 'HOLD';
        if (last.rsi?.rsi6 < 30) { strength += 2; strategies.push('RSI超卖'); }
        if (last.rsi?.rsi6 > 70) { strength -= 2; strategies.push('RSI超买'); }
        const prev = kline.length > 1 ? kline[kline.length - 2] : null;
        if (prev?.macd && last.macd?.dif > last.macd?.dea && prev.macd.dif <= prev.macd.dea) { strength += 1.5; strategies.push('MACD金叉'); }
        if (prev?.macd && last.macd?.dif < last.macd?.dea && prev.macd.dif >= prev.macd.dea) { strength -= 1.5; strategies.push('MACD死叉'); }
        if (last.kdj?.k && last.kdj?.d) {
          if (prev?.kdj && last.kdj.k > last.kdj.d && prev.kdj.k <= prev.kdj.d && last.kdj.k < 40) { strength += 1; strategies.push('KDJ低位金叉'); }
          if (prev?.kdj && last.kdj.k < last.kdj.d && prev.kdj.k >= prev.kdj.d && last.kdj.k > 60) { strength -= 1; strategies.push('KDJ高位死叉'); }
        }
        if (strength >= 2) sigType = 'BUY';
        else if (strength <= -2) sigType = 'SELL';

        insSignal.run(code, code, today, sigType, strength, strategies.join(','), last.close, last.changePercent || 0);
        console.log('   ✅ 信号:', sigType, '(强度:' + strength + ')');
      }
    } catch (e) {
      console.log('   ❌', e.message);
    }
  }

  // 清空追踪文件
  fs.writeFileSync(TRACK_FILE, '');
  db.close();
  console.log('\n✅ 完成！数据保存在:', DB_PATH);
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
