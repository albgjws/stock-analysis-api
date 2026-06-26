import React, { useState } from 'react';

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
  defaultCount?: number;
  onExpandChange?: (expanded: boolean) => void;
}

export default function TransactionDetails({ data, loading, defaultCount = 3, onExpandChange }: TransactionDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  const formatTxVolume = (v: number) => {
    if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
    if (v >= 1e4) return (v / 1e4).toFixed(1) + '万';
    return v.toLocaleString();
  };

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    onExpandChange?.(next);
  };

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '12px 8px', textAlign: 'center', color: '#999', fontSize: 12, borderTop: '1px solid #f0f0f0' }}>
        {loading ? '加载成交明细...' : '暂无逐笔成交数据'}
      </div>
    );
  }

  const displayData = expanded ? data.slice(-100) : data.slice(-defaultCount);
  const hasMore = data.length > defaultCount;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', fontSize: 11, color: '#999', borderTop: '1px solid #f0f0f0' }}>
        <span style={{ width: 55, flexShrink: 0 }}>时间</span>
        <span style={{ flex: 1, textAlign: 'right' }}>价格</span>
        <span style={{ width: 60, textAlign: 'right', flexShrink: 0 }}>手数</span>
        {hasMore && (
          <span
            onClick={handleToggle}
            style={{ fontSize: 11, color: '#1677ff', cursor: 'pointer', fontWeight: 400, marginLeft: 8 }}
          >
            {expanded ? '收起' : '展开'}
          </span>
        )}
      </div>
      {displayData.map((t, i) => {
        const dirColor = t.direction === 0 ? '#cf1322' : t.direction === 1 ? '#3cb371' : '#999';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '2px 8px', fontSize: 12, borderBottom: '1px solid #fafafa' }}>
            <span style={{ width: 55, flexShrink: 0, color: '#666' }}>{t.time.slice(0, 5)}</span>
            <span style={{ flex: 1, textAlign: 'right', fontWeight: 600, color: dirColor }}>{t.price.toFixed(2)}</span>
            <span style={{ width: 60, textAlign: 'right', flexShrink: 0, color: dirColor }}>{formatTxVolume(t.volume)}</span>
          </div>
        );
      })}
    </>
  );
}
