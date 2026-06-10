const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '../../data/tracked_codes.json');

function track(code) {
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify({ code, time: new Date().toISOString() }) + '\n');
  } catch (e) {
    console.error('[Tracker] 写入失败:', e.message);
  }
}

module.exports = { track };
