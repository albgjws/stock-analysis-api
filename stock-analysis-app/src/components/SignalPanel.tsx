import React from 'react';
import { Card, Row, Col, Tag, Table, Tooltip, Divider } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import type { SignalResult } from '../types';
import { getSignalLabel, formatPrice, formatPercent } from '../utils/format';

interface SignalPanelProps {
  signals: SignalResult;
}

export default function SignalPanel({ signals }: SignalPanelProps) {
  const signalLabel = getSignalLabel(signals.overall);
  const isBuy = signals.overall === 'STRONG_BUY' || signals.overall === 'BUY';
  const isSell = signals.overall === 'STRONG_SELL' || signals.overall === 'SELL';

  const columns = [
    {
      title: '指标',
      dataIndex: 'indicator',
      key: 'indicator',
      width: 100,
    },
    {
      title: '信号',
      dataIndex: 'signal',
      key: 'signal',
      width: 80,
      render: (signal: string) => {
        const color = signal === 'BUY' ? '#cf1322' : signal === 'SELL' ? '#3cb371' : '#999';
        const icon = signal === 'BUY' ? <ArrowUpOutlined /> : signal === 'SELL' ? <ArrowDownOutlined /> : <MinusOutlined />;
        return (
          <span style={{ color }}>
            {icon} {signal === 'BUY' ? '买入' : signal === 'SELL' ? '卖出' : '中性'}
          </span>
        );
      },
    },
    {
      title: '得分',
      dataIndex: 'score',
      key: 'score',
      width: 70,
      render: (score: number) => (
        <span style={{ color: score > 0 ? '#cf1322' : score < 0 ? '#3cb371' : '#999', fontWeight: 600 }}>
          {score > 0 ? '+' : ''}{score}
        </span>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
    },
  ];

  return (
    <Card
      title="买卖信号"
      style={{ borderRadius: 8, marginBottom: 16 }}
    >
      {/* Row 1: 综合信号 + 支撑阻力 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          padding: 20,
          background: '#fafafa',
          borderRadius: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: 120,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 'bold',
              padding: '8px 24px',
              borderRadius: 8,
              border: '2px solid',
              ...(isBuy ? { borderColor: '#cf1322', color: '#cf1322' } :
                  isSell ? { borderColor: '#3cb371', color: '#3cb371' } :
                  { borderColor: '#faad14', color: '#faad14' }),
            }}
          >
            {signalLabel}
          </div>
          <div style={{ marginTop: 8, fontSize: 14, color: '#666' }}>
            综合强度: <b style={{ color: isBuy ? '#cf1322' : isSell ? '#3cb371' : '#faad14' }}>
              {signals.strength > 0 ? '+' : ''}{signals.strength}
            </b>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>支撑位（跌）</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#3cb371' }}>
              {formatPrice(signals.support)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>阻力位（涨）</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#cf1322' }}>
              {formatPrice(signals.resistance)}
            </div>
          </div>
        </div>

        <Tooltip title="信号基于技术指标加权评分，仅供参考">
          <InfoCircleOutlined style={{ color: '#999', cursor: 'pointer' }} />
        </Tooltip>
      </div>

      {/* Row 2: 止损止盈 — 核心新增 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card
            size="small"
            style={{
              borderRadius: 8,
              border: '1px solid #b7eb8f',
              background: '#f6ffed',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <SafetyCertificateOutlined style={{ color: '#3cb371', fontSize: 18 }} />
              <span style={{ fontWeight: 600, color: '#389e0d', fontSize: 15 }}>止损价</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 'bold', color: '#3cb371' }}>
              {formatPrice(signals.stopLoss.price)}
            </div>
            <div style={{ fontSize: 13, color: '#3cb371', marginTop: 4 }}>
              {formatPercent(signals.stopLoss.percent)}
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              {signals.stopLoss.reason}
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            size="small"
            style={{
              borderRadius: 8,
              border: '1px solid #ffccc7',
              background: '#fff2f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <TrophyOutlined style={{ color: '#cf1322', fontSize: 18 }} />
              <span style={{ fontWeight: 600, color: '#cf1322', fontSize: 15 }}>止盈价</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 'bold', color: '#cf1322' }}>
              {formatPrice(signals.takeProfit.price)}
            </div>
            <div style={{ fontSize: 13, color: '#cf1322', marginTop: 4 }}>
              +{formatPercent(signals.takeProfit.percent)}
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              {signals.takeProfit.reason}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Signal details table */}
      {signals.details.length > 0 && (
        <Table
          columns={columns}
          dataSource={signals.details}
          rowKey="indicator"
          pagination={false}
          size="small"
          bordered
        />
      )}
    </Card>
  );
}
