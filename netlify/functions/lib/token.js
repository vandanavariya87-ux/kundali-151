// lib/token.js — HMAC-SHA256 token helpers (Hindi Kundali ₹151 funnel).
// Token format:  base64url(payload_json) . hex_hmac_sha256(body, TOKEN_SECRET)
// Payload: { oid, pid, amt, nm, ph, dob, tm, pl, la, lo, nonce, exp }
// Verification is PURE crypto: timing-safe HMAC compare + expiry + pid check.
// NO server storage. Tokens expire after 24h.
'use strict';
const crypto = require('crypto');

const TOKEN_EXPIRY_SEC = 24 * 60 * 60;

function hmacSecret() {
  return process.env.TOKEN_SECRET || '';
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
  const a = Buffer.from(expected, 'utf8'), b = Buffer.from(sig, 'utf8');
  if (!crypto.timingSafeEqual(a, b)) return null;
  let p;
  try {
    p = JSON.parse(b64urlDec(body).toString('utf8'));
  } catch (e) { return null; }
  if (!p || !p.exp || Date.now() > p.exp * 1000) return null;
  if (!p.pid) return null;
  return p;
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

const PRICE_PAISE = 15100;   // ₹151 — server-side FIXED. (₹999 wale me 99000/99900 ka bug tha — yahan exact 15100)

module.exports = {
  TOKEN_EXPIRY_SEC, PRICE_PAISE,
  signToken, verifyToken,
  rzpayRequest, jsonOut, configured, hmacSecret,
};
