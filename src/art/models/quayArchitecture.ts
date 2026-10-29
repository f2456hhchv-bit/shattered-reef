import * as THREE from 'three';
import { mat, mesh, PAL } from '../materials';
import { WALL_H, type BuildingDef } from '../../game/world/buildings';
import type { EnterableView } from './buildings';

/** Three authored roof profiles for the inhabited harbour quarter. Kept in the existing liftable roof group. */
export const QUAY_ART_IDS = ['store', 'chart', 'tackle'] as const;
export type QuayArtId = typeof QUAY_ART_IDS[number];
export function isQuayArtId(id: string): id is QuayArtId { return (QUAY_ART_IDS as readonly string[]).includes(id); }

function surface(w: number, d: number, columns: number, rows: number,
  point: (u: number, v: number) => [number, number, number], base: number, seed: number): THREE.Mesh {
  const xyz: number[] = [], colours: number[] = [], indices: number[] = [];
  const baseColour = new THREE.Color(base);
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
    const u = i / columns, v = j / rows;
    xyz.push(...point(u, v));
    // Broad, deliberately restrained weathered courses; no noisy per-triangle confetti.
    const col = baseColour.clone().offsetHSL(0, 0, .025 * Math.sin((j + seed) * 1.9) + .01 * Math.sin(i * .9 + seed));
    colours.push(col.r, col.g, col.b);
    if (i && j) {
      const a = (j - 1) * (columns + 1) + i - 1, b = a + 1, c = a + columns + 1, e = c + 1;
      indices.push(a, c, b, b, c, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(xyz, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  const roof = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }));
  roof.castShadow = true; roof.receiveShadow = true;
  roof.userData.authoredRoof = true;
  roof.userData.footprint = [w, d];
  return roof;
}

function bentBeam(points: [number, number, number][], radius: number, colour: keyof typeof PAL): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve, 16, radius, 6, false), mat(colour));
}

