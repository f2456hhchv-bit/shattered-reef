// Art inventory: renders every item, creature, character, resource and prop with the game's own model code, for the
// asset catalogue page. Runs in the browser (served by Vite): node scripts/artsheet.cjs <out.json>
import * as THREE from 'three';
import { ITEMS } from '../src/game/data/items';
import { ENEMIES, NODES, LOOT } from '../src/game/data/content';
import { NPCS } from '../src/game/data/quests';
import { TOWN } from '../src/game/world/island';
import { recolour, PAL } from '../src/art/materials';
import { NPC_LOOKS, TOWNS_LOOKS, PLAYER_LOOK, HUMAN_LOOKS, BRIGAND_LOOK } from '../src/art/cast';
import { buildHumanoid } from '../src/art/models/character';
import { buildCrab } from '../src/art/models/crab';
import { buildBoar, buildSpider, buildSnake } from '../src/art/models/beasts';
import { buildGuardian, buildFurnace, buildAnvil, buildCookfire, buildBench, buildStrongbox, buildPlinth, buildPillar, buildTent, buildSmithyShed, buildStump, buildDigSpot, buildRipples } from '../src/art/models/world';
import { buildPine, buildBroadleaf, buildRock, buildOreRock, buildCrate, buildLanternPost, buildPalm, buildBush, buildKelp, buildBuoy } from '../src/art/models/props';
import { buildCinderVent, buildFallenStar, buildBones, buildSpire, buildSaltPan, buildVentForge, buildLeviathan, buildCrater } from '../src/art/models/highnodes';
import { buildNetRack, buildRowboat, buildSignpost, buildFence, buildWell, buildDriftwood, buildShells, buildPotStack, buildCannon, buildWreckRibs, buildWoodpile, buildFlowers } from '../src/art/models/decor';
import { buildCaveMouth, buildRope, buildWeb, buildCrystal, buildCaveTorch, buildStalagmite, buildLava, buildGong } from '../src/art/models/cave';
import { buildSloop, buildBarrel } from '../src/art/models/ship';
import { buildEnterable, buildStall } from '../src/art/models/buildings';
import { buildItemModel } from '../src/art/models/items';
import { CRAB_SHELLS, TREE_LOOK, ORE_TINT } from '../src/render/renderer';
import { mat } from '../src/art/materials';

const SIZE = 240;
let R: { r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera } | null = null;
function rig() {
  if (R) return R;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setClearColor(0, 0);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdff2ff, 0x5a4a36, 1.5));
  const key = new THREE.DirectionalLight(0xfff1d6, 2.6); key.position.set(-2, 3, 2.5);
  const rim = new THREE.DirectionalLight(0x9fe8f0, 1.2); rim.position.set(2.5, 1.5, -2);
  scene.add(key, rim);
  return (R = { r, scene, cam: new THREE.PerspectiveCamera(28, 1, 0.05, 500) });
}

/** One model, three-quarter view from the front-right and a little above, fitted to the frame. */
function shot(o: THREE.Object3D, opts: { pitch?: number; yaw?: number; fill?: number } = {}): string {
  const { r, scene, cam } = rig();
  scene.add(o);
  o.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o), sphere = box.getBoundingSphere(new THREE.Sphere());
  const pitch = opts.pitch ?? 0.42, yaw = opts.yaw ?? 0.55, dist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * (opts.fill ?? 1.02);
  cam.position.set(sphere.center.x + Math.sin(yaw) * Math.cos(pitch) * dist, sphere.center.y + Math.sin(pitch) * dist, sphere.center.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  cam.near = dist / 50; cam.far = dist * 4; cam.updateProjectionMatrix();
  cam.lookAt(sphere.center);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/webp', 0.86);
  scene.remove(o);
  o.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
  return url;
}

export interface Card { id: string; name: string; group: string; img: string; facts: [string, string][]; note?: string }

