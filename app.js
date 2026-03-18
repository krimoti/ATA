/* ============================================================
   APP.JS — State, utilities, init, tabs, save/load
   MOTI HarnessPro
   ============================================================ */

'use strict';

/* ── Runtime connector library (builtin + custom merged) ── */
var CL = {};

/* ── Application State ── */
var S = {
  elements:   [],
  wires:      [],
  dimensions: [],
  title:      "CABLE ASS'Y",
  partNo:     'PN-00001',
  dwgNo:      'DWG-001',
  rev:        'A',
  drawnBy:    '',
  company:    '',
  cableLength: 500,
  lengthTol:   20,
  notes: [
    'No open/short or intermittent failures.',
    '100% electrical test required.',
    'Voltage test: DC 300V; Insulation: 5MΩ min.',
    'All dimensions in mm unless noted. RoHS Compliant.'
  ],
  bomItems:        [],
  zoom:            1,
  panX:            50,
  panY:            50,
  nextConnLabel:   1,
  customConnectors: []
};

/* ── Harness topology state ── */
var H = {
  nodes: [],  /* {id, label, connId, x, y, angle, isJunction, itemNo} */
  segs:  [],  /* {id, from, to, lengthMm, label, pts[], wires[]} */
  zoom:  1,
  panX:  120,
  panY:  150,
  sel:   null,
  drag:  null
};

/* ── Utilities ── */
function uid()  { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function sc(c)  { return (c && (c[0]==='#' || c.indexOf('hsl')===0 || c.indexOf('rgb')===0)) ? c : '#888'; }
function clamp(v,a,b) { return v<a?a:v>b?b:v; }
function toast(msg, err) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (err ? ' err' : '');
  clearTimeout(t._tid);
  t._tid = setTimeout(function(){ t.className = ''; }, 2400);
}
function hslc(h) { return 'hsl('+h+',65%,45%)'; }
function mkpins(n,pre,sig,awg,hStep) {
  var r=[];
  for(var i=0;i<n;i++) r.push({id:i+1,n:pre+(i+1),sig:sig,g:awg,c:hslc(i*hStep)});
  return r;
}
/* Array find polyfill */
function arrFind(arr, fn) {
  for(var i=0;i<arr.length;i++) if(fn(arr[i],i)) return arr[i];
  return null;
}

/* ── Merge custom connectors into CL ── */
function mergeCL() {
  /* Reset to builtins */
  for(var k in CL) { if(!CL[k].builtin) delete CL[k]; }
  /* Add customs */
  for(var i=0;i<S.customConnectors.length;i++) {
    var c = S.customConnectors[i];
    CL[c.id] = c;
  }
}

function initCL() {
  /* Copy builtins */
  for(var k in CL_BUILTIN) CL[k] = CL_BUILTIN[k];
  mergeCL();
}

/* ── Persistence ── */
var STORAGE_KEY = 'moti_harnesspro_v1';

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({S:S, H:{nodes:H.nodes,segs:H.segs}}));
  } catch(e) {}
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    var d = JSON.parse(raw);
    if(d.S) {
      var keys = Object.keys(d.S);
      for(var i=0;i<keys.length;i++) S[keys[i]] = d.S[keys[i]];
    }
    if(d.H) {
      if(d.H.nodes) H.nodes = d.H.nodes;
      if(d.H.segs)  H.segs  = d.H.segs;
    }
  } catch(e) {}
}

/* ── Export / Import JSON ── */
function exportJSON() {
  var data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    S: JSON.parse(JSON.stringify(S)),
    H: { nodes: JSON.parse(JSON.stringify(H.nodes)), segs: JSON.parse(JSON.stringify(H.segs)) }
  };
  var b = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'MOTI_' + (S.dwgNo||'project') + '_' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast('Project exported');
}

function importJSON(input) {
  var file = input.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var d = JSON.parse(ev.target.result);
      if(!confirm('Import project? Current data will be replaced.')) return;
      var st = d.S || d;
      var keys = Object.keys(st);
      for(var i=0;i<keys.length;i++) S[keys[i]] = st[keys[i]];
      if(d.H) {
        H.nodes = d.H.nodes || [];
        H.segs  = d.H.segs  || [];
      }
      mergeCL();
      saveState();
      buildSidebar();
      renderAll();
      syncTBAll();
      toast('Project imported');
    } catch(e) { toast('Import error: ' + e.message, true); }
  };
  reader.readAsText(file);
  input.value = '';
}

function saveHTML() {
  var b = new Blob([document.documentElement.outerHTML], {type:'text/html'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'MOTI_' + (S.dwgNo||'project') + '.html';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/* ── Toolbar sync ── */
function syncTBAll() {
  function stb(id,val){ var e=document.getElementById(id); if(e) e.value = val||''; }
  stb('tb-title', S.title);    stb('tb-pn',    S.partNo);
  stb('tb-dwg',   S.dwgNo);    stb('tb-rev',   S.rev);
  stb('tb-co',    S.company);  stb('tb-drawn', S.drawnBy);
  stb('tb-len',   S.cableLength); stb('tb-tol', S.lengthTol);
}

/* ── Theme ── */
function setTheme(v) {
  document.body.className = v;
  localStorage.setItem('moti_theme', v);
}

/* ── Tabs ── */
function showTab(id, btn) {
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('on'); });
  document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('on'); });
  if(btn) btn.classList.add('on');
  var panel = document.getElementById('panel-' + id);
  if(panel) panel.classList.add('on');
  if(id === 'canvas')     setTimeout(resizeCanvas, 50);
  if(id === 'harness')    setTimeout(renderHarness, 60);
  if(id === 'connectors') renderConnectorEditor();
}

/* ── renderAll ── */
function renderAll() {
  saveState();
  renderDrawing();
  renderRoutes();
  renderBOM();
  renderCutList();
  renderCanvas();
}

/* ── INIT ── */
window.addEventListener('load', function() {
  loadState();
  initCL();
  mergeCL();

  /* Theme */
  var th = localStorage.getItem('moti_theme') || '';
  document.body.className = th;
  var thSel = document.getElementById('th-sel');
  if(thSel) thSel.value = th;

  syncTBAll();
  buildSidebar();
  initCanvas();
  renderAll();
  setTool('select');

  /* Escape key */
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') {
      if(document.getElementById('dwg-modal').classList.contains('open')) closeDwgModal();
      if(typeof wireStart !== 'undefined' && wireStart) {
        wireStart = null;
        updateRouteHint(null);
        renderCanvas();
      }
    }
  });
});
