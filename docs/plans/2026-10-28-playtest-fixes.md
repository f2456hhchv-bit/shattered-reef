# Confirmed bug fixes and progression investigation

Scope: implement the user's four prioritized fixes and regressions on branch work; do not merge or publish. Preserve XP rates, unlocks, enemy stats, loot, costs, quest requirements, and monetization rules. Solo-first preparation, long-term skills, persistence and freedom remain design constraints.

1. Extract the scripted player from its CLI into an importable controller without changing its behavior. Add real-simulation regressions for ordered puzzle selection (including partial progress and decoys) and escape persistence. Observe failures, then select the next required puzzle marker and maintain retreat until safe. Keep game rules unchanged.
2. Add browser regressions exercising the actual Save now button with failed and successful localStorage writes, and resolving the page's favicon. Observe failures; propagate save success as a boolean and gate the success notification; ship a small local SVG favicon with a relative URL that works on GitHub Pages.
3. Rerun three 60-minute simulations (11, 23, 47), preserve all initial and subsequent results, diagnose remaining blockers from traces and code. Fix confirmed bot defects with regressions; report design/pacing limitations without balance changes. Make bot decisions seeded if needed for reproducible comparisons and disclose baseline limitations.
4. Run complete Vitest suite, production build, browser smoke and regression tests. Record before/after results, remaining blockers, and limits in a detailed report. Review final diff independently, address important findings, leave branch for user approval.

Review focus: ordered versus unordered/decoy marks; partial puzzle flags; enemies still pursuing during retreat; recovery after death; failed storage never acknowledged as success; successful storage still works; favicon resolves under a subdirectory. Tests should exercise controller/game integration or browser behavior, not source-text matches.

Execution ledger: baseline 293 tests and production build passed in previous review. Existing isolated checkout is clean on work; no worktree needed. User has authorized implementation of this concrete fix scope. No game balancing is authorized merely to improve bot scores.

## Completion ledger

- Controller extracted and CLI kept compatible; puzzle and retreat tests observed red, then green.
- Browser regression tests observed red for failed-save success and missing icon, then green. Static favicon lookup moved before the costly renderer loop after an intermediate two-second locator timeout; the actual prefixed production asset is verified by an HTTP request.
- Diagnosed and regression-tested additional bot defects: deaths not counted as losses, ignoring combat recommendations, training Attack exclusively, local-only training search, chained-node timer resets, inaccurate food metrics, and unseeded choices. No gameplay balance or persistence schema changes.
- Final simulations: seeds 11/23/47 each completed 60 minutes. Seed 23 repeated byte-identically. Raw baseline/new reports and detailed analysis are in reports/playtest/2026-10-28-confirmed-fixes/.
- Full suite: 307/307 tests across 39 files passed. Production build passed with existing bundle-size warning. Strict controller TypeScript check passed. Laptop/phone smoke passed with no errors. Development and Pages-prefix production save/favicon regressions passed.
- Independent review found no blocking defect. Added a real pursuit-to-safety simulation test in response to its coverage suggestion; it is included in the 307-test run.
- Remaining limitations are documented in the report, especially no proactive equipment purchasing/crafting and insufficient combat readiness within one hour. These do not justify changing XP or encounter difficulty.
- Integration: retain branch work. No merge, push, or publication authorized/performed.
