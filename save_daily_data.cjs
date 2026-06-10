const mysql = require('mysql2/promise');
const fs = require('fs');
const TRACK_FILE = '/root/stock-analysis-api/stock-analysis-app/data/tracked_codes.json';
const DB = { host:'127.0.0.1', user:'root', password:'ALBGJWSqq1', database:'stock_analysis' };

async function main() {
  if (!fs.existsSync(TRACK_FILE)) { console.log('📭 今日无查询记录'); return; }
  const raw = fs.readFileSync(TRACK_FILE,'utf-8').trim();
  if (!raw) { console.log('📭 今日无查询记录'); return; }
  const today = new Date().toISOString().slice(0,10);
  const seen = new Set(), codes = [];
  raw.split('\n').forEach(l => {
    try {
      const o = JSON.parse(l);
      if (o.time.slice(0,10) === today) {
        const n = o.code.replace(/[^a-zA-Z0-9]/g,'');
        if (!seen.has(n)) { seen.add(n); codes.push(n); }
      }
    } catch(e) {}
  });
  if (!codes.length) { console.log('📭 今日无查询记录'); return; }
  console.log('📊 今日查询股票:', codes.length, '只');
  console.log('   ', codes.join(', '));
  const conn = await mysql.createConnection(DB);
  console.log('✅ 连上 MySQL');
  for (const code of codes) {
    try {
      console.log('\n📈 处理:', code);
      const sdk = require('stock-sdk');
      const kline = await sdk.getKlineWithIndicators({ code, count: 200 });
      if (!kline || !kline.length) { console.log('   ⚠️ 无数据'); continue; }
      let ins = 0;
      for (const bar of kline) {
        const d = bar.timestamp ? new Date(bar.timestamp).toISOString().slice(0,10) : '';
        if (!d || d > today) continue;
        await conn.execute(
          'INSERT INTO kline_cache SET code=?,trade_date=?,period="daily",open_price=?,close_price=?,high_price=?,low_price=?,volume=?,amount=? ON DUPLICATE KEY UPDATE open_price=VALUES(open_price),close_price=VALUES(close_price)',
          [code, d, bar.open, bar.close, bar.high, bar.low, bar.volume||0, bar.amount||0]
        );
        ins++;
      }
      console.log('   ✅ K线:', ins, '条');
    } catch(e) { console.log('   ❌', e.message); }
  }
  fs.writeFileSync(TRACK_FILE, '');
  await conn.end();
  console.log('\n✅ 完成！');
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
