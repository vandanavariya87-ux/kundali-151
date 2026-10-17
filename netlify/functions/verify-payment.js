// POST /.netlify/functions/verify-payment   { orderId, paymentId, signature }
// 1) Razorpay signature verify  2) captured confirm  3) amount == 15100
// → token (24h expiry) — payload me sirf name+phone. Birth details generate.html par.
'use strict';
const crypto = require('crypto');
const { rzpayRequest, jsonOut, configured, signToken, PRICE_PAISE, TOKEN_EXPIRY_SEC } = require('./lib/token');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonOut(405, { error: 'Method not allowed' });
  if (!configured()) return jsonOut(500, { error: 'Payment not configured on server' });

  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) { return jsonOut(400, { error: 'Invalid JSON' }); }
  const orderId = String(input.orderId || '');
  const paymentId = String(input.paymentId || '');
  const signature = String(input.signature || '');
  // Naam+phone frontend se (form me bhara tha) — sabse reliable
  const inName = String(input.name || '').trim().slice(0, 60);
  const inPhone = String(input.phone || '').trim();
  if (!orderId || !paymentId || !signature) return jsonOut(400, { error: 'Missing fields' });

  // 1) Signature: HMAC_SHA256(orderId|paymentId, key_secret)
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(orderId + '|' + paymentId).digest('hex');
  if (expected.length !== signature.length) return jsonOut(400, { error: 'Signature mismatch' });
  if (!crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'))) {
    return jsonOut(400, { error: 'Signature mismatch' });
  }

  // 2) Razorpay se live confirm: payment captured + isi order ka hai
  let p;
  try {
    const r = await rzpayRequest('GET', '/v1/payments/' + encodeURIComponent(paymentId));
    if (r.status < 200 || r.status >= 300) return jsonOut(400, { error: 'Payment not captured yet' });
    p = r.json;
  } catch (e) {
    return jsonOut(400, { error: 'Payment not captured yet' });
  }
  if ((p.status || '') !== 'captured' || (p.order_id || '') !== orderId) {
    return jsonOut(400, { error: 'Payment not captured yet' });
  }

  // 3) Amount server-side fixed se match (15100 paise = ₹151)
  if (Number(p.amount) !== PRICE_PAISE) return jsonOut(400, { error: 'Amount mismatch' });

  // 4) Naam+phone: pehle frontend input se, fallback order notes se
  let nm = inName, ph = inPhone;
  if (!nm || !/^[6-9]\d{9}$/.test(ph)) {
    try {
      const ro = await rzpayRequest('GET', '/v1/orders/' + encodeURIComponent(orderId));
      if (ro.status >= 200 && ro.status < 300 && ro.json.notes && typeof ro.json.notes === 'object') {
        if (!nm) nm = String(ro.json.notes.name || '').trim().slice(0, 60);
        if (!/^[6-9]\d{9}$/.test(ph)) ph = String(ro.json.notes.phone || '').trim();
      }
    } catch (e) { /* fallback fail — neeche validate hoga */ }
  }
  if (nm.length < 2 || !/^[6-9]\d{9}$/.test(ph)) {
    return jsonOut(400, { error: 'Naam/phone missing — dobara order karein' });
  }

  // 5) Token — sirf naam+phone (birth details generate.html par bharenge)
  const token = signToken({
    oid: orderId,
    pid: paymentId,
    amt: p.amount,
    nm: nm,
    ph: ph,
    nonce: crypto.randomBytes(8).toString('hex'),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SEC,
  });
  return jsonOut(200, { token });
};
