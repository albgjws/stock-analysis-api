import { useState, useCallback, useRef } from 'react';
import { Tabs } from 'antd';
import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/Layout';
import HomePage from './pages/HomePage';
import AnalysisPage from './pages/AnalysisPage';
import AggregateDashboard from './components/AggregateDashboard';
import { TabProvider, useTabContext } from './context/TabContext';

function AppContent() {
  const { tabs, activeKey, addTab, removeTab, switchTab, moveTab, quoteMap } = useTabContext();
  const dragRef = useRef<number | null>(null);

  const onEdit = (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => {
    if (action === 'remove') removeTab(targetKey as string);
  };

  // 如果没有标签就显示首页
  if (tabs.length === 0) {
    return (
      <AppLayout>
        <HomePage onAddTab={addTab} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Tabs
        activeKey={activeKey}
        onChange={switchTab}
        type="editable-card"
        onEdit={onEdit}
        hideAdd
        size="small"
        style={{ marginTop: -8 }}
        tabBarStyle={{ marginBottom: 12, userSelect: 'none' }}
        items={[
          {
            key: 'home',
            label: <span className="stock-tab">🏠 首页</span>,
            children: activeKey === 'home' ? <HomePage onAddTab={addTab} /> : null,
            closable: false,
          },
          ...tabs.map((tab, idx) => ({
            key: tab.code,
            label: (
              <span
                className="stock-tab"
                draggable
                onDragStart={(e) => {
                  dragRef.current = idx;
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragRef.current !== null && dragRef.current !== idx) {
                    moveTab(dragRef.current, idx);
                  }
                  dragRef.current = null;
                }}
                onDragEnd={() => { dragRef.current = null; }}
                style={{ cursor: 'grab' }}
              >
                <span style={{
                  display: 'inline-block', width: 6, height: 6,
                  borderRadius: '50%', background: '#52c41a',
                  marginRight: 4,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
                {tab.name}
                {quoteMap[tab.code] && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, marginLeft: 4,
                    color: (quoteMap[tab.code].changePercent || 0) >= 0 ? '#cf1322' : '#3cb371',
                  }}>
                    {(quoteMap[tab.code].changePercent || 0) >= 0 ? '+' : ''}{quoteMap[tab.code].changePercent.toFixed(2)}%
                  </span>
                )}
              </span>
            ),
            children: (
              <AnalysisPage
                code={tab.code}
                isActive={activeKey === tab.code}
              />
            ),
            closable: true,
          })),
        ]}
      />
    </AppLayout>
  );
}

export default function App() {
  return (
    <TabProvider>
      <Routes>
        <Route path="/stats" element={<AppLayout><AggregateDashboard /></AppLayout>} />
        <Route path="*" element={<AppContent />} />
      </Routes>
    </TabProvider>
  );
}