function gableInfill(b: BuildingDef, top: number, roofY: (z:number)=>number, colour: keyof typeof PAL): THREE.Mesh {
  const positions:number[]=[], indices:number[]=[], count=14, hd=b.d/2;
  for(const side of [-1,1]){
    const x=side*(b.w/2-.04), first=positions.length/3;
    for(let i=0;i<=count;i++){
      const z=-hd+i/count*b.d;
      positions.push(x,top,z,x,Math.max(top+.03,roofY(z)-.08),z);
      if(i){const a=first+(i-1)*2,c=first+i*2;
        if(side>0)indices.push(a,a+1,c,a+1,c+1,c);
        else indices.push(a,c,a+1,a+1,c,c+1);
      }
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
  const infill=mesh(geo,mat(colour));infill.userData.gableInfill=true;return infill;
}

function storeRoof(v: EnterableView, b: BuildingDef) {
  const W = b.w, D = b.d, top = .12 + WALL_H * (b.storeys ?? 1), hw = W / 2, hd = D / 2;
  const roofY=(z:number)=>top+.12+1.83*(1-Math.pow(Math.abs(z)/(hd+.625),1.42));
  // Salt-warped cedar: uneven ridge and a deep sheltering eave toward the public frontage.
  v.roof.add(surface(W, D, 18, 12, (u, q) => {
    const x = (u - .5) * (W + .9), z = (q - .5) * (D + 1.25);
    const t = Math.abs(z) / (hd + .625), rise = 1.83 * (1 - Math.pow(t, 1.42));
    const ridge = .15 * Math.sin(u * Math.PI) - .09 * u;
    const eave = .10 * Math.pow(t, 5) * Math.sin(u * Math.PI);
    return [x, top + .12 + rise + ridge + eave, z];
  }, PAL.roof, b.seed));
  for (const x of [-hw - .43, hw + .43]) {
    v.roof.add(bentBeam([ [x, top + .15, -hd - .55], [x, top + 1.5, -hd * .42], [x, top + 1.95, 0], [x, top + 1.46, hd * .42], [x, top + .18, hd + .62] ], .075, 'woodDark'));
  }
  v.roof.add(bentBeam([[-hw-.43,top+1.86,0],[0,top+2.04,0],[hw+.43,top+1.77,0]], .09, 'woodDark'));
  v.roof.add(gableInfill(b,top,roofY,'plankWorn'));
  // Two shaped braces support the working eave without obstructing the entrance.
  for (const x of [-hw + .45, hw - .45]) v.trim.add(bentBeam([[x,top-.75,hd+.12],[x,top-.35,hd+.42],[x,top+.12,hd+.6]], .09, 'woodDark'));
}

function chartRoof(v: EnterableView, b: BuildingDef) {
  const W=b.w, D=b.d, top=.12+WALL_H*(b.storeys??1), hw=W/2, hd=D/2;
  // Four shallow hips converge on a short, offset ridge. The cupola is a working observation lantern.
  v.roof.add(surface(W,D,18,16,(u,q)=>{
    const x=(u-.5)*(W+1.05), z=(q-.5)*(D+1.05);
    const dx=Math.max(0,Math.abs(x)-.78)/(hw+.525-.78), dz=Math.abs(z)/(hd+.525);
    const t=Math.min(1,Math.max(dx,dz));
    return [x,top+.14+1.45*(1-t*t)+.08*Math.sin(u*Math.PI*2)*t,z];
  }, 0x66777a,b.seed));
  const lantern=mesh(new THREE.CylinderGeometry(.49,.58,.92,12),mat('plankWorn'));
  lantern.position.set(.35,top+1.95,-.18);v.roof.add(lantern);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2;
    const pane=mesh(new THREE.PlaneGeometry(.48,.42),mat('glass'),false);
    pane.position.set(.35+Math.sin(a)*.59,top+2.04,-.18+Math.cos(a)*.59);
    pane.rotation.y=a;v.roof.add(pane);
  }
  const cap=mesh(new THREE.ConeGeometry(.72,.46,12),mat('roof'));
  cap.position.set(.35,top+2.64,-.18);v.roof.add(cap);
  // Limewashed corner piers tie the chart room to the local stone footing.
  for (const x of [-hw+.14,hw-.14]) for(const z of [-hd+.14,hd-.14]) {
    const pier=mesh(new THREE.CylinderGeometry(.19,.25,top-.16,8),mat('stone'));
    pier.position.set(x,top/2,z);v.walls.add(pier);
  }
}

function tackleRoof(v: EnterableView, b: BuildingDef) {
  const W=b.w,D=b.d,top=.12+WALL_H*(b.storeys??1),hw=W/2,hd=D/2;
  // Net-maker's low salt shed: one long swept pitch with a lifted back and shallow front canopy.
  v.roof.add(surface(W,D,18,12,(u,q)=>{
    const x=(u-.5)*(W+1.1), z=(q-.5)*(D+1.5);
    const slope=(.5-q)*1.48, middle=.16*Math.sin(u*Math.PI);
    return [x,top+.95+slope+middle+.08*Math.sin(q*Math.PI*2),z];
  },0x69594f,b.seed));
  for(const x of [-hw-.52,hw+.52]) v.roof.add(bentBeam([[x,top+1.67,-hd-.67],[x,top+1.26,0],[x,top+.27,hd+.7]],.075,'woodDark'));
  v.roof.add(gableInfill(b,top,z=>top+.95-z/D*1.48,'plankWorn'));
  // Hanging net rail is anchored to the facade, above the door clearance.
  v.trim.add(bentBeam([[-hw+.3,top-.25,hd+.28],[0,top-.32,hd+.35],[hw-.3,top-.25,hd+.28]],.06,'woodDark'));
}

export function applyQuayArchitecture(v: EnterableView, b: BuildingDef): boolean {
  if (!isQuayArtId(b.id)) return false;
  v.roof.clear();
  if (b.id === 'store') storeRoof(v,b);
  else if (b.id === 'chart') chartRoof(v,b);
  else tackleRoof(v,b);
  return true;
}
