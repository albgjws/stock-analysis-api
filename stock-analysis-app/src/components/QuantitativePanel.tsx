import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Tag, Progress, Spin, Alert, Divider, Statistic, Collapse, Typography } from 'antd';
import { WarningOutlined, InfoCircleOutlined, ExperimentOutlined, FundOutlined, BugOutlined, CheckCircleOutlined, FireOutlined, SafetyOutlined } from '@ant-design/icons';
import { getQuantitative } from '../api/stockApi';
const { Text } = Typography;
interface QuantitativePanelProps { code: string; }

export default function QuantitativePanel({ code }: QuantitativePanelProps) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!code) return; setLoading(true); setError(null);
    getQuantitative(code).then(d => setReport(d)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [code]);
  if (loading) return <Card><Spin tip="量化分析中..." style={{ display: 'flex', justifyContent: 'center', padding: 40 }} /></Card>;
  if (error || !report) return null;
  const { summary, risk, microstructure, meanReversion, momentum, walkForward, factors, dataQuality } = report;
  const sc = (s: number) => s >= 80 ? '#52c41a' : s >= 60 ? '#faad14' : '#f5222d';
  const lc = (s: number) => s > 50 ? '#cf1322' : s < 50 ? '#3cb371' : '#faad14';
  const rc = (l: string) => l === 'low' ? '#52c41a' : l === 'medium' ? '#faad14' : '#f5222d';
  const pct = (v: any, d = '-') => v != null ? v.toFixed(2) + '%' : d;
  const num = (v: any, d = '-', n = 2) => v != null ? v.toFixed(n) : d;
  const r = summary || {}; const rk = risk || {}; const mm = microstructure || {};
  const mr = meanReversion || {}; const mo = momentum || {}; const wf = walkForward || {};
  const pts: string[] = [];
  if (r.overallScore >= 80) pts.push('综合评分优秀');
  else if (r.overallScore >= 60) pts.push('综合评分良好');
  else pts.push('综合评分一般');
  if (rk.sharpeRatio > 0.5) pts.push('夏普' + rk.sharpeRatio.toFixed(2));
  if (rk.maxDrawdown > 20) pts.push('回掠' + rk.maxDrawdown + '%偏高');
  if (rk.suggestedPosition) pts.push('建议仓位' + rk.suggestedPosition.toFixed(1) + '%');
  if (mm.orderImbalance != null && Math.abs(mm.orderImbalance) > 0.1) pts.push(mm.orderImbalance > 0 ? '买盘强' : '卖盘压');
  if (mr.signal === 'oversold') pts.push('超卖有反弹机会');
  else if (mr.signal === 'overbought') pts.push('超买有回调压力');
  if (wf.outSampleSharpe != null && wf.outSampleSharpe > 0.3) pts.push('回测验证通过');
  else pts.push('回测信号不显著');
  const summaryText = pts.join(', ') + '.';
  const getAdvice = () => {
    const sc2 = summary?.overallScore || 0; const sh2 = risk?.sharpeRatio || 0;
    if (sc2 >= 70 && sh2 > 0.5) return { type: 'success' as const, text: '条件较好，可参与，严格止损' };
    if (sc2 >= 50) return { type: 'warning' as const, text: '条件一般，持仓观察，新开仓谨慎' };
    return { type: 'error' as const, text: '多项指标偏弱，建议观望' };
  }; const advice = getAdvice();

  return (
    <Card title={<span><ExperimentOutlined style={{ marginRight: 8 }} />量化分析</span>} style={{ marginTop: 16 }}>
      <Card size='small' style={{ marginBottom: 16, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: '#333' }}><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />{summaryText}</div></Card>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size='small'><Statistic title='综合评分' value={summary?.overallScore || 0} suffix='/100' valueStyle={{ color: sc(summary?.overallScore || 0) }} /><Progress percent={summary?.overallScore || 0} showInfo={false} strokeColor={sc(summary?.overallScore || 0)} size='small' /></Card></Col>
        <Col span={6}><Card size='small'><Statistic title='风险等级' valueRender={() => <Tag color={rc(summary?.riskLevel)} style={{ fontSize: 16, padding: '4px 12px' }}>{summary?.riskLevel === 'low' ? '低' : summary?.riskLevel === 'medium' ? '中' : '高'}</Tag>} /></Card></Col>
        <Col span={6}><Card size='small'><Statistic title='建议仓位' value={risk?.suggestedPosition ?? 0} suffix='%' valueStyle={{ color: (risk?.suggestedPosition || 0) > 1 ? '#52c41a' : '#faad14', fontWeight: 'bold' }} /></Card></Col>
        <Col span={6}><Card size='small'><Statistic title='操作建议' valueRender={() => <Tag color={advice.type === 'success' ? 'success' : advice.type === 'warning' ? 'warning' : 'error'} style={{ fontSize: 14, padding: '2px 10px' }}>{advice.type === 'success' ? '可参与' : advice.type === 'warning' ? '观望' : '回避'}</Tag>} /></Card></Col>
      </Row>
      {summary?.warnings?.length > 0 && <Alert message='风险提示' description={<ul style={{ margin: 0, paddingLeft: 16 }}>{summary.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>} type='warning' showIcon icon={<WarningOutlined />} style={{ marginBottom: 16 }} />}
      <Divider orientation='left'><SafetyOutlined /> B1</Divider>
      <Row gutter={[12, 12]} style={{ marginBottom: 8 }}>
        <Col span={3}><Statistic title='VaR(95%)' value={pct(risk?.var95)} valueStyle={{ color: (risk?.var95 || 0) > 3 ? '#f5222d' : '#333', fontSize: 18 }} /></Col>
        <Col span={3}><Statistic title='年化波动' value={pct(risk?.annualVolatility)} valueStyle={{ fontSize: 18 }} /></Col>
        <Col span={3}><Statistic title='最大回掠' value={pct(risk?.maxDrawdown)} valueStyle={{ color: (risk?.maxDrawdown || 0) > 20 ? '#f5222d' : '#333', fontSize: 18 }} /></Col>
        <Col span={3}><Statistic title='夏普比率' value={num(risk?.sharpeRatio, '-', 2)} valueStyle={{ color: (risk?.sharpeRatio || 0) > 0.5 ? '#52c41a' : (risk?.sharpeRatio || 0) > 0 ? '#faad14' : '#f5222d', fontSize: 18 }} /></Col>
        <Col span={3}><Statistic title='Kelly仓位' value={pct(risk?.kellyFraction)} valueStyle={{ fontSize: 18 }} /></Col>
        <Col span={3}><Statistic title='策略回测' value={walkForward?.recommended ? '通过' : '回避'} valueStyle={{ color: walkForward?.recommended ? '#52c41a' : '#faad14', fontWeight: 'bold' }} /></Col>
        <Col span={3}><Statistic title='市场适应' value={summary?.suitability === 'day_trading' ? '日内' : summary?.suitability === 'swing_trading' ? '波段' : summary?.suitability === 'position_trading' ? '趋势' : '不适合'} /></Col>
        <Col span={3}><Statistic title='胜率' value={pct(risk?.winRate)} /></Col>
      </Row>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col span={4}><Statistic title='盈亏比' value={num(risk?.profitFactor, '-', 2)} /></Col>
        <Col span={4}><Statistic title='偏度' value={num(risk?.skewness, '-', 2)} valueStyle={{ color: (risk?.skewness || 0) < -0.5 ? '#3cb371' : '#333' }} /></Col>
        <Col span={4}><Statistic title='峰度' value={num(risk?.kurtosis, '-', 2)} valueStyle={{ color: (risk?.kurtosis || 0) > 3 ? '#f5222d' : '#333' }} /></Col>
        <Col span={4}><Statistic title='订单失衡' value={num(mm?.orderImbalance, '--', 3)} valueStyle={{ color: (mm?.orderImbalance || 0) > 0 ? '#cf1322' : '#3cb371', fontSize: 18 }} /></Col>
        <Col span={4}><Statistic title='VWAP偏离' value={(mm?.vwapDeviation || 0) > 0 ? '+' + pct(mm?.vwapDeviation) : pct(mm?.vwapDeviation)} valueStyle={{ color: (mm?.vwapDeviation || 0) > 0 ? '#cf1322' : '#3cb371', fontSize: 18 }} /></Col>
        <Col span={4}><Statistic title='流动性' value={mm?.liquidityScore ?? 0} suffix='/100' valueStyle={{ color: lc(mm?.liquidityScore || 0), fontSize: 18 }} /></Col>
      </Row>
      <Divider orientation='left'><FireOutlined /> E1</Divider>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size='small' title='均值回归' style={{ textAlign: 'center' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><span style={{ fontSize: 24, fontWeight: 'bold' }}>{num(mr?.zscore, '--', 2)}</span><Tag color={mr?.signal === 'oversold' ? '#3cb371' : mr?.signal === 'overbought' ? '#cf1322' : '#999'} style={{ margin: 0, fontSize: 13 }}>{mr?.signal === 'oversold' ? '超卖' : mr?.signal === 'overbought' ? '超买' : '中性'}</Tag></div></Card></Col>
        <Col span={4}><Card size='small' title='近1月' style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 'bold', color: (mo?.momentum1M || 0) > 0 ? '#cf1322' : '#3cb371' }}>{(mo?.momentum1M || 0) > 0 ? '+' : ''}{num(mo?.momentum1M, '--', 1)}%</div></Card></Col>
        <Col span={4}><Card size='small' title='近3月' style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 'bold', color: (mo?.momentum3M || 0) > 0 ? '#cf1322' : '#3cb371' }}>{(mo?.momentum3M || 0) > 0 ? '+' : ''}{num(mo?.momentum3M, '--', 1)}%</div></Card></Col>
        <Col span={4}><Card size='small' title='近6月' style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 'bold', color: (mo?.momentum6M || 0) > 0 ? '#cf1322' : '#3cb371' }}>{(mo?.momentum6M || 0) > 0 ? '+' : ''}{num(mo?.momentum6M, '--', 1)}%</div></Card></Col>
        <Col span={4}><Card size='small' title='流动性' style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 'bold', color: lc(mm?.liquidityScore || 0) }}>{mm?.liquidityScore || 0}</div></Card></Col>
        <Col span={4}><Card size='small' title='因子IC' style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 'bold' }}>{factors?.[0] ? num(factors[0].ic, '--', 2) : '--'}</div></Card></Col>
      </Row>
      <Divider orientation='left'><FundOutlined /> F1</Divider>
      <Alert message={advice.type === 'success' ? '可参与' : advice.type === 'warning' ? '观望' : '回避'} description={<div><p>{advice.text}</p><p style={{ fontSize: 12, color: '#999' }}>S{summary?.overallScore} X{num(risk?.sharpeRatio)} H{pct(risk?.maxDrawdown)} V{pct(risk?.var95)}</p></div>} type={advice.type} showIcon style={{ marginBottom: 16 }} />
      <Collapse ghost size='small' items={[{ key: 'quality', label: <span style={{ fontSize: 12, color: '#999' }}><BugOutlined /> Q3({dataQuality?.issues?.length || 0})</span>, children: <div style={{ fontSize: 12, color: '#666' }}>{dataQuality?.stats && <p>{dataQuality.stats.totalBars}条 {dataQuality.stats.tradingDays}个交易日</p>}</div> }]} />
    </Card>
  );
}