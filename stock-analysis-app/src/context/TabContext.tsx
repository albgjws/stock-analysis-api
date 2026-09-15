import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

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

/** 标签页持久化 key（增删/排序/切换都会写入 localStorage，刷新后恢复） */
const STORAGE_KEY = 'stock-analysis:tabs:v1';

interface PersistedState {
  tabs: StockTab[];
  activeKey: string;
}

/** 从 localStorage 读取上次的标签状态，做健壮性校验 */
function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tabs: [], activeKey: 'home' };
    const parsed = JSON.parse(raw);
    const tabs: StockTab[] = Array.isArray(parsed?.tabs)
      ? parsed.tabs.filter(
          (t: any) => t && typeof t.code === 'string' && typeof t.name === 'string'
        )
      : [];
    let activeKey: string =
      typeof parsed?.activeKey === 'string' ? parsed.activeKey : 'home';
    // activeKey 必须仍然有效，否则回退
    if (activeKey !== 'home' && !tabs.some(t => t.code === activeKey)) {
      activeKey = tabs.length > 0 ? tabs[0].code : 'home';
    }
    return { tabs, activeKey };
  } catch {
    return { tabs: [], activeKey: 'home' };
  }
}

export function TabProvider({ children }: { children: React.ReactNode }) {
  const [initial] = useState(loadPersistedState);
  const [tabs, setTabs] = useState<StockTab[]>(initial.tabs);
  const [activeKey, setActiveKey] = useState<string>(initial.activeKey);
  const [quoteMap, setQuoteMap] = useState<Record<string, TabQuote>>({});

  // 标签增删、排序、切换时持久化（quoteMap 不持久化，实时行情会自行刷新）
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeKey }));
    } catch {}
  }, [tabs, activeKey]);

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
