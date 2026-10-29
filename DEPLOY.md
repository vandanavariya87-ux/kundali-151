# Premium Personalised Kundali (Vijendra Shastri) — Funnel Deploy Guide

## GIT DEPLOY (current method — manual zip/folder deploy does NOT run functions)
- Repo: `vandanavariya87-ux/kundali-151`, branch `premium-kundali-499` (main branch = old ₹51 funnel, untouched).
- Netlify site `kundali-51`: link this repo, Branch to deploy = `premium-kundali-499`, Build command = (empty), Publish = `.`, Functions = `netlify/functions` (netlify.toml already sets these).
- Env vars on the SAME site: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `TOKEN_SECRET`.
- After linking, verify: `/.netlify/functions/create-order` must NOT 404 (test with dummy data, no payment).
- Manual drag-and-drop deploys are static-only and must NOT be used for this page — functions 404 on them (proven 2026-10-29).


## ✅ FINAL STATUS — Razorpay setup complete (2026-10-29)

Payment ka poora setup code me final hai — ab sirf **tumhe Netlify me 3 variables add karne hain**, uske baad deploy + test:
1. `RAZORPAY_KEY_ID` — Razorpay Dashboard → Settings → API Keys → Key ID
2. `RAZORPAY_KEY_SECRET` — Razorpay Dashboard → Settings → API Keys → Key Secret
3. `TOKEN_SECRET` — khud ka banaya hua lamba random text (sirf tumko pata ho)

⚠️ Variables add karne ke baad **Deploys → Trigger deploy → Deploy site** (fresh deploy ZARURI hai, bina iske functions ko vars nahi milenge). Secret values kabhi chat/file/repo me mat likhna — sirf Netlify ke Environment variables me.

## Kya hai ye? (Flow)

Self-hosted funnel — modal me contact + birth details, phir Razorpay popup,
phir modal ke andar hi confirmation + WhatsApp button:

```
index.html (landing page, Vijendra Shastri brand)
  → har CTA se ek hi modal khulta hai: "Get Your Premium Kundli Report"
  → Step 1: naam + WhatsApp (+91) + email → "Continue to Birth Details"
  → Step 2: जन्म तारीख (DD-MM-YYYY) + लिंग + जन्म समय (HH:MM + AM/PM)
             + जन्म स्थान (शहर) → order summary ₹501 / ₹1,999 → "Pay Now"
  → create-order.js (Razorpay order, Rs 501 fixed, server-side)
  → Razorpay popup (same page, no redirect)
  → verify-payment.js (signature + captured + 50100 amount check)
  → modal ke andar CONFIRMATION panel: order id + birth-details summary
    + WhatsApp button (saari details pre-filled) — seller ko isi se
    fulfilment details milti hain (server par koi storage nahi hai)
  → report 24 ghante ke andar WhatsApp / email par manually bheji jati hai
```

**Koi instant download nahi hai.** Is funnel me koi PDF generate nahi hota —
fulfilment manual hai, 24 ghante ke andar.

**Koi SuperProfile page, koi ad campaign, koi tracking pixel is wiring me
nahi hai.** Pixel tabhi lagega jab alag se pixel id di jaye.

**Brand: Vijendra Shastri.** Page header, platform strip (10,000+ customers,
4.8/5, 50+ astrologers, 1 Lakh+ consultations, 8 languages) aur platform strip ke numbers client ke apne assets hain.
Reviews section me 8–10 written reviews SAMPLE-marked hain — real sales
ke baad real customer reviews se replace karne hain. Report mockup = seller ki
di hui uploaded book cover (assets/book-cover.png); 4-areas section me
chhoti images; 6 pain questions me chhoti icons.

---

## PART 0 — WhatsApp number (bhara hua, par CONFIRM karna hai)

Confirmation panel ka WhatsApp button is number par jata hai:

```
https://wa.me/917575831059
```

⚠️ **OPEN ITEM — confirm karo:** ye number abhi seller ke baaki funnels
wala hai. Tay karo ki post-payment order details **client ko seedha**
milni chahiye ya **seller ke through** — us hisab se number badalna ho to
`index.html` me `WA_NUMBER` variable me badlo, phir zip dobara banao.

---

## PART 1 — NEW Netlify site par deploy karo

> ⚠️ Ye ek NAYI site hai. Kisi purani live site ko touch mat karo, us par
> deploy mat karo.

### Step 1: Site banao
1. Netlify dashboard kholo → **Sites → Add new site → Deploy manually**
   (ya Git se, agar repo use ho raha ho)
2. Is folder (`premium-kundali-499`) ki poori content upload karo —
   `index.html`, `assets/`, `netlify/` sab ke saath
3. Site ban jayegi — URL note karo
4. (Optional) **Site settings → Change site name** se naam badlo

