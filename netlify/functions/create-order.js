// POST /.netlify/functions/create-order
// Body: { name, whatsapp, email, product_id }
// Only product_id "premium-kundali-499" is accepted, and only at the
// server-side fixed amount of 50100 paise (Rs 501). Any other product id,
// or any client-supplied amount, is rejected. Secrets come from env only.
'use strict';
const crypto = require('crypto');
const { rzpayRequest, jsonOut, configured, PRICE_PAISE, PRODUCT_ID,
  normaliseWhatsapp, validEmail } = require('./lib/token');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonOut(405, { error: 'Method not allowed' });
  if (!configured()) return jsonOut(500, { error: 'Payment not configured on server' });

  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) { return jsonOut(400, { error: 'Invalid JSON' }); }

  if (String(input.product_id || '') !== PRODUCT_ID) {
    return jsonOut(400, { error: 'Unknown product' });
  }

  const name = String(input.name || '').trim().slice(0, 60);
  const whatsapp = normaliseWhatsapp(input.whatsapp || input.phone || '');
  const email = validEmail(input.email || '');
  // Birth details (modal step 2) — notes only, never used for validation or amount.
  const dob = String(input.dob || '').trim().slice(0, 20);
  const gender = String(input.gender || '').trim().slice(0, 10);
  const birthTime = String(input.birth_time || '').trim().slice(0, 20);
  const birthCity = String(input.birth_city || '').trim().slice(0, 60);
  if (name.length < 2) {
    return jsonOut(400, { error: 'कृपया अपना पूरा नाम लिखें।' });
  }
  if (!whatsapp) {
    return jsonOut(400, { error: 'कृपया सही 10 अंक का WhatsApp नंबर लिखें।' });
  }
  if (email === null) {
    return jsonOut(400, { error: 'कृपया सही ईमेल लिखें, या खाली छोड़ें।' });
  }

  const receipt = 'pk499_' + Math.floor(Date.now() / 1000) + '_' +
    crypto.createHash('md5').update(whatsapp + Date.now()).digest('hex').slice(0, 8);

  let r;
  try {
    r = await rzpayRequest('POST', '/v1/orders', {
      amount: PRICE_PAISE, // 50100 — server-side fixed, client pe bharosa nahi
      currency: 'INR',
      receipt: receipt,
      notes: {
        product: PRODUCT_ID,
        name: name,
        whatsapp: whatsapp,
        email: email,
        dob: dob,
        gender: gender,
        birth_time: birthTime,
        birth_city: birthCity,
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
    order_id: r.json.id,
    amount: r.json.amount,
    currency: 'INR',
    key_id: process.env.RAZORPAY_KEY_ID,
  });
};
