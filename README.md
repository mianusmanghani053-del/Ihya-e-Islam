# Ihya-e-Islam

A community website and member portal built for Cloudflare Pages, Pages Functions, D1, and private R2 storage. The running application is in `public/`. The prior static mockup is retained in Git history; the repository follows the latest Pages layout.

## Develop

Requires Node.js 22 or later and npm. Use the existing checkout; cloud tasks are already isolated and do not need a new Git worktree.

```sh
npm ci
npm run db:local
npm run dev
```

Open the development server in your own supported browser environment. The app uses the root path and hash navigation. The old Python server serves only the original prototype and cannot run this backend.

Optional local configuration belongs in ignored `.dev.vars`:

```dotenv
BANK_DETAILS="Bank name, account title, IBAN/account number, accepted currency, and transfer instructions"
```

Do not put API tokens, real personal data, or bank credentials in committed files. `BANK_DETAILS` is public payment-routing information, never a bank login or PIN. Without it the donation form stays closed. Use only fictitious details when testing.

## Expanded community platform

The member portal now includes donor, volunteer, student, beneficiary and community services, plus a separate role-controlled staff workspace. Start at `#hub`; authorized staff use `#staff`. See [platform operations](docs/PLATFORM.md) for coverage, case privacy, payment approvals, staff activation and remaining provider/account configuration.

## Included workflows

- Accounts, password changes, hashed passwords, expiring HttpOnly sessions and server-side administrator authorization.
- Complete 114-surah Quran reader, English/Urdu translations, search, Arabic font size, verse downloads, and account bookmarks. Source/version/license and SHA-256 provenance are in `public/data/`.
- The supplied searchable hadith collection, themed verses in the source content, Seerah, programs and volunteer pledge. Hadith is the supplied curated selection, not a complete imported collection.
- Persistent volunteer applications and member activity records.
- Incident reports with anonymous tracking keys, private attachments (10 MB maximum), and administrator review states. Status updates do not automatically forward reports to police.
- Published events and shifts, registration/cancellation, editable courses with multiple text lessons, saved progress and downloadable self-paced completion acknowledgments.
- Bank-transfer intents, manual finance confirmation, receipt downloads, and pausable monthly pledges. Monthly pledges do not automatically debit a bank account.
- Newsletter opt-in collection and administrator review. No outbound email/SMS provider is configured.
- Mobile layouts and a privacy/service information page.

Original sample members, payment histories, impact figures and event registrations are not used as real account data. Two introductory courses are seeded; the teaching team must publish the actual curriculum. Government registration certificates, audited accounts and policies must be supplied by the organization. The language toggle covers the original Urdu navigation/home content; the full portal UI is currently English, and Quran translation can be switched independently.

## Fund photos and videos

Each fund card in the donation popup has a **See our work** button that opens a gallery. The gallery reads `public/data/fund-media.json`; a fund with no items shows a "photos are on their way" message.

1. Put files in `public/media/<fund>/`, for example `public/media/water/pump-sanghar.jpg`. Keep photos under about 300 KB and videos short (MP4, H.264).
2. List them under the fund's id (`gen`, `zakat`, `winter`, `orphan`, `ilm`, `water`):

```json
{
  "water": [
    {
      "type": "image",
      "src": "/media/water/pump-sanghar.jpg",
      "caption": "New hand pump, Sanghar, Oct 2026"
    },
    {
      "type": "video",
      "src": "/media/water/handover.mp4",
      "poster": "/media/water/handover.jpg",
      "caption": "Handover to the village"
    }
  ]
}
```

Only publish media with the consent of the people shown. Do not show children's faces or exact locations of beneficiaries.

## Share an idea and the Decision Bench

A sticky **Share an idea** button (bottom-left, opposite **Report a Crime**) appears on every public and portal page. It opens a 4-step popup:

