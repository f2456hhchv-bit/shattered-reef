# Isolated public Bellwether preview

The publication tooling uses a **separate public repository**, `f2456hhchv-bit/shattered-reef-bellwether-preview`, with branch `preview-site`. Source remains on `design/bellwether-phase2` in the original repository. The publisher has no operation that pushes to original main or edits original Pages settings/workflows.

**Status: public publication is blocked by environment access.** Calls to `api.github.com` currently return Forbidden. The saved environment configuration draft adds only that API hostname and `f2456hhchv-bit.github.io` for public verification, retaining the existing font rules and package presets. A successful draft save does not apply it; the user must review/save the draft in Environment settings and publish the environment configuration. This action does not publish the game. API authentication readiness can only be determined after the hostname becomes accessible; no credential values are requested in chat.

The eventual preview path is `/shattered-reef-bellwether-preview/` on the account's GitHub Pages host. **It is not reported live until the separate repository/site exists and its HTTPS URL passes verification.** The existing `/shattered-reef/` site is not used as the preview destination.

## Build and publish

```sh
# Source must be clean and committed on design/bellwether-phase2.
node scripts/bellwether-preview.mjs --prepare-only

# Requires GitHub API authentication permitted to create this public repository,
# push its content, and configure its Pages source.
node scripts/bellwether-preview.mjs --publish
```

The script builds with both `VITE_BELLWETHER_REDESIGN=1` and `VITE_BELLWETHER_PREVIEW=1`, creates `.preview-dist/site/`, sets a distinct browser title, removes any inherited CNAME, writes `.nojekyll`, and adds `preview.json` with the exact source SHA and branch. The preview opens the new island directly without a query or installation. Even `?bellwether=classic` cannot switch a public-preview build into the live game's save slot.

The publisher accepts only the dedicated preview repository. It refuses unrelated/private existing targets and nonempty repositories without its exact marker. It can resume an interrupted first publication only if the target is genuinely empty, public and not a fork. Remote pushes are fast-forward only. Both source-provenance and production-main checks use the explicit original repository URL. Existing Pages configuration must already match the preview branch; no existing production deployment is reused. After first setup, later executions update this separate site; the original production workflow stays unchanged.

## Browser data isolation

GitHub Pages project sites on one account share an origin. Therefore all writable browser records are isolated, not just the voyage:

- Voyage: `shattered-reef.save.bellwether-phase2-v1`.
- Intro: `shattered-reef-intro-seen.bellwether-phase2-v1`.
- Portrait/landscape calibration: `sr.touch.p.bellwether-phase2-v1` and `sr.touch.l.bellwether-phase2-v1`.

The original voyage may be read once as an import, but preview saves/reset/calibration/credits never write or delete the live records. Existing save migration and original-progress protections remain in place. No service worker is introduced and no production asset path is overwritten.

## Verification

The six publisher/isolation tests cover rejection of production destinations, unknown existing repositories, unsafe retry targets, forced preview geometry and isolated settings, preserved relative assets, source metadata and removal of inherited custom domains. The full suite is also run with the public-preview flags enabled, including actual movement/gathering/quest/combat/sailing/landing/save migration regressions.

For the compiled site under a local project subpath:

```sh
python -m http.server 5180 --bind 127.0.0.1 --directory .preview-dist
REEF_PREVIEW_URL=http://127.0.0.1:5180/site/ node scripts/bellwether-preview-browser.cjs
```

For the public site, set `REEF_PREVIEW_URL` to the verified HTTPS preview URL. The same mobile-browser smoke test checks:

- Direct redesigned startup, including a hostile classic query.
- HTML title, preview marker, source revision and asset loading at a subpath.
- Read-only import of live data; actual credits skip and calibration write/clear actions leave original records unchanged.
- Touch movement through the real Input handlers, walkability and pointer release.
- Actual save/reload persistence and separate storage keys.

It records a 390×844 screenshot and results under `/workspace/game-review/public-preview` by default. `REEF_PREVIEW_EVIDENCE`, `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` are configurable. Browser testing here uses Chromium mobile/touch emulation: Safari/WebKit and physical iPhone hardware are unavailable. Do not describe those checks as a real iPhone certification. An actual public URL must be checked before reporting publication complete.

## Recorded result

Source/build revision `6580d1c`: 350/350 tests passed with both preview flags, TypeScript and production build passed. The compiled site was tested at a local project subpath with a 390×844 mobile viewport: credits skip, calibration write/clear, touch movement/release, save/reload and original-storage protection all passed. No same-origin asset failures or JavaScript errors were recorded. See [browser results](local-browser-results.json), [mobile screenshot](local-mobile-preview.png), [command evidence](verification.txt) and [publication status](status.json).

Actual publication was attempted and stopped at the first GitHub API authentication/read request: `GET https://api.github.com/user` returned `Forbidden`. No preview repository or Pages site was created by that attempt, and no public preview URL is verified. The environment still enforces only the two font-host custom rules; the saved API/Pages-host draft has not been applied. Production main remains `0c11573032516b2daaf28b92225a8160186a78e2`.
