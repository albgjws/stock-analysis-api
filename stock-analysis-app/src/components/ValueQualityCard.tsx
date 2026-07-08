import React from "react";
import { Card, Tag, Row, Col, Progress, Tooltip } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  WarningOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';

interface IndicatorResult {
  id: number;
  name: string;
  desc: string;
  value: number | null;
  threshold: number;
  unit: string;
  status: "PASS" | "FAIL" | "MARGINAL" | "NODATA";
  score: number;
  note: string;
}

interface MastersScore {
  buffet: number;
  munger: number;
  duan: number;
  lulu: number;
  average: number;
}

export interface StrategyResult {
  master: string;
  style: string;
  description: string;
  action: 'buy' | 'hold' | 'watch' | 'avoid';
}

export interface RecommendationItem {
  level: string;
  levelLabel: string;
  action: string;
  priceRange: string;
  position: string;
  detail: string;
}

interface QualityResult {
  overall: "PASS" | "MARGINAL" | "FAIL";
  totalScore: number;
  indicators: IndicatorResult[];
  exemptions: string[];
  mastersScore: MastersScore;
  financialSnapshot: Record<string, any>;
  commentary: string;
  strategy: StrategyResult;
  recommendations: RecommendationItem[];
}

interface NoResultResponse {
  hasResult: false;
  code: string;
  name: string;
  prompt: string;
}

type ValueQualityData = QualityResult | NoResultResponse;

export interface NewsPulseData {
  hasResult: boolean;
  priceAlert: string;
  priceAlertDetail: string;
  capitalFlowAnalysis: string;
  sectorContext: string;
  concepts: { name: string; changePercent: number }[];
  compositeScore: number;
  sentiment: string;
  summary: string;
}

interface Props {
  data: ValueQualityData | null;
  loading?: boolean;
  newsPulse?: NewsPulseData | null;
  newsPulseLoading?: boolean;
  onRefresh?: () => void;
}

const statusIcon = (status: string) => {
  switch (status) {
    case "PASS":
      return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
    case "FAIL":
      return <CloseCircleOutlined style={{ color: "#cf1322" }} />;
    case "MARGINAL":
      return <WarningOutlined style={{ color: "#faad14" }} />;
    default:
      return <QuestionCircleOutlined style={{ color: "#999" }} />;
  }
};

const statusColor = (status: string) => {
  switch (status) {
    case "PASS": return "green";
    case "FAIL": return "red";
    case "MARGINAL": return "orange";
    default: return "default";
  }
};

const overallColor = (overall: string) => {
  switch (overall) {
    case "PASS": return "#52c41a";
    case "MARGINAL": return "#faad14";
    case "FAIL": return "#cf1322";
    default: return "#999";
  }
};

const overallLabel = (overall: string) => {
  switch (overall) {
    case "PASS": return "通过 ✓";
    case "FAIL": return "排除 ✗";
    case "MARGINAL": return "边界";
    default: return "未知";
  }
};

const masterIcon = (score: number) => {
  return score >= 4 ? <StarFilled style={{ color: "#faad14" }} /> : <StarOutlined style={{ color: "#d9d9d9" }} />;
};

