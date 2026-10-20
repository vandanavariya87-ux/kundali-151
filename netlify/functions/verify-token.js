// POST /.netlify/functions/verify-token   { token }
// Token ki shuddhata crypto se jaanchta hai (HMAC + expiry). Koi server storage nahi.
// Valid hone par payload wapas bhejta hai:
//  - payment token → {name, phone} (dob/time/place khaali)
//  - generation token → {name, phone, dob, time, place, lat, lon}
'use strict';
const { verifyToken, jsonOut } = require('./lib/token');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonOut(405, { error: 'Method not allowed' });

  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) { /* khaali */ }
  const p = await verifyToken(input.token || '');
  if (!p) return jsonOut(401, { valid: false });

  return jsonOut(200, {
    valid: true,
    payload: {
      name: p.nm, phone: p.ph, dob: p.dob, time: p.tm,
      place: p.pl, lat: p.la, lon: p.lo,
    },
  });
};
