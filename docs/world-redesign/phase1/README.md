# Bellwether: world and art redesign, Phase 1

28 October 2026. Audited base: `de916c8`, branch `work`.

**Recommendation:** use Bellwether for the one-island pilot. Keep its current name during the prototype. Adopt an authored coastline field with explicit coastal anchors, preserving the existing height-grid renderer and navigation system. The deliverable is an isolated geography prototype and concept image, **not an installed, playable replacement**. Production code, approved artwork, names, balance and saves are unchanged. Nothing was published or merged.

## 1. Current architecture

| Concern | Current implementation | Consequence for redesign |
|---|---|---|
| Island identity and bounds | `src/game/world/regions.ts`; Bellwether is centred at 0,0 in a 1,240 m square region | Keep region IDs, neighbouring-region transitions and bounds stable. Other islands have separate shape functions. |
| Coastline | `src/game/world/island.ts`: `coastR`, `coastDist`, `coastPoint` | Bellwether is a noisy polar radius with authored lobes. One radius per angle cannot describe a genuinely hooked inlet with multiple crossings of a ray. |
| Land surface | `rawHeight` / `shapedHeight`, hills, flats, roads, lagoon depressions and separate islets | Coast distance controls beach and seabed. Building pads and depressions can override it. Replacing only the outline can leave floating pads, submerged stations or incorrect water. |
| Content placement | `layout.ts`: cached deterministic `regionLayout`, town plans, explicit LAYOUT positions, coast-relative nodes and procedural scatter | Some inland anchors can stay fixed. Shore anchors, scatter rejection and dock construction need coordinated revision. Do not regenerate saved identities casually. |
| Collision and navigation | `world.ts`: 1.25 m height grid, 0.5 m walk grid, 1 m sail grid; baked slopes, decks, solids and reef/hull clearance | Rendering and navigation share terrain. There is no independent coastline collider to update alone. Long walking paths can be partial: verify endpoints. |
| Rendering | `src/render/terrainMesh.ts`: streamed 40 m chunks; `renderer.ts` region lifecycle; materials and water derive from terrain | An authored field can preserve the mesh density. It does not require painted terrain or a replacement rendering engine. |
| Maps | `src/ui/ui.ts`: local terrain map and separately drawn sea-chart outline | The chart samples a polar coastline. It must consume the same authored outline as terrain; otherwise maps and collision disagree. |
| Persistence | `src/game/sim/save.ts` and `game.ts` | Player, ship and treasure coordinates survive loading. Existing invalid-position recovery is insufficient for a deliberate geographic migration. Historical coordinate scaling must not be applied again. |

Paths above are relative to the repository root. Key entry points: island.ts `coastR` around line 150, `coastDist` around 175, `coastPoint` around 196, `rawHeight` around 561; layout.ts `regionLayout` at 52 and `buildIslandRegion` at 73; world.ts constructor at 44, bake at 92 and pathfinding at 151.

**Can one island change independently?** Yes at the region/shape level. No at the level of a single isolated radius function: height generation, shore anchors, chart silhouette, dock, content and migration must agree on the new geography. Do not refactor every island to prove the first one.

## 2. Existing art and preservation rules

`docs/ART_DIRECTION.md` records Tom's approved Bright direction: chunky legible forms, front-left daylight, matte materials, warm sand and timber, cream sails, green woods, blue/turquoise sea, fixed north-up camera at 54° pitch and 30° field of view. Preserve the silhouette, palette, camera and readable scale. Smooth shading is compatible with the current request; glossy materials and visual noise are not.

The manifest contains **610 PNGs**: 414 items, 57 creatures, 38 characters, 39 resources and 62 props. World-object exports are small transparent renders; their role differs from the more illustrative inventory icons. The art-sync workflow detects edited manifest PNGs by hash and promotes overrides. Currently **240 edited item assets** are in use; no world PNG replacements were found. Treat `art/` as an active pipeline, not a scratch folder.

