import React from 'react';
import { Card, Tag, Tooltip, Spin } from 'antd';
import { RightCircleOutlined, BankOutlined, EnvironmentOutlined, PieChartOutlined } from '@ant-design/icons';

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

interface Props {
  data: StockProfileData | null;
  loading?: boolean;
}

export default function StockProfilePanel({ data, loading }: Props) {
  if (loading) {
    return (
      <Card title={<span><BankOutlined /> 行业概念</span>} size="small"
        style={{ borderRadius: 8, width: '100%', height: 420 }}
        styles={{ body: { padding: '24px 12px', textAlign: 'center', color: '#999', fontSize: 13, height: 382 } }}>
        <Spin size="small" />
      </Card>
    );
  }

  const hasData = data && (data.industry || data.concepts.length > 0 || data.region);

  if (!data) {
    return (
      <Card title={<span><BankOutlined /> 行业概念</span>} size="small"
        style={{ borderRadius: 8, width: '100%', height: 420 }}
        styles={{ body: { padding: '20px 12px', textAlign: 'center', height: 382 } }}>
        <div style={{ fontSize: 12, color: '#faad14', marginBottom: 8 }}>⏳ 数据加载中...</div>
        <div style={{ fontSize: 11, color: '#999' }}>正在获取行业及概念板块信息</div>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card title={<span><BankOutlined /> 行业概念</span>} size="small"
        style={{ borderRadius: 8, width: '100%', height: 420 }}
        styles={{ body: { padding: '20px 12px', textAlign: 'center', height: 382 } }}>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>暂无行业板块数据</div>
        <div style={{ fontSize: 11, color: '#bbb', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>行业: {data.industry || '(空)'}</span>
          <span>地域: {data.region || '(空)'}</span>
          <span>概念: {data.concepts.length > 0 ? data.concepts.map(c => c.name).join(', ') : '(空)'}</span>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={<span><BankOutlined style={{ color: '#1677ff' }} /> 行业概念</span>}
      size="small"
      style={{ borderRadius: 8, width: '100%', height: 420, overflow: 'hidden' }}
      styles={{ body: { padding: '10px 12px', height: 362, overflowY: 'auto' } }}
    >
      {data.industry && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}><PieChartOutlined /> 所属行业</div>
          <Tag color="blue" style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4 }}>{data.industry}</Tag>
        </div>
      )}
      {data.region && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}><EnvironmentOutlined /> 所属地域</div>
          <Tag style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: '#f0f5ff', border: '1px solid #d6e4ff', color: '#1d39c4' }}>{data.region}</Tag>
        </div>
      )}
      {data.concepts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}><RightCircleOutlined /> 概念板块 ({data.concepts.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {data.concepts.map((c: any, i: number) => (
              <Tooltip key={i} title={'板块代码: ' + (c.code || '-')}>
                <Tag style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: '#f6ffed',
                  border: '1px solid #b7eb8f', color: '#389e0d', cursor: 'pointer', margin: 0 }}>{c.name}</Tag>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
          {data.pe != null && <div><span style={{ fontSize: 11, color: '#999' }}>市盈率(动)</span><div style={{ fontSize: 14, fontWeight: 600 }}>{data.pe.toFixed(2)}</div></div>}
          {data.pb != null && <div><span style={{ fontSize: 11, color: '#999' }}>市净率</span><div style={{ fontSize: 14, fontWeight: 600 }}>{data.pb.toFixed(2)}</div></div>}
          {data.marketCap != null && <div><span style={{ fontSize: 11, color: '#999' }}>总市值</span><div style={{ fontSize: 14, fontWeight: 600 }}>{data.marketCap >= 1e8 ? (data.marketCap/1e8).toFixed(2) + '亿' : data.marketCap.toLocaleString()}</div></div>}
          {data.circulatingMarketCap != null && <div><span style={{ fontSize: 11, color: '#999' }}>流通市值</span><div style={{ fontSize: 14, fontWeight: 600 }}>{data.circulatingMarketCap >= 1e8 ? (data.circulatingMarketCap/1e8).toFixed(2) + '亿' : data.circulatingMarketCap.toLocaleString()}</div></div>}
          {data.high52w != null && <div><span style={{ fontSize: 11, color: '#999' }}>52周最高</span><div style={{ fontSize: 14, fontWeight: 600, color: '#cf1322' }}>{data.high52w.toFixed(2)}</div></div>}
          {data.low52w != null && <div><span style={{ fontSize: 11, color: '#999' }}>52周最低</span><div style={{ fontSize: 14, fontWeight: 600, color: '#3cb371' }}>{data.low52w.toFixed(2)}</div></div>}
        </div>
      </div>
    </Card>
  );
}