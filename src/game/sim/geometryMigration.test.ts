import {describe,it,expect,vi} from 'vitest';
vi.mock('../world/variant',()=>({BELLWETHER_REDESIGN:true,BELLWETHER_GEOMETRY_REVISION:'bellwether-phase2-v1'}));
import {migrateBellwetherGeometry} from './geometryMigration';
import {Game} from './game';
import {defaultSave,parseSave} from './save';
import {regionLayout} from '../world/layout';
import {ISLETS} from '../world/island';

const home=()=>regionLayout('bellwether');
const legacy=()=>{const l=home(),s=defaultSave(l.respawn,l.mooring!);delete s.geometry;return s;};
const reached=(x:number,z:number)=>{const l=home(),p=l.world.findPath(l.respawn.x,l.respawn.z,x,z),end=p?.at(-1);return !!end&&Math.hypot(end[0]-x,end[1]-z)<2;};
describe('Bellwether geometry migration',()=>{
 it('rescues a legacy player at the old Wreckers shore and preserves every progression record',()=>{
  const s=legacy();s.player.x=310.08;s.player.z=-299.44;s.player.xp.mining=35231;s.player.xp.attack=388;
  s.player.inv[8]={id:'coins',qty:3421};s.bank=[{id:'bar_bronze',qty:287}];s.quests.bell=2;s.discovered=['wreck','fen'];s.shipyard={hull:2,sails:1};s.flags.test_progress=true;
  const before=structuredClone(s);migrateBellwetherGeometry(s);
  expect(reached(s.player.x,s.player.z)).toBe(true);expect(s.geometry).toBe('bellwether-phase2-v1');
  const {x:bx,z:bz,...oldPlayer}=before.player;const {x:ax,z:az,...newPlayer}=s.player;
  expect(newPlayer).toEqual(oldPlayer);expect([ax,az]).not.toEqual([bx,bz]);
  for(const k of ['bank','quests','discovered','shipyard','flags','keyring','collected','contracts','crew','playTime'] as const)expect(s[k]).toEqual(before[k]);
  const round= parseSave(JSON.stringify(s),defaultSave(home().respawn,home().mooring!))!;
  expect(round.geometry).toEqual(s.geometry);expect(round.player.inv).toEqual(s.player.inv);expect(round.shipyard).toEqual(s.shipyard);
  expect(round.bank).toEqual(s.bank);expect(round.player.xp).toEqual(s.player.xp);expect(round.player.equip).toEqual(s.player.equip);expect(round.discovered).toEqual(s.discovered);expect(round.flags.test_progress).toBe(true);expect(round.quests.bell).toBe(2);
 });
 it('relocates an old mooring and keeps an aboard player with the ship',()=>{
  const s=legacy();s.ship.x=.6;s.ship.z=339.79;s.player.onShip=true;s.player.x=s.ship.x;s.player.z=s.ship.z;
  migrateBellwetherGeometry(s);expect(home().world.sailable(s.ship.x,s.ship.z)).toBe(true);
  expect([s.player.x,s.player.z]).toEqual([s.ship.x,s.ship.z]);expect(s.player.onShip).toBe(true);
 });
 it('migrates a legacy sailing hull with heading clearance and lets it sail away',()=>{
  const s=legacy();Object.assign(s.ship,{x:386.7878900133158,z:103.63950277120587,heading:Math.PI/2});s.player.onShip=true;
  const g=new Game({seed:11,save:s});
  expect(g.hullFits(g.ship.x,g.ship.z,g.ship.heading)).toBe(true);
  for(const f of g.naval.foes){f.alive=false;f.respawnAt=Infinity;}
  const before=[g.ship.x,g.ship.z];g.moveTo(500,450);
  for(let i=0;i<400;i++)g.step(.05);
  expect(Math.hypot(g.ship.x-before[0],g.ship.z-before[1])).toBeGreaterThan(10);
 });
 it('moves a player from the new steep cliff to reachable land',()=>{
  const s=legacy();s.player.x=434;s.player.z=-240;migrateBellwetherGeometry(s);expect(reached(s.player.x,s.player.z)).toBe(true);
 });
 it('preserves safe mainland and separate-islet positions, and is idempotent',()=>{
  for(const p of [home().respawn,ISLETS[0]]){
   const s=legacy();const q=home().world.nearestWalkable(p.x,p.z,16)!;[s.player.x,s.player.z]=q;
   migrateBellwetherGeometry(s);expect([s.player.x,s.player.z]).toEqual(q);
   const once=structuredClone(s);migrateBellwetherGeometry(s);expect(s).toEqual(once);
  }
 });
 it('preserves other-region player and ship coordinates',()=>{
  const s=legacy();s.region='sunreach';s.player.x=820;s.player.z=0;s.ship.region='sunreach';s.ship.x=820;s.ship.z=30;
  const p=structuredClone(s.player),ship=structuredClone(s.ship);migrateBellwetherGeometry(s);expect(s.player).toEqual(p);expect(s.ship).toEqual(ship);
 });
 it('keeps wanted-contract rewards/progress while making land targets and treasure reachable',()=>{
  const s=legacy();s.contracts=[{id:17,board:'bellwether',kind:'wanted',enemy:'brigand',need:1,have:0,coins:72,bounty:45,region:'bellwether',name:'Test Sailor',x:310,z:-299}];
  s.treasure={region:'bellwether',x:378.9,z:137.9};migrateBellwetherGeometry(s);
  const c=s.contracts[0];expect(reached(c.x!,c.z!)).toBe(true);expect(c.coins).toBe(72);expect(c.have).toBe(0);
  expect(home().world.seaClear(s.treasure!.x,s.treasure!.z)).toBe(true);
 });
});
