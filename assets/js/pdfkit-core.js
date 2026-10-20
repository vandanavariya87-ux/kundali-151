/* pdfkit-core.js — shared PDFKit infrastructure for the Kundali PWA.
 *
 * LOAD ORDER: pdfkit-bundle.js, fonts.js, engine.js, analysis.js, THEN this file.
 *
 * Globals used:
 *   PDFKit        (required)  — PDFKit constructor (browser bundle or node module).
 *   KundaliFonts  (required)  — { regular: <base64>, bold: <base64> } Gujarati fonts.
 *   KundaliEngine (optional)  — .D(x) display names, .GRAHA_SHORT; else local fallback.
 *
 * Exposes: window.PK (globalThis.PK in node).
 *
 * Proven patterns used (do not "improve"):
 *   new PDFKit({size:'A4', margin:56, bufferPages:true})
 *   doc.registerFont('Gu'/'GuB', <font bytes>)          — base64->Buffer (node) / Uint8Array (browser)
 *   doc.outline.addItem(title, {pageNumber: <0-based>})
 *   GoTo: var d = doc.page.dictionary (on target page);
 *         doc.annotate(x, y, w, h, {Subtype:'Link', Dest:[d,'Fit']})  // x,y from top, points
 *   doc.switchToPage(n) with bufferPages:true
 *
 * Text engine: Noto Sans Gujarati covers Gujarati + digits + basic punctuation but
 * NOT Latin letters or symbols (like build_report.py's gu() mixed-font helper, Gujarati
 * runs use Gu/GuB and every other run uses built-in Helvetica/Helvetica-Bold).
 * The footer "^ to index" arrow is drawn as vector lines (U+2191 is in neither font).
 */
