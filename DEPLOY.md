# Hindi Sampurn Kundali ₹151 — Razorpay Funnel Deploy Guide

## Kya hai ye? (Naya flow — 2026-10-16)

Self-hosted funnel: Hindi landing page → naam+mobile → Razorpay ₹151 → birth details → auto personalized PDF.

```
index.html (landing + sirf NAAM + MOBILE form)
  → create-order.js (Razorpay order, ₹151 = 15100 paise)
  → Razorpay popup
  → verify-payment.js (signature + amount + captured check → token: name+phone)
  → generate.html?t=TOKEN (token verify → BIRTH DETAILS form: tithi, samay, RAJYA → SHAHAR)
  → generate-kundali.py (token verify + engine + Hindi PDF)
  → PDF download
```

**Koi SuperProfile nahi chahiye.** Sab kuch aapke Netlify site par.
**Birth details payment ke BAAD** — pehle sirf naam+mobile (zyada conversion).

---

## PART 1 — Netlify par deploy karo

### Step 1: Zip upload
1. Netlify dashboard kholo → **Sites**
2. `kundali-hindi-151-razorpay.zip` ko drag-drop karo
3. Site ban jayegi — URL note karo (jaise `kundali-hindi-151.netlify.app`)
4. (Optional) **Site settings → Change site name** se naam badlo

### Step 2: Environment variables (ZARURI)
1. **Site settings → Environment variables → Add a variable**
2. Ye 3 variables add karo:

| Variable | Value kahan se |
|---|---|
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → Settings → API Keys → Key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Settings → API Keys → Key Secret |
| `TOKEN_SECRET` | Khud banao — koi bhi lamba random text (jaise `aB3xK9mP2qW7zY8vN4`) |

3. **Deploys → Trigger deploy → Deploy site** (env vars ke baad FRESH deploy zaruri hai!)

> ⚠️ Bina fresh deploy ke functions ko env vars nahi milenge.
> "Payment not configured on server" error = env vars missing ya purana deploy.

### Step 3: Razorpay me domain add karo
1. Razorpay Dashboard → Settings → API Keys
2. Apne Netlify domain ko allow karo (agar option ho)

---

## PART 2 — Test karo (bina real payment)

1. Site kholo → naam + mobile bharo
2. **Pay** dabao → Razorpay popup khulega
3. Popup band karo (bina pay kiye) — form wapas aana chahiye, error nahi

## PART 3 — Real ₹151 test payment (ZARURI)

1. **Khud ek real ₹151 payment karo** (apne hi UPI se)
2. Payment ke baad `generate.html` khulna chahiye — "पेमेंट सफल ✓"
3. Birth details bharo: tithi, samay, **राज्य चुनो → शहर चुनो**
4. 30-60 sec me PDF download honi chahiye
5. PDF kholo — naam, lagna, graha sab sahi hone chahiye
6. Razorpay dashboard me payment "captured" dikhna chahiye

> ⚠️ Ye test mat chhodo — bina iske Meta ads mat chalao.

---

## PART 4 — Meta Pixel (already laga hai)

- Pixel ID: `866517331484980`
- `PageView` — index.html + generate.html load par
- `InitiateCheckout` — pay button dabane par
- `Purchase` — payment verify hone par (sirf ek baar per token)

---

## Files

| File | Kaam |
|---|---|
| `index.html` | Hindi landing + naam/mobile form + Razorpay popup |
| `generate.html` | Token verify → birth details form (राज्य → शहर) → PDF |
| `assets/states-cities.js` | 28 states + 8 UTs, 500+ shahar (lat/lon ke saath) |
| `netlify/functions/create-order.js` | Razorpay order (₹151 fixed, naam+phone) |
| `netlify/functions/verify-payment.js` | Signature + amount + captured → token (name+phone) |
| `netlify/functions/verify-token.js` | Token verify → naam+phone |
| `netlify/functions/generate-kundali.py` | Token verify + engine → Hindi PDF (base64) |
| `netlify/functions/lib/token.js` | HMAC token + validation (PRICE_PAISE=15100) |

## Price check

`PRICE_PAISE = 15100` (₹151) — 3 jagah verify kiya gaya:
- `lib/token.js` → 15100 ✓
- `create-order.js` → server-side fixed ✓
- `verify-payment.js` → captured amount se match ✓

## Support

- Testimonials me "SAMPLE" tag hai — pehli real sales ke baad asli reviews lagao
- Ek payment = ek kundali (token 24h me expire)
