# -*- coding: utf-8 -*-
import sys, os, glob, textwrap, datetime

sys.path = [r"C:\Users\25384\.cache\codex-runtimes\codex-primary-runtime\dependencies\python"] + sys.path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, black, white, grey
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, Preformatted, KeepTogether, HRFlowable
)

# ---- Register Chinese font ----
font_dirs = [
    r"C:\Windows\Fonts",
    r"C:\Users\25384\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\Lib\site-packages\reportlab\fonts",
]
ZH = "Helvetica"
for d in font_dirs:
    for f in glob.glob(os.path.join(d, "*.ttf")):
        bn = os.path.basename(f).lower()
        if "yahei" in bn or "msyh" in bn:
            try:
                pdfmetrics.registerFont(TTFont("ZH", f))
                ZH = "ZH"
                break
            except: pass
    if ZH != "Helvetica": break
if ZH == "Helvetica":
    for d in font_dirs:
        for f in glob.glob(os.path.join(d, "simsun*.ttf")):
            try:
                pdfmetrics.registerFont(TTFont("ZH", f))
                ZH = "ZH"
                break
            except: pass
        if ZH != "Helvetica": break

# ---- Styles ----
PAGE_W, PAGE_H = A4
MARGIN = 2 * cm

styles = getSampleStyleSheet()

def make_style(name, parent="Normal", **kw):
    base = styles[parent]
    return ParagraphStyle(name, parent=base, fontName=ZH if "fontName" not in kw else kw.pop("fontName"), **kw)

sTitle = make_style("CTitle", fontSize=24, leading=32, alignment=TA_CENTER, spaceAfter=6*mm, textColor=HexColor("#1a1a2e"))
sSubtitle = make_style("CSub", fontSize=12, leading=18, alignment=TA_CENTER, textColor=HexColor("#555555"), spaceAfter=3*mm)
sH1 = make_style("CH1", fontSize=16, leading=22, spaceBefore=8*mm, spaceAfter=4*mm, textColor=HexColor("#1a1a2e"))
sH2 = make_style("CH2", fontSize=13, leading=18, spaceBefore=5*mm, spaceAfter=3*mm, textColor=HexColor("#2d3436"))
sH3 = make_style("CH3", fontSize=11, leading=15, spaceBefore=3*mm, spaceAfter=2*mm, textColor=HexColor("#636e72"))
sBody = make_style("CBody", fontSize=10, leading=16, spaceAfter=2*mm, alignment=TA_JUSTIFY)
sCode = ParagraphStyle("CCode", parent=styles["Code"], fontName="Courier", fontSize=8, leading=11, leftIndent=4*mm, spaceAfter=2*mm, backColor=HexColor("#f5f5f5"), borderPadding=4)
sBullet = make_style("CBullet", fontSize=10, leading=16, leftIndent=8*mm, spaceAfter=1*mm)
sMeta = make_style("CMeta", fontSize=8, leading=11, alignment=TA_CENTER, textColor=HexColor("#999999"))
sFooter = make_style("CFooter", fontSize=8, leading=10, alignment=TA_CENTER, textColor=HexColor("#aaaaaa"))

# ---- Helpers ----
def h1(t): return Paragraph(f"<b>{t}</b>", sH1)
def h2(t): return Paragraph(f"<b>{t}</b>", sH2)
def h3(t): return Paragraph(f"<b>{t}</b>", sH3)
def body(t): return Paragraph(t.replace("\n", "<br/>"), sBody)
def bullet(t): return Paragraph(f"• {t}", sBullet)
def code(t): return Preformatted(t, sCode)
def spacer(h=3): return Spacer(1, h*mm)
def hr(): return HRFlowable(width="100%", thickness=0.5, color=HexColor("#dddddd"), spaceAfter=3*mm, spaceBefore=3*mm)

RED = HexColor("#cf1322")
GREEN = HexColor("#3cb371")
GRAY = HexColor("#999999")

def color_text(t, c):
    return f'<font color="{c.hexval()}">{t}</font>'

