import React, { useState, useRef, useCallback } from 'react';
import { AutoComplete, Input } from 'antd';
import { SearchOutlined, HistoryOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { searchStocks } from '../api/stockApi';
import type { SearchResult } from '../types';

const HISTORY_KEY = 'stock_search_history';
const MAX_HISTORY = 20;

interface HistoryItem {
  code: string;
  name: string;
  market: string;
  time: number;
}

interface OptionData {
  value: string;
  name: string;
  market: string;
}

function loadHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function addToHistory(code: string, name: string, market: string) {
  let list = loadHistory().filter(h => h.code !== code);
  list.unshift({ code, name, market, time: Date.now() });
  if (list.length > MAX_HISTORY) list = list.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function removeFromHistory(code: string) {
  const list = loadHistory().filter(h => h.code !== code);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

interface SearchBarProps {
  size?: 'large' | 'middle' | 'small';
  placeholder?: string;
  onSelect?: (code: string, name: string) => void;
}

export default function SearchBar({
  size = 'large',
  placeholder = '输入股票代码或名称搜索（如：600519、茅台）',
  onSelect,
}: SearchBarProps) {
  const [options, setOptions] = useState<OptionData[]>([]);
  const [searching, setSearching] = useState(false);
  const [isHistory, setIsHistory] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const doSelect = useCallback((code: string, name: string, market: string) => {
    addToHistory(code, name, market);
    setInputValue(`${name} (${code})`);
    if (onSelect) onSelect(code, name);
    else navigate(`/stock/${code}`);
    setOptions([]);
    setIsHistory(false);
  }, [onSelect, navigate]);

  const showHistory = useCallback(() => {
    const history = loadHistory();
    if (history.length === 0) { setOptions([]); setIsHistory(false); return; }
    setIsHistory(true);
    setOptions(history.map(h => ({ value: h.code, name: h.name, market: h.market })));
  }, []);

  const handleFocus = () => {
    if (!inputValue) showHistory();
  };

  const handleSearch = (value: string) => {
    setInputValue(value);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!value.trim()) {
      showHistory();
      return;
    }

    setIsHistory(false);
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchStocks(value.trim());
        setOptions(results.map((item: SearchResult) => ({
          value: item.code, name: item.name, market: item.market,
        })));
      } catch {
        setOptions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleSelect = (value: string | undefined) => {
    if (!value) return;
    const opt = options.find(o => o.value === value);
    if (!opt) return;
    doSelect(opt.value, opt.name, opt.market);
  };

  return (
    <AutoComplete
      value={inputValue}
      onChange={handleSearch}
      filterOption={false}
      options={options.map(o => ({
        value: o.value,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ flex: 1 }}>
              {isHistory ? (
                <ClockCircleOutlined style={{ marginRight: 8, fontSize: 12, color: '#bbb' }} />
              ) : (
                <SearchOutlined style={{ marginRight: 8, fontSize: 12, color: '#1677ff' }} />
              )}
              <strong>{o.name}</strong>
              <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>{o.value}</span>
              <span style={{ marginLeft: 8, color: '#bbb', fontSize: 11, background: '#f5f5f5', padding: '0 5px', borderRadius: 3 }}>
                {o.market.toUpperCase()}
              </span>
            </span>
            {isHistory && (
              <span
                style={{ cursor: 'pointer', color: '#ccc', fontSize: 14, padding: '0 4px', lineHeight: '20px', borderRadius: 3 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4d4f')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#ccc')}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); removeFromHistory(o.value); showHistory(); }}
              >
                ✕
              </span>
            )}
          </div>
        ),
      }))}
      onSelect={handleSelect}
      onFocus={handleFocus}
      onBlur={() => setTimeout(() => setIsHistory(false), 200)}
      style={{ width: '100%' }}
      notFoundContent={
        <div style={{ textAlign: 'center', padding: 8, color: '#999', fontSize: 12 }}>
          {searching ? '搜索中...' : isHistory ? '暂无历史记录' : '输入股票名称或代码搜索'}
        </div>
      }
      popupRender={(menu) => (
        <div>
          {isHistory && options.length > 0 && (
            <div style={{
              padding: '5px 12px 3px', fontSize: 11, color: '#999',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid #f0f0f0',
            }}>
              <span><HistoryOutlined style={{ marginRight: 4 }} />最近搜索</span>
              <span
                style={{ cursor: 'pointer', color: '#999' }}
                onClick={(e) => { e.stopPropagation(); clearHistory(); setOptions([]); setIsHistory(false); }}
              >
                清空
              </span>
            </div>
          )}
          {menu}
          {!isHistory && options.length > 0 && (
            <div style={{ padding: '4px 12px', fontSize: 11, color: '#bbb', borderTop: '1px solid #f0f0f0', textAlign: 'right' }}>
              回车选中第一条
            </div>
          )}
        </div>
      )}
    >
      <Input
        size={size}
        placeholder={placeholder}
        prefix={<SearchOutlined />}
        allowClear
        onPressEnter={(e) => {
          e.preventDefault();
          if (options.length === 0) return;
          const item = options[0];
          doSelect(item.value, item.name, item.market);
        }}
      />
    </AutoComplete>
  );
}
