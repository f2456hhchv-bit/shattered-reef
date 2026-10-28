import { Game } from '../src/game/sim/game';
import { defaultSave } from '../src/game/sim/save';
import { xpForLevel } from '../src/game/sim/xp';
import { count } from '../src/game/sim/inventory';
import { coastPoint } from '../src/game/world/island';
const base = new Game({ seed: 1 });
function wins(lair: [number, number], lvl: number) {
  let w = 0;
  for (let s = 0; s < 6; s++) {
    const g = new Game({ seed: 300 + s, save: defaultSave(base.layout.respawn, base.layout.mooring!) });
    g.p.xp.sailing = xpForLevel(lvl);
    const f = g.naval.foes.find((x) => x.def.id === 'old_gnasher')!;
    f.spawnX = lair[0]; f.spawnZ = lair[1];
    const spot = g.nearestSea(f.spawnX + 12, f.spawnZ); if (!spot) return -1;
    Object.assign(g.ship, { x: spot[0], z: spot[1], heading: 0 }); g.p.onShip = true; g.p.x = spot[0]; g.p.z = spot[1];
    for (const o of g.naval.foes) if (o !== f) { o.alive = false; o.respawnAt = Infinity; }
    for (const e of g.enemies) { e.alive = false; e.respawnAt = Infinity; }
    const at = [spot[0] + Math.cos(Math.PI / 2) * 10, spot[1] + Math.sin(Math.PI / 2) * 10];
    f.x = at[0]; f.z = at[1]; f.spawnX = at[0]; f.spawnZ = at[1];
    g.naval.hull = g.naval.hullMax(); g.give('depth_charge', 30); f.state = 'chase';
    let lost = false;
    for (let t = 0; t < 240 && f.alive; t += 1 / 30) {
      const sh = g.ship; const want = Math.atan2(f.z - sh.z, f.x - sh.x) - Math.PI / 2, diff = Math.atan2(Math.sin(want - sh.heading), Math.cos(want - sh.heading));
      sh.heading += Math.max(-1.25 / 30, Math.min(1.25 / 30, diff));
      if ((f.under || f.state === 'charge') && Math.hypot(f.x - sh.x, f.z - sh.z) < 9.5 && g.naval.reloadCd === 0) { g.naval.ammo = 'depth_charge'; g.naval.fire(); }
      else if (!f.under && g.naval.reloadCd === 0) { g.naval.ammo = count(g.p.inv, 'depth_charge') > 0 && Math.hypot(f.x - sh.x, f.z - sh.z) < 6 ? 'depth_charge' : 'cannonball'; g.naval.fire(); }
      g.step(1 / 30);
      if (!g.p.onShip || Math.hypot(g.ship.x - g.layout.mooring!.x, g.ship.z - g.layout.mooring!.z) < 1) { lost = true; break; }
    }
    if (!lost && !f.alive) w++;
  }
  return w;
}
for (const a of [42, 43, 45, 46, 47, 50, 53, 54, 55, 57, 58]) for (const out of [18, 22, 26, 30]) { const p = coastPoint(a, -out); console.log(a, out, wins(p, 10), wins(p, 18)); }