# ---- Build document ----
output_path = r"F:\ai炒股训练\聊天记录_Codex会话.pdf"
doc = SimpleDocTemplate(
    output_path, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=MARGIN, bottomMargin=MARGIN,
    title="Codex Chat Session",
    author="Codex AI Agent",
)

elements = []

# ---- TITLE PAGE ----
elements.append(Spacer(1, 5*cm))
elements.append(Paragraph("<b>Codex 对话记录</b>", sTitle))
elements.append(Paragraph("<b>Codex Chat Session Log</b>", sSubtitle))
elements.append(spacer(5))
elements.append(hr())
elements.append(Paragraph(f"生成时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", sMeta))
elements.append(Paragraph(f"工作目录: F:\\ai炒股训练", sMeta))
elements.append(Paragraph(f"项目: 股票分析工具 — A股技术分析网页应用 + 微信小程序", sMeta))
elements.append(Spacer(1, 2*cm))

# Table of contents-like quick links
elements.append(h2("目录 / Contents"))
toc_items = [
    "1. 会话概览 / Session Overview",
    "2. 系统上下文 / System Context",
    "3. 项目架构 / Project Architecture",
    "4. 技术栈 / Technology Stack",
    "5. 后端路由与核心服务 / Backend Routes & Services",
    "6. 前端组件 / Frontend Components",
    "7. 视觉规范 / Visual Guidelines",
    "8. 业务逻辑 / Business Logic",
    "9. 代码工作规则 / Codex Work Rules",
]
for item in toc_items:
    elements.append(bullet(item))

elements.append(PageBreak())

# ---- SECTION 1: SESSION OVERVIEW ----
elements.append(h1("1. 会话概览 / Session Overview"))
elements.append(body("本次会话是对 <b>股票分析工具</b> 项目的全面技术探讨与代码开发。项目包含 PC 端 React 网页应用和微信小程序两个前端，共享同一 Node.js/Express 后端服务。"))
elements.append(body("会话主要涵盖：项目整体架构分析、后端服务理解、前端组件体系、数据流设计、视觉规范、以及开发工作流指南。同时生成了此 PDF 文档作为对话记录存档。"))
elements.append(spacer())

# ---- SECTION 2: SYSTEM CONTEXT ----
elements.append(h1("2. 系统上下文 / System Context"))
elements.append(h2("2.1 用户信息"))
elements.append(body(f"• 用户: {color_text('ryan', RED)}（253840533@qq.com）"))
elements.append(body(f"• 服务器: 阿里云 47.97.6.167"))
elements.append(body(f"• 本地端口: 服务端 3003，客户端 5174"))
elements.append(body(f"• 当前日期: 2026-07-02"))
elements.append(spacer())

elements.append(h2("2.2 项目目录结构"))
elements.append(code(
"F:\ai炒股训练\
"
"├── stock-analysis-app/          # PC 端 React 应用
"
"│   ├── src/                     # 前端源码
"
"│   │   ├── components/          # React 组件
"
"│   │   ├── pages/               # 页面 (HomePage, AnalysisPage)
"
"│   │   ├── hooks/               # 自定义 Hooks (usePolling)
"
"│   │   ├── api/                 # API 封装 (stockApi.ts)
"
"│   │   ├── utils/               # 工具函数
"
"│   │   └── types/               # TypeScript 类型定义
"
"│   └── server/                  # Express 后端
"
"│       ├── services/            # 核心业务服务
"
"│       └── index.ts             # 应用入口
"
"├── stock-analysis-miniapp-native/  # 微信小程序
"
"│   └── pages/
"
"│       ├── index/               # 搜索页
"
"│       └── analysis/            # 分析页
"
"├── AGENTS.md                    # Codex 工作指令
"
"└── stock_analysis.db            # SQLite 数据库"
))
elements.append(spacer())

# ---- SECTION 3: PROJECT ARCHITECTURE ----
elements.append(h1("3. 项目架构 / Project Architecture"))
elements.append(body("项目采用经典的前后端分离架构，后端 Express 提供 RESTful API，前端 React 负责 UI 渲染和数据可视化，另有微信小程序作为移动端入口。"))
elements.append(spacer())