1. **What:** idea, improvement, problem or appreciation, and the area (programs and their activities, live activities, funds, portal services, other).
2. **Your idea:** one line (required unless a voice note is recorded), optional details, optional voice note (up to 2 minutes), urgency, and "I would like to help". Urgent items point to Report a Crime / 15.
3. **Contact:** WhatsApp, call, SMS or no reply, then mobile number, name and city.
4. **Send:** review with edit links. The person receives a reference and a private tracking key, plus a timeline (Received → Team review → Decision Bench → We update you).

Each step tells the person their suggestion will be reviewed and decided at the Decision Bench.

- **Storage:** records of kind `suggestion`. Voice notes go in D1 (`suggestion_audio`, migration `0004`, max 1 MB), so they work without R2.
- **Review:** `#decision-bench`, linked from the Staff portal, for admins, the chairman and trustees. Leadership can play voice notes, open WhatsApp or call, set the stage (Received, Under review, At the Decision Bench, Accepted, Planned, Not taken forward, Done) and write a decision note. Every decision and voice-note play is audit-logged.
- **Tracking:** people see the stage and the decision note on `#track` with their reference and key. Signed-in members also see them under My reports.

Apply `npm run db:remote` (migration `0004_suggestions.sql`) before deploying this version.

## Validation

```sh
npm run build
npm test
# With Python Playwright and Chromium installed:
npm run test:browser
```

The test harness migrates a temporary database, starts two local Pages instances, tests unconfigured and configured bank workflows, and removes test state. It never processes real money or writes to production. Ports 8790/8791 and inspector ports 9790/9791 must be free. API tests cover authentication, cross-origin protection, private record/receipt isolation, anonymous tracking, attachment access, enrollment progress, admin permissions, resource publication and donation confirmation. Browser tests cover account persistence, bookmarks, learning, application submission and mobile layout.

## Cloudflare deployment

Production was deployed to https://ihya-e-islam.pages.dev (deployment `ef4dc9e9-fbf1-4cbe-a425-85a54e9d0548`). Cloudflare reports production deployment success and the DB binding is installed. This environment blocks outbound HTTPS to the Pages domain, so live application smoke checks have not completed.

D1 database: `ccdc31cb-2108-4feb-91f2-a3545fd5ec6b`. The account has not enabled R2; production currently omits the UPLOADS binding, and attachments return a clear unavailable response. Local development/tests emulate UPLOADS via the CLI. To enable production attachments, enable R2 in the Cloudflare dashboard, create the private bucket, add the UPLOADS R2 binding to wrangler.jsonc, and redeploy. BANK_DETAILS is not configured, so donations remain closed.

A Cloudflare account with Pages, D1, and R2 is required for all features. R2 may require billing activation. Use a scoped API token through secure environment settings (`CLOUDFLARE_API_TOKEN`), plus `CLOUDFLARE_ACCOUNT_ID`. Never paste the token into source files or chat. The cloud egress policy must allow `api.cloudflare.com`. Google font rendering additionally uses `fonts.googleapis.com` and `fonts.gstatic.com`; system fallback fonts work without them.

Once authenticated:

```sh
npx wrangler whoami
npx wrangler d1 create ihya-e-islam
npx wrangler r2 bucket create ihya-e-islam-private
npx wrangler pages project create ihya-e-islam --production-branch main
```

The production `database_id` is already saved in `wrangler.jsonc`; reuse it for this deployment. If a project/database/bucket already exists, reuse the intended resources instead of creating duplicates. Bindings must be `DB` (D1) and `UPLOADS` (private R2). Do not enable public R2 access. Configure the chosen Pages project's public `BANK_DETAILS` variable in Cloudflare settings, then deploy:

```sh
npm run db:remote
npm run build
npm run deploy
```

Set Pages production and preview bindings deliberately; never point public previews at production incident data. For Git-based Pages builds use `npm run build` and output directory `public`. D1 production migrations are an explicit release step. Add a custom domain through Pages after choosing and verifying the domain.

