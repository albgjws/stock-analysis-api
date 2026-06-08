import { useState, useEffect, useCallback } from 'react';
import { getAnalysis, searchStocks, ApiError, NotFoundError } from '../api/stockApi';
import type { AnalysisResponse, SearchResult } from '../types';

interface UseAnalysisResult {
  data: AnalysisResponse | null;
  loading: boolean;
  error: string | null;
  isNotFound: boolean;
  retry: () => void;
}

export function useStockAnalysis(code: string | undefined): UseAnalysisResult {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setRetryCount(c => c + 1);
    setError(null);
    setIsNotFound(false);
  }, []);

  useEffect(() => {
    if (!code) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setIsNotFound(false);

      try {
        const result = await getAnalysis(code, { count: 200, predictDays: 10 });
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof NotFoundError) {
          setIsNotFound(true);
          setError(`未找到股票代码: ${code}`);
        } else if (err instanceof ApiError) {
          setError('数据加载失败，请稍后重试');
        } else {
          setError('网络连接失败，请检查网络后重试');
        }
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [code, retryCount]);

  return { data, loading, error, isNotFound, retry };
}

interface UseSearchResult {
  results: SearchResult[];
  loading: boolean;
  search: (query: string) => void;
}

export function useStockSearch(): UseSearchResult {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (timer) clearTimeout(timer);

    if (!query || query.trim().length < 1) {
      setResults([]);
      return;
    }

    const newTimer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchStocks(query.trim());
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    setTimer(newTimer);
  }, [timer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [timer]);

  return { results, loading, search };
}
