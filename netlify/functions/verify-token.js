// POST /.netlify/functions/verify-token   { token }
// Token ki shuddhata crypto se jaanchta hai (HMAC + 24h expiry + product id).
// Koi server storage nahi.
// Valid hone par { valid: true, payload: { name, whatsapp, email, order_id } }
// — taaki generate page par naam pehle se bhara dikhe.
// Invalid / expired / galat product par { valid: false } (401).
'use strict';
const { verifyToken, jsonOut, PRODUCT_ID } = require('./lib/token');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonOut(405, { error: 'Method not allowed' });

  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) { /* khaali */ }
  const p = verifyToken(input.token || '');
  if (!p) return jsonOut(401, { valid: false });
  if (p.prod !== PRODUCT_ID) return jsonOut(401, { valid: false });
  if (!p.nm || !p.wa) return jsonOut(401, { valid: false });

  return jsonOut(200, {
    valid: true,
    payload: {
      name: p.nm,
      whatsapp: p.wa,
      email: p.em || '',
      order_id: p.oid || '',
    },
  });
};
