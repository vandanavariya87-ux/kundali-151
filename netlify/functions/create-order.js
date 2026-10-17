// POST /.netlify/functions/create-order   { name, phone }
// Hindi Kundali ₹151 — naya flow: sirf NAAM + MOBILE payment se pehle.
// Birth details (dob/time/state/city) generate.html par payment ke baad.
// Razorpay order notes me naam+phone — dashboard me lead dikhta hai.
// Amount: 15100 paise (₹151) — server-side FIXED.
'use strict';
const crypto = require('crypto');
const { rzpayRequest, jsonOut, configured, PRICE_PAISE } = require('./lib/token');

function validNamePhone(name, phone) {
  const n = String(name || '').trim().slice(0, 60);
  const p = String(phone || '').trim();
  if (n.length < 2) return null;
  if (!/^[6-9]\d{9}$/.test(p)) return null;
  return { name: n, phone: p };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonOut(405, { error: 'Method not allowed' });
  if (!configured()) return jsonOut(500, { error: 'Payment not configured on server' });

  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) { return jsonOut(400, { error: 'Invalid JSON' }); }

  const vp = validNamePhone(input.name, input.phone);
  if (!vp) {
    return jsonOut(400, { error: 'कृपया सही नाम और 10 अंक का मोबाइल नंबर लिखें।' });
  }

  const receipt = 'kh151_' + Math.floor(Date.now() / 1000) + '_' +
    crypto.createHash('md5').update(vp.phone + Date.now()).digest('hex').slice(0, 8);

  let r;
  try {
    r = await rzpayRequest('POST', '/v1/orders', {
      amount: PRICE_PAISE,          // 15100 — server-side fixed, client pe bharosa nahi
      currency: 'INR',
      receipt: receipt,
      notes: {
        product: 'kundali-hindi-sampurn-151',
        name: vp.name,
        phone: vp.phone,
      },
    });
  } catch (e) {
    return jsonOut(502, { error: 'Order create failed' });
  }

  if (r.status < 200 || r.status >= 300 || !r.json.id) {
    return jsonOut(502, { error: 'Order create failed' });
  }
  if (Number(r.json.amount) !== PRICE_PAISE) {
    return jsonOut(502, { error: 'Order amount mismatch' });
  }

  return jsonOut(200, {
    orderId: r.json.id,
    amount: r.json.amount,
    keyId: process.env.RAZORPAY_KEY_ID,
    name: vp.name,
    phone: vp.phone,
    description: 'Sampurn Kundali Vishleshan — Hindi PDF',
  });
};
