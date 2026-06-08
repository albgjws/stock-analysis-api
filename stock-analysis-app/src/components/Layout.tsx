import React, { useState, useEffect, useCallback } from 'react';
import { Layout as AntLayout, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { LineChartOutlined } from '@ant-design/icons';
import BackToTop from './BackToTop';
import { getMarketIndices } from '../api/stockApi';

const { Header, Content, Footer } = AntLayout;
const { Title } = Typography;

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [indices, setIndices] = useState<any[] | null>(null);

  function isMarketOpen(): boolean {
    const d = new Date();
    const h = d.getHours(), m = d.getMinutes();
    if (d.getDay() === 0 || d.getDay() === 6) return false;
    const t = h * 100 + m;
    return (t >= 930 && t < 1130) || (t >= 1300 && t < 1500);
  }

  const fetchIdx = useCallback(() => {
    if (!isMarketOpen()) return;
    getMarketIndices().then(setIndices).catch(() => {});
  }, []);

  useEffect(() => {
    fetchIdx();
    const timer = setInterval(fetchIdx, 30000);
    return () => clearInterval(timer);
  }, [fetchIdx]);

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <LineChartOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0, color: '#1677ff' }}>
            A股分析工具
          </Title>
        </Link>

        {/* 大盘指数 */}
        {indices && indices.length > 0 && (
          <div style={{
            display: 'flex', gap: 12, marginLeft: 'auto',
            alignItems: 'center', overflowX: 'auto',
          }}>
            {indices.map((idx: any) => {
              const isUp = idx.change >= 0;
              const clr = isUp ? '#cf1322' : '#3cb371';
              return (
                <div key={idx.code} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 11, color: '#999', marginRight: 4 }}>{idx.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: clr }}>{idx.price.toFixed(2)}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: clr, marginLeft: 3 }}>
                    {idx.changePercent > 0 ? '+' : ''}{idx.changePercent.toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Header>

      <Content
        style={{
          padding: '24px 24px 0',
          maxWidth: 1400,
          width: '100%',
          margin: '0 auto',
        }}
      >
        {children}
      </Content>

      <Footer
        style={{
          textAlign: 'center',
          color: '#999',
          fontSize: 12,
          padding: '16px 24px',
        }}
      >
        ⚠️ 本工具仅供学习参考，所有分析结果不构成投资建议。投资有风险，入市需谨慎。
      </Footer>
      <BackToTop />
    </AntLayout>
  );
}
