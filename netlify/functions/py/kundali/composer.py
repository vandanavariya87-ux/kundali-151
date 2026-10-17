# -*- coding: utf-8 -*-
"""Composer: chart dict -> personalized Hindi content dict."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "content"))
import lagna_nakshatra_dasha as lnd
import graha_rashi_bhava_1 as g1
import graha_rashi_bhava_2 as g2
import samasya_logic as sl

# Merge graha databases
GRAHA_RASHI = {**g1.GRAHA_RASHI_HI, **g2.GRAHA_RASHI_HI}
GRAHA_BHAVA = {**g1.GRAHA_BHAVA_HI, **g2.GRAHA_BHAVA_HI}
UPAY = g2.UPAY_HI

GRAHA_ORDER = ["सूर्य", "चंद्र", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "राहु", "केतु"]

# Samasya -> relevant grahas/bhavas for strength check
SAMASYA_KEYS = {
    "vyapar_hani": (["बुध", "गुरु"], [7, 10, 11]),
    "mehnat_phal": (["शनि"], [10]),
    "prem_vivah": (["शुक्र"], [5, 7]),
    "karz": (["मंगल", "शनि"], [6]),
    "swasthya": ([], [1, 6, 8]),  # uses lagna lord
    "vaivahik": (["शुक्र", "मंगल"], [7]),
    "parivarik_kalesh": (["चंद्र"], [4]),
    "santan": (["गुरु"], [5]),
    "naukri": (["सूर्य", "शनि"], [10]),
    "prem_dhokha": (["शुक्र", "राहु"], [5]),
    "court_case": (["मंगल", "शनि"], [6]),
    "dhan_career": (["गुरु", "बुध"], [2, 10, 11]),
    "margdarshan": (["गुरु"], [9]),
    "shanti_upay": ([], []),
    "accident": (["मंगल"], [8]),
}

# English -> Hindi nakshatra mapping
NAKSHATRA_EN_HI = {
    "Ashwini": "अश्विनी", "Bharani": "भरणी", "Krittika": "कृत्तिका",
    "Rohini": "रोहिणी", "Mrigashira": "मृगशिरा", "Ardra": "आर्द्रा",
    "Punarvasu": "पुनर्वसु", "Pushya": "पुष्य", "Ashlesha": "आश्लेषा",
    "Magha": "मघा", "Purva Phalguni": "पूर्व फाल्गुनी", "Uttara Phalguni": "उत्तर फाल्गुनी",
    "Hasta": "हस्त", "Chitra": "चित्रा", "Swati": "स्वाति",
    "Vishakha": "विशाखा", "Anuradha": "अनुराधा", "Jyeshtha": "ज्येष्ठा",
    "Mula": "मूल", "Purva Ashadha": "पूर्वाषाढ़ा", "Uttara Ashadha": "उत्तराषाढ़ा",
    "Shravana": "श्रवण", "Dhanishta": "धनिष्ठा", "Shatabhisha": "शतभिषा",
    "Purva Bhadrapada": "पूर्व भाद्रपद", "Uttara Bhadrapada": "उत्तर भाद्रपद",
    "Revati": "रेवती",
}

SAMASYA_TITLES = {    "vyapar_hani": "व्यवसाय में हानि",
    "mehnat_phal": "मेहनत का पूर्ण फल न मिलना",
    "prem_vivah": "प्रेम और विवाह के योग",
    "karz": "कर्ज की समस्या",
    "swasthya": "स्वास्थ्य",
    "vaivahik": "वैवाहिक जीवन",
    "parivarik_kalesh": "घर-परिवार में कलह",
    "santan": "संतान सुख",
    "naukri": "नौकरी में सफलता",
    "prem_dhokha": "प्रेम में धोखा",
    "court_case": "मुकदमे व कचहरी",
    "dhan_career": "धन और करियर के भाग्य योग",
    "margdarshan": "जीवन का मार्गदर्शन",
    "shanti_upay": "शांति व समृद्धि के उपाय",
    "accident": "चोट-दुर्घटना से रक्षा",
}


def dignity_strength(dignity):
    """Map dignity string to strength score."""
    d = (dignity or "").lower()
    if "exalted" in d or "उच्च" in dignity:
        return 2
    if "own" in d or "स्वग्रही" in dignity or "swagrahi" in d:
        return 2
    if "debilitated" in d or "नीच" in dignity or "neech" in d:
        return -2
    return 0


def assess_samasya(chart, key):
    """Return 'strong', 'weak', or 'mixed' for a samasya based on chart."""
    if key == "shanti_upay":
        return "general"
    grahas, bhavas = SAMASYA_KEYS[key]
    score = 0
    count = 0

    # For swasthya, use lagna lord
    check_grahas = list(grahas)
    if key == "swasthya":
        check_grahas = [chart["lagna_lord"]]

    for g in check_grahas:
        p = chart["planets"].get(g)
        if not p:
            continue
        score += dignity_strength(p["dignity"])
        # kendra/trikona bonus, dusthana penalty
        if p["bhava"] in (1, 4, 7, 10, 5, 9):
            score += 1
        elif p["bhava"] in (6, 8, 12):
            score -= 1
        count += 1

    if count == 0:
        return "mixed"
    avg = score / count
    if avg >= 1:
        return "strong"
    elif avg <= -0.5:
        return "weak"
    return "mixed"


def fmt(text, name):
    """Replace {name} placeholder with customer name + जी. Handles str or list."""
    first = name.split()[0] if name else ""
    repl = f"{first} जी" if first else ""
    if isinstance(text, list):
        return [t.replace("{name}", repl) if isinstance(t, str) else t for t in text]
    if not text:
        return text
    return text.replace("{name}", repl)


def prepend_name(text, name_ji):
    """Prepend name naturally, avoiding duplicates."""
    if not text or not name_ji:
        return text
    # Don't double-add if already starts with name
    if text.startswith(name_ji):
        return text
    return f"{name_ji}, {text[0].lower() + text[1:]}"


def fmt_join(text, name, sep="\n\n"):
    """Format and join list to string, or format string."""
    f = fmt(text, name)
    if isinstance(f, list):
        return sep.join(f)
    return f



# ---------- शुभ अंक, रंग, दिन, दिशा (लग्न स्वामी + चंद्र राशि से) ----------
GRAHA_SHUBH = {
    "सूर्य":   {"ank": "1", "rang": "लाल, केसरिया व सुनहरा", "din": "रविवार", "ratna": "माणिक्य"},
    "चंद्र":   {"ank": "2", "rang": "सफेद, चांदी व क्रीम", "din": "सोमवार", "ratna": "मोती"},
    "मंगल":   {"ank": "9", "rang": "लाल व मूंगे जैसा", "din": "मंगलवार", "ratna": "मूंगा"},
    "बुध":    {"ank": "5", "rang": "हरा व हल्का हरा", "din": "बुधवार", "ratna": "पन्ना"},
    "गुरु":   {"ank": "3", "rang": "पीला, केसरिया व सुनहरा", "din": "गुरुवार", "ratna": "पुखराज"},
    "शुक्र":   {"ank": "6", "rang": "सफेद, गुलाबी व हल्के रंग", "din": "शुक्रवार", "ratna": "हीरा / ओपल"},
    "शनि":    {"ank": "8", "rang": "नीला, गहरा नीला व काला", "din": "शनिवार", "ratna": "नीलम"},
    "राहु":    {"ank": "4", "rang": "धूम्र व गहरे रंग", "din": "शनिवार", "ratna": "गोमेद"},
    "केतु":    {"ank": "7", "rang": "चितकबरा व मिश्रित रंग", "din": "मंगलवार", "ratna": "लहसुनिया"},
}
RASHI_DISHA = {
    "मेष": "पूर्व", "सिंह": "पूर्व", "धनु": "पूर्व",
    "वृषभ": "दक्षिण", "कन्या": "दक्षिण", "मकर": "दक्षिण",
    "मिथुन": "पश्चिम", "तुला": "पश्चिम", "कुंभ": "पश्चिम",
    "कर्क": "उत्तर", "वृश्चिक": "उत्तर", "मीन": "उत्तर",
}
RASHI_TATVA = {
    "मेष": "अग्नि", "सिंह": "अग्नि", "धनु": "अग्नि",
    "वृषभ": "पृथ्वी", "कन्या": "पृथ्वी", "मकर": "पृथ्वी",
    "मिथुन": "वायु", "तुला": "वायु", "कुंभ": "वायु",
    "कर्क": "जल", "वृश्चिक": "जल", "मीन": "जल",
}

def compute_shubh(chart, name_ji):
    """Personalized lucky numbers, colors, days, directions from lagna lord + moon."""
    lagna = chart["lagna"]
    lord = chart["lagna_lord"]
    moon_rashi = chart["moon_rashi"]
    # Moon rashi lord
    rashi_lords = {"मेष": "मंगल", "वृषभ": "शुक्र", "मिथुन": "बुध", "कर्क": "चंद्र",
                   "सिंह": "सूर्य", "कन्या": "बुध", "तुला": "शुक्र", "वृश्चिक": "मंगल",
                   "धनु": "गुरु", "मकर": "शनि", "कुंभ": "शनि", "मीन": "गुरु"}
    moon_lord = rashi_lords.get(moon_rashi, "चंद्र")
    L = GRAHA_SHUBH.get(lord, GRAHA_SHUBH["गुरु"])
    M = GRAHA_SHUBH.get(moon_lord, GRAHA_SHUBH["चंद्र"])
    disha = RASHI_DISHA.get(lagna, "पूर्व")
    tatva = RASHI_TATVA.get(lagna, "")

    ank_text = (
        f"{name_ji}, आपकी कुंडली के अनुसार आपका मुख्य शुभ अंक **{L['ank']}** है, "
        f"जो आपके लग्न स्वामी {lord} से प्राप्त होता है। "
        f"इसके अतिरिक्त चंद्र राशि ({moon_rashi}) के स्वामी {moon_lord} के कारण अंक **{M['ank']}** भी आपके लिए शुभ है। "
        f"महत्वपूर्ण कार्यों, यात्रा या नए काम की शुरुआत में इन अंकों वाली तिथियों (जैसे {L['ank']}, {M['ank']} तारीख) "
        f"को प्राथमिकता दें — इससे सफलता की संभावना बढ़ती है।\n\n"
        f"व्यावहारिक प्रयोग: मोबाइल नंबर, गाड़ी नंबर या मकान नंबर चुनते समय इन अंकों की प्रधानता रखें। "
        f"परीक्षा, इंटरव्यू या महत्वपूर्ण मीटिंग {L['ank']} या {M['ank']} तारीख को हो तो आत्मविश्वास के साथ जाएं — "
        f"ग्रहों का साथ आपके साथ रहेगा। लॉटरी-सट्टा जैसे कार्यों में इन अंकों का प्रयोग न करें; "
        f"शुभ अंक मेहनत को बल देते हैं, भाग्य का जुआ नहीं।"
    )
    rang_text = (
        f"आपके लग्न स्वामी {lord} के अनुसार आपके शुभ रंग **{L['rang']}** हैं। "
        f"महत्वपूर्ण मुलाकात, इंटरव्यू या शुभ कार्य के दिन इन रंगों के वस्त्र पहनना लाभकारी रहेगा। "
        f"वहीं {M['rang']} रंग भी (चंद्र के प्रभाव से) आपके मन को शांति देंगे। "
        f"घर की {disha} दिशा में इन रंगों का प्रयोग करना विशेष शुभ फल देगा।\n\n"
        f"व्यावहारिक प्रयोग: रोजमर्रा में रुमाल, पर्स या डायरी जैसे छोटी चीजों में शुभ रंग रखें। "
        f"पूजा स्थान पर {L['rang']} रंग का कपड़ा बिछाना शुभ ऊर्जा बढ़ाता है। "
        f"विवाह या मांगलिक कार्यों में इन रंगों को प्राथमिकता दें।"
    )
    din_text = (
        f"सप्ताह में **{L['din']}** आपका सबसे शुभ दिन है — इस दिन नए कार्य शुरू करना, "
        f"महत्वपूर्ण निर्णय लेना व शुभ खरीदारी करना उत्तम रहेगा। "
        f"इसके साथ **{M['din']}** भी आपके लिए सहायक दिन है। "
        f"इन दिनों {lord} के मंत्र का जाप व संबंधित दान करने से ग्रह बल और बढ़ता है।\n\n"
        f"व्यावहारिक प्रयोग: {L['din']} को सुबह {lord} का ध्यान करके दिन शुरू करें। "
        f"इस दिन काले व गहरे रंगों से परहेज करें (यदि {lord} शनि नहीं हैं)। "
        f"महत्वपूर्ण यात्रा {L['din']} या {M['din']} को {disha} दिशा की ओर करना दोगुना शुभ रहेगा।"
    )
    disha_text = (
        f"आपका लग्न {lagna} ({tatva} तत्व) है, अतः आपके लिए शुभ दिशा **{disha}** है। "
        f"घर या कार्यस्थल में {disha} दिशा की ओर मुख करके काम करना, पढ़ना व पूजा करना लाभ देगा। "
        f"लंबी यात्रा या नए घर/दुकान के लिए {disha}-मुखी स्थान चुनना शुभ रहेगा। "
        f"सोते समय सिर {disha} दिशा की ओर रखना भी सकारात्मक ऊर्जा देता है।\n\n"
        f"व्यावहारिक प्रयोग: ऑफिस की टेबल {disha} दिशा में रखें। घर का मुख्य द्वार यदि {disha} दिशा में हो "
        f"तो उत्तम है। पूजा घर हमेशा {disha} या पूर्व दिशा में बनाएं। धन की तिजोरी {disha} दिशा में रखना समृद्धि बढ़ाता है।"
    )
    return [
        ("शुभ अंक", ank_text),
        ("शुभ रंग", rang_text),
        ("शुभ दिन", din_text),
        ("शुभ दिशा", disha_text),
    ]


def compose(chart, name, dob_str, time_str, place_str):
    """Build the full personalized content dict."""
    first = name.split()[0] if name else ""
    name_ji = f"{first} जी" if first else ""

    c = {}
    c["name"] = name
    c["name_ji"] = name_ji
    c["dob_str"] = dob_str
    c["time_str"] = time_str
    c["place_str"] = place_str
    c["lagna"] = chart["lagna"]
    c["lagna_lord"] = chart["lagna_lord"]
    c["moon_rashi"] = chart["moon_rashi"]
    c["nakshatra"] = chart["nakshatra"]
    c["nakshatra_pada"] = chart["nakshatra_pada"]
    c["planets"] = chart["planets"]
    c["yogas"] = chart["yogas"]
    c["current_mahadasha"] = chart["current_mahadasha"]
    c["current_antardasha"] = chart["current_antardasha"]
    c["birth_dasha_lord"] = chart["birth_dasha_lord"]

    # Lagna content — name at opening for personal touch
    lag = lnd.LAGNA_HI.get(chart["lagna"], {})
    c["lagna_swami"] = lag.get("swami", "")
    swabhav = fmt(lag.get("swabhav", ""), name)
    c["lagna_swabhav"] = prepend_name(swabhav, name_ji)
    c["lagna_sharir"] = fmt(lag.get("sharir", ""), name)
    c["lagna_vishesh"] = fmt(lag.get("vishesh", ""), name)

    # Nakshatra content — map English engine name to Hindi key
    nak_hi = NAKSHATRA_EN_HI.get(chart["nakshatra"], chart["nakshatra"])
    c["nakshatra_hi"] = nak_hi
    nak_list = lnd.NAKSHATRA_HI.get(nak_hi, [])
    if not nak_list:
        for k, v in lnd.NAKSHATRA_HI.items():
            if k.lower() == chart["nakshatra"].lower():
                nak_list = v
                break
    c["nakshatra_text"] = [fmt(t, name) for t in (nak_list if isinstance(nak_list, list) else [nak_list])]
    # Name at nakshatra opening
    if c["nakshatra_text"]:
        c["nakshatra_text"][0] = prepend_name(c["nakshatra_text"][0], name_ji)

    # Graha sections — name on strongest graha (exalted/own) for personal highlight
    c["grahas"] = []
    strongest = None
    for g in GRAHA_ORDER:
        p = chart["planets"].get(g, {})
        if p.get("dignity", "") in ("exalted", "own sign"):
            strongest = g
            break
    for g in GRAHA_ORDER:
        p = chart["planets"].get(g, {})
        rashi = p.get("rashi", "")
        bhava = p.get("bhava", 0)
        rashi_text = GRAHA_RASHI.get(g, {}).get(rashi, "")
        bhava_text = GRAHA_BHAVA.get(g, {}).get(bhava, "")
        rt = fmt(rashi_text, name)
        if g == strongest:
            rt = prepend_name(rt, name_ji)
        c["grahas"].append({
            "name": g,
            "rashi": rashi,
            "bhava": bhava,
            "nakshatra": p.get("nakshatra", ""),
            "dignity": p.get("dignity", ""),
            "rashi_text": rt,
            "bhava_text": fmt(bhava_text, name),
        })

    # 15 Samasya
    c["samasyas"] = []
    for key in SAMASYA_KEYS:
        variant = assess_samasya(chart, key)
        templates = sl.SAMASYA_HI.get(key, {})
        text = templates.get(variant, templates.get("mixed", templates.get("general", "")))
        c["samasyas"].append({
            "key": key,
            "title": SAMASYA_TITLES[key],
            "variant": variant,
            "text": fmt(text, name),
        })

    # Dasha — name at opening
    md_lord = chart["current_mahadasha"]["lord"]
    dasha = lnd.DASHA_HI.get(md_lord, {})
    ds = fmt_join(dasha.get("samanya", ""), name)
    c["dasha_samanya"] = prepend_name(ds, name_ji)
    c["dasha_shubh"] = fmt_join(dasha.get("shubh", ""), name)
    c["dasha_savdhani"] = fmt_join(dasha.get("savdhani", ""), name)

    # Upay — pick 3 most relevant grahas (weak ones + lagna lord + current dasha lord)
    upay_grahas = []
    # Current dasha lord first
    if md_lord not in upay_grahas:
        upay_grahas.append(md_lord)
    # Weak grahas
    for g in GRAHA_ORDER:
        p = chart["planets"].get(g, {})
        if dignity_strength(p.get("dignity", "")) < 0 and g not in upay_grahas:
            upay_grahas.append(g)
    # Lagna lord
    if chart["lagna_lord"] not in upay_grahas:
        upay_grahas.append(chart["lagna_lord"])
    # Fill to 5
    for g in GRAHA_ORDER:
        if len(upay_grahas) >= 5:
            break
        if g not in upay_grahas:
            upay_grahas.append(g)
    c["upay_list"] = [(g, fmt(UPAY.get(g, ""), name)) for g in upay_grahas[:5]]

    # Shubh ank/rang/din/disha — personalized from lagna lord + moon
    c["shubh_list"] = compute_shubh(chart, name_ji)

    return c


if __name__ == "__main__":
    import engine_wrap
    chart = engine_wrap.compute_chart(1990, 8, 15, 10, 30, 26.9124, 75.7873, "Rahul")
    c = compose(chart, "राहुल शर्मा", "15 अगस्त 1990", "10:30 AM", "जयपुर, राजस्थान")
    print("Lagna:", c["lagna"])
    print("Grahas:", len(c["grahas"]))
    print("Samasya variants:", [(s["key"], s["variant"]) for s in c["samasyas"]][:5])
    print("Upay grahas:", [g for g, _ in c["upay_list"]])
    print("COMPOSER OK")