elements.append(h2("3.1 系统架构图"))
arch_text = (
"┌─────────────────────────────────────────────────────────────┐
"
"│                        用户层                               │
"
"│   ┌─────────────────┐    ┌──────────────────────────────┐  │
"
"│   │  PC Web (React) │    │  微信小程序 (原生 WXML/WXSS) │  │
"
"│   │  localhost:5174 │    │  (直接上传微信平台)          │  │
"
"│   └────────┬────────┘    └──────────────┬───────────────┘  │
"
"└────────────┼────────────────────────────┼──────────────────┘
"
"             │         HTTP/HTTPS         │
"
"             ▼                            ▼
"
"┌─────────────────────────────────────────────────────────────┐
"
"│                  API 层 (/api/stock/*)                      │
"
"│   Express 4 + tsx 热重载，端口 3003                         │
"
"│   支持：分析 / 分时 / 行情 / 资金流 / 逐笔 / 搜索 / 指数   │
"
"└────────────────────────┬────────────────────────────────────┘
"
"                         │
"
"          ┌──────────────┼──────────────┐
"
"          ▼              ▼              ▼
"
"   ┌──────────┐  ┌────────────┐  ┌──────────┐
"
"   │stock-sdk │  │ 腾讯 API   │  │ 新浪 API │
"
"   │ (主数据) │  │ (实时/备)  │  │ (备用)   │
"
"   └──────────┘  └────────────┘  └──────────┘
"
"          │              │              │
"
"          ▼              ▼              ▼
"
"   ┌────────────────────────────────────────┐
"
"   │              缓存层                     │
"
"   │   内存缓存 (node-cache, 300s)          │
"
"   │   + JSON 文件缓存 (data/*.json, 1h)   │
"
"   └────────────────────────────────────────┘
"
)
elements.append(code(arch_text))
elements.append(spacer())

# ---- SECTION 4: TECHNOLOGY STACK ----
elements.append(h1("4. 技术栈 / Technology Stack"))
elements.append(spacer())

tech_data = [
    ["层级", "技术", "版本/说明"],
    ["前端框架", "React 18 + TypeScript", "函数组件 + Hooks"],
    ["路由", "react-router-dom", "v6"],
    ["UI 组件库", "Ant Design", "v5，中文"],
    ["图表", "ECharts 5 + echarts-for-react", "K线、分时、指标"],
    ["日期处理", "dayjs", "替代 moment"],
    ["构建工具", "Vite", "v5，HMR"],
    ["后端框架", "Express 4 + tsx", "热重载"],
    ["股票数据", "stock-sdk", "v1.10"],
    ["预测算法", "ARIMA", "时间序列预测"],
    ["数据缓存", "node-cache + JSON", "双层缓存策略"],
]

t = Table(tech_data, colWidths=[3.5*cm, 5*cm, 7*cm])
t.setStyle(TableStyle([
    ("FONTNAME", (0,0), (-1,-1), ZH),
    ("FONTSIZE", (0,0), (-1,-1), 9),
    ("BACKGROUND", (0,0), (-1,0), HexColor("#1a1a2e")),
    ("TEXTCOLOR", (0,0), (-1,0), white),
    ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("GRID", (0,0), (-1,-1), 0.5, HexColor("#cccccc")),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, HexColor("#f8f9fa")]),
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
]))
elements.append(t)
elements.append(spacer())

# ---- SECTION 5: BACKEND ----
elements.append(h1("5. 后端路由与核心服务 / Backend Routes & Services"))
elements.append(spacer())

elements.append(h2("5.1 完整路由列表"))

route_data = [
    ["路由", "功能", "参数"],
    ["/:code/analysis", "完整分析", "count=200, predictDays=10"],
    ["/:code/intraday", "分时数据", "15秒轮询"],
    ["/:code/quote", "实时行情", "5秒轮询"],
    ["/:code/fund-flow", "资金流向", "60秒轮询"],
    ["/:code/transactions", "逐笔成交", "count=100"],
    [":code/purchase-analysis", "买入诊断", "buyPrice="],
    [":code/backtest", "预测回测", "—"],
    [":code/signal-backtest", "信号回测", "—"],
    [":code/quantitative", "量化分析", "—"],
    ["/search", "股票搜索", "q="],
    ["/indices", "大盘指数", "—"],
    ["/aggregate-stats", "预测汇总", "—"],
    ["/daily-report", "每日报表", "—"],
]