### Step 2: Environment variables (ZARURI)
1. **Site settings → Environment variables → Add a variable**
2. Ye 3 variables add karo:

| Variable | Value kahan se |
|---|---|
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → Settings → API Keys → Key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Settings → API Keys → Key Secret |
| `TOKEN_SECRET` | Khud banao — koi bhi lamba random text, jo sirf aapko pata ho |

3. **Deploys → Trigger deploy → Deploy site** (env vars ke baad FRESH
   deploy zaruri hai!)

> ⚠️ Bina fresh deploy ke functions ko env vars nahi milenge.
> "Payment not configured on server" error = env vars missing ya purana deploy.

> 🔒 Secret values kabhi bhi is file me, chat me ya repo me mat likho —
> sirf Netlify ke Environment variables section me.

> ⚠️ **OPEN ITEM — keys kiski?** Tay karo ki deploy par **client ke
> Razorpay keys** lagenge ya **seller ke**. Keys hamesha env vars me hi
> rahengi, kabhi file me nahi.

### Step 3: Razorpay me domain add karo
1. Razorpay Dashboard → Settings → API Keys
2. Apne naye Netlify domain ko allow karo (agar option ho)

---

## PART 2 — Test karo (bina real payment)

1. Site kholo → kisi bhi CTA se modal kholo (hero, price box, sticky bar,
   final CTA — sab ek hi modal kholte hain)
2. Step 1 bharo → "Continue to Birth Details" → Step 2 dikhna chahiye
3. Step 2 bharo → "Pay Now" dabao → Razorpay popup khulna chahiye
4. Popup band karo (bina pay kiye) — modal me "Payment cancelled. Your
   details are saved, you can try again." dikhna chahiye, aur saari
   details bhari hui rehni chahiye (dobara type nahi karna pade)

## PART 3 — Real Rs 501 test payment (ZARURI, deploy ke baad)

1. **Khud ek real Rs 501 payment karo** (apne hi UPI se)
2. Payment ke baad modal me **confirmation panel** dikhna chahiye:
   - Order ID + naam + birth-details summary
   - "रिपोर्ट 24 घंटे के अंदर WhatsApp / ईमेल पर भेज दी जाएगी"
   - **WhatsApp button** — dabane par WhatsApp khulna chahiye jisme naam,
     order id, WhatsApp, ईमेल, जन्म तारीख, जन्म समय, लिंग, जन्म स्थान
     pehle se likha ho — bas Send dabana ho
3. Razorpay dashboard me payment "captured" aur amount Rs 501 dikhna chahiye

> ⚠️ Ye test mat chhodo — bina iske ads mat chalao. Test ke baad report
> manually bhejne ka process (24 ghante ke andar) bhi ek baar end-to-end
> check karo.

---

## Files (sirf is workstream ki)

| File | Kaam |
|---|---|
| `index.html` | Landing page + 2-step order modal + Razorpay popup + confirmation + WhatsApp button |
| `netlify/functions/create-order.js` | Razorpay order — Rs 501 fixed, sirf product id `premium-kundali-499`; birth details Razorpay notes me bhi jaati hain |
| `netlify/functions/verify-payment.js` | Signature + captured + 50100 amount check |
| `netlify/functions/verify-token.js` | **UNUSED by live flow — sirf rakha hua hai, delete nahi kiya** |
| `netlify/functions/lib/token.js` | Shared helpers: HMAC token, Razorpay API, amount/product constants |
| `generate.html` | **UNUSED by live flow — sirf rakha hua hai.** ⚠️ Isme abhi bhi purani ₹499 / 24h wali copy hai — dobara enable karne se pehle update karna ZARURI hai |

## Price check

`PRICE_PAISE = 50100` (Rs 501, strike ₹1,999, 75% OFF) — server-side fixed:
- `lib/token.js` → 50100 ✓
- `create-order.js` → server-side fixed, client amount ignore ✓
- `verify-payment.js` → captured amount se match ✓

Product id har jagah `premium-kundali-499` hai — ye sirf ek internal
identifier hai, price se iska koi lena-dena nahi; client se koi aur product
id aane par order reject ho jata hai.

## Abhi baaki hai (user ke order ke bina nahi hoga)

- [ ] Razorpay keys tay karna — client ki ya seller ki (PART 1, Step 2)
- [ ] WhatsApp recipient confirm karna — client seedha ya seller ke through (PART 0)
- [ ] NEW Netlify site par deploy (purani site ko touch nahi karna)
- [ ] Ek real Rs 501 test payment + confirmation panel + WhatsApp button check
- [ ] Tracking pixel — koi id approve nahi hui, isliye koi pixel nahi laga
- [ ] Terms & Refund Policy — aisi koi page/link maujood nahi hai, isliye
      page par koi Terms/Refund link nahi lagaya gaya (invent nahi kiya)
