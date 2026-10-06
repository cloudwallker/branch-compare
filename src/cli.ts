#!/usr/bin/env node
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCli,helpText } from './arguments.ts';
import { getExitCode,validateReport } from './model.ts';
import { resolveRepository,runScan } from './runner.ts';
import { ensureOutputLocation,writeArtifacts } from './output.ts';
import { redactText } from './redact.ts';
import type { ScanReport,ScanOptions } from './types.ts';

async function readReport(path:string):Promise<ScanReport> {
  const file=await open(path,'r');
  try{
    const info=await file.stat();if(!info.isFile()||info.size>16*1024*1024)throw new Error('Choose a report JSON file of at most 16 MiB.');
    const buffer=Buffer.alloc(info.size+1),result=await file.read(buffer,0,buffer.length,0);
    if(result.bytesRead>info.size)throw new Error('Report changed while it was being read.');
    const text=new TextDecoder('utf8',{fatal:true}).decode(buffer.subarray(0,result.bytesRead));
    return validateReport(JSON.parse(text));
  }finally{await file.close();}
}
export async function main(input:string[]):Promise<number> {
  let controller:AbortController|undefined;
  const abort=()=>controller?.abort();
  try{
    const args=parseCli(input);
    if(args.mode==='help'){console.log(helpText);return 0;}
    if(args.mode==='version'){console.log('0.1.0');return 0;}
    const recorded=args.mode==='reproduce'?await readReport(args.report):undefined;
    if(recorded&&args.mode==='reproduce'){
      if(!recorded.cells.some(c=>c.id===args.cell))throw new Error('Choose a cell ID from the recorded report.');
      if(recorded.commandRedacted&&!args.command)throw new Error('The recorded command was redacted. Supply a replacement with --test or after --.');
    }
    const {repoPath,commonDir}=await resolveRepository(args.repo);
    const protectedPaths=[repoPath,commonDir];
    const target=await ensureOutputLocation(args.out,protectedPaths);
    controller=new AbortController();process.once('SIGINT',abort);process.once('SIGTERM',abort);
    let completed=0;
    const options:ScanOptions=args.mode==='run'?{
      repo:repoPath,base:args.base,refs:args.refs,command:args.command,timeoutMs:args.timeoutMs,
    }:{
      repo:repoPath,base:recorded!.base.sha,refs:recorded!.refs.map(r=>r.sha),
      command:args.command??recorded!.command,timeoutMs:args.timeoutMs??recorded!.timeoutMs,onlyCell:args.cell,
    };
    if(args.mode==='reproduce') {
      const cell=recorded!.cells.find(c=>c.id===args.cell)!;
      console.error(`Replaying ${args.cell} at the recorded commit SHAs.`);
      console.error(`Baseline: ${recorded!.base.sha}`);
      console.error(`Merge order: ${cell.indices.map(i=>recorded!.refs[i]!.sha).join(' -> ')||'(baseline only)'}`);
    }
    const report=await runScan({...options,signal:controller.signal,onCell:cell=>{
      completed++;console.error(`[${completed}] ${cell.id}: ${cell.status}`);
    }});
    if(recorded&&args.mode==='reproduce'){
      report.base={...recorded.base};report.refs=recorded.refs.map(r=>({...r}));
      const previous=recorded.cells.find(c=>c.id===args.cell)!,current=report.cells.find(c=>c.id===args.cell)!;
      if(previous.treeSha&&current.treeSha&&previous.treeSha!==current.treeSha){
        current.status='error';current.interactionFailure=false;current.log='Replayed tree differs from the recorded tree.\n'+current.log;
        // Keep the shared log size limit even when adding replay diagnostics.
        while(Buffer.byteLength(current.log)>262144)current.log=current.log.slice(0,-256);
        current.logTruncated=true;
      }
    }
    const files=await writeArtifacts(report,target,args.locale,protectedPaths);
    console.log(`HTML: ${files.html}\nJSON: ${files.json}`);
    return getExitCode(report);
  }catch(error){
    const message=error instanceof Error?error.message:'Execution failed.';
    console.error(redactText(message,{environment:process.env}));return 2;
  }finally{
    process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  process.exitCode=await main(process.argv.slice(2));
