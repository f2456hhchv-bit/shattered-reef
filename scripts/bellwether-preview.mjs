import {cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const PRODUCTION_REPOSITORY='f2456hhchv-bit/shattered-reef';
export const PREVIEW_REPOSITORY='f2456hhchv-bit/shattered-reef-bellwether-preview';
const SOURCE_URL=`https://github.com/${PRODUCTION_REPOSITORY}.git`;
const SOURCE_BRANCH='design/bellwether-phase2', SITE_BRANCH='preview-site';
const MARKER='shattered-reef-bellwether-preview';
export function assertPreviewTarget(repository){
  if(repository!==PREVIEW_REPOSITORY)throw Error('Refusing deployment: only the dedicated preview repository is allowed.');
  return repository;
}
export function assertExistingPreview(marker){
  if(marker?.kind!==MARKER||marker.sourceRepository!==PRODUCTION_REPOSITORY||marker.previewRepository!==PREVIEW_REPOSITORY||marker.siteBranch!==SITE_BRANCH)throw Error('Existing repository is not a recognised Bellwether preview; nothing was overwritten.');
}
export function canInitializePreviewRepository(repository,branches){
  return repository?.full_name===PREVIEW_REPOSITORY && repository.private===false && repository.fork===false && repository.size===0 && Array.isArray(branches) && branches.length===0;
}
export function preparePreviewArtifact(input,output,{sourceCommit,publishedAt}){
  input=resolve(input);output=resolve(output);
  if(input===output||input.startsWith(output+sep)||output.startsWith(input+sep))throw Error('Build and publication directories must not overlap.');
  const original=readFileSync(join(input,'index.html'),'utf8');
  if(!original.includes('<title>'))throw Error('Build has no HTML title.');
  rmSync(output,{recursive:true,force:true});cpSync(input,output,{recursive:true});
  rmSync(join(output,'CNAME'),{force:true}); // never inherit a production custom domain
  writeFileSync(join(output,'index.html'),original.replace(/<title>[^<]*<\/title>/,'<title>Shattered Reef — Bellwether Preview</title>'));
  writeFileSync(join(output,'.nojekyll'),'');
  writeFileSync(join(output,'preview.json'),JSON.stringify({kind:MARKER,sourceRepository:PRODUCTION_REPOSITORY,sourceBranch:SOURCE_BRANCH,sourceCommit,previewRepository:PREVIEW_REPOSITORY,siteBranch:SITE_BRANCH,redesignDefault:true,saveKey:'shattered-reef.save.bellwether-phase2-v1',publishedAt},null,2)+'\n');
}
function run(command,args,options={}){
  return execFileSync(command,args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],...options}).trim();
}
function api(method,path,body){
  const args=['api','--method',method,path];
  if(body)args.push('--input','-');
  const text=run('gh',args,body?{input:JSON.stringify(body)}:{});
  return text?JSON.parse(text):null;
}
function is404(error){return String(error.stderr??'').includes('404');}
function git(cwd,args){return run('git',['-C',cwd,...args]);}
async function main(){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const publish=process.argv.includes('--publish');
  if(process.argv.slice(2).some(a=>!['--publish','--prepare-only'].includes(a)))throw Error('Use --prepare-only or --publish.');
  assertPreviewTarget(PREVIEW_REPOSITORY);
  if(git(root,['branch','--show-current'])!==SOURCE_BRANCH)throw Error(`Check out ${SOURCE_BRANCH} before building the preview.`);
  if(git(root,['status','--porcelain']))throw Error('Commit source changes before producing a traceable preview build.');
  const sourceCommit=git(root,['rev-parse','HEAD']);
  const productionBefore=git(root,['ls-remote',SOURCE_URL,'refs/heads/main']).split(/\s/)[0];
  execFileSync('npm',['run','build'],{cwd:root,env:{...process.env,VITE_BELLWETHER_REDESIGN:'1',VITE_BELLWETHER_PREVIEW:'1'},stdio:'inherit'});
  const artifact=join(root,'.preview-dist','site');
  preparePreviewArtifact(join(root,'dist'),artifact,{sourceCommit,publishedAt:new Date().toISOString()});
  writeFileSync(join(root,'.preview-dist','production-before.json'),JSON.stringify({repository:PRODUCTION_REPOSITORY,main:productionBefore},null,2)+'\n');
  console.log(`Prepared preview-only artifact: ${artifact}`);
  if(!publish)return;
  // Everything below targets the separate repository; no production settings or branch writes exist here.
  const remoteSource=git(root,['ls-remote',SOURCE_URL,`refs/heads/${SOURCE_BRANCH}`]).split(/\s/)[0];
  if(remoteSource!==sourceCommit)throw Error('Push the source branch before publishing its preview.');
  const account=api('GET','user').login;
  if(account.toLowerCase()!=='f2456hhchv-bit')throw Error('The authenticated account does not own the requested preview repository.');
  let newlyCreated=false,repository;
  try{repository=api('GET',`repos/${PREVIEW_REPOSITORY}`);}
  catch(error){
    if(!is404(error))throw error;
    repository=api('POST','user/repos',{name:PREVIEW_REPOSITORY.split('/')[1],private:false,description:'Isolated Bellwether redesign preview; the live Shattered Reef deployment remains separate.'});newlyCreated=true;
  }
  if(repository.private)throw Error('Existing preview repository is private; refusing to expose unrelated content.');
  if(!newlyCreated){
    const branches=api('GET',`repos/${PREVIEW_REPOSITORY}/branches?per_page=1`);
    if(!canInitializePreviewRepository(repository,branches)){
      const marker=api('GET',`repos/${PREVIEW_REPOSITORY}/contents/preview.json?ref=${SITE_BRANCH}`);
      assertExistingPreview(JSON.parse(Buffer.from(marker.content,'base64').toString('utf8')));
    }
  }
  let needsPages=true;
  if(!newlyCreated){
    try{
      const pages=api('GET',`repos/${PREVIEW_REPOSITORY}/pages`);
      if(pages.source?.branch!==SITE_BRANCH||pages.source?.path!=='/'||pages.build_type!=='legacy')throw Error('Existing preview Pages configuration differs; refusing to change it.');
      needsPages=false;
    }catch(error){if(!is404(error))throw error;}
  }
  const temp=mkdtempSync(join(tmpdir(),'bellwether-preview-publish-')),checkout=join(temp,'repo');
  try{
    run('git',['clone',`https://github.com/${PREVIEW_REPOSITORY}.git`,checkout]);
    const local=git(checkout,['branch','--list',SITE_BRANCH]);
    const remote=git(checkout,['for-each-ref','--format=%(refname)',`refs/remotes/origin/${SITE_BRANCH}`]);
    if(local)git(checkout,['switch',SITE_BRANCH]);
    else if(remote)git(checkout,['switch','-c',SITE_BRANCH,'--track',`origin/${SITE_BRANCH}`]);
    else git(checkout,['switch','-c',SITE_BRANCH]);
    // The recognised publication repository contains only site files. Keep Git metadata and replace its site tree.
    for(const name of (await import('node:fs')).readdirSync(checkout))if(name!=='.git')rmSync(join(checkout,name),{recursive:true,force:true});
    cpSync(artifact,checkout,{recursive:true});
    git(checkout,['config','user.name','Bellwether Preview']);git(checkout,['config','user.email','bellwether-preview@users.noreply.github.com']);
    git(checkout,['add','--all']);
    if(git(checkout,['status','--porcelain']))git(checkout,['commit','-m',`Publish isolated Bellwether preview ${sourceCommit.slice(0,12)}`]);
    git(checkout,['push','origin',`HEAD:refs/heads/${SITE_BRANCH}`]); // fast-forward only, never force
    if(needsPages)api('POST',`repos/${PREVIEW_REPOSITORY}/pages`,{build_type:'legacy',source:{branch:SITE_BRANCH,path:'/'}});
    // Existing branch-based Pages sites rebuild automatically after the fast-forward push.
    const productionAfter=git(root,['ls-remote',SOURCE_URL,'refs/heads/main']).split(/\s/)[0];
    if(productionAfter!==productionBefore)throw Error('Production main changed externally during deployment; no production write was made by this script.');
    console.log('Preview deployment requested. Verify the public site before reporting it live.');
    console.log(`Expected URL: https://f2456hhchv-bit.github.io/${PREVIEW_REPOSITORY.split('/')[1]}/`);
    rmSync(temp,{recursive:true,force:true});
  }catch(error){console.error(`Publication checkout retained for recovery: ${checkout}`);throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);if(error.stderr)console.error(String(error.stderr));process.exitCode=1;});
