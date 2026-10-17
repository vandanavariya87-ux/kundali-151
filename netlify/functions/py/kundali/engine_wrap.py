# -*- coding: utf-8 -*-
"""Bundled engine wrapper — direct import (no subprocess)."""
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from astro_engine import calculate_full_profile

# Major Indian cities: lat, lng
CITIES = {
    "jaipur": (26.9124, 75.7873),
    "delhi": (28.6139, 77.2090),
    "mumbai": (19.0760, 72.8777),
    "kolkata": (22.5726, 88.3639),
    "chennai": (13.0827, 80.2707),
    "bangalore": (12.9716, 77.5946),
    "bengaluru": (12.9716, 77.5946),
    "hyderabad": (17.3850, 78.4867),
    "ahmedabad": (23.0225, 72.5714),
    "surat": (21.1702, 72.8311),
    "pune": (18.5204, 73.8567),
    "lucknow": (26.8467, 80.9462),
    "kanpur": (26.4499, 80.3319),
    "nagpur": (21.1458, 79.0882),
    "indore": (22.7196, 75.8577),
    "bhopal": (23.2599, 77.4126),
    "patna": (25.5941, 85.1376),
    "varanasi": (25.3176, 82.9739),
    "agra": (27.1767, 78.0081),
    "rajkot": (22.3039, 70.8022),
    "vadodara": (22.3072, 73.1812),
    "udaipur": (24.5854, 73.7125),
    "jodhpur": (26.2389, 73.0243),
    "kota": (25.2138, 75.8648),
    "nashik": (19.9975, 73.7898),
    "thane": (19.2183, 72.9781),
    "ludhiana": (30.9010, 75.8573),
    "amritsar": (31.6340, 74.8723),
    "chandigarh": (30.7333, 76.7794),
    "dehradun": (30.3165, 78.0322),
    "ranchi": (23.3441, 85.3096),
    "bhubaneswar": (20.2961, 85.8245),
    "guwahati": (26.1445, 91.7362),
    "kochi": (9.9312, 76.2673),
    "coimbatore": (11.0168, 76.9558),
    "visakhapatnam": (17.6868, 83.2185),
    "vijayawada": (16.5062, 80.6480),
    "mysuru": (12.2958, 76.6394),
    "mysore": (12.2958, 76.6394),
    "aurangabad": (19.8762, 75.3433),
    "gwalior": (26.2183, 78.1828),
    "jabalpur": (23.1599, 79.9120),
    "raipur": (21.2514, 81.6296),
}

GRAHA_HI = {
    "Sun": "सूर्य", "Moon": "चंद्र", "Mars": "मंगल", "Mercury": "बुध",
    "Jupiter": "गुरु", "Venus": "शुक्र", "Saturn": "शनि",
    "Rahu": "राहु", "Ketu": "केतु",
}

RASHI_HI = {
    "Aries": "मेष", "Taurus": "वृषभ", "Gemini": "मिथुन", "Cancer": "कर्क",
    "Leo": "सिंह", "Virgo": "कन्या", "Libra": "तुला", "Scorpio": "वृश्चिक",
    "Sagittarius": "धनु", "Capricorn": "मकर", "Aquarius": "कुंभ", "Pisces": "मीन",
}

RASHI_NUM = {
    "Aries": 1, "Taurus": 2, "Gemini": 3, "Cancer": 4, "Leo": 5, "Virgo": 6,
    "Libra": 7, "Scorpio": 8, "Sagittarius": 9, "Capricorn": 10, "Aquarius": 11, "Pisces": 12,
}


def _nominatim(place):
    """Free-text city → lat/lon via OpenStreetMap Nominatim (cached per call)."""
    try:
        import urllib.request, urllib.parse, json
        q = urllib.parse.quote(place.strip() + ", India")
        url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + q
        req = urllib.request.Request(url, headers={"User-Agent": "kundali-pdf/1.0", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=8) as r:
            arr = json.loads(r.read().decode("utf-8"))
        if arr:
            lat, lon = float(arr[0]["lat"]), float(arr[0]["lon"])
            if 6 <= lat <= 38 and 66 <= lon <= 98:
                return (lat, lon)
    except Exception:
        pass
    return None


def geocode(place):
    key = place.strip().lower()
    if key in CITIES:
        return CITIES[key]
    for k, v in CITIES.items():
        if k in key or key in k:
            return v
    # fallback: free-text lookup via Nominatim
    return _nominatim(place)


def compute_chart(year, month, day, hour, minute, lat, lng, name=""):
    data = calculate_full_profile({
        "name": name,
        "year": year, "month": month, "day": day,
        "hour": hour, "minute": minute,
        "lat": lat, "lng": lng, "tz": "Asia/Kolkata",
        "time_known": True,
        "systems": ["vedic"],
        "mode": "natal",
    })
    v = data["charts"]["vedic"]

    planets = {}
    for eng, info in v["planets"].items():
        hi = GRAHA_HI[eng]
        planets[hi] = {
            "rashi_en": info["sign"],
            "rashi": RASHI_HI[info["sign"]],
            "rashi_num": RASHI_NUM[info["sign"]],
            "bhava": info["house"],
            "nakshatra": info["nakshatra"],
            "pada": info.get("pada"),
            "dignity": info.get("dignity", ""),
            "retro": info.get("retrograde", False),
        }

    lagna_en = v["lagna"]["sign"]
    nak = v["janma_nakshatra"]
    vd = v["vimshottari_dasha"]

    return {
        "lagna_en": lagna_en,
        "lagna": RASHI_HI[lagna_en],
        "lagna_lord_en": v["lagna"]["lord"],
        "lagna_lord": GRAHA_HI.get(v["lagna"]["lord"], v["lagna"]["lord"]),
        "moon_rashi": RASHI_HI[v["janma_rashi"]["sign"]],
        "nakshatra": nak["name"],
        "nakshatra_pada": nak.get("pada"),
        "planets": planets,
        "yogas": v.get("yogas", []),
        "birth_dasha_lord": GRAHA_HI.get(vd["birth_dasha_lord"], vd["birth_dasha_lord"]),
        "current_mahadasha": {
            "lord": GRAHA_HI.get(vd["current_mahadasha"]["lord"], vd["current_mahadasha"]["lord"]),
            "start": vd["current_mahadasha"]["start"],
            "end": vd["current_mahadasha"]["end"],
        },
        "current_antardasha": {
            "lord": GRAHA_HI.get(vd["current_antardasha"]["lord"], vd["current_antardasha"]["lord"]),
            "start": vd["current_antardasha"]["start"],
            "end": vd["current_antardasha"]["end"],
        },
        "mangal_dosha": v.get("mangal_dosha"),
        "sade_sati": v.get("sade_sati", {}),
    }


def rashi_in_bhava(chart):
    lagna_num = RASHI_NUM[chart["lagna_en"]]
    return {b: ((lagna_num + b - 2) % 12) + 1 for b in range(1, 13)}
