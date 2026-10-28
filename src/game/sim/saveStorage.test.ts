import {describe,it,expect} from 'vitest';
import {readVoyage,resetVoyage} from './saveStorage';
describe('isolated prototype save storage',()=>{
 const store=()=>{const m=new Map<string,string>();return {m,getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},removeItem:(k:string)=>{m.delete(k);}};};
 it('imports classic text read-only when variant is absent; subsequent saves win',()=>{
  const s=store();s.setItem('classic','original progress');expect(readVoyage(s,'variant','classic')).toBe('original progress');
  s.setItem('variant','continued prototype');expect(readVoyage(s,'variant','classic')).toBe('continued prototype');expect(s.getItem('classic')).toBe('original progress');
 });
 it('new voyage resets only prototype and does not reimport the classic voyage',()=>{
  const s=store();s.setItem('classic','original progress');resetVoyage(s,'variant','classic','fresh');
  expect(readVoyage(s,'variant','classic')).toBe('fresh');expect(s.getItem('classic')).toBe('original progress');
 });
 it('classic reset keeps its existing behaviour',()=>{
  const s=store();s.setItem('classic','progress');resetVoyage(s,'classic','classic','fresh');expect(s.getItem('classic')).toBeNull();
 });
});
