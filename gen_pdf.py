
import sys, os, glob, datetime, json
sys.path.insert(0, r"C:\Users\25384\.cache\codex-runtimes\codex-primary-runtime\dependencies\python")

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, Preformatted, HRFlowable
)

script_dir = os.path.dirname(os.path.abspath(__file__))

# Register font
font_dirs = [r"C:\Windows\Fonts"]
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
            try: pdfmetrics.registerFont(TTFont("ZH", f)); ZH = "ZH"; break
            except: pass
        if ZH != "Helvetica": break

print(f"FONT: {ZH}", flush=True)

styles = getSampleStyleSheet()

def ms(name, parent, **kw):
    return ParagraphStyle(name, parent=styles[parent], fontName=kw.pop("fn", ZH), **kw)

sT = ms("sT", "Title", fontSize=22, leading=30, alignment=TA_CENTER, spaceAfter=6*mm, textColor=HexColor("#1a1a2e"))
sSub = ms("sSub", "Normal", fontSize=11, leading=16, alignment=TA_CENTER, textColor=HexColor("#555"), spaceAfter=3*mm)
sH1 = ms("sH1", "Heading1", fontSize=16, leading=22, spaceBefore=8*mm, spaceAfter=4*mm, textColor=HexColor("#1a1a2e"))
sH2 = ms("sH2", "Heading2", fontSize=13, leading=18, spaceBefore=5*mm, spaceAfter=3*mm, textColor=HexColor("#2d3436"))
sBody = ms("sBody", "Normal", fontSize=10, leading=16, spaceAfter=2*mm, alignment=TA_JUSTIFY)
sBullet = ms("sBullet", "Normal", fontSize=10, leading=16, leftIndent=8*mm, spaceAfter=1*mm)
sMeta = ms("sMeta", "Normal", fontSize=8, leading=11, alignment=TA_CENTER, textColor=HexColor("#999"))
sCode = ParagraphStyle("sCode", fontName="Courier", fontSize=7.5, leading=10, leftIndent=4*mm, spaceAfter=2*mm, backColor=HexColor("#f5f5f5"), borderPadding=4)

def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(HexColor("#bbb"))
    canvas.drawCentredString(A4[0]/2, 1.2*cm, f"Codex Chat Session | Page {canvas.getPageNumber()}")
    canvas.restoreState()

def makeTable(data, colWidths, fontSize=8):
    t = Table(data, colWidths=colWidths)
    cmds = [
        ("FONTNAME", (0,0), (-1,-1), ZH),
        ("FONTSIZE", (0,0), (-1,-1), fontSize),
        ("BACKGROUND", (0,0), (-1,0), HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0,0), (-1,0), white),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("GRID", (0,0), (-1,-1), 0.5, HexColor("#ccc")),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("LEFTPADDING", (0,0), (-1,-1), 3),
    ]
    if len(data) > 1:
        cmds.append(("ROWBACKGROUNDS", (0,1), (-1,-1), [white, HexColor("#f8f9fa")]))
    t.setStyle(TableStyle(cmds))
    return t

# Load content
data_path = os.path.join(script_dir, "chat_pdf_data.json")
with open(data_path, "r", encoding="utf-8") as fh:
    content = json.load(fh)

print(f"SECTIONS: {len(content['sections'])}", flush=True)

out = os.path.join(script_dir, "Chat_Session_Codex.pdf")
doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
elems = []

# Title page
elems.append(Spacer(1, 5*cm))
elems.append(Paragraph(f"<b>Codex \u4f1a\u8bdd\u8bb0\u5f55</b>", sT))
elems.append(Paragraph(f"<b>Codex Chat Session Log</b>", sSub))
elems.append(Spacer(1, 5*mm))
elems.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#ddd"), spaceAfter=3*mm, spaceBefore=3*mm))
elems.append(Paragraph(f"\u751f\u6210\u65f6\u95f4: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", sMeta))
elems.append(Paragraph("\u9879\u76ee: \u80a1\u7968\u5206\u6790\u5de5\u5177 - A\u80a1\u6280\u672f\u5206\u6790\u7f51\u9875\u5e94\u7528 + \u5fae\u4fe1\u5c0f\u7a0b\u5e8f", sMeta))
elems.append(Spacer(1, 2*cm))

# TOC
elems.append(Paragraph(f"<b>\u76ee\u5f55 / Contents</b>", sH2))
for i, sec in enumerate(content["sections"]):
    if "tag" in sec:
        elems.append(Paragraph(f"\\u2022 {i+1}. {sec['tag']}", sBullet))
elems.append(PageBreak())

# Build pages
for sec in content["sections"]:
    if "h1" in sec:
        elems.append(Paragraph(f"<b>{sec['h1']}</b>", sH1))
    if "h2" in sec:
        elems.append(Paragraph(f"<b>{sec['h2']}</b>", sH2))
    for p in sec.get("paragraphs", []):
        elems.append(Paragraph(p, sBody))
    for b in sec.get("bullets", []):
        elems.append(Paragraph(f"\\u2022 {b}", sBullet))
    if "code" in sec:
        elems.append(Preformatted(sec["code"], sCode))
    if "table" in sec:
        td = sec["table"]
        elems.append(makeTable(td["data"], [cm * w for w in td["widths_cm"]], td.get("fontSize", 8)))
    if sec.get("pageBreak"):
        elems.append(PageBreak())
    elems.append(Spacer(1, 2*mm))

doc.build(elems, onFirstPage=add_page_number, onLaterPages=add_page_number)
sz = os.path.getsize(out)
print(f"DONE: {sz} bytes", flush=True)
print(f"FILE: {out}", flush=True)
