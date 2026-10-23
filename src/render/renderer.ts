import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LOOK_BRIGHT as LOOK } from '../art/looks';
import { createGradePass } from '../art/grade';
import { createWater } from '../art/water';
import { PAL, mat, recolour, type PalKey } from '../art/materials';
import { mulberry32 } from '../art/noise';
import { buildSloop, buildBarrel, type ShipRig } from '../art/models/ship';
import { buildHumanoid, animateIdle, animateWalk, animateSwing, animateWork, animateFish, type HumanoidRig, type HumanoidLook } from '../art/models/character';
import { buildCrab, animateCrab, type CrabRig } from '../art/models/crab';
import { buildPine, buildBroadleaf, buildRock, buildOreRock, buildCrate, buildLanternPost, buildShack, buildDock, buildGrass, buildBush, buildKelp } from '../art/models/props';
import { buildBench, buildFurnace, buildAnvil, buildCookfire, buildTent, buildSmithyShed, buildPillar, buildPlinth, buildStrongbox, buildDigSpot, buildGuardian, buildStump, buildRipples, type GuardianRig } from '../art/models/world';
import { buildLootShard, SHARD_TINT, type LootShard, type ShardKind } from '../art/models/items';
import { item } from '../game/data/items';
import { NODES, PLAYER_BASE } from '../game/data/content';
import type { Game, GameEvent, Enemy, Telegraph } from '../game/sim/game';
import { coastDist, nearestPathDist, WORLD_HALF } from '../game/world/island';
import { buildTerrainMesh } from './terrainMesh';
import { bakeRig, bakeStatic, mergeColoured } from './bake';
import { InstancedField, type FieldItem } from './instanced';
import { Particles } from './fx';

const HERO = 1.2; // characters drawn larger than life so they read on phones

const NPC_LOOKS: Record<string, HumanoidLook> = {
  iven: { skin: 'skin', coat: 0x55603f, coatTrim: 'brass', shirt: 'shirt', trousers: 'trousers', boots: 'leather', hat: 0x3a3a34, hair: 0x9a9a92, hatStyle: 'cap', spectacles: true },
  marta: { skin: 0xc98f66, coat: 0x7a3b3b, coatTrim: 0xd8c7a8, shirt: 'shirt', trousers: 0x4a3a30, boots: 'leather', hat: 0x2c2420, hair: 0x2c2420, hatStyle: 'none', beard: false, apron: 0xe6dcc0 },
  bram: { skin: 0xd09a70, coat: 0x4a4038, coatTrim: 'iron', shirt: 0xb5a58a, trousers: 0x3a3028, boots: 'leather', hat: 0x2c2420, hair: 0x5a3a22, hatStyle: 'none', apron: 0x5a3a26, held: 'hammer' },
};
const PLAYER_LOOK: HumanoidLook = { skin: 'skin', coat: 'coat', coatTrim: 'coatTrim', shirt: 'shirt', trousers: 'trousers', boots: 'leather', hat: 'hat', hair: 'hair', held: 'cutlass' };
const BRIGAND_LOOK: HumanoidLook = { skin: 0xc48c62, coat: 0x4a2f24, coatTrim: 0x8a2e22, shirt: 0xb5a58a, trousers: 0x3a3a30, boots: 'leather', hat: 0x9a2a1e, hair: 0x2a1a12, hatStyle: 'bandana', held: 'cutlass' };
const GUNNER_LOOK: HumanoidLook = { ...BRIGAND_LOOK, coat: 0x2f3a2e, hat: 0x2a2a2a, held: 'musket' };
const DROWNED_SKIN = 0x86a49a;
/** Outfits per enemy look; gunner-type enemies get a musket automatically. */
const HUMAN_LOOKS: Record<string, HumanoidLook> = {
  brigand: BRIGAND_LOOK,
  gunner: GUNNER_LOOK,
  smuggler: { skin: 0xc8946a, coat: 0x23364a, coatTrim: 0xb8b0a0, shirt: 0xd8ccb0, trousers: 0x2e2a26, boots: 'leather', hat: 0x161616, hair: 0x2a1a12, hatStyle: 'tricorn', held: 'cutlass' },
  poacher: { skin: 0xb98058, coat: 0x445228, coatTrim: 0x7a5a30, shirt: 0x9a8a62, trousers: 0x3a3424, boots: 'leather', hat: 0x5a4024, hair: 0x6a4a2a, hatStyle: 'cap', held: 'cutlass' },
  drowned: { skin: DROWNED_SKIN, coat: 0x2c3b3a, coatTrim: 0x5a6a5a, shirt: 0x7a8a7a, trousers: 0x2a3030, boots: 0x1e2424, hat: 0x2a3a34, hair: 0x3a4a44, hatStyle: 'bandana', held: 'cutlass' },
  captain: { skin: DROWNED_SKIN, coat: 0x3a1828, coatTrim: 'brass', shirt: 0x8a9a8a, trousers: 0x22201e, boots: 0x1e2424, hat: 0x141414, hair: 0x3a4a44, hatStyle: 'tricorn', held: 'cutlass' },
};
const CRAB_SHELLS: Record<string, Partial<Record<PalKey, number>>> = {
  mire: { crabShell: 0x5e7a3a, crabDark: 0x3c5228, crabBelly: 0xb8bc8a, barnacle: 0x7a8a5a },
  ironshell: { crabShell: 0x6a6e74, crabDark: 0x44484e, crabBelly: 0xb0a890, barnacle: 0x9a9a90 },
};
interface TreeLook { kind: 'pine' | 'broad'; scale: number; squash?: number; colours?: Partial<Record<PalKey, number>>; glow?: Partial<Record<PalKey, number>> }
const TREE_LOOK: Record<string, TreeLook> = {
  tree_pine: { kind: 'pine', scale: 1.05 },
  tree_oak: { kind: 'broad', scale: 1.25 },
  tree_willow: { kind: 'broad', scale: 1.3, squash: 0.8, colours: { leaf: 0x7f9a48, leafLight: 0xa2b85e, trunk: 0x6a5a3a } },
  tree_amber: { kind: 'broad', scale: 1.4, colours: { leaf: 0xc0622a, leafLight: 0xe89a3e, trunk: 0x5a3a28 } },
  tree_yew: { kind: 'pine', scale: 1.5, colours: { pine: 0x203c2c, pineLight: 0x2c5038, trunk: 0x4a3a2a } },
  tree_star: { kind: 'pine', scale: 1.55, colours: { pine: 0x3a3f7a, pineLight: 0x5a6ab8, trunk: 0x2e2a40 }, glow: { pineLight: 0.35 } },
  tree_cedar: { kind: 'pine', scale: 2.1, colours: { pine: 0x264630, pineLight: 0x33583c, trunk: 0x8a3a24 } },
};
const ORE_TINT: Record<string, [number, number]> = {
  rock_copper: [PAL.copper, 0.12], rock_tin: [0xd6d9d4, 0.12], rock_iron: [0xa5543a, 0.12], rock_coal: [0x202022, 0], rock_gold: [0xe3c25e, 0.25],
  rock_storm: [0x8fc0e8, 0.35], rock_abyss: [0x3f8f6e, 0.3], rock_tide: [0x3fd8d0, 0.6],
};

