import React from 'react';
import { Card, Collapse, Tag, Space, Typography } from 'antd';
import {
  InfoCircleOutlined,
  RiseOutlined,
  FallOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const signalItems = [
  {
    key: 'threeLocks',
    label: (
      <Space>
        <Tag color="red">🔒</Tag>
        <span style={{ fontWeight: 600 }}>三把锁</span>
        <Tag color="blue">买入/卖出确认信号</Tag>
      </Space>
    ),
    children: (
      <div style={{ lineHeight: 2.2, padding: '4px 0' }}>
        <div style={{ background: '#fff7e6', padding: '8px 12px', borderRadius: 6, marginBottom: 10, border: '1px solid #ffd591' }}>
          <b>💡 三把锁是三重确认信号</b>，锁越多信号越可靠
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#cf1322' }}>🔒🔒🔒 三锁全开 — 强烈买入/卖出信号 ✅</div>
          <div style={{ paddingLeft: 20, fontSize: 13 }}>买入三锁全部触发，信号可靠性最高，适合据此操作：</div>
          <table style={{ width: '100%', marginTop: 6, borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', width: 30, textAlign: 'center', background: '#fff2f0' }}>①</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0' }}>股价突破 <b>MA20</b></td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', color: '#999' }}>趋势确认 → 中期趋势转多</td></tr>
              <tr><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', textAlign: 'center', background: '#fff2f0' }}>②</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0' }}><b>MACD</b> 金叉</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', color: '#999' }}>动能确认 → 上涨动能增强</td></tr>
              <tr><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', textAlign: 'center', background: '#fff2f0' }}>③</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0' }}>成交量放大 {'>'}1.5倍</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', color: '#999' }}>资金确认 → 主力资金进场</td></tr>
            </tbody>
          </table>
          <div style={{ paddingLeft: 20, marginTop: 4, fontSize: 12, color: '#cf1322' }}>✅ 三个维度共振，上涨概率大幅提升，可积极买入</div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#3cb371' }}>🔒🔒🔒 三锁全开 — 强烈卖出信号 ⚠️</div>
          <div style={{ paddingLeft: 20, fontSize: 13 }}>卖出三锁全部触发，建议及时离场：</div>
          <table style={{ width: '100%', marginTop: 6, borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', width: 30, textAlign: 'center', background: '#f6ffed' }}>①</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0' }}>股价跌破 <b>MA20</b></td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', color: '#999' }}>趋势破位 → 中期趋势转空</td></tr>
              <tr><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', textAlign: 'center', background: '#f6ffed' }}>②</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0' }}><b>MACD</b> 死叉</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', color: '#999' }}>动能衰竭 → 下跌动能增强</td></tr>
              <tr><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', textAlign: 'center', background: '#f6ffed' }}>③</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0' }}>放量下跌 {'>'}1.3倍</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', color: '#999' }}>资金出逃 → 主力资金离场</td></tr>
            </tbody>
          </table>
          <div style={{ paddingLeft: 20, marginTop: 4, fontSize: 12, color: '#3cb371' }}>⚠️ 三个维度共振下跌，建议减仓或清仓规避风险</div>
        </div>

        <div style={{ background: '#fffbe6', padding: '6px 12px', borderRadius: 6, border: '1px solid #ffe58f' }}>
          <Tag color="orange">🔒2</Tag> <b>两把锁 — 信号较强</b>：3个条件满足2个，信号较可靠但需要结合其他指标确认<br/>
          <span style={{ fontSize: 12, color: '#999' }}>💡 两锁+三锁连续出现：趋势延续信号，可顺势而为</span>
        </div>
      </div>
    ),
  },
  {
    key: 'td9',
    label: (
      <Space>
        <Tag color="orange">9</Tag>
        <span style={{ fontWeight: 600 }}>神奇九转</span>
        <Tag color="blue">TD Sequential 反转预警</Tag>
      </Space>
    ),
    children: (
      <div style={{ lineHeight: 2.2, padding: '4px 0' }}>
        <div>连续统计收盘价与<b>4个交易日</b>前的对比：</div>
        <div style={{ paddingLeft: 28 }}>
          <span style={{ color: '#cf1322' }}>红色数字</span>：连续上涨计数①→⑨（显示在K线上方）
        </div>
        <div style={{ paddingLeft: 28 }}>
          <span style={{ color: '#3cb371' }}>绿色数字</span>：连续下跌计数①→⑨（显示在K线下方）
        </div>
        <div style={{ marginTop: 8 }}>
          <Tag color="red">⑨</Tag> 达到9转 — <b>趋势可能衰竭，警惕反转</b>
        </div>
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>💡 9转不是立即反向，而是预警信号，建议结合其他指标确认</div>
      </div>
    ),
  },
  {
    key: 'swing',
    label: (
      <Space>
        <Tag color="blue">▲</Tag>
        <span style={{ fontWeight: 600 }}>波段买卖点</span>
        <Tag color="blue">KDJ/RSI极值反转</Tag>
      </Space>
    ),
    children: (
      <div style={{ lineHeight: 2.2, padding: '4px 0' }}>
        <div><Tag color="red">▲</Tag> <b>波段买入点</b>：KDJ低位金叉 或 RSI超卖(&lt;30) + 收阳</div>
        <div><Tag color="green">▼</Tag> <b>波段卖出点</b>：KDJ高位死叉 或 RSI超买(&gt;70) + 收阴</div>
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>💡 适合短线波段操作，准确率较高的短期反转信号</div>
      </div>
    ),
  },
  {
    key: 'dualCross',
    label: (
      <Space>
        <Tag color="red">↑↑</Tag>
        <span style={{ fontWeight: 600 }}>MACD+KDJ组合双金叉</span>
        <Tag color="blue">多指标共振</Tag>
      </Space>
    ),
    children: (
      <div style={{ lineHeight: 2.2, padding: '4px 0' }}>
        <div style={{ background: '#fff7e6', padding: '8px 12px', borderRadius: 6, marginBottom: 10, border: '1px solid #ffd591' }}>
          <b>💡 MACD + KDJ 同时发出信号</b>，两指标互相验证，可靠性倍增
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#cf1322' }}>↑↑ 组合双金叉 — 强买入信号 ✅</div>
          <div style={{ paddingLeft: 20, fontSize: 13 }}>相邻3根K线内MACD和KDJ同时出现金叉：</div>
          <table style={{ width: '100%', marginTop: 6, borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', width: 30, textAlign: 'center', background: '#fff2f0' }}>①</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0' }}><b>MACD</b> 金叉</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', color: '#999' }}>DIF上穿DEA → 中期动能转多</td></tr>
              <tr><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', textAlign: 'center', background: '#fff2f0' }}>②</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0' }}><b>KDJ</b> 低位金叉</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', color: '#999' }}>K上穿D且K&lt;40 → 短期超卖反弹</td></tr>
            </tbody>
          </table>
          <div style={{ paddingLeft: 20, marginTop: 4, fontSize: 12, color: '#cf1322' }}>
            🟢 强度2：MACD和KDJ在同一天共振金叉 → 最强买入信号<br/>
            🟡 强度1：3根K线内先后金叉 → 较强买入信号
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#3cb371' }}>↓↓ 组合双死叉 — 强卖出信号 ⚠️</div>
          <div style={{ paddingLeft: 20, fontSize: 13 }}>相邻3根K线内MACD和KDJ同时出现死叉：</div>
          <table style={{ width: '100%', marginTop: 6, borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', width: 30, textAlign: 'center', background: '#f6ffed' }}>①</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0' }}><b>MACD</b> 死叉</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', color: '#999' }}>DIF下穿DEA → 中期动能转空</td></tr>
              <tr><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', textAlign: 'center', background: '#f6ffed' }}>②</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0' }}><b>KDJ</b> 高位死叉</td><td style={{ padding: '3px 8px', border: '1px solid #f0f0f0', color: '#999' }}>K下穿D且K&gt;60 → 短期超买回调</td></tr>
            </tbody>
          </table>
          <div style={{ paddingLeft: 20, marginTop: 4, fontSize: 12, color: '#3cb371' }}>
            🔴 强度2：同一天共振死叉 → 最强卖出信号<br/>
            🟡 强度1：3根K线内先后死叉 → 较强卖出信号
          </div>
        </div>
      </div>
    ),
  },
  {
    key: 'fundFlow',
    label: (
      <Space>
        <Tag color="purple">主力</Tag>
        <span style={{ fontWeight: 600 }}>主力资金流向</span>
        <Tag color="blue">大单/超大单净流向</Tag>
      </Space>
    ),
    children: (
      <div style={{ lineHeight: 2.2, padding: '4px 0' }}>
        <div>在K线图上叠加显示<b>主力资金净占比</b>（红柱=净流入，绿柱=净流出）：</div>
        <div style={{ paddingLeft: 28 }}><span style={{ color: '#cf1322' }}>红色柱</span>：主力资金净流入，大单+超大单买入为主</div>
        <div style={{ paddingLeft: 28 }}><span style={{ color: '#3cb371' }}>绿色柱</span>：主力资金净流出，大单+超大单卖出为主</div>
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>💡 主力连续净流入 + 股价上涨 = 上涨趋势健康，可持续关注</div>
        <div style={{ color: '#999', fontSize: 12 }}>💡 主力持续流出 + 股价上涨 = 可能是诱多，警惕回调</div>
      </div>
    ),
  },
];

export default function AdvancedSignalLegend() {
  return (
    <Card
      size="small"
      title={
        <Space>
          <InfoCircleOutlined style={{ color: '#1677ff' }} />
          <span style={{ fontWeight: 600 }}>专业指标说明</span>
        </Space>
      }
      style={{ borderRadius: 8, marginBottom: 16 }}
      styles={{ body: { padding: '8px 12px' } }}
    >
      <Collapse
        items={signalItems}
        defaultActiveKey={[]}
        expandIconPosition="end"
        size="small"
        style={{ background: 'transparent', border: 'none' }}
      />
    </Card>
  );
}
