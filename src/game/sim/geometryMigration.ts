import { shipHullFits } from '../world/shipHull';
import type { SaveData } from './save';
import { regionLayout } from '../world/layout';
import { ISLETS } from '../world/island';
import { BELLWETHER_REDESIGN, BELLWETHER_GEOMETRY_REVISION } from '../world/variant';

/** One-time coordinate migration only. Never changes progression or consumes a quest/map. */
export function migrateBellwetherGeometry(save: SaveData): void {
  if (!BELLWETHER_REDESIGN || save.geometry === BELLWETHER_GEOMETRY_REVISION) return;
  const layout = regionLayout('bellwether'), world = layout.world, home = layout.respawn, port = layout.mooring!;
  const arrives = (path: [number, number][] | null, x: number, z: number, reach = 2) => {
    const end = path?.at(-1);
    return !!end && Math.hypot(end[0] - x, end[1] - z) < reach;
  };
  const onIslet = (x: number, z: number) => ISLETS.some(i => world.inside(i.x,i.z) && Math.hypot(x-i.x,z-i.z) <= i.r + 3);
  const reachableLand = (x: number, z: number, allowIslet: boolean) => world.walkable(x,z) &&
    ((allowIslet && onIslet(x,z)) || arrives(world.findPath(home.x,home.z,x,z),x,z));
  const reachableSea = (x: number,z: number) => world.seaClear(x,z) && arrives(world.findSeaPath(port.x,port.z,x,z),x,z);
  const nearby = (x: number,z: number, valid: (x:number,z:number)=>boolean, fallback: {x:number;z:number}) => {
    for (const r of [0,4,8,16,32,64,96,160]) {
      for (let k=0;k<(r===0?1:24);k++) {
        const angle=k*Math.PI/12,px=x+Math.cos(angle)*r,pz=z+Math.sin(angle)*r;
        if(world.inside(px,pz,4)&&valid(px,pz)) return {x:px,z:pz};
      }
    }
    return {x:fallback.x,z:fallback.z};
  };
  if(save.ship.region==='bellwether') {
    // An exact port mooring can be nearer a deck than the full hull-clear grid permits.
    const fits = (x: number,z: number) => shipHullFits(world,x,z,save.ship.heading);
    const atPort=Math.hypot(save.ship.x-port.x,save.ship.z-port.z)<.1 && fits(port.x,port.z);
    if(!atPort&&!(fits(save.ship.x,save.ship.z)&&reachableSea(save.ship.x,save.ship.z))) {
      const destination=nearby(save.ship.x,save.ship.z,(x,z)=>fits(x,z)&&reachableSea(x,z),port);
      Object.assign(save.ship,destination);
      if(!fits(save.ship.x,save.ship.z)) save.ship.heading=port.heading; // dock-aligned fallback
    }
  }
  if(save.region==='bellwether') {
    if(save.player.onShip&&save.ship.region==='bellwether') {
      save.player.x=save.ship.x;save.player.z=save.ship.z;
    } else if(!reachableLand(save.player.x,save.player.z,true)) {
      Object.assign(save.player,nearby(save.player.x,save.player.z,(x,z)=>reachableLand(x,z,false),home));
    }
  }
  const contracts=[...save.contracts,...Object.values(save.boards).flatMap(b=>b.offers)];
  for(const c of contracts) if(c.kind==='wanted'&&c.region==='bellwether'&&c.x!==undefined&&c.z!==undefined&&!reachableLand(c.x,c.z,false)) {
    Object.assign(c,nearby(c.x,c.z,(x,z)=>reachableLand(x,z,false),home));
  }
  if(save.treasure?.region==='bellwether'&&!reachableSea(save.treasure.x,save.treasure.z)) Object.assign(save.treasure,nearby(save.treasure.x,save.treasure.z,reachableSea,port));
  save.geometry=BELLWETHER_GEOMETRY_REVISION;
}
