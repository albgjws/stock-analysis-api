import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Space, Tag } from 'antd';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { useStockAnalysis } from '../hooks/useStockData';
import { useTabContext } from '../context/TabContext';
import { usePolling } from '../hooks/usePolling';
import { getIntraday, getFundFlow, getQuote } from '../api/stockApi';
import { LoadingSpinner, ErrorState, EmptyState } from '../components/Loading';
import SearchBar from '../components/SearchBar';
import StockOverview from '../components/StockOverview';
import IntradayChart from '../components/IntradayChart';
import KlineChart from '../components/KlineChart';
import IndicatorCharts from '../components/IndicatorCharts';
import PredictionChart from '../components/PredictionChart';
import SignalPanel from '../components/SignalPanel';
import PurchaseAnalysis from '../components/PurchaseAnalysis';
import MarketRecap from '../components/MarketRecap';
import AdvancedSignalLegend from '../components/AdvancedSignalLegend';
import PositionAdvice from '../components/PositionAdvice';
import BacktestReport from '../components/BacktestReport';
import { generateMarketRecap } from '../utils/marketRecap';
import { calcAllAdvancedSignals, calcLimitPrediction } from '../utils/advancedIndicators';
import type { MarketRecapResult } from '../utils/marketRecap';
import type { AdvancedSignals, LimitPrediction as LimitPredictionResult } from '../utils/advancedIndicators';
import LimitPredictionBanner from '../components/LimitPredictionBanner';
import Level5Panel from '../components/Level5Panel';

interface AnalysisPageProps {
  code?: string;
  isActive?: boolean;
}

