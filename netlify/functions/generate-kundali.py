# -*- coding: utf-8 -*-
"""
Netlify Python Function: POST /.netlify/functions/generate-kundali
Input: { token, name, phone, dob (YYYY-MM-DD), time (HH:MM), state, city/place, lat, lon }
  (Naya flow: index.html par naam+phone → Razorpay ₹151 → generate.html par birth details)
1) Token verify karo (HMAC-SHA256, TOKEN_SECRET) — bina valid token ke PDF nahi
2) Birth details validate karo
3) Engine se chart compute + composer se Hindi content
4) fpdf2 se personalized PDF banao
5) Base64 PDF return karo

Customer ko "engine/computer" shabd nahi dikhna chahiye — framing: "शास्त्रीजी के निर्देशन में".
"""
import os
import sys
import json
import base64
import io

_HERE = os.path.dirname(os.path.abspath(__file__))
_PY = os.path.join(_HERE, "py")
sys.path.insert(0, os.path.join(_PY, "kundali"))
sys.path.insert(0, os.path.join(_PY, "fonts"))

# Fonts chunks se extract karo (GitHub binary limit bypass)
try:
    import NotoSansDevanagari_Regular_loader as _fr
    import NotoSansDevanagari_Bold_loader as _fb
    _fr.ensure_font(os.path.join(_PY, "fonts", "NotoSansDevanagari-Regular.ttf"))
    _fb.ensure_font(os.path.join(_PY, "fonts", "NotoSansDevanagari-Bold.ttf"))
except Exception:
    pass

import engine_wrap
import composer

from fpdf import FPDF
from PIL import Image, ImageDraw, ImageFont

FONT_REG = os.path.join(_PY, "fonts", "NotoSansDevanagari-Regular.ttf")
FONT_BOLD = os.path.join(_PY, "fonts", "NotoSansDevanagari-Bold.ttf")
COVER_IMG = os.path.join(_PY, "assets", "cover-bg.webp")
UPAY_IMG = os.path.join(_PY, "assets", "upay-deco.webp")

GRAHA_SHORT_HI = {
    "सूर्य": "सू", "चंद्र": "चं", "मंगल": "मं", "बुध": "बु", "गुरु": "गु",
    "शुक्र": "शु", "शनि": "श", "राहु": "रा", "केतु": "के",
}
MONTHS_HI = ['', 'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
             'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर']


# ---------- helpers ----------
def json_out(status, data):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", "Cache-Control": "no-store"},
        "body": json.dumps(data, ensure_ascii=False),
    }


def verify_token(t):
    """HMAC-SHA256 token verify (Node lib/token.js ka Python port).
    Format: base64url(payload_json).hex_hmac(body, TOKEN_SECRET)
    Returns payload dict or None."""
    import hmac as hmac_mod
    import hashlib
    import time as time_mod
    secret = os.environ.get("TOKEN_SECRET", "")
    if not t or not secret:
        return None
    parts = str(t).split(".")
    if len(parts) != 2:
        return None
    body, sig = parts
    expected = hmac_mod.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    if len(expected) != len(sig):
        return None
    if not hmac_mod.compare_digest(expected, sig):
        return None
    try:
        pad = "=" * (-len(body) % 4)
        p = json.loads(base64.urlsafe_b64decode(body + pad).decode("utf-8"))
    except Exception:
        return None
    if not p.get("exp") or time_mod.time() > p["exp"]:
        return None
    if not p.get("pid"):
        return None
    if not p.get("nm") or not p.get("ph"):
        return None
    return p


