import express from 'express';
import { getLauncher } from './lib/launcher.js';
import * as runs from './lib/runs.js';
import { policy } from './lib/policy.js';
import { ghostStamp } from '../../src/lib/release.js';

// Module-load epoch — resets on process restart and on a dashboard Restart.
const LOADED_AT = Date.now();

export const meta = {
  name: 'MarkItDown',
  description: 'Convert PDF/Office/image files to Markdown via a Python markitdown service.',
  version: '0.1.0',
};

export function createApp({ name }) {
  const router = express.Router();
  const launcher = getLauncher();

  // Self-contained start: if this strategy owns the service, bring it up. Safe
  // to call on every (re)load — it pings first and no-ops if already running.
  launcher.ensureUp().catch(() => {});

  // Proxy one upload to the Python service. We pipe the raw multipart request
  // straight through (Node 18+ stream body + duplex), so no multer dependency.
  // Used by both Files mode and Directory mode (the browser reads each file).
  router.post('/convert', async (req, res) => {
    const { url } = launcher.config;
    try {
      const upstream = await fetch(`${url}/convert`, {
        method: 'POST',
        headers: {
          'content-type': req.headers['content-type'] || '',
          'content-length': req.headers['content-length'] || '',
        },
        body: req,
        duplex: 'half',
      });
      const body = await upstream.text();
      res.status(upstream.status).type('application/json').send(body);
    } catch (err) {
      res.status(502).json({ ok: false, detail: `service unreachable: ${err.message}` });
    }
  });

  router.use(express.json({ limit: '8mb' })); // for /api/runs (multipart requests skip this)

  // Run log — both Files and Directory runs are recorded here.
  router.get('/api/runs', async (req, res) => res.json(await runs.list()));
  router.get('/api/runs/:id', async (req, res) => {
    const r = await runs.get(req.params.id);
    return r ? res.json(r) : res.status(404).json({ ok: false, detail: 'no such run' });
  });
  router.post('/api/runs', async (req, res) => {
    try {
      const id = await runs.save(req.body);
      res.json({ ok: true, id });
    } catch (err) {
      res.status(400).json({ ok: false, detail: err.message });
    }
  });

  router.get('/api/status', async (req, res) => res.json(await launcher.status()));
  router.post('/api/service/restart', async (req, res) => res.json(await launcher.restart()));

  // Notification stub — wire to a real service (email, push, webhook) later.
  router.post('/api/notify', (req, res) => {
    console.log('[markitdown] notify requested', req.body);
    res.json({ ok: true, detail: 'notification stub — not yet wired to a service' });
  });

  router.get('/', (req, res) => res.type('html').send(page(name)));

  return router;
}

export async function health() {
  return getLauncher().status();
}

