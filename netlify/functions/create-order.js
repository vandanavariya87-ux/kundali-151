// POST /.netlify/functions/create-order   { name, phone }
// LEAD-FIRST flow: sirf naam + mobile (email nahi). ₹51 (5100 paise) FIXED server-side.
// Lead = Razorpay order ke notes me {name, phone} — payment ho ya na ho,
// Razorpay dashboard me har order lead ki tarah dikhta hai (WhatsApp follow-up).
'use strict';
const crypto = require('crypto');
const { rzpayRequest, jsonOut, configured, PRICE_PAISE } = require('./lib/token');

function validLead(input) {
  if (!input || typeof input !== 'object') return null;
  const name = String(input.name || '').trim().slice(0, 60);
  const phone = String(input.phone || '').trim();
  if (name.length < 2) return null;
  if (!/^[6-9]\d{9}$/.test(phone)) return null;
  return { name, phone };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonOut(405, { error: 'Method not allowed' });
  if (!configured()) return jsonOut(500, { error: 'Payment not configured on server' });

  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) { return jsonOut(400, { error: 'Invalid JSON' }); }

  const lead = validLead(input);
  if (!lead) {
    return jsonOut(400, { error: 'Naam ane 10 ank no mobile number sahu lakho' });
  }

  const receipt = 'k51_' + Math.floor(Date.now() / 1000) + '_' +
    crypto.createHash('md5').update(lead.phone + Date.now()).digest('hex').slice(0, 8);

  let r;
  try {
    r = await rzpayRequest('POST', '/v1/orders', {
      amount: PRICE_PAISE,          // 5100 — server-side fixed, client pe bharosa nahi
      currency: 'INR',
      receipt: receipt,
      notes: {
        product: 'kundali-51-sankshipt',
        name: lead.name,
        phone: lead.phone,
      },
    });
  } catch (e) {
    return jsonOut(502, { error: 'Order create failed' });
  }

  if (r.status < 200 || r.status >= 300 || !r.json.id) {
    return jsonOut(502, { error: 'Order create failed' });
  }
  if (Number(r.json.amount) !== PRICE_PAISE) {
    return jsonOut(502, { error: 'Order amount mismatch' });  // Razorpay ne jo banaya wo bhi check
  }

  return jsonOut(200, {
    orderId: r.json.id,
    amount: r.json.amount,
    keyId: process.env.RAZORPAY_KEY_ID,   // public Key ID — frontend ke liye safe (secret kabhi nahi)
    name: lead.name,
    phone: lead.phone,
    description: 'Janm Kundali (Sankshipt) — Gujarati PDF',
  });
};
