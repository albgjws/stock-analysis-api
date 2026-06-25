/**
 * 测试腾讯逐笔成交API
 * 运行: node test_api.cjs
 */
async function main() {
  const codes = ['sh600519', 'sz000858', 'sh601318'];

  for (const code of codes) {
    console.log(`\n=== ${code} ===`);
    try {
      const url = `https://ifzq.gtimg.cn/appstock/app/trans/getTrans?code=${code}&start=0&num=3`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const json = await resp.json();
      const dataNode = json?.data?.[code] || json?.data || {};
      console.log('Keys:', Object.keys(dataNode));

      // Try each possible path
      for (const key of Object.keys(dataNode)) {
        const val = dataNode[key];
        if (Array.isArray(val)) {
          console.log(`  ${key}: array of ${val.length} items, first=${JSON.stringify(val[0]).slice(0,200)}`);
        } else if (typeof val === 'object') {
          console.log(`  ${key}: object with keys ${Object.keys(val).join(',')}`);
        } else {
          console.log(`  ${key}: ${typeof val} = ${val}`);
        }
      }

      // Show full structure compact
      console.log('Full response structure:');
      printStructure(json, 0, 3);

    } catch (e) {
      console.log('  Error:', e.message);
    }
  }
}

function printStructure(obj, depth, maxDepth) {
  if (depth > maxDepth || obj === null || obj === undefined) return;
  if (typeof obj !== 'object') return;

  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val)) {
      console.log('  '.repeat(depth) + `${key}: Array(${val.length})`);
      if (val.length > 0 && depth < maxDepth) {
        const item = val[0];
        if (Array.isArray(item)) {
          console.log('  '.repeat(depth + 1) + `[0] = Array(${item.length}): ${JSON.stringify(item).slice(0, 150)}`);
        } else if (typeof item === 'object') {
          console.log('  '.repeat(depth + 1) + `[0] = {${Object.keys(item).join(',')}}`);
        }
      }
    } else if (typeof val === 'object') {
      console.log('  '.repeat(depth) + `${key}: {}`);
      printStructure(val, depth + 1, maxDepth);
    } else {
      console.log('  '.repeat(depth) + `${key}: ${typeof val} = ${String(val).slice(0, 60)}`);
    }
  }
}

main().catch(e => console.error(e));
