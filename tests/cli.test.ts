import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,readFile,writeFile,rm,readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname,join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function cli(args:string[]){return spawnSync(process.execPath,[join(project,'src','cli.ts'),...args],{
  cwd:project,encoding:'utf8',env:{...process.env,PATH:dirname(process.execPath)+(process.platform==='win32'?';':':')+process.env.PATH},timeout:60000,
});}
test('CLI help and version are runnable without a repository',()=>{
  const help=cli(['--help']);assert.equal(help.status,0,help.stderr);assert.match(help.stdout,/Branch Compare/);
  const version=cli(['--version']);assert.equal(version.status,0,version.stderr);assert.match(version.stdout,/0\.1\.0/);
});
test('actual CLI finds a no-conflict interaction and replays pinned commits after refs move',async()=>{
  const root=await mkdtemp(join(tmpdir(),'branch-cli-test-'));
  try {
    const {createDemo}=await import('../examples/create-demo.mjs');
    const repo=join(root,'repo'),out=join(root,'report');await createDemo(repo);
    await writeFile(join(repo,'untracked-personal.txt'),'KEEP');
    const args=['run','--repo',repo,'--base','main','--ref','lower-quota','--ref','docs','--ref','larger-request','--out',out,'--','node','--test','check.test.mjs'];
    const run=cli(args);assert.equal(run.status,1,run.stderr);
    const report=JSON.parse(await readFile(join(out,'report.json'),'utf8'));
    assert.equal(report.cells.length,10);assert.equal(report.cells.filter((c:any)=>c.interactionFailure).length,2);
    assert.equal(report.cells.find((c:any)=>c.id==='pair-0-2').status,'test-failed');
    assert.equal(report.cells.find((c:any)=>c.id==='pair-2-0').status,'test-failed');
    assert.ok(report.cells.slice(0,4).every((c:any)=>c.status==='passed'));
    assert.equal(report.commandRedacted,false);assert.match(await readFile(join(out,'report.html'),'utf8'),/Branch Compare/);
    assert.equal(await readFile(join(repo,'untracked-personal.txt'),'utf8'),'KEEP');
    const moved=spawnSync('git',['-C',repo,'branch','-f','lower-quota','larger-request'],{encoding:'utf8'});assert.equal(moved.status,0,moved.stderr);
    const replay=cli(['reproduce','--repo',repo,'--report',join(out,'report.json'),'--cell','pair-0-2','--out',join(root,'replay')]);
    assert.equal(replay.status,1,replay.stderr);
    assert.ok(replay.stderr.includes(report.base.sha));
    assert.ok(replay.stderr.indexOf(report.refs[0].sha)<replay.stderr.indexOf(report.refs[2].sha));
    assert.ok(replay.stderr.includes(report.refs[2].sha));
    const replayReport=JSON.parse(await readFile(join(root,'replay','report.json'),'utf8'));
    const selected=replayReport.cells.find((c:any)=>c.id==='pair-0-2');
    assert.equal(selected.status,'test-failed');assert.equal(selected.treeSha,report.cells.find((c:any)=>c.id==='pair-0-2').treeSha);
    assert.ok(replayReport.cells.filter((c:any)=>c.id!=='pair-0-2').every((c:any)=>c.status==='not-run'));
    assert.deepEqual(replayReport.refs,report.refs);
    const redactedFile=join(root,'redacted.json');
    await writeFile(redactedFile,JSON.stringify({...report,commandRedacted:true,command:{mode:'argv',argv:['[REDACTED]']}}));
    const blockedOut=join(root,'blocked-replay');
    const blocked=cli(['reproduce','--repo',repo,'--report',redactedFile,'--cell','pair-0-2','--out',blockedOut]);
    assert.equal(blocked.status,2);assert.match(blocked.stderr,/Supply a replacement/);
    assert.ok(!(await readdir(root)).includes('blocked-replay'));
    const override=cli(['reproduce','--repo',repo,'--report',redactedFile,'--cell','pair-0-2','--out',join(root,'override-replay'),'--','node','--test','check.test.mjs']);
    assert.equal(override.status,1,override.stderr);
    const overridden=JSON.parse(await readFile(join(root,'override-replay','report.json'),'utf8'));
    assert.equal(overridden.cells.find((c:any)=>c.id==='pair-0-2').treeSha,selected.treeSha);
    assert.equal(overridden.commandRedacted,false);
    const second=cli(args);assert.equal(second.status,2);assert.deepEqual(JSON.parse(await readFile(join(out,'report.json'),'utf8')),report);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('source protection uses repository root even when --repo points to a nested directory',async()=>{
  const root=await mkdtemp(join(tmpdir(),'branch-cli-test-'));
  try {
    const {createDemo}=await import('../examples/create-demo.mjs');const repo=join(root,'repo');await createDemo(repo);await mkdir(join(repo,'nested'));
    const run=cli(['run','--repo',join(repo,'nested'),'--base','main','--ref','lower-quota','--ref','larger-request','--out',join(repo,'report'),'--test','node --test']);
    assert.equal(run.status,2,run.stderr);assert.ok(!(await readdir(repo)).includes('report'));
  }finally{await rm(root,{recursive:true,force:true});}
});
test('malformed replay data is rejected without running its test command',async()=>{
  const root=await mkdtemp(join(tmpdir(),'branch-cli-test-'));
  try {
    const file=join(root,'bad.json');await writeFile(file,JSON.stringify({schemaVersion:1,command:{mode:'shell',text:'arbitrary-command'}}));
    const run=cli(['reproduce','--repo',root,'--report',file,'--cell','base','--out',join(root,'report')]);
    assert.equal(run.status,2);assert.deepEqual(await readdir(root),['bad.json']);
  }finally{await rm(root,{recursive:true,force:true});}
});
