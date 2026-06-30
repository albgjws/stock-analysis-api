import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Space, Tag, Card } from 'antd';
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
import PredictionComparisonChart from '../components/PredictionComparisonChart';
import SignalBacktestCard from '../components/SignalBacktestCard';
import { generateMarketRecap } from '../utils/marketRecap';
import { calcAllAdvancedSignals, calcLimitPrediction, calcCloseRating } from '../utils/advancedIndicators';
import type { MarketRecapResult } from '../utils/marketRecap';
import type { AdvancedSignals, LimitPrediction as LimitPredictionResult, CloseRating as CloseRatingResult } from '../utils/advancedIndicators';
import LimitPredictionBanner from '../components/LimitPredictionBanner';
import Level5Panel from '../components/Level5Panel';


import CloseRatingCard from '../components/CloseRatingCard';
import QuantitativePanel from '../components/QuantitativePanel';

interface AnalysisPageProps {
  code?: string;
  isActive?: boolean;
}

export default function AnalysisPage({ code: propCode, isActive: propIsActive }: AnalysisPageProps) {
  const { code: paramCode } = useParams<{ code: string }>();
  const code = propCode || paramCode;
  const isActive = propIsActive ?? true;
  const { addTab, updateQuote } = useTabContext();

  const { data, loading, error, isNotFound, retry } = useStockAnalysis(code);

  // 分时图数据 + 自动轮询
  const [intraday, setIntraday] = useState<any>(null);
  const [intradayLoading, setIntradayLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  // 资金流向
  const [fundFlow, setFundFlow] = useState<any[] | null>(null);

  // 逐笔成交明细

  


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

  usePolling(fetchQuote, !!code ? 5000 : null, true, true);

  // 收盘后（15:01）自动刷新一次获取最终数据
  useEffect(() => {
    if (!code) return;
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();
    const time = h * 100 + m;
    // 只在交易时段（9:15-15:00）内才设定收盘定时器
    if (time < 915 || time >= 1505) return;

    const closeTime = new Date();
    closeTime.setHours(15, 1, 0, 0);
    const delay = closeTime.getTime() - now.getTime();
    if (delay <= 0) return;

    const timer = setTimeout(() => {
      console.log('[收盘刷新] 触发收盘数据刷新');
      fetchQuote();
      fetchIntraday();
      fetchFundFlow();

      setLastRefresh(new Date().toLocaleTimeString() + ' 收盘');
    }, delay);

    return () => clearTimeout(timer);
  }, [code, fetchQuote, fetchIntraday, fetchFundFlow]);

  // 午盘收盘（11:30）自动刷新一次
  useEffect(() => {
    if (!code) return;
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();
    const time = h * 100 + m;
    // 只在上午交易时段内设定11:30定时器
    if (time < 915 || time >= 1130) return;

    const noonTime = new Date();
    noonTime.setHours(11, 30, 10, 0); // 11:30:10
    const delay = noonTime.getTime() - now.getTime();
    if (delay <= 0) return;

    const timer = setTimeout(() => {
      console.log('[午盘刷新] 触发午盘收盘数据刷新');
      fetchQuote();
      fetchIntraday();
      fetchFundFlow();

      setLastRefresh(new Date().toLocaleTimeString() + ' 午盘');
    }, delay);

    return () => clearTimeout(timer);
  }, [code, fetchQuote, fetchIntraday, fetchFundFlow]);

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
      limitUp: liveQuote.limitUp ?? data.info.limitUp ?? null,
      limitDown: liveQuote.limitDown ?? data.info.limitDown ?? null,
      buy1Vol: liveQuote.buy1Vol ?? (data.info as any).buy1Vol ?? 0,
      sell1Vol: liveQuote.sell1Vol ?? (data.info as any).sell1Vol ?? 0,
    };
  }, [data, liveQuote]);

  // 推送实时报价到Tab标签（有实时数据用实时，没有用分析数据）
  useEffect(() => {
    if (!code) return;
    if (liveQuote?.price != null) {
      updateQuote(code, {
        price: liveQuote.price,
        changePercent: liveQuote.changePercent || 0,
      });
    } else if (data?.info?.price) {
      updateQuote(code, {
        price: data.info.price,
        changePercent: data.info.changePercent || 0,
      });
    }
  }, [code, liveQuote?.price, liveQuote?.changePercent, data?.info?.price, data?.info?.changePercent]);

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
    const enrichedInfo = {
      ...(liveInfo || data.info),
      sell1Vol: (liveQuote as any)?.sell1Vol || 0,
      buy1Vol: (liveQuote as any)?.buy1Vol || 0,
    };
    return calcLimitPrediction(data.kline, enrichedInfo, { intraday });
  }, [data, liveInfo, liveQuote, intraday]);

  // 收盘评分（明日看涨概率）
  const closeRating: CloseRatingResult | null = useMemo(() => {
    if (!data || !data.kline || data.kline.length < 20) return null;
    const raw = calcCloseRating(data.kline, fundFlow);
    if (!raw) return null;
    // 与综合信号方向对齐
    const sig = data.signals;
    const isSignalSell = sig?.overall === 'SELL' || sig?.overall === 'STRONG_SELL';
    const isSignalBuy = sig?.overall === 'BUY' || sig?.overall === 'STRONG_BUY';
    if (isSignalSell && (raw.rating === 'strong_bull' || raw.rating === 'bull')) {
      raw.rating = 'neutral';
      raw.ratingLabel = '中性（信号偏空）';
      raw.summary = '综合信号偏空，评分上修空间有限，注意风险';
      raw.score = Math.min(raw.score, 10);
      raw.upProb = Math.min(raw.upProb, 50);
    }
    if (isSignalBuy && (raw.rating === 'strong_bear' || raw.rating === 'bear')) {
      raw.rating = 'neutral';
      raw.ratingLabel = '中性（信号偏多）';
      raw.summary = '综合信号偏多，评分下修空间有限，谨慎看涨';
      raw.score = Math.max(raw.score, -10);
      raw.upProb = Math.max(raw.upProb, 50);
    }
    return raw;
  }, [data, fundFlow]);

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
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <IntradayChart
            data={intraday}
            loading={intradayLoading}
            signals={signals}
            lastRefresh={lastRefresh}
          />
        </div>
        <div style={{ width: 280 }}>
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
      {hasKline && <IndicatorCharts data={recentKline} fundFlow={fundFlow} />}

      {/* 筹码集中度 */}
      {fundFlow && fundFlow.length >= 5 && (
        <Card size="small" title="🎯 筹码集中度" style={{ borderRadius: 8, marginBottom: 16, border: '1px solid #d3adf7' }} styles={{ body: { padding: '10px 16px' } }}>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            {(() => {
              let cumSum = 0;
              const chipVals = fundFlow.map(f => {
                const big = (f.superLargeNetInflowPercent||0) + (f.largeNetInflowPercent||0);
                const small = (f.mediumNetInflowPercent||0) + (f.smallNetInflowPercent||0);
                cumSum += (big - small);
                return cumSum;
              });
              const chipNow = chipVals.length > 0 ? chipVals[chipVals.length-1] : 0;
              const chipPrev = chipVals.length > 5 ? chipVals[chipVals.length-5] : 0;
              const chipDiff = chipNow - chipPrev;
              // 趋势判断：相对于零轴的方向
              const chipIsPositive = chipNow >= 0;
              let trendText = '—';
              let trendClr = '#999';
              if (chipVals.length > 5) {
                if (chipIsPositive) {
                  // 正值区：上升=主力加仓，下降=主力减仓
                  trendText = chipDiff > 0 ? '加仓' : '减仓';
                  trendClr = chipDiff > 0 ? '#cf1322' : '#3cb371';
                } else {
                  // 负值区：上升=抛压缓解，下降=抛压加重
                  trendText = chipDiff > 0 ? '缓解' : '加重';
                  trendClr = chipDiff > 0 ? '#faad14' : '#3cb371';
                }
              }
              return (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: chipIsPositive ? '#cf1322' : '#3cb371' }}>{chipNow.toFixed(1)}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>当前集中度</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: trendClr }}>{trendText}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>近期趋势</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#999', maxWidth: 300 }}>
                    正集中=主力吸筹·负集中=主力发散·{chipIsPositive ? '加仓=持续吸筹' : '缓解=抛压减弱'} · 持续{chipNow < 0 ? '加重' : '减仓'}=注意风险
                  </div>
                </>
              );
            })()}
          </div>
        </Card>
      )}

      {/* 主力资金流总结 */}
      {fundFlow && fundFlow.length > 0 && (
        <Card size="small" title="💰 主力资金流" style={{ borderRadius: 8, marginBottom: 16, border: '1px solid #ffccc7' }} styles={{ body: { padding: '10px 16px' } }}>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            {(() => {
              const last = fundFlow[fundFlow.length - 1];
              const mainPct = last?.mainNetInflowPercent || 0;
              const isMainIn = mainPct > 0;
              // 最近5天主力净流入天数
              const last5 = fundFlow.slice(-5);
              const inDays = last5.filter((d: any) => (d.mainNetInflowPercent || 0) > 0).length;
              // 最近5天累计主力净占比
              const sum5 = last5.reduce((s: number, d: any) => s + (d.mainNetInflowPercent || 0), 0);
              // 文字总结
              let summary = '';
              if (isMainIn && inDays >= 3) summary = '主力连续净流入，资金积极做多';
              else if (isMainIn) summary = '主力今日净流入，关注持续性';
              else if (inDays <= 1 && sum5 < -2) summary = '主力持续流出，资金态度偏空';
              else if (inDays <= 1) summary = '主力近期以流出为主，谨慎观望';
              else summary = '主力进出交替，方向不明确';

              return (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: isMainIn ? '#cf1322' : '#3cb371' }}>
                      {mainPct > 0 ? '+' : ''}{mainPct.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: 11, color: '#999' }}>今日主力净占比</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: inDays >= 3 ? '#cf1322' : inDays <= 1 ? '#3cb371' : '#faad14' }}>
                      {inDays}/5天
                    </div>
                    <div style={{ fontSize: 11, color: '#999' }}>近5日净流入天数</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#333', marginBottom: 4 }}>{summary}</div>
                    <div style={{ fontSize: 11, color: '#999', lineHeight: 1.6 }}>
                      近5日累计净占比 <b style={{ color: sum5 >= 0 ? '#cf1322' : '#3cb371' }}>{sum5 > 0 ? '+' : ''}{sum5.toFixed(2)}%</b>
                      · {inDays >= 3 ? '✅ 多头主导' : inDays <= 1 ? '❌ 空头主导' : '⚪ 多空拉锯'}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </Card>
      )}

      {/* 涨停/跌停连板预测 */}
      {limitPrediction && <LimitPredictionBanner prediction={limitPrediction} />}

      {/* 当日复盘 */}
      <MarketRecap recap={recap!} loading={loading || intradayLoading} />

      {/* 收盘评分 */}
      {closeRating && <CloseRatingCard rating={closeRating} />}

      {/* 预测 — 仅当有K线时 */}
      {hasKline && <PredictionChart kline={kline} prediction={prediction} loading={loading} />}

      {/* 预测回测 */}
      {hasKline && <BacktestReport code={info.code} visible={hasKline} />}

      {/* 预测对比图 */}
      {hasKline && <PredictionComparisonChart code={info.code} visible={hasKline} />}

      {/* 买入诊断 */}
      <PurchaseAnalysis key={info.code} stockCode={info.code} stockName={info.name} />

      {/* 买卖信号 — 仅当有K线时 */}
      {hasKline && <SignalPanel signals={signals} />}

      {/* 买卖信号回测 */}
      {hasKline && <SignalBacktestCard code={info.code} visible={hasKline} />}

      {/* 量化分析 */}
      {hasKline && <QuantitativePanel code={info.code} />}
    </div>
  );
}

