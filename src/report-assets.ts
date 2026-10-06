/** Kept static so one CSP hash authorizes the script, independently of report data. */
export const reportStyles = String.raw`
:root{color-scheme:light;--blue:#1e40af;--blue-soft:#eff6ff;--ink:#172033;--muted:#576579;--line:#dbe2eb;--surface:#fff;--canvas:#f5f7fb;--green:#166534;--red:#b91c1c;--amber:#92400e}
*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}button,input,textarea{font:inherit}button{cursor:pointer}button,textarea,input,a,summary,[tabindex]{outline-offset:3px}button:focus-visible,input:focus-visible,textarea:focus-visible,a:focus-visible,summary:focus-visible,[tabindex]:focus-visible{outline:3px solid var(--blue)}button{min-height:44px}button:disabled{cursor:default}button:hover{filter:brightness(.97)}h1,h2,h3,p{margin:0}h1{font-size:clamp(26px,3vw,36px);font-weight:720;letter-spacing:-.035em;line-height:1.18}h2{font-size:20px;letter-spacing:-.02em;line-height:1.3}h3{font-size:15px}code,pre,textarea,.cell-id,.sha-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}small{font-size:13px}[hidden]{display:none!important}.workspace{max-width:1504px;margin:auto;padding:32px}.page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:24px}.eyebrow{font-size:12px;letter-spacing:.09em;font-weight:700;color:var(--blue);margin-bottom:10px}.eyebrow span{color:var(--muted)}.repo-name{color:var(--muted);margin-top:9px;overflow-wrap:anywhere;font-size:15px}.language-switch{display:flex;padding:4px;gap:4px;border:1px solid var(--line);border-radius:10px;background:white;flex-shrink:0}.language-switch button{border:0;border-radius:7px;background:transparent;padding:0 15px;color:var(--muted);font-size:14px;font-weight:600}.language-switch button[aria-pressed="true"]{background:var(--blue);color:white}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}.metric{min-width:0;border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:16px 18px}.metric-label{font-size:13px;color:var(--muted);overflow-wrap:anywhere}.metric-value{font-size:30px;line-height:1.2;font-weight:700;letter-spacing:-.035em;margin-top:5px}.metric-hint{color:var(--muted);font-size:12px;margin-top:5px;overflow-wrap:anywhere}.metric.interactions{border-color:#f5c778;background:#fffbeb}.metric.interactions .metric-value{color:var(--amber)}.metric.attention .metric-value{color:var(--red)}.metric.passed .metric-value{color:var(--green)}.baseline-section{display:grid;grid-template-columns:minmax(250px,.8fr) minmax(0,1.2fr);gap:18px;align-items:stretch}.baseline-card{width:100%;height:100%;display:flex;align-items:center;gap:16px;text-align:left;background:white;border:1px solid var(--line);border-radius:10px;padding:16px}.baseline-card[aria-pressed="true"]{border-color:var(--blue);box-shadow:0 0 0 2px #1e40af22}.baseline-name{font-size:14px;font-weight:650;overflow-wrap:anywhere}.baseline-sha{display:block;font-size:12px;color:var(--muted);margin-top:3px}.baseline-label{display:block;font-size:12px;color:var(--muted);margin-bottom:2px}.baseline-info{min-width:0;flex:1}.run-context{padding:13px 16px;border-left:2px solid #d2dcec;display:grid;gap:4px;font-size:13px;color:var(--muted);min-width:0}.run-context p{overflow-wrap:anywhere}.run-context strong{font-weight:600;color:var(--ink)}.condition-note{font-size:13px;color:var(--muted);margin:13px 0 22px;line-height:1.55}.scan-notices:empty{display:none}.notice{background:#fffbeb;border:1px solid #f3ce89;border-radius:8px;padding:10px 12px;color:var(--amber);font-size:13px;overflow-wrap:anywhere;margin:10px 0}.report-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(330px,1fr);gap:20px;align-items:start}.panel{background:var(--surface);border:1px solid var(--line);border-radius:12px;min-width:0;overflow:hidden}.panel-heading{display:flex;justify-content:space-between;gap:12px;align-items:start;padding:20px 20px 12px}.panel-heading .muted{margin-top:5px}.muted{font-size:13px;color:var(--muted);overflow-wrap:anywhere}.matrix-controls{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:0 20px 15px}.filter{display:flex;align-items:center;min-height:44px;gap:9px;cursor:pointer;font-size:13px;font-weight:600}.filter input{width:19px;height:19px;margin:0;accent-color:var(--blue)}.matrix-scroll{overflow:auto;max-width:100%;padding:0 12px 12px;scroll-padding:8px}.matrix-scroll table{border-collapse:separate;border-spacing:7px;table-layout:fixed;width:100%;min-width:660px;font-size:13px}.matrix-scroll th{font-weight:500;color:var(--muted);text-align:left;padding:7px 5px;vertical-align:top;overflow-wrap:anywhere}.matrix-scroll th:first-child{width:150px}.matrix-scroll thead th:not(:first-child){text-align:center}.axis-title{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--blue);font-weight:700;display:block;margin-bottom:5px}.ref-label{display:block;color:var(--ink);font-weight:600;font-size:12px;overflow-wrap:anywhere}.ref-sha{display:block;font-size:11px;color:var(--muted);margin-top:3px}.matrix-scroll td{padding:0;vertical-align:top}.cell-button{border:1px solid var(--line);width:100%;min-height:105px;border-radius:8px;text-align:left;padding:11px 9px;background:#f8fafc;display:flex;flex-direction:column;gap:7px;transition:box-shadow .12s,background .12s}.cell-button[data-status="passed"]{background:#f0fdf4;border-color:#c9e6d4}.cell-button[data-status="test-failed"],.cell-button[data-status="merge-conflict"],.cell-button[data-status="error"]{background:#fff7f7;border-color:#f1caca}.cell-button[data-status="timeout"]{background:#fffbeb;border-color:#f0d9ac}.cell-button[aria-pressed="true"]{box-shadow:0 0 0 2px var(--blue);border-color:var(--blue)}.cell-button .status{font-size:12px;line-height:1.25;white-space:normal}.cell-time{font-size:11px;color:var(--muted)}.single-marker{font-size:11px;color:var(--muted)}.interaction-label{display:inline-flex;align-items:center;border:1px solid #edca8d;border-radius:4px;padding:3px 5px;font-size:11px;font-weight:650;background:#fffbeb;color:var(--amber);line-height:1.3}.status{font-size:12px;font-weight:650;display:inline-flex;gap:6px;align-items:center;color:var(--muted);overflow-wrap:anywhere}.status::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;flex-shrink:0}.status.passed{color:var(--green)}.status.test-failed,.status.merge-conflict,.status.error{color:var(--red)}.status.timeout{color:var(--amber)}.status.cancelled,.status.not-run{color:#4b5563}.filtered-cell{color:#677487;display:flex;justify-content:center;align-items:center;min-height:105px;font-size:12px;border:1px dashed #dbe2eb;border-radius:8px;padding:8px}.status-legend{display:flex;flex-wrap:wrap;gap:9px 18px;padding:15px 20px;border-top:1px solid var(--line)}.scope-note{padding:0 20px 18px;font-size:12px;color:var(--muted);line-height:1.6}.detail-panel{padding-bottom:6px}.detail-panel .panel-heading{border-bottom:1px solid var(--line);margin-bottom:15px}.detail-panel .eyebrow{font-size:11px;margin-bottom:5px}.cell-id{font-size:11px;color:var(--muted);background:#f1f5f9;border-radius:5px;padding:4px 7px;overflow-wrap:anywhere}.detail-title{font-size:15px;line-height:1.5;padding:0 20px;overflow-wrap:anywhere}.detail-status{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 20px 16px}.detail-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:13px 20px;background:#f8fafc;margin:0 0 12px;border-top:1px solid #edf1f6;border-bottom:1px solid #edf1f6}.detail-meta dt{font-size:11px;color:var(--muted);margin-bottom:4px}.detail-meta dd{font-size:13px;font-weight:600;margin:0;overflow-wrap:anywhere}.sha-details{margin:0 20px;border-bottom:1px solid var(--line);padding-bottom:12px}.sha-details summary{font-size:13px;cursor:pointer;min-height:44px;display:list-item;padding-top:12px;font-weight:600}.sha-row{margin:8px 0;font-size:12px;overflow-wrap:anywhere}.sha-row strong{display:block;font-weight:500;color:var(--muted);margin-bottom:3px}.sha-code{font-size:11px;overflow-wrap:anywhere;user-select:all}.detail-block{padding:15px 20px 0}.detail-block h3{margin-bottom:8px}.detail-block ul{margin:0;padding:0 0 0 18px;font-size:12px;overflow-wrap:anywhere}.block-heading{display:flex;gap:8px;align-items:center;justify-content:space-between}.small-note{font-size:11px;color:var(--amber)}pre{background:#f5f7fb;border:1px solid var(--line);border-radius:8px;margin:0;padding:12px;font-size:12px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;color:#253248}.command-block{margin-top:12px}.command-block label{display:block;font-size:12px;color:var(--muted);font-weight:600;margin-bottom:5px}textarea{display:block;width:100%;max-width:100%;resize:vertical;padding:10px 11px;font-size:11px;line-height:1.6;border:1px solid var(--line);border-radius:7px;background:#f8fafc;color:var(--ink);overflow-wrap:anywhere;min-height:76px}.copy-button{width:100%;margin-top:7px;border:1px solid #c9d4e9;background:var(--blue-soft);color:var(--blue);border-radius:7px;font-size:13px;font-weight:600;padding:9px 12px}.copy-feedback{font-size:12px;min-height:22px;color:var(--blue);margin:9px 0 7px;overflow-wrap:anywhere}footer{margin-top:24px;padding-top:16px;border-top:1px solid var(--line);font-size:12px;color:var(--muted);overflow-wrap:anywhere}.skip-link{position:absolute;left:16px;top:-100px;background:white;padding:12px;border:2px solid var(--blue);z-index:2}.skip-link:focus{top:12px}
@media(min-width:1200px){.detail-panel{position:sticky;top:20px}}
@media(max-width:1100px){.report-grid{grid-template-columns:minmax(0,1fr)}.matrix-scroll table{min-width:660px}.detail-meta{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:600px){.workspace{padding:20px 14px}.page-header{flex-direction:column;gap:16px;margin-bottom:20px}.language-switch{align-self:flex-start}.summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.metric{padding:13px 14px}.metric-value{font-size:26px}.baseline-section{grid-template-columns:minmax(0,1fr);gap:12px}.run-context{font-size:12px}.panel-heading{padding:17px 16px 11px}.matrix-controls{padding:0 16px 12px;align-items:flex-start;flex-direction:column;gap:0}.matrix-scroll{padding-left:5px;padding-right:5px}.status-legend{padding:14px 16px;gap:8px 13px}.scope-note{padding:0 16px 16px}.detail-title,.detail-status{padding-left:16px;padding-right:16px}.detail-meta{padding-left:16px;padding-right:16px;gap:8px}.sha-details{margin-left:16px;margin-right:16px}.detail-block{padding-left:16px;padding-right:16px}.condition-note{margin-bottom:18px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;

export const reportScript = String.raw`
(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('report-data').textContent);
  const report = data.report;
  let locale = data.locale;
  let selectedId = (report.cells.find(c => c.interactionFailure) || report.cells.find(c => c.status !== 'passed') || report.cells[0]).id;
  let failedOnly = false;
  const strings = {
    en: {
      title:'Branch comparison', eyebrow:'OFFLINE REPORT', checked:'Checks', checkedHint:'Base + singles + ordered pairs', passed:'Passed', passedHint:'Tests returned exit code 0', attention:'Needs attention', attentionHint:'Failures, interruptions and pending checks', interactions:'Interaction failures', interactionsHint:'Singles pass; combination test fails',
      baseline:'Baseline', started:'Started', duration:'Scan duration', command:'Test command', timeout:'Per-check timeout', matrix:'Ordered merge matrix', matrixSub:'Row merges first. Column merges second. Diagonal tests one branch.', first:'Merge first', second:'Merge second', filter:'Needs attention only', shown:'shown', single:'Single branch', filtered:'Passed · filtered',
      condition:'An interaction failure requires the baseline and both single branches to pass, then the ordered pair to fail its test.', conditionUnmet:'The baseline did not pass. Review individual failures; interaction labels require a passing baseline and both singles.', scope:'Coverage: single branches and both merge orders for every pair. Run your final integration tests when combining three or more branches.',
      detail:'Check details', selection:'SELECTED CHECK', elapsed:'Elapsed', exit:'Exit code', kind:'Check type', base:'Baseline', pair:'Ordered pair', shas:'Fixed commits and resulting tree', tree:'Resulting tree', missing:'Not available', conflicts:'Conflicting paths', log:'Test and merge log', emptyLog:'No log was recorded for this check.', truncated:'Log truncated', reproduce:'Reproduce this check', reproduceHelp:'Run from your repository root. Set --report to the saved report.json path, or copy report.json here. The default --out uses a sibling directory; choose an unused output directory outside the repository.', redacted:'The original test command was redacted. Add --test with your test command before running this reproduction.', copyBash:'Copy bash command', copyPowerShell:'Copy PowerShell command', copied:'Copied to clipboard.', fallback:'Clipboard unavailable. Select and copy the highlighted command (Ctrl+C / ⌘C).', interaction:'Interaction failure', cancelled:'Scan was cancelled. Review pending checks.', cleanup:'Cleanup notes', footer:'Generated by Branch Compare', status:{passed:'Passed','test-failed':'Test failed','merge-conflict':'Merge conflict',timeout:'Timed out',cancelled:'Cancelled',error:'Execution error','not-run':'Not run'}
    },
    zh: {
      title:'分支组合检查', eyebrow:'离线报告', checked:'检查格数', checkedHint:'基准 + 单分支 + 有向组合', passed:'通过', passedHint:'测试退出码为 0', attention:'待处理', attentionHint:'失败、中断与尚未执行的检查', interactions:'交互失败', interactionsHint:'单分支通过，组合测试失败',
      baseline:'基准', started:'开始时间', duration:'扫描耗时', command:'测试命令', timeout:'每格超时', matrix:'有向合并矩阵', matrixSub:'先合并行分支，再合并列分支。对角线检查单分支。', first:'先合并 · 行', second:'后合并 · 列', filter:'仅显示待处理', shown:'格显示', single:'单分支', filtered:'通过 · 已筛选',
      condition:'交互失败要求基准和两个单分支都通过，且有向组合的测试失败。', conditionUnmet:'基准未通过。请查看各格失败原因；交互失败判定要求基准和两个单分支都通过。', scope:'检查范围：各单分支，以及每对分支的两个合并顺序。三个或更多分支合并时，请执行最终集成测试。',
      detail:'检查详情', selection:'已选检查', elapsed:'耗时', exit:'退出码', kind:'检查类型', base:'基准', pair:'有向组合', shas:'固定提交与结果树', tree:'结果树', missing:'无记录', conflicts:'冲突路径', log:'测试与合并日志', emptyLog:'此格没有日志记录。', truncated:'日志已截断', reproduce:'复现此格', reproduceHelp:'从仓库根目录执行。将 --report 改为实际 report.json 路径，或将该 JSON 复制到当前目录。默认 --out 指向仓库同级目录；输出必须是仓库外尚不存在的新目录。', redacted:'原测试命令已做隐私处理。运行复现前，请补充 --test 和你的测试命令。', copyBash:'复制 bash 命令', copyPowerShell:'复制 PowerShell 命令', copied:'已复制到剪贴板。', fallback:'剪贴板不可用。请复制已选中的命令（Ctrl+C / ⌘C）。', interaction:'交互失败', cancelled:'扫描已取消，请查看尚未执行的格子。', cleanup:'清理记录', footer:'由 Branch Compare 生成', status:{passed:'通过','test-failed':'测试失败','merge-conflict':'合并冲突',timeout:'超时',cancelled:'已取消',error:'执行错误','not-run':'未执行'}
    }
  };
  const $ = id => document.getElementById(id);
  const t = () => strings[locale];
  const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
  const clear = element => element.replaceChildren();
  const short = sha => sha.slice(0, 10);
  const seconds = ms => (ms / 1000).toFixed(2) + ' s';
  const status = cell => node('span', t().status[cell.status], 'status ' + cell.status);
  const title = cell => cell.kind === 'base' ? report.base.label : cell.indices.map(i => report.refs[i].label).join(' → ');
  function choose(id) { selectedId = id; document.querySelectorAll('[data-cell-id]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.cellId === id))); renderDetail(); }
  function bindCell(button, cell) {
    button.type = 'button'; button.dataset.cellId = cell.id; button.dataset.status = cell.status;
    button.setAttribute('aria-pressed', String(selectedId === cell.id));
    button.setAttribute('aria-label', title(cell) + ': ' + t().status[cell.status] + (cell.interactionFailure ? ', ' + t().interaction : ''));
    button.addEventListener('click', () => choose(cell.id));
  }
  function renderSummary() {
    clear($('summary'));
    const values = [
      ['checked', report.cells.length, 'checkedHint'], ['passed', report.cells.filter(c => c.status === 'passed').length, 'passedHint'],
      ['attention', report.cells.filter(c => c.status !== 'passed').length, 'attentionHint'], ['interactions', report.cells.filter(c => c.interactionFailure).length, 'interactionsHint']
    ];
    values.forEach(([key, value, hint]) => { const card = node('div', undefined, 'metric ' + key); card.append(node('p', t()[key], 'metric-label'), node('p', String(value), 'metric-value'), node('p', t()[hint], 'metric-hint')); $('summary').append(card); });
    clear($('baseline-card'));
    const base = report.cells.find(c => c.kind === 'base');
    if (base && (!failedOnly || base.status !== 'passed')) {
      const button = node('button', undefined, 'baseline-card'); bindCell(button, base);
      const info = node('span', undefined, 'baseline-info'); info.append(node('span', t().baseline, 'baseline-label'), node('span', report.base.label, 'baseline-name'));
      const sha = node('span', short(report.base.sha), 'baseline-sha'); sha.title = report.base.sha; info.append(sha); button.append(info, status(base), node('span', seconds(base.elapsedMs), 'cell-time')); $('baseline-card').append(button);
    } else { const filtered = node('div', t().baseline + ' · ' + t().filtered, 'baseline-card muted'); $('baseline-card').append(filtered); }
    clear($('run-context'));
    const start = new Date(report.startedAt); const formatted = Number.isNaN(start.getTime()) ? report.startedAt : start.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');
    const command = report.command.mode === 'shell' ? report.command.text : JSON.stringify(report.command.argv);
    [[t().started, formatted], [t().duration, seconds(Math.max(0, Date.parse(report.finishedAt) - Date.parse(report.startedAt))) + ' · ' + t().timeout + ': ' + seconds(report.timeoutMs)], [t().command, command]].forEach(([label, value]) => { const line = node('p'); line.append(node('strong', label + ': '), node('span', value)); $('run-context').append(line); });
    $('condition-note').textContent = base && base.status === 'passed' ? t().condition : t().conditionUnmet;
    clear($('scan-notices'));
    if (report.cancelled) $('scan-notices').append(node('p', t().cancelled, 'notice'));
    if (report.cleanupErrors.length) { const notice = node('div', undefined, 'notice'); notice.append(node('strong', t().cleanup)); report.cleanupErrors.forEach(error => notice.append(node('p', error))); $('scan-notices').append(notice); }
  }
  function renderMatrix() {
    clear($('matrix'));
    const head = node('thead'); const axisRow = node('tr'); const corner = node('th'); corner.scope = 'col'; corner.append(node('span', t().second, 'axis-title'), node('span', t().first, 'ref-label')); axisRow.append(corner);
    report.refs.forEach(ref => { const heading = node('th'); heading.scope = 'col'; const label = node('span', ref.label, 'ref-label'); const sha = node('span', short(ref.sha), 'ref-sha'); sha.title = ref.sha; heading.append(label, sha); axisRow.append(heading); }); head.append(axisRow); $('matrix').append(head);
    const body = node('tbody');
    report.refs.forEach((ref, i) => {
      const row = node('tr'); const heading = node('th'); heading.scope = 'row'; const sha = node('span', short(ref.sha), 'ref-sha'); sha.title = ref.sha; heading.append(node('span', ref.label, 'ref-label'), sha); row.append(heading);
      report.refs.forEach((other, j) => {
        const td = node('td'); const cell = report.cells.find(c => c.id === (i === j ? 'single-' + i : 'pair-' + i + '-' + j));
        if (!cell) { td.append(node('span', t().missing, 'filtered-cell')); }
        else if (failedOnly && cell.status === 'passed') { td.append(node('span', t().filtered, 'filtered-cell')); }
        else {
          const button = node('button', undefined, 'cell-button'); bindCell(button, cell); button.append(status(cell));
          if (cell.interactionFailure) button.append(node('span', t().interaction, 'interaction-label'));
          if (cell.kind === 'single') button.append(node('span', t().single, 'single-marker'));
          button.append(node('span', seconds(cell.elapsedMs), 'cell-time')); td.append(button);
        }
        row.append(td);
      }); body.append(row);
    }); $('matrix').append(body);
    $('filter-count').textContent = (failedOnly ? report.cells.filter(c => c.status !== 'passed').length : report.cells.length) + ' / ' + report.cells.length + ' ' + t().shown;
    clear($('status-legend')); Object.keys(t().status).forEach(key => $('status-legend').append(status({status:key}))); $('scope-note').textContent = t().scope;
  }
  function renderDetail() {
    const cell = report.cells.find(c => c.id === selectedId);
    $('detail-title').textContent = title(cell); $('detail-id').textContent = cell.id; clear($('detail-status')); $('detail-status').append(status(cell)); if (cell.interactionFailure) $('detail-status').append(node('span', t().interaction, 'interaction-label'));
    clear($('detail-meta')); [[t().elapsed, seconds(cell.elapsedMs)], [t().exit, cell.exitCode === null ? '—' : String(cell.exitCode)], [t().kind, cell.kind === 'base' ? t().base : cell.kind === 'single' ? t().single : t().pair]].forEach(([label,value]) => { const group = node('div'); group.append(node('dt', label), node('dd', value)); $('detail-meta').append(group); });
    clear($('detail-shas'));
    const shaRow = (label, value) => { const row = node('div', undefined, 'sha-row'); row.append(node('strong', label), node('code', value, 'sha-code')); $('detail-shas').append(row); };
    shaRow(t().base + ' · ' + report.base.label, report.base.sha);
    cell.indices.forEach((i, order) => shaRow((cell.kind === 'pair' ? (order === 0 ? t().first : t().second) + ' · ' : '') + report.refs[i].label, report.refs[i].sha));
    shaRow(t().tree, cell.treeSha || t().missing);
    $('conflict-section').hidden = cell.conflictPaths.length === 0; clear($('conflict-paths')); cell.conflictPaths.forEach(path => $('conflict-paths').append(node('li', path)));
    $('detail-log').textContent = cell.log || t().emptyLog; $('log-truncated').hidden = !cell.logTruncated; $('log-truncated').textContent = t().truncated;
    $('redacted-notice').hidden = !report.commandRedacted; $('redacted-notice').textContent = t().redacted;
    $('bash-command').value = data.commands[cell.id].bash; $('powershell-command').value = data.commands[cell.id].powershell; $('copy-feedback').textContent = '';
  }
  function render() {
    document.documentElement.lang = locale; document.title = 'Branch Compare · ' + report.repoName;
    [['page-title','title'],['eyebrow-text','eyebrow'],['matrix-title','matrix'],['matrix-subtitle','matrixSub'],['filter-label','filter'],['detail-eyebrow','selection'],['detail-heading','detail'],['sha-title','shas'],['conflict-title','conflicts'],['log-title','log'],['reproduce-title','reproduce'],['reproduce-help','reproduceHelp'],['copy-bash','copyBash'],['copy-powershell','copyPowerShell']].forEach(([id,key]) => $(id).textContent = t()[key]);
    $('repo-name').textContent = report.repoName; $('locale-en').setAttribute('aria-pressed', String(locale === 'en')); $('locale-zh').setAttribute('aria-pressed', String(locale === 'zh'));
    $('report-footer').textContent = t().footer + ' ' + report.toolVersion + ' · Node ' + report.environment.node + ' · ' + report.environment.git + ' · ' + report.environment.platform;
    renderSummary(); renderMatrix(); renderDetail();
  }
  ['en','zh'].forEach(language => $('locale-' + language).addEventListener('click', () => { locale = language; render(); }));
  $('failed-only').addEventListener('change', () => { failedOnly = $('failed-only').checked; const selected = report.cells.find(c => c.id === selectedId); if (failedOnly && selected.status === 'passed') selectedId = (report.cells.find(c => c.status !== 'passed') || selected).id; render(); });
  async function copy(shell) {
    const command = $(shell + '-command');
    try { if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(command.value); $('copy-feedback').textContent = t().copied; }
    catch { command.focus(); command.select(); $('copy-feedback').textContent = t().fallback; }
  }
  $('copy-bash').addEventListener('click', () => copy('bash')); $('copy-powershell').addEventListener('click', () => copy('powershell'));
  render();
})();
`;
