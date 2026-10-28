# Bellwether Phase 2 Implementation Plan

**Goal:** Make the approved Phase 1 coast playable with organic environment art in an isolated actual-game variant.
**Architecture:** Keep classic geography as default; opt into Phase 2 using `?bellwether=phase2` or `VITE_BELLWETHER_REDESIGN=1`. Share this immutable choice through `src/game/world/variant.ts` (`BELLWETHER_REDESIGN`). Use the existing World grids and production gameplay. Import original saves into a separate variant storage namespace and migrate positions without resetting progress.
**Tech Stack:** existing TypeScript, Three.js, Vite, Vitest; Playwright browser validation.
**Spec:** `docs/world-redesign/phase2/brief.txt`; execution explicitly authorised without another design gate.

## Global Constraints
- Work on `design/bellwether-phase2` based on `design/bellwether-phase1`; never merge main.
- Preserve approved coastline data and existing approved assets; no names, balance, rates, economy or other-island redesign.
- Keep freshwater lagoon and separate islet; no additional mainland area.
- Screenshots must come from actual game, not image generation.

## Tasks and interfaces
1. Geography/navigation (world files, map outline integration): RED tests for coastline, harbour/land access, resource/NPC/quest accessibility. Implement sampled phase1 signed field, reviewed coastal anchor remaps, retained hills/pads/lagoon/islet, maps reflecting authored outline. Export `BELLWETHER_REDESIGN` from variant.ts for art and saves. Retain classic path for baseline. Preserve placement IDs where possible and explicitly report deviations. Run targeted World/content/quest/naval tests with variant enabled.
2. Organic art (new custom meshes and renderer/building wiring, no world-data edits): inspect approved screenshot; RED structural tests for finite custom geometry, normals/bounds and reusable variants. Author swept trunks/branches, species silhouettes and eroded rocks, improve selected building details without losing roof interaction. Restrict to Bellwether variant; preserve original factories elsewhere. Capture and inspect actual running render; iterate on visibly crude results.
3. Persistence (save.ts/game.ts/main.ts, tests): RED old-save cases on changed coast, ship/mooring, island/other regions and content preservation. Add idempotent geometry marker and safe reachable-position migration, stable progress and separate browser save key with original-save import. Validate banking/equipment/XP/quests/coins/discoveries/ship upgrades unchanged.
4. Integration/browser evidence (scripts, report/screenshots): typecheck, full suite in classic and variant, production build; actual game movement/gathering/interaction/sailing/landing/transition checks. Browser screenshots overall, harbour, forest, rocks, beach, phone, old/new maps; report frame timings, load/navigation/memory metrics with hardware limitations. Fresh independent whole-branch review; fix important findings. No merge.

## Review focus
- Existing save in new water or valid but disconnected land: relocate safely, never discard progress.
- Saved ship on new mainland or old harbour: preserve ownership/upgrades and reunite aboard player.
- Shore markers and from-ship gather targets: exact endpoint/range checks, not a merely non-null path.
- Changed procedural scatter: keep logical node IDs and don't duplicate resource supply across variant migrations.
- Variant disabled or other region: classic visuals and gameplay remain intact.

## Progress
- Baseline: 307 tests passed immediately before Phase 2; clean starting tree at 45fdc3e.
- Task 1: complete. Exact field/outline, classic town+resource contracts, usable shore/dock/quest anchors and physical cliff integrated. 363 resources relocated; no balance/rate changes.
- Task 2: partial art acceptance. Oaks, rocks/ore and building details integrated and viewed in game. Two custom pine iterations and one generated sprite trial failed rendered quality review; approved pine restored. Professional conifer/outcrop/cliff finish remains a user acceptance gap.
- Task 3: complete. Isolated save slot and idempotent full-hull-aware coordinate migration; progression round-trip and sail-away regression green.
- Task 4: game integration/browser evidence complete; real mobile hardware unavailable. Final classic334pass/10skip; variant344pass; typecheck/build green. Capture script records actual production game screenshots, browser draw/heap/wall-frame and touch/save evidence.
- Final review: independent reviewer found P1 full hull migration issue; reproduced RED then fixed GREEN using shared normal-sailing footprint. No other confirmed branch regressions. All land/ship resource interaction candidates independently checked.
- Ruling: exact classic resource manifest retained instead of re-rolling scatter, to preserve logical identity and supply. Future content changes must update fixture intentionally.
- Ruling: rejected inferior pine replacements rather than claiming all art requirements satisfied. This preserves approved species readability but leaves conifer art acceptance incomplete.
- Ruling: Battery Saver software-GPU browser measurements are separate from real mobile acceptance. No mobile performance sign-off.