t = Table(route_data, colWidths=[5*cm, 4*cm, 7*cm])
t.setStyle(TableStyle([
    ("FONTNAME", (0,0), (-1,-1), ZH),
    ("FONTSIZE", (0,0), (-1,-1), 8),
    ("BACKGROUND", (0,0), (-1,0), HexColor("#1a1a2e")),
    ("TEXTCOLOR", (0,0), (-1,0), white),
    ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("GRID", (0,0), (-1,-1), 0.5, HexColor("#cccccc")),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, HexColor("#f8f9fa")]),
    ("TOPPADDING", (0,0), (-1,-1), 3),
    ("BOTTOMPADDING", (0,0), (-1,-1), 3),
]))
elements.append(t)
elements.append(spacer())

elements.append(h2("5.2 核心服务"))

svc_data = [
    ["服务文件", "功能说明"],
    ["stockDataService.ts", "搜索、行情、K线（4级降级策略）、资金流向"],
    ["predictionService.ts", "ARIMA预测，SMA降级"],
    ["signalService.ts", "多指标加权评分 > 买卖信号"],
    ["cacheService.ts", "node-cache + JSON文件缓存"],
    ["marketContextService.ts", "市场级别上下文（板块/指数）"],
    ["quantitativeEngine.ts", "数据质量/风险/微观结构/统计套利"],
    ["riskManagementService.ts", "VaR、夏普比率、Kelly仓位"],
    ["marketMicrostructureService.ts", "订单失衡、VWAP偏离、流动性"],
    ["signalBacktestService.ts", "买卖信号历史回测"],
]

t = Table(svc_data, colWidths=[6*cm, 10*cm])
t.setStyle(TableStyle([
    ("FONTNAME", (0,0), (-1,-1), ZH),
    ("FONTSIZE", (0,0), (-1,-1), 8),
    ("BACKGROUND", (0,0), (-1,0), HexColor("#1a1a2e")),
    ("TEXTCOLOR", (0,0), (-1,0), white),
    ("ALIGN", (0,0), (0,-1), "LEFT"),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("GRID", (0,0), (-1,-1), 0.5, HexColor("#cccccc")),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, HexColor("#f8f9fa")]),
    ("TOPPADDING", (0,0), (-1,-1), 3),
    ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ("LEFTPADDING", (0,0), (-1,-1), 4),
]))
elements.append(t)
elements.append(spacer())

elements.append(h2("5.3 数据降级策略"))
elements.append(body("K线数据采用4级降级策略，确保数据可用性："))
elements.append(bullet("1️⃣ <b>stock-sdk</b>（主数据源）：搜索、基础行情、K线"))
elements.append(bullet("2️⃣ 无指标模式：降级去除技术指标计算"))
elements.append(bullet("3️⃣ 原始K线：直接返回原始数据"))
elements.append(bullet("4️⃣ 腾讯 fqkline API：最后兜底"))
elements.append(spacer())

elements.append(h2("5.4 缓存策略"))
elements.append(bullet(f"CacheService 写入 {color_text('data/*.json', GRAY)}，TTL 可配置"))
elements.append(bullet("分析结果缓存1小时"))
elements.append(bullet("如需强制刷新，删除 data/*.json 后重启服务"))
elements.append(bullet("内存缓存 (node-cache): 300秒"))
elements.append(bullet("股票列表: 24h，日K线: 1h，预测: 1h"))

# ---- SECTION 6: FRONTEND ----
elements.append(PageBreak())
elements.append(h1("6. 前端组件 / Frontend Components"))
elements.append(spacer())

elements.append(h2("6.1 页面"))
elements.append(bullet(f"<b>首页</b> (HomePage.tsx): 搜索栏 + 功能卡片"))
elements.append(bullet(f"<b>分析页</b> (AnalysisPage.tsx): 组装所有组件，核心业务页"))
elements.append(spacer())

