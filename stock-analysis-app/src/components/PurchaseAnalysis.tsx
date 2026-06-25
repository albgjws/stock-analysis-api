import React, { useState, useCallback } from 'react';
import {
  Card,
  InputNumber,
  Button,
  Row,
  Col,
  Tag,
  Progress,
  Table,
  Alert,
  Space,
  Typography,
} from 'antd';
import {
  DollarOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
  RiseOutlined,
  FallOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import type { PurchaseAnalysisResult } from '../types';
import { formatPrice, formatPercent } from '../utils/format';

const { Text } = Typography;

interface PurchaseAnalysisProps {
  stockCode: string;
  stockName: string;
}

export default function PurchaseAnalysis({ stockCode, stockName }: PurchaseAnalysisProps) {
  const [buyPrice, setBuyPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PurchaseAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!buyPrice || buyPrice <= 0) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(
        `/api/stock/${stockCode}/purchase-analysis?buyPrice=${buyPrice}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '分析失败');
      }
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || '请求失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [buyPrice, stockCode]);

  const ratingColor = (rating: string) => {
    switch (rating) {
      case 'excellent': return '#cf1322';  // 优秀=红（涨）
      case 'good': return '#cf1322';       // 良好=红（涨）
      case 'neutral': return '#faad14';    // 中性=黄
      case 'risky': return '#3cb371';      // 风险=绿（跌）
      case 'bad': return '#3cb371';        // 差=绿（跌）
      default: return '#999';
    }
  };

  const probColor = (up: number) => {
    if (up >= 50) return '#cf1322';   // ≥50% = 红（涨）
    return '#3cb371';                  // <50% = 绿（跌）
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'good': return '🔴';   // 良好=红灯（涨）
      case 'neutral': return '⚪';
      case 'bad': return '🟢';     // 较差=绿灯（跌）
      default: return '';
    }
  };

  const detailColumns = [
    {
      title: '分析项目',
      dataIndex: 'item',
      key: 'item',
      width: 130,
    },
    {
      title: '评价',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: string) => {
        const color = s === 'good' ? '#cf1322' : s === 'bad' ? '#3cb371' : '#999';
        return <span style={{ color, fontWeight: s !== 'neutral' ? 600 : 400 }}>{statusIcon(s)} {s === 'good' ? '良好' : s === 'neutral' ? '中性' : '较差'}</span>;
      },
    },
    {
      title: '说明',
      dataIndex: 'comment',
      key: 'comment',
    },
  ];

  return (
    <Card
      title={
        <Space>
          <DollarOutlined style={{ color: '#1677ff' }} />
          <span>买入诊断</span>
        </Space>
      }
      style={{ borderRadius: 8, marginBottom: 16 }}
    >
      {/* 输入区 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <Text strong style={{ whiteSpace: 'nowrap' }}>
          {stockName}（{stockCode}）
        </Text>
        <Text>买入价：</Text>
        <InputNumber
          value={buyPrice}
          onChange={setBuyPrice}
          placeholder="输入买入价"
          min={0.01}
          step={0.01}
          precision={2}
          size="large"
          style={{ maxWidth: 160 }}
          prefix="¥"
          onPressEnter={handleAnalyze}
        />
        <Button
          type="primary"
          icon={<AuditOutlined />}
          onClick={handleAnalyze}
          loading={loading}
          disabled={!buyPrice || buyPrice <= 0}
        >
          诊断
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} closable />
      )}

      {/* 结果区 */}
      {result && (
        <>
          {/* 评分概览 */}
          <div
            style={{
              display: 'flex',
              gap: 24,
              padding: 20,
              background: '#fafafa',
              borderRadius: 8,
              marginBottom: 16,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {/* 评级 */}
            <div style={{ textAlign: 'center', minWidth: 100 }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  padding: '6px 16px',
                  borderRadius: 6,
                  border: '2px solid',
                  borderColor: ratingColor(result.rating),
                  color: ratingColor(result.rating),
                }}
              >
                {result.ratingLabel}
              </div>
            </div>

            {/* 评分 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>综合评分</div>
              <Progress
                type="circle"
                percent={result.score}
                size={56}
                strokeColor={ratingColor(result.rating)}
                format={pct => `${pct}`}
              />
            </div>

            {/* 盈亏 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                买入价 {formatPrice(result.purchasePrice)}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 'bold',
                  color: result.pnl >= 0 ? '#cf1322' : '#3cb371',
                }}
              >
                {result.pnl >= 0 ? '+' : ''}{formatPrice(result.pnl)}
                <span style={{ fontSize: 14, marginLeft: 4 }}>
                  ({result.pnlPercent >= 0 ? '+' : ''}{result.pnlPercent}%)
                </span>
              </div>
            </div>

            {/* 上涨概率 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>上涨概率</div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 'bold',
                  color: probColor(result.probability.up),
                }}
              >
                {result.probability.up}%
              </div>
            </div>
          </div>

          {/* 止损止盈 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Card
                size="small"
                style={{ borderRadius: 8, border: '1px solid #b7eb8f', background: '#f6ffed' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <SafetyCertificateOutlined style={{ color: '#3cb371', fontSize: 16 }} />
                  <span style={{ fontWeight: 600, color: '#389e0d', fontSize: 14 }}>止损价（基于买入价）</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#3cb371' }}>
                  {formatPrice(result.stopLoss.price)}
                </div>
                <div style={{ fontSize: 13, color: '#3cb371' }}>
                  {formatPercent(result.stopLoss.percent)}（{result.stopLoss.reason}）
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card
                size="small"
                style={{ borderRadius: 8, border: '1px solid #ffccc7', background: '#fff2f0' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <TrophyOutlined style={{ color: '#cf1322', fontSize: 16 }} />
                  <span style={{ fontWeight: 600, color: '#cf1322', fontSize: 14 }}>止盈价（基于买入价）</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#cf1322' }}>
                  {formatPrice(result.takeProfit.price)}
                </div>
                <div style={{ fontSize: 13, color: '#cf1322' }}>
                  +{formatPercent(result.takeProfit.percent)}（{result.takeProfit.reason}）
                </div>
              </Card>
            </Col>
          </Row>

          {/* 详细分析表 */}
          <Table
            columns={detailColumns}
            dataSource={result.details}
            rowKey="item"
            pagination={false}
            size="small"
            bordered
          />
        </>
      )}
    </Card>
  );
}