function itemGroup(id: string): string {
  const d = ITEMS[id];
  if (id === 'coins') return 'Coins & charms';
  if (d.quest) return 'Quest items';
  if (d.tool) return 'Tools';
  if (d.equip?.slot === 'weapon') return d.equip.style === 'magic' ? 'Staffs' : d.equip.style === 'ranged' ? 'Ranged weapons' : 'Melee weapons';
  if (d.equip?.slot === 'ammo') return 'Ammunition';
  if (d.equip?.slot === 'head' || d.equip?.slot === 'body') return 'Armour';
  if (d.equip?.slot === 'ring') return 'Rings';
  if (d.heal || id.startsWith('fish_') || id.includes('meat')) return 'Food & fish';
  if (id.startsWith('ore_') || id.startsWith('bar_')) return 'Ores & bars';
  if (id.startsWith('logs_')) return 'Logs';
  if (d.opens) return 'Finds';
  if (id === 'charm_tide') return 'Coins & charms';
  return 'Materials';
}

export async function renderAll() {
  const out: { items: Card[]; creatures: Card[]; characters: Card[]; resources: Card[]; props: Card[] } = { items: [], creatures: [], characters: [], resources: [], props: [] };
  const yieldUI = () => new Promise((res) => setTimeout(res, 0));

  // ---- items: the in-game icon (outlined, as in the pack) plus a large render
  for (const d of Object.values(ITEMS)) {
    const facts: [string, string][] = [['Value', `${d.value} coins`]];
    if (d.heal) facts.push(['Heals', String(d.heal)]);
    if (d.tool) facts.push(['Tool', `${d.tool.skill} ${d.tool.level}`]);
    if (d.equip) for (const [k, v] of Object.entries(d.equip.reqs)) facts.push(['Needs', `${k} ${v}`]);
    out.items.push({ id: d.id, name: d.name, group: itemGroup(d.id), img: shot(buildItemModel(d.id, 1), { pitch: 0.3, yaw: 0.35 }), facts, note: d.desc });
  }
  await yieldUI();

  // ---- creatures: every foe, built exactly as the renderer builds it
  for (const e of Object.values(ENEMIES)) {
    let o: THREE.Object3D;
    if (e.model === 'crab') { const c = buildCrab(3); if (e.look && CRAB_SHELLS[e.look]) recolour(c.root, CRAB_SHELLS[e.look]!); o = c.root; }
    else if (e.model === 'guardian') { const gd = buildGuardian(); if (!e.boss) recolour(gd.root, { stoneDark: 0x4e4c54, stone: 0x77737c }); o = gd.root; }
    else if (e.model === 'boar') o = buildBoar(3).root;
    else if (e.model === 'spider') o = buildSpider(e.look, 5).root;
    else if (e.model === 'snake') o = buildSnake(e.look, 9).root;
    else { const look = HUMAN_LOOKS[e.look ?? e.model] ?? BRIGAND_LOOK; o = buildHumanoid(e.model === 'gunner' ? { ...look, held: 'musket' } : look).root; }
    const where = e.boss ? 'Boss' : e.level >= 50 ? 'Late game' : e.level >= 20 ? 'Mid game' : 'Early game';
    const loot = LOOT[e.loot];
    const drops = loot ? loot.drops.filter((x) => x.chance >= 0.2).map((x) => ITEMS[x.item]?.name).filter(Boolean).slice(0, 3).join(', ') : '';
    out.creatures.push({ id: e.id, name: e.name, group: where, img: shot(o, { pitch: 0.38, yaw: 0.6 }), facts: [['Level', String(e.level)], ['Health', String(e.hp)], ['Max hit', String(e.maxHit)], ['Fights with', e.style], ['Weak to', e.weakness]], note: drops ? `Drops ${drops}` : undefined });
  }
  await yieldUI();

  // ---- characters: the player, every named NPC, the townsfolk (shown with what they hold)
  const person = (look: Parameters<typeof buildHumanoid>[0]) => shot(buildHumanoid(look).root, { pitch: 0.18, yaw: 0.45, fill: 0.95 });
  out.characters.push({ id: 'player', name: 'You, the captain', group: 'Player', img: person({ ...PLAYER_LOOK, held: 'cutlass' }), facts: [] });
  for (const [id, look] of Object.entries(NPC_LOOKS)) {
    const n = NPCS[id];
    out.characters.push({ id, name: n?.name ?? id, group: id.startsWith('watch') || id === 'halyard_watch' ? 'Town watch' : 'Named NPCs', img: person(look), facts: n?.title ? [['Role', n.title]] : [], note: n?.idle?.[0] });
  }
  for (const [id, look] of Object.entries(TOWNS_LOOKS)) out.characters.push({ id, name: `Townsfolk ${id.slice(-1).toUpperCase()}`, group: 'Townsfolk', img: person(look), facts: [] });
  await yieldUI();

  // ---- resources: every gatherable node as it stands in the world
  for (const n of Object.values(NODES)) {
    let o: THREE.Object3D;
    const fishing = n.skill === 'fishing';
    if (n.skill === 'woodcutting' && n.id.startsWith('tree_')) {
      const tv = TREE_LOOK[n.id] ?? TREE_LOOK.tree_pine;
      o = tv.kind === 'broad' ? buildBroadleaf(4) : buildPine(4, tv.scale);
      if (tv.kind === 'broad') o.scale.multiplyScalar(tv.scale);
      if (tv.squash) o.scale.y *= tv.squash;
      if (tv.colours) recolour(o, tv.colours, tv.glow);
    } else if (n.id === 'rock_cinder') o = buildCinderVent(3);
    else if (n.id === 'rock_sky') o = buildFallenStar(3);
    else if (n.id === 'rock_levi') o = buildBones(3);
    else if (n.id === 'rock_ori') o = buildSpire(3, 5);
    else if (n.id === 'rock_boulder') o = buildRock(7, 1, 'stone');
    else if (n.id === 'palm') o = buildPalm(3, true);
    else if (n.id === 'salt_pan') o = buildSaltPan(3, true);
    else if (n.id === 'bush_berry') o = buildBush(3, true);
    else if (n.id === 'kelp_bed') o = buildKelp(3);
    else if (n.id === 'dig_spot') o = buildDigSpot(3);
    else if (n.skill === 'mining') {
      const g = buildOreRock(3), [tint, glowK] = ORE_TINT[n.id] ?? [PAL.copper, 0.12];
      g.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh && (m.material as THREE.MeshStandardMaterial).color.getHex() === PAL.copper) m.material = mat(tint, { emissive: tint, emissiveIntensity: glowK }); });
      o = g;
    } else {
      // a fishing spot: its ripples with the fish leaping out of them
      const g = new THREE.Group();
      const rp = buildRipples(n.fromShip ? 0xf2e6b0 : 0xe9f5f2);
      rp.children.forEach((c, i) => c.scale.setScalar(0.6 + i * 0.35));
      g.add(rp);
      const water = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshStandardMaterial({ color: 0x2f7f86, roughness: 0.3 }));
      water.rotation.x = -Math.PI / 2; water.position.y = -0.02; g.add(water);
      const fish = buildItemModel(n.catches?.[n.catches.length - 1].item ?? n.item); fish.scale.setScalar(3.2); fish.position.y = 0.7; fish.rotation.z = 0.5; g.add(fish);
      o = g;
    }
    const facts: [string, string][] = n.skill ? [['Skill', `${n.skill} ${n.level}`], ['XP', String(n.xp)]] : [['Skill', 'none']];
    if (n.catches) facts.push(['Catches', n.catches.map((c) => `${ITEMS[c.item].name.replace(/^Raw /, '')} (${c.level})`).join(', ')]);
    else if (n.item && ITEMS[n.item]) facts.push(['Gives', ITEMS[n.item].name]);
    out.resources.push({ id: n.id, name: n.name, group: fishing ? 'Fishing spots' : n.skill === 'woodcutting' ? 'Trees' : n.skill === 'mining' ? 'Rocks & veins' : 'Foraging', img: shot(o, { pitch: fishing ? 0.75 : 0.4 }), facts });
  }
  // the depleted look of trees and rocks
  out.resources.push({ id: 'stump', name: 'Felled stump', group: 'Trees', img: shot(buildStump(3)), facts: [['Shown', 'while a tree regrows']] });
  await yieldUI();

  // ---- props, stations, buildings, the ship
  const P = (id: string, name: string, group: string, o: THREE.Object3D, note?: string) => out.props.push({ id, name, group, img: shot(o), facts: [], note });
  P('sloop', 'Your sloop', 'Ship & harbour', buildSloop().root);
  P('rowboat', 'Rowboat', 'Ship & harbour', buildRowboat(3)); P('netrack', 'Net rack', 'Ship & harbour', buildNetRack(3)); P('pots', 'Lobster pots', 'Ship & harbour', buildPotStack(3));
  P('cannon', 'Cannon', 'Ship & harbour', buildCannon()); P('buoy', 'Buoy', 'Ship & harbour', buildBuoy()); P('wreck', 'Wreck ribs', 'Ship & harbour', buildWreckRibs(3));
  P('furnace', 'Furnace', 'Stations', buildFurnace().group); P('anvil', 'Anvil', 'Stations', buildAnvil()); P('cookfire', 'Cookfire', 'Stations', buildCookfire().group);
  P('bench', 'Workbench', 'Stations', buildBench()); P('ventforge', 'Vent forge', 'Stations', buildVentForge().group); P('strongbox', 'Strongbox', 'Stations', buildStrongbox());
  P('plinth', 'Bell hollow (the Broken Ring)', 'Boss arenas', buildPlinth()); P('gong', 'Temple gong (the Sunken Temple)', 'Boss arenas', buildGong()); P('pillar', 'Broken pillar', 'Boss arenas', buildPillar(3, 1));
  P('tent', 'Brigand tent', 'Camps', buildTent(3)); P('smithy', 'Smithy shed', 'Camps', buildSmithyShed()); P('crate', 'Crate', 'Camps', buildCrate(3)); P('barrel', 'Barrel', 'Camps', buildBarrel(0.32, 0.75));
  P('lantern', 'Lantern post', 'Camps', buildLanternPost().group);
  P('well', 'Well', 'Village', buildWell()); P('signpost', 'Signpost', 'Village', buildSignpost(3, [0, 1.6, 3.1, 4.7])); P('fence', 'Garden fence', 'Village', buildFence(3, 4.8));
  P('woodpile', 'Woodpile', 'Village', buildWoodpile(3)); P('flowers', 'Flowers', 'Village', buildFlowers(3)); P('stall', 'Market stall', 'Village', buildStall(0xd8a030, 3));
  P('driftwood', 'Driftwood', 'Shore', buildDriftwood(3)); P('shells', 'Shells and starfish', 'Shore', buildShells(3));
  P('leviathan', 'Leviathan skeleton', 'Landmarks', buildLeviathan()); P('crater', 'Star crater', 'Landmarks', buildCrater());
  P('cavemouth', 'Cave mouth', 'Caves', buildCaveMouth()); P('rope', 'Rope to the surface', 'Caves', buildRope()); P('web', 'Spider web', 'Caves', buildWeb(3));
  P('crystal', 'Glow crystals (grotto)', 'Caves', buildCrystal(3)); P('crystal_ember', 'Glow crystals (Ember Deep)', 'Caves', buildCrystal(5, 0x8a6af0)); P('torch', 'Cave torch', 'Caves', buildCaveTorch());
  P('stalagmite', 'Stalagmites', 'Caves', buildStalagmite(3)); P('lava', 'Magma pool', 'Caves', buildLava(2.4));
  for (const b of TOWN.buildings) {
    const v = buildEnterable({ ...b, x: 0, z: 0, rot: 0 });
    out.props.push({ id: b.id, name: b.name, group: b.id.startsWith('p_') ? 'Port Halyard buildings' : 'Bellwether buildings', img: shot(v.group, { pitch: 0.5, yaw: 0.7 }), facts: [['Size', `${b.w} × ${b.d} m${b.storeys === 2 ? ', 2 storeys' : ''}`], ['Style', b.style]] });
  }
  return out;
}