interface RigView { kind: 'human'; rig: HumanoidRig; mat: THREE.MeshStandardMaterial }
interface CrabView { kind: 'crab'; rig: CrabRig; mat: THREE.MeshStandardMaterial }
interface GuardView { kind: 'guardian'; rig: GuardianRig; mat: THREE.MeshStandardMaterial }
type EnemyView = (RigView | CrabView | GuardView) & { root: THREE.Group; ring?: THREE.Mesh; swingT: number; seen: boolean; baseScale: number };

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
  private composer: EffectComposer;
  private rt: THREE.WebGLRenderTarget;
  private sun = new THREE.DirectionalLight(LOOK.sun.color, LOOK.sun.intensity);
  private sunDir = new THREE.Vector3();
  private water: ReturnType<typeof createWater>;
  private terrain!: ReturnType<typeof buildTerrainMesh>;
  readonly particles = new Particles(500);
  private quality: 'high' | 'low' = 'high';

  private player: HumanoidRig;
  private playerRigs = {} as Record<'melee' | 'ranged' | 'magic', HumanoidRig>;
  private playerSwing = 0;
  private ship: ShipRig;
  private npcs = new Map<string, HumanoidRig>();
  private enemyViews = new Map<number, EnemyView>();
  private nodeViews = new Map<string, { live: THREE.Object3D; dead?: THREE.Object3D; ripples?: THREE.Group }>();
  private dropViews = new Map<number, LootShard>();
  private projViews = new Map<number, THREE.Mesh>();
  private teleViews = new Map<number, THREE.Group>();
  private flames: THREE.Mesh[] = [];
  private furnaceGlow!: THREE.MeshStandardMaterial;
  private clickMarker: THREE.Mesh;
  private slash: THREE.Mesh;
  private slashT = 0;
  private whirlFx: THREE.Mesh;
  private whirlT = 0;
  private whirlR = 3.2;
  private clickT = 0;
  private grass: THREE.Group | null = null;
  private grassTime: { value: number }[] = [];

  // camera
  camTarget = new THREE.Vector3();
  zoom = 1;
  private shake = 0;
  camDist = 30;
  /** pixels of the canvas covered at the bottom by UI (portrait sheet); the view is shifted so the player stays visible */
  coveredBottom = 0;
  private appliedShift = -1;
  private readonly pitch = THREE.MathUtils.degToRad(54);

  constructor(private canvas: HTMLCanvasElement, private game: Game) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = LOOK.exposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(LOOK.fog.color);
    this.scene.fog = new THREE.Fog(LOOK.fog.color, 40, 100);

    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, this.rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new OutputPass());
    this.composer.addPass(createGradePass(LOOK));

    const hemi = new THREE.HemisphereLight(LOOK.hemi.sky, LOOK.hemi.ground, LOOK.hemi.intensity);
    this.scene.add(hemi);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    const sc = this.sun.shadow.camera;
    sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 160;
    this.scene.add(this.sun, this.sun.target);
    const el = THREE.MathUtils.degToRad(LOOK.sun.elevationDeg), az = THREE.MathUtils.degToRad(LOOK.sun.azimuthDeg);
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));

    const world = game.world;
    this.terrain = buildTerrainMesh(world, LOOK);
    this.scene.add(this.terrain.group);
    this.water = createWater(WORLD_HALF * 2 + 120, 230, (x, z) => (Math.abs(x) > WORLD_HALF || Math.abs(z) > WORLD_HALF ? 6 : -world.ground(x, z)), LOOK);
    this.water.uniforms.uSunDir.value.copy(this.sunDir);
    this.scene.add(this.water.mesh);

    this.buildStatic();
    this.buildNodes();

    // one rig per weapon style so the right weapon is in hand
    for (const [style, held] of [['melee', 'cutlass'], ['ranged', 'pistol'], ['magic', 'staff']] as const) {
      const rig = buildHumanoid({ ...PLAYER_LOOK, held });
      rig.root.scale.setScalar(HERO);
      bakeRig(rig.root, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.9 }));
      rig.root.visible = false;
      this.scene.add(rig.root);
      this.playerRigs[style] = rig;
    }
    this.player = this.playerRigs.melee;

    this.ship = buildSloop();
    this.scene.add(this.ship.root);

    for (const n of game.layout.npcs) {
      const rig = buildHumanoid(NPC_LOOKS[n.id]);
      rig.root.scale.setScalar(HERO);
      rig.root.position.set(n.x, world.standY(n.x, n.z), n.z);
      rig.root.rotation.y = Math.PI / 2 - n.facing;
      bakeRig(rig.root, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.9 }));
      this.scene.add(rig.root);
      this.npcs.set(n.id, rig);
    }

    this.scene.add(this.particles.mesh);
    this.clickMarker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.42, 4), new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, depthWrite: false }));
    this.clickMarker.rotation.x = -Math.PI / 2;
    this.clickMarker.visible = false;
    this.clickMarker.renderOrder = 3;
    this.scene.add(this.clickMarker);
    // swing arc: a bright crescent in front of the player
    const arcMat = new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.slash = new THREE.Mesh(new THREE.RingGeometry(0.7, 2.1, 20, 1, -1.1, 2.2), arcMat);
    this.slash.rotation.x = -Math.PI / 2;
    this.slash.renderOrder = 4;
    this.scene.add(this.slash);
    this.whirlFx = new THREE.Mesh(new THREE.RingGeometry(0.4, 1.0, 40), arcMat.clone());
    this.whirlFx.rotation.x = -Math.PI / 2;
    this.whirlFx.renderOrder = 4;
    this.scene.add(this.whirlFx);

    game.on((e) => this.onEvent(e));
  }

  // ------------------------------------------------------------------ static scenery
  private buildStatic() {
    const L = this.game.layout, w = this.game.world;
    const root = new THREE.Group();
    const place = (o: THREE.Object3D, x: number, z: number, rot = 0, y?: number) => {
      o.position.set(x, y ?? w.ground(x, z), z);
      o.rotation.y = rot;
      root.add(o);
      return o;
    };
    const d = L.dock;
    root.add(buildDock(d.x, d.zStart, d.len, d.headWidth, d.deckY, 21).group);
    for (const b of L.buildings) {
      const y = w.ground(b.x, b.z);
      if (b.kind === 'tent') place(buildTent(b.seed), b.x, b.z, b.rot, y);
      else if (b.kind === 'smithy') place(buildSmithyShed(), b.x, b.z, b.rot, y);
      else {
        const s = buildShack(b.seed);
        place(s.group, b.x, b.z, -b.rot, y - 0.1);
        // signboards so the trader and the cartographer read from a distance
        if (b.kind === 'store' || b.kind === 'chart') {
          const sign = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.08), mat(b.kind === 'store' ? 0x7a3b3b : 0x2f5a6a));
          sign.position.set(b.x + 1.9, y + 2.4, b.z + 1.95);
          const mark = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.1), mat('brass'));
          mark.position.copy(sign.position).add(new THREE.Vector3(0, 0, 0.03));
          root.add(sign, mark);
        }
      }
    }
    for (const st of L.stations) {
      if (st.id === 'furnace') { const f = buildFurnace(); f.group.traverse((o) => { if ((o as THREE.Mesh).material === f.glow) o.userData.glow = true; }); place(f.group, st.x, st.z, 0); }
      else if (st.id === 'anvil') place(buildAnvil(), st.x, st.z, 0.3);
      else if (st.id === 'bench') place(buildBench(), st.x, st.z, 0);
      else { const f = buildCookfire(); f.flames.forEach((m) => (m.userData.flame = true)); place(f.group, st.x, st.z, 0); }
    }
    for (const p of L.props) {
      switch (p.kind) {
        case 'pine': { const t = buildPine(p.seed, p.s); place(t, p.x, p.z, t.rotation.y, w.ground(p.x, p.z) - 0.05); break; }
        case 'broadleaf': { const t = buildBroadleaf(p.seed); place(t, p.x, p.z, t.rotation.y, w.ground(p.x, p.z) - 0.05); break; }
        case 'rock': { const r = buildRock(p.seed, p.s, p.seed % 2 ? 'stone' : 'stoneDark'); r.position.set(p.x, w.ground(p.x, p.z) + p.s * 0.2, p.z); root.add(r); break; }
        case 'crate': place(buildCrate(p.seed, 0.7), p.x, p.z, p.rot); break;
        case 'barrel': place(buildBarrel(0.32, 0.75), p.x, p.z, p.rot); break;
        case 'lantern': place(buildLanternPost().group, p.x, p.z, p.rot); break;
        case 'pillar': place(buildPillar(p.seed, p.s), p.x, p.z, p.rot); break;
        case 'campfire': { const f = buildCookfire(); f.flames.forEach((m) => (m.userData.flame = true)); place(f.group, p.x, p.z); break; }
      }
    }
    place(buildPlinth(), L.plinth.x, L.plinth.z, 0);
    for (const b of L.banks) place(buildStrongbox(), b.x, b.z, 0);
    for (const r of L.reefs) {
      const m = buildRock(Math.round(r.x * 31 + r.z), r.r, 'stoneDark');
      m.position.set(r.x, 0.05, r.z);
      root.add(m);
    }
    const baked = bakeStatic(root);
    // flames and the furnace mouth are cloned out of the bake: find them by tag
    baked.traverse((o) => {
      if (o.userData.flame) this.flames.push(o as THREE.Mesh);
      if (o.userData.glow) this.furnaceGlow = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
    });
    this.scene.add(baked);
    this.buildGrass();
  }

  private buildGrass() {
    const w = this.game.world;
    const rnd = mulberry32(99);
    // bucketed into 40 m cells so each clump is its own culled draw
    const CELL = 40, buckets = new Map<string, THREE.Vector3[]>();
    let made = 0;
    for (let i = 0; i < 90000 && made < 9000; i++) {
      const x = (rnd() - 0.5) * 200, z = (rnd() - 0.5) * 200;
      if (coastDist(x, z) < 6 || !w.walkable(x, z)) continue;
      const y = w.ground(x, z);
      if (y > 8) continue; // bare upper peak
      const p = nearestPathDist(x, z);
      if (p.d < p.width + 0.5) continue;
      if (Math.hypot(x - this.game.layout.ruin.x, z - this.game.layout.ruin.z) < 8) continue;
      if (Math.hypot(x, z - this.game.layout.respawn.z) < 15) continue;
      const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = []));
      b.push(new THREE.Vector3(x, y - 0.02, z));
      made++;
    }
    this.grass = new THREE.Group();
    let seed = 7;
    for (const pts of buckets.values()) {
      const m = buildGrass(pts, seed++);
      m.computeBoundingSphere();
      this.grassTime.push((m.userData.uniforms as { uTime: { value: number } }).uTime);
      this.grass.add(m);
    }
    this.scene.add(this.grass);
  }

  private buildNodes() {
    const w = this.game.world;
    this.buildScenery();
    for (const n of this.game.nodes) {
      if (this.scenery.has(n.uid)) continue;
      const def = NODES[n.def];
      let live: THREE.Object3D, dead: THREE.Object3D | undefined, ripples: THREE.Group | undefined;
      if (def.skill === 'woodcutting') {
        const tv = TREE_LOOK[n.def] ?? TREE_LOOK.tree_pine;
        live = tv.kind === 'broad' ? buildBroadleaf(n.seed) : buildPine(n.seed, tv.scale);
        if (tv.kind === 'broad') live.scale.multiplyScalar(tv.scale);
        if (tv.squash) live.scale.y *= tv.squash;
        if (tv.colours) recolour(live, tv.colours, tv.glow);
        dead = buildStump(n.seed);
        if (tv.colours?.trunk) recolour(dead, { trunk: tv.colours.trunk });
        dead.scale.setScalar(Math.max(1, tv.scale * 0.8));
      } else if (def.skill === 'mining') {
        const g = buildOreRock(n.seed);
        const [tint, glowK] = ORE_TINT[n.def] ?? [PAL.copper, 0.12];
        g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.MeshStandardMaterial).color.getHex() === PAL.copper) m.material = mat(tint, { emissive: tint, emissiveIntensity: glowK }); });
        live = g;
        dead = buildRock(n.seed, 1.0, 'stoneDark');
        dead.position.y = 0.3;
        const holder = new THREE.Group();
        holder.add(dead);
        dead = holder;
      } else if (!def.skill) {
        live = buildDigSpot(n.seed);
      } else {
        ripples = buildRipples(def.fromShip ? 0xf2e6b0 : def.tool === 'lobster_pot' ? 0xf0c890 : 0xe9f5f2);
        live = ripples;
        if (def.fromShip) live.scale.setScalar(2.2);
      }
      const y = def.skill === 'fishing' ? 0.06 : w.ground(n.x, n.z) - (def.skill ? 0.05 : 0.02);
      live.position.set(n.x, y, n.z);
      this.scene.add(live);
      if (dead) { dead.position.set(n.x, y, n.z); dead.visible = false; this.scene.add(dead); }
      if (live !== ripples) bakeRig(live, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.92 }));
      this.nodeViews.set(n.uid, { live, dead, ripples });
    }
  }

  /** The island's ordinary trees, boulders, bushes and kelp: usable, drawn instanced (stumps, rubble, picked bushes). */
  private scenery = new InstancedField(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.9 }));
  private sceneryState = new Map<string, boolean>();
  private buildScenery() {
    const w = this.game.world;
    const by = new Map<string, FieldItem[]>();
    for (const n of this.game.layout.nodes) {
      if (!n.scenery) continue;
      const d = NODES[n.def];
      const y = d.id === 'kelp_bed' ? 0 : d.id === 'rock_boulder' ? w.ground(n.x, n.z) + (n.s ?? 1) * 0.2 : w.ground(n.x, n.z) - 0.05;
      const list = by.get(n.def) ?? [];
      list.push({ uid: n.uid, x: n.x, y, z: n.z, rot: n.rot ?? 0, s: n.s ?? 1, variant: n.seed });
      by.set(n.def, list);
    }
    const geo = (o: THREE.Object3D) => mergeColoured(o);
    const V = [11, 23]; // two shape variants per kind (with per-instance rotation and scale) keep draw calls low
    if (by.has('tree_pine')) this.scenery.add(by.get('tree_pine')!, V.map((k) => geo(buildPine(k, 1))), { alt: geo(buildStump(5)) });
    if (by.has('tree_oak')) this.scenery.add(by.get('tree_oak')!, V.map((k) => geo(buildBroadleaf(k))), { alt: geo(buildStump(9)) });
    if (by.has('rock_boulder')) this.scenery.add(by.get('rock_boulder')!, V.map((k, i) => geo(buildRock(k, 1, i % 2 ? 'stoneDark' : 'stone'))), { alt: geo(buildRock(41, 1, 'stoneDark')), altScale: [1.15, 0.35, 1.15] });
    if (by.has('bush_berry')) this.scenery.add(by.get('bush_berry')!, V.map((k) => geo(buildBush(k, true))), { alt: geo(buildBush(11, false)), castShadow: false });
    if (by.has('kelp_bed')) this.scenery.add(by.get('kelp_bed')!, [geo(buildKelp(3)), geo(buildKelp(8))], { castShadow: false });
    this.scene.add(this.scenery.group);
  }

  // ------------------------------------------------------------------ dynamic views
  private makeEnemyView(e: Enemy): EnemyView {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0 });
    let v: EnemyView;
    if (e.def.model === 'crab') {
      const rig = buildCrab(e.id);
      if (e.def.look && CRAB_SHELLS[e.def.look]) recolour(rig.root, CRAB_SHELLS[e.def.look]!);
      rig.root.scale.setScalar(e.def.scale * (e.elite ? 1.2 : 1));
      bakeRig(rig.root, material);
      v = { kind: 'crab', rig, mat: material, root: rig.root, swingT: 0, seen: true, baseScale: rig.root.scale.x };
    } else if (e.def.model === 'guardian') {
      const rig = buildGuardian();
      if (!e.def.boss) { recolour(rig.root, { stoneDark: 0x4e4c54, stone: 0x77737c }); rig.root.scale.setScalar(e.def.scale); }
      bakeRig(rig.root, material);
      v = { kind: 'guardian', rig, mat: material, root: rig.root, swingT: 0, seen: true, baseScale: rig.root.scale.x };
    } else {
      const look = HUMAN_LOOKS[e.def.look ?? e.def.model] ?? BRIGAND_LOOK;
      const rig = buildHumanoid(e.def.model === 'gunner' ? { ...look, held: 'musket' } : look);
      rig.root.scale.setScalar(e.def.scale * (e.elite ? 1.15 : 1));
      bakeRig(rig.root, material);
      v = { kind: 'human', rig, mat: material, root: rig.root, swingT: 0, seen: true, baseScale: rig.root.scale.x };
    }
    if (e.elite) {
      const colour = e.elite === 'barnacled' ? 0xcfc6b0 : e.elite === 'frenzied' ? 0xe05a3c : 0xf2a43a;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 24), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.85, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      ring.renderOrder = 2;
      v.root.add(ring);
      v.ring = ring;
    }
    this.scene.add(v.root);
    return v;
  }

  private disposeObject(o: THREE.Object3D) {
    this.scene.remove(o);
    o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
  }

  private syncEnemies(t: number, dt: number) {
    const g = this.game;
    for (const v of this.enemyViews.values()) v.seen = false;
    for (const e of g.enemies) {
      let v = this.enemyViews.get(e.id);
      const eliteChanged = v && !!v.ring !== !!e.elite;
      if (v && eliteChanged) { this.disposeObject(v.root); this.enemyViews.delete(e.id); v = undefined; }
      if (!e.alive) { if (v) v.root.visible = false; if (v) v.seen = true; continue; }
      if (!v) { v = this.makeEnemyView(e); this.enemyViews.set(e.id, v); }
      v.seen = true;
      v.root.visible = true;
      const y = g.world.ground(e.x, e.z);
      v.root.position.set(e.x, y, e.z);
      v.root.rotation.y = Math.PI / 2 - e.facing;
      v.mat.emissiveIntensity = e.hitFlash > 0 ? 0.6 : 0;
      const sq = e.hitFlash / 0.12 * 0.18;
      const base = v.baseScale;
      v.root.scale.set(base * (1 + sq), base * (1 - sq), base * (1 + sq));
      v.swingT = Math.max(0, v.swingT - dt);
      if (v.kind === 'crab') {
        animateCrab(v.rig, t + e.id, e.moving);
        if (e.state === 'windup') v.rig.clawR.rotation.x = -0.7;
      } else if (v.kind === 'human') {
        if (e.state === 'windup') { v.rig.armR.rotation.x = e.def.attack.kind === 'shot' ? -1.5 : -2.0; }
        else if (v.swingT > 0) animateSwing(v.rig, 1 - v.swingT / 0.35);
        else if (e.moving) animateWalk(v.rig, t + e.id);
        else animateIdle(v.rig, t + e.id);
      } else {
        const r = v.rig;
        if (e.state === 'rise') { v.root.position.y = y - 3.4 * Math.max(0, e.t / 2.2); r.core.emissiveIntensity = 1 + Math.random(); }
        else r.core.emissiveIntensity = 1.4 + Math.sin(t * 4) * 0.4 + (e.hp < e.maxHp * 0.25 ? 1 : 0);
        const wind = e.state === 'windup';
        r.armL.rotation.x = wind ? -2.4 : Math.sin(t * 2) * 0.15;
        r.armR.rotation.x = wind ? -2.4 : -Math.sin(t * 2) * 0.15;
        r.body.position.y = Math.abs(Math.sin(t * 3)) * (e.moving ? 0.12 : 0.02);
      }
      if (v.ring) (v.ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(t * 5) * 0.25;
    }
    for (const [id, v] of this.enemyViews) if (!v.seen) { this.disposeObject(v.root); this.enemyViews.delete(id); }
  }

  private syncDrops(t: number) {
    const live = new Set<number>();
    for (const d of this.game.drops) {
      live.add(d.id);
      let v = this.dropViews.get(d.id);
      if (!v) {
        const kind: ShardKind = item(d.stack.id).quest ? 'quest' : d.stack.inst?.rarity ?? 'common';
        v = buildLootShard(d.stack.id, d.stack.qty, kind, d.id);
        this.scene.add(v.group);
        this.dropViews.set(d.id, v);
      }
      const pop = Math.max(0, Math.min(1, d.t / 0.35));
      const ground = this.game.world.standY(d.x, d.z);
      v.group.position.set(d.x, ground + 0.62 + Math.sin(t * 2 + d.id) * 0.08 + Math.sin(pop * Math.PI) * 0.7, d.z);
      v.group.rotation.y = t * 0.6 + d.id;
      v.group.rotation.z = Math.sin(t * 0.9 + d.id) * 0.12;
      v.inner.rotation.y = -t * 1.4;
      v.ring.position.y = -(0.6 + Math.sin(t * 2 + d.id) * 0.08) + 0.06 + Math.max(0, ground < 0 ? -ground : 0);
      (v.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 3 + d.id) * 0.15;
      v.glass.emissiveIntensity = 0.22 + Math.sin(t * 2.4 + d.id) * 0.1;
      v.group.visible = d.t >= 0;
    }
    for (const [id, v] of this.dropViews) if (!live.has(id)) { this.disposeObject(v.group); this.dropViews.delete(id); }
  }

  private syncProjectiles() {
    const live = new Set<number>();
    for (const p of this.game.projectiles) {
      live.add(p.id);
      let m = this.projViews.get(p.id);
      if (!m) {
        m = new THREE.Mesh(new THREE.SphereGeometry(p.kind === 'magic' ? 0.22 : p.from === 'player' ? 0.12 : 0.12, 6, 4), new THREE.MeshBasicMaterial({ color: p.kind === 'magic' ? 0x7ff0e6 : p.from === 'player' ? 0xffe08a : 0xff6a4a }));
        this.scene.add(m);
        this.projViews.set(p.id, m);
      }
      m.position.set(p.x, this.game.world.standY(p.x, p.z) + 1.1, p.z);
      this.particles.burst(m.position.x, m.position.y, m.position.z, 1, p.kind === 'magic' ? 0x59d0c4 : p.from === 'player' ? 0xd8d2c0 : 0x5a5552, { speed: 0.3, up: 0.3, size: 0.1, life: 0.35, grav: -1 });
    }
    for (const [id, m] of this.projViews) if (!live.has(id)) { this.disposeObject(m); this.projViews.delete(id); }
  }

  private makeTelegraph(t: Telegraph): THREE.Group {
    const g = new THREE.Group();
    const red = (o: number) => new THREE.MeshBasicMaterial({ color: 0xe0402a, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
    let edge: THREE.Mesh, fill: THREE.Mesh;
    if (t.kind === 'circle') {
      edge = new THREE.Mesh(new THREE.RingGeometry(t.r - 0.15, t.r, 40), red(0.85));
      fill = new THREE.Mesh(new THREE.CircleGeometry(t.r, 40), red(0.32));
    } else if (t.kind === 'cone') {
      edge = new THREE.Mesh(new THREE.RingGeometry(t.r - 0.15, t.r, 24, 1, -t.width / 2, t.width), red(0.85));
      fill = new THREE.Mesh(new THREE.CircleGeometry(t.r, 24, -t.width / 2, t.width), red(0.32));
    } else {
      const geo = new THREE.PlaneGeometry(t.r, t.width);
      geo.translate(t.r / 2, 0, 0);
      edge = new THREE.Mesh(geo, red(0.25));
      const fg = new THREE.PlaneGeometry(t.r, t.width * 0.25);
      fg.translate(t.r / 2, 0, 0);
      fill = new THREE.Mesh(fg, red(0.7));
    }
    for (const m of [edge, fill]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 2; g.add(m); }
    g.userData.fill = fill;
    g.position.set(t.x, this.game.world.standY(t.x, t.z) + 0.15, t.z);
    g.rotation.y = -t.angle;
    this.scene.add(g);
    return g;
  }

  private syncTelegraphs() {
    const live = new Set<number>();
    for (const t of this.game.telegraphs) {
      live.add(t.id);
      let g = this.teleViews.get(t.id);
      if (!g) { g = this.makeTelegraph(t); this.teleViews.set(t.id, g); }
      const k = Math.min(1, t.t / t.dur);
      const fill = g.userData.fill as THREE.Mesh;
      if (t.kind === 'line') fill.scale.set(k, 1, 1);
      else fill.scale.setScalar(Math.max(0.02, k));
    }
    for (const [id, g] of this.teleViews) if (!live.has(id)) { this.disposeObject(g); this.teleViews.delete(id); }
  }

  // ------------------------------------------------------------------ events -> effects
  private onEvent(e: GameEvent) {
    const g = this.game;
    switch (e.type) {
      case 'hit': {
        const y = g.world.standY(e.x, e.z) + 1.0;
        this.particles.burst(e.x, y, e.z, e.crit ? 14 : 7, e.target === 'player' ? 0xd84a3a : 0xfff0c8, { speed: 3.5, up: 2.5, size: 0.11, life: 0.4 });
        if (e.target === 'player') this.shake = Math.max(this.shake, 0.25);
        else if (e.crit) this.shake = Math.max(this.shake, 0.15);
        break;
      }
      case 'pickup': {
        // the shard shatters: glass splinters in its tint plus a bright spark
        const y = g.world.standY(e.x, e.z) + 0.7;
        this.particles.burst(e.x, y, e.z, 18, SHARD_TINT[e.tint], { speed: 4, up: 3, size: 0.09, life: 0.55, grav: 9, spread: 0.3 });
        this.particles.burst(e.x, y, e.z, 6, 0xffffff, { speed: 2, up: 2, size: 0.06, life: 0.3, grav: 2 });
        break;
      }
      case 'swing': this.playerSwing = 0.35; this.slashT = 0.18; break;
      case 'squall': {
        this.whirlT = 0.45;
        this.whirlR = PLAYER_BASE.special.magic.radius;
        (this.whirlFx.material as THREE.MeshBasicMaterial).color.set(0x59d0c4);
        const p = g.p;
        this.particles.burst(p.x, g.world.standY(p.x, p.z) + 0.6, p.z, 40, 0x9fe8f0, { speed: 10, up: 2, size: 0.12, life: 0.5, grav: 1, spread: 0.8 });
        this.shake = Math.max(this.shake, 0.25);
        break;
      }
      case 'whirl': {
        this.whirlT = 0.35;
        this.whirlR = PLAYER_BASE.special.melee.radius;
        (this.whirlFx.material as THREE.MeshBasicMaterial).color.set(0xfff4d6);
        this.playerSwing = 0.35;
        const p = g.p;
        this.particles.burst(p.x, g.world.standY(p.x, p.z) + 0.8, p.z, 26, 0xfff4d6, { speed: 9, up: 1.2, size: 0.1, life: 0.35, grav: 2, spread: 0.6 });
        this.shake = Math.max(this.shake, 0.2);
        break;
      }
      case 'roll': { const p = g.p; this.particles.burst(p.x, g.world.standY(p.x, p.z) + 0.1, p.z, 10, 0xc8b48a, { speed: 2, up: 1.2, size: 0.16, life: 0.5, grav: 3 }); break; }
      case 'dodge': this.particles.burst(e.x, g.world.standY(e.x, e.z) + 1.2, e.z, 8, 0x9fe8ff, { speed: 3, up: 2, size: 0.09, life: 0.4 }); break;
      case 'enemyAttack': { const v = this.enemyViews.get(e.id); if (v) v.swingT = 0.35; break; }
      case 'enemyDeath': {
        const y = g.world.ground(e.x, e.z);
        this.particles.burst(e.x, y + 0.6, e.z, e.boss ? 70 : e.elite ? 30 : 16, e.boss ? 0x59d0c4 : 0xd8cbb0, { speed: e.boss ? 7 : 4, up: 4, size: e.boss ? 0.3 : 0.16, life: 0.8 });
        if (e.boss) this.shake = 0.8;
        break;
      }
      case 'gatherFx': {
        const y = e.kind === 'water' ? 0.1 : g.world.ground(e.x, e.z) + (e.kind === 'wood' ? 1.0 : 0.6);
        const colour = e.kind === 'wood' ? 0xc49a64 : e.kind === 'stone' ? 0x9a9690 : 0xe9f5f2;
        this.particles.burst(e.x, y, e.z, e.success ? 10 : 4, colour, { speed: 2.5, up: 3, size: 0.1, life: 0.5 });
        if (e.kind === 'stone' && e.success) this.particles.burst(e.x, y, e.z, 5, 0xffd38a, { speed: 4, up: 2, size: 0.06, life: 0.3 });
        break;
      }
      case 'level': {
        const p = this.game.p;
        this.particles.burst(p.x, g.world.standY(p.x, p.z) + 1.2, p.z, 40, 0xf2cf5b, { speed: 3, up: 6, size: 0.14, life: 1.1, grav: 6 });
        break;
      }
      case 'explode': this.particles.burst(e.x, g.world.standY(e.x, e.z) + 0.3, e.z, 30, 0xb8a888, { speed: e.r * 2.5, up: 3, size: 0.2, life: 0.6 }); this.shake = Math.max(this.shake, 0.35); break;
      case 'boss': if (e.state === 'rise' || e.state === 'summon') this.shake = 0.6; break;
      case 'craftFx': {
        const st = g.layout.stations.find((s) => s.id === e.station)!;
        this.particles.burst(st.x, g.world.ground(st.x, st.z) + 0.9, st.z, 10, e.station === 'fire' ? 0xffb04a : 0xffd38a, { speed: 2, up: 3, size: 0.07, life: 0.5 });
        break;
      }
    }
  }

  markClick(x: number, z: number) {
    this.clickMarker.position.set(x, this.game.world.standY(x, z) + 0.12, z);
    this.clickMarker.visible = true;
    this.clickT = 0.6;
  }

  // ------------------------------------------------------------------ frame
  setQuality(q: 'high' | 'low') {
    this.quality = q;
    this.renderer.shadowMap.enabled = q === 'high';
    this.sun.castShadow = q === 'high';
    if (this.grass) this.grass.visible = q === 'high';
    this.renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1.25));
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => (x.needsUpdate = true)); });
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.rt.samples = this.quality === 'high' ? 4 : 0;
    this.camera.aspect = w / h;
    this.appliedShift = -1;
    this.camera.updateProjectionMatrix();
  }

  frame(dt: number, t: number) {
    const g = this.game;
    const p = g.p;
    const world = g.world;

    // ship
    const sh = g.ship;
    this.ship.root.position.set(sh.x, 0, sh.z);
    this.ship.root.rotation.y = -sh.heading;
    this.ship.hull.position.y = Math.sin(t * 0.9) * 0.06;
    this.ship.hull.rotation.x = Math.sin(t * 0.7) * 0.025 + (p.onShip ? Math.sin(g.facing) * 0 : 0);
    this.ship.hull.rotation.z = Math.sin(t * 0.55 + 1) * 0.012 - (p.onShip ? Math.min(0.06, g.shipSpeed * 0.006) : 0);
    if (p.onShip && g.shipSpeed > 1.5) {
      const c = Math.cos(sh.heading), s = Math.sin(sh.heading);
      if (Math.random() < 0.7) this.particles.burst(sh.x - c * 4, 0.1, sh.z - s * 4, 2, 0xf2f6ee, { speed: 0.8, up: 0.6, size: 0.18, life: 0.9, grav: 1 });
      if (Math.random() < 0.5) this.particles.burst(sh.x + c * 4.4, 0.1, sh.z + s * 4.4, 1, 0xf2f6ee, { speed: 1.2, up: 0.8, size: 0.14, life: 0.5, grav: 2 });
    }

    // player
    const want = this.playerRigs[g.stats.style];
    if (want !== this.player) { this.player.root.visible = false; this.player = want; }
    const pr = this.player;
    pr.root.visible = true;
    this.playerSwing = Math.max(0, this.playerSwing - dt);
    pr.body.rotation.set(0, 0, 0);
    pr.body.position.y = 0;
    pr.armR.rotation.z = 0.08;
    if (p.onShip) {
      const c = Math.cos(sh.heading), s = Math.sin(sh.heading);
      pr.root.position.set(sh.x - c * 3.1, 1.0 + this.ship.hull.position.y, sh.z - s * 3.1);
      pr.root.rotation.y = -sh.heading + Math.PI / 2;
      if (g.action?.type === 'gather') animateFish(pr, t); else animateIdle(pr, t);
    } else {
      pr.root.position.set(p.x, world.standY(p.x, p.z), p.z);
      pr.root.rotation.y = Math.PI / 2 - g.facing;
      if (g.dead > 0) { pr.root.rotation.x = -Math.PI / 2 * Math.min(1, (3 - g.dead) * 3); pr.root.position.y += 0.3; }
      else pr.root.rotation.x = 0;
      if (g.dead > 0) { /* lying down */ }
      else if (g.rollT > 0) {
        const k = 1 - g.rollT / PLAYER_BASE.rollTime;
        animateWalk(pr, t * 2);
        pr.body.rotation.x = Math.sin(k * Math.PI) * 0.9;
        pr.body.position.y = -Math.sin(k * Math.PI) * 0.35;
      }
      else if (this.playerSwing > 0) animateSwing(pr, 1 - this.playerSwing / 0.35);
      else if (g.moving) animateWalk(pr, t);
      else if (g.action?.type === 'gather') {
        const node = g.nodes.find((n) => n.uid === (g.action as { node: string }).node);
        if (node && NODES[node.def].skill === 'fishing') animateFish(pr, t); else animateWork(pr, t);
      } else if (g.action?.type === 'craft') animateWork(pr, t * 0.8);
      else animateIdle(pr, t);
    }

    // npcs: look toward the player when close
    for (const n of g.layout.npcs) {
      const rig = this.npcs.get(n.id)!;
      const d = Math.hypot(p.x - n.x, p.z - n.z);
      const want = d < 6 && !p.onShip ? Math.atan2(p.z - n.z, p.x - n.x) : n.facing;
      const cur = Math.PI / 2 - rig.root.rotation.y;
      const diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
      rig.root.rotation.y = Math.PI / 2 - (cur + diff * Math.min(1, dt * 4));
      if (n.id === 'bram' && d > 4) animateWork(rig, t * 0.9); else animateIdle(rig, t + n.x);
    }

    // nodes
    for (const n of g.nodes) {
      const depleted = n.depletedUntil > g.time;
      if (this.scenery.has(n.uid)) {
        if (this.sceneryState.get(n.uid) !== depleted) { this.sceneryState.set(n.uid, depleted); this.scenery.set(n.uid, depleted); }
        continue;
      }
      const v = this.nodeViews.get(n.uid)!;
      if (v.ripples) {
        for (const r of v.ripples.children) {
          const k = (t * 0.5 + (r.userData.phase as number)) % 1;
          r.scale.setScalar(0.4 + k * 1.2);
          ((r as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.7;
        }
        v.ripples.visible = !depleted;
      } else {
        v.live.visible = !depleted;
        if (v.dead) v.dead.visible = depleted;
      }
    }

    this.syncEnemies(t, dt);
    this.syncDrops(t);
    this.syncProjectiles();
    this.syncTelegraphs();

    for (const f of this.flames) { f.scale.y = 0.8 + Math.sin(t * 12 + f.position.x * 10) * 0.25; f.scale.x = 1 + Math.sin(t * 9 + f.position.z * 7) * 0.12; }
    if (this.furnaceGlow) this.furnaceGlow.emissiveIntensity = 2 + Math.sin(t * 6) * 0.4;
    if (this.clickT > 0) { this.clickT -= dt; (this.clickMarker.material as THREE.MeshBasicMaterial).opacity = Math.max(0, this.clickT / 0.6); this.clickMarker.scale.setScalar(1 + (0.6 - this.clickT)); if (this.clickT <= 0) this.clickMarker.visible = false; }

    // swing arc + whirl ring
    if (this.slashT > 0) this.slashT -= dt;
    const sm = this.slash.material as THREE.MeshBasicMaterial;
    sm.opacity = Math.max(0, this.slashT / 0.18) * 0.75;
    this.slash.visible = this.slashT > 0 && !p.onShip;
    if (this.slash.visible) {
      this.slash.position.set(p.x, world.standY(p.x, p.z) + 0.9, p.z);
      this.slash.rotation.z = -g.facing + (1 - this.slashT / 0.18) * 0.9 - 0.45;
    }
    if (this.whirlT > 0) this.whirlT -= dt;
    const wm = this.whirlFx.material as THREE.MeshBasicMaterial;
    this.whirlFx.visible = this.whirlT > 0;
    if (this.whirlFx.visible) {
      const k = 1 - this.whirlT / 0.35;
      wm.opacity = (1 - k) * 0.7;
      this.whirlFx.scale.setScalar(1 + k * (this.whirlR - 1));
      this.whirlFx.position.set(p.x, world.standY(p.x, p.z) + 0.6, p.z);
      this.whirlFx.rotation.z = -k * 6;
    }
    this.particles.update(dt);
    this.water.uniforms.uTime.value = t;
    this.terrain.uniforms.uTime.value = t;
    for (const u of this.grassTime) u.value = t;
    this.updateCamera(dt);
    this.composer.render();
  }

  private updateCamera(dt: number) {
    const g = this.game;
    const shift = Math.round(this.coveredBottom / 2);
    if (shift !== this.appliedShift) {
      this.appliedShift = shift;
      const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
      if (shift > 0) this.camera.setViewOffset(w, h, 0, shift, w, h);
      else this.camera.clearViewOffset();
    }
    const aspect = this.camera.aspect;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const minWidth = 17;
    const base = Math.max(29, minWidth / (2 * tanHalf * aspect));
    const want = base * this.zoom * (g.p.onShip ? 1.35 : 1);
    this.camDist += (want - this.camDist) * Math.min(1, dt * 3);
    const tx = g.p.onShip ? g.ship.x + Math.cos(g.ship.heading) * g.shipSpeed * 0.6 : g.p.x;
    const tz = g.p.onShip ? g.ship.z + Math.sin(g.ship.heading) * g.shipSpeed * 0.6 : g.p.z;
    const ty = g.p.onShip ? 0.5 : g.world.standY(g.p.x, g.p.z) + 0.8;
    const k = Math.min(1, dt * 6);
    this.camTarget.x += (tx - this.camTarget.x) * k;
    this.camTarget.y += (ty - this.camTarget.y) * k;
    this.camTarget.z += (tz - this.camTarget.z) * k;
    if (dt === 0) this.camTarget.set(tx, ty, tz);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sx = (Math.random() - 0.5) * this.shake * 0.5, sz = (Math.random() - 0.5) * this.shake * 0.5;
    const c = this.camTarget;
    this.camera.position.set(c.x + sx, c.y + Math.sin(this.pitch) * this.camDist, c.z + sz + Math.cos(this.pitch) * this.camDist);
    this.camera.lookAt(c.x + sx, c.y, c.z + sz);
    this.sun.position.copy(c).addScaledVector(this.sunDir, 70);
    this.sun.target.position.copy(c);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = this.camDist * LOOK.fog.near;
    fog.far = this.camDist * LOOK.fog.far;
    // nothing past full fog is visible, so let the frustum cull it
    const far = Math.ceil(fog.far + 15);
    if (this.camera.far !== far) { this.camera.far = far; this.camera.updateProjectionMatrix(); }
    this.water.uniforms.uFogNear.value = fog.near;
    this.water.uniforms.uFogFar.value = fog.far;
  }

  snapCamera() { this.updateCamera(0); }

  // ------------------------------------------------------------------ picking helpers
  private v3 = new THREE.Vector3();
  project(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    this.v3.set(x, y, z).project(this.camera);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    return { x: (this.v3.x * 0.5 + 0.5) * w, y: (-this.v3.y * 0.5 + 0.5) * h, visible: this.v3.z < 1 && Math.abs(this.v3.x) < 1.2 && Math.abs(this.v3.y) < 1.2 };
  }

  private ray = new THREE.Raycaster();
  /** Screen point -> ground point (ray-marched against the height field, sea level for water). */
  screenToGround(sx: number, sy: number): { x: number; z: number } | null {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.ray.setFromCamera(new THREE.Vector2((sx / w) * 2 - 1, -(sy / h) * 2 + 1), this.camera);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    let prev = 0;
    for (let s = 0; s < 400; s += 0.25) {
      const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s;
      const gy = Math.max(0, this.game.world.standY(x, z));
      if (y <= gy) {
        // refine
        let a = prev, b = s;
        for (let i = 0; i < 8; i++) { const m = (a + b) / 2; const yy = o.y + d.y * m, xx = o.x + d.x * m, zz = o.z + d.z * m; if (yy <= Math.max(0, this.game.world.standY(xx, zz))) b = m; else a = m; }
        return { x: o.x + d.x * b, z: o.z + d.z * b };
      }
      prev = s;
    }
    return null;
  }
}
