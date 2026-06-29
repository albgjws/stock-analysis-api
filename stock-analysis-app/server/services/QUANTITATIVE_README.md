# 量化分析模块

本目录下的服务实现了《打开量化投资的黑箱》《量化交易》《算法交易》等著作中的核心量化理念，将传统技术分析升级为系统化的量化框架。

## 架构概览

```
server/services/
├── dataQualityService.ts        # 数据质控层
├── riskManagementService.ts     # 风险管理层
├── marketMicrostructureService.ts # 微观结构层
├── statisticalArbitrageService.ts # 统计套利层
└── quantitativeEngine.ts        # 量化引擎（整合层）
```

## 模块详解

### 1. DataQualityService — 数据质控

**来源**: 《利用Python进行数据分析》《打开量化投资的黑箱》

量化交易80%的时间花在数据清洗上。本服务实现了：

- **Modified Z-Score异常检测**：用中位数代替均值，对金融数据更鲁棒，避免极端值污染判断标准
- **OHLC一致性检查**：验证开高低收四价位的逻辑关系（high必须是最高的，low必须是最低的）
- **交易日缺失检测**：对比实际数据与A股交易日历，识别数据空洞
- **涨跌停异常检测**：识别超过±10%常规限制的异常价格变动
- **零成交量检测**：识别停牌或数据源问题导致的成交量异常
- **数据源可靠性评分**：综合评估数据可信度

### 2. RiskManagementService — 风险管理

**来源**: 《量化交易：如何建立自己的算法交易事业》

资金管理是量化交易最重要的环节，本服务计算：

| 指标 | 来源 | 用途 |
|------|------|------|
| VaR(95%/99%) | JPMorgan RiskMetrics | 在险价值，衡量尾部风险 |
| CVaR(95%) | 条件VaR | 亏损尾部均值，比VaR更保守 |
| 夏普比率 | Sharpe(1966) | 风险调整后收益 |
| 卡玛比率 | Calmar Ratio | 年化收益/最大回撤 |
| Kelly公式 | Kelly(1956) | f* = (bp - q)/b，最优仓位 |
| 半Kelly | 实际修正 | 更保守的仓位策略 |
| 偏度/峰度 | 统计学 | 衡量收益分布非对称性和肥尾 |
| 最大回撤恢复天数 | 实战 | 从最大亏损恢复到前高的天数 |

**仓位管理原则**:
- 单笔亏损不超过总资金的2%（风险管理第一原则）
- 建议仓位 = min(半Kelly, 2%)，兼顾理论最优与实际风控
- 高胜率+高盈亏比时自动增加仓位

### 3. MarketMicrostructureService — 市场微观结构

**来源**: 《交易与交易所》(Trading and Exchanges)

超越K线，深入到订单簿和流动性层面：

- **VWAP（成交量加权平均价）**：机构交易的核心基准，用分时数据精确计算
- **订单簿失衡(Order Book Imbalance)**：OI = (买一量 - 卖一量) / (买一量 + 卖一量)，短期价格预测的最强信号之一
- **买卖价差分析**：衡量流动性和交易成本，价差扩大预示着市场压力
- **Amihud非流动性指标**：ILLIQ = mean(|收益| / 成交额)，衡量单位成交量对价格的冲击
- **市场冲击成本**：Kyle's lambda模型估算，大额交易的成本预判
- **买卖价差反弹(Bid-Ask Bounce)**：衡量微观结构噪声，反弹强度越高越适合做市策略

### 4. StatisticalArbitrageService — 统计套利

**来源**: 《算法交易：获利策略与逻辑》(Algorithmic Trading by Chan)

#### 均值回归系统
- **Z-Score均值回归**：计算价格偏离均值的标准差倍数，|Z|>2时触发超买/超卖信号
- **半衰期估计**：通过对一阶自回归OLS估计(y(t) = a*y(t-1) + e)，量化均值回归速度
  - 半衰期<10天：快速回归，适合短线
  - 半衰期>50天：缓慢回归，趋势为主
  - Hurst指数逻辑：半衰期短(低Hurst)→均值回归策略适合
- 信号强度逐步放大（|Z|-2)/3，到3个标准差时全仓信号

#### 动量因子系统
- 多时间尺度动量：1月(20日)/3月(60日)/6月(120日)
- 动量衰减检测：短期动量显著大于长期时，可能接近反转
- 动量反转信号：短期与长期方向相反，确认趋势衰竭

#### Walk-Forward滚动回测
- 将数据分为训练集和测试集，滚动验证策略稳健性
- 输出样本内/样本外夏普比率对比
- 稳健性评分 = 样本外夏普 / 样本内夏普
- 参数稳定性 = 各窗口夏普标准差（越低越好）
- 仅在样本外夏普>0.3、稳健性>50%、稳定性>50%时推荐实盘

#### 因子分析
- IC（Information Coefficient）：因子预测能力
- Hit Rate：方向预测准确率
- Sharpe：因子本身的夏普比率
- Decay：因子衰减速度（动量因子衰减快，均值回归衰减慢）

### 5. QuantitativeEngine — 量化引擎

整合所有模块的入口，提供：
- 综合评分（数据质量30% + VaR 20% + 流动性20% + 回测15% + 夏普15%）
- 风险等级判定（低/中/高）
- 策略适配建议（日内/波段/趋势/暂不适合）
- 核心洞察：一句话总结股票量化特征
- 风险警告列表

## API端点

```
GET /api/stock/:code/quantitative
```

返回完整量化报告，包含所有5个维度的分析结果。

## 扩展指南

### 添加新因子
1. 在 `statisticalArbitrageService.ts` 中实现因子计算逻辑
2. 在 `quantitativeEngine.ts` 中整合到总报告
3. 在 `save_daily_quant.cjs` 中添加到SQLite持久化
4. 在 `QuantitativePanel.tsx` 中新增展示

### 参数调优
- 异常检测阈值：修改 `detectOutliers()` 中的 `3.5` 标准差阈值
- Kelly仓位上限：修改 `calculate()` 中 `suggestedPosition` 的 2% 限制
- Walk-Forward窗口：修改 `walkForwardTest()` 的 `trainWindow`/`testWindow` 参数

## 数据持久化

`save_daily_quant.cjs` 每日自动运行：
1. 读取当日查询过的股票代码
2. 获取K线数据
3. 调用量化引擎进行分析
4. 将结果存入SQLite的 `quantitative_reports`、`factor_analysis`、`microstructure_data`、`backtest_results` 表
5. 异常事件记录到 `tail_risk_events` 表