def validate_birth(body):
    """Strict validation of birth details. Returns dict or None."""
    if not isinstance(body, dict):
        return None
    name = str(body.get("name") or "").strip()[:60]
    dob = str(body.get("dob") or "").strip()       # YYYY-MM-DD
    tm = str(body.get("time") or "").strip()       # HH:MM
    place = str(body.get("place") or "").strip()[:80]
    # New flow: state+city instead of place
    if not place:
        _city = str(body.get("city") or "").strip()
        _state = str(body.get("state") or "").strip()
        if _city:
            place = (_city + ", " + _state).strip(", ")[:80]
    if len(name) < 2:
        return None
    import re
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", dob)
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not (1900 <= y <= 2100 and 1 <= mo <= 12 and 1 <= d <= 31):
        return None
    # Real calendar date check
    import datetime
    try:
        dt = datetime.date(y, mo, d)
        if dt > datetime.date.today():
            return None
    except ValueError:
        return None
    if not re.match(r"^([01]\d|2[0-3]):([0-5]\d)$", tm):
        return None
    hh, mm = int(tm[:2]), int(tm[3:])
    if len(place) < 2:
        return None
    # lat/lon: prefer client-supplied, fallback to server geocode
    lat = lon = None
    try:
        lat = float(body.get("lat"))
        lon = float(body.get("lon"))
    except (TypeError, ValueError):
        pass
    if lat is None or lon is None or not (6 <= lat <= 38 and 66 <= lon <= 98):
        ll = engine_wrap.geocode(place)
        if not ll:
            return None
        lat, lon = ll
    return {"name": name, "y": y, "mo": mo, "d": d, "hh": hh, "mm": mm,
            "place": place, "lat": lat, "lon": lon}


# ---------- chart drawing ----------
def draw_chart(path, houses, rashi_in_bhava):
    S = 900
    img = Image.new("RGB", (S, S), "white")
    d = ImageDraw.Draw(img)
    m = 40
    x0, y0, x1, y1 = m, m, S - m, S - m
    ink, gold, maroon = (90, 20, 20), (150, 110, 20), (122, 31, 31)
    d.rectangle([x0, y0, x1, y1], outline=ink, width=4)
    d.line([x0, y0, x1, y1], fill=ink, width=3)
    d.line([x0, y1, x1, y0], fill=ink, width=3)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    d.line([cx, y0, x1, cy, cx, y1, x0, cy, cx, y0], fill=ink, width=3)
    cent = {1: (100, 150), 2: (50, 183), 3: (17, 150), 4: (50, 100),
            5: (17, 50), 6: (50, 17), 7: (100, 50), 8: (150, 17),
            9: (183, 50), 10: (150, 100), 11: (183, 150), 12: (150, 183)}
    fr = ImageFont.truetype(FONT_BOLD, 34)
    fg = ImageFont.truetype(FONT_REG, 30)
    for h in range(1, 13):
        ux, uy = cent[h]
        px = int(x0 + ux / 200 * (x1 - x0))
        py = int(y0 + (200 - uy) / 200 * (y1 - y0))
        d.text((px, py - 52), str(rashi_in_bhava[h]), font=fr, fill=gold, anchor="mm")
        gs = houses[h]
        if gs:
            d.text((px, py + 8), " ".join(gs), font=fg, fill=maroon, anchor="mm")
    img.save(path)
    return path


