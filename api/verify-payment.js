// POST /api/verify-payment (Vercel)
// Body: { order_id, payment_id, signature, name, whatsapp, email }
// (orderId / paymentId / phone spellings are accepted as aliases.)
// Checks, in order:
//   1) Razorpay signature (HMAC-SHA256 with RAZORPAY_KEY_SECRET)
//   2) Payment is captured on Razorpay and belongs to this order
//   3) Captured amount equals the server-side fixed 50100 paise
// On success only: { ok: true } — page isi se confirmation dikhata hai.
// On any failure: a clear error.
'use strict';
const crypto = require('crypto');
const { rzpayRequest, configured, PRICE_PAISE,
  PRODUCT_ID, normaliseWhatsapp, validEmail } = require('./lib/token');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!configured()) return res.status(500).json({ error: 'Payment not configured on server' });

  let input = req.body;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!input || typeof input !== 'object') input = {};
  const orderId = String(input.order_id || input.orderId || '');
  const paymentId = String(input.payment_id || input.paymentId || '');
  const signature = String(input.signature || '');
  const inName = String(input.name || '').trim().slice(0, 60);
  const inWhatsapp = normaliseWhatsapp(input.whatsapp || input.phone || '');
  const inEmail = validEmail(input.email || '');
  if (!orderId || !paymentId || !signature) return res.status(400).json({ error: 'Missing fields' });

  // 1) Signature: HMAC_SHA256(orderId|paymentId, key_secret)
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(orderId + '|' + paymentId).digest('hex');
  if (expected.length !== signature.length) return res.status(400).json({ error: 'Signature mismatch' });
  if (!crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'))) {
    return res.status(400).json({ error: 'Signature mismatch' });
  }

  // 2) Razorpay se live confirm: payment captured + isi order ka hai
  let p;
  try {
    const r = await rzpayRequest('GET', '/v1/payments/' + encodeURIComponent(paymentId));
    if (r.status < 200 || r.status >= 300) return res.status(400).json({ error: 'Payment not captured yet' });
    p = r.json;
  } catch (e) {
    return res.status(400).json({ error: 'Payment not captured yet' });
  }
  if ((p.status || '') !== 'captured' || (p.order_id || '') !== orderId) {
    return res.status(400).json({ error: 'Payment not captured yet' });
  }

  // 3) Amount server-side fixed se match (50100 paise = Rs 501)
  if (Number(p.amount) !== PRICE_PAISE) return res.status(400).json({ error: 'Amount mismatch' });

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
    return res.status(400).json({ error: 'Naam/WhatsApp missing — dobara order karein' });
  }
  if (em === null) em = '';

  // 5) Verified — koi token nahi; page ok dekh kar confirmation dikhata hai
  return res.status(200).json({ ok: true, order_id: orderId, payment_id: paymentId });
};
