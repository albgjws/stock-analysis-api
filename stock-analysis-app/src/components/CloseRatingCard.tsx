import React from 'react';
import { Card, Tag, Progress, Space, Typography } from 'antd';
import type { CloseRating } from '../utils/advancedIndicators';

const { Text } = Typography;

interface CloseRatingCardProps {
  rating: CloseRating;
}

const ratingColors: Record<string, string> = {
  strong_bull: '#cf1322',
  bull: '#cf1322',
  neutral: '#faad14',
  bear: '#3cb371',
  strong_bear: '#3cb371',
};

const ratingBg: Record<string, string> = {
  strong_bull: '#fff2f0',
  bull: '#fff2f0',
  neutral: '#fffbe6',
  bear: '#f6ffed',
  strong_bear: '#f6ffed',
};

export default function CloseRatingCard({ rating }: CloseRatingCardProps) {
  const { score, upProb, ratingLabel, rating: rt, details, summary } = rating;
  const color = ratingColors[rt];
  const bg = ratingBg[rt];

  const strokeColor = upProb >= 60 ? '#cf1322' : upProb >= 40 ? '#faad14' : '#3cb371';

  return (
    <Card
      size="small"
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>📋 今日收盘点评</span>
        <Tag color={rt === 'strong_bull' || rt === 'bull' ? 'red' : rt === 'strong_bear' || rt === 'bear' ? 'green' : 'default'}>
          {ratingLabel}
        </Tag>
      </span>}
      style={{ borderRadius: 8, marginBottom: 16, border: `1px solid ${color}40`, background: bg }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        {/* 概率圆环 */}
        <div style={{ textAlign: 'center' }}>
          <Progress
            type="circle"
            percent={upProb}
            size={72}
            strokeColor={strokeColor}
            format={pct => <span style={{ fontSize: 20, fontWeight: 700, color: strokeColor }}>{pct}%</span>}
          />
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>明日看涨概率</div>
        </div>

        {/* 综合评分 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color }}>{score > 0 ? '+' : ''}{score}</div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>综合评分</div>
        </div>

        {/* 总结 */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <Text strong style={{ fontSize: 14 }}>{summary}</Text>
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {details.map(d => (
              <Tag key={d.name} color={d.status === 'good' ? 'red' : d.status === 'bad' ? 'green' : 'default'} style={{ fontSize: 11 }}>
                {d.name} {d.score > 0 ? '+' : ''}{d.score}
              </Tag>
            ))}
          </div>
        </div>
      </div>

      {/* 指标详情条 */}
      <div style={{ background: '#fafafa', borderRadius: 6, padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {details.map(d => {
          const pct = Math.min(100, Math.abs(d.score) / d.maxScore * 100);
          return (
            <div key={d.name} style={{ flex: 1, minWidth: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>{d.name}</div>
              <div style={{
                height: 4, borderRadius: 2, background: '#eee',
                overflow: 'hidden', marginBottom: 2,
              }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: d.score > 0 ? '#cf1322' : '#3cb371',
                  borderRadius: 2,
                }} />
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: d.score > 0 ? '#cf1322' : d.score < 0 ? '#3cb371' : '#999' }}>
                {d.score > 0 ? '+' : ''}{d.score}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