elements.append(h2("6.2 组件列表"))

comp_data = [
    ["组件", "数据来源", "功能"],
    ["StockOverview", "liveInfo", "实时价格/涨跌幅/成交量/换手率/市值"],
    ["IntradayChart", "/intraday", "ECharts分时折线图+成交量"],
    ["Level5Panel", "/quote", "五档盘口+逐笔详情"],
    ["TransactionDetails", "/transactions", "逐笔成交明细"],
    ["KlineChart", "/analysis", "ECharts K线+MA/布林带/信号"],
    ["IndicatorCharts", "/analysis", "MACD+RSI+KDJ迷你图表"],
    ["PredictionChart", "/analysis", "ARIMA预测+置信区间"],
    ["SignalPanel", "/analysis", "综合信号+支撑阻力位"],
    ["MarketRecap", "/analysis", "自动文字复盘"],
    ["LimitPredictionBanner", "/analysis+/quote", "涨停/跌停连板预测"],
    ["CloseRatingCard", "/analysis", "收盘评分"],
    ["QuantitativePanel", "/quantitative", "量化分析面板"],
    ["PositionAdvice", "/analysis", "建仓/减仓徽章"],
]

t = Table(comp_data, colWidths=[3.5*cm, 3*cm, 10*cm])
t.setStyle(TableStyle([
    ("FONTNAME", (0,0), (-1,-1), ZH),
    ("FONTSIZE", (0,0), (-1,-1), 8),
    ("BACKGROUND", (0,0), (-1,0), HexColor("#1a1a2e")),
    ("TEXTCOLOR", (0,0), (-1,0), white),
    ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("GRID", (0,0), (-1,-1), 0.5, HexColor("#cccccc")),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, HexColor("#f8f9fa")]),
    ("TOPPADDING", (0,0), (-1,-1), 3),
    ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ("LEFTPADDING", (0,0), (-1,-1), 3),
]))
elements.append(t)
elements.append(spacer())

elements.append(h2("6.3 分析页组件布局顺序"))
layout = (
"1. StockOverview — 基本信息+价格
"
"2. 分时图 + Level5Panel（左右并排）
"
"3. AdvancedSignalLegend（高级信号说明）
"
"4. IntradayChart — 今日分时
"
"5. KlineChart — K线图
"
"6. IndicatorCharts — 指标图表
"
"7. LimitPredictionBanner — 涨停/跌停预测
"
"8. MarketRecap — 当日复盘
"
"9. CloseRatingCard — 收盘评分
"
"10. PredictionChart — 预测
"
"11. BacktestReport + PredictionComparisonChart — 回测
"
"12. PurchaseAnalysis — 买入诊断
"
"13. SignalPanel — 买卖信号
"
"14. SignalBacktestCard — 信号回测
"
"15. QuantitativePanel — 量化分析"
)
elements.append(code(layout))
elements.append(spacer())

elements.append(h2("6.4 轮询机制"))
poll_data = [
    ["数据", "轮询间隔", "条件"],
    ["实时行情 (quote)", "5秒", "交易时段 + 页面可见"],
    ["分时数据 (intraday)", "15秒", "交易时段 + 页面可见"],
    ["资金流向 (fund-flow)", "60秒", "交易时段 + 页面可见"],
    ["大盘指数", "30秒", "交易时段 + 页面可见"],
    ["标签栏报价", "5秒", "交易时段 + 页面可见"],
]
t = Table(poll_data, colWidths=[5*cm, 3.5*cm, 7.5*cm])
t.setStyle(TableStyle([
    ("FONTNAME", (0,0), (-1,-1), ZH),
    ("FONTSIZE", (0,0), (-1,-1), 8),
    ("BACKGROUND", (0,0), (-1,0), HexColor("#1a1a2e")),
    ("TEXTCOLOR", (0,0), (-1,0), white),
    ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("GRID", (0,0), (-1,-1), 0.5, HexColor("#cccccc")),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, HexColor("#f8f9fa")]),
    ("TOPPADDING", (0,0), (-1,-1), 3),
    ("BOTTOMPADDING", (0,0), (-1,-1), 3),
]))
elements.append(t)
elements.append(spacer())