const ValueQualityCard: React.FC<Props> = ({ data, loading, newsPulse, newsPulseLoading, onRefresh }) => {
  if (loading) {
    return (
      <Card size="small" loading style={{ marginBottom: 12 }}>
        加载中...
      </Card>
    );
  }

  if (!data) return null;

  // 无结果状态
  if ("hasResult" in data && data.hasResult === false) {
    return (
      <Card size="small" style={{ marginBottom: 12, borderLeft: "3px solid #faad14" }}>
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            ⚠️ 暂无质量评估数据
          </div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
            {(data as NoResultResponse).prompt}
          </div>
          {onRefresh && (
            <div style={{ fontSize: 12, color: "#1677ff", cursor: "pointer" }} onClick={onRefresh}>
              点击重试
            </div>
          )}
        </div>
      </Card>
    );
  }

  const qualityData = data as QualityResult;
  const isFailed = qualityData.overall === "FAIL";
  const np = newsPulse;

  return (
    <Card
      size="small"
      title={
        <span>
          🏛️ AI Berkshire 价值质量评估
          <Tooltip title={"⚠️ 此评分基于7项财务指标的去劣筛选，仅评估财务健康度，非买入建议。高分不代表股价会上涨，还需结合估值、行业周期、技术面综合判断。官方阈值：ROE≥8%、毛利率≥15%、净利率≥5%、OCF/NI≥0.7"}>
          <Tag
            color={overallColor(qualityData.overall)}
            style={{ marginLeft: 8, fontWeight: "bold", cursor: "help" }}
          >
            {overallLabel(qualityData.overall)} {qualityData.totalScore}/105
          </Tag>
        </Tooltip>
        </span>
      }
      style={{ marginBottom: 12, borderLeft: `3px solid ${overallColor(qualityData.overall)}` }}
    >
      {/* ========== 步骤一：质量筛选 ========== */}
      <div style={{
        marginBottom: 14,
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid " + (qualityData.overall === "PASS" ? "#b7eb8f" : qualityData.overall === "FAIL" ? "#ffa39e" : "#ffe58f"),
        background: qualityData.overall === "PASS" ? "#f6ffed" : qualityData.overall === "FAIL" ? "#fff2f0" : "#fffbe6"
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#333" }}>
          🔍 步骤一：质量筛选 /quality-screen
          <Tag color={overallColor(qualityData.overall)} style={{ marginLeft: 6, fontSize: 11 }}>
            {overallLabel(qualityData.overall)}
          </Tag>
        </div>

        {/* 评语 */}
        <div style={{ fontSize: 12, color: "#666", marginBottom: 8, lineHeight: 1.6 }}>
          {qualityData.commentary}
        </div>
        <div style={{ fontSize: 10, color: "#999", marginBottom: 4, lineHeight: 1.4 }}>
          ⚠️ 排除标准：≥2项FAIL直接排除 | 分数仅反映各指标得分，不代表整体结论
        </div>

        {/* 7项指标 */}
        <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
          七项质量筛选（紧凑版）
        </div>
        {qualityData.indicators.map((ind) => {
            const c = ind.status === "PASS" ? "#52c41a" : ind.status === "FAIL" ? "#cf1322" : ind.status === "MARGINAL" ? "#faad14" : "#999";
            return <div key={ind.id} style={{ padding: "2px 6px", borderRadius: 3, fontSize: 11, border: "1px solid " + c, background: c + "15", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontWeight: 600, color: c, fontSize: 12 }}>{ind.status === "PASS" ? "✓" : ind.status === "FAIL" ? "✗" : ind.status === "MARGINAL" ? "~" : "?"}</span>
              <span style={{ color: "#444" }}>{ind.name}</span>
              <span style={{ color: c, fontWeight: 600 }}>{ind.score}/15</span>
              <span style={{ color: "#888" }}>{ind.value !== null ? ind.value + (ind.unit || "") : "—"}</span>
            </div>;
          })}


        {/* 豁免条件 */}
        {qualityData.exemptions && qualityData.exemptions.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 11, color: "#888" }}>
            {qualityData.exemptions.map((ex, i) => (
              <div key={i}>✅ {ex}</div>
            ))}
          </div>
        )}
      </div>

      {/* ========== 步骤二：异动归因 ========== */}
      <div style={{
        marginBottom: 14,
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid #91caff",
        background: "#e6f4ff"
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#333" }}>
          💡 步骤二：异动归因 /news-pulse
          {newsPulseLoading && <Tag style={{ marginLeft: 6, fontSize: 11, color: "#1677ff" }}>分析中...</Tag>}
          {np?.hasResult && (
            <Tag
              color={np.sentiment === "积极" ? "green" : np.sentiment === "消极" ? "red" : "blue"}
              style={{ marginLeft: 6, fontSize: 11 }}
            >
              {np.sentiment}
            </Tag>
          )}
        </div>

        {!np?.hasResult ? (
          <div style={{ fontSize: 12, color: "#888" }}>
            暂无异动数据，请先执行 quality-screen 质量筛选。
          </div>
        ) : (
          <>
            {/* 价格异动 */}
            <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13 }}>
                {np.priceAlert === "平静" ? "🌊" : np.priceAlert === "轻微异动" ? "📈" : "⚡"}
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: np.priceAlert === "平静" ? "#52c41a" : np.priceAlert === "轻微异动" ? "#faad14" : "#ff4d4f" }}>
                {np.priceAlert}
              </span>
              <span style={{ fontSize: 12, color: "#666" }}>{np.priceAlertDetail}</span>
            </div>

            {/* 行业板块 */}
            <div style={{ marginBottom: 6, fontSize: 12, color: "#555" }}>
              {np.sectorContext}
            </div>

            {/* 资金流向 */}
            <div style={{ marginBottom: 6, fontSize: 12, color: "#555" }}>
              {np.capitalFlowAnalysis}
            </div>

            {/* 概念板块 */}
            {np.concepts && np.concepts.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#999", marginRight: 4 }}>概念板块：</span>
                {np.concepts.slice(0, 5).map((c, i) => (
                  <Tag key={i} style={{ fontSize: 10, marginBottom: 2 }}>
                    {c.name} {c.changePercent >= 0 ? "+" : ""}{c.changePercent?.toFixed(1)}%
                  </Tag>
                ))}
              </div>
            )}

            {/* 综合评分 */}
            <div style={{ marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "#999" }}>综合评分：</span>
              <span style={{
                fontSize: 13, fontWeight: 600, marginLeft: 4,
                color: np.compositeScore >= 20 ? "#52c41a" : np.compositeScore <= -20 ? "#ff4d4f" : "#666"
              }}>
                {np.compositeScore > 0 ? "+" : ""}{np.compositeScore}
              </span>
              <Progress
                percent={Math.min(100, ((np.compositeScore + 100) / 200) * 100)}
                size="small"
                showInfo={false}
                strokeColor={np.compositeScore >= 20 ? "#52c41a" : np.compositeScore <= -20 ? "#ff4d4f" : "#1677ff"}
                style={{ marginTop: 2, marginBottom: 0 }}
              />
            </div>
          </>
        )}
      </div>

      {/* ========== 步骤三：深度研究（PASS/MARGINAL时显示） ========== */}
      {!isFailed && (
        <div style={{
          marginBottom: 14,
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid " + (qualityData.overall === "PASS" ? "#b7eb8f" : "#ffe58f"),
          background: qualityData.overall === "PASS" ? "#f6ffed" : "#fffbe6"
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#333" }}>
            📑 步骤三：深度研究 /investment-research
          </div>

          {/* 四大师评分 */}
          <Row gutter={[8, 8]} style={{ marginBottom: 10 }}>
            <Col span={6}>
              <Tooltip title="巴菲特 — 财务估值 护城河">
                <div style={{ textAlign: "center", background: "#fff", borderRadius: 6, padding: "4px 0" }}>
                  <div style={{ fontSize: 11, color: "#999" }}>巴菲特</div>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: qualityData.mastersScore.buffet >= 4 ? "#52c41a" : "#333" }}>
                    {masterIcon(qualityData.mastersScore.buffet)} {qualityData.mastersScore.buffet}
                  </div>
                </div>
              </Tooltip>
            </Col>
            <Col span={6}>
              <Tooltip title="芒格 — 逆向思维 护城河宽度">
                <div style={{ textAlign: "center", background: "#fff", borderRadius: 6, padding: "4px 0" }}>
                  <div style={{ fontSize: 11, color: "#999" }}>芒格</div>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: qualityData.mastersScore.munger >= 4 ? "#52c41a" : "#333" }}>
                    {masterIcon(qualityData.mastersScore.munger)} {qualityData.mastersScore.munger}
                  </div>
                </div>
              </Tooltip>
            </Col>
            <Col span={6}>
              <Tooltip title="段永平 — 商业模式 好生意">
                <div style={{ textAlign: "center", background: "#fff", borderRadius: 6, padding: "4px 0" }}>
                  <div style={{ fontSize: 11, color: "#999" }}>段永平</div>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: qualityData.mastersScore.duan >= 4 ? "#52c41a" : "#333" }}>
                    {masterIcon(qualityData.mastersScore.duan)} {qualityData.mastersScore.duan}
                  </div>
                </div>
              </Tooltip>
            </Col>
            <Col span={6}>
              <Tooltip title="李录 — 长期确定性">
                <div style={{ textAlign: "center", background: "#fff", borderRadius: 6, padding: "4px 0" }}>
                  <div style={{ fontSize: 11, color: "#999" }}>李录</div>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: qualityData.mastersScore.lulu >= 4 ? "#52c41a" : "#333" }}>
                    {masterIcon(qualityData.mastersScore.lulu)} {qualityData.mastersScore.lulu}
                  </div>
                </div>
              </Tooltip>
            </Col>
          </Row>

          {/* 财务数据快照 */}
          {qualityData.financialSnapshot && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>财务数据快照</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {Object.entries(qualityData.financialSnapshot).map(([key, val]) => (
                  <div key={key} style={{
                    flex: "0 0 auto", padding: "2px 8px", background: "#fff",
                    borderRadius: 4, border: "1px solid #f0f0f0", fontSize: 11
                  }}>
                    <span style={{ color: "#999" }}>{key}：</span>
                    <span style={{ color: "#333", fontWeight: 500 }}>{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 策略建议 */}
          {qualityData.strategy && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>策略建议</div>
              <div style={{
                padding: "6px 10px", background: "#fff", borderRadius: 6, border: "1px solid #f0f0f0"
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  <Tag color={qualityData.strategy.action === "buy" ? "green" : qualityData.strategy.action === "avoid" ? "red" : qualityData.strategy.action === "hold" ? "blue" : "orange"}>
                    {qualityData.strategy.action === "buy" ? "买入" : qualityData.strategy.action === "hold" ? "持股" : qualityData.strategy.action === "watch" ? "观望" : "躲避"}
                  </Tag>
                  — 侧重 {qualityData.strategy.master}
                </div>
                <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
                  {qualityData.strategy.description}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

          {qualityData.recommendations && qualityData.recommendations.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 }}>💰 分层买卖建议</div>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    <th style={{ padding: "6px 8px", border: "1px solid #f0f0f0", textAlign: "left", fontWeight: 600, color: "#333" }}>策略</th>
                    <th style={{ padding: "6px 8px", border: "1px solid #f0f0f0", textAlign: "left", fontWeight: 600, color: "#333" }}>建议</th>
                    <th style={{ padding: "6px 8px", border: "1px solid #f0f0f0", textAlign: "left", fontWeight: 600, color: "#333" }}>价格区间</th>
                    <th style={{ padding: "6px 8px", border: "1px solid #f0f0f0", textAlign: "left", fontWeight: 600, color: "#333" }}>仓位</th>
                    <th style={{ padding: "6px 8px", border: "1px solid #f0f0f0", textAlign: "left", fontWeight: 600, color: "#333" }}>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {qualityData.recommendations.map((rec, i) => {
                    const rowColors = ["#f6ffed", "#e6f7ff", "#fffbe6"];
                    const labelColors = ["#389e0d", "#096dd9", "#d48806"];
                    return (
                      <tr key={i} style={{ background: rowColors[i] }}>
                        <td style={{ padding: "6px 8px", border: "1px solid #f0f0f0", fontWeight: 700, color: labelColors[i] }}>
                          {i === 0 ? "🟢 激进型" : i === 1 ? "🔵 稳健型" : "🟠 保守型"}
                        </td>
                        <td style={{ padding: "6px 8px", border: "1px solid #f0f0f0", color: "#333", fontWeight: 500 }}>{rec.action}</td>
                        <td style={{ padding: "6px 8px", border: "1px solid #f0f0f0", color: labelColors[i], fontWeight: 600 }}>{rec.priceRange}</td>
                        <td style={{ padding: "6px 8px", border: "1px solid #f0f0f0", color: labelColors[i], fontWeight: 600, textAlign: "center" }}>{rec.position}</td>
                        <td style={{ padding: "6px 8px", border: "1px solid #f0f0f0", color: "#888", fontSize: 11 }}>{rec.detail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}


      {/* ========== 流程指示条 ========== */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 12, gap: 4, flexWrap: "wrap"
      }}>
        <Tag color={qualityData.overall === "PASS" ? "green" : qualityData.overall === "FAIL" ? "red" : "orange"}>
          🔍 quality-screen
        </Tag>
        <span style={{ color: "#bbb", fontSize: 14 }}>→</span>
        <Tag color={np?.hasResult ? "blue" : "default"}>
          💡 news-pulse
        </Tag>
        <span style={{ color: "#bbb", fontSize: 14 }}>→</span>
        <Tag color={isFailed ? "default" : qualityData.overall === "PASS" ? "green" : "orange"}>
          📑 investment-research
        </Tag>
      </div>

      {/* ========== 决策表 + 最终结论 ========== */}
      {/* 决策表 */}
      <div style={{ marginBottom: 10, padding: "8px 10px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e8e8e8" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 6 }}>📊 综合决策表</div>
        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
          <tbody>
            <tr style={{ background: qualityData.overall === "FAIL" ? "#fff2f0" : qualityData.overall === "PASS" ? "#f6ffed" : "#fffbe6" }}>
              <td style={{ padding: "4px 6px", fontWeight: 600, color: "#333", borderBottom: "1px solid #f0f0f0", width: "80px" }}>空仓者</td>
              <td style={{ padding: "4px 6px", color: "#555", borderBottom: "1px solid #f0f0f0" }}>
                {qualityData.overall === "PASS" ? "质量合格，可用 investment-research 深入分析后建仓，建议不超过10%仓位" :
                 qualityData.overall === "MARGINAL" ? "边界通过，建议等待更多信号，仅可建仓不超过3%" :
                 "质量不达标，建议不建仓"}
              </td>
            </tr>
            <tr style={{ background: qualityData.overall === "FAIL" ? "#fff2f0" : qualityData.overall === "PASS" ? "#f6ffed" : "#fffbe6" }}>
              <td style={{ padding: "4px 6px", fontWeight: 600, color: "#333", borderBottom: "1px solid #f0f0f0" }}>持仓者</td>
              <td style={{ padding: "4px 6px", color: "#555", borderBottom: "1px solid #f0f0f0" }}>
                {qualityData.overall === "PASS" ? "持有。若股价异动用 news-pulse 归因，不因短期波动丢掉好公司" :
                 qualityData.overall === "MARGINAL" ? "边界通过，建议减仓至不超过3%，等待质量改善" :
                 "质量不达标，建议清仓"}
              </td>
            </tr>
            <tr style={{ background: qualityData.overall === "FAIL" ? "#fff2f0" : qualityData.overall === "PASS" ? "#f6ffed" : "#fffbe6" }}>
              <td style={{ padding: "4px 6px", fontWeight: 600, color: "#333", borderBottom: "1px solid #f0f0f0" }}>卖出信号</td>
              <td style={{ padding: "4px 6px", color: "#555", borderBottom: "1px solid #f0f0f0" }}>
                {qualityData.overall === "FAIL" ? "已触发排除，建议 입立即清仓" :
                 "当股价距离买入价下跌30%以上且质量指标恶化时清仓"}
              </td>
            </tr>
            <tr style={{ background: qualityData.overall === "FAIL" ? "#fff2f0" : qualityData.overall === "PASS" ? "#f6ffed" : "#fffbe6" }}>
              <td style={{ padding: "4px 6px", fontWeight: 600, color: "#333" }}>加仓信号</td>
              <td style={{ padding: "4px 6px", color: "#555" }}>
                {qualityData.overall === "PASS" ? "股价回调至估值合理区间下缘且质量仍然达标时加仓" :
                 "暂无加仓信号，等待质量改善"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{
        padding: "10px 12px", borderRadius: 8,
        background: qualityData.overall === "PASS" ? "#f6ffed" : qualityData.overall === "FAIL" ? "#fff2f0" : "#fffbe6",
        border: "1px solid " + (qualityData.overall === "PASS" ? "#b7eb8f" : qualityData.overall === "FAIL" ? "#ffa39e" : "#ffe58f")
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: overallColor(qualityData.overall) }}>
          {qualityData.overall === "PASS" ? "✅ 综合结论：质量合格" :
           qualityData.overall === "FAIL" ? "❌ 综合结论：已被排除" :
           "⚠️ 综合结论：边界通过"}
        </div>
        <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
          {qualityData.overall === "FAIL" ? (
            "已被 quality-screen 7项指标排除，建议停止研究。若发生重大异动，可用 news-pulse 判断是否有实质变化。"
          ) : qualityData.overall === "MARGINAL" ? (
            "边界通过。建议用 news-pulse 监控异动，仅当认为值得深入时再运行 investment-research。"
          ) : (
            "质量达标。若股价异动可用 news-pulse 归因。值得深入时再运行 investment-research 或 investment-team。"
          )}
        </div>
        {np?.hasResult && (
          <div style={{
            marginTop: 6, padding: "6px 8px", background: "#fff",
            borderRadius: 4, fontSize: 12, color: "#555", lineHeight: 1.5
          }}>
            <span style={{ fontWeight: 500 }}>异动归因提示：</span>
            {np.summary}
          </div>
        )}
      </div>
    </Card>
  );
};

export default ValueQualityCard;
