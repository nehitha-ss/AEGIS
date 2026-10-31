# Correct confused-deputy prototype integration

The local home page now opens the recovered client build of
https://aegis-deputy-detector.vercel.app/, with its nine-step navigation, service
inventory, identity/trust views, evidence ledger, dark/light themes, live manual
runner and observed-request form. The new **Integrations** navigation entry opens
the protected, authenticated Northstar Finance integration at `/integrations`.
The previously used older agent-security dashboard remains at `/agent-legacy`.
Northstar Finance and its server-side security controls have not been replaced.

The public Vercel website has NOT been edited, redeployed or redirected.

## Recovery boundary

The original editable Vercel repository and server implementation remain
unavailable. We recovered the public HTML and eight immutable client assets,
not the original source. `public/deputy-prototype/provenance.json` records each
source asset URL and its original SHA-256 fingerprint. The only client-build
changes are local immutable-asset URL prefixes and a small navigation/demo-label
bridge. This keeps the actual published interface and its existing client-side
interactions instead of substituting the older agent dashboard.

The published interface calls `/api/detector/analyze`. Since the original server
code was not available, that endpoint has a local compatibility implementation.
Three synthetic public API comparisons established the vulnerable preset, safe
preset and observed-request response structure. The local implementation retains
the five-condition comparison and those presets' risk values. It deliberately
labels manual results as demonstration evidence, not confirmed real bypasses.
It is not represented as a source-identical recovery of the original backend.
Other combinations' exact old risk scoring were not reverse-engineered; local
nonmatching scores are deterministic demonstration values.

`lib/deputy-rule.mjs` is shared between this local manual-analysis endpoint and
the authenticated integration evaluator. Matching the path pattern is distinct
from confirming an access bypass. The received-event pipeline additionally
requires a complete consistent request chain, actual allowed resource outcome,
denied caller policy, broader helper authority and a missing caller check.
Missing policy evidence stays unknown. Manual form submissions are never inserted
into received integration events or labelled as live connected-app findings.

## Verification

- Locally clicked vulnerable preset analysis: five matches, demo alert, risk 94.
- Locally clicked safe preset and analysis: one match, allow, risk 15.
- Observed-request analyzer runs and saves its recent local result.
- Integrations opens from the recovered sidebar with the matching nine-step shell.
- Stage links return to the appropriate existing prototype section.
- Four additional rule tests cover compatibility and unverified/manual evidence.
- Existing integration and finance tests continue to cover real received evidence.

See `INTEGRATION.md` for setup and `VERIFICATION.md` for the actual finance receipts.
For future development and production hosting, obtain the original editable source
and replace the recovered build with a normal source-level integration. The frozen
snapshot will not automatically pick up future Vercel updates.
