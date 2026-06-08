import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  cacheDir: path.resolve(rootDir, 'data'),
  defaultKlineCount: 200,
  maxKlineCount: 500,
  defaultPredictDays: 10,
  maxPredictDays: 30,
  cacheTTL: {
    stockList: 24 * 60 * 60 * 1000,   // 24 hours
    dailyKline: 60 * 60 * 1000,        // 1 hour
    prediction: 60 * 60 * 1000,        // 1 hour
  },
  inMemoryTTLSec: 300,
};
