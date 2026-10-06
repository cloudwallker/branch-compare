import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fixture,git } from './helpers/git-fixture.ts';
import { runScan } from '../src/runner.ts';

test('five real candidate commits produce the complete 26-cell matrix',async t=>{
  const f=await fixture(t);
  for(const name of ['D','E','F'])await f.branch(name,`${name}.txt`,name+'\n');
  const report=await runScan({repo:f.repo,base:f.base,refs:['A','C','D','E','F'],
    command:{mode:'argv',argv:[process.execPath,'verify.mjs']},timeoutMs:5000,tempParent:f.scans});
  assert.equal(report.cells.length,26);assert.equal(report.cells.filter(c=>c.status==='passed').length,24);
  assert.deepEqual(report.cells.filter(c=>c.interactionFailure).map(c=>c.id),['pair-0-1','pair-1-0']);
  assert.deepEqual(report.cleanupErrors,[]);
});
test('pairwise passing checks remain distinct from a failing three-branch integration',async t=>{
  const f=await fixture(t);
  for(const name of ['one','two','three'])await writeFile(join(f.repo,`${name}.json`),'0\n');
  await writeFile(join(f.repo,'triple.mjs'),`import {readFileSync} from 'node:fs';
const total=['one','two','three'].reduce((n,name)=>n+JSON.parse(readFileSync(name+'.json','utf8')),0);
process.exit(total<3?0:9);
`);
  git(f.repo,['add','--','one.json','two.json','three.json','triple.mjs']);git(f.repo,['commit','-m','Define three independent flags']);
  const base=git(f.repo,['rev-parse','HEAD']);
  for(const name of ['one','two','three']){
    git(f.repo,['checkout','-b',`flag-${name}`,base]);await writeFile(join(f.repo,`${name}.json`),'1\n');
    git(f.repo,['add','--',`${name}.json`]);git(f.repo,['commit','-m',`Enable ${name}`]);
  }
  git(f.repo,['checkout','main']);
  const report=await runScan({repo:f.repo,base,refs:['flag-one','flag-two','flag-three'],
    command:{mode:'argv',argv:[process.execPath,'triple.mjs']},timeoutMs:5000,tempParent:f.scans});
  assert.equal(report.cells.length,10);assert.ok(report.cells.every(c=>c.status==='passed'));
  git(f.repo,['checkout','-b','full-integration',base]);
  for(const name of ['one','two','three'])git(f.repo,['merge','--no-ff','--no-edit',`flag-${name}`]);
  const full=spawnSync(process.execPath,['triple.mjs'],{cwd:f.repo});assert.equal(full.status,9);
});
