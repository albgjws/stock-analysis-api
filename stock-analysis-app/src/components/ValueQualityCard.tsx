import React from "react";
import { Card, Tag, Row, Col, Progress, Tooltip } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  WarningOutlined,
  StarFilled,
  StarOutlined,
} from "@ant-design/icons";

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

export interface ValueQualityData {
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

interface Props {
  data: ValueQualityData | null;
  loading?: boolean;
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
    case "PASS":
      return "green";
    case "FAIL":
      return "red";
    case "MARGINAL":
      return "orange";
    default:
      return "default";
  }
};

const overallColor = (overall: string) => {
  switch (overall) {
    case "PASS":
      return "#52c41a";
    case "MARGINAL":
      return "#faad14";
    case "FAIL":
      return "#cf1322";
    default:
      return "#999";
  }
};

const overallLabel = (overall: string) => {
  switch (overall) {
    case "PASS":
      return "通过 ✓";
    case "MARGINAL":
      return "临界 ⚠";
    case "FAIL":
      return "未通过 ✗";
    default:
      return "未知";
  }
};

const masterIcon = (score: number) => {
  if (score >= 4) return <StarFilled style={{ color: "#faad14" }} />;
  if (score >= 3) return <StarFilled style={{ color: "#1677ff" }} />;
  return <StarOutlined style={{ color: "#999" }} />;
};

