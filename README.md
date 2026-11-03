# Ihya-e-Islam

Website for Ihya-e-Islam: reviving the way of the Prophet ﷺ and the Khulafa Rashidun through knowledge, service and reform.

> **Status: front-end prototype.** Forms (donations, volunteering, reports, sign-in, enrolment) show confirmations only. Nothing is stored or sent, and no payments are taken.

## Structure

```
public/
  index.html   # the whole site (single page, no build step)
  _headers     # security headers for Cloudflare Pages
```

## Run locally

```bash
npx serve public
```

## Deploy (Cloudflare Pages)

The site deploys from the `main` branch via Cloudflare Pages Git integration:

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick `mianusmanghani053-del/Ihya-e-Islam`, production branch `main`.
3. Build settings: Framework preset **None**, build command *(empty)*, build output directory **`public`**.
4. **Save and Deploy.** Every push to `main` then redeploys automatically.

## Roadmap

- Backend for donations, volunteers, reports and member accounts
- Real payment gateway (JazzCash / Easypaisa / Stripe)
- Secure handling for the Report page
- Full Urdu translation (currently menu and home page only)