(function () {
'use strict';
var root = typeof window !== 'undefined' ? window : globalThis;

/* ================= page geometry (A4, points) ================= */
var PW = 595.28, PH = 841.89;
var MARGIN = 56;
var CW = PW - 2 * MARGIN;            // content width
var TOP = MARGIN;                    // first text y, from top
var FOOT_ZONE = 46;                  // bottom reserve for footer
var BOTTOM = PH - MARGIN - FOOT_ZONE; // last text y, from top

/* ================= theme (ported from build_report.py) ================= */
var MAROON = '#7a1f1f';
var MAROON_H2 = '#8a2b2b';
var GOLD = '#b8860b';
var DARK = '#2b2b2b';
var MUTED = '#8f8f8f';
var GRID = '#c9a0a0';
var TINT = '#faf5f5';
var LABEL_BG = '#f7ecec';
var WHITE = '#ffffff';

/* ================= display names (KundaliEngine.D + local fallback) ================= */
var GU_RASHI = {'Mesh':'મેષ','Vrushabh':'વૃષભ','Mithun':'મિથુન','Kark':'કર્ક','Sinh':'સિંહ','Kanya':'કન્યા','Tula':'તુલા','Vrshchik':'વૃશ્ચિક','Dhanu':'ધનુ','Makar':'મકર','Kumbh':'કુંભ','Meen':'મીન'};
var GU_GRAHA = {'Surya':'સૂર્ય','Chandra':'ચંદ્ર','Mangal':'મંગળ','Budh':'બુધ','Guru':'ગુરુ','Shukra':'શુક્ર','Shani':'શનિ','Rahu':'રાહુ','Ketu':'કેતુ'};
var GU_NAK = {'Ashwini':'અશ્વિની','Bharani':'ભરણી','Krittika':'કૃત્તિકા','Krutika':'કૃત્તિકા','Rohini':'રોહિણી','Mrigashira':'મૃગશીર્ષ','Mrugashirsha':'મૃગશીર્ષ','Ardra':'આર્દ્રા','Punarvasu':'પુનર્વસુ','Pushya':'પુષ્ય','Ashlesha':'આશ્લેષા','Magha':'મઘા','P.Phalguni':'પૂર્વ ફાલ્ગુની','U.Phalguni':'ઉત્તર ફાલ્ગુની','Hasta':'હસ્ત','Chitra':'ચિત્રા','Swati':'સ્વાતિ','Vishakha':'વિશાખા','Anuradha':'અનુરાધા','Jyeshtha':'જ્યેષ્ઠા','Mula':'મૂળ','Mool':'મૂળ','P.Ashadha':'પૂર્વાષાઢા','U.Ashadha':'ઉત્તરાષાઢા','Shravana':'શ્રવણ','Shravan':'શ્રવણ','Dhanishtha':'ધનિષ્ઠા','Shatabhisha':'શતભિષા','Shatataraka':'શતતારકા','P.Bhadrapada':'પૂર્વભાદ્રપદ','U.Bhadrapada':'ઉત્તરભાદ્રપદ','Revati':'રેવતી'};
var GU_VARA = {'Ravivar':'રવિવાર','Somvar':'સોમવાર','Mangalvar':'મંગળવાર','Budhvar':'બુધવાર','Guruvar':'ગુરુવાર','Shukravar':'શુક્રવાર','Shanivar':'શનિવાર'};
var GU_TITHI = {'Pratipada':'પ્રતિપદા','Dwitiya':'દ્વિતીયા','Tritiya':'તૃતીયા','Chaturthi':'ચતુર્થી','Panchami':'પંચમી','Shashthi':'ષષ્ઠી','Saptami':'સપ્તમી','Ashtami':'અષ્ટમી','Navami':'નવમી','Dashami':'દશમી','Ekadashi':'એકાદશી','Dwadashi':'દ્વાદશી','Trayodashi':'ત્રયોદશી','Chaturdashi':'ચતુર્દશી','Purnima':'પૂર્ણિમા','Amavasya':'અમાવસ્યા'};
var GU_PAKSHA = {'Shukla':'શુક્લ','Krishna':'કૃષ્ણ'};
var GU_YOGA = {'Budha-Aditya':'બુધ-આદિત્ય','Gajakesari':'ગજકેસરી','Kemadruma':'કેમદ્રુમ','Chandra-Mangal':'ચંદ્ર-મંગળ','Guru-Mangal':'ગુરુ-મંગળ','Dhana':'ધન','Rajayoga':'રાજયોગ','Neechbhanga':'નીચભંગ','Vipareeta':'વિપરીત','Shasha':'શશ','Ruchaka':'રુચક','Hansa':'હંસ'};
var GRAHA_SHORT_FB = {'Surya':'સૂ','Chandra':'ચં','Mangal':'મં','Budh':'બુ','Guru':'ગુ','Shukra':'શુ','Shani':'શ','Rahu':'રા','Ketu':'કે'};

function ENG() { return root.KundaliEngine || null; }
function D(x) {
  var e = ENG();
  if (e && typeof e.D === 'function') { try { return e.D(x); } catch (_) {} }
  return GU_GRAHA[x] || GU_RASHI[x] || GU_NAK[x] || GU_VARA[x] ||
         GU_TITHI[x] || GU_PAKSHA[x] || GU_YOGA[x] || x;
}
function GSHORT(g) {
  var e = ENG();
  if (e && e.GRAHA_SHORT && e.GRAHA_SHORT[g]) return e.GRAHA_SHORT[g];
  return GRAHA_SHORT_FB[g] || g;
}

/* ================= mixed-script text engine =================
 * Gu/GuB for Gujarati runs (U+0A80–U+0AFF + joiners), built-in
 * Helvetica/Helvetica-Bold for everything else (Latin, symbols).
 * Mirrors build_report.py gu(). Chars missing from BOTH fonts
 * (U+2713 U+2610) are sanitized; the up-arrow is drawn as vector art. */
function isGuCh(ch) {
  var c = ch.charCodeAt(0);
  return (c >= 0x0A80 && c <= 0x0AFF) || c === 0x200C || c === 0x200D;
}
function sanitize(s) {
  return String(s == null ? '' : s)
    .replace(/✓/g, '[x]').replace(/☐/g, '[ ]')
    .replace(/[\u200B\u00AD]/g, '');
}
function runsOf(word) {
  var out = [], cur = '', curGu = null, i, ch, g;
  for (i = 0; i < word.length; i++) {
    ch = word[i]; g = isGuCh(ch);
    if (curGu === null) { curGu = g; cur = ch; }
    else if (g === curGu) { cur += ch; }
    else { out.push({ t: cur, gu: curGu }); cur = ch; curGu = g; }
  }
  if (cur) out.push({ t: cur, gu: curGu });
  return out;
}
function setRunFont(doc, size, bold, gu) {
  doc.fontSize(size);
  doc.font(gu ? (bold ? 'GuB' : 'Gu') : (bold ? 'Helvetica-Bold' : 'Helvetica'));
}
function runWidth(doc, t, size, bold, gu) {
  setRunFont(doc, size, bold, gu);
  return doc.widthOfString(t);
}
function wordInfo(doc, word, size, bold) {
  var runs = runsOf(word), w = 0, i;
  for (i = 0; i < runs.length; i++) w += runWidth(doc, runs[i].t, size, bold, runs[i].gu);
  return { t: word, runs: runs, w: w };
}
/* Hard-break one over-wide word into char chunks. */
function breakWord(doc, word, maxW, size, bold) {
  var parts = [], cur = '', i, info;
  for (i = 0; i < word.length; i++) {
    info = wordInfo(doc, cur + word[i], size, bold);
    if (info.w > maxW && cur) { parts.push(wordInfo(doc, cur, size, bold)); cur = word[i]; }
    else { cur += word[i]; }
  }
  if (cur) parts.push(wordInfo(doc, cur, size, bold));
  return parts;
}
/* Greedy line layout. Returns {lines:[{words,w,paraEnd}], spaceW}. */
function layoutPara(doc, text, maxW, size, bold) {
  var spaceW = runWidth(doc, ' ', size, false, false);
  var lines = [];
  var paras = sanitize(text).split('\n');
  var pi, words, wi, cur, curW, info, add, parts, bi;
  function flush() {
    if (cur.length) { lines.push({ words: cur, w: curW, paraEnd: false }); cur = []; curW = 0; }
  }
  for (pi = 0; pi < paras.length; pi++) {
    words = paras[pi].split(/\s+/).filter(function (w) { return w.length > 0; });
    if (!words.length) { lines.push({ words: [], w: 0, paraEnd: true }); continue; }
    cur = []; curW = 0;
    for (wi = 0; wi < words.length; wi++) {
      info = wordInfo(doc, words[wi], size, bold);
      if (info.w > maxW && cur.length === 0) {
        parts = breakWord(doc, words[wi], maxW, size, bold);
        for (bi = 0; bi < parts.length; bi++) { flush(); cur = [parts[bi]]; curW = parts[bi].w; flush(); }
        continue;
      }
      add = cur.length ? spaceW + info.w : info.w;
      if (curW + add > maxW + 0.01) flush();
      cur.push(info);
      curW += (cur.length > 1 ? spaceW : 0) + info.w;
    }
    flush();
    lines[lines.length - 1].paraEnd = true;
  }
  return { lines: lines, spaceW: spaceW };
}
/* Draw pre-laid-out lines; returns end y. */
function drawLines(doc, layout, x, y, maxW, o) {
  var yy = y, li, L, gaps, extra, gapW, xx, wi, info, ri, r;
  doc.fillColor(o.color || DARK);
  for (li = 0; li < layout.lines.length; li++) {
    L = layout.lines[li];
    gaps = L.words.length - 1;
    extra = maxW - L.w;
    gapW = layout.spaceW;
    if (o.align === 'justify' && gaps > 0 && !L.paraEnd && extra > 0) gapW = layout.spaceW + extra / gaps;
    xx = x;
    if (o.align === 'center') xx = x + Math.max(0, extra) / 2;
    else if (o.align === 'right') xx = x + Math.max(0, extra);
    for (wi = 0; wi < L.words.length; wi++) {
      info = L.words[wi];
      for (ri = 0; ri < info.runs.length; ri++) {
        r = info.runs[ri];
        setRunFont(doc, o.size, o.bold, r.gu);
        doc.text(r.t, xx, yy, { lineBreak: false });
        xx += runWidth(doc, r.t, o.size, o.bold, r.gu);
      }
      xx += gapW;
    }
    yy += o.leading;
  }
  return yy;
}
/* Single centered line (chart labels, rashi numbers, bullet markers). */
function centerLine(doc, text, cx, yTop, maxW, size, bold, color) {
  var layout = layoutPara(doc, text, maxW, size, bold);
  if (!layout.lines.length) return;
  drawLines(doc, { lines: [layout.lines[0]], spaceW: layout.spaceW },
            cx - maxW / 2, yTop, maxW, { size: size, bold: bold, color: color, align: 'center', leading: size * 1.3 });
}

/* ================= book object ================= */
function b64ToBytes(b64) {
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') return Buffer.from(b64, 'base64');
  var bin = atob(b64), u8 = new Uint8Array(bin.length), i;
  for (i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function registerFonts(doc) {
  var F = root.KundaliFonts || {};
  var reg = F.regular || F.Regular || F.gu || F.NotoSansGujarati_Regular;
  var bold = F.bold || F.Bold || F.guBold || F.NotoSansGujarati_Bold;
  if (!reg) throw new Error('PK: KundaliFonts.regular missing — load fonts.js before pdfkit-core.js');
  doc.registerFont('Gu', b64ToBytes(reg));
  doc.registerFont('GuB', b64ToBytes(bold || reg)); // bold falls back to regular if absent
}

function newBook(title) {
  var PDFKit = root.PDFKit;
  if (!PDFKit) throw new Error('PK: PDFKit global missing — load pdfkit-bundle.js before pdfkit-core.js');
  var doc = new PDFKit({ size: 'A4', margin: MARGIN, bufferPages: true });
  registerFonts(doc);
  var book = {
    doc: doc,
    title: title || '',
    pageNum: 0,        // 0-based index of current page; cover (ctor page) is 0
    entries: [],       // {title, page, dict} recorded by section()
    indexDicts: [],    // page dictionaries of reserved index pages ([0] = up-arrow target)
    y: TOP,            // text cursor, from top
    noFooter: {},      // pageNum -> true : cover + index pages
    _footerOn: -1      // pageNum the footer was last drawn on (idempotency)
  };
  // NOTE: the constructor's first page does NOT fire 'pageAdded' (verified),
  // so attaching here keeps the cover at pageNum 0.
  doc.on('pageAdded', function () { book.pageNum++; book.y = TOP; });
  try { doc.info.Title = title || ''; } catch (_) {}
  return book;
}

/* ================= flow primitives ================= */
function ensure(book, h) {
  if (book.y + h > BOTTOM) pageBreak(book);
}
/* Paragraph block with manual page-break safety (line-by-line). */
function drawPara(book, text, o) {
  o = o || {};
  var doc = book.doc;
  var size = o.size || 12, bold = !!o.bold;
  var leading = o.leading || +(size * 1.55).toFixed(2);
  var maxW = o.width || CW, x = (o.x != null ? o.x : MARGIN);
  var layout = layoutPara(doc, text, maxW, size, bold);
  var drawO = { size: size, bold: bold, color: o.color || DARK, align: o.align || 'left', leading: leading };
  var sb = o.spaceBefore || 0, sa = o.spaceAfter || 0;
  if (book.y > TOP && book.y + sb + leading > BOTTOM) pageBreak(book);
  book.y += sb;
  var li, L;
  for (li = 0; li < layout.lines.length; li++) {
    if (book.y + leading > BOTTOM + 0.01) pageBreak(book);
    L = layout.lines[li];
    drawLines(doc, { lines: [L], spaceW: layout.spaceW }, x, book.y, maxW, drawO);
    book.y += leading;
  }
  book.y += sa;
}

function h1(book, t) {
  drawPara(book, t, { size: 17, bold: true, color: MAROON, spaceBefore: 14, spaceAfter: 10 });
  var doc = book.doc, ry = book.y - 6;
  doc.strokeColor(GOLD).lineWidth(1.4);
  doc.moveTo(MARGIN, ry).lineTo(MARGIN + 110, ry).stroke();
}
function h2(book, t) {
  drawPara(book, t, { size: 13.5, bold: true, color: MAROON_H2, spaceBefore: 10, spaceAfter: 6 });
}
function body(book, t) {
  drawPara(book, t, { size: 12, bold: false, color: DARK, align: 'justify', spaceAfter: 10 });
}
function bullets(book, arr) {
  var doc = book.doc, size = 12, leading = +(size * 1.55).toFixed(2);
  (arr || []).forEach(function (it) {
    var layout = layoutPara(doc, it, CW - 18, size, false);
    var h = layout.lines.length * leading + 4;
    ensure(book, h);
    centerLine(doc, '–', MARGIN + 6, book.y, 12, size, false, DARK); // en-dash marker
    drawLines(doc, layout, MARGIN + 18, book.y, CW - 18,
              { size: size, bold: false, color: DARK, align: 'left', leading: leading });
    book.y += h;
  });
}
function spacer(book, h) {
  h = h || 12;
  if (book.y + h > BOTTOM) pageBreak(book); else book.y += h;
}
function pageBreak(book) {
  footer(book);
  book.doc.addPage(); // 'pageAdded' handler bumps pageNum + resets y
}
/* ================= cover (page 0, no footer) ================= */
function cover(book, o) {
  o = o || {};
  var doc = book.doc;
  book.noFooter[book.pageNum] = true;
  doc.strokeColor(MAROON).lineWidth(3).rect(24, 24, PW - 48, PH - 48).stroke();
  doc.strokeColor(GOLD).lineWidth(1).rect(32, 32, PW - 64, PH - 64).stroke();
  book.y = 150;
  drawPara(book, 'શ્રી ગણેશાય નમઃ', { size: 15, bold: true, color: GOLD, align: 'center', spaceAfter: 10 });
  drawPara(book, o.title || book.title || '', { size: 26, bold: true, color: MAROON, align: 'center',
            x: MARGIN + 30, width: CW - 60, leading: 38, spaceAfter: 6 });
  var dy = book.y + 8, cx = PW / 2;
  doc.strokeColor(GOLD).lineWidth(1.2);
  doc.moveTo(MARGIN + 60, dy).lineTo(cx - 18, dy).stroke();
  doc.moveTo(cx + 18, dy).lineTo(PW - MARGIN - 60, dy).stroke();
  doc.moveTo(cx, dy - 7).lineTo(cx + 7, dy).lineTo(cx, dy + 7).lineTo(cx - 7, dy).closePath().stroke();
  book.y = dy + 24;
  if (o.subtitle) drawPara(book, o.subtitle, { size: 14, color: DARK, align: 'center', spaceAfter: 18 });
  if (o.name) drawPara(book, o.name, { size: 20, bold: true, color: MAROON, align: 'center', spaceAfter: 10 });
  (o.lines || []).forEach(function (ln) {
    drawPara(book, ln, { size: 12, color: DARK, align: 'center', spaceAfter: 8 });
  });
  if (book.y < PH - 170) {
    var fy = PH - 130;
    doc.strokeColor(GOLD).lineWidth(1).moveTo(cx - 60, fy).lineTo(cx + 60, fy).stroke();
    book.y = fy + 8;
    drawPara(book, 'શુભમ્ ભૂયાત્', { size: 12, color: GOLD, align: 'center' });
  }
}

/* ================= index reservation =================
 * Adds K = ceil(nEntries/12) blank index pages (no footer on them), captures
 * their page dictionaries (indexDicts[0], the first reserved page, is the
 * footer's up-arrow target), adds the 'અનુક્રમણિકા' outline entry up-front so
 * it sorts before the sections, then advances to a fresh content page so the
 * builder can draw sections immediately. Returns K. */
function reserveIndex(book, nEntries) {
  var doc = book.doc;
  var K = Math.max(1, Math.ceil(nEntries / 12));
  var firstIndexPage = book.pageNum + 1, i;
  for (i = 0; i < K; i++) {
    doc.addPage();
    book.indexDicts.push(doc.page.dictionary); // page 1's dict is the up-arrow target
    book.noFooter[book.pageNum] = true;        // no footer on index pages
  }
  doc.outline.addItem('અનુક્રમણિકા', { pageNumber: firstIndexPage });
  doc.addPage(); // fresh content page (footer skipped: still on an index page)
  return K;
}

/* ================= section ================= */
function sectionStart(book, guTitle) {
  // Record the START page/dict so index + outline jump to the section's
  // first page. Split out of section() for imperative builders.
  var startPage = book.pageNum;
  var startDict = book.doc.page.dictionary;
  var e = { title: guTitle, page: startPage, dict: startDict };
  book.entries.push(e);
  book.doc.outline.addItem(guTitle, { pageNumber: startPage });
  return e;
}
function section(book, guTitle, fn) {
  var e = sectionStart(book, guTitle);
  fn();
  return e;
}

/* ================= table =================
 * rows: [[cell, ...], ...] (strings; numbers coerced). Vector rects:
 * maroon header + white bold text, thin grid, alternating row tint,
 * wrapped cells via layoutPara. Header repeats after page breaks.
 * opts: {header=true, fontSize=10.5, labelCol=false, align='left',
 *        x=MARGIN, padX=6, padY=4, spaceAfter=8} */
function table(book, rows, colWidths, opts) {
  opts = opts || {};
  var doc = book.doc;
  var fs = opts.fontSize || 10.5;
  var leading = +(fs * 1.5).toFixed(2);
  var padX = (opts.padX != null ? opts.padX : 6);
  var padY = (opts.padY != null ? opts.padY : 4);
  var hasHeader = opts.header !== false;
  var x0 = (opts.x != null ? opts.x : MARGIN);
  var widths = colWidths.slice();
  var sum = widths.reduce(function (a, b) { return a + b; }, 0);
  var ci;
  if (sum <= 1.01) { // fractions of content width (e.g. [0.3, 0.7])
    for (ci = 0; ci < widths.length; ci++) widths[ci] *= CW;
    sum = CW;
  }
  if (sum > CW) { var k = CW / sum; for (ci = 0; ci < widths.length; ci++) widths[ci] *= k; sum = CW; }
  var nCols = widths.length;
  var startRow = hasHeader ? 1 : 0;

  // pre-layout every cell -> row heights
  var grid = rows.map(function (row) {
    var cells = [], c2;
    for (c2 = 0; c2 < nCols; c2++) {
      cells.push(layoutPara(doc, (row[c2] == null ? '' : String(row[c2])), widths[c2] - 2 * padX, fs, false));
    }
    return cells;
  });
  var rowHs = grid.map(function (cells) {
    var mx = 0, i;
    for (i = 0; i < cells.length; i++) mx = Math.max(mx, cells[i].lines.length);
    return mx * leading + 2 * padY;
  });

  function drawRow(ri, yy, isHeader) {
    var xx = x0, c3, w, bg, bold, color;
    var dataIdx = ri - startRow;
    for (c3 = 0; c3 < nCols; c3++) {
      w = widths[c3];
      if (isHeader) bg = MAROON;
      else if (opts.labelCol && c3 === 0) bg = LABEL_BG;
      else bg = (dataIdx % 2 ? TINT : WHITE);
      doc.rect(xx, yy, w, rowHs[ri]).fillColor(bg).fill();
      bold = isHeader || (opts.labelCol && c3 === 0);
      color = isHeader ? WHITE : DARK;
      drawLines(doc, grid[ri][c3], xx + padX, yy + padY, w - 2 * padX,
                { size: fs, bold: bold, color: color, align: opts.align || 'left', leading: leading });
      xx += w;
    }
    doc.strokeColor(GRID).lineWidth(0.6);
    doc.rect(x0, yy, sum, rowHs[ri]).stroke();
    var gx = x0, c4;
    for (c4 = 1; c4 < nCols; c4++) {
      gx += widths[c4 - 1];
      doc.moveTo(gx, yy).lineTo(gx, yy + rowHs[ri]).stroke();
    }
  }

  var headerH = hasHeader ? rowHs[0] : 0, ri;
  if (hasHeader) { ensure(book, headerH); drawRow(0, book.y, true); book.y += headerH; }
  for (ri = startRow; ri < rows.length; ri++) {
    if (book.y + rowHs[ri] > BOTTOM) {
      pageBreak(book);
      if (hasHeader) { drawRow(0, book.y, true); book.y += headerH; }
    }
    drawRow(ri, book.y, false);
    book.y += rowHs[ri];
  }
  book.y += (opts.spaceAfter != null ? opts.spaceAfter : 8);
}
/* ================= North-Indian diamond chart =================
 * Geometry ported from kundali-gen/charts.py: 200x200 box, outer square,
 * corner-to-corner diagonals, diamond through edge midpoints, per-house
 * centroids (houses run counter-clockwise from the top diamond).
 * houses: {grahaName: bhav}  (1..12, lagna-relative). */
var CENTROIDS = { 1: [100, 150], 2: [50, 183], 3: [17, 150], 4: [50, 100],
                  5: [17, 50], 6: [50, 17], 7: [100, 50], 8: [150, 17],
                  9: [183, 50], 10: [150, 100], 11: [183, 150], 12: [150, 183] };
function diamondChart(book, lagnaRashiIdx, houses, title) {
  var doc = book.doc;
  var size = Math.min(CW, 340);
  var s = size / 200;
  var titleH = title ? 32 : 8;
  var blockH = titleH + size + 14;
  ensure(book, blockH);
  var bx = MARGIN + (CW - size) / 2; // box left
  var by = book.y + titleH;          // box top (y-down)
  function X(x) { return bx + x * s; }
  function Y(y) { return by + (200 - y) * s; } // charts.py y-up -> PDFKit y-down

  if (title) centerLine(doc, title, bx + size / 2, book.y + 6, size, 14, true, MAROON);

  doc.strokeColor(MAROON).lineWidth(1.6);
  doc.rect(bx, by, size, size).stroke();                                  // outer square
  doc.moveTo(X(0), Y(0)).lineTo(X(200), Y(200)).stroke();                  // diagonals
  doc.moveTo(X(0), Y(200)).lineTo(X(200), Y(0)).stroke();
  doc.moveTo(X(100), Y(200)).lineTo(X(200), Y(100))                        // diamond
     .lineTo(X(100), Y(0)).lineTo(X(0), Y(100)).closePath().stroke();

  var per = {}, g;
  for (g in houses) {
    if (Object.prototype.hasOwnProperty.call(houses, g)) {
      var b = houses[g];
      (per[b] = per[b] || []).push(g);
    }
  }
  var h, c, cx, cy, ri, gs, i;
  for (h = 1; h <= 12; h++) {
    c = CENTROIDS[h]; cx = X(c[0]); cy = Y(c[1]);
    ri = (lagnaRashiIdx + h - 1) % 12;
    centerLine(doc, String(ri + 1), cx, cy - 16 * s - 8, 60, 8, false, GOLD); // rashi number
    gs = per[h] || [];
    for (i = 0; i < gs.length; i++) {
      centerLine(doc, GSHORT(gs[i]), cx, cy - 2 * s + i * 13 * s, 60, 11, false, MAROON);
    }
  }
  book.y = by + size + 14;
}

/* ================= footer (content pages only) ================= */
function footer(book) {
  if (book.noFooter[book.pageNum]) return;
  if (book._footerOn === book.pageNum) return; // idempotent
  if (book.y <= TOP + 1) return;               // nothing drawn yet — skip
  book._footerOn = book.pageNum;
  var doc = book.doc;
  var fy = PH - 30;
  doc.strokeColor(GOLD).lineWidth(0.8).opacity(0.5);
  doc.moveTo(MARGIN, fy - 12).lineTo(PW - MARGIN, fy - 12).stroke();
  doc.opacity(1);
  // page number, right (1-based for humans)
  var num = String(book.pageNum + 1);
  var layout = layoutPara(doc, num, 60, 10, false);
  drawLines(doc, { lines: layout.lines, spaceW: layout.spaceW }, PW - MARGIN - 60, fy - 9, 60,
            { size: 10, bold: false, color: MUTED, align: 'right', leading: 12 });
  // vector up-arrow, bottom-left — annotated as GoTo link to the index page
  if (book.indexDicts.length) {
    var ax = MARGIN + 8, ay = fy - 2;
    doc.strokeColor(MUTED).lineWidth(1.4);
    doc.moveTo(ax, ay + 8).lineTo(ax, ay - 6).stroke();                    // shaft
    doc.moveTo(ax - 4, ay - 2).lineTo(ax, ay - 6).lineTo(ax + 4, ay - 2).stroke(); // head
    doc.annotate(ax - 9, ay - 13, 24, 26, { Subtype: 'Link', Dest: [book.indexDicts[0], 'Fit'] });
  }
}

/* ================= fillIndex ================= */
function drawIndexEntry(book, e, y) {
  var doc = book.doc, size = 12;
  var num = String(e.page + 1); // 1-based display
  var titleW = wordInfo(doc, e.title, size, false).w;
  var numW = wordInfo(doc, num, size, false).w;
  var x0 = MARGIN, x1 = PW - MARGIN;
  var dotW = wordInfo(doc, '.', size, false).w + 2;
  var gap = (x1 - numW) - (x0 + titleW) - 16;
  var nDots = Math.max(2, Math.floor(gap / dotW));
  var dots = new Array(nDots + 1).join('.');
  var layout = layoutPara(doc, e.title, x0 + titleW + 8, size, false);
  drawLines(doc, { lines: [layout.lines[0]], spaceW: layout.spaceW }, x0, y, x0 + titleW + 8,
            { size: size, bold: false, color: DARK, align: 'left', leading: size * 1.3 });
  var dw = wordInfo(doc, dots, size, false).w;
  var dlay = layoutPara(doc, dots, dw + 2, size, false);
  drawLines(doc, { lines: [dlay.lines[0]], spaceW: dlay.spaceW }, x0 + titleW + 8 + (gap - dw) / 2, y, dw + 2,
            { size: size, bold: false, color: MUTED, align: 'left', leading: size * 1.3 });
  var nlay = layoutPara(doc, num, numW + 2, size, false);
  drawLines(doc, { lines: [nlay.lines[0]], spaceW: nlay.spaceW }, x1 - numW, y, numW + 2,
            { size: size, bold: false, color: DARK, align: 'right', leading: size * 1.3 });
  doc.annotate(x0, y - 4, x1 - x0, 22, { Subtype: 'Link', Dest: [e.dict, 'Fit'] });
}

function fillIndex(book) {
  var doc = book.doc;
  if (!book.indexDicts.length) return 0;
  var K = book.indexDicts.length, PER = 12;
  var savedPage = book.pageNum, savedY = book.y;
  var p, i, ei, y;
  for (p = 0; p < K; p++) {
    doc.switchToPage(p + 1); // reserved pages are buffer indices 1..K
    book.pageNum = p + 1;    // switchToPage does not fire 'pageAdded'
    y = TOP;
    if (p === 0) {
      book.y = y;
      h1(book, 'અનુક્રમણિકા');
      y = book.y + 6;
    }
    for (i = 0; i < PER; i++) {
      ei = p * PER + i;
      if (ei >= book.entries.length) break;
      drawIndexEntry(book, book.entries[ei], y);
      y += 26;
    }
  }
  doc.switchToPage(savedPage);
  book.pageNum = savedPage;
  book.y = savedY;
  return book.entries.length;
}

/* ================= finish ================= */
function finish(book, onProgress) {
  return new Promise(function (resolve, reject) {
    try {
      footer(book); // footer on the final content page
      var doc = book.doc, chunks = [];
      doc.on('data', function (c) { chunks.push(c); });
      doc.on('end', function () {
        var total = 0, i, off = 0;
        for (i = 0; i < chunks.length; i++) total += chunks[i].length;
        var out = new Uint8Array(total);
        for (i = 0; i < chunks.length; i++) { out.set(chunks[i], off); off += chunks[i].length; }
        if (typeof onProgress === 'function') { try { onProgress(1); } catch (_) {} }
        resolve(out);
      });
      doc.on('error', reject);
      doc.end();
    } catch (err) { reject(err); }
  });
}

/* ================= public API ================= */
root.PK = {
  version: '1.0.0',
  newBook: newBook,
  cover: cover,
  reserveIndex: reserveIndex,
  section: section,
  sectionStart: sectionStart,
  h1: h1,
  h2: h2,
  body: body,
  bullets: bullets,
  spacer: spacer,
  pageBreak: pageBreak,
  table: table,
  diamondChart: diamondChart,
  footer: footer,
  fillIndex: fillIndex,
  finish: finish,
  ensure: ensure,
  sanitize: sanitize,
  D: D,          // Roman astro term -> Gujarati display name (zero Roman terms in output)
  GSHORT: GSHORT, // graha -> Gujarati short form for charts
  COLORS: { MAROON: MAROON, GOLD: GOLD, DARK: DARK, MUTED: MUTED, GRID: GRID, TINT: TINT },
  PAGE: { W: PW, H: PH, MARGIN: MARGIN, CW: CW, TOP: TOP, BOTTOM: BOTTOM }
};

})();
