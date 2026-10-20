// POST /.netlify/functions/verify-payment   { orderId, paymentId, signature }
// 1) Razorpay signature verify  2) Razorpay se captured confirm  3) amount == 5100
// → payment-PROOF token (24h expiry). Birth details ab isme NAHI hain —
// wo generate.html ke form se aati hain (submit-birth-details → generation token).
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

  // 3) Amount server-side fixed se match hona chahiye (5100 paise)
  if (Number(p.amount) !== PRICE_PAISE) return jsonOut(400, { error: 'Amount mismatch' });

  // 4) Naam/phone: Razorpay order notes se (create-order ne daale the)
  let nm = '', ph = '';
  try {
      const ro = await rzpayRequest('GET', '/v1/orders/' + encodeURIComponent(orderId));
      if (ro.status >= 200 && ro.status < 300 && ro.json.notes && typeof ro.json.notes === 'object') {
        nm = String(ro.json.notes.name || '').slice(0, 60);
        ph = String(ro.json.notes.phone || '');
      }
    } catch (e) { /* khaali rahenge */ }

  // 5) Payment-proof token — birth details NAHI, sirf payment ka saboot
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