const ValueQualityCard: React.FC<Props> = ({ data, loading }) => {
  if (loading) {
    return (
      <Card size="small" loading style={{ marginBottom: 12 }}>
        加载中...
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card
      size="small"
      title={
        <span>
          🔍 AI Berkshire 价值质量评估
          <Tag
            color={overallColor(data.overall)}
            style={{ marginLeft: 8, fontWeight: "bold" }}
          >
            {overallLabel(data.overall)} {data.totalScore}/105
          </Tag>
        </span>
      }
      style={{ marginBottom: 12, borderLeft: `3px solid ${overallColor(data.overall)}` }}
    >
      {/* 评语 */}
      <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
        {data.commentary}
      </div>

      {/* 四大师评分 */}
      <Row gutter={[8, 8]} style={{ marginBottom: 10 }}>
        <Col span={6}>
          <Tooltip title="巴菲特 — 财务估值 护城河">
            <div style={{ textAlign: "center", background: "#f5f5f5", borderRadius: 6, padding: "4px 0" }}>
              <div style={{ fontSize: 11, color: "#999" }}>巴菲特</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: data.mastersScore.buffet >= 4 ? "#52c41a" : "#333" }}>
                {masterIcon(data.mastersScore.buffet)} {data.mastersScore.buffet}
              </div>
            </div>
          </Tooltip>
        </Col>
        <Col span={6}>
          <Tooltip title="芒格 — 逆向思维 护城河宽度">
            <div style={{ textAlign: "center", background: "#f5f5f5", borderRadius: 6, padding: "4px 0" }}>
              <div style={{ fontSize: 11, color: "#999" }}>芒格</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: data.mastersScore.munger >= 4 ? "#52c41a" : "#333" }}>
                {masterIcon(data.mastersScore.munger)} {data.mastersScore.munger}
              </div>
            </div>
          </Tooltip>
        </Col>
        <Col span={6}>
          <Tooltip title="段永平 — 商业模式 好生意">
            <div style={{ textAlign: "center", background: "#f5f5f5", borderRadius: 6, padding: "4px 0" }}>
              <div style={{ fontSize: 11, color: "#999" }}>段永平</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: data.mastersScore.duan >= 4 ? "#52c41a" : "#333" }}>
                {masterIcon(data.mastersScore.duan)} {data.mastersScore.duan}
              </div>
            </div>
          </Tooltip>
        </Col>
        <Col span={6}>
          <Tooltip title="李录 — 长期确定性">
            <div style={{ textAlign: "center", background: "#f5f5f5", borderRadius: 6, padding: "4px 0" }}>
              <div style={{ fontSize: 11, color: "#999" }}>李录</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: data.mastersScore.lulu >= 4 ? "#52c41a" : "#333" }}>
                {masterIcon(data.mastersScore.lulu)} {data.mastersScore.lulu}
              </div>
            </div>
          </Tooltip>
        </Col>
      </Row>

      {/* 7项质量指标 */}
      <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
        七项质量筛选（AI Berkshire 四大师框架）
      </div>
      {data.indicators.map((ind) => (
        <Row key={ind.id} gutter={[4, 4]} style={{ marginBottom: 2, alignItems: "center" }}>
          <Col span={1} style={{ textAlign: "center" }}>
            {statusIcon(ind.status)}
          </Col>
          <Col span={5}>
            <span style={{ fontSize: 12 }}>{ind.name}</span>
          </Col>
          <Col span={3}>
            <span style={{ fontSize: 12, color: "#999" }}>
              {ind.value !== null ? ind.value + (ind.unit || "") : "—"}
            </span>
          </Col>
          <Col span={10}>
            <Progress
              percent={Math.min(100, (ind.score / 15) * 100)}
              size="small"
              showInfo={false}
              strokeColor={statusColor(ind.status)}
              style={{ margin: 0 }}
            />
          </Col>
          <Col span={5}>
            <Tag color={statusColor(ind.status)} style={{ fontSize: 11, margin: 0 }}>
              {ind.status === "PASS" ? "通过" : ind.status === "FAIL" ? "未通过" : ind.status === "MARGINAL" ? "临界" : "数据不足"}
            </Tag>
          </Col>
        </Row>
      ))}

      {/* 豁免说明 */}
      {data.exemptions.length > 0 && (
        <div style={{ marginTop: 8, padding: "6px 8px", background: "#fffbe6", borderRadius: 4, fontSize: 12, color: "#ad6800" }}>
          <WarningOutlined /> 豁免条件触发：
          {data.exemptions.map((e, i) => (
            <div key={i} style={{ marginLeft: 16 }}>• {e}</div>
          ))}
        </div>
      )}

      {/* 策略建议 */}
      {data.strategy && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 6 }}>
            📋 投资策略建议（AI Berkshire 四大师框架）
          </div>
          <div style={{ padding: "8px 10px", background: data.strategy.action === "buy" ? "#f6ffed" : data.strategy.action === "avoid" ? "#fff2f0" : "#fffbe6", borderRadius: 6, border: "1px solid " + (data.strategy.action === "buy" ? "#b7eb8f" : data.strategy.action === "avoid" ? "#ffa39e" : "#ffe58f") }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 4 }}>
              {data.strategy.style}
              <Tag style={{ marginLeft: 6, fontSize: 11 }} color={data.strategy.action === "buy" ? "green" : data.strategy.action === "avoid" ? "red" : "orange"}>
                {data.strategy.action === "buy" ? "买入" : data.strategy.action === "hold" ? "持有" : data.strategy.action === "watch" ? "观望" : "回避"}
              </Tag>
              <span style={{ fontSize: 11, color: "#999", fontWeight: 400, marginLeft: 6 }}>
                — 侧重 {data.strategy.master}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
              {data.strategy.description}
            </div>
          </div>
        </div>
      )}

      {/* 分层买卖建议 */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 6 }}>
            📊 分层操作建议
          </div>
          {data.recommendations.map((rec, i) => (
            <div key={i} style={{ padding: "6px 8px", background: i === 0 ? "#f6ffed" : i === 2 ? "#fff2f0" : "#fffbe6", borderRadius: 4, marginBottom: 4, border: "1px solid " + (i === 0 ? "#b7eb8f" : i === 2 ? "#ffa39e" : "#ffe58f") }}>
              <Row gutter={[0, 0]} align="middle">
                <Col span={4}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{rec.levelLabel}</span>
                </Col>
                <Col span={4}>
                  {rec.action !== "止盈" && rec.action !== "止损" ? <Tag color={rec.action === "止盈" ? "blue" : rec.action === "止损" ? "volcano" : rec.action.includes("不") || rec.action.includes("回避") ? "red" : rec.action.includes("买入") || rec.action.includes("建仓") ? "green" : "orange"} style={{ fontSize: 11 }}>
                    {rec.action}
                  </Tag> : <span style={{fontSize:12,fontWeight:600,color:rec.action==='止盈'?'#1677ff':'#e84749'}}>{rec.action}</span>}
                </Col>
                <Col span={6}>
                  <span style={{ fontSize: 11, color: "#666" }}>{rec.priceRange}</span>
                </Col>
                <Col span={4}>
                  <span style={{ fontSize: 11, color: "#1677ff", fontWeight: 500 }}>{rec.position}</span>
                </Col>
                <Col span={6}>
                  <Tooltip title={rec.detail}>
                    <span style={{ fontSize: 11, color: "#999", cursor: "help", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", maxWidth: 120 }}>
                      {rec.detail}
                    </span>
                  </Tooltip>
                </Col>
              </Row>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default ValueQualityCard;
