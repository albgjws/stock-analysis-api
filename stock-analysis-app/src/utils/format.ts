/**
 * Format price with 2 decimal places
 */
export function formatPrice(value: number): string {
  if (value == null || isNaN(value)) return '--';
  return value.toFixed(2);
}

/**
 * Format large volume numbers
 */
export function formatVolume(value: number): string {
  if (value == null || isNaN(value)) return '--';
  if (value >= 100000000) return (value / 100000000).toFixed(2) + '亿';
  if (value >= 10000) return (value / 10000).toFixed(2) + '万';
  return value.toFixed(0);
}

/**
 * Format large amount (yuan)
 */
export function formatAmount(value: number): string {
  if (value == null || isNaN(value)) return '--';
  if (value >= 100000000) return (value / 100000000).toFixed(2) + '亿';
  if (value >= 10000) return (value / 10000).toFixed(2) + '万';
  return value.toFixed(2);
}

/**
 * Format percentage change
 */
export function formatPercent(value: number): string {
  if (value == null || isNaN(value)) return '--';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Get CSS class for price change (Chinese convention: red for up, green for down)
 */
export function getChangeColor(value: number): string {
  if (value > 0) return 'price-up';
  if (value < 0) return 'price-down';
  return 'price-neutral';
}

/**
 * Get signal CSS class
 */
export function getSignalClass(signal: string): string {
  switch (signal) {
    case 'STRONG_BUY': return 'signal-strong-buy';
    case 'BUY': return 'signal-buy';
    case 'HOLD': return 'signal-hold';
    case 'SELL': return 'signal-sell';
    case 'STRONG_SELL': return 'signal-strong-sell';
    default: return 'signal-hold';
  }
}

/**
 * Get signal Chinese label
 */
export function getSignalLabel(signal: string): string {
  switch (signal) {
    case 'STRONG_BUY': return '强烈买入';
    case 'BUY': return '买入';
    case 'HOLD': return '持有';
    case 'SELL': return '卖出';
    case 'STRONG_SELL': return '强烈卖出';
    default: return '--';
  }
}

/**
 * Format date string
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '--';
  return dateStr;
}
