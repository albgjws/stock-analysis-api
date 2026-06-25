import React from 'react';
import { Card } from 'antd';

interface Level5Props {
  bid?: { price: number; volume: number }[];
  ask?: { price: number; volume: number }[];
  price?: number;
  changePercent?: number;
}

export default function Level5Panel({ bid, ask, price, changePercent }: Level5Props) {
  if (!bid || !ask || !bid.length || !ask.length) {
    return (
      <Card title="五档盘口" size="small" style={{ borderRadius: 8, width: '100%', height: 400 }} styles={{ body: { padding: '24px 12px', textAlign: 'center', color: '#999', fontSize: 13, height: 362, display: 'flex', alignItems: 'center', justifyContent: 'center' } }}>
        等待行情数据...
      </Card>
    );
  }

  const isUp = changePercent != null && changePercent >= 0;
  const tickColor = isUp ? '#cf1322' : '#3cb371';

  const askReverse = [...ask].reverse();
  const buyDirect = [...bid];

  const maxVol = Math.max(
    ...ask.map(a => a.volume),
    ...bid.map(b => b.volume),
    1
  );

  return (
    <Card
      title="五档盘口"
      size="small"
      style={{ borderRadius: 8, width: '100%', height: 400 }}
      styles={{ body: { padding: '8px 12px', height: 362, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
        {askReverse.map((a, i) => (
          <div key={`ask-${i}`} style={{ display: 'flex', alignItems: 'center', height: 24, position: 'relative' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: `${(a.volume / maxVol) * 100}%`, background: 'rgba(60,179,113,0.12)', borderRadius: 2 }} />
            <span style={{ width: 30, fontSize: 11, color: '#999', flexShrink: 0, position: 'relative', zIndex: 1 }}>卖{i + 5}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#3cb371', position: 'relative', zIndex: 1 }}>{a.price.toFixed(2)}</span>
            <span style={{ width: 70, textAlign: 'right', fontSize: 11, color: '#666', position: 'relative', zIndex: 1 }}>{a.volume.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', padding: '4px 0', margin: '4px 0', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', fontSize: 18, fontWeight: 700, color: tickColor }}>
        {price?.toFixed(2) || '—'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {buyDirect.map((b, i) => (
          <div key={`bid-${i}`} style={{ display: 'flex', alignItems: 'center', height: 24, position: 'relative' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: `${(b.volume / maxVol) * 100}%`, background: 'rgba(207,19,34,0.12)', borderRadius: 2 }} />
            <span style={{ width: 30, fontSize: 11, color: '#999', flexShrink: 0, position: 'relative', zIndex: 1 }}>买{i + 1}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#cf1322', position: 'relative', zIndex: 1 }}>{b.price.toFixed(2)}</span>
            <span style={{ width: 70, textAlign: 'right', fontSize: 11, color: '#666', position: 'relative', zIndex: 1 }}>{b.volume.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
