import React, { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react';
import { Card, Row, Col, Tooltip, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import type { KlineBar } from '../types';

const { Text } = Typography;

const macdHelp = (
  <div style={{ maxWidth: 260, lineHeight: 1.8, fontSize: 12 }}>
    <b>MACD（指数平滑异同移动平均线）</b><br />
    <span style={{ color: '#1677ff' }}>DIF（蓝线）</span> = 快线（12日EMA - 26日EMA）<br />
    <span style={{ color: '#faad14' }}>DEA（黄线）</span> = 慢线（DIF的9日EMA）<br />
    <span style={{ color: '#cf1322' }}>红柱</span> = MACD &gt; 0，多头<br />
    <span style={{ color: '#3cb371' }}>绿柱</span> = MACD &lt; 0，空头<br /><br />
    <b>用法：</b><br />
    ✅ <span style={{ color: '#1677ff' }}>DIF上穿DEA</span> = 金叉 → 买入信号<br />
    ❌ <span style={{ color: '#1677ff' }}>DIF下穿DEA</span> = 死叉 → 卖出信号<br />
    📊 柱由绿变红 = 空转多，由红变绿 = 多转空
  </div>
);

const rsiHelp = (
  <div style={{ maxWidth: 260, lineHeight: 1.8, fontSize: 12 }}>
    <b>RSI（相对强弱指标）</b><br />
    衡量近期价格变动的速度和幅度<br /><br />
    <span style={{ color: '#52c41a' }}>🟢 RSI &lt; 30</span> = <b>超卖</b> → 可能反弹，可关注买入<br />
    <span style={{ color: '#faad14' }}>🟡 RSI 30~70</span> = 正常波动区间<br />
    <span style={{ color: '#ff4d4f' }}>🔴 RSI &gt; 70</span> = <b>超买</b> → 可能回调，注意风险<br /><br />
    <b>用法：</b><br />
    RSI从低位上穿30 = 买入信号<br />
    RSI从高位下穿70 = 卖出信号<br />
    RSI与价格背离 = 趋势可能反转
  </div>
);

const kdjHelp = (
  <div style={{ maxWidth: 260, lineHeight: 1.8, fontSize: 12 }}>
    <b>KDJ（随机指标）</b><br />
    由K、D、J三条线组成，判断短期超买超卖<br /><br />
    <span style={{ color: '#1677ff' }}>K（蓝线）</span> = 快速确认线<br />
    <span style={{ color: '#faad14' }}>D（黄线）</span> = 慢速主干线<br />
    <span style={{ color: '#ff4d4f' }}>J（红线）</span> = 方向敏感线<br /><br />
    <b>用法：</b><br />
    ✅ <span style={{ color: '#1677ff' }}>K线上穿D线</span>（低位&nbsp;&lt;&nbsp;40）= 金叉 → 买入<br />
    ❌ <span style={{ color: '#1677ff' }}>K线下穿D线</span>（高位&nbsp;&gt;&nbsp;60）= 死叉 → 卖出<br />
    ⚡ J &gt; 100 = 严重超买<br />
    ⚡ J &lt; 0 = 严重超卖
  </div>
);

function ChartTitle({ title, help }: { title: string; help: React.ReactNode }) {
  return (
    <span>
      {title}
      <Tooltip title={help} styles={{ root: { maxWidth: 300 } }}>
        <QuestionCircleOutlined style={{ marginLeft: 6, color: '#999', fontSize: 13, cursor: 'pointer' }} />
      </Tooltip>
    </span>
  );
}

function MACDChart({ data }: { data: KlineBar[] }) {
  const option = useMemo(() => {
    const dates = data.map(d => d.date);
    const difData = data.map(d => d.macd?.dif ?? null);
    const deaData = data.map(d => d.macd?.dea ?? null);
    const macdData = data.map(d => d.macd?.macd ?? null);
    const macdBars = macdData.map((v, i) => ({
      value: v,
      itemStyle: { color: v != null && v >= 0 ? '#cf1322' : '#3cb371' },
    }));

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          let html = `<div>${params[0]?.axisValue || ''}</div>`;
          params.forEach((p: any) => {
            if (p.value != null) {
              html += `<div>${p.seriesName}: <b>${Number(p.value).toFixed(2)}</b></div>`;
            }
          });
          return html;
        },
      },
      grid: { left: '8%', right: '5%', top: '10%', bottom: '10%' },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', scale: true, splitLine: { show: true, lineStyle: { type: 'dashed' } } },
      series: [
        { name: 'MACD', type: 'bar', data: macdBars, barWidth: '60%' },
        { name: 'DIF', type: 'line', data: difData, smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#1677ff' }, connectNulls: true },
        { name: 'DEA', type: 'line', data: deaData, smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#faad14' }, connectNulls: true },
      ],
    };
  }, [data]);

  return (
    <Card
      title={<ChartTitle title="MACD (12/26/9)" help={macdHelp} />}
      size="small"
      style={{ height: '100%', borderRadius: 8 }}
      styles={{ body: { padding: '8px 0' } }}
    >
      <ReactEChartsCore option={option} style={{ height: 180 }} notMerge lazyUpdate />
    </Card>
  );
}

function RSIChart({ data }: { data: KlineBar[] }) {
  const option = useMemo(() => {
    const dates = data.map(d => d.date);
    const rsiData = data.map(d => d.rsi?.rsi6 ?? null);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          let html = `<div>${params[0]?.axisValue || ''}</div>`;
          params.forEach((p: any) => {
            if (p.value != null) {
              html += `<div>${p.seriesName}: <b>${Number(p.value).toFixed(2)}</b></div>`;
            }
          });
          return html;
        },
      },
      grid: { left: '8%', right: '5%', top: '15%', bottom: '10%' },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', min: 0, max: 100, splitLine: { show: true, lineStyle: { type: 'dashed' } } },
      visualMap: {
        show: false,
        pieces: [
          { lte: 30, color: 'rgba(60, 179, 113, 0.2)' },
          { gt: 30, lte: 70, color: 'transparent' },
          { gt: 70, color: 'rgba(207, 19, 34, 0.2)' },
        ],
      },
      series: [
        { name: '超买(70)', type: 'line', data: Array(dates.length).fill(70), symbol: 'none', lineStyle: { width: 1, type: 'dashed', color: '#ff4d4f', opacity: 0.5 } },
        { name: '超卖(30)', type: 'line', data: Array(dates.length).fill(30), symbol: 'none', lineStyle: { width: 1, type: 'dashed', color: '#52c41a', opacity: 0.5 } },
        { name: 'RSI(6)', type: 'line', data: rsiData, smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#722ed1' }, areaStyle: { color: 'rgba(114, 46, 209, 0.1)' }, connectNulls: true },
      ],
    };
  }, [data]);

  return (
    <Card
      title={<ChartTitle title="RSI(6)" help={rsiHelp} />}
      size="small"
      style={{ height: '100%', borderRadius: 8 }}
      styles={{ body: { padding: '8px 0' } }}
    >
      <ReactEChartsCore option={option} style={{ height: 180 }} notMerge lazyUpdate />
    </Card>
  );
}

