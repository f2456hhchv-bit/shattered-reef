import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {coastR,LAYOUT,ISLAND_PLACES} from '../../../src/game/world/island';
writeFileSync(fileURLToPath(new URL('./existing.json',import.meta.url)),JSON.stringify({outline:Array.from({length:720},(_,i)=>{const t=i*Math.PI/360;return[Math.cos(t)*coastR(t),Math.sin(t)*coastR(t)];}),anchors:LAYOUT,places:ISLAND_PLACES}));
