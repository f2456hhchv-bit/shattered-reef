import * as THREE from 'three';
import { mulberry32 } from '../noise';
import { PAL } from '../materials';
import { buildHarbourOak, buildErodedRock, buildSaltShrub } from './organic';
import { BEACH, BELL_TOWN, coastDist, LAYOUT, nearestPathDist } from '../../game/world/island';
import { toLocal } from '../../game/world/buildings';
import type { World } from '../../game/world/world';

/** A small composed harbour verge, placed beside traffic rather than through doors or paths. */
export function buildQuayPlanting(world: World): THREE.Group {
  const g=new THREE.Group(), z=LAYOUT.village.z;
  const clear=(x:number,pz:number,r:number)=>{
    if(!world.walkable(x,pz)||coastDist(x,pz)<BEACH+1) return false;
    const p=nearestPathDist(x,pz);
    if(p.d<p.width+r*.65) return false;
    return !BELL_TOWN.buildings.some(b=>{const [bx,bz]=toLocal(b,x,pz);return Math.abs(bx)<b.w/2+r+.3&&Math.abs(bz)<b.d/2+r+.3;});
  };
  const put=(o:THREE.Object3D,x:number,pz:number,y=0)=>{o.position.set(x,world.ground(x,pz)+y,pz);g.add(o);};
  const oakCandidates:[[number,number],[number,number],[number,number]]=[[-16,z+2],[-20,z+14],[25,z+14]];
  for(const [x,pz] of oakCandidates) if(clear(x,pz,2.7)){put(buildHarbourOak(417),x,pz,-.05);g.userData.oak=[x,pz];break;}
  const shrubs:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[
    [22,z+16],[27,z+19],[-25,z+18],[-29,z+9],[23,z-17],[-28,z-16]
  ];
  let shrubCount=0;
  shrubs.forEach(([x,pz],i)=>{if(clear(x,pz,1.15)){put(buildSaltShrub(73+i),x,pz);shrubCount++;}});
  g.userData.shrubCount=shrubCount;
  const rocks:[[number,number],[number,number],[number,number]]=[[-18,z+14],[30,z+17],[28,z+20]];
  for(const [x,pz] of rocks) if(clear(x,pz,1.8)) {
    // Eroded, low stones share a direction of bedding. One cluster, outside the walk line.
    for(const [dx,dz,scale,seed] of [[0,0,1.15,301],[1.35,-.4,.66,302],[-.7,.75,.5,303]] as const){
      const rock=buildErodedRock(seed,scale,'stoneDark');rock.rotation.y=.32;put(rock,x+dx,pz+dz,scale*.18);
    }
    g.userData.rockCluster=[x,pz];break;
  }
  return g;
}

/** Curved salt grass fans, instanced as one mesh per streamed cell along the harbour verge. */
export function buildHarbourGrass(points: THREE.Vector3[], seed: number): THREE.InstancedMesh {
  const vertices:number[]=[], indices:number[]=[];
  for(let blade=0;blade<5;blade++) {
    const a=blade*2.399, reach=.13+blade*.024, height=.26+(blade%3)*.07, start=vertices.length/3;
    for(let step=0;step<4;step++){
      const t=step/3, x=Math.cos(a)*reach*t*t, z=Math.sin(a)*reach*t*t;
      const width=.055*(1-t)+.005;
      const nx=-Math.sin(a)*width,nz=Math.cos(a)*width;
      vertices.push(x+nx,height*t,z+nz,x-nx,height*t,z-nz);
      if(step){const i=start+(step-1)*2;indices.push(i,i+2,i+1,i+1,i+2,i+3);}
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0,side:THREE.DoubleSide});
  const uniforms={uTime:{value:0}};
  material.onBeforeCompile=(shader)=>{
    shader.uniforms.uTime=uniforms.uTime;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        float phase = instanceMatrix[3].x * .31 + instanceMatrix[3].z * .24;
        transformed.x += sin(uTime * 1.4 + phase) * position.y * .11;
        transformed.z += cos(uTime * 1.2 + phase) * position.y * .08;`);
  };
  const mesh=new THREE.InstancedMesh(geo,material,points.length), rnd=mulberry32(seed), obj=new THREE.Object3D();
  const base=new THREE.Color(PAL.grassTuft), c=new THREE.Color();
  points.forEach((p,i)=>{obj.position.copy(p);obj.rotation.y=rnd()*Math.PI*2;obj.scale.setScalar(.8+rnd()*.45);obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);
    c.copy(base).offsetHSL((rnd()-.5)*.035,0,(rnd()-.5)*.08);mesh.setColorAt(i,c);});
  mesh.userData.uniforms=uniforms;
  mesh.castShadow=false;mesh.receiveShadow=true;return mesh;
}
