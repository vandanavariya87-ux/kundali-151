// POST /.netlify/functions/verify-payment
// Body: { order_id, payment_id, signature, name, whatsapp, email }
// (orderId / paymentId / phone spellings are accepted as aliases.)
// Checks, in order:
//   1) Razorpay signature (HMAC-SHA256 with RAZORPAY_KEY_SECRET)
//   2) Payment is captured on Razorpay and belongs to this order
//   3) Captured amount equals the server-side fixed 50100 paise
// On success only: an HMAC token (TOKEN_SECRET, 24h expiry) encoding the
// product id, order id and customer name / WhatsApp / email.
// On any failure: a clear error, never a token.
'use strict';
const crypto = require('crypto');
const { rzpayRequest, jsonOut, configured, signToken, PRICE_PAISE,
  PRODUCT_ID, TOKEN_EXPIRY_SEC, normaliseWhatsapp, validEmail } = require('./lib/token');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonOut(405, { error: 'Method not allowed' });
  if (!configured()) return jsonOut(500, { error: 'Payment not configured on server' });

  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) { return jsonOut(400, { error: 'Invalid JSON' }); }
  const orderId = String(input.order_id || input.orderId || '');
  const paymentId = String(input.payment_id || input.paymentId || '');
  const signature = String(input.signature || '');
  const inName = String(input.name || '').trim().slice(0, 60);
  const inWhatsapp = normaliseWhatsapp(input.whatsapp || input.phone || '');
  const inEmail = validEmail(input.email || '');
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

  // 3) Amount server-side fixed se match (50100 paise = Rs 501)
  if (Number(p.amount) !== PRICE_PAISE) return jsonOut(400, { error: 'Amount mismatch' });

  // 4) Naam / WhatsApp / email: pehle frontend input se, fallback order notes se
  let nm = inName, wa = inWhatsapp, em = inEmail;
  if (!nm || !wa) {
    try {
      const ro = await rzpayRequest('GET', '/v1/orders/' + encodeURIComponent(orderId));
      if (ro.status >= 200 && ro.status < 300 && ro.json.notes && typeof ro.json.notes === 'object') {
        if (!nm) nm = String(ro.json.notes.name || '').trim().slice(0, 60);
        if (!wa) wa = normaliseWhatsapp(ro.json.notes.whatsapp || ro.json.notes.phone || '');
        if (!em) em = validEmail(ro.json.notes.email || '');
      }
    } catch (e) { /* fallback fail — neeche validate hoga */ }
  }
  if (nm.length < 2 || !wa) {
    return jsonOut(400, { error: 'Naam/WhatsApp missing — dobara order karein' });
  }
  if (em === null) em = '';

  // 5) Token — product id + order id + customer details, 24h expiry
  const token = signToken({
    prod: PRODUCT_ID,
    oid: orderId,
    pid: paymentId,
    amt: p.amount,
    nm: nm,
    wa: wa,
    em: em,
    nonce: crypto.randomBytes(8).toString('hex'),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SEC,
  });
  return jsonOut(200, { token });
};
