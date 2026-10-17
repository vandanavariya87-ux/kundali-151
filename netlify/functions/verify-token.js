// POST /.netlify/functions/verify-token   { token }
// Token ki shuddhata crypto se jaanchta hai (HMAC + expiry). Koi server storage nahi.
// Valid hone par naam+phone wapas bhejta hai (birth details generate.html par bhari jayengi).
'use strict';
const { verifyToken, jsonOut } = require('./lib/token');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonOut(405, { error: 'Method not allowed' });

  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) { /* khaali */ }
  const p = await verifyToken(input.token || '');
  if (!p) return jsonOut(401, { valid: false });
  if (!p.nm || !p.ph) return jsonOut(401, { valid: false });

  return jsonOut(200, {
    valid: true,
    payload: { name: p.nm, phone: p.ph },
  });
};
