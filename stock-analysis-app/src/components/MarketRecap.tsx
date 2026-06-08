import React from 'react';
import { Card, Collapse, Typography } from 'antd';
import {
  RiseOutlined,
  FallOutlined,
  ExperimentOutlined,
  BulbOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { MarketRecapResult, RecapSection } from '../utils/marketRecap';

const { Text } = Typography;

interface MarketRecapProps {
  recap: MarketRecapResult;
  loading?: boolean;
}

function SectionIcon({ type }: { type?: string }) {
  switch (type) {
    case 'positive': return <RiseOutlined style={{ color: '#cf1322' }} />;
    case 'negative': return <FallOutlined style={{ color: '#3cb371' }} />;
    case 'warning': return <ToolOutlined style={{ color: '#faad14' }} />;
    default: return <ExperimentOutlined style={{ color: '#1677ff' }} />;
  }
}

function SectionContent({ section }: { section: RecapSection }) {
  return (
    <div style={{ lineHeight: 2.2 }}>
      {section.content.map((line, i) => {
        // 给特定关键词加颜色
        let coloredLine = line;
        const isPositive = line.includes('买入') || line.includes('多头') || line.includes('反弹')
          || line.includes('看涨') || line.includes('乐观') || line.includes('资金加速');
        const isNegative = line.includes('卖出') || line.includes('空头') || line.includes('回调')
          || line.includes('看跌') || line.includes('谨慎') || line.includes('抛压');
        const isWarning = line.includes('⚠️') || line.includes('风险') || line.includes('谨慎');

        return (
          <div
            key={i}
            style={{
              padding: '4px 0',
              color: isWarning ? '#d48806' : isNegative ? '#3cb371' : isPositive ? '#cf1322' : '#333',
              fontSize: 14,
            }}
          >
            <BulbOutlined style={{ marginRight: 8, fontSize: 12, opacity: 0.5 }} />
            {coloredLine}
          </div>
        );
      })}
    </div>
  );
}

export default function MarketRecap({ recap, loading }: MarketRecapProps) {
  if (loading) {
    return (
      <Card
        title={<span>📊 当日专业复盘</span>}
        style={{ borderRadius: 8, marginBottom: 16 }}
      >
        <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
          正在生成复盘报告...
        </div>
      </Card>
    );
  }

  if (!recap) return null;

  const collapseItems = [
    // 实时分析/盘后回顾放在最前面
    ...(recap.realtime ? [{
      key: 'realtime',
      label: (
        <span style={{ fontWeight: 600, fontSize: 15 }}>
          {recap.realtime.icon} {recap.realtime.title}
        </span>
      ),
      children: <SectionContent section={recap.realtime} />,
    }] : []),
    {
      key: 'summary',
      label: (
        <span style={{ fontWeight: 600, fontSize: 15 }}>
          {recap.summary.icon} {recap.summary.title}
        </span>
      ),
      children: <SectionContent section={recap.summary} />,
    },
    {
      key: 'technical',
      label: (
        <span style={{ fontWeight: 600, fontSize: 15 }}>
          {recap.technical.icon} {recap.technical.title}
        </span>
      ),
      children: <SectionContent section={recap.technical} />,
    },
    {
      key: 'operation',
      label: (
        <span style={{ fontWeight: 600, fontSize: 15 }}>
          {recap.operation.icon} {recap.operation.title}
        </span>
      ),
      children: <SectionContent section={recap.operation} />,
    },
    {
      key: 'outlook',
      label: (
        <span style={{ fontWeight: 600, fontSize: 15 }}>
          {recap.outlook.icon} {recap.outlook.title}
        </span>
      ),
      children: <SectionContent section={recap.outlook} />,
    },
  ];

  return (
    <Card
      title={
        <span style={{ fontSize: 16, fontWeight: 'bold' }}>
          📊 当日专业复盘
        </span>
      }
      style={{
        borderRadius: 8,
        marginBottom: 16,
        border: '1px solid #e8e8e8',
      }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <Collapse
        items={collapseItems}
        defaultActiveKey={['realtime', 'summary', 'operation']}
        expandIconPosition="end"
        style={{
          background: 'transparent',
          border: 'none',
        }}
        size="small"
      />
    </Card>
  );
}
