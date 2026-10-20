/* pdfkit-sankshipt.js — "જન્મ કુંડળી — સંક્ષિપ્ત સંસ્કરણ" (~11 pages) on the PDFKit engine.
 *
 * The ₹51 tripwire report: cover + birth details + "એક નજરમાં તમારી કુંડળી"
 * summary box + lagna/navamsa charts + graha sthiti + lagna/rashi/nakshatra
 * phal (abridged, one page) + current mahadasha-antardasha + 2026-27
 * sankshipt varshphal + shubh vigato + ₹199 upsell page.
 *
 * Load order: pdfkit-bundle.js, fonts.js, engine.js, analysis.js, towns.js,
 *             content.js (global KC), varshphal-content.js (global V3),
 *             pdfkit-core.js (global PK), pdfkit-sankshipt.js
 *
 * Contract:
 *   window.KundaliPDFKit.generateSankshipt(chart, customer, onProgress) -> Promise<Uint8Array>
 *   customer = { name, dateStr, timeStr, placeName, birth:{y,m,d} }
 *   Display names ALWAYS via KundaliEngine.D (zero Roman astro terms).
 *
 * Does NOT touch generateBook1 / generateBook2.
 */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;

  var GRAHAS = ['Surya', 'Chandra', 'Mangal', 'Budh', 'Guru', 'Shukra', 'Shani', 'Rahu', 'Ketu'];

  /* ★ Astrologer attribution — the exact name comes from the user later;
   * this one-line constant is the ONLY place it needs changing. ★ */
  var ASTROLOGER_CREDIT = "વિજેન્દ્ર શાસ્ત્રીજી";

  function KE() { return root.KundaliEngine; }
  function KA() { return root.KundaliAnalysis; }
  function getKC() {
    if (!root.KC) throw new Error('KundaliPDFKit.sankshipt: KC missing — load content.js first.');
    return root.KC;
  }
  function getV3() {
    if (!root.V3) throw new Error('KundaliPDFKit.sankshipt: V3 missing — load varshphal-content.js first.');
    return root.V3;
  }
  function getPK() {
    if (!root.PK) throw new Error('KundaliPDFKit.sankshipt: PK missing — load pdfkit-core.js first.');
    return root.PK;
  }
  function D(x) { return KE().D(x); }

  /* ★ Bigger type for the ₹51 template (user feedback: text too small).
   * PK core defaults are untouched, so the full Sampoorna report renders
   * byte-identically; these local wrappers pass explicit sizes. ★ */
  var FS51 = { h1: 22, h2: 18, body: 15.5, bullet: 15.5, table: 13 };
  function H1(book, t) { getPK().h1(book, t, FS51.h1); }
  function H2(book, t) { getPK().h2(book, t, FS51.h2); }
  function BD(book, t) { getPK().body(book, t, FS51.body); }
  function BL(book, arr, size) { getPK().bullets(book, arr, size || FS51.bullet); }
  function TB(book, rows, widths, opts) {
    opts = opts || {};
    if (!opts.fontSize) opts.fontSize = FS51.table;
    getPK().table(book, rows, widths, opts);
  }

  /* ASCII digits -> Gujarati digits (safe for the Gu font). */
  function guD(s) {
    return String(s).replace(/[0-9]/g, function (d) { return String.fromCharCode(0xAE6 + (+d)); });
  }

  /* Fill {placeholder} from data; throw if any {…} remains unfilled. */
  function fill(tpl, data) {
    var s = String(tpl).replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, function (m, k) {
      return (data && data[k] !== undefined && data[k] !== null) ? data[k] : m;
    });
    var left = s.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/);
    if (left) throw new Error('KundaliPDFKit.sankshipt: unfilled placeholder ' + left[0] +
      ' in: ' + s.slice(0, 140));
    return s;
  }
  function sentences(t) {
    return String(t).split(/(?<=[।.!?…])\s+/).filter(function (s) { return s.trim().length > 0; });
  }
  function abridge(t, n) {
    var s = sentences(t);
    if (s.length <= n) return String(t).trim();
    return s.slice(0, n).join(' ') + ' …';
  }
  function pickRot(list, i) {
    if (!list || !list.length) throw new Error('KundaliPDFKit.sankshipt: ખાલી content list');
    return list[i % list.length];
  }

  /* Navamsha lagna rashi idx from natal lagna (same math as engine navamsha). */
  function navamshaLagnaRi(chart) {
    var lr = chart.lagna.rashi_idx, deg = chart.lagna.deg, r = chart.lagna.rashi;
    var span = 360 / 27, q = 360 / 108;
    var pada = Math.floor((((deg % span) + span) % span) / q) + 1;
    var chara = { Mesh: 1, Kark: 1, Tula: 1, Makar: 1 };
    var sthira = { Vrushabh: 1, Sinh: 1, Vrshchik: 1, Kumbh: 1 };
    if (chara[r]) return (lr + pada - 1) % 12;
    if (sthira[r]) return (lr + 8 + pada - 1) % 12;
    return (lr + 4 + pada - 1) % 12;
  }
  function sthitiText(p) {
    if (p.exalted) return 'ઉચ્ચ';
    if (p.debilitated) return 'નીચ';
    if (p.own) return 'સ્વગૃહી';
    return '—';
  }
  function dateGu(iso) { return KA().dateGu(iso); }

  function makeCtx(book, chart, customer) {
    var ke = KE(), P = chart.planets, HO = chart.houses, LG = chart.lagna;
    return {
      PK: getPK(), KC: getKC(), V3: getV3(), KA: KA(),
      book: book, chart: chart, customer: customer,
      P: P, HO: HO, LG: LG, lagnaRi: LG.rashi_idx,
      moon: P.Chandra, cmd: chart.current_mahadasha,
      RASHIS: ke.RASHIS
    };
  }

  /* ================= section builders ================= */

  function secJanmVivaran(ctx) {
    var PK = ctx.PK, book = ctx.book, c = ctx.customer, LG = ctx.LG, moon = ctx.moon;
    H1(book, 'જન્મ વિવરણ');
    TB(book, [
      ['નામ', c.name],
      ['જન્મ તારીખ', c.dateStr],
      ['જન્મ સમય', c.timeStr + ' (IST)'],
      ['જન્મ સ્થળ', c.placeName],
      ['લગ્ન', D(LG.rashi) + ' (' + LG.deg + ')'],
      ['ચંદ્ર રાશિ', D(moon.rashi)],
      ['નક્ષત્ર', D(moon.nakshatra) + ' (પદ ' + moon.pada + ')'],
      ['અયનાંશ (લાહિરી)', ctx.chart.ayanamsa + '']
    ], [0.35, 0.65], {});
    PK.footer(book);
  }

  /* "એક નજરમાં તમારી કુંડળી" — data-driven 4-5 line summary in a gold-bordered
   * card, placed right after જન્મ વિવરણ. Every value comes from the chart object
   * (zero hardcoding); 2026-27 line is gochar-based via KA.yearlyAnalysis.
   * BIG TYPE (user feedback): heading 21pt, lines 17.5pt. Card height is fixed
   * and sized for heading + 5 single-line bullets — each line was measured to
   * fit one line at 17.5pt within the card width (re-check if wording changes). */
  function secNajarBox(ctx) {
    var PK = ctx.PK, book = ctx.book, doc = book.doc;
    var C = PK.COLORS, PG = PK.PAGE;
    var LG = ctx.LG, moon = ctx.moon, cmd = ctx.cmd, KA = ctx.KA;

    var today = KA.todayISO(), curAD = null;
    (ctx.chart.antardashas || []).forEach(function (ad) {
      if (!curAD && ad.start <= today && today <= ad.end) curAD = ad;
    });
    var dashaLine = curAD
      ? 'દશા: ' + D(cmd.lord) + ' મહાદશા + ' + D(curAD.lord) +
        ' અંતર્દશા (' + dateGu(curAD.end) + ' સુધી)'
      : 'દશા: ' + D(cmd.lord) + ' મહાદશા (' + dateGu(cmd.end) + ' સુધી)';
    var ya = KA.yearlyAnalysis(ctx.chart, ctx.customer.birth, 2026);
    var lines = [
      'લગ્ન: ' + D(LG.rashi) + ' લગ્નમાં જન્મ',
      'ચંદ્ર રાશિ: ' + D(moon.rashi),
      'નક્ષત્ર: ' + D(moon.nakshatra) + ' (પદ ' + guD(moon.pada) + ')',
      dashaLine,
      guD('2026-27') + 'માં શનિ ' + D(ya.shani.rashi) + 'માં, ગુરુ ' +
        D(ya.guru.rashi) + 'માં ગોચર'
    ];

    var NH2 = 21, NBL = 17.5;
    var h2lead = +(NH2 * 1.55).toFixed(2);
    var blLead = +(NBL * 1.55).toFixed(2);
    var headH = 10 + h2lead + 6;      /* h2: spaceBefore + 1 line + spaceAfter */
    var lineH = blLead + 4;           /* per-bullet block, mirrors PK.bullets */
    var pad = 18;
    var cardH = Math.ceil(pad + headH + 5 * lineH + pad);

    var x0 = PG.MARGIN - 8, w = PG.CW + 16;
    var y0 = book.y + 6;
    if (y0 + cardH > PG.BOTTOM) { PK.pageBreak(book); y0 = book.y + 6; }
    doc.save();
    doc.fillColor('#FFF9EC').strokeColor(C.GOLD).lineWidth(1.8);
    if (doc.roundedRect) doc.roundedRect(x0, y0, w, cardH, 10).fillAndStroke();
    else doc.rect(x0, y0, w, cardH).fillAndStroke();
    doc.restore();
    book.y = y0 + pad;
    PK.h2(book, 'એક નજરમાં તમારી કુંડળી', NH2);
    PK.bullets(book, lines, NBL);
    book.y = y0 + cardH + 14;

    /* Footer credit line near the bottom of this page (shaping-safe via BD). */
    book.y = PG.BOTTOM - 44;
    BD(book, 'તૈયાર કરનાર: ' + ASTROLOGER_CREDIT);
    PK.footer(book);
  }

  function secLagnaChart(ctx) {
    var PK = ctx.PK, book = ctx.book;
    BD(book, 'નીચેની કુંડળીમાં લગ્નથી ગણતરી કરેલા ૧૨ ભાવો અને ગ્રહો દર્શાવ્યા છે. ' +
      'પ્રથમ ભાવ (ઉપરનું કેન્દ્ર) લગ્ન છે — અહીંથી જીવનનું સમગ્ર ચિત્ર શરૂ થાય છે.');
    PK.diamondChart(book, ctx.lagnaRi, ctx.HO, 'લગ્ન કુંડળી');
    PK.footer(book);
  }

  function secNavamshaChart(ctx) {
    var PK = ctx.PK, book = ctx.book;
    BD(book, 'નવાંશ કુંડળી ગ્રહોના સૂક્ષ્મ બળ અને જીવનના ઊંડા વિષયો માટે જોવામાં આવે છે.');
    var nlri = navamshaLagnaRi(ctx.chart), nh = {};
    GRAHAS.forEach(function (g) {
      nh[g] = (((ctx.chart.navamsha[g] - nlri) % 12) + 12) % 12 + 1;
    });
    PK.diamondChart(book, nlri, nh, 'નવાંશ કુંડળી');
    PK.footer(book);
  }

  function secGrahaSthiti(ctx) {
    var PK = ctx.PK, book = ctx.book;
    H1(book, 'ગ્રહ સ્થિતિ');
    var rows = [['ગ્રહ', 'રાશિ', 'અંશ', 'નક્ષત્ર', 'ભાવ', 'સ્થિતિ']];
    GRAHAS.forEach(function (g) {
      var p = ctx.P[g];
      rows.push([D(g), D(p.rashi), p.deg_in_rashi + '',
        D(p.nakshatra) + ' (' + p.pada + ')', String(ctx.HO[g]), sthitiText(p)]);
    });
    TB(book, rows, [0.16, 0.16, 0.12, 0.24, 0.10, 0.22], { header: true });
    BD(book, 'ઉપરના કોષ્ટકમાં જન્મ સમયે દરેક ગ્રહની રાશિ, અંશ, નક્ષત્ર અને ભાવ સ્થિતિ દર્શાવી છે.');
    PK.footer(book);
  }

  /* The three short phals share one page: lagna + chandra rashi + nakshatra. */
  function secPhalSankshipt(ctx) {
    var PK = ctx.PK, book = ctx.book, KC = ctx.KC;
    H1(book, 'સંક્ષિપ્ત ફળકથન');
    var lagnaT = KC.LAGNA_PHAL[ctx.LG.rashi];
    if (!lagnaT) throw new Error('KundaliPDFKit.sankshipt: LAGNA_PHAL[' + ctx.LG.rashi + '] મળ્યું નથી.');
    H2(book, 'લગ્ન: ' + D(ctx.LG.rashi));
    BD(book, abridge(fill(lagnaT, {}), 2));
    var rashiT = KC.RASHI_PHAL[ctx.moon.rashi];
    if (!rashiT) throw new Error('KundaliPDFKit.sankshipt: RASHI_PHAL[' + ctx.moon.rashi + '] મળ્યું નથી.');
    H2(book, 'ચંદ્ર રાશિ: ' + D(ctx.moon.rashi));
    BD(book, abridge(fill(rashiT, {}), 2));
    var nakT = KC.NAKSHATRA_PHAL[ctx.moon.nakshatra];
    if (!nakT) throw new Error('KundaliPDFKit.sankshipt: NAKSHATRA_PHAL[' + ctx.moon.nakshatra + '] મળ્યું નથી.');
    H2(book, 'નક્ષત્ર: ' + D(ctx.moon.nakshatra) + ' (પદ ' + ctx.moon.pada + ')');
    BD(book, abridge(fill(nakT, {}), 2));
    PK.footer(book);
  }

  function secDasha(ctx) {
    var PK = ctx.PK, book = ctx.book, KC = ctx.KC, cmd = ctx.cmd;
    if (!cmd) throw new Error('KundaliPDFKit.sankshipt: વર્તમાન મહાદશાની ગણતરી ઉપલબ્ધ નથી.');
    var mdPhal = KC.MAHADASA_PHAL[cmd.lord];
    if (!mdPhal) throw new Error('KundaliPDFKit.sankshipt: MAHADASA_PHAL[' + cmd.lord + '] મળ્યું નથી.');
    H1(book, 'વર્તમાન દશા');
    H2(book, 'વર્તમાન મહાદશા: ' + D(cmd.lord) + ' (' + dateGu(cmd.start) + ' થી ' + dateGu(cmd.end) + ')');
    BD(book, abridge(fill(mdPhal, {}), 3));
    H2(book, D(cmd.lord) + ' મહાદશાની અંતર્દશાઓ');
    BD(book, 'દરેક અંતર્દશા તેના સ્વામી ગ્રહના સ્વભાવ અનુસાર ફળ આપતી માનવામાં આવે છે. (વર્તમાન) નોંધેલી અંતર્દશા હાલ ચાલી રહી છે.');
    var today = ctx.KA.todayISO();
    var rows = [['અંતર્દશા', 'શરૂઆત', 'સમાપ્તિ']];
    (ctx.chart.antardashas || []).forEach(function (ad) {
      var cur = (ad.start <= today && today <= ad.end) ? ' (વર્તમાન)' : '';
      rows.push([D(ad.lord) + cur, dateGu(ad.start), dateGu(ad.end)]);
    });
    TB(book, rows, [0.34, 0.33, 0.33], { header: true });
    PK.footer(book);
  }

  function secVarshphal(ctx) {
    var PK = ctx.PK, book = ctx.book, V3 = ctx.V3, KA = ctx.KA, chart = ctx.chart;
    H1(book, 'વર્ષફળ ' + guD('2026-27'));
    BD(book, 'આગામી બે વર્ષનું સંક્ષિપ્ત માર્ગદર્શન — દશા અને મુખ્ય ગ્રહોના ગોચર આધારે.');
    [2026, 2027].forEach(function (y, yi) {
      var ya = KA.yearlyAnalysis(chart, ctx.customer.birth, y);
      H2(book, 'વર્ષ ' + guD(y));
      var mdLord = ya.midMD;
      var yS = y + '-01-01', yE = y + '-12-31', mdRec = null;
      (chart.mahadashas || []).forEach(function (md) {
        if (md.lord === mdLord && md.start <= yE && md.end >= yS) mdRec = md;
      });
      var mdRange = mdRec ? dateGu(mdRec.start) + ' થી ' + dateGu(mdRec.end) : '';
      var adSummary = ya.segments.map(function (s) {
        return D(s.adLord) + ' (' + dateGu(s.start) + ' થી ' + dateGu(s.end) + ')';
      }).join(' અને ');
      BD(book, fill(pickRot(V3.VARSH_OPENING, yi),
        { year: String(y), umar: String(ya.umar), md: D(mdLord), md_range: mdRange, ad_summary: adSummary }));
      BD(book, 'શનિ ચંદ્રથી ' + ya.shani.hMoon + 'મા ભાવમાં (' + D(ya.shani.rashi) + ' રાશિમાં): ' +
        fill(V3.SHANI_GOCHAR[String(ya.shani.hMoon)], { gh: String(ya.shani.hMoon) }));
      BD(book, 'ગુરુ ચંદ્રથી ' + ya.guru.hMoon + 'મા ભાવમાં (' + D(ya.guru.rashi) + ' રાશિમાં): ' +
        fill(V3.GURU_GOCHAR[String(ya.guru.hMoon)], { gh: String(ya.guru.hMoon) }));
      var ax = ya.rahu.hMoon <= 6 ? ya.rahu.hMoon : ya.rahu.hMoon - 6;
      BD(book, 'રાહુ ચંદ્રથી ' + ya.rahu.hMoon + 'મા અને કેતુ ' + ya.ketu.hMoon + 'મા ભાવમાં: ' +
        fill(V3.RAHU_AXIS[String(ax)], { gh: String(ya.rahu.hMoon), kh: String(ya.ketu.hMoon) }));
      BD(book, fill(pickRot(V3.VARSH_CLOSING, yi), { year: String(y) }));
    });
    PK.footer(book);
  }

  function secShubh(ctx) {
    var PK = ctx.PK, book = ctx.book, KC = ctx.KC;
    H1(book, 'શુભ વિગતો');
    var lagnaLord = KE().houseLord(ctx.lagnaRi, 1).lord;
    var mdLord = ctx.cmd.lord;
    var list = [lagnaLord];
    if (mdLord !== lagnaLord) list.push(mdLord);
    var rows = [['ગ્રહ', 'શુભ રંગ', 'શુભ અંક', 'શુભ દિવસ', 'રત્ન']];
    list.forEach(function (g) {
      var s = KC.SHUBH[g] || {};
      var tag = g === lagnaLord ? ' (લગ્નેશ)' : ' (વર્તમાન દશેશ)';
      rows.push([D(g) + tag, s.rang || '—', s.ank || '—', s.din || '—', s.ratna || '—']);
    });
    TB(book, rows, [0.18, 0.28, 0.14, 0.18, 0.22], { header: true });
    BD(book, 'આ શુભ વિગતો સામાન્ય માર્ગદર્શન માટે છે — શ્રદ્ધા અને વિવેકથી ઉપયોગ કરવો.');
    PK.footer(book);
  }

  /* Upsell page: what the ₹199 Vistar Kundali includes + green WhatsApp CTA
   * button (PDF link annotation → wa.me). The old "નોંધ" disclaimer line was
   * removed per user order. */
  var WA_URL = 'https://wa.me/917575831059?text=' +
    encodeURIComponent('મને વિસ્તૃત કુંડળી જોઈએ છે');

  function secUpsell(ctx) {
    var PK = ctx.PK, book = ctx.book, doc = book.doc;
    var PG = PK.PAGE;
    H1(book, 'વિસ્તૃત કુંડળી — માત્ર રૂ. ' + guD('199'));
    BD(book, 'આ સંક્ષિપ્ત સંસ્કરણ હતું. સંપૂર્ણ ઊંડાણ માટે વિસ્તૃત કુંડળીમાં આ બધું મળશે:');
    BL(book, [
      'મંગળ દોષ / કાળ સર્પ દોષ / સાડા સાતી વિશ્લેષણ',
      guD('10') + ' વર્ષનું ભવિષ્યફળ',
      'વિવાહ યોગ વિશ્લેષણ',
      'કારકિર્દી / વ્યાપાર માર્ગદર્શન',
      'ગ્રહ શાંતિના ઉપાય'
    ]);
    PK.spacer(book, 14);

    /* Green WhatsApp CTA button, centered, with a real PDF link annotation
     * so it taps through on phones. */
    var labelA = 'WhatsApp', labelB = ' કરો: ' + guD('7575831059');
    var btnSize = 18, btnH = 50, btnW = 400;
    var bx = PG.MARGIN + (PG.CW - btnW) / 2, by = book.y + 4;
    if (by + btnH > PG.BOTTOM) { PK.pageBreak(book); by = book.y + 4; }
    doc.save();
    doc.fillColor('#1FA855');
    if (doc.roundedRect) doc.roundedRect(bx, by, btnW, btnH, 12).fill();
    else doc.rect(bx, by, btnW, btnH).fill();
    doc.restore();
    /* Centered mixed-script label: measure each run in its own font. */
    doc.fontSize(btnSize);
    var wA = doc.font('Helvetica-Bold').widthOfString(labelA);
    var wB = doc.font('GuB').widthOfString(labelB);
    var tx = bx + (btnW - wA - wB) / 2;
    var ty = by + (btnH - btnSize * 1.25) / 2;
    doc.fillColor('#FFFFFF');
    doc.font('Helvetica-Bold').text(labelA, tx, ty, { lineBreak: false });
    doc.font('GuB').text(labelB, tx + wA, ty, { lineBreak: false });
    doc.link(bx, by, btnW, btnH, WA_URL);
    book.y = by + btnH + 16;
    PK.footer(book);
  }

  /* ================= section registry (fixed order) ================= */

  function buildSections(ctx) {
    var S = [];
    S.push({ title: 'જન્મ વિવરણ', fn: secJanmVivaran });
    S.push({ title: 'એક નજરમાં તમારી કુંડળી', fn: secNajarBox });
    S.push({ title: 'લગ્ન કુંડળી', fn: secLagnaChart });
    S.push({ title: 'નવાંશ કુંડળી', fn: secNavamshaChart });
    S.push({ title: 'ગ્રહ સ્થિતિ', fn: secGrahaSthiti });
    S.push({ title: 'સંક્ષિપ્ત ફળકથન', fn: secPhalSankshipt });
    S.push({ title: 'વર્તમાન દશા', fn: secDasha });
    S.push({ title: 'વર્ષફળ ' + guD('2026-27'), fn: secVarshphal });
    S.push({ title: 'શુભ વિગતો', fn: secShubh });
    S.push({ title: 'વિસ્તૃત કુંડળી', fn: secUpsell });
    return S;
  }

  /* ================= public contract ================= */

  root.KundaliPDFKit = root.KundaliPDFKit || {};
  root.KundaliPDFKit.generateSankshipt = async function (chart, customer, onProgress) {
    if (!chart || !chart.planets || !chart.houses || !chart.lagna) {
      throw new Error('KundaliPDFKit.generateSankshipt: invalid chart object.');
    }
    if (!customer || !customer.name) {
      throw new Error('KundaliPDFKit.generateSankshipt: customer.name required.');
    }
    if (!chart.current_mahadasha) {
      throw new Error('KundaliPDFKit.generateSankshipt: વર્તમાન મહાદશાની ગણતરી ઉપલબ્ધ નથી.');
    }
    var PK = getPK(), V3 = getV3(); // asserts globals are loaded
    void V3;
    var prog = (typeof onProgress === 'function') ? onProgress : function () {};
    var book = PK.newBook('જન્મ કુંડળી (સંક્ષિપ્ત) — ' + customer.name);

    /* Cover */
    var LG = chart.lagna, moon = chart.planets.Chandra;
    PK.cover(book, {
      title: 'જન્મ કુંડળી',
      subtitle: 'સંક્ષિપ્ત સંસ્કરણ — માત્ર રૂ. ' + guD('51'),
      name: customer.name,
      subSize: 16, nameSize: 23, lineSize: 15,
      lines: [
        'તૈયાર કરનાર: ' + ASTROLOGER_CREDIT,
        'જન્મ તારીખ: ' + customer.dateStr + '    જન્મ સમય: ' + customer.timeStr + '    જન્મ સ્થળ: ' + customer.placeName,
        'લગ્ન: ' + D(LG.rashi) + '    ચંદ્ર રાશિ: ' + D(moon.rashi) + '    નક્ષત્ર: ' + D(moon.nakshatra) + ' (પદ ' + moon.pada + ')'
      ]
    });
    prog(0.02);

    /* Sections (fixed list, no index reservation — short report) */
    var ctx = makeCtx(book, chart, customer);
    var sections = buildSections(ctx);
    PK.pageBreak(book); // cover -> first content page
    for (var i = 0; i < sections.length; i++) {
      (function (s, idx) {
        if (idx > 0) PK.pageBreak(book);
        PK.section(book, s.title, function () { s.fn(ctx); });
      })(sections[i], i);
      prog(0.02 + 0.96 * (i + 1) / sections.length);
    }

    var bytes = await PK.finish(book, prog);
    prog(1);
    return bytes;
  };
})();