The approved harbour screenshot and existing pine and sloop exports provide a coherent reference: clear silhouettes and strong material/value separation. Weaknesses include visibly primitive tree and rock construction, variable definition in small exports, and repetition in large natural areas. These justify better form design and coastal composition, rather than adding texture noise. Do not copy the inventory illustration style wholesale into world sprites. Building roof interaction, character animation and camera-facing sprite placement need individual review before replacement.

The old art document rejects AI images and describes exclusively flat shading/untextured code models. The current user explicitly authorises generated prototypes; runtime materials also use smooth shading and some procedural texture. This phase uses that authorisation for **separate concept art only**, retaining approved production assets and their provenance.

Image generation is available and was used with local approved references. [Revised concept](bellwether-concept-revised.png) is a direction study, not a game screenshot or final asset. It still has more faceted rock detail than the desired smooth production finish and does not reliably depict the separate freshwater lagoon. Its mine/quarry/buildings are illustrative, not coordinate-accurate. Use the authored geometry and lagoon constraints below as authority. Do not ship or slice this illustration into sprites.

## 3. Proposed coastline and geographic logic

[Current/proposed comparison](coastline-comparison.png) · [silhouette](silhouette-reference.png) · [authored coordinates](coastline.json)

The proposed mainland has an unequal northern shoulder and two northeastern rock headlands separated by an inlet, a west-facing tidal valley, a shallow southeast working cove, and a southern harbour between unequal sheltering arms. The exposed north/east coasts suit resistant rock and cliffs; the sheltered south suits beaches and settlement; sediment and reeds suit the western inlet. These are proposed geographic explanations, not established prevailing winds or geological lore.

Keep cliff faces on exposed shore edges and navigable gradients inland. The land behind northeastern headlands must remain broad enough for ordinary walking; no precision platforming or mandatory new skill gates. The west inlet stops before Mirewater. Its inland freshwater depression is a plot constraint, not a decorative bay: quest dialogue says it is becoming salty because of the Second Lock.

The first geometry iteration cut into this lagoon. The revised field leaves its centre about **75.5 m from the sea**; the existing depression extends 26.5 m, leaving about **49 m of land** outside it. Preserve that barrier and the original depression when integrating. Keep the existing western islet separately generated; do not merge it into the mainland or remove its quest marker.

The 768-segment sampled outline has no detected self-intersections and one connected mainland at 2 m raster resolution. Bounds are approximately x -406.5…475.2, z -470.0…410.6, inside the current region. Mainland area is **531,040 m² versus 435,088 m²** in the sampled current outline: about **22% larger**. That is a design cost, not a progression benefit. Do not populate the additional ground by increasing resources or rewards automatically. Review travel times and consider pulling back unused outer land during the playable pilot.

## 4. Naming options — proposals only

**Preferred: retain Bellwether.** It already has maritime and bell associations and established quest identity. It need not describe the silhouette literally. An old harbour warning bell or a pilot vessel that led fishing boats home could deepen its history, but those explanations require narrative approval.

| Candidate | Proposed historical basis | Geography/settlement fit |
|---|---|---|
| Bellwether | Retain the established name; develop its harbour and bell history | Strongest continuity; no save, dialogue or player-learning churn |
| Velland | An old coastal landholding or pilot family called Vell; proposed new history | A name inherited by the whole island rather than a label for its shape |
| Carrowen | A former coastal parish or estate name retained after the Breaking; proposed new history | Can connect separate communities without renaming the island after its largest resource |
| Marrick | A settlement and later island name associated with an earlier Marr surveying family; proposed connection, not a claim about existing canon | Fits a charting and harbour culture; would need care around Iven Marr's established story |

For settlements, review the hierarchy before changing labels. Bellwether Quay and Harbour Row are useful local address names. Copperback and Saltpine are legible district names but both foreground resources. Possible proper settlement names are **Penrose** (a proposed older fishing family, connecting cautiously to the existing surname), **Marrick** (a charting community), or **Vellin** (a proposed historic ferry settlement). Retain occupational labels such as Copperback Mine for the site rather than requiring the town to share the same name. Keep existing landmark names during evaluation. “The Broken Ring” is an existing ruin name, not a recommended island-name pattern.

