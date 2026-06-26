import React, { useState } from 'react';
import { Card } from 'antd';

interface TransactionItem {
  time: string;
  price: number;
  volume: number;
  amount: number;
  direction: number;
}

interface TransactionDetailsProps {
  data?: TransactionItem[] | null;
  loading?: boolean;
}

export default function TransactionDetails({ data, loading }: TransactionDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  const formatTxVolume = (v: number) => {
    if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
    if (v >= 1e4) return (v / 1e4).toFixed(1) + '万';
    return v.toLocaleString();
  };

  if (!data || data.length === 0) {
    if (loading) {
      return (
        <Card title="逐笔成交" size="small" style={{ borderRadius: 8, width: '100%', height: 400 }} styles={{ body: { padding: '24px 12px', textAlign: 'center', color: '#999', fontSize: 13, height: 362, display: 'flex', alignItems: 'center', justifyContent: 'center' } }}>
          加载成交明细...
        </Card>
      );
    }
    return (
      <Card title="逐笔成交" size="small" style={{ borderRadius: 8, width: '100%', height: 400 }} styles={{ body: { padding: '24px 12px', textAlign: 'center', color: '#999', fontSize: 13, height: 362, display: 'flex', alignItems: 'center', justifyContent: 'center' } }}>
        暂无成交数据
        (非交易时段加载上次缓存)
      </Card>
    );
  }

  const defaultCount = 10;
  const displayData = expanded ? data.slice(-100) : data.slice(-defaultCount);
  const hasMore = data.length > defaultCount;

  return (
    <Card
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>逐笔成交</span>
          {hasMore && (
            <span
              onClick={() => setExpanded(e => !e)}
              style={{ fontSize: 11, color: '#1677ff', cursor: 'pointer', fontWeight: 400 }}
            >
              {expanded ? '收起' : '展开全部'}
            </span>
          )}
        </span>
      }
      size="small"
      style={{ borderRadius: 8, width: '100%', height: 400 }}
      styles={{ body: { padding: '6px 10px', height: 362, overflowY: 'auto' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0', fontSize: 11, color: '#999', borderBottom: '1px solid #f0f0f0', marginBottom: 2 }}>
        <span style={{ width: 65, flexShrink: 0 }}>时间</span>
        <span style={{ flex: 1, textAlign: 'right' }}>价格</span>
        <span style={{ width: 70, textAlign: 'right', flexShrink: 0 }}>手数</span>
      </div>
      {displayData.map((t, i) => {
        const dirColor = t.direction === 0 ? '#cf1322' : t.direction === 1 ? '#3cb371' : '#999';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #fafafa' }}>
            <span style={{ width: 65, flexShrink: 0, color: '#666' }}>{t.time.slice(0, 5)}</span>
            <span style={{ flex: 1, textAlign: 'right', fontWeight: 600, color: dirColor }}>{t.price.toFixed(2)}</span>
            <span style={{ width: 70, textAlign: 'right', flexShrink: 0, color: dirColor }}>{formatTxVolume(t.volume)}</span>
          </div>
        );
      })}
    </Card>
  );
}
