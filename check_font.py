import sys
sys.path = [r"C:\Users\25384\.cache\codex-runtimes\codex-primary-runtime\dependencies\python"] + sys.path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, Preformatted, KeepTogether
)
import os, glob

font_dirs = [
    r"C:\Windows\Fonts",
    r"C:\Users\25384\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\Lib\site-packages\reportlab\fonts",
]
ZH_FONT = "Helvetica"
for d in font_dirs:
    for f in glob.glob(os.path.join(d, "*.ttf")):
        bn = os.path.basename(f).lower()
        if "yahei" in bn or "msyh" in bn:
            try:
                pdfmetrics.registerFont(TTFont("YaHei", f))
                ZH_FONT = "YaHei"
                break
            except:
                pass
    if ZH_FONT != "Helvetica":
        break

if ZH_FONT == "Helvetica":
    for d in font_dirs:
        for f in glob.glob(os.path.join(d, "simsun*.ttf")):
            try:
                pdfmetrics.registerFont(TTFont("SimSun", f))
                ZH_FONT = "SimSun"
                break
            except:
                pass
        if ZH_FONT != "Helvetica":
            break

print(f"Using font: {ZH_FONT}")
