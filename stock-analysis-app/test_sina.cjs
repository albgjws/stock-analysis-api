/**
 * 测试新浪逐笔成交API
 * 运行: node test_sina.cjs
 */
async function main() {
  // 新浪API: 代码格式为 市场+代码, 如 sh600519, sz000001
  const codes = ['sh600519', 'sz000858'];

  for (const code of codes) {
    console.log(`\n=== ${code} ===`);
    try {
      const url = `https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/InvestorService.getTransactionList?code=${code}&num=5`;
      console.log('URL:', url);
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const text = await resp.text();
      console.log('Raw response (first 500 chars):', text.slice(0, 500));
      try {
        const data = JSON.parse(text);
        console.log('Parsed as JSON, count:', data.length);
        if (data.length > 0) console.log('First record:', JSON.stringify(data[0]));
      } catch {
        console.log('Not valid JSON');
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}
main().catch(e => console.error(e));
