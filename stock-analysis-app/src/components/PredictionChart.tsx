import React, { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react';
import { Card, Tag } from 'antd';
import type { KlineBar, PredictionResult } from '../types';

interface PredictionChartProps {
  kline: KlineBar[];
  prediction: PredictionResult;
  loading?: boolean;
}

export default function PredictionChart({ kline, prediction, loading }: PredictionChartProps) {
  const option = useMemo(() => {
    if (!prediction.forecast || prediction.forecast.length === 0) {
      return {};
    }

    // Take last 30 real bars for context
    const contextBars = kline.slice(-30);
    const contextDates = contextBars.map(d => d.date);
    const contextPrices = contextBars.map(d => d.close);

    const forecastDates = prediction.forecast.map(f => f.date);
    const allDates = [...contextDates, ...forecastDates];

    // Separator index
    const splitIndex = contextDates.length - 1;

    // Build series data: real prices + forecast
    const realPrices = [...contextPrices, ...Array(prediction.forecast.length).fill(null)];
    const forecastValues = [
      ...Array(contextPrices.length - 1).fill(null),
      contextPrices[contextPrices.length - 1],
      ...prediction.forecast.map(f => f.value),
    ];

    const upper80 = [
      ...Array(contextPrices.length).fill(null),
      ...prediction.forecast.map(f => f.upper80),
    ];
    const lower80 = [
      ...Array(contextPrices.length).fill(null),
      ...prediction.forecast.map(f => f.lower80),
    ];
    const upper95 = [
      ...Array(contextPrices.length).fill(null),
      ...prediction.forecast.map(f => f.upper95),
    ];
    const lower95 = [
      ...Array(contextPrices.length).fill(null),
      ...prediction.forecast.map(f => f.lower95),
    ];

    const methodLabel =
      prediction.method === 'ARIMA' ? 'ARIMA模型' :
      prediction.method === 'LINEAR_REGRESSION' ? '线性回归' :
      prediction.method === 'SMA' ? '均线预测' : '';

    return {
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
        data: allDates,
        axisLabel: { rotate: 45, fontSize: 10 },
        splitLine: { show: false },
        // Mark the split between historical and predicted
        axisLine: { onZero: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        splitArea: { show: true, areaStyle: { color: ['rgba(250,250,250,0.3)', 'rgba(200,200,200,0.1)'] } },
      },
      visualMap: {
        show: false,
        pieces: [
          { value: 'real', color: '#333' },
          { value: 'pred', color: '#1677ff' },
        ],
      },
      // Mark line at the split point
      markLine: {
        silent: true,
        data: [{ xAxis: splitIndex, label: { formatter: '预测区域', position: 'start' } }],
        symbol: 'none',
        lineStyle: { type: 'dashed', color: '#666' },
      },
      series: [
        // 95% confidence interval
        {
          name: '置信区间',
          type: 'line',
          data: upper95,
          symbol: 'none',
          lineStyle: { width: 0 },
          stack: 'confidence',
          areaStyle: { color: 'rgba(22, 119, 255, 0.05)' },
          connectNulls: true,
        },
        {
          name: '置信区间',
          type: 'line',
          data: lower95,
          symbol: 'none',
          lineStyle: { width: 0 },
          stack: 'confidence',
          areaStyle: { color: 'rgba(22, 119, 255, 0.05)' },
          connectNulls: true,
        },
        // 80% confidence interval
        {
          name: '置信区间(80%)',
          type: 'line',
          data: upper80,
          symbol: 'none',
          lineStyle: { width: 0 },
          stack: 'confidence80',
          areaStyle: { color: 'rgba(22, 119, 255, 0.1)' },
          connectNulls: true,
        },
        {
          name: '置信区间(80%)',
          type: 'line',
          data: lower80,
          symbol: 'none',
          lineStyle: { width: 0 },
          stack: 'confidence80',
          areaStyle: { color: 'rgba(22, 119, 255, 0.1)' },
          connectNulls: true,
        },
        // Actual prices
        {
          name: '实际价格',
          type: 'line',
          data: realPrices,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: '#333' },
          connectNulls: false,
        },
        // Predicted prices
        {
          name: `预测价格`,
          type: 'line',
          data: forecastValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { width: 2, color: '#1677ff', type: 'dashed' },
          connectNulls: true,
        },
      ],
    };
  }, [kline, prediction]);

  if (!prediction.forecast || prediction.forecast.length === 0) {
    return (
      <Card
        title="趋势预测"
        style={{ borderRadius: 8, marginBottom: 16 }}
      >
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          {prediction.method === 'INSUFFICIENT_DATA'
            ? '数据量不足，无法进行预测（至少需要30个交易日数据）'
            : '暂无预测数据'}
        </div>
      </Card>
    );
  }

  const methodLabel =
    prediction.method === 'ARIMA' ? 'ARIMA模型' :
    prediction.method === 'LINEAR_REGRESSION' ? '线性回归' :
    prediction.method === 'SMA' ? '均线预测' : '';

  const trendLabel =
    prediction.trend === 'up' ? '📈 上涨' :
    prediction.trend === 'down' ? '📉 下跌' : '➡️ 震荡';

  const confidenceLabel =
    prediction.confidence === 'high' ? '高' :
    prediction.confidence === 'medium' ? '中' : '低';

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>趋势预测</span>
          <Tag color="blue">{methodLabel}</Tag>
          <Tag color={prediction.trend === 'up' ? 'red' : prediction.trend === 'down' ? 'green' : 'default'}>
            {trendLabel}
          </Tag>
          <Tag>置信度: {confidenceLabel}</Tag>
        </div>
      }
      extra={
        <span style={{ fontSize: 12, color: '#999' }}>
          预测仅供参考
        </span>
      }
      style={{ borderRadius: 8, marginBottom: 16 }}
      bodyStyle={{ padding: '12px 0' }}
    >
      <ReactEChartsCore
        option={option}
        style={{ height: 350 }}
        showLoading={loading}
        notMerge
        lazyUpdate
      />
    </Card>
  );
}
