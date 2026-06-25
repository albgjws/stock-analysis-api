import React from 'react';
import { Card, Tag, Progress, Space } from 'antd';
import { FireOutlined, WarningOutlined } from '@ant-design/icons';
import type { LimitPrediction } from '../utils/advancedIndicators';

interface LimitPredictProps {
  prediction: LimitPrediction;
}

/**
 * 同花顺风格的涨停/跌停详情
 */
function fmt(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toLocaleString();
}
function fmtHand(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(1) + '万手';
  return v.toLocaleString() + '手';
}

export default function LimitPredictionBanner({ prediction }: LimitPredictProps) {
  const { isLimitUp, isLimitDown, consecutiveCount, nextDayProb,
    limitPrice, blockVolume, blockAmount, blockRatio,
    limitVolume, maxBlockAmount, turnoverRate, totalAmount,
    analysis, factors } = prediction;

  const isBull = isLimitUp;
  const mainColor = isBull ? '#cf1322' : '#3cb371';
  const bgGrad = isBull
    ? 'linear-gradient(135deg, #fff2f0, #fff7e6)'
    : 'linear-gradient(135deg, #f6ffed, #e6fffb)';
  const titleIcon = isBull ? '🚀' : '💥';
  const titleLabel = isLimitUp ? '涨停' : '跌停';

  const probColor = nextDayProb >= 60 ? mainColor : nextDayProb >= 40 ? '#faad14' : '#999';
  const strokeColor = isBull
    ? { '0%': '#ffa39e', '100%': '#cf1322' }
    : { '0%': '#b7eb8f', '100%': '#3cb371' };

  const TagItem = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div style={{ textAlign: 'center', padding: '2px 6px' }}>
      <div style={{ fontSize: 10, color: '#999', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#333' }}>{value}</div>
    </div>
  );

  return (
    <Card
      size="small"
      style={{
        borderRadius: 8, marginBottom: 16,
        background: bgGrad, border: `1px solid ${mainColor}40`,
      }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      {/* 第一行：标题 + 连板数 + 概率 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24 }}>{titleIcon}</span>
          <Tag color={isBull ? 'red' : 'green'} style={{ fontSize: 15, padding: '2px 12px', fontWeight: 700, margin: 0 }}>
            {titleLabel}
          </Tag>
          <Tag color={isBull ? 'volcano' : 'cyan'} style={{ fontSize: 13, margin: 0 }}>
            {consecutiveCount === 1 ? '首板' : `${consecutiveCount}板`}
          </Tag>
          {consecutiveCount >= 3 && (
            <Tag color="purple" style={{ fontSize: 12, margin: 0 }}>高位警示</Tag>
          )}
        </div>
        {/* 明日概率圆环 */}
        <div style={{ textAlign: 'center', minWidth: 70 }}>
          <Progress
            type="circle"
            percent={nextDayProb}
            size={56}
            strokeColor={strokeColor}
            format={pct => <span style={{ fontSize: 14, fontWeight: 700, color: probColor }}>{pct}%</span>}
          />
          <div style={{ fontSize: 10, color: '#999', marginTop: -2 }}>明{isLimitUp ? '连板' : '续跌'}概率</div>
        </div>
      </div>

      {/* 第二行：详细指标（同花顺风格） */}
      <div style={{
        display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap',
        background: 'rgba(255,255,255,0.6)', borderRadius: 6,
        padding: '8px 4px', marginBottom: 8, gap: 4,
      }}>
        <TagItem label="涨停价" value={limitPrice?.toFixed(2) ?? '—'} color={mainColor} />
        <TagItem label="封单量" value={blockVolume > 0 ? fmtHand(blockVolume) : '—'} />
        <TagItem label="封单额" value={blockAmount > 0 ? fmt(blockAmount) : '—'} color={mainColor} />
        <TagItem label="封单占比" value={blockRatio != null ? blockRatio.toFixed(2) + '%' : '—'}
          color={blockRatio != null && blockRatio > 100 ? mainColor : '#faad14'} />
        <TagItem label="涨停成交额" value={limitVolume > 0 ? fmt(limitVolume) : '—'} />
        <TagItem label="最高封单" value={maxBlockAmount > 0 ? fmt(maxBlockAmount) : '—'} color={mainColor} />
        <TagItem label="换手率" value={turnoverRate != null ? turnoverRate.toFixed(2) + '%' : '—'} />
        <TagItem label="总成交额" value={totalAmount > 0 ? fmt(totalAmount) : '—'} />
      </div>

      {/* 分析文字 */}
      <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6, marginBottom: 6 }}>
        {analysis}
      </div>

      {/* 影响因素标签 */}
      {factors.length > 0 && (
        <div style={{ paddingTop: 4, borderTop: '1px dashed #e8e8e8' }}>
          <Space size={[4, 4]} wrap>
            {factors.map((f, i) => (
              <Tag key={i} color={isBull ? 'red' : 'green'} style={{ fontSize: 11, borderRadius: 4, margin: 0 }}>
                {f}
              </Tag>
            ))}
          </Space>
        </div>
      )}
    </Card>
  );
}
