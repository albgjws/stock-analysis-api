import os, json, base64
os.chdir('stock-analysis-app')

# Read the current ASCII file
with open('src/components/QuantitativePanel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Define Chinese replacements
replacements = {
    'Q Score High': '量化分析',
    'Score: ': '综合评分: ',
    '/100': '/100',
    'VaR: ': 'VaR(95%): ',
    'Sharpe: ': '夏普: ',
    'Drawdown: ': '回撤: ',
    'Z-Score: ': '均值回归: ',
    'Buy': '超买',
    'Sell': '超卖',
    'Hold': '中性',
    '1M: ': '1月动量: ',
    '3M: ': '3月动量: ',
    'Liquidity: ': '流动性: ',
    'O.I.: ': '订单失衡: ',
    'Loading...': '量化分析中...',
}

for k, v in replacements.items():
    content = content.replace(k, v)

with open('src/components/QuantitativePanel.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done, size:', len(content))
