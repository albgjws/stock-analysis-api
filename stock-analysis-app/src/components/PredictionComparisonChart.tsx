import React, { useEffect, useState } from 'react';
import { Card, Spin, Empty } from 'antd';
import ReactEChartsCore from 'echarts-for-react';
import { getBacktest } from '../api/stockApi';

interface Props {
  code: string;
  visible: boolean;
}

export default function PredictionComparisonChart({ code, visible }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!visible || !code) return;
    setLoading(true);
    getBacktest(code)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [code, visible]);

  if (!visible || loading) return null;
  if (!data?.comparisonSeries) return null;

  const { dates, forecast, actual, upper80, lower80 } = data.comparisonSeries;
  // 过滤掉实际值为null的末尾
  const hasActual = actual.some((v: any) => v != null);

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => {
        let html = `<div>${params[0]?.axisValue || ''}</div>`;
        params.forEach((p: any) => {
          if (p.value != null && p.seriesName !== '置信区间') {
            html += `<div>${p.seriesName}: <b>${Number(p.value).toFixed(2)}</b></div>`;
          }
        });
        return html;
      },
    },
    grid: { left: '5%', right: '5%', top: '10%', bottom: '10%' },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { rotate: 45, fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitArea: {
        show: true,
        areaStyle: { color: ['rgba(250,250,250,0.3)', 'rgba(200,200,200,0.1)'] },
      },
    },
    series: [
      // 80%置信区间带
      {
        name: '置信区间',
        type: 'line',
        data: upper80,
        symbol: 'none',
        lineStyle: { width: 0 },
        stack: 'ci',
        areaStyle: { color: 'rgba(22,119,255,0.08)' },
        connectNulls: true,
      },
      {
        name: '置信区间',
        type: 'line',
        data: lower80,
        symbol: 'none',
        lineStyle: { width: 0 },
        stack: 'ci',
        areaStyle: { color: 'rgba(22,119,255,0.08)' },
        connectNulls: true,
      },
      // 预测曲线
      {
        name: '预测价格',
        type: 'line',
        data: forecast,
        smooth: true,
        symbol: 'diamond',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#1677ff', type: 'dashed' },
        connectNulls: true,
      },
      // 实际价格曲线
      ...(hasActual ? [{
        name: '实际价格',
        type: 'line',
        data: actual,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#cf1322' },
        connectNulls: false,
      }] : []),
    ],
  };

  return (
    <Card
      size="small"
      title={
        <span>📊 预测对比 <span style={{ fontSize: 11, color: '#999', fontWeight: 'normal' }}>（蓝色虚线=预测 · 红色实线=实际）</span></span>
      }
      style={{ borderRadius: 8, marginBottom: 16, border: '1px solid #91d5ff' }}
      styles={{ body: { padding: '8px 0' } }}
    >
      <ReactEChartsCore option={option} style={{ height: 280, width: '100%' }} notMerge lazyUpdate />
    </Card>
  );
}
