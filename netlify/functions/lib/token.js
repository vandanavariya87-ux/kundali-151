// lib/token.js — shared helpers for the Premium Personalised Kundali funnel.
// No token system: payment verify hone par page seedha confirmation dikhata hai.
// Sirf 2 env vars chahiye: RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET.
'use strict';

const PRODUCT_ID = 'premium-kundali-499';
const PRICE_PAISE = 50100; // Rs 501 — server-side FIXED, never taken from the client.

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
  return id !== '' && sec !== '';
}

// Normalise an Indian mobile number: strips spaces and a leading +91 / 91.
// Returns the 10-digit number, or null when it is not a valid Indian mobile.
function normaliseWhatsapp(raw) {
  let p = String(raw || '').replace(/[\s-]/g, '');
  if (p.startsWith('+91')) p = p.slice(3);
  else if (p.length === 12 && p.startsWith('91')) p = p.slice(2);
  else if (p.startsWith('0')) p = p.slice(1);
  if (!/^[6-9]\d{9}$/.test(p)) return null;
  return p;
}

function validEmail(raw) {
  const e = String(raw || '').trim().slice(0, 120);
  if (e === '') return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

module.exports = {
  PRODUCT_ID, PRICE_PAISE,
  rzpayRequest, jsonOut, configured,
  normaliseWhatsapp, validEmail,
};
