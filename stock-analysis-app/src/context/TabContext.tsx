import React, { createContext, useContext, useState, useCallback } from 'react';

export interface StockTab {
  code: string;
  name: string;
}

export interface TabQuote {
  price: number;
  changePercent: number;
}

interface TabContextValue {
  tabs: StockTab[];
  activeKey: string;
  addTab: (code: string, name: string) => void;
  removeTab: (code: string) => void;
  switchTab: (code: string) => void;
  moveTab: (fromIndex: number, toIndex: number) => void;
  isActive: (code: string) => boolean;
  quoteMap: Record<string, TabQuote>;
  updateQuote: (code: string, quote: TabQuote) => void;
}

const TabContext = createContext<TabContextValue>(null!);

export function TabProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<StockTab[]>([]);
  const [activeKey, setActiveKey] = useState<string>('home');
  const [quoteMap, setQuoteMap] = useState<Record<string, TabQuote>>({});

  const updateQuote = useCallback((code: string, quote: TabQuote) => {
    setQuoteMap(prev => ({ ...prev, [code]: quote }));
  }, []);

  const addTab = useCallback((code: string, name: string) => {
    setTabs(prev => {
      if (prev.some(t => t.code === code)) {
        setActiveKey(code);
        return prev;
      }
      setActiveKey(code);
      return [...prev, { code, name }];
    });
  }, []);

  const removeTab = useCallback((code: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.code === code);
      const newTabs = prev.filter(t => t.code !== code);
      if (activeKey === code) {
        if (newTabs.length === 0) setActiveKey('home');
        else if (idx > 0) setActiveKey(newTabs[idx - 1].code);
        else setActiveKey(newTabs[0].code);
      }
      return newTabs;
    });
  }, [activeKey]);

  const switchTab = useCallback((key: string) => {
    setActiveKey(key);
  }, []);

  const isActive = useCallback((code: string) => activeKey === code, [activeKey]);

  const moveTab = useCallback((fromIndex: number, toIndex: number) => {
    setTabs(prev => {
      if (fromIndex === toIndex) return prev;
      const newTabs = [...prev];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      return newTabs;
    });
  }, []);

  return (
    <TabContext.Provider value={{ tabs, activeKey, addTab, removeTab, switchTab, moveTab, isActive, quoteMap, updateQuote }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabContext() {
  return useContext(TabContext);
}