These are editorial candidates, not a canon update or a legal uniqueness clearance. None intentionally borrow RuneScape place names. Final names need a full narrative/search review and a read-aloud test with the rest of the world.

## 5. Prototype files and reproducibility

All new material is confined to this directory. Approved art directories and game code are untouched.

- `coastline.json`: authored controls, sampled outline and field metadata.
- `shore-distance.f32`: 621×621 float32 distance field, 2 m spacing, positive on mainland; 1,542,564 bytes. Represents mainland coastline only, not lagoon water or separate islets.
- `design.py`, `export.ts`: build the technical diagrams/field from controls and export the actual baseline coastline/anchors.
- `validate.ts`: bilinear field reader, simplified shore-height adapter and actual `World` navigation exercise; also projects current content onto the proposal.
- `topology.py`: independent polygon-intersection, raster-connectivity and lagoon-clearance assertions.
- `validation.json`, `topology.json`: machine-readable evidence.
- `bellwether-concept-revised.png`: generated concept, kept outside production art.

From the repository root, using the existing JavaScript dependencies and Python with numpy, scipy and matplotlib installed:

```sh
node_modules/.bin/vite-node docs/world-redesign/phase1/export.ts
MPLCONFIGDIR=/tmp/reef-mpl python docs/world-redesign/phase1/design.py
MPLCONFIGDIR=/tmp/reef-mpl python docs/world-redesign/phase1/topology.py
node_modules/.bin/vite-node docs/world-redesign/phase1/validate.ts
```

The geometry diagrams are engineering evidence, not substitute artwork. Python dependencies are not added to the game's runtime or package manifest.

## 6. Validation results and limits

| Requirement | Evidence in this phase | Remaining integration gate |
|---|---|---|
| Player movement/pathfinding | Actual `World` walk grid reaches 24 asserted inland/settlement/quest-area anchors from the village with endpoint checks; also tests proposed Wreckers/Gull anchors | Re-run with production hills, roads, building footprints, doors, solids and interaction ranges |
| Coast collision | Simplified signed-field shore baked into the real walk/sail grids; island topology assertions pass | Sample waterline crossings, corners and cliff edges at final mesh resolution; test manual movement |
| Gathering | Projection identifies 172 previously above-water non-ship nodes now outside the proposed dry-land threshold; five boat-only nodes now fall on land | Relocate coastal nodes by biome and interaction access, keep tiers/yields/XP unchanged, verify resource identities and respawns |
| Quest/NPC interaction | All 111 building centres, 20 station centres and six banks remain on proposed mainland. Bastian Gull is the one of 39 NPC centres outside it. `wreckers:lantern` is also outside. The islet quest marker is intentionally outside the mainland field | Preserve islet and lagoon; remap Wreckers' Point, Gull and lantern as one authored group; audit complete footprints, quest marks, lore and dialogue |
| Sailing | Four routes from proposed harbour water (0,380) reach exact sea endpoints, including east-region approach and western inlet approach | Actual decks, mooring, hull obstacles, naval spawns, landing/disembark and region hand-offs |
| Landing | Existing dock base is on land; old mooring is about +1.23 m above water in the synthetic profile and is invalid | Re-author pier and mooring together; old 30 m pier-length cap needs review rather than extending it blindly |
| Saves | Production saves/code unchanged, therefore no migration is applied in this phase | Versioned geometry migration and representative old-save fixtures are required before enabling the coast |
| Mobile performance | Fixed region/grid sizes; core navigation/height arrays total 13,169,796 bytes; added raw field about 1.47 MiB. No per-frame polygon segment scan is proposed | Real mobile frame-time, memory, initialisation, draw-call and load-size profiling; no mobile performance pass claimed |

Additional detail: 198 non-ship nodes lie outside the proposed mainland dry threshold, including 26 kelp nodes that already belong near/in water; this is not a count of 198 broken gather interactions. The 172 previously above-water placements are relocation candidates, not proven unreachable interactions. Twenty-three spawn centres also lie outside the proposed dry threshold. Counts include scenery; per-node records are in `validation.json`. None were automatically deleted or moved. Five of six boat-only placements are on proposed land and need authored water anchors. Mainland-only projection intentionally flags the offshore islet's marker; preserving the existing islet height pass is essential.

