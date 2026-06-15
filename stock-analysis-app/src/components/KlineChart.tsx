import React, { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react';
import { Card, Switch, Space, Tag } from 'antd';
import type { KlineBar, SignalResult } from '../types';
import type { AdvancedSignals } from '../utils/advancedIndicators';

interface KlineChartProps {
  data: KlineBar[];
  loading?: boolean;
  signals?: SignalResult | null;
  advancedSignals?: AdvancedSignals | null;
  fundFlow?: any[] | null;
  showAdvanced?: boolean;
  onToggleAdvanced?: (show: boolean) => void;
}

export default function KlineChart({
  data, loading, signals, advancedSignals, fundFlow,
  showAdvanced = true, onToggleAdvanced,
}: KlineChartProps) {
  const option = useMemo(() => {
    if (!data || data.length === 0) return {};

    const dates = data.map(d => d.date);
    const volumes = data.map(d => d.volume);
    const ohlc = data.map(d => [d.open, d.close, d.low, d.high]);

    // MA lines
    const ma5Data = data.map(d => d.ma?.ma5 ?? null);
    const ma10Data = data.map(d => d.ma?.ma10 ?? null);
    const ma20Data = data.map(d => d.ma?.ma20 ?? null);
    const ma60Data = data.map(d => d.ma?.ma60 ?? null);

    // Bollinger
    const bollUpper = data.map(d => d.boll?.upper ?? null);
    const bollMid = data.map(d => d.boll?.mid ?? null);
    const bollLower = data.map(d => d.boll?.lower ?? null);

    // ---- 信号标记 ----
    const signalMarkers: any[] = [];
    const advancedMarkers: any[] = [];

    // 买卖信号标记
    if (signals && showAdvanced) {
      const lastIdx = data.length - 1;
      const lastBar = data[lastIdx];
      const isBuy = signals.overall === 'STRONG_BUY' || signals.overall === 'BUY';
      const isSell = signals.overall === 'STRONG_SELL' || signals.overall === 'SELL';
      if (isBuy) {
        signalMarkers.push({ name: '买入信号', coord: [dates[lastIdx], lastBar.low], symbol: 'pin', symbolSize: 50, itemStyle: { color: '#cf1322' }, label: { formatter: '买', color: '#fff', fontSize: 16, fontWeight: 'bold', position: 'inside' } });
      } else if (isSell) {
        signalMarkers.push({ name: '卖出信号', coord: [dates[lastIdx], lastBar.high], symbol: 'pin', symbolSize: 50, itemStyle: { color: '#3cb371' }, label: { formatter: '卖', color: '#fff', fontSize: 16, fontWeight: 'bold', position: 'inside' } });
      }
    }

    // 三把锁
    if (advancedSignals && showAdvanced) {
      advancedSignals.threeLocks.forEach(lock => {
        const bar = data[lock.index];
        if (!bar) return;
        const isBuy = lock.type === 'buy';
        const color = isBuy ? '#cf1322' : '#3cb371';
        advancedMarkers.push({
          name: `三把锁${isBuy ? '买入' : '卖出'}`,
          coord: [lock.date, isBuy ? bar.low : bar.high],
          symbol: isBuy ? 'diamond' : 'pin',
          symbolSize: lock.lockCount === 3 ? 40 : 30,
          symbolRotate: isBuy ? 0 : 180,
          itemStyle: { color, borderColor: '#fff', borderWidth: 2, shadowBlur: 6, shadowColor: color },
          label: { formatter: `🔒${lock.lockCount}`, color: '#fff', fontSize: 11, fontWeight: 'bold', position: 'inside' },
        });
        if (lock.lockCount === 3) {
          advancedMarkers.push({
            name: '三锁全开',
            coord: [lock.date, isBuy ? bar.low - (bar.high - bar.low) * 0.3 : bar.high + (bar.high - bar.low) * 0.3],
            symbol: 'rect', symbolSize: [50, 18], itemStyle: { color: color + 'cc' },
            label: { formatter: '⚡三锁全开', color: '#fff', fontSize: 10, position: 'inside' },
          });
        }
      });
    }

    // 波段买卖点
    if (advancedSignals && showAdvanced) {
      advancedSignals.swingPoints.forEach(sp => {
        const bar = data[sp.index];
        if (!bar) return;
        const isBuy = sp.type === 'buy';
        advancedMarkers.push({
          name: `波段${isBuy ? '买入' : '卖出'}`,
          coord: [sp.date, isBuy ? bar.low : bar.high],
          symbol: isBuy ? 'triangle' : 'diamond',
          symbolSize: 24, symbolRotate: isBuy ? 0 : 180,
          itemStyle: { color: isBuy ? '#cf1322' : '#3cb371' },
          label: { formatter: isBuy ? '▲' : '▼', color: '#fff', fontSize: 12, fontWeight: 'bold', position: 'inside' },
        });
      });
    }

    // MACD+KDJ 组合双金叉/双死叉
    if (advancedSignals && showAdvanced) {
      advancedSignals.dualGoldenCross.forEach(dgc => {
        const bar = data[dgc.index];
        if (!bar) return;
        const isGolden = dgc.type === 'golden';
        const color = isGolden ? '#cf1322' : '#3cb371';
        const labelTxt = isGolden ? '双金叉' : '双死叉';
        advancedMarkers.push({
          name: labelTxt,
          coord: [dgc.date, isGolden ? bar.low - (bar.high - bar.low) * 0.2 : bar.high + (bar.high - bar.low) * 0.2],
          symbol: 'circle',
          symbolSize: dgc.strength === 2 ? 36 : 28,
          itemStyle: { color, borderColor: '#fff', borderWidth: 2, shadowBlur: 8, shadowColor: color },
          label: { formatter: isGolden ? '↑↑' : '↓↓', color: '#fff', fontSize: 12, fontWeight: 'bold', position: 'inside' },
        });
      });
    }

    // 三把锁 scatter 数据
    const threeLocksScatterData = (showAdvanced && advancedSignals?.threeLocks?.length)
      ? advancedSignals.threeLocks.map((lock, idx) => {
          const bar = data[lock.index];
          if (!bar) return null;
          const isBuy = lock.type === 'buy';
          return {
            value: [lock.date, isBuy ? bar.low - (bar.high - bar.low) * 0.15 : bar.high + (bar.high - bar.low) * 0.15],
            _idx: idx, symbol: 'none',
            label: {
              formatter: `🔒${lock.lockCount}锁`, show: true,
              color: isBuy ? '#cf1322' : '#3cb371',
              backgroundColor: 'rgba(255,255,255,0.9)', padding: [2, 5],
              borderRadius: 4, fontSize: 11, fontWeight: 'bold',
              position: isBuy ? 'top' : 'bottom',
            },
          };
        }).filter(Boolean)
      : [];

    // 神奇九转 scatter 数据
    const tdScatterData = (showAdvanced && advancedSignals?.tdSequential?.length)
      ? advancedSignals.tdSequential.map(td => {
          const bar = data[td.index];
          if (!bar) return null;
          const isUp = td.count > 0;
          const color2 = isUp ? '#cf1322' : '#3cb371';
          const isReversal = td.isReversal;
          return {
            value: [td.date, isUp ? bar.high + (bar.high - bar.low) * 0.2 : bar.low - (bar.high - bar.low) * 0.2],
            label: {
              formatter: isReversal ? `{reverse|${Math.abs(td.count)}转}` : `{normal|${Math.abs(td.count)}}`,
              rich: {
                reverse: { color: '#fff', backgroundColor: color2, padding: [2, 6], borderRadius: 10, fontSize: 12, fontWeight: 'bold' },
                normal: { color: color2, fontSize: 13, fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.8)', padding: [1, 4], borderRadius: 3 },
              },
              show: true, position: isUp ? 'bottom' : 'top',
            },
            symbol: isReversal ? 'circle' : 'none', symbolSize: isReversal ? 20 : 0,
            itemStyle: { color: color2, opacity: 0.6 },
            tooltip: { formatter: `<div><b>${td.date}</b><br/>神奇九转：<b>${isUp ? '上涨' : '下跌'} ${Math.abs(td.count)}</b><br/>${isReversal ? '⚠️ 达到9转，警惕趋势反转！' : ''}</div>` },
          };
        }).filter(Boolean)
      : [];

    // 主力资金数据
    const fundFlowBarData = (fundFlow && fundFlow.length > 0 && showAdvanced)
      ? (() => {
          const flowMap = new Map(fundFlow.map((f: any) => [f.date, f]));
          return dates.map(date => flowMap.get(date)).filter(Boolean).map((f: any) => ({
            value: [f.date, f.mainNetInflowPercent || 0],
            itemStyle: { color: (f.mainNetInflowPercent || 0) >= 0 ? '#cf1322' : '#3cb371', opacity: 0.6 },
          }));
        })()
      : [];

    return {
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any[]) => {
          const cs = params.find((p: any) => p.seriesName === 'K线');
          if (!cs) return '';
          const d = data[cs.dataIndex];
          let html = `<div style="font-size:12px;color:#999">${d.date}</div>`;
          html += `<div>开盘: <b>${d.open.toFixed(2)}</b></div>`;
          html += `<div>收盘: <b>${d.close.toFixed(2)}</b></div>`;
          html += `<div>最高: <b>${d.high.toFixed(2)}</b></div>`;
          html += `<div>最低: <b>${d.low.toFixed(2)}</b></div>`;
          html += `<div>成交量: <b>${d.volume.toLocaleString()}</b></div>`;
          if (d.changePercent != null) {
            html += `<div>涨跌幅: <b style="color:${d.changePercent >= 0 ? '#cf1322' : '#3cb371'}">${d.changePercent >= 0 ? '+' : ''}${d.changePercent.toFixed(2)}%</b></div>`;
          }
          params.forEach((p: any) => {
            if (p.seriesName.startsWith('MA') && p.value != null) html += `<div>${p.seriesName}: <b>${Number(p.value).toFixed(2)}</b></div>`;
          });
          return html;
        },
      },
      grid: [
        { left: '5%', right: '5%', top: '3%', height: '60%' },
        { left: '5%', right: '5%', top: '70%', height: '15%' },
      ],
      xAxis: [
        { type: 'category', data: dates, axisLine: { onZero: false }, axisLabel: { show: true, rotate: 30, fontSize: 10 }, splitLine: { show: false }, boundaryGap: true },
        { type: 'category', gridIndex: 1, data: dates, axisLabel: { show: false }, splitLine: { show: false } },
      ],
      yAxis: [
        { type: 'value', scale: true, splitArea: { show: true, areaStyle: { color: ['rgba(250,250,250,0.3)', 'rgba(200,200,200,0.1)'] } } },
        { type: 'value', gridIndex: 1, splitNumber: 2, axisLabel: { show: true, fontSize: 10 }, axisLine: { show: false }, splitLine: { show: false } },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1], start: 60, end: 100 },
        { show: true, xAxisIndex: [0, 1], type: 'slider', top: '88%', height: 20, start: 60, end: 100, borderColor: '#ddd', fillerColor: 'rgba(22,119,255,0.1)' },
      ],
      series: [
        // 0: K线
        { name: 'K线', type: 'candlestick', animation: false, data: ohlc, itemStyle: { color: '#cf1322', color0: '#3cb371', borderColor: '#cf1322', borderColor0: '#3cb371' }, markPoint: { data: [...signalMarkers, ...advancedMarkers], symbol: 'pin', symbolSize: 50, animation: false } },
        // 1: 三把锁scatter
        { name: '三把锁', type: 'scatter', animation: false, xAxisIndex: 0, yAxisIndex: 0, data: threeLocksScatterData, tooltip: { formatter: (p: any) => { const idx = p.data?._idx ?? p.dataIndex; const lock = advancedSignals?.threeLocks?.[idx]; if (!lock) return ''; const t = lock.type === 'buy' ? '买入信号' : '卖出信号'; return `<div style="font-size:13px;line-height:1.8"><b>${lock.date}</b><br/>🔒 <b>${t}（${lock.lockCount}/3）</b><br/>${lock.details.map((d: string) => `· ${d}`).join('<br/>')}<br/><span style="color:${lock.lockCount === 3 ? '#cf1322' : '#fa8c16'}">${lock.lockCount === 3 ? '✅ 三锁全开 — 信号强烈！' : '⚠️ 两锁确认 — 信号较强'}</span></div>`; } } },
        // 2-5: MA
        { name: 'MA5', type: 'line', animation: false, data: ma5Data, smooth: true, symbol: 'none', lineStyle: { width: 1, color: '#ed7d31' }, connectNulls: true },
        { name: 'MA10', type: 'line', animation: false, data: ma10Data, smooth: true, symbol: 'none', lineStyle: { width: 1, color: '#ffc000' }, connectNulls: true },
        { name: 'MA20', type: 'line', animation: false, data: ma20Data, smooth: true, symbol: 'none', lineStyle: { width: 1, color: '#4472c4' }, connectNulls: true },
        { name: 'MA60', type: 'line', animation: false, data: ma60Data, smooth: true, symbol: 'none', lineStyle: { width: 1, type: 'dotted', color: '#7030a0' }, connectNulls: true },
        // 6-8: Bollinger
        { name: '布林上轨', type: 'line', animation: false, data: bollUpper, smooth: true, symbol: 'none', lineStyle: { width: 1, type: 'dashed', color: 'rgba(180,180,180,0.6)' }, connectNulls: true },
        { name: '布林中轨', type: 'line', animation: false, data: bollMid, smooth: true, symbol: 'none', lineStyle: { width: 1, color: 'rgba(180,180,180,0.4)' }, connectNulls: true },
        { name: '布林下轨', type: 'line', animation: false, data: bollLower, smooth: true, symbol: 'none', lineStyle: { width: 1, type: 'dashed', color: 'rgba(180,180,180,0.6)' }, connectNulls: true },
        // 9: 神奇九转
        { name: '神奇九转', type: 'scatter', animation: false, xAxisIndex: 0, yAxisIndex: 0, data: tdScatterData },
        // 10: 主力资金
        { name: '主力资金', type: 'bar', animation: false, xAxisIndex: 0, yAxisIndex: 0, data: fundFlowBarData, barWidth: 4, z: 5 },
        // 11: 成交量
        { name: '成交量', type: 'bar', animation: false, xAxisIndex: 1, yAxisIndex: 1, data: volumes.map((v, i) => ({ value: v, itemStyle: { color: (data[i].changePercent ?? 0) >= 0 ? '#cf1322' : '#3cb371', opacity: 0.5 } })) },
      ],
    };
  }, [data, signals, advancedSignals, fundFlow, showAdvanced]);

  if (!data || data.length === 0) {
    return <Card title="K线图" style={{ borderRadius: 8, marginBottom: 16 }}>暂无K线数据</Card>;
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📊 K线图</span>
            {signals && (
              <span>
                {(signals.overall === 'STRONG_BUY' || signals.overall === 'BUY') && <span style={{ background: '#cf1322', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 13, fontWeight: 'bold' }}>📈 买入</span>}
                {(signals.overall === 'STRONG_SELL' || signals.overall === 'SELL') && <span style={{ background: '#3cb371', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 13, fontWeight: 'bold' }}>📉 卖出</span>}
                {signals.overall === 'HOLD' && <span style={{ background: '#faad14', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 13, fontWeight: 'bold' }}>⚪ 持有</span>}
              </span>
            )}
          </span>
          <Space size="small">
            <Tag color="red">🔒三把锁</Tag>
            <Tag color="orange">九转</Tag>
            <Tag color="blue">▲波段</Tag>
            <Tag color="red">↑↑双金叉</Tag>
            <Tag color="green">↓↓双死叉</Tag>
            <Tag color="purple">主力资金</Tag>
            <span style={{ fontSize: 12, color: '#999' }}>专业指标</span>
            <Switch size="small" checked={showAdvanced} onChange={onToggleAdvanced} />
          </Space>
        </div>
      }
      style={{ borderRadius: 8, marginBottom: 16 }}
      styles={{ body: { padding: '12px 0' } }}
    >
      <ReactEChartsCore
        option={option}
        style={{ height: 520 }}
        showLoading={loading}
        notMerge
        lazyUpdate
      />
    </Card>
  );
}
