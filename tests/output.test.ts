import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,readFile,writeFile,rm,readdir,symlink,realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureOutputLocation,writeArtifacts } from '../src/output.ts';
import type { ScanReport } from '../src/types.ts';

function report():ScanReport {
  const cell=(id:string,kind:'base'|'single'|'pair',indices:number[])=>({id,kind,indices,status:'passed' as const,
    elapsedMs:12,exitCode:0,log:'safe log\n',logTruncated:false,conflictPaths:[],interactionFailure:false});
  return {schemaVersion:1,toolVersion:'0.1.0',repoName:'demo',startedAt:'2026-10-06T10:00:00.000Z',finishedAt:'2026-10-06T10:00:01.000Z',
    base:{label:'main',sha:'1'.repeat(40)},refs:[{label:'A',sha:'2'.repeat(40)},{label:'C',sha:'3'.repeat(40)}],
    command:{mode:'argv',argv:['node','--test']},commandRedacted:false,timeoutMs:120000,
    environment:{node:'v24.15.0',git:'git version 2.41.0',platform:process.platform},cancelled:false,cleanupErrors:[],
    cells:[cell('base','base',[]),cell('single-0','single',[0]),cell('single-1','single',[1]),cell('pair-0-1','pair',[0,1]),cell('pair-1-0','pair',[1,0])]};
}
async function setup(){const root=await mkdtemp(join(tmpdir(),'branch-output-test-'));const source=join(root,'source');await mkdir(source);return{root,source};}
test('refuses to write into the source tree while allowing a new sibling directory',async()=>{
  const {root,source}=await setup();try {
    await assert.rejects(ensureOutputLocation(join(source,'reports'),[source]));
    assert.equal(await ensureOutputLocation(join(root,'report'),[source]),join(await realpath(root),'report'));
  }finally{await rm(root,{recursive:true,force:true});}
});
test('preserves existing output files without overwriting a report',async()=>{
  const {root,source}=await setup();try {
    const target=join(root,'report');await mkdir(target);await writeFile(join(target,'report.json'),'KEEP');
    await assert.rejects(writeArtifacts(report(),target,'en',[source]));
    assert.equal(await readFile(join(target,'report.json'),'utf8'),'KEEP');
  }finally{await rm(root,{recursive:true,force:true});}
});
test('writes a complete validated JSON report, HTML and one log per actual cell',async()=>{
  const {root,source}=await setup();try {
    const input=report();input.cells[3].log='<script>globalThis.injected=true</script>\n';
    const target=join(root,'nested','report');const output=await writeArtifacts(input,target,'zh',[source]);
    assert.equal(output.outputDir,await realpath(target));assert.deepEqual(JSON.parse(await readFile(output.json,'utf8')),input);
    assert.equal(await readFile(join(target,'logs','pair-0-1.txt'),'utf8'),input.cells[3].log);
    assert.equal((await readdir(join(target,'logs'))).length,5);
    assert.match(await readFile(output.html,'utf8'),/Branch Compare/);
    assert.deepEqual(await readdir(source),[]);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('rejects malformed reports before creating any output directory',async()=>{
  const {root,source}=await setup();try {
    const target=join(root,'report'),bad=report();bad.cells[3].id='../outside';
    await assert.rejects(writeArtifacts(bad,target,'en',[source]));
    assert.deepEqual(await readdir(root),['source']);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('detects an output parent junction that leads back into the protected source',async()=>{
  const {root,source}=await setup();try {
    await symlink(source,join(root,'alias'),process.platform==='win32'?'junction':'dir');
    await assert.rejects(ensureOutputLocation(join(root,'alias','report'),[source]));
    assert.deepEqual(await readdir(source),[]);
  }finally{await rm(root,{recursive:true,force:true});}
});