# ---- SECTION 7: VISUAL GUIDELINES ----
elements.append(PageBreak())
elements.append(h1("7. 视觉规范 / Visual Guidelines"))
elements.append(spacer())

elements.append(h2("7.1 颜色规则"))
color_data = [
    ["场景", "颜色", "色值"],
    ["上涨 (change > 0)", "红色", "#cf1322"],
    ["下跌 (change < 0)", "绿色", "#3cb371"],
    ["不涨不跌 (change = 0)", "灰色", "#999999"],
    ["实时状态指示", "绿点", "#52c41a"],
    ["蓝色强调", "蓝色", "#1677ff"],
    ["无数据/占位", "灰色", "#999999"],
]
t = Table(color_data, colWidths=[5*cm, 3*cm, 3*cm])
t.setStyle(TableStyle([
    ("FONTNAME", (0,0), (-1,-1), ZH),
    ("FONTSIZE", (0,0), (-1,-1), 9),
    ("BACKGROUND", (0,0), (-1,0), HexColor("#1a1a2e")),
    ("TEXTCOLOR", (0,0), (-1,0), white),
    ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("GRID", (0,0), (-1,-1), 0.5, HexColor("#cccccc")),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, HexColor("#f8f9fa")]),
    ("TOPPADDING", (0,0), (-1,-1), 3),
    ("BOTTOMPADDING", (0,0), (-1,-1), 3),
]))
elements.append(t)
elements.append(spacer())

elements.append(h2("7.2 涨跌停 Banner 颜色"))
elements.append(bullet("涨停：红色系渐变 #fff2f0 → #fff7e6"))
elements.append(bullet("跌停：绿色系渐变 #f6ffed → #e6fffb"))
elements.append(bullet("标签文字/边框/图标颜色根据 isLimitUp 动态切换"))
elements.append(spacer())

elements.append(h2("7.3 量化分析模块配色"))
elements.append(bullet("B1（风险评估）：SafetyOutlined 图标"))
elements.append(bullet("E1（行情特征）：FireOutlined 图标"))
elements.append(bullet("F1（操作建议）：FundOutlined 图标"))
elements.append(bullet("综合评分 ≥ 80 绿、≥ 60 黄、< 60 红"))
elements.append(bullet("操作建议：success=可参与、warning=观望、error=回避"))

# ---- SECTION 8: BUSINESS LOGIC ----
elements.append(h1("8. 关键业务逻辑 / Business Logic"))
elements.append(spacer())

elements.append(h2("8.1 股票代码标准化"))
elements.append(code(
"600XXX > sh600XXX（上海主板）
"
"000XXX/001XXX/002XXX > sz000XXX（深圳）
"
"300XXX > sz300XXX（创业板）
"
"688XXX > sh688XXX（科创板）
"
"8XXXXX > bj8XXXXX（北交所）
"
"00XXX  > hk00XXX（港股）"
))
elements.append(spacer())

elements.append(h2("8.2 换手率计算"))
elements.append(bullet("优先取腾讯 API 原始值（parts[38]）"))
elements.append(bullet("降级计算：volume_shares / ((marketCap * 100000000) / price) * 100"))
elements.append(bullet("stock-sdk 的 marketCap 单位为 '亿'"))
elements.append(spacer())

elements.append(h2("8.3 涨跌停检测"))
elements.append(bullet("优先使用接口返回的涨跌停价（info.limitUp / info.limitDown）"))
elements.append(bullet("降级：涨幅 ≥ 9.6% 判断为涨停，跌幅 ≤ -9.6% 判断为跌停"))
elements.append(bullet("两个条件独立判断，互不排斥"))
elements.append(spacer())

elements.append(h2("8.4 封单量逻辑"))
elements.append(bullet("涨停封单 = 买一量（buy1Vol）— 买盘堆积"))
elements.append(bullet("跌停封单 = 卖一量（sell1Vol）— 卖盘堆积"))
elements.append(bullet("封单额（元）= 封单量(手) × 100 × 涨跌停价"))
elements.append(bullet("封单占比(%) = 封单额 / 总成交额 × 100"))
elements.append(spacer())

