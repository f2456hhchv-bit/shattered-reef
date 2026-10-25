import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LOOK_BRIGHT as LOOK } from '../art/looks';
import { createGradePass } from '../art/grade';
import { addSurfaceDetail, surfaceUniforms } from '../art/surface';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createWater } from '../art/water';
import { PAL, mat, recolour, type PalKey } from '../art/materials';
import { mulberry32 } from '../art/noise';
import { buildSloop, buildBarrel, type ShipRig } from '../art/models/ship';
import { buildCinderVent, buildFallenStar, buildBones, buildSpire, buildSaltPan, buildVentForge, buildLeviathan, buildCrater } from '../art/models/highnodes';
import { buildNetRack, buildRowboat, buildSignpost, buildFence, buildWell, buildDriftwood, buildShells, buildPotStack, buildCannon, buildWreckRibs, buildWoodpile, buildFlowers } from '../art/models/decor';
import { NPC_LOOKS, PLAYER_LOOK, BRIGAND_LOOK, HUMAN_LOOKS, TOWNS_LOOKS } from '../art/cast';
import { buildEnterable, buildStall, type EnterableView } from '../art/models/buildings';
import { isInside, toLocal, WALL_H, type BuildingDef } from '../game/world/buildings';
import { buildHumanoid, addOffhand, animateIdle, animateWalk, animateSwing, animateWork, animateFish, type HeldKind, type HumanoidRig } from '../art/models/character';
import { item, pairGroup, weaponKind, type WeaponKind } from '../game/data/items';
import { CREW_BY } from '../game/data/bounties';

const HELD_OF: Record<WeaponKind, HeldKind> = { cutlass: 'cutlass', dagger: 'dagger', pike: 'pike', greatsword: 'greatsword', pistol: 'pistol', shortbow: 'bow', longbow: 'longbow', crossbow: 'crossbow', staff: 'staff', wand: 'wand' };
/** What the left hand shows for the item in the off-hand slot. */
function offHeld(id: string | undefined): HeldKind {
  if (!id) return 'none';
  const d = item(id);
  return d.equip?.off ?? (pairGroup(d) ? HELD_OF[weaponKind(d)] : 'none');
}
import { buildCrab, animateCrab, type CrabRig } from '../art/models/crab';
import { buildBoar, animateBoar, buildSpider, animateSpider, buildSnake, animateSnake, type BoarRig, type SpiderRig, type SnakeRig } from '../art/models/beasts';
import { buildCaveMouth, buildRope, buildWeb, buildCrystal, buildCaveTorch, buildStalagmite, buildLava, buildGong } from '../art/models/cave';
import { REGIONS } from '../game/world/regions';
import { artOverride, spriteSwap } from '../art/overrides';
import { BillboardBatch } from './billboards';
import { buildPine, buildBroadleaf, buildRock, buildOreRock, buildCrate, buildLanternPost, buildDock, buildPalm, buildGrass, buildBush, buildKelp } from '../art/models/props';
import { buildBench, buildFurnace, buildAnvil, buildCookfire, buildTent, buildSmithyShed, buildPillar, buildPlinth, buildStrongbox, buildDigSpot, buildGuardian, buildStump, buildRipples, type GuardianRig } from '../art/models/world';
import { buildLootShard, buildItemModel, SHARD_TINT, type LootShard, type ShardKind } from '../art/models/items';
import { NODES, PLAYER_BASE, SKILLS } from '../game/data/content';
import type { Game, GameEvent, Enemy, Telegraph } from '../game/sim/game';
import { coastDist, nearestPathDist, BEACH, SUN, SUN_LAYOUT } from '../game/world/island';
import { HCELL } from '../game/world/world';
import { buildTerrainMesh } from './terrainMesh';
import { bakeRig, bakeStatic, bakeFlat, mergeColoured } from './bake';
import { humanoidShadow, blobShadow } from './shadowProxy';
import { QualityGovernor } from './governor';
import { InstancedField, type FieldItem } from './instanced';
import { Particles } from './fx';

const HERO = 1.2; // characters drawn larger than life so they read on phones
/** Fine cloth/skin grain and a warm rim light so people stand out from the ground; coarser grain on props. */
const CHAR_SURFACE = { scale: 7, tone: 0.12, bump: 0.18, rim: 0.1 };
const PROP_SURFACE = { scale: 3, tone: 0.24, bump: 0.42 };

export const CRAB_SHELLS: Record<string, Partial<Record<PalKey, number>>> = {
  mire: { crabShell: 0x5e7a3a, crabDark: 0x3c5228, crabBelly: 0xb8bc8a, barnacle: 0x7a8a5a },
  ironshell: { crabShell: 0x6a6e74, crabDark: 0x44484e, crabBelly: 0xb0a890, barnacle: 0x9a9a90 },
};
interface TreeLook { kind: 'pine' | 'broad'; scale: number; squash?: number; colours?: Partial<Record<PalKey, number>>; glow?: Partial<Record<PalKey, number>> }
export const TREE_LOOK: Record<string, TreeLook> = {
  tree_pine: { kind: 'pine', scale: 1.05 },
  tree_oak: { kind: 'broad', scale: 1.25 },
  tree_willow: { kind: 'broad', scale: 1.3, squash: 0.8, colours: { leaf: 0x7f9a48, leafLight: 0xa2b85e, trunk: 0x6a5a3a } },
  tree_amber: { kind: 'broad', scale: 1.4, colours: { leaf: 0xc0622a, leafLight: 0xe89a3e, trunk: 0x5a3a28 } },
  tree_yew: { kind: 'pine', scale: 1.5, colours: { pine: 0x203c2c, pineLight: 0x2c5038, trunk: 0x4a3a2a } },
  tree_star: { kind: 'pine', scale: 1.55, colours: { pine: 0x3a3f7a, pineLight: 0x5a6ab8, trunk: 0x2e2a40 }, glow: { pineLight: 0.35 } },
  tree_cedar: { kind: 'pine', scale: 2.1, colours: { pine: 0x264630, pineLight: 0x33583c, trunk: 0x8a3a24 } },
};
export const ORE_TINT: Record<string, [number, number]> = {
  rock_copper: [PAL.copper, 0.12], rock_tin: [0xd6d9d4, 0.12], rock_iron: [0xa5543a, 0.12], rock_coal: [0x202022, 0], rock_gold: [0xe3c25e, 0.25],
  rock_storm: [0x8fc0e8, 0.35], rock_abyss: [0x3f8f6e, 0.3], rock_tide: [0x3fd8d0, 0.6],
};

