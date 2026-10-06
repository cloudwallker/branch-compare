import { mkdir,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve,join,basename } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Creates a new fictional repository; it never replaces an existing directory. */
export async function createDemo(output) {
  const root=resolve(output);await mkdir(root,{recursive:false});
  const template=join(root,'.empty-template');await mkdir(template);
  const env={...process.env};for(const key of Object.keys(env))if(/^GIT_/i.test(key))delete env[key];
  Object.assign(env,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',
    GIT_AUTHOR_NAME:'Branch Compare Demo',GIT_AUTHOR_EMAIL:'demo@branch-compare.invalid',
    GIT_COMMITTER_NAME:'Branch Compare Demo',GIT_COMMITTER_EMAIL:'demo@branch-compare.invalid',
    GIT_AUTHOR_DATE:'2026-01-01T12:00:00Z',GIT_COMMITTER_DATE:'2026-01-01T12:00:00Z'});
  function git(...args){return execFileSync('git',['-C',root,'-c','commit.gpgsign=false','-c','core.autocrlf=false','-c',`core.hooksPath=${template}`,...args],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
  git('init','-b','main',`--template=${template}`);
  await writeFile(join(root,'limits.json'),' {"quota":100}\n'.trimStart());
  await writeFile(join(root,'usage.json'),'{"items":10}\n');
  await writeFile(join(root,'README.md'),'# Fictional quota demo\n\nRequest size is checked against the committed quota.\n');
  await writeFile(join(root,'check.test.mjs'),`import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const limits=JSON.parse(readFileSync(new URL('./limits.json',import.meta.url),'utf8'));
const usage=JSON.parse(readFileSync(new URL('./usage.json',import.meta.url),'utf8'));
test('request fits the committed quota',()=>assert.ok(usage.items<=limits.quota,
  'Request '+usage.items+' exceeds quota '+limits.quota));
`);
  git('add','--','limits.json','usage.json','README.md','check.test.mjs');git('commit','-m','Create fictional quota example');
  git('checkout','-b','lower-quota','main');await writeFile(join(root,'limits.json'),'{"quota":20}\n');git('add','--','limits.json');git('commit','-m','Lower quota to twenty');
  git('checkout','-b','docs','main');await writeFile(join(root,'README.md'),'# Fictional quota demo\n\nKeep quota and request size compatible when combining releases.\n');git('add','--','README.md');git('commit','-m','Explain the quota rule');
  git('checkout','-b','larger-request','main');await writeFile(join(root,'usage.json'),'{"items":50}\n');git('add','--','usage.json');git('commit','-m','Increase request size to fifty');
  git('checkout','main');
  return {repo:root,base:'main',refs:['lower-quota','docs','larger-request']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const result=await createDemo(process.argv[2]||'demo-repo');console.log(JSON.stringify({repository:basename(result.repo),base:result.base,refs:result.refs},null,2));}
  catch{console.error('Demo creation failed. Choose a new directory and check that Git is available.');process.exitCode=2;}
}
