import React from 'react';
import { Card, Row, Col, Statistic, Tag, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import type { StockInfo } from '../types';
import { formatPrice, formatVolume, formatAmount } from '../utils/format';

interface StockOverviewProps {
  info: StockInfo;
}

export default function StockOverview({ info }: StockOverviewProps) {
  // 颜色规则：涨=红，跌=绿
  const isUp = info.change > 0;
  const isDown = info.change < 0;
  const c = isUp ? '#cf1322' : isDown ? '#3cb371' : '#333';

  return (
    <Card style={{ borderRadius: 8, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      {/* 第一行：名称 + 价格 + 涨跌幅 */}
      <Row gutter={[16, 12]} align="middle">
        <Col xs={24} sm={12} md={8}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <Space size={4}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{info.name}</span>
                <Tag>{info.code}</Tag>
                <Tag color="blue">{info.market?.toUpperCase()}</Tag>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 11, color: '#52c41a', fontWeight: 600,
                }}>
                  <span style={{
                    display: 'inline-block', width: 5, height: 5,
                    borderRadius: '50%', background: '#52c41a',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                  实时
                </span>
              </Space>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: c }}>{formatPrice(info.price)}</span>
                <span style={{ fontSize: 16, color: c }}>
                  {isUp ? <ArrowUpOutlined /> : isDown ? <ArrowDownOutlined /> : <MinusOutlined />}
                  {info.change >= 0 ? '+' : ''}{info.change.toFixed(2)}
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: c }}>
                  {info.changePercent >= 0 ? '+' : ''}{info.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </Col>

        {/* 第二行：详细数据，两行排列 */}
        <Col xs={24} md={16}>
          <Row gutter={[8, 8]}>
            <Col span={6}><Statistic title="最高" value={formatPrice(info.high)} valueStyle={{ fontSize: 16, color: '#cf1322' }} /></Col>
            <Col span={6}><Statistic title="最低" value={formatPrice(info.low)} valueStyle={{ fontSize: 16, color: '#3cb371' }} /></Col>
            <Col span={6}><Statistic title="开盘" value={formatPrice(info.open)} valueStyle={{ fontSize: 16 }} /></Col>
            <Col span={6}><Statistic title="昨收" value={formatPrice(info.prevClose)} valueStyle={{ fontSize: 16 }} /></Col>
            <Col span={6}><Statistic title="成交量" value={formatVolume(info.volume)} valueStyle={{ fontSize: 16 }} /></Col>
            <Col span={6}><Statistic title="成交额" value={formatAmount(info.amount)} valueStyle={{ fontSize: 16, color: '#1677ff' }} /></Col>
            <Col span={6}><Statistic title="市值" value={formatAmount(info.marketCap)} valueStyle={{ fontSize: 16 }} /></Col>
            <Col span={6}><Statistic title="换手率" value={info.turnoverRate != null ? info.turnoverRate.toFixed(2) + '%' : '—'} valueStyle={{ fontSize: 16, color: '#999' }} /></Col>
          </Row>
        </Col>
      </Row>
    </Card>
  );
}