class PDF(FPDF):
    def header(self):
        if self.page_no() == 1 or getattr(self, 'no_header', False):
            return
        self.set_font("NotoDeva", "B", 9)
        self.set_text_color(122, 31, 31)
        self.set_x(self.l_margin)
        self.cell(0, 8, "संपूर्ण कुंडली विश्लेषण", align="C",
                  new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(180, 130, 40)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        # Page numbers removed: pypdf reorder (index moved to page 2) makes
        # baked-in numbers off-by-one. Header alone keeps design clean.
        return

    def h1(self, t):
        self.set_font("NotoDeva", "B", 24)
        self.set_text_color(122, 31, 31)
        self.set_x(self.l_margin)
        self.multi_cell(0, 12, t, align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(3)

    def h2(self, t):
        self.set_fill_color(122, 31, 31)
        self.set_text_color(255, 255, 255)
        self.set_font("NotoDeva", "B", 17)
        self.set_x(self.l_margin)
        self.multi_cell(0, 11, "  " + t, fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(5)

    def para(self, t, size=13):
        if not t:
            return
        self.set_font("NotoDeva", "", size)
        self.set_text_color(30, 30, 30)
        self.set_x(self.l_margin)
        self.multi_cell(0, 7.5, t, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def bullet(self, t, size=13):
        self.set_font("NotoDeva", "", size)
        self.set_text_color(30, 30, 30)
        self.set_x(self.l_margin)
        self.cell(7, 7.5, "।")
        self.multi_cell(0, 7.5, t, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def mc(self, t, size=11, style="", align="C", color=(30, 30, 30)):
        self.set_font("NotoDeva", style, size)
        self.set_text_color(*color)
        self.set_x(self.l_margin)
        self.multi_cell(0, 7, t, align=align, new_x="LMARGIN", new_y="NEXT")


def build_pdf_bytes(name, chart, c, tmpdir):
    pdf = PDF("P", "mm", "A4")
    pdf.set_auto_page_break(True, 20)
    pdf.add_font("NotoDeva", "", FONT_REG)
    pdf.add_font("NotoDeva", "B", FONT_BOLD)
    # DejaVu fallback for Latin chars (WhatsApp, email)
    _dj_reg = os.path.join(_PY, "fonts", "DejaVuSans.ttf")
    _dj_bold = os.path.join(_PY, "fonts", "DejaVuSans-Bold.ttf")
    if os.path.exists(_dj_reg):
        pdf.add_font("DejaVu", "", _dj_reg)
        pdf.add_font("DejaVu", "B", _dj_bold)
        pdf.set_fallback_fonts(["DejaVu"])
    pdf.set_text_shaping(True)

    LINK_KEYS = ["janm", "chart", "graha", "lagna", "chandra", "navagraha",
                 "samasya", "yoga", "dasha", "upay", "shubh"]
    LINKS = {k: pdf.add_link() for k in LINK_KEYS}

    # COVER
    pdf.add_page()
    if os.path.exists(COVER_IMG):
        pdf.image(COVER_IMG, x=0, y=0, w=210, h=297)
    pdf.ln(30)
    pdf.set_font("NotoDeva", "B", 36)
    pdf.set_text_color(255, 215, 0)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 18, "संपूर्ण कुंडली\nविश्लेषण", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)
    pdf.set_draw_color(255, 215, 0)
    pdf.set_line_width(1)
    pdf.line(70, pdf.get_y(), 140, pdf.get_y())
    pdf.ln(10)
    pdf.mc("जन्म कुंडली का संपूर्ण वैदिक विश्लेषण", 16, color=(255, 255, 255))
    pdf.mc("लग्न | ग्रह स्थिति | दशा | योग | उपाय", 16, color=(255, 255, 255))
    pdf.ln(12)
    pdf.set_font("NotoDeva", "B", 15)
    pdf.set_text_color(255, 215, 0)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 10, "तैयार कर्ता: विजेन्द्र शास्त्रीजी", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(20)
    pdf.set_font("NotoDeva", "", 11)
    pdf.set_text_color(230, 230, 230)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 7, "आपकी जन्म तिथि, समय व स्थान के आधार पर\nविशेष रूप से तैयार की गई व्यक्तिगत रिपोर्ट।",
                   align="C", new_x="LMARGIN", new_y="NEXT")

    # JANM VIVARAN
    pdf.add_page()
    pdf.set_link(LINKS["janm"])
    pdf.h1("जन्म विवरण")
    pdf.ln(4)
    details = [
        ("नाम", name),
        ("जन्म तिथि", c["dob_str"]),
        ("जन्म समय", c["time_str"]),
        ("जन्म स्थान", c["place_str"]),
        ("लग्न", f"{c['lagna']} (स्वामी: {c['lagna_lord']})"),
        ("चंद्र राशि", c["moon_rashi"]),
        ("नक्षत्र", f"{c['nakshatra_hi']} (चरण {c['nakshatra_pada']})" if c["nakshatra_pada"] else c["nakshatra_hi"]),
        ("वर्तमान महादशा", f"{c['current_mahadasha']['lord']} ({c['current_mahadasha']['start'][:4]}–{c['current_mahadasha']['end'][:4]})"),
    ]
    for k, v in details:
        pdf.set_font("NotoDeva", "B", 13)
        pdf.set_text_color(122, 31, 31)
        pdf.set_x(pdf.l_margin)
        pdf.cell(55, 9, k)
        pdf.set_font("NotoDeva", "", 13)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 9, str(v), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.para(f"{c['name_ji']}, उपरोक्त विवरण आपकी जन्म कुंडली की गणना का आधार है।", 11)

    # CHART
    pdf.add_page()
    pdf.set_link(LINKS["chart"])
    pdf.h1("जन्म कुंडली चार्ट")
    pdf.ln(2)
    houses = {i: [] for i in range(1, 13)}
    for g in composer.GRAHA_ORDER:
        p = chart["planets"].get(g, {})
        houses[p.get("bhava", 1)].append(GRAHA_SHORT_HI[g])
    rib = engine_wrap.rashi_in_bhava(chart)
    chart_path = os.path.join(tmpdir, "chart.png")
    draw_chart(chart_path, houses, rib)
    pdf.image(chart_path, x=35, w=140)
    pdf.ln(4)
    pdf.para("उत्तर भारतीय शैली का लग्न चार्ट। प्रत्येक भाव में स्थित ग्रह व राशि अंक दर्शाए गए हैं।", 10)

    # GRAHA STHITI TABLE
    pdf.add_page()
    pdf.set_link(LINKS["graha"])
    pdf.h1("ग्रह स्थिति")
    pdf.ln(2)
    pdf.set_font("NotoDeva", "B", 11)
    pdf.set_text_color(255, 255, 255)
    pdf.set_fill_color(122, 31, 31)
    pdf.set_x(pdf.l_margin)
    for w, t in [(30, "ग्रह"), (30, "राशि"), (22, "भाव"), (40, "नक्षत्र"), (68, "विशेष")]:
        pdf.cell(w, 8, t, border=1, fill=True, align="C")
    pdf.ln()
    pdf.set_font("NotoDeva", "", 10)
    pdf.set_text_color(30, 30, 30)
    fill = False
    dignity_hi = {"exalted": "उच्च", "debilitated": "नीच", "own sign": "स्वग्रही"}
    nak_en_hi = composer.NAKSHATRA_EN_HI
    for g in composer.GRAHA_ORDER:
        p = chart["planets"][g]
        dig = dignity_hi.get(p.get("dignity", ""), "")
        if p.get("retro"):
            dig += " वक्री" if dig else "वक्री"
        nak_hi = nak_en_hi.get(p["nakshatra"], p["nakshatra"])
        row = (g, p["rashi"], str(p["bhava"]), nak_hi, dig or "—")
        pdf.set_x(pdf.l_margin)
        if fill:
            pdf.set_fill_color(245, 235, 220)
        for w, t in zip([30, 30, 22, 40, 68], row):
            pdf.cell(w, 7.5, t, border=1, align="C", fill=fill)
        pdf.ln()
        fill = not fill

    # LAGNA
    pdf.add_page()
    pdf.set_link(LINKS["lagna"])
    pdf.h2(f"लग्न विश्लेषण — {c['lagna']} लग्न")
    pdf.para(c["lagna_swabhav"])
    pdf.para(c["lagna_sharir"])
    pdf.para(c["lagna_vishesh"])

    # CHANDRA + NAKSHATRA
    pdf.add_page()
    pdf.set_link(LINKS["chandra"])
    pdf.h2(f"चंद्र राशि — {c['moon_rashi']} ({c['nakshatra_hi']} नक्षत्र)")
    for t in c["nakshatra_text"]:
        pdf.para(t)

    # NAVAGRAHA — flow continuously
    pdf.add_page()
    pdf.set_link(LINKS["navagraha"])
    pdf.h1("नवग्रह विस्तृत विश्लेषण")
    pdf.ln(2)
    for gd in c["grahas"]:
        if pdf.get_y() > 225:
            pdf.add_page()
        dig_note = ""
        if gd["dignity"] == "exalted":
            dig_note = " (उच्च का)"
        elif gd["dignity"] == "debilitated":
            dig_note = " (नीच का)"
        elif gd["dignity"] == "own sign":
            dig_note = " (स्वग्रही)"
        pdf.h2(f"{gd['name']} — {gd['rashi']} राशि, {gd['bhava']} भाव{dig_note} ({composer.NAKSHATRA_EN_HI.get(gd['nakshatra'], gd['nakshatra'])})")
        pdf.para(gd["rashi_text"])
        pdf.para(gd["bhava_text"])
        pdf.ln(3)

    # 15 SAMASYA
    pdf.add_page()
    pdf.set_link(LINKS["samasya"])
    pdf.h1("जीवन की 15 प्रमुख समस्याएं व समाधान")
    pdf.ln(2)
    pdf.para(f"{c['name_ji']}, आपकी कुंडली के अनुसार जीवन के विभिन्न क्षेत्रों का विस्तृत विश्लेषण।", 10)
    for i, s in enumerate(c["samasyas"]):
        if pdf.get_y() > 210:
            pdf.add_page()
        pdf.h2(f"{i+1}. {s['title']}")
        pdf.para(s["text"])

    # YOGA
    pdf.add_page()
    pdf.set_link(LINKS["yoga"])
    pdf.h2("शुभ योग")
    if c["yogas"]:
        for y in c["yogas"]:
            yn = y.get("name", "") if isinstance(y, dict) else str(y)
            pdf.bullet(yn)
    else:
        pdf.para("आपकी कुंडली में कोई विशेष नामित योग नहीं बन रहा, पर ग्रहों की शुभ स्थिति से जीवन में उन्नति के योग हैं।")

    # DASHA
    pdf.add_page()
    pdf.set_link(LINKS["dasha"])
    md = c["current_mahadasha"]
    ad = c["current_antardasha"]
    pdf.h2(f"विंशोत्तरी महादशा — {md['lord']} महादशा ({md['start'][:4]}–{md['end'][:4]})")
    pdf.para(f"वर्तमान में {md['lord']} की महादशा व {ad['lord']} की अंतर्दशा चल रही है।")
    pdf.para(c["dasha_samanya"])
    pdf.h2("शुभ समय")
    pdf.para(c["dasha_shubh"])
    pdf.h2("सावधानियां")
    pdf.para(c["dasha_savdhani"])

    # UPAY
    pdf.add_page()
    pdf.set_link(LINKS["upay"])
    pdf.h2("उपाय व टोटके")
    if os.path.exists(UPAY_IMG):
        pdf.image(UPAY_IMG, x=55, w=100)
        pdf.ln(4)
    pdf.para(f"{c['name_ji']}, आपकी कुंडली के अनुसार निम्नलिखित उपाय विशेष लाभकारी रहेंगे:")
    for g, text in c["upay_list"]:
        pdf.h2(f"{g} के उपाय")
        pdf.para(text)

    # SHUBH ANK/RANG/DIN/DISHA
    pdf.add_page()
    pdf.set_link(LINKS["shubh"])
    pdf.h2("शुभ अंक, रंग, दिन व दिशा")
    pdf.para(f"{c['name_ji']}, आपकी कुंडली के ग्रहों के अनुसार निम्नलिखित चीजें आपके लिए विशेष शुभ हैं। इन्हें दैनिक जीवन में अपनाने से सकारात्मक ऊर्जा बढ़ेगी:")
    for title, text in c["shubh_list"]:
        text = text.replace("**", "")
        pdf.h2(f"🍀 {title}")
        pdf.para(text)

    # CLOSING
    pdf.add_page()
    pdf.h2("अंतिम निवेदन")
    pdf.para(f"{c['name_ji']}, यह संपूर्ण कुंडली विश्लेषण वैदिक ज्योतिष के प्राचीन सिद्धांतों पर आधारित है। ग्रहों की स्थिति आपके जीवन की दिशा दिखाती है, पर अंतिम परिणाम आपके कर्म व पुरुषार्थ पर निर्भर करता है।")
    pdf.para("यह रिपोर्ट आपकी जन्म तिथि, समय व स्थान के अनुसार विशेष रूप से तैयार की गई है।")
    pdf.para(f"{c['name_ji']}, मैं विजेन्द्र शास्त्री आपके उज्ज्वल भविष्य की कामना करता हूं। शुभम् भवतु।")
    pdf.ln(6)
    pdf.set_font("NotoDeva", "B", 12)
    pdf.set_text_color(122, 31, 31)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 9, "तैयार कर्ता: विजेन्द्र शास्त्रीजी", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_font("NotoDeva", "", 10)
    pdf.set_text_color(120, 120, 120)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 7, "नोट: ज्योतिष मार्गदर्शन के लिए है। किसी भी बड़े निर्णय\nसे पहले अपने विवेक का प्रयोग करें।", align="C",
                   new_x="LMARGIN", new_y="NEXT")

    # UPSELL — fixed last page (same for every customer)
    pdf.add_page()
    pdf.h1("विशेष ज्योतिष मार्गदर्शन")
    pdf.ln(2)
    pdf.set_font("NotoDeva", "", 13)
    pdf.set_text_color(60, 40, 20)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 8, "अधिक ज्योतिष मार्गदर्शन के लिए शास्त्रीजी से सीधे बात करें:", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_font("NotoDeva", "B", 22)
    pdf.set_text_color(18, 140, 70)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 12, "WhatsApp: 7575831059", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("NotoDeva", "", 13)
    pdf.set_text_color(60, 40, 20)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 8, "Email: vijendraji51@gmail.com", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("NotoDeva", "B", 15)
    pdf.set_text_color(122, 31, 31)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 9, "संपूर्ण ज्योतिष किट — सिर्फ ₹999 में", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("NotoDeva", "", 12.5)
    pdf.set_text_color(40, 40, 40)
    for _item in [
        "1. साढ़ेसाती सर्वाइवल रिपोर्ट (113 पेज, व्यक्तिगत)",
        "2. आपका वर्षफल 2026-27 (व्यक्तिगत पुस्तक)",
        "3. 12-महीने उपाय कैलेंडर",
        "4. विवाह योग रिपोर्ट (व्यक्तिगत)",
        "5. करियर वर्षफल 2026-27 (व्यक्तिगत)",
        "6. लाल किताब उपाय संग्रह",
        "7. शुभ मुहूर्त डायरी",
        "8. 7-दिन ज्योतिषी चैट (WhatsApp पर)",
    ]:
        pdf.set_x(pdf.l_margin + 10)
        pdf.multi_cell(0, 8, _item, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_font("NotoDeva", "B", 13)
    pdf.set_text_color(122, 31, 31)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 8, "ये सब जानना है या चाहिए तो अभी WhatsApp करें: 7575831059", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("NotoDeva", "", 11)
    pdf.set_text_color(120, 120, 120)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 7, "आपकी कुंडली के अनुसार व्यक्तिगत मार्गदर्शन के लिए शास्त्रीजी स्वयं उत्तर देंगे।", align="C", new_x="LMARGIN", new_y="NEXT")

    # INDEX (built last, moved to page 2)
    pdf.no_footer = True
    pdf.no_header = True
    pdf.add_page()
    pdf.h1("विषय सूची")
    pdf.ln(6)
    pdf.set_font("NotoDeva", "", 10)
    pdf.set_text_color(120, 120, 120)
    pdf.set_x(pdf.l_margin)
    # Tap hand icon
    _tap = os.path.join(os.path.dirname(os.path.abspath(__file__)), "py", "assets", "tap-hand.jpg")
    if os.path.exists(_tap):
        pdf.image(_tap, x=(210-14)/2, w=14)
        pdf.ln(2)
    pdf.multi_cell(0, 7, "किसी भी विषय पर टैप करें — सीधे उस पृष्ठ पर पहुंचें।",
                   align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    index_items = [
        ("1", "जन्म विवरण", "janm"),
        ("2", "जन्म कुंडली चार्ट", "chart"),
        ("3", "ग्रह स्थिति", "graha"),
        ("4", "लग्न विश्लेषण", "lagna"),
        ("5", "चंद्र राशि व नक्षत्र", "chandra"),
        ("6", "नवग्रह विस्तृत विश्लेषण", "navagraha"),
        ("7", "जीवन की 15 प्रमुख समस्याएं व समाधान", "samasya"),
        ("8", "शुभ योग", "yoga"),
        ("9", "विंशोत्तरी महादशा", "dasha"),
        ("10", "उपाय व टोटके", "upay"),
        ("11", "शुभ अंक, रंग, दिन व दिशा", "shubh"),
    ]
    for i, (num, title, key) in enumerate(index_items):
        if i % 2 == 0:
            pdf.set_fill_color(255, 243, 224)
        else:
            pdf.set_fill_color(252, 228, 236)
        pdf.set_x(pdf.l_margin)
        pdf.set_font("NotoDeva", "B", 15)
        pdf.set_text_color(122, 31, 31)
        pdf.cell(14, 11, num, fill=True, link=LINKS[key])
        pdf.set_font("NotoDeva", "B", 14)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(150, 11, title, fill=True, link=LINKS[key])
        pdf.set_font("NotoDeva", "B", 14)
        pdf.set_text_color(180, 130, 40)
        pdf.cell(0, 11, "→", align="R", fill=True, link=LINKS[key],
                 new_x="LMARGIN", new_y="NEXT")
    pdf.no_footer = False
    pdf.no_header = False

    # Output to bytes + reorder (index last → page 2)
    tmp_raw = os.path.join(tmpdir, "raw.pdf")
    pdf.output(tmp_raw)
    from pypdf import PdfReader, PdfWriter
    reader = PdfReader(tmp_raw)
    writer = PdfWriter()
    pages = list(reader.pages)
    n = len(pages)
    writer.add_page(pages[0])
    writer.add_page(pages[n - 1])
    for i in range(1, n - 1):
        writer.add_page(pages[i])
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def handler(event, context):
    if event.get("httpMethod", "GET") != "POST":
        return json_out(405, {"error": "Method not allowed"})

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return json_out(400, {"error": "Invalid JSON"})

    # 0) Token verify — bina valid payment token ke PDF nahi
    tp = verify_token(body.get("token"))
    if not tp:
        return json_out(401, {"error": "Invalid ya expired link. Payment ke baad mili link ka upyog karein."})

    # 1) Birth details validate
    bd = validate_birth(body)
    if not bd:
        return json_out(400, {"error": "Janm vigat sahi likho (tarikh, samay, rajya, shahar)"})
    name, y, mo, d, hh, mm = bd["name"], bd["y"], bd["mo"], bd["d"], bd["hh"], bd["mm"]
    place, lat, lon = bd["place"], bd["lat"], bd["lon"]

    # 2) Compute chart + compose
    try:
        chart = engine_wrap.compute_chart(y, mo, d, hh, mm, lat, lon, name)
    except Exception:
        return json_out(500, {"error": "Ganna me samasya aayi"})

    dob_str = f"{d} {MONTHS_HI[mo]} {y}"
    h12 = hh if hh <= 12 else hh - 12
    if h12 == 0:
        h12 = 12
    time_str = f"{h12}:{mm:02d} {'AM' if hh < 12 else 'PM'}"
    c = composer.compose(chart, name, dob_str, time_str, place)

    # 3) Build PDF
    import tempfile
    tmpdir = tempfile.mkdtemp()
    try:
        pdf_bytes = build_pdf_bytes(name, chart, c, tmpdir)
    except Exception:
        return json_out(500, {"error": "PDF banane me samasya"})
    finally:
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)

    # 4) Return base64 + summary for generate.html
    b64 = base64.b64encode(pdf_bytes).decode("ascii")
    safe_name = "".join(ch for ch in name if ch.isalnum())[:20] or "kundali"
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", "Cache-Control": "no-store"},
        "body": json.dumps({
            "pdf": b64,
            "filename": f"Sampurn-Kundali-{safe_name}.pdf",
            "summary": {
                "lagna": c.get("lagna", ""),
                "moon": c.get("moon_rashi", ""),
                "nakshatra": c.get("nakshatra_hi", ""),
                "dasha": c.get("current_mahadasha", {}).get("lord", ""),
            },
        }, ensure_ascii=False),
    }
