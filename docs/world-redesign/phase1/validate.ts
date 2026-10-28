import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {World} from '../../../src/game/world/world';
import {regionLayout} from '../../../src/game/world/layout';
import {QUESTS} from '../../../src/game/data/quests';
import {LORE} from '../../../src/game/data/lore';
import {DOORS} from '../../../src/game/data/doors';
import {NODES} from '../../../src/game/data/content';
import {LAYOUT,ISLAND_PLACES} from '../../../src/game/world/island';
const root=fileURLToPath(new URL('.',import.meta.url));
const bytes=readFileSync(root+'shore-distance.f32');
const f=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
function distance(x:number,z:number){
 const u=Math.max(0,Math.min(619.999,(x+620)/2)),v=Math.max(0,Math.min(619.999,(z+620)/2));
 const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,k=j*621+i;
 return (1-b)*((1-a)*f[k]+a*f[k+1])+b*((1-a)*f[k+621]+a*f[k+622]);
}
const start=performance.now();
// Deliberately simplified shore profile. Does not include production hills, flats, solids or decks.
const w=new World({cx:0,cz:0,half:620},(x,z)=>Math.max(-5,Math.min(4,distance(x,z)*.15)));
w.bake();
const baked=performance.now()-start;
const route=(p:{x:number,z:number})=>{
 const path=w.findPath(LAYOUT.village.x,LAYOUT.village.z,p.x,p.z),end=path?.at(-1);
 const error=end?Math.hypot(end[0]-p.x,end[1]-p.z):null;
 return {shoreDistance:Math.round(distance(p.x,p.z)*10)/10,walkable:w.walkable(p.x,p.z),reached:error!==null&&error<2,endError:error};
};
const proposedAnchors={wreck:{x:365,z:-267},gull:{x:356,z:-261},shrine_tide:{x:-123,z:-81},mooring:{x:0,z:380}};
const candidateAnchorChecks=Object.fromEntries(Object.entries(proposedAnchors).filter(([k])=>k!=='mooring').map(([k,p])=>[k,route(p)]));
const routes=Object.fromEntries(Object.entries(LAYOUT).map(([id,p])=>[id,route(p)]));
const L=regionLayout('bellwether');
const affected=(items:any[])=>items.filter(p=>distance(p.x,p.z)<1).map(p=>({id:p.id??p.uid??p.enemy??p.label??'unnamed',def:p.def,x:p.x,z:p.z,distance:Math.round(distance(p.x,p.z))}));
const landNodes=L.nodes.filter(n=>!NODES[n.def].fromShip);
const seaNodes=L.nodes.filter(n=>NODES[n.def].fromShip);
const counts={npcs:L.npcs.length,stations:L.stations.length,banks:L.banks.length,landNodes:landNodes.length,seaNodes:seaNodes.length,spawns:L.spawns.length,buildings:L.town.length};
const displaced={npcs:affected(L.npcs),stations:affected(L.stations),banks:affected(L.banks),landNodes:affected(landNodes),spawns:affected(L.spawns),buildingCentres:affected(L.town),places:affected(ISLAND_PLACES.filter(p=>!p.region&&!p.sea))};
const seaTargets=[[600,0],[-450,-75],[0,500],[500,300]];
const seaRoutes=seaTargets.map(([x,z])=>{const p=w.findSeaPath(0,380,x,z),e=p?.at(-1);return {target:[x,z],reached:!!e&&Math.hypot(e[0]-x,e[1]-z)<2,end:e,waypoints:p?.length};});
const marks=Object.values(QUESTS).flatMap(q=>q.stages.flatMap(st=>(st.marks??[]).filter(m=>m.region==='bellwether'&&!m.fromShip).map(m=>({...m,id:q.id+':'+m.id}))));
const projectedQuestMarks=affected(marks);
const result={projectedQuestMarks,projectedLore:affected(LORE.filter(p=>p.region==='bellwether')),projectedDoors:affected(DOORS.filter(p=>p.region==='bellwether')),projectedPortals:affected(L.portals),newlyWetNonShipNodes:landNodes.filter(p=>L.world.ground(p.x,p.z)>.14&&distance(p.x,p.z)<1).length,scope:'isolated geometry with actual World engine; synthetic height; production content only projected, not installed',bakeMilliseconds:baked,coreGridBytes:w.heights.byteLength+w.walk.byteLength+w.sail.byteLength+w.sea.byteLength,fieldBytes:bytes.byteLength,routes,candidateAnchorChecks,proposedAnchors,seaRoutes,existingMooring:{...L.mooring,prototypeHeight:L.mooring&&w.ground(L.mooring.x,L.mooring.z)},counts,displaced,seaNodesNowLand:seaNodes.filter(p=>distance(p.x,p.z)>0).map(p=>({id:p.uid,def:p.def,x:p.x,z:p.z}))};
writeFileSync(root+'validation.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,displaced:Object.fromEntries(Object.entries(displaced).map(([k,v])=>[k,{count:v.length,examples:v.slice(0,4)}])),routes},null,2));

for(const id of ['village','dockBase','crossroads','store','chartHouse','smithy','cookfire','quarry','copse','copperback','saltpine','mirewater','gullhaven','pithead','forest','grove','heartwood','peak','summit','ruin','camp','cove','howes','bucca']) assert.equal(routes[id].reached,true,id+' must be reached at endpoint');
for(const [id,r] of Object.entries(candidateAnchorChecks)) assert.equal(r.reached,true,'candidate '+id);
assert.ok(seaRoutes.every(r=>r.reached),'all four sea endpoints');
assert.equal(routes.wreck.walkable,false,'old Wreckers anchor remains an identified migration risk');
assert.ok(w.ground(L.mooring!.x,L.mooring!.z)>0,'old mooring migration risk remains explicit');
console.log('Geometry assertions passed; integration risks remain as reported.');
