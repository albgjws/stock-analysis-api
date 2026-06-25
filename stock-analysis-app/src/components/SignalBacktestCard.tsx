import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Tag, Progress, Collapse, Empty, Spin } from 'antd';
import { ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { getSignalBacktest } from '../api/stockApi';

interface Props {
  code: string;
  visible: boolean;
}

export default function SignalBacktestCard({ code, visible }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!visible || !code) return;
    setLoading(true);
    getSignalBacktest(code)
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [code, visible]);

  if (!visible) return null;
  if (loading) return <Card size="small" title="📈 买卖信号回测" style={{ borderRadius: 8, marginBottom: 16 }}><div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /> 回测分析中...</div></Card>;
  if (!result || !result.hasData) return null;

  const { overall, bySignal } = result;
  const signalLabels: Record<string, string> = {
    'RSI超卖': 'RSI超卖→买', 'RSI超买': 'RSI超买→卖',
    'MACD金叉': 'MACD金叉→买', 'MACD死叉': 'MACD死叉→卖',
    'KDJ金叉(低位)': 'KDJ低位金叉→买', 'KDJ死叉(高位)': 'KDJ高位死叉→卖',
    '布林下轨': '触下轨→买', '布林上轨': '触上轨→卖',
    '多头排列': '多头排列→买', '空头排列': '空头排列→卖',
  };

  // 判断信号是买入还是卖出类型
  const buySignals = new Set(['RSI超卖', 'MACD金叉', 'KDJ金叉(低位)', '布林下轨', '多头排列']);

  const rateColor = (rate: number) => rate >= 60 ? '#52c41a' : rate >= 45 ? '#faad14' : '#ff4d4f';
  const returnColor = (r: number) => r >= 0 ? '#cf1322' : '#3cb371';

  const signalEntries = Object.entries(bySignal).sort((a, b) => b[1].total - a[1].total);

  // 综合推荐（按买卖分色）
  const bestSignals = signalEntries.filter(([, s]: any) => s.hit5d / s.total >= 0.6).map(([k]) => k);
  const worstSignals = signalEntries.filter(([, s]: any) => s.hit5d / s.total < 0.4).map(([k]) => k);
  const bestBuy = bestSignals.filter(s => buySignals.has(s));
  const bestSell = bestSignals.filter(s => !buySignals.has(s));
  const worstBuy = worstSignals.filter(s => buySignals.has(s));
  const worstSell = worstSignals.filter(s => !buySignals.has(s));

  return (
    <Card
      size="small"
      title={
        <span>
          <ExperimentOutlined style={{ color: '#722ed1', marginRight: 6 }} />
          买卖信号回测
          <span style={{ fontSize: 11, color: '#999', fontWeight: 'normal', marginLeft: 8 }}>
            （共{overall.totalSignals}个信号样本）
          </span>
        </span>
      }
      style={{ borderRadius: 8, marginBottom: 16, border: '1px solid #d3adf7' }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      {/* 综合命中率 */}
      <Row gutter={[16, 12]} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>3日后命中率</div>
            <Progress
              type="dashboard" percent={overall.hitRate3d} size={60}
              strokeColor={rateColor(overall.hitRate3d)}
              format={p => `${p}%`}
            />
          </div>
        </Col>
        <Col span={8}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>5日后命中率</div>
            <Progress
              type="dashboard" percent={overall.hitRate5d} size={60}
              strokeColor={rateColor(overall.hitRate5d)}
              format={p => `${p}%`}
            />
          </div>
        </Col>
        <Col span={8}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>10日后命中率</div>
            <Progress
              type="dashboard" percent={overall.hitRate10d} size={60}
              strokeColor={rateColor(overall.hitRate10d)}
              format={p => `${p}%`}
            />
          </div>
        </Col>
      </Row>

      {/* 推荐/不推荐信号 */}
      {(bestBuy.length > 0 || bestSell.length > 0) && (
        <div style={{ marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: '#cf1322' }}>✅ 高可靠信号：</span>
          {bestBuy.map(s => <Tag key={s} color="red">{signalLabels[s] || s}</Tag>)}
          {bestSell.map(s => <Tag key={s} color="green">{signalLabels[s] || s}</Tag>)}
        </div>
      )}
      {(worstBuy.length > 0 || worstSell.length > 0) && (
        <div style={{ marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: '#3cb371' }}>⚠️ 低可靠信号：</span>
          {worstBuy.map(s => <Tag key={s} color="green">{signalLabels[s] || s}</Tag>)}
          {worstSell.map(s => <Tag key={s} color="red">{signalLabels[s] || s}</Tag>)}
        </div>
      )}

      {/* 各信号详情 */}
      <Collapse
        size="small" ghost expandIconPosition="end"
        items={[{
          key: 'details',
          label: <span style={{ fontWeight: 500, fontSize: 12 }}>📋 各信号详细统计</span>,
          children: (
            <div style={{ fontSize: 12 }}>
              {signalEntries.map(([type, s]: any) => {
                const h3 = s.total > 0 ? (s.hit3d / s.total * 100).toFixed(0) : '0';
                const h5 = s.total > 0 ? (s.hit5d / s.total * 100).toFixed(0) : '0';
                return (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0', gap: 8 }}>
                    <div style={{ width: 100, fontWeight: 600 }}>{signalLabels[type] || type}</div>
                    <div style={{ color: '#999', width: 50 }}>{s.total}次</div>
                    <div style={{ flex: 1, display: 'flex', gap: 12 }}>
                      <span>3日: <b style={{ color: rateColor(Number(h3)) }}>{h3}%</b></span>
                      <span>5日: <b style={{ color: rateColor(Number(h5)) }}>{h5}%</b></span>
                      <span>10日: <b>{s.total > 0 ? (s.hit10d / s.total * 100).toFixed(0) : '0'}%</b></span>
                    </div>
                    <div style={{ width: 120, textAlign: 'right', color: '#999' }}>
                      均收益: <b style={{ color: returnColor(s.avgReturn5d) }}>
                        {(s.avgReturn5d * 100).toFixed(1)}%
                      </b>
                    </div>
                  </div>
                );
              })}
            </div>
          ),
        }]}
      />
    </Card>
  );
}
