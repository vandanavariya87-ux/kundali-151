// POST /api/create-order (Vercel)
// Body: { name, whatsapp, email, product_id, dob, gender, birth_time, birth_city }
// Only product_id "premium-kundali-499" is accepted, and only at the
// server-side fixed amount of 50100 paise (Rs 501). Any other product id,
// or any client-supplied amount, is rejected. Secrets come from env only.
'use strict';
const crypto = require('crypto');
const { rzpayRequest, configured, PRICE_PAISE, PRODUCT_ID,
  normaliseWhatsapp, validEmail } = require('./lib/token');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!configured()) return res.status(500).json({ error: 'Payment not configured on server' });

  let input = req.body;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!input || typeof input !== 'object') input = {};

  if (String(input.product_id || '') !== PRODUCT_ID) {
    return res.status(400).json({ error: 'Unknown product' });
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
    return res.status(400).json({ error: 'कृपया अपना पूरा नाम लिखें।' });
  }
  if (!whatsapp) {
    return res.status(400).json({ error: 'कृपया सही 10 अंक का WhatsApp नंबर लिखें।' });
  }
  if (email === null) {
    return res.status(400).json({ error: 'कृपया सही ईमेल लिखें, या खाली छोड़ें।' });
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
    return res.status(502).json({ error: 'Order create failed' });
  }

  if (r.status < 200 || r.status >= 300 || !r.json.id) {
    return res.status(502).json({ error: 'Order create failed' });
  }
  if (Number(r.json.amount) !== PRICE_PAISE) {
    return res.status(502).json({ error: 'Order amount mismatch' });
  }

  return res.status(200).json({
    order_id: r.json.id,
    amount: r.json.amount,
    currency: 'INR',
    key_id: process.env.RAZORPAY_KEY_ID,
  });
};
