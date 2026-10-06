import type { CellPlan, CellResult, CellStatus, ResolvedRef, ScanReport, TestCommand } from './types.ts';

const statuses=new Set<CellStatus>(['passed','test-failed','merge-conflict','timeout','cancelled','error','not-run']);
function invalid(path:string):never { throw new Error(`Invalid report field: ${path}`); }
function object(value:unknown,path:string):Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value))invalid(path);
  return value as Record<string,unknown>;
}
function text(value:unknown,path:string,max=512):string {
  if(typeof value!=='string'||value.length>max||value.includes('\0'))invalid(path);
  return value;
}
function bool(value:unknown,path:string):boolean {if(typeof value!=='boolean')invalid(path);return value;}
function number(value:unknown,path:string,min:number,max:number,integer=false):number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))invalid(path);
  return value;
}
function sha(value:unknown,path:string):string {
  const result=text(value,path,64);if(!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(result))invalid(path);return result;
}
function ref(value:unknown,path:string):ResolvedRef {
  const v=object(value,path);const label=text(v.label,path+'.label');if(!label.length)invalid(path+'.label');
  return {label,sha:sha(v.sha,path+'.sha')};
}
function date(value:unknown,path:string):string {
  const result=text(value,path,32);if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(result)||!Number.isFinite(Date.parse(result)))invalid(path);
  return result;
}
export function validateCommand(value:unknown):TestCommand {
  const v=object(value,'command');
  if(v.mode==='shell'){
    const result=text(v.text,'command.text',32_768);if(!result.trim())invalid('command.text');return {mode:'shell',text:result};
  }
  if(v.mode==='argv'&&Array.isArray(v.argv)&&v.argv.length>=1&&v.argv.length<=128){
    const argv=v.argv.map((a,i)=>text(a,`command.argv.${i}`,32_768));
    if(!argv[0].trim())invalid('command.argv.0');return {mode:'argv',argv};
  }
  return invalid('command.mode');
}
export function makePlan(count:number):CellPlan[] {
  if(!Number.isInteger(count)||count<2||count>5)throw new Error('Choose two to five distinct candidate commits.');
  const result:CellPlan[]=[{id:'base',kind:'base',indices:[]}];
  for(let i=0;i<count;i++)result.push({id:`single-${i}`,kind:'single',indices:[i]});
  for(let i=0;i<count;i++)for(let j=0;j<count;j++)if(i!==j)result.push({id:`pair-${i}-${j}`,kind:'pair',indices:[i,j]});
  return result;
}
export function markInteractions(cells:CellResult[]):CellResult[] {
  const basePassed=cells.find(c=>c.id==='base')?.status==='passed';
  const singles=new Map(cells.filter(c=>c.kind==='single').map(c=>[c.indices[0],c.status]));
  return cells.map(c=>({...c,indices:[...c.indices],conflictPaths:[...c.conflictPaths],
    interactionFailure:basePassed&&c.kind==='pair'&&c.status==='test-failed'&&c.indices.length===2&&
      singles.get(c.indices[0])==='passed'&&singles.get(c.indices[1])==='passed'}));
}
export function validateReport(value:unknown):ScanReport {
  const v=object(value,'report');if(v.schemaVersion!==1)invalid('schemaVersion');
  const base=ref(v.base,'base');if(!Array.isArray(v.refs))invalid('refs');
  const plans=makePlan(v.refs.length),refs=v.refs.map((r,i)=>ref(r,`refs.${i}`));
  if(new Set(refs.map(r=>r.sha)).size!==refs.length||refs.some(r=>r.sha.length!==base.sha.length))invalid('refs.sha');
  if(!Array.isArray(v.cells)||v.cells.length!==plans.length)invalid('cells');
  const cells:CellResult[]=v.cells.map((input,i)=>{
    const c=object(input,`cells.${i}`),p=plans[i];
    if(c.id!==p.id||c.kind!==p.kind||!Array.isArray(c.indices)||c.indices.length!==p.indices.length||
      c.indices.some((n,j)=>n!==p.indices[j]))invalid(`cells.${i}.plan`);
    if(!statuses.has(c.status as CellStatus))invalid(`cells.${i}.status`);
    const status=c.status as CellStatus;
    const exitCode=c.exitCode===null?null:number(c.exitCode,`cells.${i}.exitCode`,-2_147_483_648,4_294_967_295,true);
    if((status==='passed'&&exitCode!==0)||(status==='test-failed'&&(exitCode===null||exitCode===0)))invalid(`cells.${i}.exitCode`);
    const log=text(c.log,`cells.${i}.log`,262_144);if(Buffer.byteLength(log,'utf8')>262_144)invalid(`cells.${i}.log`);
    if(!Array.isArray(c.conflictPaths)||c.conflictPaths.length>1000)invalid(`cells.${i}.conflictPaths`);
    const result:CellResult={...p,indices:[...p.indices],status,exitCode,
      elapsedMs:number(c.elapsedMs,`cells.${i}.elapsedMs`,0,2_678_400_000),log,
      logTruncated:bool(c.logTruncated,`cells.${i}.logTruncated`),
      conflictPaths:c.conflictPaths.map((p,j)=>text(p,`cells.${i}.conflictPaths.${j}`,4096)),
      interactionFailure:bool(c.interactionFailure,`cells.${i}.interactionFailure`)};
    if(c.treeSha!==undefined){result.treeSha=sha(c.treeSha,`cells.${i}.treeSha`);if(result.treeSha.length!==base.sha.length)invalid(`cells.${i}.treeSha`);}
    return result;
  });
  const marked=markInteractions(cells);
  if(cells.some((c,i)=>c.interactionFailure!==marked[i].interactionFailure))invalid('cells.interactionFailure');
  if(!Array.isArray(v.cleanupErrors)||v.cleanupErrors.length>100)invalid('cleanupErrors');
  const environment=object(v.environment,'environment');
  const version=text(v.toolVersion,'toolVersion',100);if(!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version))invalid('toolVersion');
  const repoName=text(v.repoName,'repoName',256);if(!repoName)invalid('repoName');
  return {schemaVersion:1,toolVersion:version,repoName,base,refs,cells,
    startedAt:date(v.startedAt,'startedAt'),finishedAt:date(v.finishedAt,'finishedAt'),
    command:validateCommand(v.command),commandRedacted:bool(v.commandRedacted,'commandRedacted'),
    timeoutMs:number(v.timeoutMs,'timeoutMs',1000,3_600_000,true),
    environment:{node:text(environment.node,'environment.node',100),git:text(environment.git,'environment.git',500),platform:text(environment.platform,'environment.platform',100)},
    cancelled:bool(v.cancelled,'cancelled'),cleanupErrors:v.cleanupErrors.map((e,i)=>text(e,`cleanupErrors.${i}`,4096))};
}
export function getExitCode(report:ScanReport):number {
  if(report.cancelled)return 130;
  if(report.cleanupErrors.length||report.cells.some(c=>c.status==='error')||report.cells.every(c=>c.status==='not-run'))return 2;
  if(report.cells.some(c=>['test-failed','merge-conflict','timeout'].includes(c.status)))return 1;
  if(report.cells.some(c=>c.status==='cancelled'))return 130;
  return 0;
}
