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

export default function IntradayChart({ data, loading, signals, lastRefresh }: IntradayChartProps) {
  const option = useMemo(() => {
    if (!data || !data.data || data.data.length === 0) return {};

    const points = data.data;
    const times = points.map(p => p.time);
    const prices = points.map(p => p.price);
    const avgPrices = points.map(p => p.avgPrice);
    const volumes = points.map(p => p.volume);
    const preClose = data.preClose;

    // 判断当前整体涨跌
    const lastPrice = prices[prices.length - 1];
    const isUp = lastPrice >= preClose;

    // 颜色
    const lineColor = isUp ? '#cf1322' : '#3cb371';
    const gradientTop = isUp ? 'rgba(207,19,34,0.3)' : 'rgba(60,179,113,0.3)';
    const gradientBottom = isUp ? 'rgba(207,19,34,0.02)' : 'rgba(60,179,113,0.02)';
    const volumeColor = isUp ? '#cf1322' : '#3cb371';

    // 获取信号标记
    const signalMarkers: any[] = [];
    if (signals) {
      const isBuy = signals.overall === 'STRONG_BUY' || signals.overall === 'BUY';
      const isSell = signals.overall === 'STRONG_SELL' || signals.overall === 'SELL';

      if (isBuy) {
        signalMarkers.push({
          name: '买入信号',
          coord: [times[times.length - 1], prices[prices.length - 1]],
          symbol: 'arrow',
          symbolSize: [30, 30],
          symbolRotate: 0,
          itemStyle: { color: '#cf1322' },
          label: {
            formatter: '买入',
            color: '#fff',
            backgroundColor: '#cf1322',
            padding: [4, 8],
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 'bold',
            position: 'top',
          },
        });
      } else if (isSell) {
        signalMarkers.push({
          name: '卖出信号',
          coord: [times[times.length - 1], prices[prices.length - 1]],
          symbol: 'arrow',
          symbolSize: [30, 30],
          symbolRotate: 180,
          itemStyle: { color: '#3cb371' },
          label: {
            formatter: '卖出',
            color: '#fff',
            backgroundColor: '#3cb371',
            padding: [4, 8],
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 'bold',
            position: 'bottom',
          },
        });
      }
    }

    // 最大成交量
    const maxVolume = Math.max(...volumes, 1);

    return {
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any[]) => {
          const priceP = params.find((p: any) => p.seriesName === '价格');
          const avgP = params.find((p: any) => p.seriesName === '均价');
          if (!priceP) return '';
          const idx = priceP.dataIndex;
          const p = points[idx];
          const changeVal = p.price - preClose;
          const changePct = (changeVal / preClose) * 100;
          const color = changeVal >= 0 ? '#cf1322' : '#3cb371';
          let html = `<div style="font-size:12px;color:#999">${p.time}</div>`;
          html += `<div>价格: <b>${p.price.toFixed(2)}</b></div>`;
          html += `<div style="color:${color}">涨跌: ${changeVal >= 0 ? '+' : ''}${changeVal.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)</div>`;
          html += `<div>均价: <b>${p.avgPrice.toFixed(2)}</b></div>`;
          html += `<div>成交量: <b>${p.volume.toLocaleString()}</b></div>`;
          html += `<div>成交额: <b>${(p.amount / 10000).toFixed(0)}万</b></div>`;
          return html;
        },
      },
      grid: [
        { left: '5%', right: '5%', top: '8%', height: '55%' },
        { left: '5%', right: '5%', top: '70%', height: '15%' },
      ],
      xAxis: [
        {
          type: 'category',
          data: times,
          boundaryGap: false,
          axisLine: { onZero: false },
          axisLabel: {
            fontSize: 10,
            formatter: (val: string) => {
              // 只显示部分时间标签
              const parts = val.split(':');
              if (parts[1] === '00' || parts[1] === '30') return val;
              return '';
            },
          },
          splitLine: { show: false },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: times,
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
            areaStyle: {
              color: ['rgba(250,250,250,0.3)', 'rgba(200,200,200,0.1)'],
            },
          },
          axisLabel: {
            formatter: (val: number) => val.toFixed(2),
            fontSize: 10,
          },
          // 标记昨收
          splitLine: {
            show: true,
          },
        },
        {
          type: 'value',
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: { show: true, fontSize: 10 },
          splitLine: { show: false },
        },
      ],
      series: [
        // 价格线
        {
          name: '价格',
          type: 'line',
          data: prices,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: lineColor },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: gradientTop },
                { offset: 1, color: gradientBottom },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              {
                yAxis: preClose,
                label: {
                  formatter: `昨收 ${preClose.toFixed(2)}`,
                  color: '#999',
                  fontSize: 11,
                  position: 'insideEndTop',
                },
                lineStyle: { color: '#999', type: 'dashed', width: 1 },
              },
            ],
          },
          markPoint: {
            data: signalMarkers,
            symbol: 'pin',
            symbolSize: 40,
          },
        },
        // 均价线
        {
          name: '均价',
          type: 'line',
          data: avgPrices,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1, type: 'dashed', color: '#f90' },
        },
        // 成交量
        {
          name: '成交量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumes.map((v, i) => ({
            value: v,
            itemStyle: {
              color: (prices[i] >= preClose) ? '#cf1322' : '#3cb371',
              opacity: 0.4,
            },
          })),
        },
      ],
    };
  }, [data, signals]);

  if (!data || !data.data || data.data.length === 0) {
    if (loading) {
      return <Card title="今日分时" style={{ borderRadius: 8, marginBottom: 16 }}><div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载分时数据...</div></Card>;
    }
    return (
      <Card
        title={
          <span>
            <span style={{ color: '#1677ff' }}>⚡</span> 今日分时
          </span>
        }
        style={{ borderRadius: 8, marginBottom: 16 }}
      >
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          非交易时间或暂无分时数据
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>⚡ 今日分时</span>
          <span style={{ fontSize: 12, color: '#999', fontWeight: 'normal' }}>
            {data.date}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: '#52c41a', fontWeight: 600,
          }}>
            <span style={{
              display: 'inline-block', width: 6, height: 6,
              borderRadius: '50%', background: '#52c41a',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            实时
          </span>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: '#999' }}>
              {lastRefresh}
            </span>
          )}
          {signals && (
            <span style={{ marginLeft: 4 }}>
              {(signals.overall === 'STRONG_BUY' || signals.overall === 'BUY') && (
                <span style={{
                  background: '#cf1322', color: '#fff', padding: '2px 10px',
                  borderRadius: 4, fontSize: 13, fontWeight: 'bold'
                }}>
                  📈 买入信号
                </span>
              )}
              {(signals.overall === 'STRONG_SELL' || signals.overall === 'SELL') && (
                <span style={{
                  background: '#3cb371', color: '#fff', padding: '2px 10px',
                  borderRadius: 4, fontSize: 13, fontWeight: 'bold'
                }}>
                  📉 卖出信号
                </span>
              )}
              {signals.overall === 'HOLD' && (
                <span style={{
                  background: '#faad14', color: '#fff', padding: '2px 10px',
                  borderRadius: 4, fontSize: 13, fontWeight: 'bold'
                }}>
                  ⚪ 观望
                </span>
              )}
            </span>
          )}
        </span>
      }
      style={{ borderRadius: 8, marginBottom: 16 }}
      styles={{ body: { padding: '12px 0' } }}
    >
      <ReactEChartsCore
        option={option}
        style={{ height: 380 }}
        showLoading={loading}
        notMerge
        lazyUpdate
      />
    </Card>
  );
}
