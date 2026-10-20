/* KundaliEngine — Vedic kundali calculation engine (browser JS port of engine.py).
 * Uses astronomy-engine (astronomy.browser.min.js, bundled locally) for tropical
 * longitudes; Lahiri ayanamsa + Meeus mean node computed locally.
 * Load astronomy.browser.min.js BEFORE this file. No network needed.
 */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var Astronomy = root.Astronomy;
  if (!Astronomy) throw new Error('KundaliEngine: Astronomy global missing — load astronomy.browser.min.js first.');

  /* ================= constants (exact port of engine.py) ================= */
  var RASHIS = ['Mesh','Vrushabh','Mithun','Kark','Sinh','Kanya','Tula','Vrshchik','Dhanu','Makar','Kumbh','Meen'];
  var NAKSHATRAS = ['Ashwini','Bharani','Krutika','Rohini','Mrugashirsha','Ardra','Punarvasu','Pushya','Ashlesha',
                'Magha','P.Phalguni','U.Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
                'Mool','P.Ashadha','U.Ashadha','Shravan','Dhanishtha','Shatataraka','P.Bhadrapada','U.Bhadrapada','Revati'];
  var GRAHAS = [['Surya',Astronomy.Body.Sun],['Chandra',Astronomy.Body.Moon],['Mangal',Astronomy.Body.Mars],
                ['Budh',Astronomy.Body.Mercury],['Guru',Astronomy.Body.Jupiter],['Shukra',Astronomy.Body.Venus],
                ['Shani',Astronomy.Body.Saturn],['Rahu',null /*mean node*/]];
  var DASHA_LORDS = ['Ketu','Shukra','Surya','Chandra','Mangal','Rahu','Guru','Shani','Budh'];
  var DASHA_YEARS = [7,20,6,10,7,18,16,19,17];
  var RASHI_LORD = {'Mesh':'Mangal','Vrushabh':'Shukra','Mithun':'Budh','Kark':'Chandra','Sinh':'Surya',
                'Kanya':'Budh','Tula':'Shukra','Vrshchik':'Mangal','Dhanu':'Guru','Makar':'Shani',
                'Kumbh':'Shani','Meen':'Guru'};
  var EXALTED = {'Surya':'Mesh','Chandra':'Vrushabh','Mangal':'Makar','Budh':'Kanya','Guru':'Kark',
             'Shukra':'Meen','Shani':'Tula','Rahu':'Vrushabh','Ketu':'Vrushchik'};
  var DEBILITATED = {'Surya':'Tula','Chandra':'Vrushchik','Mangal':'Kark','Budh':'Meen','Guru':'Makar',
                 'Shukra':'Kanya','Shani':'Mesh','Rahu':'Vrushchik','Ketu':'Vrushabh'};
  var OWN = {'Surya':['Sinh'],'Chandra':['Kark'],'Mangal':['Mesh','Vrshchik'],'Budh':['Mithun','Kanya'],
         'Guru':['Dhanu','Meen'],'Shukra':['Vrushabh','Tula'],'Shani':['Makar','Kumbh']};
  var RASHI_LORD_VALUES = Object.keys(RASHI_LORD).map(function (k) { return RASHI_LORD[k]; });

  /* ================= math helpers ================= */
  var DEG2RAD = Math.PI / 180, RAD2DEG = 180 / Math.PI;
  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r1(x) { return Math.round(x * 10) / 10; }

  // Julian Day for a UTC calendar moment (Meeus; matches swe.julday)
  function jdFromUTC(y, mo, d, hourFloat) {
    if (mo <= 2) { y -= 1; mo += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (mo + 1)) + d + B - 1524.5 + hourFloat / 24;
  }

  // Lahiri ayanamsa, calibrated against swisseph SIDM_LAHIRI (least-squares fit
  // over 1900-2120, max residual 0.00024 deg):
  //   ayan = 23.8572243 + 0.01396951 * (JD - 2451545.0) / 365.25
  function ayanamsa(jd) {
    var yrs = (jd - 2451545.0) / 365.25;
    return 23.8572243 + 0.01396951 * yrs;
  }

  // Geocentric tropical ecliptic longitude, true equinox of date (deg [0,360))
  function tropicalLon(body, date) {
    return Astronomy.Ecliptic(Astronomy.GeoVector(body, date, true)).elon;
  }

  // Mean lunar ascending node (Meeus), tropical degrees
  function meanNode(jd) {
    var T = (jd - 2451545.0) / 36525;
    return norm360(125.04452 - 1934.136261 * T + 0.0020708 * T * T);
  }

  // Tropical ascendant from apparent GAST + mean obliquity (matches swe.houses)
  function ascendantTropical(jd, date, lat, lon) {
    var gastH = Astronomy.SiderealTime(date); // apparent Greenwich sidereal time, hours
    var ramc = gastH * 15 + lon;              // RAMC, degrees
    var T = (jd - 2451545.0) / 36525;
    var eps = 23.4392911 - 0.0130042 * T;    // mean obliquity, degrees
    var R = ramc * DEG2RAD, E = eps * DEG2RAD, P = lat * DEG2RAD;
    var asc = Math.atan2(Math.cos(R), -(Math.sin(R) * Math.cos(E) + Math.tan(P) * Math.sin(E))) * RAD2DEG;
    return norm360(asc);
  }

  function rashiOf(deg) {
    var ri = Math.floor(deg / 30) % 12;
    return [ri, RASHIS[ri]];
  }
  function nakshatraOf(deg) {
    var span = 360 / 27, q = 360 / 108;
    var idx = Math.floor(deg / span) % 27;
    var pada = Math.floor((deg % span) / q) + 1;
    return [NAKSHATRAS[idx], pada];
  }
  function planetEntry(deg) {
    var r = rashiOf(deg), nk = nakshatraOf(deg);
    return { deg: deg, rashi: r[1], rashi_idx: r[0], nakshatra: nk[0], pada: nk[1] };
  }

  /* ================= UTC calendar date helpers (mirror of datetime.date) ================= */
  function addDays(ymd, n) {
    var t = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d) + n * 86400000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }
  function iso(ymd) {
    return ymd.y + '-' + String(ymd.m).padStart(2, '0') + '-' + String(ymd.d).padStart(2, '0');
  }
  function localToday() {
    var t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
  }

  /* ================= yogas (exact port of _detect_yogas) ================= */
  function detectYogas(planets, houses, lagnaRi) {
    var yogas = [];
    var rashiOfP = {}, names = Object.keys(planets);
    names.forEach(function (p) { rashiOfP[p] = planets[p].rashi; });
    function bhavFrom(tRi, refRi) { return (((tRi - refRi) % 12) + 12) % 12 + 1; }
    var moonRi = planets['Chandra'].rashi_idx;

    if (rashiOfP['Surya'] === rashiOfP['Budh']) yogas.push('Budha-Aditya');
    if ([1, 4, 7, 10].indexOf(bhavFrom(planets['Guru'].rashi_idx, moonRi)) !== -1) yogas.push('Gajakesari');
    var others212 = names.filter(function (p) {
      return ['Surya', 'Rahu', 'Ketu'].indexOf(p) === -1 &&
             [2, 12].indexOf(bhavFrom(planets[p].rashi_idx, moonRi)) !== -1;
    });
    if (!others212.length) yogas.push('Kemadruma');
    if (rashiOfP['Chandra'] === rashiOfP['Mangal']) yogas.push('Chandra-Mangal');
    if (rashiOfP['Guru'] === rashiOfP['Mangal']) yogas.push('Guru-Mangal');

    var kendraM = [1, 4, 7, 10].indexOf(bhavFrom(planets['Mangal'].rashi_idx, lagnaRi)) !== -1;
    var kendraS = [1, 4, 7, 10].indexOf(bhavFrom(planets['Shani'].rashi_idx, lagnaRi)) !== -1;
    var kendraG = [1, 4, 7, 10].indexOf(bhavFrom(planets['Guru'].rashi_idx, lagnaRi)) !== -1;
    if (kendraM && (planets['Mangal'].own || planets['Mangal'].exalted)) yogas.push('Ruchaka');
    if (kendraS && (planets['Shani'].own || planets['Shani'].exalted)) yogas.push('Shasha');
    if (kendraG && (planets['Guru'].own || planets['Guru'].exalted)) yogas.push('Hansa');

    names.forEach(function (p) {
      var d = planets[p];
      if (d.debilitated && RASHI_LORD_VALUES.indexOf(p) !== -1) {
        var disp = RASHI_LORD[d.rashi];
        if (planets[disp] &&
            ([1, 4, 7, 10].indexOf(bhavFrom(planets[disp].rashi_idx, lagnaRi)) !== -1 ||
             [1, 4, 7, 10].indexOf(bhavFrom(planets[disp].rashi_idx, moonRi)) !== -1)) {
          yogas.push('Neechbhanga (' + p + ')');
        }
      }
    });

    var r2s = RASHIS[(((lagnaRi + 1) % 12) + 12) % 12];
    var r11 = RASHIS[(((lagnaRi + 10) % 12) + 12) % 12];
    var l2 = RASHI_LORD[r2s], l11 = RASHI_LORD[r11];
    if (rashiOfP[l2] !== undefined && rashiOfP[l2] === rashiOfP[l11]) yogas.push('Dhana');
    return yogas;
  }

  /* ================= main ================= */
  function computeChart(o) {
    var year = o.year, month = o.month, day = o.day;
    var hour = o.hour || 0, minute = o.minute || 0;
    var lat = o.lat, lon = o.lon;

    // IST -> UTC (mirror of engine.py)
    var utH = hour + minute / 60 - 5.5;
    var bd = { y: year, m: month, d: day };
    if (utH < 0) { utH += 24; bd = addDays(bd, -1); }
    var jdUt = jdFromUTC(bd.y, bd.m, bd.d, utH);
    var dateUTC = new Date(Date.UTC(bd.y, bd.m - 1, bd.d) + utH * 3600000);
    var ayan = ayanamsa(jdUt);

    // Planets (sidereal)
    var planets = {};
    GRAHAS.forEach(function (gp) {
      var name = gp[0], body = gp[1];
      var trop = body === null ? meanNode(jdUt) : tropicalLon(body, dateUTC);
      var deg = norm360(trop - ayan);
      var e = planetEntry(deg);
      e.deg = r2(deg);
      e.deg_in_rashi = r1(deg % 30);
      e.exalted = EXALTED[name] === e.rashi;
      e.debilitated = DEBILITATED[name] === e.rashi;
      e.own = (OWN[name] || []).indexOf(e.rashi) !== -1;
      planets[name] = e;
    });
    // Ketu opposite Rahu — NOTE: engine.py uses the ROUNDED Rahu deg here
    var rk = norm360(planets['Rahu'].deg + 180);
    var ke = planetEntry(rk);
    planets['Ketu'] = { deg: r2(rk), rashi: ke.rashi, rashi_idx: ke.rashi_idx,
      deg_in_rashi: r1(rk % 30), nakshatra: ke.nakshatra, pada: ke.pada,
      exalted: false, debilitated: false, own: false };

    // Lagna
    var lagnaDeg = norm360(ascendantTropical(jdUt, dateUTC, lat, lon) - ayan);
    var lr = rashiOf(lagnaDeg);
    var lagnaRi = lr[0];

    // Whole-sign houses from Lagna
    var houses = {};
    Object.keys(planets).forEach(function (pn) {
      houses[pn] = ((((planets[pn].rashi_idx - lagnaRi) % 12) + 12) % 12) + 1;
    });

    // Vimshottari from Moon nakshatra
    var moon = planets['Chandra'];
    var nakIdx = NAKSHATRAS.indexOf(moon.nakshatra);
    var li = nakIdx % 9;
    var nakSpan = 360 / 27;
    var fracDone = (((moon.deg - nakIdx * nakSpan) % nakSpan) + nakSpan) % nakSpan / nakSpan;
    var balance = DASHA_YEARS[li] * (1 - fracDone);

    var mahadashas = [];
    var start = { y: year, m: month, d: day };
    var cur = addDays(start, Math.trunc(balance * 365.25));
    mahadashas.push({ lord: DASHA_LORDS[li], start: iso(start), years: r2(balance), end: iso(cur) });
    var i = (li + 1) % 9;
    while (cur.y < 2120) {
      var yy = DASHA_YEARS[i];
      var nxt = addDays(cur, Math.trunc(yy * 365.25));
      mahadashas.push({ lord: DASHA_LORDS[i], start: iso(cur), end: iso(nxt), years: yy });
      cur = nxt;
      i = (i + 1) % 9;
    }

    // Current mahadasha + antardashas
    var today = localToday();
    var todayIso = iso(today);
    var curMd = null;
    for (var mI = 0; mI < mahadashas.length; mI++) {
      var mm = mahadashas[mI];
      if (mm.start <= todayIso && todayIso <= mm.end) { curMd = mm; break; }
    }
    var mdLord = curMd.lord;
    var mdYears = curMd.years;
    var totalDays = Math.trunc(mdYears * 365.25);
    var antars = [];
    var aStart = { y: +curMd.start.slice(0, 4), m: +curMd.start.slice(5, 7), d: +curMd.start.slice(8, 10) };
    var li2 = DASHA_LORDS.indexOf(mdLord);
    for (var k = 0; k < 9; k++) {
      var al = DASHA_LORDS[(li2 + k) % 9];
      var adays = Math.trunc(totalDays * DASHA_YEARS[(li2 + k) % 9] / 120);
      var aEnd = addDays(aStart, adays);
      antars.push({ lord: al, start: iso(aStart), end: iso(aEnd) });
      aStart = aEnd;
    }

    var yogas = detectYogas(planets, houses, lagnaRi);

    // Sade Sati / Dhaiya (current Saturn transit)
    var jdNow = jdFromUTC(today.y, today.m, today.d, 12);
    var satSid = norm360(tropicalLon(Astronomy.Body.Saturn, new Date(Date.UTC(today.y, today.m - 1, today.d, 12))) - ayanamsa(jdNow));
    var satRi = Math.floor(satSid / 30) % 12;
    var moonRi = planets['Chandra'].rashi_idx;
    var rel = (((satRi - moonRi) % 12) + 12) % 12;
    var sade;
    if (rel === 11 || rel === 0 || rel === 1) {
      var phase = rel === 11 ? 'pratham' : (rel === 0 ? 'beejo (peak)' : 'trijo (antim)');
      sade = { status: 'Sade Sati chalu', phase: phase, shani_rashi: RASHIS[satRi], chandra_rashi: RASHIS[moonRi] };
    } else if (rel === 3 || rel === 7) {
      sade = { status: 'Dhaiya (Kantak/Ashtam Shani) chalu', phase: 'dhaiya', shani_rashi: RASHIS[satRi], chandra_rashi: RASHIS[moonRi] };
    } else {
      sade = { status: 'Sade Sati/Dhaiya nathi', phase: 'mukta', shani_rashi: RASHIS[satRi], chandra_rashi: RASHIS[moonRi] };
    }

    // Yearly Saturn+Jupiter transits, 10-year forecast
    var yearly = [];
    for (var yr = today.y; yr < today.y + 10; yr++) {
      var jdY = jdFromUTC(yr, 6, 15, 12);
      var ayY = ayanamsa(jdY);
      var dY = new Date(Date.UTC(yr, 5, 15, 12));
      var sp = norm360(tropicalLon(Astronomy.Body.Saturn, dY) - ayY);
      var jp = norm360(tropicalLon(Astronomy.Body.Jupiter, dY) - ayY);
      var midIso = yr + '-06-15';
      var mdY = null;
      for (var yI = 0; yI < mahadashas.length; yI++) {
        if (mahadashas[yI].start <= midIso && midIso <= mahadashas[yI].end) { mdY = mahadashas[yI].lord; break; }
      }
      yearly.push({ year: yr, shani_rashi: RASHIS[Math.floor(sp / 30) % 12],
                    guru_rashi: RASHIS[Math.floor(jp / 30) % 12], mahadasha: mdY });
    }

    // Navamsha (D-9)
    var CHARA = { 'Mesh': 1, 'Kark': 1, 'Tula': 1, 'Makar': 1 };
    var STHIRA = { 'Vrushabh': 1, 'Sinh': 1, 'Vrshchik': 1, 'Kumbh': 1 };
    var navamsha = {};
    Object.keys(planets).forEach(function (pn) {
      var p = planets[pn], ri = p.rashi_idx, pada = p.pada, nri;
      if (CHARA[p.rashi]) nri = (ri + pada - 1) % 12;
      else if (STHIRA[p.rashi]) nri = (ri + 8 + pada - 1) % 12;
      else nri = (ri + 4 + pada - 1) % 12;
      navamsha[pn] = nri;
    });

    // Panchang at birth: tithi + vara
    var elong = norm360(planets['Chandra'].deg - planets['Surya'].deg);
    var tithiNum = Math.floor(elong / 12) + 1;
    var paksha = elong < 180 ? 'Shukla' : 'Krishna';
    var TITHIS = ['Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami',
                  'Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima/Amavasya'];
    var tithi = TITHIS[Math.min(tithiNum - 1, 14)];
    if (tithiNum === 15) tithi = paksha === 'Shukla' ? 'Purnima' : 'Amavasya';
    var VARA = ['Somvar','Mangalvar','Budhvar','Guruvar','Shukravar','Shanivar','Ravivar'];
    var wd = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun
    var vara = VARA[(wd + 6) % 7];

    return {
      planets: planets,
      houses: houses,
      lagna: { deg: r2(lagnaDeg), rashi: lr[1], rashi_idx: lagnaRi },
      vimshottari_start: { lord: DASHA_LORDS[li], balance_years: r2(balance) },
      mahadashas: mahadashas,
      current_mahadasha: curMd,
      antardashas: antars,
      yogas: yogas,
      sade_sati: sade,
      yearly: yearly,
      ayanamsa: r2(ayan),
      navamsha: navamsha,
      panchang: { tithi: tithi, paksha: paksha, vara: vara }
    };
  }

  /* ================= Gujarati display maps (exact) ================= */
  var GU_RASHI = {'Mesh':'મેષ','Vrushabh':'વૃષભ','Mithun':'મિથુન','Kark':'કર્ક','Sinh':'સિંહ','Kanya':'કન્યા','Tula':'તુલા','Vrshchik':'વૃશ્ચિક','Dhanu':'ધનુ','Makar':'મકર','Kumbh':'કુંભ','Meen':'મીન'};
  var GU_GRAHA = {'Surya':'સૂર્ય','Chandra':'ચંદ્ર','Mangal':'મંગળ','Budh':'બુધ','Guru':'ગુરુ','Shukra':'શુક્ર','Shani':'શનિ','Rahu':'રાહુ','Ketu':'કેતુ'};
  var GU_NAK = {'Ashwini':'અશ્વિની','Bharani':'ભરણી','Krutika':'કૃત્તિકા','Rohini':'રોહિણી','Mrugashirsha':'મૃગશીર્ષ','Ardra':'આર્દ્રા','Punarvasu':'પુનર્વસુ','Pushya':'પુષ્ય','Ashlesha':'આશ્લેષા','Magha':'મઘા','P.Phalguni':'પૂર્વ ફાલ્ગુની','U.Phalguni':'ઉત્તર ફાલ્ગુની','Hasta':'હસ્ત','Chitra':'ચિત્રા','Swati':'સ્વાતિ','Vishakha':'વિશાખા','Anuradha':'અનુરાધા','Jyeshtha':'જ્યેષ્ઠા','Mool':'મૂળ','P.Ashadha':'પૂર્વાષાઢા','U.Ashadha':'ઉત્તરાષાઢા','Shravan':'શ્રવણ','Dhanishtha':'ધનિષ્ઠા','Shatataraka':'શતતારકા','P.Bhadrapada':'પૂર્વભાદ્રપદ','U.Bhadrapada':'ઉત્તરભાદ્રપદ','Revati':'રેવતી'};
  var GU_VARA = {'Ravivar':'રવિવાર','Somvar':'સોમવાર','Mangalvar':'મંગળવાર','Budhvar':'બુધવાર','Guruvar':'ગુરુવાર','Shukravar':'શુક્રવાર','Shanivar':'શનિવાર'};
  var GU_TITHI = {'Pratipada':'પ્રતિપદા','Dwitiya':'દ્વિતીયા','Tritiya':'તૃતીયા','Chaturthi':'ચતુર્થી','Panchami':'પંચમી','Shashthi':'ષષ્ઠી','Saptami':'સપ્તમી','Ashtami':'અષ્ટમી','Navami':'નવમી','Dashami':'દશમી','Ekadashi':'એકાદશી','Dwadashi':'દ્વાદશી','Trayodashi':'ત્રયોદશી','Chaturdashi':'ચતુર્દશી','Purnima':'પૂર્ણિમા','Amavasya':'અમાવસ્યા'};
  var GU_PAKSHA = {'Shukla':'શુક્લ','Krishna':'કૃષ્ણ'};
  var GU_YOGA = {'Budha-Aditya':'બુધ-આદિત્ય','Gajakesari':'ગજકેસરી','Kemadruma':'કેમદ્રુમ','Chandra-Mangal':'ચંદ્ર-મંગળ','Guru-Mangal':'ગુરુ-મંગળ','Dhana':'ધન','Rajayoga':'રાજયોગ','Neechbhanga':'નીચભંગ','Vipareeta':'વિપરીત','Shasha':'શશ','Ruchaka':'રુચક','Hansa':'હંસ'};
  var GU_SADE = {'Dhaiya (Kantak/Ashtam Shani) chalu':'ઢૈયા (કંટક શનિ) ચાલુ','Sade Sati chalu':'સાડાસાતી ચાલુ','mukta':'મુક્ત','Sade Sati/Dhaiya nathi':'સાડાસાતી/ઢૈયા નથી'};
  var GRAHA_SHORT = {'Surya':'સૂ','Chandra':'ચં','Mangal':'મં','Budh':'બુ','Guru':'ગુ','Shukra':'શુ','Shani':'શ','Rahu':'રા','Ketu':'કે'};
  function D(x){ return GU_GRAHA[x] || GU_RASHI[x] || GU_NAK[x] || GU_VARA[x] || GU_TITHI[x] || GU_PAKSHA[x] || GU_YOGA[x] || x; }
  function DY(y){ var m = /^([A-Za-z-]+)( \((.*)\))?$/.exec(y); if(!m) return y; var base = GU_YOGA[m[1]] || m[1]; return m[3] ? base+' ('+D(m[3])+')' : base; }
  function planetsIn(houses, bhav){ var gs = Object.keys(houses).filter(function(g){return houses[g]===bhav;}).map(D); return gs.length? gs.join(', ') : 'કોઈ નહીં'; }
  function houseLord(lagnaRi, bhav){ var r = RASHIS[(lagnaRi + bhav - 1) % 12]; return {lord: RASHI_LORD[r], rashi: r}; }

  root.KundaliEngine = {
    computeChart: computeChart,
    RASHIS: RASHIS, NAKSHATRAS: NAKSHATRAS, GRAHAS: GRAHAS,
    DASHA_LORDS: DASHA_LORDS, DASHA_YEARS: DASHA_YEARS,
    RASHI_LORD: RASHI_LORD, EXALTED: EXALTED, DEBILITATED: DEBILITATED, OWN: OWN,
    GU_RASHI: GU_RASHI, GU_GRAHA: GU_GRAHA, GU_NAK: GU_NAK, GU_VARA: GU_VARA,
    GU_TITHI: GU_TITHI, GU_PAKSHA: GU_PAKSHA, GU_YOGA: GU_YOGA, GU_SADE: GU_SADE,
    GRAHA_SHORT: GRAHA_SHORT,
    D: D, DY: DY, planetsIn: planetsIn, houseLord: houseLord
  };
})();
