import React, { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react';
import { Card } from 'antd';
import type { IntradayData, SignalResult } from '../types';

interface IntradayChartProps {
  data: IntradayData | null;
  loading?: boolean;
  signals?: SignalResult | null;
  lastRefresh?: string;
}

/**
 * 生成全天固定时间轴（同花顺风格）
 * 上午 09:30-11:30（121个点）+ 下午 13:00-15:00（121个点）= 242个时间点
 */
function buildFullDayAxis(): string[] {
  const t: string[] = [];
  // 上午 09:30 → 11:30
  for (let m = 30; m < 60; m++) t.push(`09:${String(m).padStart(2, '0')}`); // 30
  for (let m = 0; m < 60; m++) t.push(`10:${String(m).padStart(2, '0')}`);   // 60
  for (let m = 0; m <= 30; m++) t.push(`11:${String(m).padStart(2, '0')}`);  // 31（含11:30）
  // 下午 13:00 → 15:00
  for (let m = 0; m < 60; m++) t.push(`13:${String(m).padStart(2, '0')}`);   // 60
  for (let m = 0; m < 60; m++) t.push(`14:${String(m).padStart(2, '0')}`);   // 60
  t.push('15:00');                                                             // 1
  return t; // 30+60+31+60+60+1 = 242
}

const AXIS_CACHE = buildFullDayAxis();

export default function IntradayChart({ data, loading, signals, lastRefresh }: IntradayChartProps) {
  const option = useMemo(() => {
    if (!data || !data.data || data.data.length === 0) return {};

    const pts = data.data;
    const pc = data.preClose;
    const AXIS = AXIS_CACHE;

    // 建立时间→数据映射
    const dataByTime = new Map<string, typeof pts[0]>();
    pts.forEach(p => dataByTime.set(p.time, p));

    // 映射到固定时间轴
    const prices: (number | null)[] = [];
    const avgPrices: (number | null)[] = [];
    const handVolumes: (number | null)[] = [];
    let prevCumVol = 0;

    for (const slot of AXIS) {
      const dp = dataByTime.get(slot);
      if (dp) {
        prices.push(dp.price);
        avgPrices.push(dp.avgPrice);
        // 现手 = 当前累计量 - 上一分钟累计量
        const dv = dp.volume - prevCumVol;
        prevCumVol = dp.volume;
        handVolumes.push(dv >= 0 ? dv : 0);
      } else {
        prices.push(null);
        avgPrices.push(null);
        handVolumes.push(null);
      }
    }

    // 颜色：最新价 >= 昨收 → 红，否则绿
    const realPrices = prices.filter(v => v !== null) as number[];
    const lastP = realPrices.length > 0 ? realPrices[realPrices.length - 1] : pc;
    const rising = lastP >= pc;
    const colorMain = rising ? '#cf1322' : '#3cb371';
    const gradTop = rising ? 'rgba(207,19,34,0.3)' : 'rgba(60,179,113,0.3)';
    const gradBot = rising ? 'rgba(207,19,34,0.02)' : 'rgba(60,179,113,0.02)';

    // ─── 买卖信号标记（实时模拟，不用未来数据） ───
    const marks: any[] = [];
    if (signals && pts.length > 15) {
      const isBuy = signals.overall === 'STRONG_BUY' || signals.overall === 'BUY';
      const isSell = signals.overall === 'STRONG_SELL' || signals.overall === 'SELL';
      if (isBuy || isSell) {
        let bestIdx = -1;
        let bestScore = -Infinity;
        // 只用当前及之前的数据做判断，绝不看 i+1/i+2
        for (let i = 10; i < pts.length; i++) {
          const p = pts[i];
          const dev = isBuy
            ? (p.avgPrice - p.price) / p.avgPrice   // 正 = 价格在均线下方
            : (p.price - p.avgPrice) / p.avgPrice;  // 正 = 价格在均线上方

          // 偏差不够大就跳过
          if (dev < 0.003) continue;

          // 看最近3分钟的价格斜率（只用到 i-2, i-1, i）
          const slope1 = p.price - pts[i - 1].price;
          const slope2 = pts[i - 1].price - pts[i - 2].price;

          let score = dev * 1000; // 基础分：偏差越大越好

          // 价格趋势在减缓（斜率由负转正/由正转负）
          if (isBuy) {
            // 买：价格在均线下，下跌趋缓或反弹
            const flattening = slope1 > slope2 && slope2 < 0; // 跌幅收窄
            const turning = slope1 > 0 && slope2 <= 0;         // 由跌转涨
            if (flattening) score += 3;
            if (turning) score += 6;
            // 如果还在加速下跌，降分
            if (slope1 < slope2) score -= 4;
          } else {
            // 卖：价格在均线上，上涨趋缓或回落
            const flattening = slope1 < slope2 && slope2 > 0; // 涨幅收窄
            const turning = slope1 < 0 && slope2 >= 0;         // 由涨转跌
            if (flattening) score += 3;
            if (turning) score += 6;
            // 如果还在加速上涨，降分
            if (slope1 > slope2) score -= 4;
          }

          // 成交量放大加分（近5分钟均量的1.2倍以上）
          const volSlice = pts.slice(Math.max(0, i - 5), i);
          const avgVol = volSlice.reduce((s, v) => s + v.volume, 0) / volSlice.length;
          const curVolDelta = p.volume - (i > 0 ? pts[i - 1].volume : 0);
          if (curVolDelta > avgVol * 1.2 && avgVol > 0) score += 3;

          // 越早的信号越有价值（前60%的时间加分）
          if (i < pts.length * 0.6) score += 2;

          if (score > bestScore) { bestScore = score; bestIdx = i; }
        }
        // 只有得分达到阈值才标记
        if (bestIdx >= 0 && bestScore > 5) {
          marks.push({
            name: isBuy ? '买入' : '卖出',
            coord: [pts[bestIdx].time, pts[bestIdx].price],
            symbol: 'arrow',
            symbolSize: [30, 30],
            symbolRotate: isBuy ? 0 : 180,
            itemStyle: { color: isBuy ? '#cf1322' : '#3cb371' },
            label: {
              formatter: isBuy ? '买入' : '卖出',
              color: '#fff',
              backgroundColor: isBuy ? '#cf1322' : '#3cb371',
              padding: [4, 8],
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 'bold',
              position: isBuy ? 'top' : 'bottom',
            },
          });
        }
      }
    }

    const maxHand = Math.max(...handVolumes.filter(v => v !== null) as number[], 1);

    return {
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any[]) => {
          const ps = params.find((p: any) => p.seriesName === '价格');
          if (!ps || ps.value == null) return '';
          const idx = ps.dataIndex;
          const t = AXIS[idx];
          const pr = prices[idx];
          if (pr == null) return '';
          const chg = pr - pc;
          const orig = dataByTime.get(t);
          const hv = handVolumes[idx] ?? 0;
          return `<div style="font-size:12px;color:#999">${t}</div>
<div>价格: <b>${pr.toFixed(2)}</b></div>
<div style="color:${chg >= 0 ? '#cf1322' : '#3cb371'}">涨跌: ${chg >= 0 ? '+' : ''}${chg.toFixed(2)} (${(chg / pc * 100) >= 0 ? '+' : ''}${(chg / pc * 100).toFixed(2)}%)</div>
<div>均价: <b>${avgPrices[idx]?.toFixed(2) ?? '-'}</b></div>
<div>成交量: <b>${hv.toLocaleString()}</b></div>
<div>总量: <b>${(orig?.volume ?? 0).toLocaleString()}</b></div>
<div>现手: <b>${hv.toLocaleString()}</b></div>`;
        },
      },
      grid: [
        { left: 65, right: 20, top: '6%', height: '53%' },
        { left: 60, right: 20, top: '65%', height: '15%' },
      ],
      xAxis: [
        {
          type: 'category',
          data: AXIS,
          boundaryGap: false,
          axisLine: { onZero: false },
          axisLabel: {
            fontSize: 10,
            // 只显示 9:30 / 11:30 / 15:00 三个标签
            interval: (_idx: number, val: string) =>
              val === '09:30' || val === '11:30' || val === '15:00',
            formatter: (v: string) => {
              if (v === '09:30') return '9:30';
              if (v === '11:30') return '11:30';
              return '15:00';
            },
          },
          splitLine: { show: false },
          axisTick: { show: false },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: AXIS,
          axisLabel: { show: false },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          type: 'value',
          scale: true,
          splitArea: {
            show: true,
            areaStyle: { color: ['rgba(250,250,250,0.3)', 'rgba(200,200,200,0.1)'] },
          },
          axisLabel: {
            formatter: (v: number) =>
              v >= 1000 ? v.toFixed(0) : v >= 100 ? v.toFixed(1) : v.toFixed(2),
            fontSize: 10,
          },
          splitLine: { show: true, lineStyle: { type: 'dashed' } },
        },
        {
          type: 'value',
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: {
            show: true,
            fontSize: 10,
            formatter: (v: number) =>
              v >= 1e8 ? (v / 1e8).toFixed(1) + '亿' :
              v >= 1e4 ? (v / 1e4).toFixed(0) + '万' :
              v.toLocaleString(),
          },
          splitLine: { show: false },
        },
      ],
      series: [
        // ── 价格线 ──
        {
          name: '价格',
          type: 'line',
          data: prices,
          smooth: true,
          symbol: 'none',
          connectNulls: false,
          lineStyle: { width: 2, color: colorMain },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: gradTop },
                { offset: 1, color: gradBot },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [{
              yAxis: pc,
              label: {
                formatter: `昨收 ${pc.toFixed(2)}`,
                color: '#999',
                fontSize: 10,
                position: 'insideEndTop',
              },
              lineStyle: { color: '#999', type: 'dashed', width: 1 },
            }],
          },
          markPoint: { data: marks },
        },
        // ── 均价线 ──
        {
          name: '均价',
          type: 'line',
          data: avgPrices,
          smooth: true,
          symbol: 'none',
          connectNulls: false,
          lineStyle: { width: 1, type: 'dashed', color: '#f90' },
        },
        // ── 成交量 ──
        {
          name: '成交量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: handVolumes.map((v, i) => {
            if (v == null) return { value: 0, itemStyle: { color: 'transparent' } };
            return {
              value: v,
              itemStyle: {
                color: prices[i] != null && prices[i]! >= pc ? '#cf1322' : '#3cb371',
                opacity: 0.5,
              },
            };
          }),
          barWidth: '40%',
        },
      ],
    };
  }, [data, signals]);

  if (!data || !data.data || data.data.length === 0) {
    if (loading) return <Card title="今日分时" style={{ borderRadius: 8, width: '100%' }}><div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载分时数据...</div></Card>;
    return <Card title={<span><span style={{ color: '#1677ff' }}>⚡</span> 今日分时</span>} style={{ borderRadius: 8, width: '100%' }}><div style={{ textAlign: 'center', padding: 40, color: '#999' }}>非交易时间或暂无分时数据</div></Card>;
  }

  return (
    <Card
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>⚡ 今日分时</span>
          <span style={{ fontSize: 12, color: '#999' }}>{data.date}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#52c41a', fontWeight: 600 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#52c41a', animation: 'pulse 1.5s ease-in-out infinite' }} />实时
          </span>
          {lastRefresh && <span style={{ fontSize: 11, color: '#999' }}>{lastRefresh}</span>}
          {signals && (
            <span>
              {(signals.overall === 'STRONG_BUY' || signals.overall === 'BUY') && <span style={{ background: '#cf1322', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 13, fontWeight: 'bold' }}>📈 买入信号</span>}
              {(signals.overall === 'STRONG_SELL' || signals.overall === 'SELL') && <span style={{ background: '#3cb371', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 13, fontWeight: 'bold' }}>📉 卖出信号</span>}
              {signals.overall === 'HOLD' && <span style={{ background: '#faad14', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 13, fontWeight: 'bold' }}>⚪ 观望</span>}
            </span>
          )}
        </span>
      }
      style={{ borderRadius: 8, width: '100%', height: 400 }}
      styles={{ body: { padding: '12px 0', height: 362 } }}
    >
      <ReactEChartsCore
        option={option}
        style={{ height: 362, width: '100%' }}
        showLoading={loading}
        notMerge
        lazyUpdate
      />
    </Card>
  );
}
