// lib/token.js — HMAC-SHA256 token helpers (shared by all functions).
// Token format:  base64url(payload_json) . hex_hmac_sha256(body, TOKEN_SECRET)
// Payload: { oid, pid, amt, nm, ph, dob, tm, pl, la, lo, nonce, exp }
// Verification is PURE crypto: timing-safe HMAC compare + expiry + pid check.
// NO server storage (Netlify Blobs removed — V1 functions never got its context).
// Trade-off: tokens are not strictly single-use; they expire after 24h.
'use strict';
const crypto = require('crypto');

const TOKEN_EXPIRY_SEC = 24 * 60 * 60;

function hmacSecret() {
  const s = process.env.TOKEN_SECRET || '';
  return s;
}

function b64urlEnc(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function b64urlDec(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function signToken(payload) {
  const body = b64urlEnc(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', hmacSecret()).update(body).digest('hex');
  return body + '.' + sig;
}

function verifyToken(t) {
  if (!t || !hmacSecret()) return null;
  const parts = String(t).split('.');
  if (parts.length !== 2) return null;
  const body = parts[0], sig = parts[1];
  let expected;
  try {
    expected = crypto.createHmac('sha256', hmacSecret()).update(body).digest('hex');
  } catch (e) { return null; }
  if (expected.length !== sig.length) return null;
  // timing-safe compare (constant-time, throws on length mismatch — handled above)
  const a = Buffer.from(expected, 'utf8'), b = Buffer.from(sig, 'utf8');
  if (!crypto.timingSafeEqual(a, b)) return null;   // forged / tampered
  let p;
  try {
    p = JSON.parse(b64urlDec(body).toString('utf8'));
  } catch (e) { return null; }
  if (!p || !p.exp || Date.now() > p.exp * 1000) return null;  // expired
  if (!p.pid) return null;
  return p;
}

// ---- birth-details extractor + sakhti se validation (PHP k51_extract_birth ka port) ----
function extractBirth(notes) {
  if (!notes || typeof notes !== 'object') return null;
  const name = String(notes.name || '').trim().slice(0, 60);
  const phone = String(notes.phone || '').trim();
  const dob = String(notes.dob || '').trim();
  const time = String(notes.time || '').trim();
  const place = String(notes.place || '').trim().slice(0, 80);
  const lat = notes.lat, lon = notes.lon;

  if (name.length < 2) return null;
  if (!/^[6-9]\d{9}$/.test(phone)) return null;
  let dobOk = false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y >= 1900 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const dt = new Date(Date.UTC(y, mo - 1, d));
      if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
          && dt.getTime() <= Date.now()) dobOk = true;
    }
  }
  if (!dobOk) return null;
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) return null;
  if (place.length < 2) return null;
  const la = Number(lat), lo = Number(lon);
  if (!isFinite(la) || !isFinite(lo)) return null;
  if (la < 6 || la > 38 || lo < 66 || lo > 98) return null;  // Bharat ki range
  return { name, phone, dob, time, place, lat: la, lon: lo };
}

// ---- Razorpay API helper (plain https, no SDK) ----
function rzpayRequest(method, path, body) {
  const https = require('https');
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.razorpay.com',
      path: path,
      method: method,
      headers: {
        'Authorization': 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64'),
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(raw); } catch (e) { /* non-JSON */ }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('Razorpay timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

function jsonOut(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(data),
  };
}

function configured() {
  const id = process.env.RAZORPAY_KEY_ID || '';
  const sec = process.env.RAZORPAY_KEY_SECRET || '';
  return id !== '' && sec !== '' && hmacSecret() !== '';
}

const PRICE_PAISE = 5100;   // ₹51 — server-side FIXED

module.exports = {
  TOKEN_EXPIRY_SEC, PRICE_PAISE,
  signToken, verifyToken,
  extractBirth, rzpayRequest, jsonOut, configured, hmacSecret,
};