Register the intended administrator through the deployed website, then promote that exact account using Cloudflare D1's SQL console or an authorized CLI session:

```sql
UPDATE users SET role = 'admin' WHERE email = 'replace-with-the-verified-administrator-email';
```

No default admin password, public bootstrap route, or automatic first-user promotion exists. Sign in at `#portal`; administrators can open `#admin`.

Before opening public submissions, provide the organization's contact/retention policy, assign reviewers and finance staff, verify bank instructions/currencies, and publish approved course and event content. Configure an email provider and account recovery before broadly enrolling members. Email verification, password recovery delivery, automatic newsletters/SMS, card/JazzCash/Easypaisa gateways, full hadith imports, recitation audio and full Urdu portal localization remain integration/content work.

After deployment verify the actual HTTPS URL: health endpoint, signup/login/logout, D1 persistence, private R2 attachments, authorization boundaries, and a fictitious or explicitly controlled bank-transfer review. A successful local build is not evidence of a live deployment.

The Pages project is Git-connected. Git builds use `npm run build` and output `public`; direct production deployment remains available through `npm run deploy`. Apply D1 migrations before releasing backend changes.

### Fieldwork, donor checkout and the installable portal

The fixed **Our Work & Your Impact** tab opens `#our-work`. Individual fund pages use `#our-work/gen`, `zakat`, `winter`, `orphan`, `ilm` and `water`; each donation card’s **See our work** link opens its matching fund. `#track-donation` separates public fieldwork from private member donation records.

Publish approved fieldwork assets under `public/` and list them by fund in `public/data/fund-media.json`. Each item supports `type` (`image` or `video`), a root-relative `src`, `alt`, `caption`, optional `date` and a **general** `location`. Use only consented media; never include children’s locations, private contact details or identifying beneficiary information. Empty funds explicitly show that no media has been published, rather than showing invented project results.

Bank checkout remains disabled until `BANK_DETAILS` is configured. When an unauthenticated donor explicitly agrees to create an account and saves a valid transfer record, the user and donation are inserted transactionally. A cryptographically random temporary password is returned only in that response and displayed in the thank-you popup; the database stores a salted PBKDF2 hash. Existing emails require sign-in. Migration `0005_donor_first_login.sql` adds the enforced password-change flag. The first login permits password replacement and sign-out, but blocks private service access until replacement. Changing a password revokes existing sessions. A saved bank record is **awaiting verification**, not proof of payment.

The completion popup offers installation of the web portal. The web manifest and service worker support a standalone browser app and a generic offline screen. The service worker caches only that offline page; it never caches API responses, credentials or member data. Unsupported browsers receive home-screen/bookmark instructions. This is a web app, not an App Store or Play Store release.

### Contact Us and private enquiries

`#contact` opens Help & Support. The other tabs are directly linkable as `#contact/form` and `#contact/whatsapp`. Contact Us appears immediately before the language toggle and in the footer. Both the main form and Private Message popup include grouped service options drawn from `WORKFLOWS` plus portal support destinations, so new workflow services automatically appear.

Contact enquiries are saved in `records` with `kind='contact'`; no email delivery is implied. The restricted `#contact-inbox` page is linked from the staff portal for Admin, Chairman, Trustee and City Coordinator roles. Inbox views and status updates are audited. The inbox shows the latest 100 enquiries, including the selected service. General contact enquiries do not replace assigned beneficiary/crime case workflows or the separate confidential support service.

To enable WhatsApp, set the Cloudflare Pages runtime variable `WHATSAPP_NUMBER` to the official international number (country code included). The public endpoint validates the number before publishing a `wa.me` link. Until configured, the page offers the website contact form and private website enquiry popup. The WhatsApp composer opens a draft only; the visitor must press Send in WhatsApp. Never use a fabricated number or claim a WhatsApp message was sent by the website.
