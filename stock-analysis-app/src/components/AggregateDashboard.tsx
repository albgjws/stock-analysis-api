import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Spin, Empty, Alert, Divider, Collapse } from 'antd';
import {
  ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined,
  BarChartOutlined, RiseOutlined, FallOutlined, WarningOutlined,
} from '@ant-design/icons';
import { getAggregateStats, getDailyReport } from '../api/stockApi';

export default function AggregateDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [dailyReport, setDailyReport] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAggregateStats(),
      getDailyReport(),
    ]).then(([s, r]) => {
      setStats(s);
      setDailyReport(r);
    }).catch(() => {
      setStats(null);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" tip="加载汇总数据..." /></div>;
  }

  if (!stats || stats.totalStocks === 0) {
    return (
      <Card title="📊 预测汇总统计" style={{ borderRadius: 8, margin: 24 }}>
        <Empty description="暂无预测记录。搜索并查看股票后，预测会自动记录。" />
      </Card>
    );
  }

  const columns = [
    { title: '股票', dataIndex: 'code', key: 'code', render: (v: string) => <code>{v}</code> },
    { title: '预测日', dataIndex: 'date', key: 'date' },
    { title: '方法', dataIndex: 'method', key: 'method', render: (v: string) => <Tag>{v}</Tag> },
    { title: '预测方向', dataIndex: 'trend', key: 'trend', render: (v: string) => {
      const m: Record<string, { label: string; color: string }> = {
        up: { label: '📈 上涨', color: 'red' },
        down: { label: '📉 下跌', color: 'green' },
        sideways: { label: '➡️ 横盘', color: 'default' },
      };
      const info = m[v] || { label: v, color: 'default' };
      return <Tag color={info.color}>{info.label}</Tag>;
    }},
    { title: '方向正确', dataIndex: 'directionCorrect', key: 'directionCorrect',
      render: (v: boolean | null) => {
        if (v === true) return <Tag icon={<CheckCircleOutlined />} color="success">正确</Tag>;
        if (v === false) return <Tag icon={<CloseCircleOutlined />} color="error">错误</Tag>;
        return <Tag>待验证</Tag>;
      },
    },
    { title: '平均误差', dataIndex: 'mae', key: 'mae', render: (v: number | null) => v != null ? `¥${v}` : '-' },
  ];

  const totalChecked = stats.totalPredictions;
  const dirRate = stats.directionCorrectRate;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 20 }}>
        <BarChartOutlined style={{ marginRight: 8 }} />
        预测模型汇总统计
      </h2>

      {/* 每日自动回测报表 */}
      {dailyReport && (
        <Card
          size="small"
          title={`📋 每日回测报表 · ${dailyReport.date}`}
          style={{ borderRadius: 8, marginBottom: 16, border: '1px solid #b7eb8f' }}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#999' }}>大盘环境</div>
                <Tag color={dailyReport.marketCondition === 'bull' ? 'red' : dailyReport.marketCondition === 'bear' ? 'green' : 'default'} style={{ fontSize: 13, marginTop: 4 }}>
                  {dailyReport.marketCondition === 'bull' ? '📈 偏多' : dailyReport.marketCondition === 'bear' ? '📉 偏空' : '➡️ 震荡'}
                </Tag>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#999' }}>回测次数</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{dailyReport.backtestedCount || 0}</div>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#999' }}>方向正确率</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: (dailyReport.directionCorrectRate || 0) >= 50 ? '#cf1322' : '#3cb371' }}>
                  {dailyReport.directionCorrectRate || 0}%
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#999' }}>平均误差</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: (dailyReport.avgMae || 0) < 1 ? '#52c41a' : '#faad14' }}>
                  ¥{(dailyReport.avgMae || 0).toFixed(2)}
                </div>
              </div>
            </Col>
          </Row>
          {dailyReport.directionCorrectRate < 40 && dailyReport.backtestedCount > 3 && (
            <Alert
              type="warning" showIcon icon={<WarningOutlined />}
              message="方向正确率偏低（低于40%），建议检查预测参数"
              style={{ marginBottom: 8 }}
            />
          )}
          {dailyReport.details?.length > 0 && (
            <Collapse
              size="small" ghost expandIconPosition="end"
              items={[{
                key: 'details',
                label: <span style={{ fontWeight: 500, fontSize: 12 }}>📋 各股票详细回测结果</span>,
                children: (
                  <div style={{ fontSize: 12 }}>
                    {dailyReport.details.map((d: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f0f0f0', gap: 8 }}>
                        <span style={{ width: 60, fontWeight: 600 }}>{d.code}</span>
                        <span>{d.date}</span>
                        <Tag color={d.directionCorrect ? 'success' : 'error'} style={{ fontSize: 10, lineHeight: '16px' }}>
                          {d.directionCorrect ? '方向正确' : '方向错误'}
                        </Tag>
                        <span style={{ color: '#999' }}>MAE: ¥{d.mae}</span>
                        <span style={{ color: '#999' }}>预测{d.predictedTrend} → 实际{d.actualTrend}</span>
                      </div>
                    ))}
                  </div>
                ),
              }]}
            />
          )}
        </Card>
      )}

      {/* 概览卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
            <Statistic title="跟踪股票" value={stats.totalStocks} prefix={<BarChartOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
            <Statistic title="总预测次数" value={totalChecked} prefix={<ExperimentOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
            <Statistic
              title="方向判断正确率"
              value={dirRate}
              suffix="%"
              prefix={dirRate >= 50 ? <RiseOutlined /> : <FallOutlined />}
              valueStyle={{ color: dirRate >= 50 ? '#cf1322' : '#3cb371' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
            <Statistic
              title="平均误差(MAE)"
              value={stats.avgMae}
              precision={2}
              prefix="¥"
              valueStyle={{ color: stats.avgMae < 0.5 ? '#52c41a' : stats.avgMae < 1 ? '#faad14' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 各方法统计 */}
      {Object.keys(stats.byMethod).length > 0 && (
        <Card size="small" title="按预测方法" style={{ borderRadius: 8, marginBottom: 16 }}>
          <Row gutter={16}>
            {Object.entries(stats.byMethod).map(([method, info]: any) => (
              <Col key={method} span={8}>
                <div style={{ padding: '8px 0' }}>
                  <Tag color="blue">{method}</Tag>
                  <span style={{ marginLeft: 8, fontSize: 13 }}>使用 {info.count} 次</span>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 最近预测列表 */}
      <Card
        size="small"
        title={`最近预测记录（共${stats.recentPredictions.length}条）`}
        style={{ borderRadius: 8 }}
      >
        <Table
          dataSource={stats.recentPredictions}
          columns={columns}
          rowKey={(r: any) => r.code + r.date}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false }}
        />
      </Card>

      <Alert
        message="说明"
        description="汇总统计从 data/predictions/ 目录中读取历史预测记录。每搜索一只股票就会保存一次预测，回测数据会在预测期结束后自动更新。方向正确率超过50%说明模型有正向预测能力。"
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />
    </div>
  );
}
