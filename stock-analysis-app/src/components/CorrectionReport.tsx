import React, { useEffect, useState } from 'react';
import { Card, Tag, Spin, Progress, Row, Col, Empty } from 'antd';
import { ReloadOutlined, ExperimentOutlined } from '@ant-design/icons';
import { getCorrectionReport } from '../api/stockApi';

interface CorrectionFactor {
  factor: string;
  driftMultiplier: number;
  volMultiplier: number;
  count: number;
}

export default function CorrectionReport() {
  const [data, setData] = useState<CorrectionFactor[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = () => {
    setLoading(true);
    getCorrectionReport()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  if (!data || data.length === 0) return null;

  return (
    <Card
      size="small"
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ExperimentOutlined style={{ color: '#722ed1' }} />
          <span>预测自适应校正</span>
          <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>基于历史误差自动优化</span>
        </span>
      }
      extra={<span style={{ fontSize: 11, color: '#1677ff', cursor: 'pointer' }} onClick={fetch}>⟳ 刷新</span>}
      style={{ borderRadius: 8, marginBottom: 16, border: '1px solid #d3adf7' }}
      styles={{ body: { padding: '8px 12px' } }}
      loading={loading}
    >
      <Row gutter={[8, 8]}>
        {data.map((item, i) => {
          const driftOk = Math.abs(item.driftMultiplier - 1) < 0.1;
          const volOk = Math.abs(item.volMultiplier - 1) < 0.2;
          const driftStatus = item.driftMultiplier > 1.1 ? '偏激进' : item.driftMultiplier < 0.9 ? '偏保守' : '正常';
          const volStatus = item.volMultiplier > 1.3 ? '放大' : item.volMultiplier < 0.7 ? '缩小' : '正常';
          return (
            <Col xs={24} sm={12} key={i}>
              <div style={{ background: '#fafafa', borderRadius: 6, padding: '6px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Tag color={item.factor.includes('牛') ? 'red' : item.factor.includes('熊') ? 'green' : 'default'}>{item.factor}</Tag>
                  <span style={{ fontSize: 10, color: '#999' }}>样本 {item.count}次</span>
                </div>
                <div style={{ fontSize: 11, color: '#666', display: 'flex', gap: 12 }}>
                  <span>趋势系数 <b style={{ color: driftOk ? '#52c41a' : '#faad14' }}>{item.driftMultiplier.toFixed(2)}</b> ({driftStatus})</span>
                  <span>波动系数 <b style={{ color: volOk ? '#52c41a' : '#faad14' }}>{item.volMultiplier.toFixed(2)}</b> ({volStatus})</span>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
}