elements.append(h2("8.5 腾讯 qt.gtimg.cn 字段解析"))
field_data = [
    ["索引", "字段", "说明"],
    ["10", "买一量", "手"],
    ["20", "卖一量", "手"],
    ["38", "换手率", "%"],
    ["44", "总市值", "元"],
    ["47", "涨停价", "—"],
    ["48", "跌停价", "—"],
]
t = Table(field_data, colWidths=[3*cm, 4*cm, 4*cm])
t.setStyle(TableStyle([
    ("FONTNAME", (0,0), (-1,-1), ZH),
    ("FONTSIZE", (0,0), (-1,-1), 9),
    ("BACKGROUND", (0,0), (-1,0), HexColor("#1a1a2e")),
    ("TEXTCOLOR", (0,0), (-1,0), white),
    ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("GRID", (0,0), (-1,-1), 0.5, HexColor("#cccccc")),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, HexColor("#f8f9fa")]),
    ("TOPPADDING", (0,0), (-1,-1), 3),
    ("BOTTOMPADDING", (0,0), (-1,-1), 3),
]))
elements.append(t)

# ---- SECTION 9: CODEX WORK RULES ----
elements.append(PageBreak())
elements.append(h1("9. Codex 工作规则 / Codex Work Rules"))
elements.append(spacer())

elements.append(h2("9.1 修改要求"))
elements.append(bullet("API 改动必须同步到 PC 和小程序两端"))
elements.append(bullet("每次修改需要同时更新 PC 端和小程序端（如果涉及功能）"))
elements.append(spacer())

elements.append(h2("9.2 状态覆盖"))
elements.append(body("所有组件需处理以下四种状态："))
elements.append(bullet(f"{color_text('1. 加载中', '#1677ff')}— LoadingSpinner"))
elements.append(bullet(f"{color_text('2. 错误', RED)}— ErrorState，带重试按钮"))
elements.append(bullet(f"{color_text('3. 空数据', GRAY)}— EmptyState"))
elements.append(bullet(f"{color_text('4. 正常数据', GREEN)}— 正常展示"))
elements.append(spacer())

elements.append(h2("9.3 Ant Design v5 兼容"))
elements.append(bullet("使用 styles={{ body: {...} }} 替代 bodyStyle"))
elements.append(bullet("使用 styles={{ root: {...} }} 替代 overlayStyle"))
elements.append(bullet("使用 Col xs={24} sm={12} md={8} lg={6} 实现响应式布局"))
elements.append(spacer())

elements.append(h2("9.4 文件编码"))
elements.append(bullet("所有源文件使用 UTF-8 编码"))
elements.append(bullet("避免使用 PowerShell 的 Set-Content 修改含中文的文件（会导致编码损坏）"))
elements.append(bullet("优先使用 [System.IO.File]::ReadAllBytes/WriteAllBytes 或 Node.js 操作含中文的文件"))
elements.append(spacer())

elements.append(h2("9.5 修改规范性"))
elements.append(bullet("不要在 JSX 中添加不必要的行内注释"))
elements.append(bullet("涨跌颜色遵循 #cf1322(红涨) / #3cb371(绿跌) / #999(灰平)"))
elements.append(bullet("涨跌停 Banner 标签需根据 isLimitUp 动态切换"))
elements.append(bullet("五档盘口逐笔详情收起时显示4条，展开时完整展示"))
elements.append(bullet("今日分时最高/最低标注的百分比颜色根据数值正负动态取色"))
elements.append(spacer())

elements.append(h2("9.6 部署相关"))
elements.append(bullet("线上服务器：47.97.6.167（阿里云）"))
elements.append(bullet("生产构建: npm run build"))
elements.append(bullet("生产启动: npm start"))
elements.append(bullet("重启线上服务: pkill -f tsx → nohup npx tsx server/index.ts &"))

# ---- BUILD ----
doc.build(elements)
print(f"PDF generated successfully: {output_path}")
print(f"Pages: (see output)")
