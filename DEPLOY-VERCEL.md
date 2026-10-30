# Premium Personalised Kundali (Vijendra Shastri) — Vercel Deploy Guide

Branch: `vercel-deploy` (repo `vandanavariya87-ux/kundali-151`).
Netlify wali branch (`premium-kundali-499`) se farq: functions `api/` folder me
Vercel format me hain, aur page `/api/create-order` + `/api/verify-payment`
call karta hai (Netlify ke `/.netlify/functions/*` ki jagah). Baaki sab same:
price ₹501 server-side fixed, WhatsApp 917575831059, 24h delivery.

## Vercel import steps

1. Vercel dashboard → **Add New → Project** → GitHub se repo import karo:
   `vandanavariya87-ux/kundali-151`
2. **Branch: `vercel-deploy`** chuno (main mat chunna — us par purana ₹51 funnel hai).
3. Framework Preset: **Other**. Build Command: **khaali** chhodo.
   Output Directory: **khaali** chhodo (root se static serve hota hai).
4. **Environment Variables** me ye 2 daalo (wahi keys jo Netlify par thi):
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
5. **Deploy** dabao. URL milega: `https://<project>.vercel.app`
   (Project Settings → Domains se naam badal sakte ho.)
6. Vars add karne ke baad **Deployments → ⋯ → Redeploy** zaroor karo —
   bina fresh deploy ke functions ko vars nahi milenge.

## Test (bina payment ke)

- `https://<project>.vercel.app/api/create-order` ko GET karo → 405 aana chahiye
  (function maujood hai). 404 aaye to import galat hua hai.
- Page par dummy details bhar ke Pay Now tak jao — order banna chahiye
  (asli payment mat karo jab tak test na ho).

## Dhyaan rakhne wali baatein

- Is branch me main se aayi hui purani files (generate.html, netlify/functions/)
  bhi maujood hain — wo Vercel par kuch nahi karti; root page premium wala hai.
  Unme koi secret nahi hai (code env vars se hi chalta hai).
- Vercel ka free (Hobby) plan officially personal/non-commercial ke liye hai;
  payment lene wala funnel commercial mana jata hai — policy risk ke liye
  Pro ($20/month) hi compliant raasta hai.
- Purani Netlify URL jahan lagi hai (ads, bio, messages) wahan nayi Vercel
  URL update karni hogi.
