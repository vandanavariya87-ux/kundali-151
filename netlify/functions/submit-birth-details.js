// POST /.netlify/functions/submit-birth-details   { payToken, dob, time, place, lat, lon }
// Payment-proof token (verify-payment se) + janm vigat → generation token.
// Pure crypto: payToken ka HMAC + expiry check hota hai. Koi server storage nahi —
// dobara submit karne par bas ek naya valid genToken ban jata hai (nuksaan-rahit).
'use strict';
const crypto = require('crypto');
const { verifyToken, signToken, extractBirth, jsonOut, configured,
        TOKEN_EXPIRY_SEC } = require('./lib/token');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonOut(405, { error: 'Method not allowed' });
  if (!configured()) return jsonOut(500, { error: 'Payment not configured on server' });

  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) { return jsonOut(400, { error: 'Invalid JSON' }); }

  // 1) Payment-proof token verify karo (HMAC + expiry)
  const p = verifyToken(input.payToken || '');
  if (!p || !p.pid) return jsonOut(401, { error: 'Link amanya chhe — payment pachhi malelee link vaparo' });

  // 2) Janm vigat validate karo (naam/phone payment token se)
  const bd = extractBirth({
    name: p.nm, phone: p.ph,
    dob: input.dob, time: input.time, place: input.place,
    lat: input.lat, lon: input.lon,
  });
  if (!bd) {
    return jsonOut(400, { error: 'Janm vigat sahi lakho (tarikh, samay, sthal)' });
  }

  // 3) Generation token — janm vigat signed payload me (generate.html isi se PDF banata hai)
  const genToken = signToken({
    oid: p.oid,
    pid: p.pid,
    amt: p.amt,
    nm: bd.name,
    ph: bd.phone,
    dob: bd.dob,
    tm: bd.time,
    pl: bd.place,
    la: bd.lat,
    lo: bd.lon,
    nonce: crypto.randomBytes(8).toString('hex'),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SEC,
  });

  return jsonOut(200, { token: genToken });
};