Candidate Wreckers' Point (365,-267) and Gull (356,-261) are reachable in the simplified world; these coordinates are suggestions, not production edits. Their cliff safety, visual context, lantern offset and interaction approach still require authored placement.

Fresh baseline verification: **8 test files, 139 tests passed** covering world/places, content, quests, saves and three naval suites. **Production build passed** (`tsc --noEmit && vite build`), with the existing large-chunk warning. These tests exercise the unchanged production island. They must not be cited as proof that the new coastline is content-compatible. The isolated geometry assertions also pass separately. No on-device mobile test or playable integrated screenshot was performed.

## 7. Necessary code changes and save risks

For a playable pilot, introduce a Bellwether-only authored coast adapter providing a sampled signed-distance query, outline vertices and named shore anchors. A 2 m cached field is the proposed starting point; test interpolation error before selecting production precision. Keep the current adapters for other islands. Avoid testing every segment for every terrain vertex.

Wire that adapter into height construction, coastal colour/foam, local/sea charts and coastal placement. Replace angle/inset assumptions with named harbour, wreck, cove, fishing and salvage anchors where a concave coast makes radial placement ambiguous. Preserve fixed interior centres initially. Run terrain flattening only for reviewed valid pads; check full building footprints rather than centre points. Re-author cliff bands and walking approaches explicitly rather than raising all new coast edges.

Keep the lagoon depression and western islet as independent geographic features. Remap Wreckers' quest group and coastal nodes, not just their visual models. Preserve existing content IDs and quest states. Sequential `n…` node IDs need special attention if scatter counts/order change; determine every persisted/reference use before regenerating them.

A valid-looking saved position can still be stranded on the wrong shore or separated by a new inlet. Ship recovery currently sends an invalid ship to the current mooring; that mooring must itself be valid. Add a geometry revision and migration policy: preserve safe connected positions, map named moved anchors, relocate invalid players to a reachable nearby destination and ships to clear water, and audit active treasure/contract coordinates. Do not reset XP, inventory, quest progress or currency; do not replay the old 4.5× map scaling migration. Test old saves on both banks, at the old mooring, at Wreckers' Point, on the islet and mid-sail. Preserve cave destinations and entrances.

The generated concept is not a production asset change. New final assets should be commissioned/generated individually using approved camera, palette, contact-point and scale references, reviewed in game, then promoted through the existing override pipeline with manifest metadata. Keep editable sources and provenance. Do not replace approved art in bulk.

## 8. Phased implementation plan

1. **Review this pilot:** settle silhouette, inhabited footprint, lagoon barrier, harbour solution and art finish. Naming remains a separate editorial decision. Reduce the 22% area increase if it adds travel without purpose.
2. **Build one isolated playable Bellwether variant:** authored adapter, matching terrain/chart, retained lagoon/islet, reviewed pads, explicit coastal anchors and stable resource identities. Leave other islands unchanged and default to the existing production coast until migration is ready.
3. **Prove gameplay and persistence:** endpoint-aware reachability for every quest/NPC/station/node/door; manual gathering and combat approaches; sail/land both sides; old-save migration fixtures; complete game test suite and production build. Compare travel routes, resource access and quest completion without changing rates or difficulty.
4. **Art and device acceptance:** approved-camera screenshots at desktop and phone sizes; individually reviewed prototypes for rocks, vegetation and quay; real mobile CPU/GPU/memory tests. Keep resource readability, interaction space and combat telegraphs clear. Only then establish this island as the reusable standard, with any publication/merge handled separately.

Success means a recognisable coastline, plausible settlements, reliable routes, intact persistent progress and clearer choices. It does not mean shorter travel or faster XP by default. The geography should help players understand where to prepare, gather, trade, explore and sail without forcing a single optimal circuit.