function KDJChart({ data }: { data: KlineBar[] }) {
  const option = useMemo(() => {
    const dates = data.map(d => d.date);
    const kData = data.map(d => d.kdj?.k ?? null);
    const dData = data.map(d => d.kdj?.d ?? null);
    const jData = data.map(d => d.kdj?.j ?? null);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          let html = `<div>${params[0]?.axisValue || ''}</div>`;
          params.forEach((p: any) => {
            if (p.value != null) {
              html += `<div>${p.seriesName}: <b>${Number(p.value).toFixed(2)}</b></div>`;
            }
          });
          return html;
        },
      },
      grid: { left: '8%', right: '5%', top: '10%', bottom: '10%' },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', min: 0, max: 100, splitLine: { show: true, lineStyle: { type: 'dashed' } } },
      series: [
        { name: 'K', type: 'line', data: kData, smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#1677ff' }, connectNulls: true },
        { name: 'D', type: 'line', data: dData, smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#faad14' }, connectNulls: true },
        { name: 'J', type: 'line', data: jData, smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#ff4d4f' }, connectNulls: true },
      ],
    };
  }, [data]);

  return (
    <Card
      title={<ChartTitle title="KDJ (9/3/3)" help={kdjHelp} />}
      size="small"
      style={{ height: '100%', borderRadius: 8 }}
      styles={{ body: { padding: '8px 0' } }}
    >
      <ReactEChartsCore option={option} style={{ height: 180 }} notMerge lazyUpdate />
    </Card>
  );
}

export default function IndicatorCharts({ data }: IndicatorChartsProps) {
  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      <Col xs={24} md={8}>
        <MACDChart data={data} />
      </Col>
      <Col xs={24} md={8}>
        <RSIChart data={data} />
      </Col>
      <Col xs={24} md={8}>
        <KDJChart data={data} />
      </Col>
    </Row>
  );
}
