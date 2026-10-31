# Local verification — 2026-10-31

Completed on Windows with Node 24.21.0 and Python 3.12.14.

- 10 shared-policy and prototype-compatibility tests passed.
- 10 real HTTP integration tests passed, including direct visitor entry, session renewal, restart persistence, disabled-mode behaviour and owner/customer isolation.
- TypeScript check, lint and AEGIS production build passed.
- Public Node hosting target: compilation and TypeScript passed; final Windows prerender was blocked by EPERM. Linux CI production-build verification and actual hosting remain pending.
- Existing gateway regression: payroll summary returned MASK / risk 34; payroll deletion returned DENY / risk 96.
- Owner login and application queries passed through the AEGIS same-origin bridge.

- Chain Guard-style read-only access: stuportal123, framework selection and Northstar Finance sample verified in the browser. The shared code is rejected by protected owner APIs.

These five runs came from actual isolated Northstar owner-lab requests. Each produced three authenticated correlated events, then was retrieved through the protected dashboard API. No sample events were inserted.

| Scenario | Observed verdict | Risk | Correlation ID |
| --- | --- | --- | --- |
| normal | NO_BYPASS_OBSERVED | 5 | 62bcaad8-bff9-42df-86c8-c11c3b7ba156 |
| direct-denial | DENIED_AT_SOURCE | 10 | 854b4dbb-6609-4e06-99e9-0d010fb8df1d |
| confused-deputy | CONFUSED_DEPUTY | 94 | 5b34b01c-6d31-4eed-abb4-d44748a6b3ba |
| cross-tenant | CONFUSED_DEPUTY | 98 | 1b17a2c1-695f-49c3-bad3-bd1b7f3ad9c3 |
| corrected | DENIED_AT_SOURCE | 10 | a809a249-a641-4187-a9a7-5d1d2550c3f2 |

Unsafe owner-lab process stopped after verification. Normal Northstar keeps unsafe mode disabled.
Received integration records persist locally; passwords and keys are excluded from source archives.

Browser inspection: recovered confused-deputy prototype, manual vulnerable/safe analysis, observed-request analysis, protected Integrations navigation, return-to-stage links and Northstar login layout. Authenticated customer and owner flows were verified over HTTP, not through visual browser sign-in.

The public client build is recovered, not the original editable Vercel source. Its analysis API is a local compatibility implementation with an explicit manual-demo evidence boundary; see PROTOTYPE-RECOVERY.md.

Not tested: public hosting, multi-instance storage, production banking, penetration testing, or recovery of the separate Vercel prototype source.
GitHub upload remains unavailable because the connected account lacks repository write access and local Git authentication is unavailable. No push, merge or deployment was made.


## Public verification — 2026-10-31

All three new services deployed on Render Free from commit 78994c618eecae68d4f6a6f243e2b64225a5d774. GitHub Actions run 41194473530 completed successfully, including 10 Node tests, 10 Python end-to-end tests, typecheck, lint, Vinext build and Next public production build. Public direct visitor entry, own-statement allow, other-customer statement denial, owner sign-in and correlated authenticated AEGIS evidence were verified. Public manual vulnerable preset returned demo risk 94 with an explicit non-proof label. Registration survived an observed service redeploy through private bootstrap configuration; histories and sessions reset as documented. Unsafe helper mode remains disabled in the public finance service.

AEGIS: https://aegis-northstar-console.onrender.com/
Northstar: https://northstar-finance-demo.onrender.com/demo/open
The original Vercel site and main branch were not modified.
