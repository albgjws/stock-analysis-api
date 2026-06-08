const API = require('../../utils/api');
const HISTORY_KEY = 'stock_search_history';

Page({
  data: { keyword: '', results: [], searching: false, history: [] },

  onLoad() {
    const h = wx.getStorageSync(HISTORY_KEY);
    if (h) this.setData({ history: JSON.parse(h) });
  },

  onInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    if (!keyword.trim()) { this.setData({ results: [] }); return; }
    this.setData({ searching: true });
    API.searchStocks(keyword.trim())
      .then(results => this.setData({ results }))
      .catch(() => this.setData({ results: [] }))
      .finally(() => this.setData({ searching: false }));
  },

  clearInput() {
    this.setData({ keyword: '', results: [] });
  },

  onSelect(e) {
    const { code, name, market } = e.currentTarget.dataset;
    let history = this.data.history.filter(h => h.code !== code);
    history.unshift({ code, name, market });
    if (history.length > 10) history = history.slice(0, 10);
    this.setData({ history });
    wx.setStorageSync(HISTORY_KEY, JSON.stringify(history));
    wx.navigateTo({ url: `/pages/analysis/analysis?code=${code}&name=${encodeURIComponent(name)}` });
  },

  clearHistory() {
    this.setData({ history: [] });
    wx.removeStorageSync(HISTORY_KEY);
  },
});
