import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePlan, markInteractions, validateReport, getExitCode } from '../src/model.ts';
import type { ScanReport, CellResult, CellStatus } from '../src/types.ts';

const sha=(n:number)=>String(n).repeat(40);
function fixture():ScanReport {
  const plans=[{id:'base',kind:'base',indices:[]},{id:'single-0',kind:'single',indices:[0]},
    {id:'single-1',kind:'single',indices:[1]},{id:'pair-0-1',kind:'pair',indices:[0,1]},
    {id:'pair-1-0',kind:'pair',indices:[1,0]}] as const;
  return {schemaVersion:1,toolVersion:'0.1.0',repoName:'demo',startedAt:'2026-10-06T10:00:00.000Z',
    finishedAt:'2026-10-06T10:00:01.000Z',base:{label:'main',sha:sha(1)},refs:[{label:'A',sha:sha(2)},{label:'C',sha:sha(3)}],
    command:{mode:'argv',argv:['node','--test']},commandRedacted:false,timeoutMs:120_000,
    environment:{node:'v24.15.0',git:'git version 2.41.0',platform:'win32'},cancelled:false,cleanupErrors:[],
    cells:plans.map(p=>({...p,indices:[...p.indices],status:'passed',elapsedMs:50,exitCode:0,log:'ok\n',logTruncated:false,conflictPaths:[],treeSha:sha(4),interactionFailure:false}))};
}
test('creates all ordered pairs in addition to baseline and singles',()=>{
  assert.deepEqual(makePlan(2),[
    {id:'base',kind:'base',indices:[]},{id:'single-0',kind:'single',indices:[0]},
    {id:'single-1',kind:'single',indices:[1]},{id:'pair-0-1',kind:'pair',indices:[0,1]},
    {id:'pair-1-0',kind:'pair',indices:[1,0]},
  ]);
  assert.equal(makePlan(5).length,26);
  assert.equal(new Set(makePlan(5).map(p=>p.id)).size,26);
});
test('refuses input outside the two-to-five candidate range',()=>{
  for(const n of [0,1,6,2.5,NaN,Infinity])assert.throws(()=>makePlan(n));
});
test('marks a test failure only when base and both single branches passed',()=>{
  const r=fixture();r.cells[3].status='test-failed';r.cells[3].exitCode=1;
  const result=markInteractions(r.cells);assert.equal(result[3].interactionFailure,true);
  assert.equal(result[4].interactionFailure,false);assert.equal(r.cells[3].interactionFailure,false);
});
for(const index of [0,1,2])test(`a failing prerequisite ${index} prevents an interaction label`,()=>{
  const r=fixture();r.cells[index].status='test-failed';r.cells[3].status='test-failed';
  assert.equal(markInteractions(r.cells)[3].interactionFailure,false);
});
for(const status of ['merge-conflict','timeout','cancelled','error','not-run','passed'] as CellStatus[])
  test(`${status} is not a proven interaction test failure`,()=>{
    const r=fixture();r.cells[3].status=status;
    assert.equal(markInteractions(r.cells)[3].interactionFailure,false);
  });
test('reads a complete report without retaining unknown executable metadata',()=>{
  const r=fixture();const input={...r,extra:'ignored',base:{...r.base,extra:'ignored'}};
  const copy=validateReport(input);assert.deepEqual(copy,r);assert.notEqual(copy,r);
  copy.refs[0].label='changed';assert.equal(r.refs[0].label,'A');
});
test('accepts explicit shell test commands and SHA-256 repositories',()=>{
  const r=fixture();r.command={mode:'shell',text:'node --test'};
  r.base.sha='1'.repeat(64);r.refs[0].sha='2'.repeat(64);r.refs[1].sha='3'.repeat(64);
  for(const c of r.cells)c.treeSha='4'.repeat(64);
  assert.deepEqual(validateReport(r),r);
});
const invalid:Array<[string,(r:ScanReport)=>void]>=[
  ['unknown schema',r=>(r as any).schemaVersion=2],
  ['missing cell',r=>r.cells.pop()],['duplicate cell',r=>r.cells[4]=r.cells[3]],
  ['incorrect pair ordering',r=>r.cells[3].indices=[1,0]],
  ['unknown status',r=>(r.cells[0] as any).status='success'],
  ['invalid SHA',r=>r.refs[0].sha='main'],['duplicate SHA',r=>r.refs[1].sha=r.refs[0].sha],
  ['empty program',r=>r.command={mode:'argv',argv:[]}],
  ['NUL command',r=>r.command={mode:'shell',text:'node\0--test'}],
  ['invalid date',r=>r.startedAt='yesterday'],['nonfinite elapsed',r=>r.cells[0].elapsedMs=NaN],
  ['untrue success exit',r=>r.cells[0].exitCode=1],
  ['unproven interaction',r=>r.cells[3].interactionFailure=true],
  ['oversized log',r=>r.cells[0].log='😀'.repeat(65537)],
  ['out of bounds timeout',r=>r.timeoutMs=0],
];
for(const [name,mutate]of invalid)test(`rejects ${name} before replay`,()=>{
  const r=fixture();mutate(r);assert.throws(()=>validateReport(r));
});
test('normalizes a replay with unselected cells without inventing prior successes',()=>{
  const r=fixture();for(const c of r.cells){c.status='not-run';c.exitCode=null;c.log='';}
  r.cells[3].status='test-failed';r.cells[3].exitCode=1;
  const copy=validateReport(r);assert.equal(copy.cells[3].interactionFailure,false);
  assert.equal(getExitCode(copy),1);
});
test('returns useful run exit codes including incomplete and cancelled execution',()=>{
  const r=fixture();assert.equal(getExitCode(r),0);
  r.cells[3].status='test-failed';assert.equal(getExitCode(r),1);
  r.cells[3].status='timeout';assert.equal(getExitCode(r),1);
  r.cells[3].status='merge-conflict';assert.equal(getExitCode(r),1);
  r.cells[3].status='error';assert.equal(getExitCode(r),2);
  r.cells[3].status='passed';r.cleanupErrors=['cleanup failed'];assert.equal(getExitCode(r),2);
  r.cancelled=true;assert.equal(getExitCode(r),130);
});
