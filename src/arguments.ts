import { parseArgs } from 'node:util';
import { makePlan,validateCommand } from './model.ts';
import type { Locale,TestCommand } from './types.ts';

type Common={repo:string;out:string;locale:Locale};
export type CliArguments={mode:'help'}|{mode:'version'}|
  (Common&{mode:'run';base:string;refs:string[];command:TestCommand;timeoutMs:number})|
  (Common&{mode:'reproduce';report:string;cell:string;command?:TestCommand;timeoutMs?:number});
export function parseCli(input:string[]):CliArguments {
  if(input.length===0||input[0]==='help')return {mode:'help'};
  if(input[0]==='version'||input[0]==='--version')return {mode:'version'};
  if(input[0]==='--help')return {mode:'help'};
  const mode=input[0];if(mode!=='run'&&mode!=='reproduce')throw new Error('Use run, reproduce or help.');
  const tail=input.slice(1),separator=tail.indexOf('--');
  const options=separator<0?tail:tail.slice(0,separator),argv=separator<0?undefined:tail.slice(separator+1);
  const {values}=parseArgs({args:options,allowPositionals:false,strict:true,options:{
    repo:{type:'string',default:'.'},out:{type:'string'},base:{type:'string'},ref:{type:'string',multiple:true},
    test:{type:'string'},timeout:{type:'string'},locale:{type:'string',default:'en'},report:{type:'string'},cell:{type:'string'},
    help:{type:'boolean',short:'h'},version:{type:'boolean'},
  }});
  if(values.help)return{mode:'help'};if(values.version)return{mode:'version'};
  if(values.locale!=='en'&&values.locale!=='zh')throw new Error('Choose en or zh with --locale.');
  if(!values.out?.trim())throw new Error('Use --out with a new directory outside the repository.');
  const common:Common={repo:values.repo!,out:values.out,locale:values.locale};
  if(argv!==undefined&&values.test!==undefined)throw new Error('Choose --test or the program after --.');
  const command=argv!==undefined?validateCommand({mode:'argv',argv}):
    values.test!==undefined?validateCommand({mode:'shell',text:values.test}):undefined;
  let timeoutMs:number|undefined;
  if(values.timeout!==undefined){
    if(!/^[1-9]\d*$/.test(values.timeout)||Number(values.timeout)>3600)throw new Error('Use an integer timeout between 1 and 3600 seconds.');
    timeoutMs=Number(values.timeout)*1000;
  }
  if(mode==='run'){
    if(values.report||values.cell)throw new Error('--report and --cell belong to reproduce.');
    if(!values.base?.trim())throw new Error('Choose a baseline with --base.');
    const refs=values.ref||[];makePlan(refs.length);if(refs.some(r=>!r.trim()||r.length>512||r.includes('\0')))throw new Error('Use nonempty Git refs.');
    if(!command)throw new Error('Choose a test command with --test or after --.');
    return {...common,mode,base:values.base,refs,command,timeoutMs:timeoutMs??120000};
  }
  if(values.base||values.ref)throw new Error('Reproduce reads fixed commits from --report; omit --base and --ref.');
  if(!values.report?.trim()||!values.cell?.trim())throw new Error('Choose --report and --cell for reproduce.');
  return {...common,mode,report:values.report,cell:values.cell,command,timeoutMs};
}
export const helpText=`Branch Compare — test branches and their ordered combinations

Run:
  branch-compare run --repo ./repo --base main --ref A --ref C --out ./report -- node --test
  branch-compare run --repo ./repo --base main --ref A --ref C --out ./report --test "npm ci && npm test"

Reproduce one result at the recorded commit SHAs:
  branch-compare reproduce --repo ./repo --report ./report/report.json --cell pair-0-1 --out ./replay

Options:
  --repo PATH       Existing local Git worktree (default: .)
  --base REF        Baseline for run
  --ref REF         Repeat 2–5 times; each commit must contain the baseline
  --out PATH        New output directory outside the source repository
  --test COMMAND    Explicit shell command; alternatively pass a program after --
  --timeout SECS    Per-cell test timeout, 1–3600 (default: 120)
  --locale en|zh    Initial report language (default: en)
  --help, -h        Show this help
  --version         Show version

Outputs: report.html, report.json, logs/*.txt.
Exit: 0 passed, 1 test failure/conflict/timeout, 2 input or infrastructure error, 130 cancelled.
The report can be opened offline. 测试结果可在离线报告中切换中英文。
`;
