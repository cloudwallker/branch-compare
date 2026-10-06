import { lstat,realpath,mkdir,mkdtemp,writeFile,readFile,rename,unlink,rm } from 'node:fs/promises';
import { dirname,basename,join,relative,resolve,isAbsolute,sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateReport } from './model.ts';
import { renderReportHtml } from './report.ts';
import type { Locale,ScanReport } from './types.ts';

function contains(root:string,path:string):boolean {
  const r=relative(root,path);return r===''||(!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r));
}
async function exists(path:string):Promise<boolean> {
  try{await lstat(path);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}
}
async function canonicalNewPath(path:string):Promise<string> {
  let cursor=resolve(path);const suffix:string[]=[];
  while(!await exists(cursor)){
    const parent=dirname(cursor);if(parent===cursor)throw new Error('Output parent is unavailable.');
    suffix.unshift(basename(cursor));cursor=parent;
  }
  const canonical=await realpath(cursor),info=await lstat(canonical);
  if(!info.isDirectory())throw new Error('Output parent must be a directory.');
  return join(canonical,...suffix);
}
export async function ensureOutputLocation(outputDir:string,protectedPaths:readonly string[]):Promise<string> {
  if(!outputDir.trim()||outputDir.includes('\0'))throw new Error('Choose a new output directory.');
  if(await exists(resolve(outputDir)))throw new Error('Output already exists. Choose a new directory.');
  const target=await canonicalNewPath(outputDir);
  for(const protectedPath of protectedPaths){
    const root=await realpath(protectedPath);
    if(contains(root,target))throw new Error('Choose an output directory outside the source repository and Git metadata.');
  }
  return target;
}
async function removeOwned(directory:string,parent:string,owner:string):Promise<void> {
  if(!await exists(directory))return;
  const info=await lstat(directory);
  if(info.isSymbolicLink()||!info.isDirectory()||!contains(parent,directory)||dirname(directory)!==parent||
    await realpath(directory)!==directory||await readFile(join(directory,'.branch-compare-owner'),'utf8')!==owner)
    throw new Error('Output cleanup ownership check failed.');
  await rm(directory,{recursive:true,force:true});
}
export async function writeArtifacts(input:ScanReport,outputDir:string,locale:Locale='en',protectedPaths:readonly string[]=[])
  :Promise<{outputDir:string;html:string;json:string}> {
  const report=validateReport(input),target=await ensureOutputLocation(outputDir,protectedPaths);
  if(locale!=='en'&&locale!=='zh')throw new Error('Choose en or zh for the report language.');
  const html=renderReportHtml(report,locale),json=JSON.stringify(report,null,2)+'\n';
  const parent=dirname(target);await mkdir(parent,{recursive:true,mode:0o700});
  await ensureOutputLocation(target,protectedPaths);
  const stage=await mkdtemp(join(parent,'.branch-compare-stage-')),owner=randomUUID();let reserved=false;
  await writeFile(join(stage,'.branch-compare-owner'),owner,{flag:'wx',mode:0o600});
  try {
    await mkdir(join(stage,'logs'),{mode:0o700});
    for(const cell of report.cells)
      await writeFile(join(stage,'logs',cell.id+'.txt'),cell.log,{flag:'wx',mode:0o600});
    await writeFile(join(stage,'report.json'),json,{flag:'wx',mode:0o600});
    await writeFile(join(stage,'report.html'),html,{flag:'wx',mode:0o600});
    await ensureOutputLocation(target,protectedPaths);
    await mkdir(target,{mode:0o700});reserved=true;
    await writeFile(join(target,'.branch-compare-owner'),owner,{flag:'wx',mode:0o600});
    await rename(join(stage,'logs'),join(target,'logs'));
    await rename(join(stage,'report.json'),join(target,'report.json'));
    await rename(join(stage,'report.html'),join(target,'report.html'));
    await unlink(join(target,'.branch-compare-owner'));
    return {outputDir:target,html:join(target,'report.html'),json:join(target,'report.json')};
  } catch(error) {
    if(reserved)await removeOwned(target,parent,owner);
    throw error;
  } finally {await removeOwned(stage,parent,owner);}
}
