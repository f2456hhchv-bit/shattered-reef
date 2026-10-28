import {writeFileSync} from 'node:fs';
import {regionLayout} from '../src/game/world/layout';
import {LAYOUT} from '../src/game/world/island';
import {BELLWETHER_REDESIGN} from '../src/game/world/variant';
const started=performance.now(),l=regionLayout('bellwether'),built=performance.now()-started;
const routes=[];
for(const id of ['quarry','saltpine','copperback','mirewater','gullhaven','wreck','ruin','heartwood'] as const){
 const p=LAYOUT[id],t=performance.now(),route=l.world.findPath(l.respawn.x,l.respawn.z,p.x,p.z),ms=performance.now()-t,end=route?.at(-1);
 routes.push({kind:'walk',id,milliseconds:ms,waypoints:route?.length??0,endpointError:end?Math.hypot(end[0]-p.x,end[1]-p.z):null});
}
for(const [x,z]of [[0,500],[600,450],[-450,-75]]){
 const t=performance.now(),r=l.world.findSeaPath(l.mooring!.x,l.mooring!.z,x,z),end=r?.at(-1);
 routes.push({kind:'sail',id:`${x},${z}`,milliseconds:performance.now()-t,waypoints:r?.length??0,endpointError:end?Math.hypot(end[0]-x,end[1]-z):null});
}
if(routes.some(r=>r.endpointError===null||r.endpointError>2))throw Error(JSON.stringify(routes));
const result={mode:BELLWETHER_REDESIGN?'phase2':'classic',scope:'Node cloud CPU, one cold layout build then eight walk and three sea queries; coarse path grid builds on first long route. Not a phone benchmark.',layoutBuildMilliseconds:built,gridBytes:l.world.heights.byteLength+l.world.walk.byteLength+l.world.sail.byteLength+l.world.sea.byteLength,routes};
writeFileSync(`docs/world-redesign/phase2/navigation-${result.mode}.json`,JSON.stringify(result,null,2));console.log(result);
