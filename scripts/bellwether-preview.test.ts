import {describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assertPreviewTarget,assertExistingPreview,canInitializePreviewRepository,preparePreviewArtifact,PREVIEW_REPOSITORY,PRODUCTION_REPOSITORY} from './bellwether-preview.mjs';
import {bellwetherRedesignEnabled,worldStorageKey} from '../src/game/world/variant';
describe('isolated public Bellwether preview',()=>{
 it('forces redesigned geometry and its save namespace even when the preview URL requests classic',()=>{
  expect(bellwetherRedesignEnabled('?bellwether=classic',undefined,'1')).toBe(true);
  expect(bellwetherRedesignEnabled('',undefined,'1')).toBe(true);
  expect(bellwetherRedesignEnabled('?bellwether=classic','1')).toBe(false);
 });
 it('keeps preview intro and calibration storage distinct while preserving classic keys',()=>{
  for(const key of ['shattered-reef-intro-seen','sr.touch.p','sr.touch.l']){
   expect(worldStorageKey(key,true)).not.toBe(key);
   expect(worldStorageKey(key,true)).toContain('bellwether-phase2-v1');
   expect(worldStorageKey(key,false)).toBe(key);
  }
 });
 it('resumes only a genuinely empty public preview repository after an interrupted first publish',()=>{
  const empty={full_name:PREVIEW_REPOSITORY,private:false,fork:false,size:0};
  expect(canInitializePreviewRepository(empty,[])).toBe(true);
  expect(canInitializePreviewRepository({...empty,size:10},[])).toBe(false);
  expect(canInitializePreviewRepository(empty,[{name:'preview-site'}])).toBe(false);
  expect(canInitializePreviewRepository({...empty,private:true},[])).toBe(false);
  expect(canInitializePreviewRepository({...empty,full_name:PRODUCTION_REPOSITORY},[])).toBe(false);
 });
 it('cannot target the production repository or another unrelated repository',()=>{
  expect(()=>assertPreviewTarget(PRODUCTION_REPOSITORY)).toThrow(/preview repository/);
  expect(()=>assertPreviewTarget('someone/another-game')).toThrow(/preview repository/);
  expect(assertPreviewTarget(PREVIEW_REPOSITORY)).toBe(PREVIEW_REPOSITORY);
 });
 it('refuses to overwrite an existing repository without the correct preview identity',()=>{
  expect(()=>assertExistingPreview(null)).toThrow(/not a recognised/);
  expect(()=>assertExistingPreview({kind:'shattered-reef-bellwether-preview',sourceRepository:'someone/another-game',previewRepository:PREVIEW_REPOSITORY,siteBranch:'preview-site'})).toThrow(/not a recognised/);
 });
 it('packages relative assets and a verifiable source marker without changing the original build',()=>{
  const temp=mkdtempSync(join(tmpdir(),'reef-preview-'));
  try{
   const input=join(temp,'dist'),output=join(temp,'site');mkdirSync(join(input,'assets'),{recursive:true});
   const html='<html><head><title>Shattered Reef</title><script type="module" src="./assets/main.js"></script></head></html>';
   writeFileSync(join(input,'CNAME'),'production.example.com');writeFileSync(join(input,'index.html'),html);writeFileSync(join(input,'assets/main.js'),'game build');
   preparePreviewArtifact(input,output,{sourceCommit:'a'.repeat(40),publishedAt:'2026-10-28T00:00:00Z'});
   expect(readFileSync(join(input,'index.html'),'utf8')).toBe(html);
   expect(readFileSync(join(output,'index.html'),'utf8')).toContain('Bellwether Preview');
   expect(readFileSync(join(output,'index.html'),'utf8')).toContain('./assets/main.js');
   expect(existsSync(join(output,'.nojekyll'))).toBe(true);
   expect(existsSync(join(output,'CNAME'))).toBe(false);
   expect(readFileSync(join(input,'CNAME'),'utf8')).toBe('production.example.com');
   expect(JSON.parse(readFileSync(join(output,'preview.json'),'utf8'))).toMatchObject({kind:'shattered-reef-bellwether-preview',sourceRepository:PRODUCTION_REPOSITORY,sourceBranch:'design/bellwether-phase2',sourceCommit:'a'.repeat(40),redesignDefault:true,saveKey:'shattered-reef.save.bellwether-phase2-v1'});
  }finally{rmSync(temp,{recursive:true,force:true});}
 });
});
