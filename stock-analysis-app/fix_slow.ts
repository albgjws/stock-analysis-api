import fs from 'fs';
let c = fs.readFileSync('server/services/stockDataService.ts', 'utf8');

// 1. Reduce retries and add timeout
c = c.replace('retry: { maxRetries: 3 }', 'retry: { maxRetries: 0 }');

// 2. Add fast-fail cache after cache check
const pattern1 = 'const cacheKey = `kline_${normalized}_${count}_${fq}`;\n\n    // Check cache\n    const cached = await this.cache.get<KlineBar[]>(cacheKey);\n    if (cached) return cached;';
const replacement1 = 'const cacheKey = `kline_${normalized}_${count}_${fq}`;\n\n    // Check cache\n    const cached = await this.cache.get<KlineBar[]>(cacheKey);\n    if (cached) return cached;\n\n    // 快速失败缓存：数据源不可用时5分钟内不再重试\n    const failCacheKey = `kline_fail_${normalized}`;\n    const failed = await this.cache.get<boolean>(failCacheKey);\n    if (failed) {\n      throw new Error(\`数据源暂时不可用: ${normalized}\`);\n    }';
c = c.replace(pattern1, replacement1);

// 3. After all attempts fail, set fail cache
const pattern2 = 'if (!kline || kline.length === 0) {\n      throw new Error(\n        `无法获取K线数据: ${errors.join(\';\ ')}`\n      );\n    }';
const replacement2 = 'if (!kline || kline.length === 0) {\n      // 数据源不可用，5分钟内不再重试\n      await this.cache.set(failCacheKey, true, 5 * 60 * 1000);\n      throw new Error(\n        `无法获取K线数据: ${errors.join(\';\ ')}`\n      );\n    }';
c = c.replace(pattern2, replacement2);

fs.writeFileSync('server/services/stockDataService.ts', c);
console.log('Done');
