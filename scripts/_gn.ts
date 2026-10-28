import { Game } from '../src/game/sim/game';
import { defaultSave } from '../src/game/sim/save';
import { xpForLevel } from '../src/game/sim/xp';
const base = new Game({ seed: 1 });
const g = new Game({ seed: 300, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
g.p.xp.sailing = xpForLevel(18);
const f = g.naval.foes.find((x) => x.def.id === 'old_gnasher')!;
const spot = g.nearestSea(f.spawnX + Number(process.env.DX ?? 12), f.spawnZ + Number(process.env.DZ ?? 0))!;
console.log('gnasher', f.spawnX, f.spawnZ, 'spot', spot, 'sail?', g.world.sailable(f.spawnX, f.spawnZ), g.world.ground(f.spawnX, f.spawnZ));
Object.assign(g.ship, { x: spot[0], z: spot[1], heading: 0 });
g.p.onShip = true; g.p.x = spot[0]; g.p.z = spot[1];
for (const o of g.naval.foes) if (o !== f) { o.alive = false; o.respawnAt = Infinity; }
for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
f.x = spot[0]; f.z = spot[1] + 10; f.spawnX = f.x; f.spawnZ = f.z;
g.naval.hull = g.naval.hullMax(); g.give('depth_charge', 30); f.state = 'chase';
for (let t = 0; t < 240 && f.alive; t += 1 / 30) {
  const sh = g.ship; const want = Math.atan2(f.z - sh.z, f.x - sh.x) - Math.PI / 2, diff = Math.atan2(Math.sin(want - sh.heading), Math.cos(want - sh.heading));
  sh.heading += Math.max(-1.25 / 30, Math.min(1.25 / 30, diff));
  if ((f.under || f.state === 'charge') && Math.hypot(f.x - sh.x, f.z - sh.z) < 7 && g.naval.reloadCd === 0) { g.naval.ammo = 'depth_charge'; g.naval.fire(); }
  else if (!f.under && g.naval.reloadCd === 0) { g.naval.ammo = 'cannonball'; g.naval.fire(); }
  g.step(1 / 30);
  if (Math.round(t * 30) % 300 === 0) console.log(t.toFixed(0), 'hull', g.naval.hull, 'f', f.hp, f.state, 'onShip', g.p.onShip, 'd', Math.hypot(f.x - sh.x, f.z - sh.z).toFixed(1), 'under', f.under, 'cd', g.naval.reloadCd.toFixed(2), 'ammo', g.naval.ammo, (g.naval as any).charges ?? '');
  if (!g.p.onShip) { console.log('off ship at', t); break; }
}
console.log('end', f.alive, f.hp);
