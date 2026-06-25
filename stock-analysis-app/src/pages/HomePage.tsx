import React from 'react';
import { Typography, Card, Button } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';

const { Title, Paragraph } = Typography;

interface HomePageProps {
  onAddTab?: (code: string, name: string) => void;
}

export default function HomePage({ onAddTab }: HomePageProps) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '70vh',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 720,
          textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          borderRadius: 12,
          border: 'none',
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <Title level={2} style={{ color: '#1677ff', marginBottom: 8 }}>
            股票分析工具
          </Title>
          <Paragraph type="secondary" style={{ fontSize: 16, marginBottom: 4 }}>
            输入股票代码或名称，获取技术分析、趋势预测和买卖信号
          </Paragraph>
          <Paragraph type="secondary" style={{ fontSize: 13 }}>
            支持多标签页同时查看多只个股
          </Paragraph>
        </div>

        <div style={{ marginBottom: 40 }}>
          <SearchBar size="large" onSelect={onAddTab} />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 16,
            marginTop: 16,
          }}
        >
          <FeatureCard
            icon="📊"
            title="技术指标"
            desc="MA / MACD / RSI / KDJ / 布林带"
          />
          <FeatureCard
            icon="🔮"
            title="趋势预测"
            desc="ARIMA 模型预测未来走势"
          />
          <FeatureCard
            icon="💡"
            title="买卖信号"
            desc="多指标综合评分系统"
          />
          <FeatureCard
            icon="📈"
            title="K线图表"
            desc="交互式专业图表展示"
          />
        </div>
        <div style={{ marginTop: 24, color: '#999', fontSize: 13 }}>
          💡 搜索股票后将自动添加到标签页，可同时查看多只个股
        </div>
        <div style={{ marginTop: 16 }}>
          <Button type="link" icon={<BarChartOutlined />} onClick={() => navigate('/stats')}>
            查看预测模型汇总统计
          </Button>
        </div>
      </Card>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <Card
      size="small"
      style={{
        borderRadius: 8,
        background: '#fafafa',
        border: '1px solid #f0f0f0',
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#999' }}>{desc}</div>
    </Card>
  );
}