export default function AnalysisPage({ code: propCode, isActive: propIsActive }: AnalysisPageProps) {
  const { code: paramCode } = useParams<{ code: string }>();
  const code = propCode || paramCode;
  const isActive = propIsActive ?? true;
  const { addTab } = useTabContext();

  const { data, loading, error, isNotFound, retry } = useStockAnalysis(code);

  // 分时图数据 + 自动轮询
  const [intraday, setIntraday] = useState<any>(null);
  const [intradayLoading, setIntradayLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  // 资金流向
  const [fundFlow, setFundFlow] = useState<any[] | null>(null);

  // 实时行情（用于更新涨跌幅）
  const [liveQuote, setLiveQuote] = useState<any>(null);

  // 专业指标显示开关
  const [showAdvanced, setShowAdvanced] = useState(true);

  const fetchIntraday = useCallback(async () => {
    if (!code) return;
    try {
      const data = await getIntraday(code);
      setIntraday(data);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch {
      // 静默失败，保留旧数据
    }
  }, [code]);

  const fetchFundFlow = useCallback(async () => {
    if (!code) return;
    try {
      const data = await getFundFlow(code, 60);
      setFundFlow(data);
    } catch {
      // 静默失败
    }
  }, [code]);

  const fetchQuote = useCallback(async () => {
    if (!code) return;
    try {
      const data = await getQuote(code);
      setLiveQuote(data);
    } catch {
      // 静默失败
    }
  }, [code]);

  // 统一刷新：同时更新分析数据、行情、分时、资金流向
  const handleRefresh = useCallback(() => {
    setLastRefresh(new Date().toLocaleTimeString());
    retry();
    fetchQuote();
    fetchIntraday();
    fetchFundFlow();
  }, [retry, fetchQuote, fetchIntraday, fetchFundFlow]);

  // 首次加载
  useEffect(() => {
    if (!code) return;
    setIntraday(null);
    setIntradayLoading(true);
    Promise.all([
      getIntraday(code).then(setIntraday).catch(() => null),
      getFundFlow(code, 60).then(setFundFlow).catch(() => null),
      getQuote(code).then(setLiveQuote).catch(() => null),
    ]).finally(() => {
      setIntradayLoading(false);
      setLastRefresh(new Date().toLocaleTimeString());
    });
  }, [code]);

  // 自动轮询：盘中实时分析频率更高，非交易时段不轮询行情
  usePolling(fetchIntraday, isActive && !!code ? 15000 : null, isActive, true);
  usePolling(fetchFundFlow, isActive && !!code ? 60000 : null, isActive, false);
  usePolling(fetchQuote, isActive && !!code ? 5000 : null, isActive, true);

  // 合并实时行情数据（用于价格/涨跌幅实时更新）
  // 注意：必须放在所有早期 return 之前（React Hook 规则不能条件性调用）
  const liveInfo = useMemo(() => {
    if (!data || !liveQuote) return data?.info ?? (null as any);
    return {
      ...data.info,
      price: liveQuote.price ?? data.info.price,
      change: liveQuote.change ?? data.info.change,
      changePercent: liveQuote.changePercent ?? data.info.changePercent,
      high: liveQuote.high ?? data.info.high,
      low: liveQuote.low ?? data.info.low,
      open: liveQuote.open ?? data.info.open,
      prevClose: liveQuote.prevClose ?? data.info.prevClose,
      volume: liveQuote.volume ?? data.info.volume,
      amount: liveQuote.amount ?? data.info.amount,
      marketCap: liveQuote.marketCap ?? data.info.marketCap,
      turnoverRate: liveQuote.turnoverRate ?? data.info.turnoverRate,
    };
  }, [data, liveQuote]);

  // 生成复盘报告
  const recap: MarketRecapResult | null = useMemo(() => {
    if (!data) return null;
    return generateMarketRecap(
      liveInfo || data.info,
      data.kline,
      data.signals,
      data.prediction,
      intraday,
      lastRefresh,
    );
  }, [data, intraday, lastRefresh, liveInfo]);

  // 计算专业指标
  const advancedSignals: AdvancedSignals | null = useMemo(() => {
    if (!data) return null;
    return calcAllAdvancedSignals(data.kline);
  }, [data]);

  // 涨停/跌停连板预测
  const limitPrediction: LimitPredictionResult | null = useMemo(() => {
    if (!data || !data.kline || data.kline.length < 5) return null;
    return calcLimitPrediction(data.kline, liveInfo || data.info);
  }, [data, liveInfo]);

  // 当没有显示检查时
  if (!data) {
    if (!code) {
      return (
        <div>
          <EmptyState description="请选择一只股票" />
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <SearchBar onSelect={addTab} />
          </div>
        </div>
      );
    }
    if (loading) {
      return <LoadingSpinner tip="正在加载股票数据..." />;
    }
    if (error) {
      return (
        <div>
          {isNotFound ? (
            <div>
              <EmptyState description={`未找到股票代码: ${code}`} />
              <div style={{ maxWidth: 500, margin: '0 auto' }}>
                <SearchBar onSelect={addTab} placeholder="尝试搜索其他股票..." />
              </div>
            </div>
          ) : (
            <ErrorState message={error} onRetry={retry} />
          )}
        </div>
      );
    }
    return <LoadingSpinner tip="准备中..." />;
  }

  const { info, kline, prediction, signals } = data;
  const warning = (data as any).warning || '';
  const hasKline = kline && kline.length > 0;
  const recentKline = hasKline ? kline.slice(-120) : [];

  return (
    <div>
      {/* 顶部导航 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space wrap>
          <SearchBar size="middle" placeholder="添加更多股票..." onSelect={addTab} />
        </Space>
        <Space size="small">
          {lastRefresh && (
            <Tag color="blue" style={{ fontSize: 11 }}>
              🕐 {lastRefresh}
            </Tag>
          )}
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} size="small">
            刷新
          </Button>
        </Space>
      </div>

      {/* 建仓建议 */}
      <div style={{ marginBottom: 8 }}>
        <PositionAdvice signals={signals} />
      </div>

      {/* 数据源警告 */}
      {warning && (
        <div style={{ marginBottom: 12, padding: '8px 16px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, fontSize: 13, color: '#d48806' }}>
          ⚠️ {warning}
        </div>
      )}

      {/* 股票概览 */}
      <StockOverview info={liveInfo} />

      {/* 分时图 + 五档盘口 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <IntradayChart
            data={intraday}
            loading={intradayLoading}
            signals={signals}
            lastRefresh={lastRefresh}
          />
        </div>
        <div style={{ width: 220, flexShrink: 0 }}>
          <Level5Panel
            bid={liveQuote?.bid || (data as any)?.info?.bid}
            ask={liveQuote?.ask || (data as any)?.info?.ask}
            price={liveInfo?.price}
            changePercent={liveInfo?.changePercent}
          />
        </div>
      </div>

      {/* K线图 — 仅当有K线数据时显示 */}
      {hasKline ? (
        <KlineChart
          data={kline}
          loading={loading}
          signals={signals}
          advancedSignals={advancedSignals}
          fundFlow={fundFlow}
          showAdvanced={showAdvanced}
          onToggleAdvanced={setShowAdvanced}
        />
      ) : (
        <div style={{ padding: 24, textAlign: 'center', color: '#999', background: '#fafafa', borderRadius: 8, marginBottom: 16 }}>
          📊 日K线数据暂不可用，无法显示技术图表和信号分析
        </div>
      )}

      {/* 专业指标说明 — 仅当有K线时 */}
      {hasKline && showAdvanced && <AdvancedSignalLegend />}

      {/* 技术指标 — 仅当有K线时 */}
      {hasKline && <IndicatorCharts data={recentKline} />}

      {/* 涨停/跌停连板预测 */}
      {limitPrediction && <LimitPredictionBanner prediction={limitPrediction} />}

      {/* 当日复盘 */}
      <MarketRecap recap={recap!} loading={loading || intradayLoading} />

      {/* 预测 — 仅当有K线时 */}
      {hasKline && <PredictionChart kline={kline} prediction={prediction} loading={loading} />}

      {/* 买入诊断 */}
      <PurchaseAnalysis key={info.code} stockCode={info.code} stockName={info.name} />

      {/* 买卖信号 — 仅当有K线时 */}
      {hasKline && <SignalPanel signals={signals} />}
    </div>
  );
}
