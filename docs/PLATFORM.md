# Community platform operations

## Member and public routes

`#hub` lists all services. `#donation-tracking` shows only the signed-in donor's allocations. `#staff` is the role-controlled staff workspace. `#community` and `#transparency` are public, as are minimal credential verification pages. `#tools` calculates prayer times, qibla, Hijri dates and a 30-day timetable locally with Adhan; no external prayer API or location history is required.

| Users | Services |
| --- | --- |
| Donors | Saved zakat calculations and recurring in-portal reminders; staff-shared sponsorship reports; Jariyah projects and private photos; confirmed-gift dedications and printable certificates; ten-night schedules and Qurbani fulfilment records; gated yearly tax certificates; household donation attribution |
| Volunteers | Consent-based public QR ID verification and expiry; staff-issued training badges; training-gated shift enrollment; check-in records and lead-confirmed hours; city/unit/wing call-outs and availability replies; reviewed incident logs; verified unit messages separated by wing |
| Students and parents | Hifz/revision records with assigned-scholar notes; private daily habits; attributed scholar answers with evidence and publication consent; verifiable course credentials; parent-owned Maktab progress records |
| Beneficiaries | Restricted help applications, CNIC/proof uploads when R2 is enabled, field visits and independent approval; Qard-e-Hasana schedules and confirmed repayments; moderated Rozgar listings; account-unlinked Karamat support with private tracking keys |
| Community | Partner mosque directory; nikah and pre-marriage class requests; mediation appointments; moderated lost/found and blood requests; in-portal matching blood alerts |
| Staff | Named roles, case assignments and access logs; finance reconciliation; bank-referenced outgoing payments; donor allocations; volunteer checks/removal; authority references for crime reports; scholar-reviewed publications; monthly fund aggregates |

Forms create persisted workflow records, rather than sample success messages. Staff must publish real events, training material, job listings, mosque entries and curriculum. Staff confirmation records a manual operational action: it does not contact police, transfer money, perform a background check, or slaughter an animal automatically.

## Privacy and access

Beneficiary, child, incident, mediation, scholar-question and confidential-support records require ownership or an explicit case assignment. Every sensitive read and document download creates an audit event. Staff role alone does not grant access to all cases. Leaders can assign named handlers through the staff portal; queues expose only references, service, state and dates.

Daily habits, household attribution and personal zakat plans remain private even from portal administrators. Browser service caches are cleared between logins. Anonymous support submissions deliberately omit the login identity; the infrastructure may still process connection metadata.

Recipient name, general area and phone are not public. Only the donor whose confirmed gift was allocated can receive the individually consented fields, after an assigned handler records a written-consent reference. Exact addresses and CNICs are never returned by donor tracking. Sponsored child records use a child reference; child photos and location are not published. Uploaded files remain private and are downloaded as attachments.

## Approvals and accounting

The provisional threshold is **Rs 50,000**, configurable by Chairman/Trustee. Above this threshold, **two distinct approvers other than the creator** are required before a payment can be marked paid. At or below it, one independent approver is required. The payment snapshots its threshold; lowering settings later does not change an existing request. A D1 trigger enforces the final bank-reference and approval requirements, and payment terms are immutable.

Zakat and general spending are separate. Allocations cannot exceed a confirmed donation, cannot cross currencies, and cannot link zakat gifts to general-fund payments. Public transparency sums only paid, approved bank-referenced spending by month/fund. Incoming transfers are confirmed manually by Finance with a reconciliation reference.

Help follows applied → field visit → verified → approved → received. Verification and approval must be performed by different people. CNIC/category checks reject duplicate active applications. Interest-free loan schedules conserve the principal; a trigger prevents confirmations beyond that principal. Attendance hours are lead-confirmed rather than proof of GPS presence. Verify references and location operationally.

## Staff activation

There are no default staff passwords or automatic first-user promotion. The intended leader must register normally and identify their registered email to the deployment operator. Promote only that verified account:

```sql
INSERT INTO staff_roles(user_id, role)
SELECT id, 'chairman' FROM users WHERE email = 'VERIFIED_REGISTERED_EMAIL';
```

Chairman/Trustee can assign staff roles and case handlers. City Coordinators verify unit profiles; only verified memberships access unit chat and matching call-outs. Removing a volunteer revokes their unit verification and volunteer credentials.

## Dependencies still requiring organizational configuration

- Cloudflare R2 remains disabled by the account. Activate it, create a private bucket, add `UPLOADS` to `wrangler.jsonc`, and deploy before collecting identity documents or private photos.
- Bank details are not configured. Donation intake stays closed until the organization's instructions are supplied.
- Email/SMS provider and the final payment threshold are not yet decided. Alerts and reminders currently appear inside the portal; there is no automatic external dispatch, background SMS service or automatic bank debit.
- Tax certificates remain disabled until leadership records actual tax exemption and its registration reference.
- The trust must assign staff, obtain consent documents, publish approved training/content and supply real partner/service details. No real case data or sample beneficiaries were seeded.

## Validation and release

`npm run build` bundles local QR/prayer libraries and Pages Functions. `npm test` creates isolated D1/R2 test state, and `npm run test:browser` adds Chromium workflows. The feature suite checks case access, consent redaction, allocation limits, distinct payment approvals, unit isolation, scholar publication, private support, training gates, credential suspension and loan limits.

Apply `npm run db:remote` before deploying this version. Migration `0002_community_platform.sql` adds tables/triggers without replacing existing user, donation or report records. Use `npm run deploy` for the production Pages project. Configure Git-connected Pages builds with command `npm run build` and output `public`; production D1 migration remains an explicit release step.
