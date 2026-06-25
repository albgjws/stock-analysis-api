import React from 'react';
import { Tag, Space } from 'antd';
import {
  ThunderboltOutlined,
  RiseOutlined,
  MinusOutlined,
  FallOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { SignalResult } from '../types';

interface PositionAdviceProps {
  signals: SignalResult;
  score?: number;
}

export default function PositionAdvice({ signals, score }: PositionAdviceProps) {
  const isBuy = signals.overall === 'STRONG_BUY' || signals.overall === 'BUY';
  const isSell = signals.overall === 'STRONG_SELL' || signals.overall === 'SELL';
  const isStrong = signals.overall === 'STRONG_BUY' || signals.overall === 'STRONG_SELL';

  // 多空评分
  const bullBear = signals.strength;

  let label: string;
  let color: string;
  let icon: React.ReactNode;
  let tip: string;

  if (signals.overall === 'STRONG_BUY') {
    label = '强烈建仓';
    color = '#cf1322';
    icon = <ThunderboltOutlined />;
    tip = '技术面全面偏多，是较好的建仓时机';
  } else if (signals.overall === 'BUY') {
    label = '建议建仓';
    color = '#cf1322';
    icon = <RiseOutlined />;
    tip = '多项指标发出买入信号，可分批建仓';
  } else if (signals.overall === 'HOLD') {
    label = '观望为主';
    color = '#faad14';
    icon = <MinusOutlined />;
    tip = '多空信号均衡，建议观望或轻仓持有';
  } else if (signals.overall === 'SELL') {
    label = '减仓观望';
    color = '#3cb371';
    icon = <FallOutlined />;
    tip = '技术面转弱，建议减仓控制风险';
  } else {
    label = '清仓离场';
    color = '#3cb371';
    icon = <WarningOutlined />;
    tip = '技术面全面恶化，建议清仓规避风险';
  }

  return (
    <Space size="small" style={{ display: 'flex', alignItems: 'center' }}>
      <Tag
        icon={icon}
        color={color}
        style={{
          fontSize: 14,
          fontWeight: 700,
          padding: '3px 12px',
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
        }}
        title={tip}
      >
        {label}
      </Tag>
      <span style={{ fontSize: 12, color: '#999' }}>
        强度: <b style={{ color: bullBear > 0 ? '#cf1322' : bullBear < 0 ? '#3cb371' : '#faad14' }}>
          {bullBear > 0 ? '+' : ''}{bullBear}
        </b>
      </span>
      {score != null && (
        <span style={{ fontSize: 12, color: '#999' }}>
          评分: <b>{score}/100</b>
        </span>
      )}
    </Space>
  );
}
