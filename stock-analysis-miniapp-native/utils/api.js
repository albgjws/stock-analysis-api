// 后端 API 地址 — 发布时改成 HTTPS 域名
const BASE_URL = 'https://stock-analysis-ryan.xyz/api/stock';

function request(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      success: res => {
        if (res.statusCode === 200) resolve(res.data);
        else reject(new Error(res.data?.error || '请求失败'));
      },
      fail: err => reject(new Error('网络错误')),
    });
  });
}

module.exports = {
  searchStocks: q => request(`${BASE_URL}/search?q=${encodeURIComponent(q)}`),
  getAnalysis: code => request(`${BASE_URL}/${encodeURIComponent(code)}/analysis?count=200&predictDays=10`),
  getIntraday: code => request(`${BASE_URL}/${encodeURIComponent(code)}/intraday`),
  getFundFlow: code => request(`${BASE_URL}/${encodeURIComponent(code)}/fund-flow?days=60`),
  getBacktest: code => request(`${BASE_URL}/${encodeURIComponent(code)}/backtest`),
  getQuote: code => request(`${BASE_URL}/${encodeURIComponent(code)}/quote`),
  getTransactions: (code, count) => request(`${BASE_URL}/${encodeURIComponent(code)}/transactions?count=${count}`),
  getMarketIndices: () => request(`${BASE_URL}/indices`),
};
