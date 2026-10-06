import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCli } from '../src/arguments.ts';

test('keeps program arguments literal rather than making a shell command',()=>{
  const result=parseCli(['run','--base','main','--ref','A','--ref','C','--out','../report','--','node','--test','a file.mjs','']);
  assert.equal(result.mode,'run');if(result.mode!=='run')return;
  assert.deepEqual(result.command,{mode:'argv',argv:['node','--test','a file.mjs','']});
  assert.equal(result.timeoutMs,120000);assert.equal(result.locale,'en');
});
test('accepts an explicit shell command and report language',()=>{
  const result=parseCli(['run','--base','main','--ref','A','--ref','C','--out','../report','--locale','zh','--timeout','3','--test','node --test']);
  assert.equal(result.mode,'run');if(result.mode!=='run')return;
  assert.deepEqual(result.command,{mode:'shell',text:'node --test'});assert.equal(result.timeoutMs,3000);assert.equal(result.locale,'zh');
});
test('replay can use its stored command or an explicit replacement',()=>{
  const common=['reproduce','--report','report.json','--cell','pair-0-1','--out','replay'];
  const stored=parseCli(common);assert.equal(stored.mode,'reproduce');if(stored.mode!=='reproduce')return;
  assert.equal(stored.command,undefined);assert.equal(stored.timeoutMs,undefined);
  const override=parseCli([...common,'--','node','--test']);assert.equal(override.mode,'reproduce');
  if(override.mode==='reproduce')assert.deepEqual(override.command,{mode:'argv',argv:['node','--test']});
});
for(const args of [
  ['unknown'],['run'],['run','--base','main','--ref','A','--out','report','--test','node --test'],
  ['run','--base','main','--ref','A','--ref','C','--out','report'],
  ['run','--base','main','--ref','A','--ref','C','--out','report','--test','node --test','--','node'],
  ['run','--base','main','--ref','A','--ref','C','--out','report','--test',''],
  ['reproduce','--report','report.json','--out','replay'],
  ['reproduce','--report','report.json','--cell','base','--out','replay','--base','main'],
])test(`rejects incomplete or conflicting parameters ${JSON.stringify(args)}`,()=>assert.throws(()=>parseCli(args)));
for(const timeout of ['0','3601','1.5','-1','NaN'])test(`rejects timeout ${timeout}`,()=>{
  assert.throws(()=>parseCli(['run','--base','main','--ref','A','--ref','C','--out','report','--test','node --test','--timeout',timeout]));
});
test('help and version work before Git or execution parameters are required',()=>{
  assert.equal(parseCli([]).mode,'help');assert.equal(parseCli(['run','--help']).mode,'help');
  assert.equal(parseCli(['--version']).mode,'version');
});
