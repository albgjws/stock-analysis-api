import { useEffect, useRef } from 'react';

/**
 * 判断A股交易时段
 */
function isMarketOpen(): boolean {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const time = h * 100 + m;
  // 早盘 9:30-11:30
  if (time >= 930 && time < 1130) return true;
  // 午盘 13:00-15:00
  if (time >= 1300 && time < 1500) return true;
  return false;
}

/**
 * 定时轮询 hook — 仅在交易时段内且页面可见时运行
 * @param callback 轮询函数
 * @param intervalMs 间隔毫秒数
 * @param active 是否激活
 * @param onlyTradingHours 是否仅在交易时段轮询（默认 true）
 */
export function usePolling(
  callback: () => void,
  intervalMs: number | null,
  active: boolean = true,
  onlyTradingHours: boolean = true,
) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active || intervalMs === null) return;

    const tick = () => {
      // 非交易时段且开启限制时跳过轮询
      if (onlyTradingHours && !isMarketOpen()) return;
      if (document.visibilityState === 'visible') {
        savedCallback.current();
      }
    };

    // 立即执行一次
    tick();

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active, onlyTradingHours]);
}
