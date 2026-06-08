import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Tag, Progress, Collapse, Space, Typography, Spin } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ExperimentOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { getBacktest } from '../api/stockApi';

const { Text } = Typography;

interface BacktestReportProps {
  code: string;
  visible: boolean;
}

export default function BacktestReport({ code, visible }: BacktestReportProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!visible || !code) return;
    setLoading(true);
    getBacktest(code)
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [code, visible]);

  if (!visible || loading) return null;
  if (!result || !result.hasHistory) return null;

  const { metrics, deviationAnalysis, improvementTips, record } = result;

  return (
    <Card
      size="small"
      title={
        <Space>
          <ExperimentOutlined style={{ color: '#722ed1' }} />
          <span style={{ fontWeight: 600 }}>预测回测</span>
          <Tag>{record?.date}</Tag>
          <Tag>{record?.method}</Tag>
        </Space>
      }
      style={{ borderRadius: 8, marginBottom: 16, border: '1px solid #d3adf7' }}
    >
      {!metrics ? (
        <div style={{ color: '#999', fontSize: 13 }}>
          预测期尚未结束，暂无回测数据（预测日期：{record?.date}）
        </div>
      ) : (
        <>
          {/* 准确率指标 */}
          <Row gutter={[16, 12]}>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>方向判断</div>
                {metrics.directionCorrect ? (
                  <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 14, padding: '2px 12px' }}>正确</Tag>
                ) : (
                  <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 14, padding: '2px 12px' }}>错误</Tag>
                )}
              </div>
            </Col>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>平均误差</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: metrics.mae < 0.5 ? '#52c41a' : metrics.mae < 1 ? '#faad14' : '#ff4d4f' }}>
                  ¥{metrics.mae}
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>80%区间命中</div>
                <Progress
                  type="circle"
                  percent={metrics.within80}
                  size={40}
                  strokeColor={metrics.within80 >= 70 ? '#52c41a' : '#faad14'}
                  format={p => `${p}%`}
                />
              </div>
            </Col>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>最大偏差</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: metrics.maxError < 0.8 ? '#52c41a' : '#ff4d4f' }}>
                  ¥{metrics.maxError}
                </div>
              </div>
            </Col>
          </Row>

          {/* 偏差分析与改进 */}
          <Collapse
            size="small"
            ghost
            expandIconPosition="end"
            style={{ marginTop: 8 }}
            items={[
              {
                key: 'analysis',
                label: <span style={{ fontWeight: 500, fontSize: 13 }}>📊 偏差分析</span>,
                children: (
                  <div style={{ lineHeight: 2 }}>
                    {deviationAnalysis?.map((d: string, i: number) => (
                      <div key={i} style={{ color: d.includes('错误') ? '#cf1322' : '#d48806', fontSize: 13 }}>
                        <WarningOutlined style={{ marginRight: 6 }} />
                        {d}
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                key: 'improve',
                label: <span style={{ fontWeight: 500, fontSize: 13 }}>💡 改进建议</span>,
                children: (
                  <div style={{ lineHeight: 2 }}>
                    {improvementTips?.map((tip: string, i: number) => (
                      <div key={i} style={{ color: '#389e0d', fontSize: 13 }}>
                        <BulbOutlined style={{ marginRight: 6 }} />
                        {tip}
                      </div>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}
    </Card>
  );
}