interface RigView { kind: 'human'; rig: HumanoidRig; mat: THREE.MeshStandardMaterial }
interface CrabView { kind: 'crab'; rig: CrabRig; mat: THREE.MeshStandardMaterial }
interface GuardView { kind: 'guardian'; rig: GuardianRig; mat: THREE.MeshStandardMaterial }
interface BoarView { kind: 'boar'; rig: BoarRig; mat: THREE.MeshStandardMaterial }
interface SpiderView { kind: 'spider'; rig: SpiderRig; mat: THREE.MeshStandardMaterial }
interface SnakeView { kind: 'snake'; rig: SnakeRig; mat: THREE.MeshStandardMaterial }
type EnemyView = (RigView | CrabView | GuardView | BoarView | SpiderView | SnakeView) & { root: THREE.Group; ring?: THREE.Mesh; swingT: number; seen: boolean; baseScale: number };

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
  private composer: EffectComposer;
  private rt: THREE.WebGLRenderTarget;
  private sun = new THREE.DirectionalLight(LOOK.sun.color, LOOK.sun.intensity);
  private sunDir = new THREE.Vector3();
  private water: ReturnType<typeof createWater> | null = null;
  private terrain!: ReturnType<typeof buildTerrainMesh>;
  /** everything that belongs to the loaded region (rebuilt when you travel) */
  private region3d = new THREE.Group();
  private hemi!: THREE.HemisphereLight;
  /** the lantern you carry underground */
  private lantern = new THREE.PointLight(0xffb070, 60, 26, 1.5);
  private fogK = { near: LOOK.fog.near, far: LOOK.fog.far };
  private cave = false;
  /** edited art for scenery and props (billboards) */
  private boards = new BillboardBatch();
  private bloom!: UnrealBloomPass;
  readonly particles = new Particles(500);
  private quality: 'auto' | 'max' | 'low' = 'auto';

  private player: HumanoidRig;
  /** one rig per weapon + off-hand pairing, built the first time it's worn */
  private playerRigs = new Map<string, HumanoidRig>();
  private playerRig(kind: WeaponKind, off: HeldKind = 'none'): HumanoidRig {
    const key = `${kind}|${off}`;
    let rig = this.playerRigs.get(key);
    if (rig) return rig;
    const held: HeldKind = HELD_OF[kind];
    rig = buildHumanoid({ ...PLAYER_LOOK, held });
    if (off !== 'none') addOffhand(rig, off);
    rig.root.scale.setScalar(HERO);
    bakeRig(rig.root, addSurfaceDetail(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.9 }), CHAR_SURFACE));
    humanoidShadow(rig);
    const art = artOverride('characters', 'player');
    if (art) spriteSwap(rig.root, art);
    rig.root.visible = false;
    this.scene.add(rig.root);
    this.playerRigs.set(key, rig);
    return rig;
  }
  private playerSwing = 0;
  /** your first mate ashore: built when they first come ashore, swapped when you change mates */
  private mateRig: { id: string; rig: HumanoidRig } | null = null;
  private mateSwing = 0;
  private updateMate(dt: number, t: number) {
    const g = this.game, m = g.mate, world = g.world;
    if (!m) { if (this.mateRig) this.mateRig.rig.root.visible = false; return; }
    if (!this.mateRig || this.mateRig.id !== m.id) {
      if (this.mateRig) this.scene.remove(this.mateRig.rig.root);
      const c = CREW_BY[m.id];
      const rig = buildHumanoid({ ...c.look, boots: 'leather', held: c.mate.held, beard: c.look.beard });
      rig.root.scale.setScalar(HERO);
      bakeRig(rig.root, addSurfaceDetail(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.9 }), CHAR_SURFACE));
      humanoidShadow(rig);
      this.scene.add(rig.root);
      this.mateRig = { id: m.id, rig };
    }
    const r = this.mateRig.rig;
    r.root.visible = true;
    r.root.position.set(m.x, world.standY(m.x, m.z), m.z);
    r.root.rotation.y = Math.PI / 2 - m.facing;
    r.body.rotation.set(0, 0, 0);
    this.mateSwing = Math.max(0, this.mateSwing - dt);
    if (this.mateSwing > 0) animateSwing(r, 1 - this.mateSwing / 0.35);
    else if (m.moving) animateWalk(r, t, 1.1);
    else animateIdle(r, t + 1.3);
  }
  private fireworks: { t: number; x: number; y: number; z: number; colour: number }[] = [];
  private ship: ShipRig;
  private npcs = new Map<string, HumanoidRig>();
  private houses: { b: BuildingDef; v: EnterableView; k: number }[] = [];
  private walkers: { rig: HumanoidRig; path: [number, number][]; cum: number[]; speed: number; off: number }[] = [];
  private enemyViews = new Map<number, EnemyView>();
  private nodeViews = new Map<string, { live: THREE.Object3D; dead?: THREE.Object3D; ripples?: THREE.Group; leap?: THREE.Object3D }>();
  private dropViews = new Map<number, LootShard>();
  private projViews = new Map<number, THREE.Mesh>();
  private teleViews = new Map<number, THREE.Group>();
  private flames: THREE.Mesh[] = [];
  private glows: THREE.MeshStandardMaterial[] = [];
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
  /** Credits / title backdrop: while set, the camera flies this pose instead of following the player. */
  cinematic: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private release: { pos: THREE.Vector3; look: THREE.Vector3; t: number; dur: number } | null = null;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  zoom = 1;
  private shake = 0;
  camDist = 30;
  /** pixels of the canvas covered at the bottom by UI (portrait sheet); the view is shifted so the player stays visible */
  coveredBottom = 0;
  private appliedShift = -1;
  private readonly pitch = THREE.MathUtils.degToRad(54);

  constructor(private canvas: HTMLCanvasElement, readonly game: Game) {
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
    // bloom only on what's genuinely bright (fires, magic, sun glints): threshold above lit surfaces
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(createGradePass(LOOK));

    // ambient light comes from a painted sky (image-based lighting): soft directional fill, sheen on metal and stone.
    // The hemisphere light stays as a weaker base so the overall brightness matches the old look.
    this.scene.environment = buildSkyEnvironment(this.renderer);
    this.scene.environmentIntensity = 0.28;
    const hemi = (this.hemi = new THREE.HemisphereLight(LOOK.hemi.sky, LOOK.hemi.ground, LOOK.hemi.intensity * 0.72));
    this.scene.add(hemi);
    this.lantern.visible = false;
    this.scene.add(this.lantern);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    const sc = this.sun.shadow.camera;
    sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 160;
    this.scene.add(this.sun, this.sun.target);
    const el = THREE.MathUtils.degToRad(LOOK.sun.elevationDeg), az = THREE.MathUtils.degToRad(LOOK.sun.azimuthDeg);
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));

    this.scene.add(this.region3d);
    this.loadRegion();

    // one rig per weapon family, built the first time it's wielded, so the right weapon is in hand
    this.player = this.playerRig('cutlass');

    this.ship = buildSloop();
    { const art = artOverride('props', 'sloop'); if (art) spriteSwap(this.ship.root, art); }
    this.scene.add(this.ship.root);

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

  // ------------------------------------------------------------------ regions
  /** Throw away the last region's scene and build the one the game is in now (under the loading screen). */
  loadRegion() {
    const g = this.game, world = g.world;
    this.scene.remove(this.region3d);
    this.region3d.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.geometry) return;
      m.geometry.dispose();
      for (const mt of Array.isArray(m.material) ? m.material : [m.material]) mt?.dispose();
    });
    this.water?.uniforms.uHeight.value.dispose();
    this.region3d = new THREE.Group();
    this.scene.add(this.region3d);
    this.npcs.clear(); this.houses = []; this.walkers = []; this.enemyViews.clear(); this.nodeViews.clear();
    this.dropViews.clear(); this.projViews.clear(); this.teleViews.clear(); this.flames = []; this.glows = [];
    this.grass = null; this.grassTime = [];
    this.scenery = new InstancedField(addSurfaceDetail(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.9 }), PROP_SURFACE));
    this.sceneryState.clear();
    this.cave = REGIONS[g.s.region].kind === 'cave';

    this.terrain = buildTerrainMesh(world, LOOK, this.cave);
    this.region3d.add(this.terrain.group);
    this.water = null;
    if (!this.cave) {
      // the sea runs past the region's edge (the horizon), the shallows read the terrain grid
      const size = world.half * 2 + 120;
      this.water = createWater(size, Math.round(size / 1.9), (x, z) => (world.inside(x, z) ? -world.ground(x, z) : 6), LOOK, { data: world.heights, side: world.HN + 1, cell: HCELL, half: world.half, ox: world.ox, oz: world.oz }, { x: world.cx, z: world.cz });
      this.water.uniforms.uSunDir.value.copy(this.sunDir);
      this.region3d.add(this.water.mesh);
    }
    this.boards = new BillboardBatch();
    this.buildStatic();
    this.buildNodes();
    this.boards.build();
    this.region3d.add(this.boards.group);
    for (const n of g.layout.npcs) {
      const rig = buildHumanoid(NPC_LOOKS[n.id]);
      rig.root.scale.setScalar(HERO);
      rig.root.position.set(n.x, world.standY(n.x, n.z), n.z);
      rig.root.rotation.y = Math.PI / 2 - n.facing;
      bakeRig(rig.root, addSurfaceDetail(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.9 }), CHAR_SURFACE));
      humanoidShadow(rig);
      const art = artOverride('characters', n.id);
      if (art) spriteSwap(rig.root, art);
      this.region3d.add(rig.root);
      this.npcs.set(n.id, rig);
    }
    // underground: no sky, a cold dim fill, your lantern and the torches
    const bg = this.cave ? 0x060608 : LOOK.fog.color;
    (this.scene.background as THREE.Color).set(bg);
    (this.scene.fog as THREE.Fog).color.set(bg);
    this.water?.uniforms.uFogColor.value.set(bg);
    this.hemi.color.set(this.cave ? 0x7d8aa8 : LOOK.hemi.sky);
    this.hemi.groundColor.set(this.cave ? 0x2a2420 : LOOK.hemi.ground);
    this.hemi.intensity = LOOK.hemi.intensity * (this.cave ? 0.62 : 0.72);
    this.sun.intensity = LOOK.sun.intensity * (this.cave ? 0.28 : 1);
    this.sun.color.set(this.cave ? 0x9db4e0 : LOOK.sun.color);
    this.scene.environmentIntensity = this.cave ? 0.06 : 0.28;
    this.lantern.visible = this.cave;
    this.fogK = this.cave ? { near: 0.8, far: 1.6 } : { near: LOOK.fog.near, far: LOOK.fog.far };
    this.renderer.shadowMap.needsUpdate = true;
    this.snapCamera();
  }

  /** Compile every shader the new region needs while the loading screen is still up (no hitch after it lifts). */
  warm() { this.renderer.compile(this.scene, this.camera); }

  // ------------------------------------------------------------------ static scenery
  private buildStatic() {
    const L = this.game.layout, w = this.game.world;
    const root = new THREE.Group();
    // a prop you've redrawn (art/props) goes in as a billboard instead of its model
    let propKey: string | null = null, propS = 1;
    const place = (o: THREE.Object3D, x: number, z: number, rot = 0, y?: number) => {
      const art = propKey ? artOverride('props', propKey) : undefined;
      if (art) { this.boards.add(art, x, y ?? w.ground(x, z), z, propS); return o; }
      o.position.set(x, y ?? w.ground(x, z), z);
      o.rotation.y = rot;
      root.add(o);
      return o;
    };
    const d = L.dock;
    if (d) root.add(buildDock(d.x, d.zStart, d.len, d.headWidth, d.deckY, 21).group);
    for (const b of L.buildings) {
      const y = w.ground(b.x, b.z);
      propKey = b.kind;
      if (b.kind === 'tent') place(buildTent(b.seed), b.x, b.z, b.rot, y);
      else if (b.kind === 'smithy') place(buildSmithyShed(), b.x, b.z, b.rot, y);
    }
    propKey = 'stall';
    for (const st of L.stalls) place(buildStall(st.colour, Math.round(st.x * 7 + st.z)), st.x, st.z, -st.rot);
    for (const st of L.stations) {
      propKey = st.id === 'fire' ? 'cookfire' : st.id === 'vent' ? 'ventforge' : st.id;
      if (st.id === 'furnace') { const f = buildFurnace(); f.group.traverse((o) => { if ((o as THREE.Mesh).material === f.glow) o.userData.glow = true; }); place(f.group, st.x, st.z, 0); }
      else if (st.id === 'anvil') place(buildAnvil(), st.x, st.z, 0.3);
      else if (st.id === 'bench') place(buildBench(), st.x, st.z, 0);
      else if (st.id === 'vent') { const f = buildVentForge(); f.group.traverse((o) => { if ((o as THREE.Mesh).material === f.glow) o.userData.glow = true; }); place(f.group, st.x, st.z, 0); }
      else { const f = buildCookfire(); f.flames.forEach((m) => (m.userData.flame = true)); place(f.group, st.x, st.z, 0); }
    }
    for (const p of L.props) {
      propKey = p.kind === 'campfire' ? 'cookfire' : p.kind === 'crystal' && this.game.s.region === 'ember_deep' ? 'crystal_ember' : p.kind;
      propS = p.kind === 'web' || p.kind === 'crystal' || p.kind === 'stalagmite' ? p.s : 1;
      switch (p.kind) {
        case 'pine': { const t = buildPine(p.seed, p.s); place(t, p.x, p.z, t.rotation.y, w.ground(p.x, p.z) - 0.05); break; }
        case 'broadleaf': { const t = buildBroadleaf(p.seed); place(t, p.x, p.z, t.rotation.y, w.ground(p.x, p.z) - 0.05); break; }
        case 'rock': { const r = buildRock(p.seed, p.s, p.seed % 2 ? 'stone' : 'stoneDark'); r.position.set(p.x, w.ground(p.x, p.z) + p.s * 0.2, p.z); root.add(r); break; }
        case 'crate': place(buildCrate(p.seed, 0.7), p.x, p.z, p.rot); break;
        case 'barrel': place(buildBarrel(0.32, 0.75), p.x, p.z, p.rot); break;
        case 'lantern': place(buildLanternPost().group, p.x, p.z, p.rot); break;
        case 'pillar': place(buildPillar(p.seed, p.s), p.x, p.z, p.rot); break;
        case 'campfire': { const f = buildCookfire(); f.flames.forEach((m) => (m.userData.flame = true)); place(f.group, p.x, p.z); break; }
        case 'netrack': place(buildNetRack(p.seed), p.x, p.z, p.rot); break;
        case 'leviathan': place(buildLeviathan(), p.x, p.z, p.rot); break;
        case 'crater': place(buildCrater(), p.x, p.z, p.rot); break;
        case 'rowboat': place(buildRowboat(p.seed), p.x, p.z, p.rot, w.ground(p.x, p.z) - 0.12); break;
        case 'signpost': place(buildSignpost(p.seed, p.aux ?? []), p.x, p.z, 0); break;
        case 'fence': place(buildFence(p.seed, p.aux?.[0] ?? 4), p.x, p.z, p.rot); break;
        case 'well': place(buildWell(), p.x, p.z, p.rot); break;
        case 'driftwood': place(buildDriftwood(p.seed), p.x, p.z, p.rot); break;
        case 'shells': place(buildShells(p.seed), p.x, p.z, p.rot); break;
        case 'pots': place(buildPotStack(p.seed), p.x, p.z, p.rot); break;
        case 'cannon': place(buildCannon(), p.x, p.z, p.rot); break;
        case 'wreck': place(buildWreckRibs(p.seed), p.x, p.z, p.rot, w.ground(p.x, p.z) - 0.15); break;
        case 'woodpile': place(buildWoodpile(p.seed), p.x, p.z, p.rot); break;
        case 'flowers': place(buildFlowers(p.seed), p.x, p.z, p.rot); break;
        case 'cavemouth': place(buildCaveMouth(p.seed), p.x, p.z, -p.rot); break;
        case 'rope': place(buildRope(), p.x, p.z, 0); break;
        case 'web': { const o = place(buildWeb(p.seed), p.x, p.z, p.rot); o.scale.setScalar(p.s); break; }
        case 'crystal': { const o = place(buildCrystal(p.seed, this.game.s.region === 'ember_deep' ? 0x8a6af0 : 0x6ad8e8), p.x, p.z, p.rot); o.scale.setScalar(p.s); break; }
        case 'torch': place(buildCaveTorch(), p.x, p.z, 0); break;
        case 'stalagmite': { const o = place(buildStalagmite(p.seed), p.x, p.z, p.rot); o.scale.setScalar(p.s); break; }
        case 'lava': place(buildLava(p.s, p.seed), p.x, p.z, 0); break;
      }
    }
    propS = 1;
    for (const a of L.arenas) { propKey = a.boss === 'guardian' ? 'plinth' : 'gong'; place(a.boss === 'guardian' ? buildPlinth() : buildGong(), a.altar.x, a.altar.z, 0); }
    propKey = 'strongbox';
    for (const b of L.banks) if (!b.booth) place(buildStrongbox(), b.x, b.z, 0);
    propKey = null;
    for (const r of L.reefs) {
      const m = buildRock(Math.round(r.x * 31 + r.z), r.r, 'stoneDark');
      m.position.set(r.x, 0.05, r.z);
      root.add(m);
    }
    const baked = bakeStatic(root);
    // flames and the furnace mouth are cloned out of the bake: find them by tag
    baked.traverse((o) => {
      if (o.userData.flame) this.flames.push(o as THREE.Mesh);
      if (o.userData.glow) this.glows.push((o as THREE.Mesh).material as THREE.MeshStandardMaterial);
    });
    this.region3d.add(baked);
    this.buildTown();
    this.buildGrass();
  }

  /** Enterable buildings stay live (not baked into the static chunks) so the roof can lift off. */
  private buildTown() {
    const L = this.game.layout, w = this.game.world;
    const material = addSurfaceDetail(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.92, metalness: 0 }), { scale: 3, tone: 0.24, bump: 0.4 });
    for (const b of L.town) {
      const v = buildEnterable(b);
      for (const part of [v.walls, v.trim, v.roof, v.interior]) bakeFlat(part, material);
      // only the shell casts: the room is under the roof, and windows and signs are too small to matter
      for (const part of [v.trim, v.interior]) part.traverse((o) => { o.castShadow = false; });
      v.interior.visible = false; // shown only while you're inside
      v.group.position.set(b.x, w.ground(b.x, b.z), b.z);
      v.group.rotation.y = -b.rot;
      this.region3d.add(v.group);
      this.houses.push({ b, v, k: 0 });
    }
    for (const wd of L.wanderers) {
      const rig = buildHumanoid(TOWNS_LOOKS[wd.look] ?? TOWNS_LOOKS.towns_a);
      rig.root.scale.setScalar(HERO);
      bakeRig(rig.root, addSurfaceDetail(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.9 }), CHAR_SURFACE));
      humanoidShadow(rig);
      const art = artOverride('characters', wd.look);
      if (art) spriteSwap(rig.root, art);
      this.region3d.add(rig.root);
      const cum = [0];
      for (let i = 1; i < wd.path.length; i++) cum.push(cum[i - 1] + Math.hypot(wd.path[i][0] - wd.path[i - 1][0], wd.path[i][1] - wd.path[i - 1][1]));
      this.walkers.push({ rig, path: wd.path, cum, speed: 1.1 + (this.walkers.length % 3) * 0.15, off: this.walkers.length * 37 });
    }
  }

  /** Walk in and the roof lifts away and the walls drop to waist height, so you can see the room. */
  private syncTown(dt: number, t: number) {
    const p = this.game.p, world = this.game.world;
    for (const h of this.houses) {
      const want = !p.onShip && isInside(h.b, p.x, p.z) ? 1 : 0;
      h.k += (want - h.k) * Math.min(1, dt * 8);
      if (Math.abs(want - h.k) < 0.01) h.k = want;
      h.v.roof.visible = h.k < 0.5;
      h.v.roof.position.y = h.k * 3;
      h.v.walls.scale.y = 1 - h.k * (1 - 1.1 / (WALL_H * (h.b.storeys ?? 1))); // down to about waist height
      h.v.trim.visible = h.k < 0.05;
      h.v.interior.visible = h.k > 0;
    }
    for (const wk of this.walkers) {
      const total = wk.cum[wk.cum.length - 1];
      const s = (t * wk.speed + wk.off) % total;
      let i = 1;
      while (i < wk.cum.length - 1 && wk.cum[i] < s) i++;
      const a = wk.path[i - 1], b = wk.path[i], seg = wk.cum[i] - wk.cum[i - 1] || 1, f = (s - wk.cum[i - 1]) / seg;
      const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f;
      wk.rig.root.position.set(x, world.standY(x, z), z);
      const want = Math.atan2(b[1] - a[1], b[0] - a[0]), cur = Math.PI / 2 - wk.rig.root.rotation.y;
      const diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
      wk.rig.root.rotation.y = Math.PI / 2 - (cur + diff * Math.min(1, dt * 6));
      animateWalk(wk.rig, t * wk.speed * 0.9 + wk.off);
    }
  }

  private buildGrass() {
    const w = this.game.world, L = this.game.layout;
    if (this.cave) return;
    const rnd = mulberry32(99);
    // bucketed into 40 m cells so each clump is its own culled draw
    const CELL = 40, buckets = new Map<string, THREE.Vector3[]>();
    let made = 0;
    const sun = this.game.s.region === 'sunreach', cx = sun ? SUN.x : 0, cz = sun ? SUN.z : 0, span = sun ? 140 : 200, most = sun ? 4500 : 9000;
    for (let i = 0; i < 130000 && made < most; i++) {
      const x = cx + (rnd() - 0.5) * span, z = cz + (rnd() - 0.5) * span;
      if (coastDist(x, z) < BEACH || !w.walkable(x, z)) continue; // no grass on the beach
      const y = w.ground(x, z);
      if (y > 8) continue; // bare upper peak
      const p = nearestPathDist(x, z);
      if (p.d < p.width + 0.5) continue;
      if (L.arenas.some((a) => Math.hypot(x - a.x, z - a.z) < 8)) continue;
      if (Math.hypot(x - L.respawn.x, z - L.respawn.z) < 15 || Math.hypot(x - SUN_LAYOUT.port.x, z - SUN_LAYOUT.port.z) < 14) continue; // the quay squares
      if (this.game.layout.town.some((b) => { const [lx, lz] = toLocal(b, x, z); return Math.abs(lx) < b.w / 2 + 0.4 && Math.abs(lz) < b.d / 2 + 0.4; })) continue; // not through the floors
      if (this.game.layout.stalls.some((st) => Math.hypot(st.x - x, st.z - z) < 1.6)) continue;
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
    this.region3d.add(this.grass);
  }

  private buildNodes() {
    const w = this.game.world;
    const leapFish = new Map<string, THREE.Object3D>();
    this.buildScenery();
    for (const n of this.game.nodes) {
      if (this.scenery.has(n.uid) || this.boards.has(n.uid)) continue;
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
      } else if (n.def === 'rock_cinder' || n.def === 'rock_sky' || n.def === 'rock_levi') {
        live = n.def === 'rock_cinder' ? buildCinderVent(n.seed) : n.def === 'rock_sky' ? buildFallenStar(n.seed) : buildBones(n.seed);
        dead = buildRock(n.seed, 0.8, 'stoneDark');
        if (n.def === 'rock_levi') recolour(dead, { stoneDark: 0xb8ab90 });
      } else if (n.def === 'rock_ori') {
        const h = -w.ground(n.x, n.z) + 3.4; // from the seabed to well above the waterline
        live = buildSpire(n.seed, h);
        dead = buildSpire(n.seed, h, true);
      } else if (n.def === 'palm') {
        live = buildPalm(n.seed, true);
        dead = buildPalm(n.seed, false);
      } else if (n.def === 'salt_pan') {
        live = buildSaltPan(n.seed, true);
        dead = buildSaltPan(n.seed, false);
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
        // the spot's own fish leaps now and then, so you can see what's biting before you cast
        const fish = buildItemModel(def.item);
        fish.scale.setScalar(def.fromShip ? 2.4 : 1.4);
        fish.visible = false;
        this.region3d.add(fish);
        leapFish.set(n.uid, fish);
        if (def.fromShip) live.scale.setScalar(2.2);
      }
      const y = def.skill === 'fishing' ? 0.06 : n.def === 'rock_ori' ? w.ground(n.x, n.z) - 0.05 : w.ground(n.x, n.z) - (def.skill ? 0.05 : 0.02);
      live.position.set(n.x, y, n.z);
      this.region3d.add(live);
      if (dead) { dead.position.set(n.x, y, n.z); dead.visible = false; this.region3d.add(dead); }
      if (live !== ripples) bakeRig(live, addSurfaceDetail(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.92 }), PROP_SURFACE));
      const art = live !== ripples ? artOverride('resources', n.def) : undefined;
      if (art) spriteSwap(live, art);
      this.nodeViews.set(n.uid, { live, dead, ripples, leap: leapFish.get(n.uid) });
    }
  }

  /** The island's ordinary trees, boulders, bushes and kelp: usable, drawn instanced (stumps, rubble, picked bushes). */
  private scenery = new InstancedField(addSurfaceDetail(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.9 }), PROP_SURFACE));
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
    // trees, rocks and bushes you've redrawn (art/resources) stand as billboards instead
    for (const [def, list] of [...by]) {
      const art = artOverride('resources', def);
      if (!art) continue;
      for (const it of list) this.boards.add(art, it.x, it.y, it.z, it.s, it.uid);
      by.delete(def);
    }
    const geo = (o: THREE.Object3D) => mergeColoured(o);
    const V = [11, 23]; // two shape variants per kind (with per-instance rotation and scale) keep draw calls low
    if (by.has('tree_pine')) this.scenery.add(by.get('tree_pine')!, V.map((k) => geo(buildPine(k, 1))), { alt: geo(buildStump(5)) });
    if (by.has('tree_oak')) this.scenery.add(by.get('tree_oak')!, V.map((k) => geo(buildBroadleaf(k))), { alt: geo(buildStump(9)) });
    if (by.has('rock_boulder')) this.scenery.add(by.get('rock_boulder')!, V.map((k, i) => geo(buildRock(k, 1, i % 2 ? 'stoneDark' : 'stone'))), { alt: geo(buildRock(41, 1, 'stoneDark')), altScale: [1.15, 0.35, 1.15] });
    if (by.has('bush_berry')) this.scenery.add(by.get('bush_berry')!, V.map((k) => geo(buildBush(k, true))), { alt: geo(buildBush(11, false)), castShadow: false });
    if (by.has('kelp_bed')) this.scenery.add(by.get('kelp_bed')!, [geo(buildKelp(3)), geo(buildKelp(8))], { castShadow: false });
    this.region3d.add(this.scenery.group);
  }

  // ------------------------------------------------------------------ dynamic views
  private makeEnemyView(e: Enemy): EnemyView {
    const material = addSurfaceDetail(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0 }), CHAR_SURFACE);
    let v: EnemyView;
    if (e.def.model === 'crab') {
      const rig = buildCrab(e.id);
      if (e.def.look && CRAB_SHELLS[e.def.look]) recolour(rig.root, CRAB_SHELLS[e.def.look]!);
      rig.root.scale.setScalar(e.def.scale * (e.elite ? 1.2 : 1));
      bakeRig(rig.root, material);
      blobShadow(rig.root, rig.body);
      v = { kind: 'crab', rig, mat: material, root: rig.root, swingT: 0, seen: true, baseScale: rig.root.scale.x };
    } else if (e.def.model === 'boar') {
      const rig = buildBoar(e.id);
      rig.root.scale.setScalar(e.def.scale * (e.elite ? 1.2 : 1));
      bakeRig(rig.root, material);
      blobShadow(rig.root, rig.body);
      v = { kind: 'boar', rig, mat: material, root: rig.root, swingT: 0, seen: true, baseScale: rig.root.scale.x };
    } else if (e.def.model === 'spider') {
      const rig = buildSpider(e.def.look, e.id);
      rig.root.scale.setScalar(e.def.scale * (e.elite ? 1.2 : 1));
      bakeRig(rig.root, material);
      blobShadow(rig.root, rig.body);
      v = { kind: 'spider', rig, mat: material, root: rig.root, swingT: 0, seen: true, baseScale: rig.root.scale.x };
    } else if (e.def.model === 'snake') {
      const rig = buildSnake(e.def.look, e.id);
      rig.root.scale.setScalar(e.def.scale * (e.elite ? 1.2 : 1));
      bakeRig(rig.root, material);
      if (!e.def.boss) blobShadow(rig.root, rig.segs[2]);
      v = { kind: 'snake', rig, mat: material, root: rig.root, swingT: 0, seen: true, baseScale: rig.root.scale.x };
    } else if (e.def.model === 'guardian') {
      const rig = buildGuardian();
      if (!e.def.boss) { recolour(rig.root, { stoneDark: 0x4e4c54, stone: 0x77737c }); rig.root.scale.setScalar(e.def.scale); }
      bakeRig(rig.root, material); // one boss on screen: it keeps its full shadow
      v = { kind: 'guardian', rig, mat: material, root: rig.root, swingT: 0, seen: true, baseScale: rig.root.scale.x };
    } else {
      const look = HUMAN_LOOKS[e.def.look ?? e.def.model] ?? BRIGAND_LOOK;
      const rig = buildHumanoid(e.def.model === 'gunner' ? { ...look, held: 'musket' } : look);
      rig.root.scale.setScalar(e.def.scale * (e.elite ? 1.15 : 1));
      bakeRig(rig.root, material);
      humanoidShadow(rig);
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
    const art = artOverride('creatures', e.def.id);
    if (art) spriteSwap(v.root, art);
    this.region3d.add(v.root);
    return v;
  }

  private disposeObject(o: THREE.Object3D) {
    o.removeFromParent();
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
      } else if (v.kind === 'boar') animateBoar(v.rig, t + e.id, e.moving, e.state === 'chase' || e.state === 'windup');
      else if (v.kind === 'spider') animateSpider(v.rig, t + e.id, e.moving, e.state === 'windup' || v.swingT > 0);
      else if (v.kind === 'snake') {
        animateSnake(v.rig, t + e.id, e.moving, e.state === 'windup' || v.swingT > 0);
        if (e.state === 'rise') v.root.position.y = y - 2.5 * Math.max(0, e.t / 2.2); // the Sunscale coils up out of the flagstones
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
        this.region3d.add(v.group);
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
        if (p.kind === 'arrow') {
          // a shaft with a pale fletching, pointing where it flies
          m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 5).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8a6440 }));
          const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5).rotateZ(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8dde0 }));
          tip.position.x = 0.4;
          const fl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.01), new THREE.MeshBasicMaterial({ color: 0xf0ead8 }));
          fl.position.x = -0.3;
          m.add(tip, fl);
          m.rotation.y = -Math.atan2(p.vz, p.vx);
        } else m = new THREE.Mesh(new THREE.SphereGeometry(p.kind === 'magic' ? 0.22 : p.from === 'player' ? 0.12 : 0.12, 6, 4), new THREE.MeshBasicMaterial({ color: p.kind === 'magic' ? 0x7ff0e6 : p.from === 'player' ? 0xffe08a : 0xff6a4a }));
        this.region3d.add(m);
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
    this.region3d.add(g);
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
      case 'region': this.loadRegion(); break;
      case 'teleport': {
        // a column of spray where you left and where you land, and the camera cuts to you
        for (const [x, z] of [[e.fromX, e.fromZ], [e.x, e.z]]) this.particles.burst(x, g.world.standY(x, z) + 0.4, z, 36, 0x9fe8f0, { speed: 3, up: 7, size: 0.13, life: 0.8, grav: 4, spread: 0.6 });
        this.snapCamera();
        break;
      }
      case 'keyTurn': {
        // a brass keyhole flares on the foe, then the power's colour bursts out of it
        const col = ({ lesson: 0xe9e3d0, root: 0x6f9a4a, shatter: 0xc9a050, hook: 0x4fa7c2, disarm: 0xd2d5d2, mark: 0xe05a3c, undertow: 0x59d0c4, drain: 0xa8203a, becalm: 0x9fc8e8, blink: 0xb8c6ff, pickpocket: 0xe3c25e, rust: 0xa5543a, spoil: 0x6a8a2a, knockdown: 0xfff4d6, ward: 0x86b6dc, fuse: 0xf2a43a, chain: 0xb8c6ff, toll: 0xe9e3d0, steal: 0xee8a4e, turncoat: 0xc04a2c, bite: 0xefe3c4 } as Record<string, number>)[e.power] ?? 0xd9b25a;
        const y = g.world.standY(e.x, e.z) + 1.0;
        this.particles.burst(e.x, y, e.z, 10, 0xd9b25a, { speed: 1.5, up: 0.5, size: 0.14, life: 0.45, grav: 0 });
        this.particles.burst(e.x, y, e.z, 30, col, { speed: 6, up: 1.5, size: 0.11, life: 0.6, grav: 1, spread: 0.7 });
        this.shake = Math.max(this.shake, 0.12);
        break;
      }
      case 'mateAttack': {
        if (e.style === 'melee') { this.mateSwing = 0.35; break; }
        // a shot or a bolt of tide: a quick trail from your mate to the foe
        const col = e.style === 'magic' ? 0x59d0c4 : 0xe9e3d0, y0 = g.world.standY(e.x, e.z) + 1.2, y1 = g.world.standY(e.tx, e.tz) + 0.8;
        for (let k = 1; k <= 8; k++) { const f = k / 8; this.particles.burst(e.x + (e.tx - e.x) * f, y0 + (y1 - y0) * f, e.z + (e.tz - e.z) * f, 1, col, { speed: 0.2, up: 0, size: 0.08, life: 0.18 + f * 0.1, grav: 0 }); }
        this.particles.burst(e.tx, y1, e.tz, 8, col, { speed: 2.5, up: 1, size: 0.08, life: 0.3, grav: 1 });
        if (e.style === 'ranged') this.mateSwing = 0.2;
        break;
      }
      case 'hunters': this.shake = Math.max(this.shake, 0.15); break;
      case 'keyFound': { const p = g.p; this.particles.burst(p.x, g.world.standY(p.x, p.z) + 1.4, p.z, 40, 0xd9b25a, { speed: 3, up: 4, size: 0.12, life: 1.0, grav: 2 }); break; }
      case 'alchemy': { const p = g.p; this.particles.burst(p.x, g.world.standY(p.x, p.z) + 1.2, p.z, 16, 0xf2cf5b, { speed: 2, up: 3, size: 0.09, life: 0.6, grav: 3 }); break; }
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
        // RuneScape's fireworks: gold sparks spray up from you, then rockets burst overhead in the skill's colour
        const p = this.game.p, y = g.world.standY(p.x, p.z), col = parseInt((SKILLS.find((s) => s.id === e.skill)?.colour ?? '#f2cf5b').slice(1), 16);
        this.particles.burst(p.x, y + 1.2, p.z, 40, 0xf2cf5b, { speed: 3, up: 6, size: 0.14, life: 1.1, grav: 6 });
        for (let k = 0; k < 5; k++) this.fireworks.push({ t: 0.25 + k * 0.22, x: p.x + Math.cos(k * 2.4) * 1.6, y: y + 4.2 + (k % 2) * 1.1, z: p.z + Math.sin(k * 2.4) * 1.6, colour: k % 2 ? 0xfff2c0 : col });
        this.shake = Math.max(this.shake, 0.12);
        break;
      }
      case 'explode': this.particles.burst(e.x, g.world.standY(e.x, e.z) + 0.3, e.z, 30, 0xb8a888, { speed: e.r * 2.5, up: 3, size: 0.2, life: 0.6 }); this.shake = Math.max(this.shake, 0.35); break;
      case 'boss': if (e.state === 'rise' || e.state === 'summon') this.shake = 0.6; break;
      case 'craftFx': {
        const st = g.layout.stations.find((s) => s.id === e.station);
        if (!st) break;
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
  /** Auto graphics steps, best first: render resolution, then bloom and surface detail, then shadow detail and how
   * often shadows are redrawn, then grass. None of these recompile shaders, so a step never hitches; only Battery
   * saver (the last entry, never chosen by Auto) turns shadows off. */
  static readonly TIERS = [
    { pr: 2, bloom: true, detail: true, shadow: 2048, every: 1, msaa: 4, grass: true },
    { pr: 1.5, bloom: true, detail: true, shadow: 2048, every: 1, msaa: 4, grass: true },
    { pr: 1.25, bloom: false, detail: true, shadow: 2048, every: 1, msaa: 0, grass: true },
    { pr: 1, bloom: false, detail: false, shadow: 1024, every: 2, msaa: 0, grass: true },
    { pr: 1, bloom: false, detail: false, shadow: 1024, every: 3, msaa: 0, grass: false },
    { pr: 1.25, bloom: false, detail: false, shadow: 0, every: 1, msaa: 0, grass: false }, // Battery saver
  ];
  readonly governor = new QualityGovernor(GameRenderer.TIERS.length - 2);
  private shadowEvery = 1;
  private frameNo = 0;
  private tier = -1;
  private msaa = 4;
  private grassOn = true;
  private lastT = 0;

  setQuality(q: 'auto' | 'max' | 'low') {
    this.quality = q;
    this.applyTier(q === 'low' ? GameRenderer.TIERS.length - 1 : q === 'max' ? 0 : this.governor.tier);
  }

  /** The tier being drawn (0 = best) and the measured frame rate, for the settings readout. */
  get perf() { return { tier: this.tier, fps: this.governor.fps, pr: this.renderer.getPixelRatio() }; }

  private applyTier(t: number) {
    if (t === this.tier) return;
    const T = GameRenderer.TIERS[t];
    this.tier = t;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, T.pr));
    this.bloom.enabled = T.bloom;
    surfaceUniforms.uDetail.value = T.detail ? 1 : 0;
    this.msaa = T.msaa;
    this.shadowEvery = T.every;
    this.renderer.shadowMap.autoUpdate = T.every === 1;
    this.grassOn = T.grass;
    if (this.grass) this.grass.visible = T.grass;
    if (T.shadow && T.shadow !== this.sun.shadow.mapSize.x) {
      this.sun.shadow.mapSize.set(T.shadow, T.shadow);
      this.sun.shadow.map?.dispose();
      (this.sun.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
    const shadows = T.shadow > 0;
    if (shadows !== this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = shadows;
      this.sun.castShadow = shadows;
      this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => (x.needsUpdate = true)); });
    }
    this.resize();
  }

  private sized = '';
  /** Phones change the canvas size after rotating (and when browser bars slide) without a reliable resize event:
   * a stale buffer stretches the picture and puts taps in the wrong place. Checked every frame, costs nothing. */
  private keepSized() {
    const key = `${this.canvas.clientWidth}x${this.canvas.clientHeight}@${window.devicePixelRatio}`;
    if (key !== this.sized) this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.sized = `${this.canvas.clientWidth}x${this.canvas.clientHeight}@${window.devicePixelRatio}`;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.rt.samples = this.msaa;
    this.camera.aspect = w / h;
    this.appliedShift = -1;
    this.camera.updateProjectionMatrix();
  }

  frame(dt: number, t: number) {
    // real frame spacing (the game's dt is capped for the simulation, which would hide a slow phone)
    const real = this.lastT ? t - this.lastT : 0;
    this.lastT = t;
    if (this.quality === 'auto' && real > 0) this.applyTier(this.governor.sample(real));
    if (this.shadowEvery > 1 && ++this.frameNo % this.shadowEvery === 0) this.renderer.shadowMap.needsUpdate = true;
    const g = this.game;
    const p = g.p;
    const world = g.world;

    // ship
    const sh = g.ship;
    this.ship.root.visible = g.shipHere;
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

    this.updateMate(dt, t);
    // player
    const want = this.playerRig(g.stats.kind, offHeld(g.p.equip.offhand?.id));
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
      if (this.boards.has(n.uid)) {
        if (this.sceneryState.get(n.uid) !== depleted) { this.sceneryState.set(n.uid, depleted); this.boards.setVisible(n.uid, !depleted); }
        continue;
      }
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
        if (v.leap) {
          // a leap every ~6 s, staggered per spot: up out of the ripples in an arc and back in
          const seed = (n.seed * 0.37) % 1, cyc = (t / 6 + seed) % 1, k = cyc / 0.15;
          v.leap.visible = !depleted && k < 1;
          if (k < 1) {
            const s = v.leap.scale.x, heading = seed * Math.PI * 2;
            v.leap.position.set(n.x + Math.cos(heading) * (k - 0.5) * 1.6 * s * 0.5, 0.05 + Math.sin(Math.PI * k) * 0.55 * s, n.z + Math.sin(heading) * (k - 0.5) * 1.6 * s * 0.5);
            v.leap.rotation.set(0, -heading, (0.5 - k) * 2.2);
          }
        }
      } else {
        v.live.visible = !depleted;
        if (v.dead) v.dead.visible = depleted;
      }
    }

    this.syncTown(dt, t);
    this.syncEnemies(t, dt);
    this.syncDrops(t);
    this.syncProjectiles();
    this.syncTelegraphs();

    for (const f of this.flames) { f.scale.y = 0.8 + Math.sin(t * 12 + f.position.x * 10) * 0.25; f.scale.x = 1 + Math.sin(t * 9 + f.position.z * 7) * 0.12; }
    for (const gl of this.glows) gl.emissiveIntensity = 2 + Math.sin(t * 6) * 0.4;
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
    for (const f of this.fireworks) {
      f.t -= dt;
      if (f.t <= 0) { this.particles.burst(f.x, f.y, f.z, 34, f.colour, { speed: 5, up: 1.5, size: 0.12, life: 1.0, grav: 3, spread: 1 }); this.particles.burst(f.x, f.y, f.z, 8, 0xffffff, { speed: 2, up: 1, size: 0.08, life: 0.5, grav: 1 }); }
    }
    this.fireworks = this.fireworks.filter((f) => f.t > 0);
    this.particles.update(dt);
    this.terrain.uniforms.uTime.value = t;
    for (const u of this.grassTime) u.value = t;
    if (this.cave) this.lantern.position.set(p.x, world.standY(p.x, p.z) + 2.6, p.z + 0.6);
    this.water && (this.water.uniforms.uTime.value = t);
    this.updateCamera(dt);
    this.keepSized();
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
    // zooming in also lowers the camera (RuneScape-style), so close up you see faces, not hat brims
    const pitch = this.pitch - THREE.MathUtils.degToRad(20) * THREE.MathUtils.clamp((1 - this.zoom) / (1 - 0.42), 0, 1);
    const pos = this.camPos.set(c.x + sx, c.y + Math.sin(pitch) * this.camDist, c.z + sz + Math.cos(pitch) * this.camDist);
    const look = this.camLook.set(c.x + sx, c.y, c.z + sz);
    if (this.cinematic) {
      pos.copy(this.cinematic.pos);
      look.copy(this.cinematic.look);
      pos.y = Math.max(pos.y, g.world.standY(pos.x, pos.z) + 3, 2); // never fly through a hill
    } else if (this.release) {
      // ease from the last cinematic pose down onto the player
      const r = this.release;
      r.t += dt;
      const k = THREE.MathUtils.smootherstep(r.t / r.dur, 0, 1);
      pos.lerpVectors(r.pos, pos, k);
      look.lerpVectors(r.look, look, k);
      if (r.t >= r.dur) this.release = null;
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
    this.sun.position.copy(look).addScaledVector(this.sunDir, 70);
    this.sun.target.position.copy(look);
    // aerial shots: cap the view distance and drop the grass (sub-pixel from up there) to keep the frame cost near gameplay
    const aerial = !!this.cinematic || !!this.release;
    const dist = aerial ? Math.min(pos.distanceTo(look), 62) : pos.distanceTo(look);
    if (this.grass) this.grass.visible = !aerial && this.grassOn;
    const fog = this.scene.fog as THREE.Fog;
    // a tall phone screen sees much further up the island at the top edge: push the haze back to match
    const tall = THREE.MathUtils.clamp((1 - this.camera.aspect) / 0.55, 0, 1);
    fog.near = dist * this.fogK.near * (1 + 0.6 * tall);
    fog.far = dist * this.fogK.far * (1 + 0.4 * tall);
    // nothing past full fog is visible, so let the frustum cull it
    const far = Math.ceil(fog.far + 15);
    if (this.camera.far !== far) { this.camera.far = far; this.camera.updateProjectionMatrix(); }
    if (this.water) { this.water.uniforms.uFogNear.value = fog.near; this.water.uniforms.uFogFar.value = fog.far; }
  }

  snapCamera() { this.release = null; this.updateCamera(0); }

  /** Hand the camera back to the player, flying down from the cinematic pose over `dur` seconds. */
  releaseCinematic(dur: number) {
    if (!this.cinematic) return;
    this.release = { pos: this.cinematic.pos.clone(), look: this.cinematic.look.clone(), t: 0, dur };
    this.cinematic = null;
  }

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

/** A painted sky (zenith, horizon haze, warm sun side, earthy ground bounce) prefiltered for image-based lighting. */
function buildSkyEnvironment(r: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uSun: { value: new THREE.Vector3(-0.42, 0.62, 0.46).normalize() } },
    vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uSun; varying vec3 vD;
      void main() {
        float y = vD.y;
        vec3 zenith = vec3(0.32, 0.55, 0.85), horizon = vec3(0.86, 0.92, 0.92), ground = vec3(0.36, 0.38, 0.26);
        vec3 c = y > 0.0 ? mix(horizon, zenith, pow(y, 0.6)) : mix(horizon * 0.8, ground, pow(-y, 0.5));
        float s = max(dot(vD, uSun), 0.0);
        c += vec3(1.0, 0.86, 0.62) * (pow(s, 8.0) * 0.6 + pow(s, 200.0) * 6.0);
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(r);
  const tex = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  return tex;
}
