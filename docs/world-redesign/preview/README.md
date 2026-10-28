# Isolated public Bellwether preview

The publication tooling uses a **separate public repository**, `f2456hhchv-bit/shattered-reef-bellwether-preview`, with branch `preview-site`. Source remains on `design/bellwether-phase2` in the original repository. The publisher has no operation that pushes to original main or edits original Pages settings/workflows.

**Status: network access is now working, but account repository creation is blocked.** GitHub reads and production Pages inspection succeed. The actual publication attempt stops at `POST https://api.github.com/user/repos` with **HTTP403, `Resource not accessible by integration`**. This is a GitHub integration permission restriction, not an environment allowlist restriction. The separate repository does not exist yet, and the expected public URL was checked and returns404. No further environment network change is needed to resolve this permission boundary.

Use the [iPhone-only setup guide](IPHONE_DEPLOY.md). It provides a prefilled repository link and one-file workflow link. The account owner creates the separate public repository in Safari; its own GitHub Actions token then builds and publishes the public redesign branch. No personal token, paid hosting or iPhone installation is needed. The workflow is stored here as reference only, outside `.github/workflows/`, and cannot run in the original production repository.

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

The initial publication attempt, before the network configuration was applied, stopped at `GET https://api.github.com/user` with `Forbidden`. That network restriction has since been resolved. The resumed attempt reached repository creation and was denied by GitHub's integration permissions; see the resumed check below. No public preview URL is verified. Production main remains `0c11573032516b2daaf28b92225a8160186a78e2`.


## Resumed publication check

After the environment was published, `GET /user` identified the correct owner and `GET /repos/f2456hhchv-bit/shattered-reef/pages` succeeded. Creating the new site repository was denied with HTTP403 `Resource not accessible by integration`. The public source is confirmed public, so the alternative workflow can check out its redesign branch without a personal token.

The prepared workflow passed actionlint v1.7.7 and YAML validation. It has an explicit repository guard on both jobs, deploys only the new repository’s Pages site, and checks the public HTML and build marker after deployment. It has not been executed in a new repository yet. The expected URL currently returns404; no public preview success is claimed. Production’s before/after HTML SHA256 is identical: `42ec4404fe00c8c534261568745793504a5ec43c783c4cde427084de63734c9c`. Original main remains `0c11573032516b2daaf28b92225a8160186a78e2`, with Pages still configured as workflow deployment from main.

Once the iPhone workflow method is selected, refresh the preview using Run workflow in the new repository. The CLI publisher targets branch-based Pages and deliberately refuses to replace an existing workflow-based Pages configuration.
