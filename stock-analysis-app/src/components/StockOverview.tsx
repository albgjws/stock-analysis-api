import React from 'react';
import { Card, Row, Col, Statistic, Tag, Space, Tooltip } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import type { StockInfo } from '../types';
import { formatPrice, formatVolume, formatAmount } from '../utils/format';

export interface StockProfileData {
  industry: string;
  concepts: { name: string; code: string }[];
  region: string;
  pe: number | null;
  pb: number | null;
  marketCap: number | null;
  circulatingMarketCap: number | null;
  high52w: number | null;
  low52w: number | null;
}

interface StockOverviewProps {
  info: StockInfo;
  profile?: StockProfileData | null;
}

interface StockOverviewProps {
  info: StockInfo;
}

export default function StockOverview({ info, profile }: StockOverviewProps) {
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
            <Col span={6}><Statistic title="市值" value={(info.marketCap >= 10000 ? (info.marketCap/10000).toFixed(2) + '万亿' : info.marketCap.toFixed(2) + '亿')} valueStyle={{ fontSize: 16 }} /></Col>
            <Col span={6}><Statistic title="换手率" value={info.turnoverRate != null ? info.turnoverRate.toFixed(2) + '%' : '—'} valueStyle={{ fontSize: 16, color: '#999' }} /></Col>
          </Row>
        </Col>
      </Row>

      {/* Industry + Concepts + PE/PB + 52w compact */}
      {profile && (profile.industry || profile.concepts.length > 0 || profile.region || profile.pe != null) && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0f0f0', display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'center', fontSize: 13 }}>
          {profile.industry && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#999', fontSize: 12 }}>行业</span>
              <Tag color="blue" style={{ fontSize: 12, margin: 0, lineHeight: '20px' }}>{profile.industry}</Tag>
            </span>
          )}
          {profile.region && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#999', fontSize: 12 }}>地域</span>
              <Tag style={{ fontSize: 12, margin: 0, lineHeight: '20px', background: '#f0f5ff', border: '1px solid #d6e4ff', color: '#1d39c4' }}>{profile.region}</Tag>
            </span>
          )}
          {profile.concepts.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span style={{ color: '#999', fontSize: 12 }}>概念</span>
              {profile.concepts.slice(0, 5).map((c, i) => (
                <Tag key={i} style={{ fontSize: 11, margin: 0, padding: '0 4px', lineHeight: '18px', background: '#f6ffed', border: '1px solid #b7eb8f', color: '#389e0d' }}>{c.name}</Tag>
              ))}
              {profile.concepts.length > 5 && (
                <Tooltip title={profile.concepts.slice(5).map(c => c.name).join(', ')}>
                  <Tag style={{ fontSize: 11, margin: 0, lineHeight: '18px', cursor: 'pointer' }}>+{profile.concepts.length - 5}</Tag>
                </Tooltip>
              )}
            </span>
          )}
          {profile.pe != null && (<span style={{ color: '#666' }}><span style={{ color: '#999', fontSize: 12 }}>市盈率 </span><b>{profile.pe.toFixed(2)}</b></span>)}
          {profile.pb != null && (<span style={{ color: '#666' }}><span style={{ color: '#999', fontSize: 12 }}>市净率 </span><b>{profile.pb.toFixed(2)}</b></span>)}
          {profile.high52w != null && (<span style={{ color: '#666' }}><span style={{ color: '#999', fontSize: 12 }}>52周高 </span><b style={{ color: '#cf1322' }}>{profile.high52w.toFixed(2)}</b></span>)}
          {profile.low52w != null && (<span style={{ color: '#666' }}><span style={{ color: '#999', fontSize: 12 }}>52周低 </span><b style={{ color: '#3cb371' }}>{profile.low52w.toFixed(2)}</b></span>)}
          {profile.circulatingMarketCap != null && (<span style={{ color: '#666' }}><span style={{ color: '#999', fontSize: 12 }}>流通市值 </span><b>{(profile.circulatingMarketCap / 1e8).toFixed(2)}亿</b></span>)}
        </div>
      )}
    </Card>
  );
}