function page(name) {
  const base = `/apps/${name}`;
  const P = policy();
  const types = [...P.extensions].sort();
  const batch = P.oneOffBatch || { maxFiles: 100, maxTotalMB: 250 };
  return `<!doctype html><html data-theme="dark"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MarkItDown</title><link rel="stylesheet" href="/static/css/dark.css">
<style>
  .cols{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;align-items:stretch;height:440px}
  .col{display:flex;flex-direction:column;overflow:hidden;padding:0!important}
  .col-hd{padding:8px 12px;background:rgba(255,255,255,.05);border-bottom:1px solid var(--border,#333);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;border-radius:8px 8px 0 0}
  .col-hd h2{font-size:13px;font-weight:600;margin:0;letter-spacing:.03em}
  .col-body{flex:1;overflow-y:auto;padding:12px 14px;scrollbar-width:thin;scrollbar-color:#3a3a3a transparent}
  .col-body::-webkit-scrollbar{width:5px}.col-body::-webkit-scrollbar-track{background:transparent}.col-body::-webkit-scrollbar-thumb{background:#3a3a3a;border-radius:3px}.col-body::-webkit-scrollbar-thumb:hover{background:#555}
  .col-foot{padding:8px 14px 12px;border-top:1px solid var(--border,#2a2a2a);flex-shrink:0}
  .tok{font-size:12px;color:#5d8;font-variant-numeric:tabular-nums}
  .wave{position:absolute;left:0;right:0;bottom:0;height:0;z-index:0;pointer-events:none;transition:height .5s ease;background:rgba(40,180,120,.14)}
  .drop{border:1px dashed var(--border,#444);border-radius:7px;padding:16px 10px;text-align:center;color:#9aa;cursor:pointer;font-size:13px}
  .drop.over{border-color:#6cf;color:#cde}
  .bar{height:6px;background:#0004;border-radius:99px;margin-top:5px;overflow:hidden}
  .bar>i{display:block;height:6px;width:0;border-radius:99px;transition:width .4s}
  .bar>i.act{background:linear-gradient(90deg,#3af 20%,#8ef 50%,#3af 80%)!important;background-size:200% auto;animation:scan 1.4s linear infinite}
  @keyframes scan{0%{background-position:0% center}100%{background-position:200% center}}
  .out{display:flex;justify-content:space-between;align-items:center;gap:8px;border:1px solid var(--border,#333);border-radius:5px;padding:6px 9px;margin-top:5px;font-size:12px}
  .mini{font-size:11px;color:#9aa}
  .st-ok{color:#5d8}.st-go{color:#6cf}.st-err{color:#f87}.st-q{color:#fb8}
  .opts{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:13px}
  .field{width:100%;margin-top:8px;padding:6px 8px;background:#1a1b20;border:1px solid var(--border,#444);border-radius:6px;color:inherit;font-size:13px;appearance:none}
  .tabs{display:flex;gap:6px;margin-bottom:12px}
  .tabs button{flex:1;font-size:13px}
  .tabs button.on{background:#2a4;color:#fff}
  details.types{margin-top:12px}
  details.types summary{cursor:pointer;font-size:12px;color:#9aa}
  .typegrid{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:8px}
  .typegrid span{font-size:11px;color:#9be;font-family:monospace}
  .drow{display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 8px;border:1px solid var(--border,#2a2a2a);border-radius:5px;margin-top:5px}
  .drow:hover{border-color:#555}
  .drow span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .summary{padding:9px 10px;background:#0003;border-radius:6px;font-size:13px}
  .runrow{display:grid;grid-template-columns:130px 1fr 90px 64px 56px 56px 36px;gap:4px;align-items:center;font-size:12px;padding:5px 8px;border-bottom:1px solid var(--border,#222)}
  .run-hdr{display:grid;grid-template-columns:130px 1fr 90px 64px 56px 56px 36px;gap:4px;font-size:11px;color:#555;padding:4px 8px;border-bottom:1px solid #2a2a2a;margin-bottom:2px}
  #ghost{background:none;border:none;font-size:15px;line-height:1;cursor:pointer;opacity:.2;transition:opacity .2s;padding:2px 4px}
  #ghost:hover{opacity:1}
  .backdrop{position:fixed;inset:0;background:#0007;z-index:40;display:none}
  .backdrop.open{display:block}
  .flyout{position:fixed;top:0;right:0;height:100vh;width:min(560px,92vw);background:#15161a;border-left:1px solid #444;transform:translateX(100%);transition:transform .25s ease;z-index:50;display:flex;flex-direction:column}
  .flyout.open{transform:none}
  .flyout .fhead{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #333}
  .flyout .fbody{flex:1;overflow:auto;padding:16px}
  .md{line-height:1.55;font-size:14px}
  .md h1,.md h2,.md h3{margin:.8em 0 .4em}
  .md table{border-collapse:collapse;margin:.6em 0}
  .md th,.md td{border:1px solid var(--border,#444);padding:4px 8px}
  .md pre{background:#0004;padding:10px;border-radius:6px;overflow:auto}
  .md code{font-family:monospace}
  .md img{max-width:100%}
  #statusbar{display:flex;align-items:center;gap:8px;margin-bottom:10px}
  #banner{flex:1;font-size:13px;padding:6px 10px}
  .fitem{font-size:11px;color:#9be;padding:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:monospace}
  details.errlist>summary{cursor:pointer;font-size:12px;color:#fb8;margin-top:8px;user-select:none}
  #start:not([disabled]){animation:readypulse 2s infinite}
  @keyframes readypulse{0%,100%{box-shadow:0 0 0 2px #2a4}50%{box-shadow:0 0 0 3px #2a4,0 0 12px #2a47}}
  #leavedlg{position:fixed;inset:0;background:#0009;z-index:70;display:flex;align-items:center;justify-content:center}
  .dlgcard{background:#1a1b20;border:1px solid #444;border-radius:10px;padding:22px 24px;max-width:360px;width:90%}
  .dlgcard h3{margin:0 0 8px;font-size:15px}
  .dlgcard p{font-size:13px;color:#9aa;margin:0 0 16px}
  .notifychk{display:flex;align-items:center;gap:8px;font-size:13px;padding:10px 12px;background:#0003;border-radius:6px;border:1px solid #2a2a2a;cursor:pointer}
  .dlgbtns{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}
  .wrow-meta{display:flex;justify-content:space-between;align-items:baseline;gap:6px}
  .wrow-left{display:flex;align-items:baseline;gap:6px;min-width:0;overflow:hidden}
  .wrow-fname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace}
  .wrow-size{color:#556;flex-shrink:0}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
</head>
<body><div class="wrap">
  <header class="site"><h1>📄 MarkItDown</h1><a class="muted" href="/">← Dashboard</a></header>
  <div id="statusbar">
    <div id="banner" class="card">Checking service…</div>
    <button id="clear" class="btn">Clear</button>
    <button id="ghost" title="Restart the conversion service" aria-label="Restart service">👻</button>
  </div>
  <div class="cols">
    <div class="col card">
      <div class="col-hd"><h2>① Inputs</h2></div>
      <div class="col-body">
        <div class="tabs">
          <button id="tab-files" class="btn on">Files</button>
          <button id="tab-dir" class="btn">Directory</button>
        </div>
        <div id="pane-files">
          <div id="drop" class="drop">Drop files or click<br><span class="mini">single or multiple</span></div>
          <div id="filelist"></div>
          <p class="mini" style="margin:8px 0 0">Limit: ${batch.maxFiles} files · ${P.maxFileMB}MB each · ${batch.maxTotalMB}MB total</p>
        </div>
        <div id="pane-dir" style="display:none">
          <label class="opts"><input id="recursive" type="checkbox" checked> Include subfolders</label>
          <select id="outmode" class="field">
            <option value="zip">Output: zip + receipt (download)</option>
            <option value="alongside">Output: .md alongside originals</option>
            <option value="targetDir">Output: write to a chosen folder</option>
          </select>
          <button id="pick" class="btn" style="width:100%;margin-top:10px">Choose folder…</button>
          <p class="mini" style="margin:8px 0 0">Chrome/Edge only. Write modes ask permission once.</p>
        </div>
        <input id="file" type="file" multiple hidden>
        <details class="types">
          <summary>Supported file types (${types.length})</summary>
          <div class="typegrid">${types.map((t) => `<span>${t}</span>`).join('')}</div>
        </details>
      </div>
      <div class="col-foot">
        <div id="staged" class="mini" style="margin-bottom:8px"></div>
        <button id="start" class="btn primary" style="width:100%" disabled>Start</button>
        <button id="stop" class="btn" style="width:100%;margin-top:6px;display:none">Stop</button>
      </div>
    </div>

    <div class="col card" style="position:relative;overflow:hidden">
      <div class="col-hd"><h2>② Working</h2><span id="tok" class="tok" title="Estimated tokens saved vs feeding the raw file text to an AI (per-type estimate)">~0 tok saved</span></div>
      <div id="wave" class="wave"></div>
      <div id="work" class="col-body" style="position:relative;z-index:1"><div class="empty mini">Nothing yet.</div></div>
    </div>

    <div class="col card">
      <div class="col-hd"><h2>③ Output</h2></div>
      <div id="outs" class="col-body"><div class="empty mini">Summary appears here.</div></div>
    </div>
  </div>

  <div id="detailwrap" class="card" style="display:none;margin-top:14px">
    <h2 style="font-size:14px;margin:0 0 8px">Documents (<span id="detailcount">0</span>)</h2>
    <div id="detaillist"></div>
  </div>

  <details class="card" id="rundetails" style="margin-top:14px">
    <summary style="cursor:pointer;font-size:14px;font-weight:600;user-select:none">Runs (<span id="runcount">0</span>)</summary>
    <div style="margin-top:10px">
      <div class="run-hdr"><span>Time</span><span>Source</span><span>Mode</span><span>Status</span><span>Files</span><span>Tok saved</span><span></span></div>
      <div id="runlist"><div class="empty mini" style="padding:8px 0">No runs yet.</div></div>
    </div>
  </details>
</div>

<div id="leavedlg" style="display:none">
  <div class="dlgcard">
    <h3>Run in progress</h3>
    <p id="leavemsg">Leaving now will stop the conversion.</p>
    <label class="notifychk"><input type="checkbox" id="notifyme"> Notify me when the run completes</label>
    <div class="dlgbtns">
      <button id="leave-stay" class="btn">Stay</button>
      <button id="leave-go" class="btn" style="background:#444;color:#ddd">Leave anyway</button>
    </div>
  </div>
</div>
<div id="backdrop" class="backdrop"></div>
<div id="flyout" class="flyout">
  <div class="fhead">
    <b id="fhname" style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></b>
    <span class="mini">
      <a href="#" id="fcopy">copy</a> · <a href="#" id="fdl">download</a> · <a href="#" id="fclose">close ✕</a>
    </span>
  </div>
  <div id="fbody" class="fbody md"></div>
</div>

<script>
const BASE=${JSON.stringify(base)};
const SUPP=new Set(${JSON.stringify(types)});
const LIM=${JSON.stringify({ maxFiles: batch.maxFiles, maxFileMB: P.maxFileMB, maxTotalMB: batch.maxTotalMB })};
const SAVING=${JSON.stringify(P.tokenSavings || { charsPerToken: 4, defaultDensity: 0.2, density: {} })};
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const STORE={};
const problems=[];
let staged=null;
let lastMdName=null;
let viewer=null;
let cancelRun=false;
let currentCtrl=null;
let tokenTotal=0;
let runActive=false;   // true while a batch is in progress
let currentRun=null;   // live run record for the leave-dialog progress line
let leaveTarget=null;  // href to navigate to after confirming leave

// ----- leave-guard -----
window.addEventListener('beforeunload', e=>{ if(runActive){ e.preventDefault(); e.returnValue=''; } });

// Intercept all <a> navigations that would leave the page.
document.addEventListener('click', e=>{
  const a=e.target.closest('a[href]');
  if(!a||!runActive) return;
  const href=a.getAttribute('href');
  if(!href||href.startsWith('#')) return;
  e.preventDefault();
  leaveTarget=a.href;
  showLeaveDlg();
});

function showLeaveDlg(){
  const t=currentRun&&currentRun.totals;
  $('#leavemsg').textContent=t
    ?'Leaving will stop the conversion. '+t.converted+' of '+t.found+' files done so far.'
    :'Leaving now will stop the conversion.';
  $('#notifyme').checked=false;
  $('#leavedlg').style.display='flex';
}
$('#leave-stay').onclick=()=>{ $('#leavedlg').style.display='none'; leaveTarget=null; };
$('#leave-go').onclick=async()=>{
  if($('#notifyme').checked){
    const t=currentRun&&currentRun.totals;
    await fetch(BASE+'/api/notify',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({runId:currentRun&&currentRun.id, totals:t})}).catch(()=>{});
  }
  runActive=false; cancelRun=true;
  if(currentCtrl) currentCtrl.abort();
  const dest=leaveTarget||'/'; leaveTarget=null;
  location.href=dest;
};

function savedOf(ext, fileBytes, md){
  const cpt=SAVING.charsPerToken||4;
  const dens=(SAVING.density&&SAVING.density[ext]!=null)?SAVING.density[ext]:(SAVING.defaultDensity!=null?SAVING.defaultDensity:0.2);
  return Math.max(0, Math.round((fileBytes*dens - md.length)/cpt));
}
function updateTok(){ $('#tok').textContent='~'+tokenTotal.toLocaleString()+' tok saved'; }
function updateWave(found, processed){ $('#wave').style.height=(found?Math.round(processed/found*100):0)+'%'; }

function extOf(name){ const d=name.lastIndexOf('.'); return d>=0?name.slice(d).toLowerCase():''; }
function baseMd(name){ const d=name.lastIndexOf('.'); return (d>0?name.slice(0,d):name)+'.md'; }
function mdNameOf(rel){ const dot=rel.lastIndexOf('.'), slash=rel.lastIndexOf('/'); return (dot>slash?rel.slice(0,dot):rel)+'.md'; }
const genId=()=>'run_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+Math.random().toString(36).slice(2,6);
function download(filename, data, type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([data],{type:type||'text/markdown'})); a.download=filename; a.click(); }
async function postJson(path, body){ const r=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); return r.json(); }

async function refreshStatus(){
  try{
    const s=await (await fetch(BASE+'/api/status')).json();
    const b=$('#banner');
    b.innerHTML=(s.ok?'🟢 ':'🔴 ')+esc(s.detail||'');
    b.style.color=s.ok?'#5d8':'#f87';
  }catch{ $('#banner').textContent='🔴 cannot reach app'; }
}
refreshStatus();

function setTab(dir){
  $('#tab-dir').classList.toggle('on',dir);
  $('#tab-files').classList.toggle('on',!dir);
  $('#pane-dir').style.display=dir?'':'none';
  $('#pane-files').style.display=dir?'none':'';
  staged=null; renderStaged();
}
$('#tab-files').onclick=()=>setTab(false);
$('#tab-dir').onclick=()=>setTab(true);
$('#outmode').onchange=()=>{ if(staged&&staged.mode==='dir'){ staged=null; renderStaged(); } };

function renderStaged(){
  const el=$('#staged');
  $('#start').disabled=!staged;
  if(!staged){ el.innerHTML=''; return; }
  if(staged.mode==='files'){
    el.innerHTML=staged.files.length+' file(s) staged';
  }else{
    el.innerHTML='Folder: <b>'+esc(staged.label)+'</b>'+(staged.targetName?(' → '+esc(staged.targetName)):'')+
      ' · '+esc(staged.outputMode)+(staged.recursive?' · recursive':'');
  }
}
$('#start').onclick=async()=>{
  if(!staged) return;
  if(staged.mode==='files'){
    const items=staged.files.map(f=>({label:f.name,name:f.name,size:f.size,getFile:async()=>f}));
    await runBatch({kind:'files',label:staged.files.length+' file'+(staged.files.length>1?'s':'')}, 'download', items, {});
  }else{
    const items=[]; await walk(staged.dirHandle,'',staged.recursive,items);
    await runBatch({kind:'dir',label:staged.label,recursive:staged.recursive}, staged.outputMode, items, {targetHandle:staged.targetHandle,targetName:staged.targetName});
  }
};
$('#stop').onclick=()=>{ cancelRun=true; $('#stop').textContent='Stopping…'; if(currentCtrl) currentCtrl.abort(); };

function resetAll(){
  $('#work').innerHTML=''; $('#outs').innerHTML='';
  for(const k in STORE) delete STORE[k];
  problems.length=0; lastMdName=null;
  tokenTotal=0; updateTok(); updateWave(0,0);
  $('#detaillist').innerHTML=''; $('#detailwrap').style.display='none'; $('#detailcount').textContent='0';
  closeFlyout();
}
function fmtSize(b){ return b<1e3?b+'B':b<1e6?(b/1e3).toFixed(1)+'KB':(b/1e6).toFixed(1)+'MB'; }
function workRow(label, sizeBytes){
  const id='w'+Math.random().toString(36).slice(2,8);
  const fname=label.split('/').pop();
  const sizeStr=sizeBytes?fmtSize(sizeBytes):'';
  $('#work').insertAdjacentHTML('afterbegin',
    '<div id="'+id+'" style="margin-bottom:6px">'+
      '<div class="wrow-meta mini">'+
        '<div class="wrow-left">'+
          '<span class="wrow-fname">'+esc(fname)+'</span>'+
          (sizeStr?'<span class="wrow-size">'+esc(sizeStr)+'</span>':'')+
        '</div>'+
        '<span class="state st-go">0s</span>'+
      '</div>'+
      '<div class="bar"><i class="act" style="background:#3af;width:35%"></i></div>'+
    '</div>');
  const bar=document.querySelector('#'+id+' .bar>i');
  const state=document.querySelector('#'+id+' .state');
  const t0=Date.now();
  const timer=setInterval(()=>{ if(state.dataset.done) return; state.textContent=((Date.now()-t0)/1000).toFixed(1)+'s'; },250);
  return {
    done(ms){
      clearInterval(timer);
      bar.classList.remove('act'); bar.style.cssText='width:100%;background:#5d8';
      state.dataset.done='1'; state.textContent=(ms!=null?ms+'ms':'done'); state.className='state st-ok';
    },
    fail(){
      clearInterval(timer);
      bar.classList.remove('act'); bar.style.cssText='width:100%;background:#f87';
      state.dataset.done='1'; state.textContent='failed'; state.className='state st-err';
    },
  };
}
function addDetail(label, md){
  const mdName=mdNameOf(label);
  STORE[mdName]=md; lastMdName=mdName;
  const row=document.createElement('div'); row.className='drow';
  row.innerHTML='<span>'+esc(mdName)+'</span>'+
    '<span class="mini" style="flex-shrink:0">'+md.length.toLocaleString()+' chars</span>'+
    '<button class="btn" style="font-size:11px;padding:2px 8px;flex-shrink:0">View</button>';
  row.querySelector('button').onclick=()=>openFlyout(mdName);
  $('#detaillist').appendChild(row);
  $('#detailwrap').style.display=''; $('#detailcount').textContent=Object.keys(STORE).length;
}

async function convertFile(file, name){
  const fd=new FormData(); fd.append('file', file, name);
  currentCtrl=new AbortController();
  const r=await fetch(BASE+'/convert',{method:'POST',body:fd,signal:currentCtrl.signal});
  const j=await r.json();
  if(!r.ok||!j.ok) throw new Error(j.detail||('HTTP '+r.status));
  return j.markdown||'';
}

async function runBatch(source, outputMode, items, ctx){
  ctx=ctx||{};
  resetAll();
  cancelRun=false;
  $('#start').style.display='none'; $('#stop').style.display=''; $('#stop').textContent='Stop'; $('#stop').disabled=false;
  const oneOff = source.kind==='files';
  const run={ id:genId(), startedAt:new Date().toISOString(), finishedAt:null, durationMs:0,
    source, outputMode, status:'running', tokenSaved:0,
    totals:{found:items.length,converted:0,failed:0,skipped:0,bytesOut:0}, items:[] };
  runActive=true; currentRun=run;
  if(!items.length) $('#work').innerHTML='<div class="empty mini">Nothing to convert.</div>';

  const zipFiles={};
  let count=0, totalBytes=0, processed=0;
  const tick=()=>{ processed++; updateWave(run.totals.found, processed); };
  const noncompliant=(it,reason)=>{ problems.push({label:it.label,reason}); run.totals.skipped++; run.items.push({input:it.label,status:'skipped',reason}); tick(); };
  for(const it of items){
    if(cancelRun) break;
    const ext=extOf(it.name);
    if(!SUPP.has(ext)){ noncompliant(it,'unsupported type '+(ext||'(none)')); continue; }
    let file;
    try{ file=await it.getFile(); }catch{ noncompliant(it,'could not read file'); continue; }
    if(file.size>LIM.maxFileMB*1e6){ noncompliant(it,'file > '+LIM.maxFileMB+'MB'); continue; }
    if(oneOff){
      if(count>=LIM.maxFiles){ noncompliant(it,'over '+LIM.maxFiles+'-file limit'); continue; }
      if(totalBytes+file.size>LIM.maxTotalMB*1e6){ noncompliant(it,'batch > '+LIM.maxTotalMB+'MB'); continue; }
      count++; totalBytes+=file.size;
    }
    const row=workRow(it.label, file.size); const t0=performance.now();
    try{
      const md=await convertFile(file, it.name);
      const bytes=new Blob([md]).size;
      const ms=Math.round(performance.now()-t0);
      row.done(ms); addDetail(it.label, md);
      tokenTotal+=savedOf(ext, file.size, md); updateTok();
      run.totals.converted++; run.totals.bytesOut+=bytes;
      let output=null;
      if(outputMode==='alongside'){ await writeInDir(it.parent, baseMd(it.name), md); output='alongside'; }
      else if(outputMode==='targetDir'){ await mirrorWrite(ctx.targetHandle, mdNameOf(it.label), md); output='target'; }
      else if(outputMode==='zip'){ zipFiles[mdNameOf(it.label)]=md; }
      run.items.push({input:it.label, output, status:'done', bytes, ms});
    }catch(err){
      const msg=String(err.message||err);
      if(cancelRun){ row.fail(); run.items.push({input:it.label,status:'cancelled'}); break; }
      row.fail();
      problems.push({label:it.label,reason:msg});
      run.totals.failed++;
      run.items.push({input:it.label, status:'failed', error:msg, ms:Math.round(performance.now()-t0)});
    }
    tick();
  }
  currentCtrl=null;
  $('#stop').style.display='none'; $('#start').style.display=''; $('#start').disabled=!staged;

  run.finishedAt=new Date().toISOString();
  run.durationMs=new Date(run.finishedAt)-new Date(run.startedAt);
  run.status = cancelRun ? 'cancelled' : (run.totals.failed ? (run.totals.converted?'partial':'failed') : 'done');
  run.tokenSaved = tokenTotal;
  runActive=false; currentRun=null;

  let zipBlob=null;
  if(outputMode==='zip' && run.totals.converted){
    const zip=new JSZip();
    for(const [n,md] of Object.entries(zipFiles)) zip.file(n, md);
    zip.file('receipt.json', JSON.stringify(run,null,2));
    zip.file('receipt.md', receiptMd(run));
    zipBlob=await zip.generateAsync({type:'blob'});
    download(run.id+'.zip', zipBlob, 'application/zip');
  }
  renderOutput(run, outputMode, ctx, zipBlob);

  try{ await postJson('/api/runs', run); }catch{}
  loadRuns();
}

function renderOutput(run, outputMode, ctx, zipBlob){
  const t=run.totals;
  let html='<div class="summary"><b>'+t.converted+' of '+t.found+' documents converted</b>'+
    (t.skipped||t.failed?'<br><span class="mini st-q">'+((t.skipped+t.failed)||0)+' skipped / failed</span>':'')+'</div>';
  if(outputMode==='zip'){
    if(t.converted) html+='<div class="out"><b>'+esc(run.id)+'.zip</b><a href="#" data-x="zip" class="mini">download</a></div>';
  }else if(outputMode==='alongside' || outputMode==='targetDir'){
    const where = outputMode==='alongside' ? 'alongside originals' : ('→ '+esc(ctx.targetName||'folder'));
    html+='<div class="out"><b>Wrote '+t.converted+' .md '+where+'</b><a href="#" data-x="receipt" class="mini">receipt</a></div>';
  }else{
    html+='<div class="mini" style="margin-top:6px">'+t.converted+' markdown docs ready — see Documents below.</div>';
  }
  if(problems.length){
    html+='<details class="errlist"><summary>'+problems.length+' skipped / failed ▾</summary>'+
      problems.map(p=>'<div class="out" style="border-color:#744;margin-top:4px"><span style="overflow:hidden;text-overflow:ellipsis;min-width:0">'+esc(p.label)+'</span><span class="mini st-q" style="flex-shrink:0">'+esc(p.reason)+'</span></div>').join('')+'</details>';
  }
  $('#outs').innerHTML=html;
  const z=$('#outs').querySelector('[data-x=zip]'); if(z) z.onclick=e=>{e.preventDefault();download(run.id+'.zip',zipBlob,'application/zip');};
  const r=$('#outs').querySelector('[data-x=receipt]'); if(r) r.onclick=e=>{e.preventDefault();download('receipt-'+run.id+'.json',JSON.stringify(run,null,2),'application/json');};
}

const drop=$('#drop'), fileInput=$('#file');
drop.onclick=()=>fileInput.click();
drop.ondragover=e=>{e.preventDefault();drop.classList.add('over')};
drop.ondragleave=()=>drop.classList.remove('over');
drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');stageFiles(e.dataTransfer.files)};
fileInput.onchange=()=>stageFiles(fileInput.files);
function stageFiles(fileList){
  const files=[...fileList]; if(!files.length) return;
  staged={mode:'files', files, label:files.length+' files'};
  const MAX_SHOW=30;
  $('#filelist').innerHTML=files.slice(0,MAX_SHOW).map(f=>'<div class="fitem">'+esc(f.name)+'</div>').join('')+
    (files.length>MAX_SHOW?'<div class="fitem" style="color:#555">…and '+(files.length-MAX_SHOW)+' more</div>':'');
  renderStaged();
}

$('#pick').onclick=async()=>{
  if(!window.showDirectoryPicker){ alert('Directory mode needs Chrome or Edge (File System Access API).'); return; }
  const outputMode=$('#outmode').value;
  const recursive=$('#recursive').checked;
  let dir;
  try{ dir=await window.showDirectoryPicker(outputMode==='alongside'?{mode:'readwrite'}:{}); }
  catch{ return; }
  let targetHandle=null, targetName=null;
  if(outputMode==='alongside' && !await ensureRW(dir)){ alert('Write permission denied.'); return; }
  if(outputMode==='targetDir'){
    try{ targetHandle=await window.showDirectoryPicker({mode:'readwrite'}); }catch{ return; }
    if(!await ensureRW(targetHandle)){ alert('Write permission denied.'); return; }
    targetName=targetHandle.name;
  }
  staged={mode:'dir', dirHandle:dir, label:dir.name, outputMode, recursive, targetHandle, targetName};
  renderStaged();
};
async function walk(handle, prefix, recursive, out){
  for await (const entry of handle.values()){
    if(entry.kind==='file'){
      const dot=entry.name.lastIndexOf('.');
      const ext = dot>=0 ? entry.name.slice(dot).toLowerCase() : '';
      if(SUPP.has(ext)) out.push({label:prefix+entry.name, name:entry.name, parent:handle, getFile:()=>entry.getFile()});
    } else if(entry.kind==='directory' && recursive){
      await walk(entry, prefix+entry.name+'/', recursive, out);
    }
  }
}
async function ensureRW(h){
  const o={mode:'readwrite'};
  if(await h.queryPermission(o)==='granted') return true;
  return await h.requestPermission(o)==='granted';
}
async function writeInDir(dirHandle, fname, text){
  const fh=await dirHandle.getFileHandle(fname,{create:true});
  const w=await fh.createWritable(); await w.write(text); await w.close();
}
async function mirrorWrite(target, rel, text){
  const parts=rel.split('/'); const fname=parts.pop();
  let d=target;
  for(const p of parts){ if(p) d=await d.getDirectoryHandle(p,{create:true}); }
  await writeInDir(d, fname, text);
}

function receiptMd(run){
  const t=run.totals;
  return '# MarkItDown run '+run.id+'\\n\\n'+
    '- source: '+run.source.label+(run.source.recursive?' (recursive)':'')+'\\n'+
    '- output: '+run.outputMode+'\\n'+
    '- started: '+run.startedAt+'\\n- finished: '+run.finishedAt+'\\n'+
    '- found '+t.found+', converted '+t.converted+', failed '+t.failed+', skipped '+t.skipped+'\\n\\n'+
    '| file | status | bytes |\\n|---|---|---|\\n'+
    run.items.map(i=>'| '+i.input+' | '+i.status+' | '+(i.bytes||'')+' |').join('\\n')+'\\n';
}

function openFlyout(mdName){
  const md=STORE[mdName]||'';
  viewer={name:mdName.split('/').pop(), text:md};
  $('#fhname').textContent=mdName;
  $('#fbody').innerHTML = window.marked ? marked.parse(md) : '<pre>'+esc(md)+'</pre>';
  $('#flyout').classList.add('open'); $('#backdrop').classList.add('open');
}
function closeFlyout(){ $('#flyout').classList.remove('open'); $('#backdrop').classList.remove('open'); }
$('#fclose').onclick=e=>{e.preventDefault();closeFlyout();};
$('#backdrop').onclick=closeFlyout;
$('#fcopy').onclick=e=>{e.preventDefault();if(viewer){navigator.clipboard.writeText(viewer.text);e.target.textContent='copied';}};
$('#fdl').onclick=e=>{e.preventDefault();if(viewer)download(viewer.name,viewer.text);};

async function loadRuns(){
  let list=[];
  try{ list=await (await fetch(BASE+'/api/runs')).json(); }catch{ return; }
  $('#runcount').textContent=list.length;
  const el=$('#runlist');
  if(!list.length){ el.innerHTML='<div class="empty mini" style="padding:6px 0">No runs yet.</div>'; return; }
  const badge=s=>({done:'st-ok',partial:'st-go',failed:'st-err',cancelled:'st-q'}[s]||'st-q');
  el.innerHTML=list.map(r=>{
    const icon=(r.source&&r.source.kind==='dir')?'📁':'📄';
    const t=r.totals||{};
    const tok=r.tokenSaved?'~'+Math.round(r.tokenSaved/1000)+'k':'-';
    return '<div class="runrow">'+
      '<span>'+esc((r.startedAt||'').replace('T',' ').slice(0,19))+'</span>'+
      '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+icon+' '+esc(r.source?r.source.label:'?')+'</span>'+
      '<span class="mini">'+esc(r.outputMode||'')+'</span>'+
      '<span class="'+badge(r.status)+'">'+esc(r.status||'')+'</span>'+
      '<span class="mini">'+(t.converted||0)+'/'+(t.found||0)+'</span>'+
      '<span class="st-ok mini">'+tok+'</span>'+
      '<a href="'+BASE+'/api/runs/'+encodeURIComponent(r.id)+'" target="_blank" class="mini">json</a></div>';
  }).join('');
}
loadRuns();

$('#ghost').onclick=async()=>{
  if(!confirm('Restart the conversion service? In-progress runs will be interrupted.')) return;
  $('#ghost').disabled=true;
  $('#banner').innerHTML='♻ restarting service…'; $('#banner').style.color='#fb8';
  try{
    const s=await (await fetch(BASE+'/api/service/restart',{method:'POST'})).json();
    $('#banner').innerHTML=(s.ok?'🟢 ':'🔴 ')+esc(s.detail||''); $('#banner').style.color=s.ok?'#5d8':'#f87';
  }catch{ refreshStatus(); }
  finally{ $('#ghost').disabled=false; }
};

$('#clear').onclick=()=>{
  staged=null; renderStaged();
  $('#filelist').innerHTML='';
  resetAll();
  $('#work').innerHTML='<div class="empty mini">Nothing yet.</div>';
  $('#outs').innerHTML='<div class="empty mini">Summary appears here.</div>';
};
</script>
${ghostStamp({ version: meta.version, loadedAt: LOADED_AT })}</body></html>`;
}
