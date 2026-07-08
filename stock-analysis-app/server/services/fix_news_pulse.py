import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import re

tpl = open(r'F:\炒股训练0\炒股训练\stock-analysis-app\server\services\newsPulseService_template.txt', 'r', encoding='utf-8').read()
