import React from 'react';
import { Card, Tag, Progress, Space, Typography } from 'antd';
import { FireOutlined, ThunderboltOutlined, WarningOutlined } from '@ant-design/icons';
import type { LimitPrediction } from '../utils/advancedIndicators';

const { Text } = Typography;

interface LimitPredictProps {
  prediction: LimitPrediction;
}

export default function LimitPredictionBanner({ prediction }: LimitPredictProps) {
  const { isLimitUp, isLimitDown, consecutiveCount, nextDayProb, nextDayTrend, analysis, factors } = prediction;
  const isBull = isLimitUp;

  const bgColor = isLimitUp
    ? 'linear-gradient(135deg, #fff2f0, #fff7e6)'
    : 'linear-gradient(135deg, #f6ffed, #e6fffb)';

  const borderColor = isLimitUp ? '#ff4d4f' : '#52c41a';
  const iconColor = isLimitUp ? '#cf1322' : '#3cb371';

  const probColor = nextDayProb >= 60 ? (isLimitUp ? '#cf1322' : '#3cb371')
    : nextDayProb >= 40 ? '#faad14'
    : '#999';

  // 颜色：概率越高，红色越深（涨停）或绿色越深（跌停）
  const strokeColor = isLimitUp
    ? { '0%': '#ffa39e', '100%': '#cf1322' }
    : { '0%': '#b7eb8f', '100%': '#3cb371' };

  return (
    <Card
      size="small"
      style={{
        borderRadius: 8, marginBottom: 16,
        background: bgColor, border: `1px solid ${borderColor}40`,
      }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        {/* 左侧：状态 + 连板数 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isLimitUp ? (
            <FireOutlined style={{ fontSize: 28, color: iconColor }} />
          ) : (
            <WarningOutlined style={{ fontSize: 28, color: iconColor }} />
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag color={isLimitUp ? 'red' : 'green'} style={{ fontSize: 14, padding: '2px 10px', fontWeight: 600 }}>
                {isLimitUp ? '🚀 涨停' : '💥 跌停'}
              </Tag>
              <Tag color={isLimitUp ? 'volcano' : 'cyan'} style={{ fontSize: 13 }}>
                {consecutiveCount}连{isLimitUp ? '板' : '跌'}
              </Tag>
              {consecutiveCount >= 3 && (
                <Tag color="purple" style={{ fontSize: 12 }}>
                  <ThunderboltOutlined /> 高位警示
                </Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 2, display: 'block' }}>
              {analysis}
            </Text>
          </div>
        </div>

        {/* 右侧：连板概率 */}
        <div style={{ textAlign: 'center', minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>
            明{isLimitUp ? '日连板' : '继续跌停'}概率
          </div>
          <Progress
            type="circle"
            percent={nextDayProb}
            size={60}
            strokeColor={strokeColor}
            format={pct => <span style={{ fontSize: 16, fontWeight: 700, color: probColor }}>{pct}%</span>}
          />
        </div>
      </div>

      {/* 影响因子 */}
      {factors.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e8e8e8' }}>
          <Space size={[4, 4]} wrap>
            {factors.map((f, i) => (
              <Tag key={i} color={isLimitUp ? 'red' : 'green'} style={{ fontSize: 11, borderRadius: 4 }}>
                {f}
              </Tag>
            ))}
          </Space>
        </div>
      )}
    </Card>
  );
}
