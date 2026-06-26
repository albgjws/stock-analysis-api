import React, { useState } from 'react';
import { Card } from 'antd';

interface TransactionItem {
  time: string;
  price: number;
  volume: number;
  amount: number;
  direction: number;
}

interface Level5Props {
  bid?: { price: number; volume: number }[];
  ask?: { price: number; volume: number }[];
  price?: number;
  changePercent?: number;
  compact?: boolean;
  transactions?: TransactionItem[] | null;
  transLoading?: boolean;
}

function TransactionRows({ data, expanded }: { data: TransactionItem[]; expanded: boolean }) {
  const formatVol = (v: number) => {
    if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
    if (v >= 1e4) return (v / 1e4).toFixed(1) + '万';
    return v.toLocaleString();
  };
  const displayData = expanded ? data.slice(-100) : data.slice(-4);
  return (
    <>
      {displayData.map((t, i) => {
        const dirColor = t.direction === 0 ? '#cf1322' : t.direction === 1 ? '#3cb371' : '#999';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '1px 0', fontSize: 11, borderBottom: '1px solid #fafafa' }}>
            <span style={{ width: 50, flexShrink: 0, color: '#666' }}>{t.time.slice(0, 5)}</span>
            <span style={{ flex: 1, textAlign: 'left', fontWeight: 600, color: dirColor, paddingLeft: 6 }}>{t.price.toFixed(2)}</span>
            <span style={{ width: 50, textAlign: 'right', flexShrink: 0, color: dirColor }}>{formatVol(t.volume)}</span>
          </div>
        );
      })}
    </>
  );
}

export default function Level5Panel({ bid, ask, price, changePercent, compact, transactions, transLoading }: Level5Props) {
  const [txExpanded, setTxExpanded] = useState(false);

  if (!bid || !ask || !bid.length || !ask.length) {
    return (
      <Card title="五档盘口" size="small" style={{ borderRadius: 8, width: '100%', height: 420 }} styles={{ body: { padding: '24px 12px', textAlign: 'center', color: '#999', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 382 } }}>
        等待行情数据...
      </Card>
    );
  }

  const isUp = changePercent != null && changePercent >= 0;
  const tickColor = isUp ? '#cf1322' : '#3cb371';

  const askReverse = [...ask].reverse();
  const buyDirect = [...bid];

  const dispAsk = compact ? askReverse.slice(-1) : askReverse;
  const dispBid = compact ? buyDirect.slice(0, 1) : buyDirect;
  const allRows = [...dispAsk, ...dispBid];
  const dispMaxVol = Math.max(...allRows.map(r => r.volume), 1);

  const hasTx = transactions && transactions.length > 0;
  const txRowCount = txExpanded ? Math.min(transactions?.length || 0, 100) : 4;
  const txHeight = hasTx ? Math.min(txRowCount * 20 + 28, 260) : 0; // header + rows

  return (
    <Card
      title="五档盘口"
      size="small"
      style={{ borderRadius: 8, width: '100%', height: 420 }}
      styles={{ body: { padding: '4px 10px', height: 382, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
    >
      {/* 五档盘口区域 - 固定高度 */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {dispAsk.map((a, i) => (
            <div key={`ask-${i}`} style={{ display: 'flex', alignItems: 'center', height: 20, position: 'relative' }}>
              <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: `${(a.volume / dispMaxVol) * 100}%`, background: 'rgba(60,179,113,0.12)', borderRadius: 2 }} />
              <span style={{ width: 28, fontSize: 10, color: '#999', flexShrink: 0, position: 'relative', zIndex: 1 }}>{`卖${dispAsk.length - i}`}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#3cb371', position: 'relative', zIndex: 1 }}>{a.price.toFixed(2)}</span>
              <span style={{ width: 60, textAlign: 'right', fontSize: 10, color: '#666', position: 'relative', zIndex: 1 }}>{a.volume.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', padding: '1px 0', margin: '2px 0', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', fontSize: compact ? 13 : 16, fontWeight: 700, color: tickColor }}>
          {price?.toFixed(2) || '\u2014'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {dispBid.map((b, i) => (
            <div key={`bid-${i}`} style={{ display: 'flex', alignItems: 'center', height: 20, position: 'relative' }}>
              <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: `${(b.volume / dispMaxVol) * 100}%`, background: 'rgba(207,19,34,0.12)', borderRadius: 2 }} />
              <span style={{ width: 28, fontSize: 10, color: '#999', flexShrink: 0, position: 'relative', zIndex: 1 }}>{`买${i + 1}`}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#cf1322', position: 'relative', zIndex: 1 }}>{b.price.toFixed(2)}</span>
              <span style={{ width: 60, textAlign: 'right', fontSize: 10, color: '#666', position: 'relative', zIndex: 1 }}>{b.volume.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 逐笔成交区域 */}
      <div
        style={{
          marginTop: 4,
          borderTop: hasTx ? '1px solid #e8e8e8' : 'none',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {hasTx ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>逐笔详情</span>
              <span
                onClick={() => setTxExpanded(v => !v)}
                style={{ fontSize: 11, color: '#1677ff', cursor: 'pointer', fontWeight: 400 }}
              >
                {txExpanded ? '收起明细' : '展开明细'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '2px 0', fontSize: 10, color: '#999', flexShrink: 0 }}>
              <span style={{ width: 50, flexShrink: 0 }}>时间</span>
              <span style={{ flex: 1, paddingLeft: 6, textAlign: 'left' }}>价格</span>
              <span style={{ width: 50, textAlign: 'right', flexShrink: 0 }}>手数</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <TransactionRows data={transactions} expanded={txExpanded} />
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0', color: '#999', fontSize: 11, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {transLoading ? '加载成交明细...' : '暂无逐笔成交数据'}
          </div>
        )}
      </div>
    </Card>
  );
}
