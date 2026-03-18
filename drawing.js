/* ============================================================
   DRAWING.JS v3 — Dynamic Multi-Format Engineering Drawing
   - Auto-fits everything to one sheet when possible
   - Overflows gracefully to sheet 2 only when needed
   - User controls format: A3/A2/A1 × landscape/portrait
   - Everything readable, sharp, professional
   MOTI HarnessPro
   ============================================================ */

'use strict';

/* ── State ── */
var DWG = {
  scale:     1,
  format:    'A3',    // A3 | A2 | A1
  orient:    'L',     // L=landscape | P=portrait
  showPins:  true,
  showBOM:   true,
  showNotes: true,
};

/* ── Paper sizes (px @ 96dpi, 3.78px/mm) ──
   A3 landscape: 420×297mm = 1587×1122  → we use 1400×990 (scaled for screen)
   A2 landscape: 594×420mm             → 2000×1400
   A1 landscape: 841×594mm             → 2800×2000
*/
var PAPER_SIZES = {
  'A3L': { w:1400, h: 990, label:'A3 Landscape',  css:'size:A3 landscape' },
  'A3P': { w: 990, h:1400, label:'A3 Portrait',   css:'size:A3 portrait'  },
  'A2L': { w:1980, h:1400, label:'A2 Landscape',  css:'size:A2 landscape' },
  'A2P': { w:1400, h:1980, label:'A2 Portrait',   css:'size:A2 portrait'  },
  'A1L': { w:2800, h:2000, label:'A1 Landscape',  css:'size:A1 landscape' },
};
function paperKey(){ return DWG.format + DWG.orient; }
function paper(){ return PAPER_SIZES[paperKey()] || PAPER_SIZES['A3L']; }

/* ────────────────────────────────────────────────────────────
   MODAL CONTROL
   ──────────────────────────────────────────────────────────── */
function openDwgModal(){
  if(!H.nodes) H.nodes=[];
  if(!H.segs)  H.segs=[];
  hvBuildTopology();
  document.getElementById('dwg-modal').classList.add('open');
  _dwgBuildTopbar();
  setTimeout(dwgRegen, 100);
}
function closeDwgModal(){
  document.getElementById('dwg-modal').classList.remove('open');
}

/* Build the topbar controls dynamically */
function _dwgBuildTopbar(){
  var bar = document.getElementById('dwg-topbar');
  if(!bar) return;
  bar.innerHTML = [
    '<span style="color:var(--accent);font-size:10px;font-weight:bold;letter-spacing:3px">📐 ENG DRAWING</span>',
    '<span style="color:#383838;font-size:8px;margin-left:4px" id="dwg-sheet-info"></span>',
    '<span style="flex:1"></span>',
    // Format selector
    '<span style="color:#666;font-size:8px">FORMAT:</span>',
    '<select id="dwg-fmt" style="background:#181818;border:1px solid #3a3a3a;color:var(--accent);padding:2px 5px;font-family:monospace;font-size:9px" onchange="DWG.format=this.value;dwgRegen()">',
    ['A3','A2','A1'].map(function(f){ return '<option value="'+f+'"'+(DWG.format===f?' selected':'')+'>'+f+'</option>'; }).join(''),
    '</select>',
    '<select id="dwg-orient" style="background:#181818;border:1px solid #3a3a3a;color:var(--accent);padding:2px 5px;font-family:monospace;font-size:9px" onchange="DWG.orient=this.value;dwgRegen()">',
    '<option value="L"'+(DWG.orient==='L'?' selected':'')+'>Landscape</option>',
    '<option value="P"'+(DWG.orient==='P'?' selected':'')+'>Portrait</option>',
    '</select>',
    // Toggle sections
    '<span style="color:#666;font-size:8px;margin-left:6px">SHOW:</span>',
    '<label style="font-size:8px;color:#aaa;cursor:pointer"><input type="checkbox" id="dwg-pins"'+(DWG.showPins?' checked':'')+' onchange="DWG.showPins=this.checked;dwgRegen()"> Pin Tables</label>',
    '<label style="font-size:8px;color:#aaa;cursor:pointer"><input type="checkbox" id="dwg-bom"'+(DWG.showBOM?' checked':'')+' onchange="DWG.showBOM=this.checked;dwgRegen()"> BOM</label>',
    '<label style="font-size:8px;color:#aaa;cursor:pointer"><input type="checkbox" id="dwg-notes"'+(DWG.showNotes?' checked':'')+' onchange="DWG.showNotes=this.checked;dwgRegen()"> Notes</label>',
    // Zoom
    '<button class="dwg-topbtn" onclick="dwgZoom(1.15)" style="margin-left:6px">+</button>',
    '<button class="dwg-topbtn" onclick="dwgZoom(0.87)">−</button>',
    '<button class="dwg-topbtn" onclick="dwgFit()">⊞ FIT</button>',
    '<button class="dwg-topbtn" onclick="dwgRegen()">↺ REGEN</button>',
    '<button style="background:var(--accent);border:1px solid #907020;color:#000;font-weight:bold;padding:4px 14px;cursor:pointer;font-family:monospace;font-size:9px;margin-left:6px" onclick="dwgPrint()">🖨 PRINT / PDF</button>',
    '<button onclick="closeDwgModal()" style="background:#282828;border:1px solid #444;color:#aaa;padding:3px 10px;cursor:pointer;font-family:monospace;font-size:12px;margin-left:6px">✕</button>',
  ].join('');
}

/* ── Zoom / Fit ── */
function dwgZoom(f){
  DWG.scale = Math.max(0.15, Math.min(3, DWG.scale * f));
  _dwgApplyScale();
}
function dwgFit(){
  var scroll = document.getElementById('dwg-scroll');
  var wrap   = document.getElementById('dwg-paper');
  if(!scroll || !wrap) return;
  // Reset scale first to get natural size
  wrap.style.transform = 'scale(1)';
  var paperW = paper().w;
  var scrollW = scroll.clientWidth - 56;
  DWG.scale = Math.max(0.15, Math.min(1.4, scrollW / paperW));
  _dwgApplyScale();
}
function _dwgApplyScale(){
  var p = document.getElementById('dwg-paper');
  if(p) p.style.transform = 'scale(' + DWG.scale + ')';
}

/* ── Regen ── */
function dwgRegen(){
  var wrap = document.getElementById('dwg-paper');
  if(!wrap) return;
  try {
    if(!H.nodes) H.nodes=[];
    if(!H.segs)  H.segs=[];
    hvBuildTopology();
    var sheets = buildAllSheets();
    wrap.innerHTML = sheets.map(function(svg){
      return '<div style="margin-bottom:32px;box-shadow:0 8px 40px rgba(0,0,0,0.6);display:block">' + svg + '</div>';
    }).join('');
    wrap.style.transformOrigin = 'top left';
    var info = document.getElementById('dwg-sheet-info');
    if(info) info.textContent = sheets.length + ' sheet' + (sheets.length>1?'s':'') + ' · ' + paper().label;
    setTimeout(dwgFit, 60);
  } catch(err) {
    wrap.innerHTML = '<div style="padding:40px;font-family:monospace;color:#e74c3c;font-size:11px;background:#111">'
      + '<b>Drawing error:</b><br><br>' + String(err)
      + '<br><br>Stack: ' + (err.stack||'').substring(0,400) + '</div>';
    console.error('dwgRegen:', err);
  }
}

/* ── Print ── */
function dwgPrint(){
  var wrap = document.getElementById('dwg-paper');
  if(!wrap) return;
  var win = window.open('','_blank','width=1400,height=960');
  if(!win) return;
  win.document.write([
    '<!DOCTYPE html><html><head><meta charset="UTF-8">',
    '<title>' + esc(S.title||'Engineering Drawing') + '</title>',
    '<style>',
    '@page { ' + paper().css + '; margin: 4mm }',
    'body { margin:0; padding:0; background:#fff }',
    '.sheet { page-break-after: always }',
    '.sheet:last-child { page-break-after: avoid }',
    '</style></head><body>',
    wrap.innerHTML.replace(/margin-bottom:32px[^"]*"/g, '"'),
    '</body></html>'
  ].join(''));
  win.document.close();
  win.focus();
  setTimeout(function(){ win.print(); }, 600);
}

/* ── Drag-to-pan ── */
(function(){
  var el, dragging=false, sx,sy,sl,st;
  function g(){ el=document.getElementById('dwg-scroll'); }
  document.addEventListener('mousedown',function(e){
    if(!el)g(); if(!el||!el.contains(e.target))return;
    if(e.target.tagName==='BUTTON'||e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='LABEL')return;
    dragging=true; sx=e.clientX; sy=e.clientY; sl=el.scrollLeft; st=el.scrollTop; el.style.cursor='grabbing';
  });
  document.addEventListener('mousemove',function(e){
    if(!dragging)return; el.scrollLeft=sl-(e.clientX-sx); el.scrollTop=st-(e.clientY-sy);
  });
  document.addEventListener('mouseup',function(){
    if(!dragging)return; dragging=false; if(el)el.style.cursor='grab';
  });
  document.addEventListener('wheel',function(e){
    if(!el)g(); if(!el||!el.contains(e.target))return;
    if(e.ctrlKey||e.metaKey){e.preventDefault();dwgZoom(e.deltaY<0?1.1:.91);}
  },{passive:false});
})();

/* ════════════════════════════════════════════════════════════
   SVG UTILITIES
   ════════════════════════════════════════════════════════════ */
function xe(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function xc(c){ return (c&&(c[0]==='#'||c.indexOf('hsl')===0||c.indexOf('rgb')===0))?c:'#888'; }
function f1(n){ return Number(n).toFixed(1); }

/* ── SVG line ── */
function ln(x1,y1,x2,y2,stroke,sw,dash){
  return '<line x1="'+f1(x1)+'" y1="'+f1(y1)+'" x2="'+f1(x2)+'" y2="'+f1(y2)+'"'
    +' stroke="'+stroke+'" stroke-width="'+(sw||1)+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
}
/* ── SVG text ── */
function tx(x,y,text,fs,fill,anchor,weight,ls){
  return '<text x="'+f1(x)+'" y="'+f1(y)+'" font-size="'+(fs||8)+'" fill="'+(fill||'#111')+'"'
    +' text-anchor="'+(anchor||'start')+'"'+(weight?' font-weight="'+weight+'"':'')+(ls?' letter-spacing="'+ls+'"':'')+'>'+xe(String(text||''))+'</text>';
}
/* ── SVG rect ── */
function rc(x,y,w,h,fill,stroke,sw,rx2){
  return '<rect x="'+f1(x)+'" y="'+f1(y)+'" width="'+f1(w)+'" height="'+f1(h)+'"'
    +' fill="'+(fill||'none')+'" stroke="'+(stroke||'none')+'" stroke-width="'+(sw||1)+'"'+(rx2?' rx="'+rx2+'"':'')+'/>';
}

/* ════════════════════════════════════════════════════════════
   LAYOUT CALCULATOR
   Decides what fits on sheet 1, what overflows to sheet 2
   ════════════════════════════════════════════════════════════ */
function calcLayout(PW, PH, ML, MR, MT, MB){
  var DX=ML+6, DY=MT+6;
  var DW=PW-ML-MR-12, DH=PH-MT-MB-66; // 66 = title block

  // Right column: ECO table (fixed width)
  var ECO_W=180, ECO_H=50;

  // Harness diagram zone — minimum usable height
  var MIN_HARNESS_H = Math.round(DH * 0.35);
  var MAX_HARNESS_H = Math.round(DH * 0.65);

  // Count connectors (for pin table sizing)
  var connNodes = H.nodes.filter(function(n){ return !n.isJunction && CL[n.connId]; });
  var maxPins = 0;
  connNodes.forEach(function(n){ if(CL[n.connId]&&CL[n.connId].pins>maxPins)maxPins=CL[n.connId].pins; });
  var pinRowH=10, pinHdrH=26; // header + col header
  var pinTableH = pinHdrH + maxPins * pinRowH + 4;
  var pinTableW = Math.max(170, Math.min(220, Math.floor((DW-ECO_W-4) / Math.max(1,connNodes.length))));
  var pinTablesTotalW = connNodes.length * (pinTableW + 4);
  var pinCols = DWG.showPins ? Math.min(connNodes.length, Math.floor((DW*0.62) / (pinTableW+4))) : 0;
  var pinRows = pinCols>0 ? Math.ceil(connNodes.length / pinCols) : 0;
  var pinBlockH = DWG.showPins ? (pinRows * (pinTableH + 6)) : 0;

  // BOM size
  var bomItems = [];
  connNodes.forEach(function(n){var l=CL[n.connId];if(l)bomItems.push(l);});
  (S.bomItems||[]).forEach(function(it){bomItems.push(it);});
  var bomRowH = 9, bomHdrH = 26;
  var bomH = DWG.showBOM ? (bomHdrH + bomItems.length * bomRowH + 4) : 0;
  var bomW = DW*0.38;

  // Notes size
  var notes = (S.notes||[]);
  var notesH = DWG.showNotes ? (notes.length * 12 + 16) : 0;
  var notesW = bomW;

  // Right block height (BOM + notes)
  var rightBlockH = Math.max(bomH + notesH + 8, bomH, notesH);

  // Can everything fit on one sheet?
  var availH = DH;
  var harnessH = Math.min(MAX_HARNESS_H, availH - pinBlockH - rightBlockH - 20);
  harnessH = Math.max(MIN_HARNESS_H, harnessH);
  var pinBlockY = DY + harnessH + 6;
  var pinsActualH = availH - harnessH - rightBlockH - 16;
  var singleSheet = pinBlockH <= pinsActualH;

  return {
    DX:DX, DY:DY, DW:DW, DH:DH,
    ECO_W:ECO_W, ECO_H:ECO_H,
    harnessH:harnessH,
    pinBlockY:pinBlockY,
    pinBlockH:pinBlockH,
    pinCols:pinCols, pinRows:pinRows,
    pinTableW:pinTableW, pinTableH:pinTableH,
    bomW:bomW, bomH:bomH, bomHdrH:bomHdrH,
    notesW:notesW, notesH:notesH,
    rightBlockH:rightBlockH,
    connNodes:connNodes,
    bomItems:bomItems, notes:notes,
    singleSheet:singleSheet
  };
}

/* ════════════════════════════════════════════════════════════
   MAIN ENTRY: build all sheets
   ════════════════════════════════════════════════════════════ */
function buildAllSheets(){
  var PW=paper().w, PH=paper().h, ML=22, MR=22, MT=18, MB=18;
  var layout = calcLayout(PW, PH, ML, MR, MT, MB);

  var sheets = [];
  sheets.push(buildSheet1SVG(PW, PH, ML, MR, MT, MB, layout));
  if(!layout.singleSheet){
    sheets.push(buildSheet2SVG(PW, PH, ML, MR, MT, MB, layout));
  }
  return sheets;
}

/* ════════════════════════════════════════════════════════════
   SHEET 1 — Main harness drawing
   ════════════════════════════════════════════════════════════ */
function buildSheet1SVG(PW, PH, ML, MR, MT, MB, L){
  var svg=[], totalSheets = L.singleSheet?1:2;
  function p(s){ svg.push(s); }
  var today=new Date().toLocaleDateString('en-GB');
  var TB_H=60, TB_Y=PH-MB-TB_H;

  /* ── Paper base ── */
  p('<svg xmlns="http://www.w3.org/2000/svg" width="'+PW+'" height="'+PH+'" viewBox="0 0 '+PW+' '+PH+'" style="font-family:\'Courier New\',Courier,monospace;background:#fff;display:block">');
  p(rc(0,0,PW,PH,'#f7f5ee'));
  p(rc(ML,MT,PW-ML-MR,PH-MT-MB,'none','#111',2));
  p(rc(ML+5,MT+5,PW-ML-MR-10,PH-MT-MB-10,'none','#555',0.4));
  _zoneMarks(p, PW, PH, ML, MR, MT, MB);

  var DX=L.DX, DY=L.DY, DW=L.DW;

  /* ── Grid ── */
  p('<g opacity="0.055" stroke="#000" stroke-width="0.3">');
  for(var gx=DX;gx<DX+DW;gx+=20) p(ln(gx,DY,gx,TB_Y,'#000',0.3));
  for(var gy=DY;gy<TB_Y;gy+=20)  p(ln(DX,gy,DX+DW,gy,'#000',0.3));
  p('</g>');

  /* ── Section divider lines ── */
  var harnessBottomY = DY + L.harnessH;
  p(ln(DX, harnessBottomY, DX+DW, harnessBottomY, '#bbb', 0.6, '5,3'));
  p(ln(DX,TB_Y,DX+DW,TB_Y,'#333',1));

  /* ── Section labels ── */
  p(tx(DX+3, DY+10, 'HARNESS TOPOLOGY', 7, '#aaa', 'start', 'bold', '1.5'));
  if(DWG.showPins && L.pinCols>0)
    p(tx(DX+3, L.pinBlockY+10, 'CONNECTOR PIN TABLES', 7, '#aaa', 'start', 'bold', '1.5'));

  /* ── ECO/Revision table ── */
  _drawECOTable(p, DX+DW-L.ECO_W, DY, L.ECO_W);

  /* ── Harness diagram ── */
  var hZoneX=DX+6, hZoneY=DY+14;
  var hZoneW=DW-L.ECO_W-12, hZoneH=L.harnessH-20;
  _drawHarnessTopology(p, hZoneX, hZoneY, hZoneW, hZoneH);

  /* ── Pin tables (if fit on sheet 1) ── */
  if(DWG.showPins && L.singleSheet && L.pinCols>0){
    _drawPinTables(p, DX+4, L.pinBlockY+14, L.DW-L.bomW-8, L.pinCols, L.pinTableW, L.connNodes);
  }

  /* ── Right column: BOM + Notes ── */
  var rightX = DX + DW - L.bomW - 2;
  var rightY = DWG.showPins && L.singleSheet ? L.pinBlockY+14 : harnessBottomY+14;

  if(DWG.showBOM && L.singleSheet){
    rightY = _drawBOM(p, rightX, rightY, L.bomW, TB_Y-rightY-L.notesH-10, L.bomItems);
    rightY += 6;
  }
  if(DWG.showNotes && L.singleSheet){
    _drawNotes(p, DX+4, TB_Y-L.notesH-4, DW-L.bomW-12, L.notesH, S.notes||[]);
  }

  /* ── Title block ── */
  _drawTitleBlock(p, PW, PH, ML, MR, MB, TB_Y, TB_H, 1, totalSheets, today);

  p('</svg>');
  return svg.join('\n');
}

/* ════════════════════════════════════════════════════════════
   SHEET 2 — Overflow (pin tables + BOM + notes)
   ════════════════════════════════════════════════════════════ */
function buildSheet2SVG(PW, PH, ML, MR, MT, MB, L){
  var svg=[];
  function p(s){ svg.push(s); }
  var today=new Date().toLocaleDateString('en-GB');
  var TB_H=60, TB_Y=PH-MB-TB_H;
  var DX=L.DX, DY=L.DY, DW=L.DW;

  p('<svg xmlns="http://www.w3.org/2000/svg" width="'+PW+'" height="'+PH+'" viewBox="0 0 '+PW+' '+PH+'" style="font-family:\'Courier New\',Courier,monospace;background:#fff;display:block">');
  p(rc(0,0,PW,PH,'#f7f5ee'));
  p(rc(ML,MT,PW-ML-MR,PH-MT-MB,'none','#111',2));
  p(rc(ML+5,MT+5,PW-ML-MR-10,PH-MT-MB-10,'none','#555',0.4));
  _zoneMarks(p, PW, PH, ML, MR, MT, MB);
  p('<g opacity="0.055" stroke="#000" stroke-width="0.3">');
  for(var gx=DX;gx<DX+DW;gx+=20) p(ln(gx,DY,gx,TB_Y,'#000',0.3));
  for(var gy=DY;gy<TB_Y;gy+=20)  p(ln(DX,gy,DX+DW,gy,'#000',0.3));
  p('</g>');
  p(ln(DX,TB_Y,DX+DW,TB_Y,'#333',1));
  p(tx(DX+3, DY+10, 'CONNECTOR PIN TABLES (CONT.)', 7, '#aaa', 'start', 'bold', '1.5'));

  var curY = DY + 14;

  /* Pin tables */
  if(DWG.showPins){
    curY = _drawPinTables(p, DX+4, curY, DW-L.bomW-8, L.pinCols, L.pinTableW, L.connNodes);
    curY += 10;
  }

  /* BOM */
  if(DWG.showBOM){
    p(ln(DX+4, curY-2, DX+DW-4, curY-2, '#bbb', 0.6, '4,3'));
    p(tx(DX+3, curY+8, 'BILL OF MATERIALS', 7, '#aaa', 'start', 'bold', '1.5'));
    curY = _drawBOM(p, DX+4, curY+14, DW*0.7, TB_Y-curY-L.notesH-30, L.bomItems);
    curY += 8;
  }

  /* Notes */
  if(DWG.showNotes){
    _drawNotes(p, DX+4, TB_Y-L.notesH-4, DW*0.7, L.notesH, S.notes||[]);
  }

  _drawTitleBlock(p, PW, PH, ML, MR, MB, TB_Y, TB_H, 2, 2, today);

  p('</svg>');
  return svg.join('\n');
}

/* ════════════════════════════════════════════════════════════
   DRAWING SUB-FUNCTIONS
   ════════════════════════════════════════════════════════════ */

/* ── Zone marks ── */
function _zoneMarks(p, PW, PH, ML, MR, MT, MB){
  var DW=PW-ML-MR, DH=PH-MT-MB;
  var zW=DW/8, zH=DH/6;
  'ABCDEFGH'.split('').forEach(function(l,i){
    var zx=ML+zW*(i+0.5);
    p(tx(zx,MT-4,l,7,'#bbb','middle'));
    p(tx(zx,PH-MB+10,l,7,'#bbb','middle'));
  });
  for(var zi=0;zi<6;zi++){
    var zy=MT+zH*(zi+0.5);
    p(tx(ML-6,zy+3,zi+1,7,'#bbb','middle'));
    p(tx(PW-MR+7,zy+3,zi+1,7,'#bbb','middle'));
  }
}

/* ── ECO/Revision table ── */
function _drawECOTable(p, x, y, w){
  var H2=50, hh=13, rh=10;
  p(rc(x,y,w,H2,'#f5f2ea','#999',0.7));
  p(rc(x,y,w,hh,'#c8c4b0'));
  p(tx(x+w/2,y+9,'REVISIONS',7.5,'#111','middle','bold','1'));
  var cols=[22,42,34,28,w-126];
  var cxs=[x+1]; cols.forEach(function(cw,i){if(i>0)cxs.push(cxs[i-1]+cols[i-1]);});
  p(rc(x,y+hh,w,rh,'#dedad0'));
  ['REV','DATE','DRAW','APR','DESCRIPTION'].forEach(function(h,i){
    p(tx(cxs[i]+2,y+hh+7.5,h,6,'#333','start','bold'));
  });
  cxs.slice(1).forEach(function(cx2){ p(ln(cx2,y,cx2,y+H2,'#ccc',0.4)); });
  // Latest revision row
  var ry=y+hh+rh+9;
  p(tx(cxs[0]+2,ry,S.rev||'A',7,'#336699','start','bold'));
  p(tx(cxs[1]+2,ry,new Date().toLocaleDateString('en-GB'),6,'#222'));
  p(tx(cxs[2]+2,ry,S.drawnBy||'—',6,'#222'));
  p(tx(cxs[4]+2,ry,'Initial Release',6,'#222'));
}

/* ── Harness topology diagram ── */
function _drawHarnessTopology(p, zx, zy, zw, zh){
  var hNodes=H.nodes, hSegs=H.segs;

  // Compute bounding box of harness nodes
  var xs=hNodes.map(function(n){return n.x;}), ys=hNodes.map(function(n){return n.y;});
  var mnX=xs.length?Math.min.apply(null,xs)-70:-200;
  var mxX=xs.length?Math.max.apply(null,xs)+70:200;
  var mnY=ys.length?Math.min.apply(null,ys)-60:-100;
  var mxY=ys.length?Math.max.apply(null,ys)+60:100;
  var rnX=mxX-mnX||400, rnY=mxY-mnY||200;
  var scX=zw/rnX, scY=zh/rnY, sc2=Math.min(scX,scY)*0.88;
  var oX=zx+zw/2-(mnX+rnX/2)*sc2;
  var oY=zy+zh/2-(mnY+rnY/2)*sc2;

  function mN(n){ return{x:oX+n.x*sc2, y:oY+n.y*sc2}; }
  var connMap={};
  hNodes.forEach(function(n){ connMap[n.id]=mN(n); });

  /* Draw segments */
  hSegs.forEach(function(seg){
    var n1=null,n2=null;
    hNodes.forEach(function(n){if(n.id===seg.from)n1=n;if(n.id===seg.to)n2=n;});
    if(!n1||!n2) return;
    var p1=mN(n1),p2=mN(n2);
    var a1=(n1.angle||0)*Math.PI/180, a2=(n2.angle||0)*Math.PI/180;
    var stub=Math.max(20,Math.min(50,30*sc2));
    var s1={x:p1.x+Math.cos(a1)*stub,y:p1.y+Math.sin(a1)*stub};
    var s2={x:p2.x+Math.cos(a2)*stub,y:p2.y+Math.sin(a2)*stub};
    var bpts=(seg.pts||[]).map(function(b){return{x:oX+b.x*sc2,y:oY+b.y*sc2};});
    var allPts=[s1].concat(bpts).concat([s2]);
    var thick=Math.max(4,Math.min(26,4+(seg.wires||[]).length*2.2));
    _drawCableSVG(p, allPts, seg.wires, thick);

    /* Dimension */
    if(seg.lengthMm>0 && allPts.length>=2){
      var totalLen=0,cumL=[0];
      for(var i=0;i<allPts.length-1;i++){
        var dx=allPts[i+1].x-allPts[i].x,dy=allPts[i+1].y-allPts[i].y;
        totalLen+=Math.sqrt(dx*dx+dy*dy); cumL.push(totalLen);
      }
      var half=totalLen/2,mid={x:0,y:0},mAng=0;
      for(var i=1;i<allPts.length;i++){
        if(cumL[i]>=half){
          var tt=(half-cumL[i-1])/(cumL[i]-cumL[i-1]);
          mid={x:allPts[i-1].x+(allPts[i].x-allPts[i-1].x)*tt,
               y:allPts[i-1].y+(allPts[i].y-allPts[i-1].y)*tt};
          mAng=Math.atan2(allPts[i].y-allPts[i-1].y,allPts[i].x-allPts[i-1].x); break;
        }
      }
      var py2=Math.sin(mAng+Math.PI/2);
      var side2=py2<=0?1:-1;
      var dimTxt=(seg.label?seg.label+'  ':'')+seg.lengthMm+' mm'+(S.lengthTol?' ±'+S.lengthTol:'');
      _drawDimLine(p, allPts[0], allPts[allPts.length-1], mid, mAng, dimTxt, side2, thick/2+18);
    }
  });

  /* Draw connector bodies */
  hNodes.forEach(function(nd,idx){
    var m=mN(nd);
    if(nd.isJunction){
      p('<circle cx="'+f1(m.x)+'" cy="'+f1(m.y)+'" r="8" fill="#2c2820" stroke="#888" stroke-width="1.2"/>');
      p(tx(m.x,m.y+3,nd.label||'J',7,'#f0e8d0','middle','bold'));
      return;
    }
    var lib=CL[nd.connId]; if(!lib)return;
    var itemN=nd.itemNo||String.fromCharCode(65+idx);
    _drawConnectorSVG(p, m.x, m.y, lib, nd.angle||0, nd.label||'?', itemN);
  });
}

/* ── Cable SVG ── */
function _drawCableSVG(p, pts, wires, thick){
  var d='M'+f1(pts[0].x)+' '+f1(pts[0].y);
  for(var i=1;i<pts.length;i++) d+=' L'+f1(pts[i].x)+' '+f1(pts[i].y);
  // Shadow
  p('<path d="'+d+'" stroke="rgba(0,0,0,0.18)" stroke-width="'+(thick+4)+'" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
  // Sheath
  p('<path d="'+d+'" stroke="#22201a" stroke-width="'+thick+'" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
  // Highlight
  p('<path d="'+d+'" stroke="rgba(175,160,118,0.35)" stroke-width="'+(thick*0.36)+'" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
  // Braid hatch
  for(var si=0;si<pts.length-1;si++){
    var ax=pts[si].x,ay=pts[si].y,bx=pts[si+1].x,by=pts[si+1].y;
    var sl=Math.sqrt((bx-ax)*(bx-ax)+(by-ay)*(by-ay));
    if(sl<1) continue;
    var ag=Math.atan2(by-ay,bx-ax);
    var nx=Math.cos(ag+Math.PI/2)*thick*0.44, ny=Math.sin(ag+Math.PI/2)*thick*0.44;
    var sp=Math.max(7, thick*0.9);
    for(var t=sp/2;t<sl-sp/2;t+=sp){
      var tx2=ax+Math.cos(ag)*t, ty2=ay+Math.sin(ag)*t;
      var dx2=Math.cos(ag)*4, dy2=Math.sin(ag)*4;
      p(ln(tx2+nx,ty2+ny,tx2-nx+dx2,ty2-ny+dy2,'rgba(190,178,142,0.32)',0.65));
      p(ln(tx2-nx,ty2-ny,tx2+nx+dx2,ty2+ny+dy2,'rgba(190,178,142,0.32)',0.65));
    }
  }
  // Wire colour stripes
  var wCols=[];
  (wires||[]).forEach(function(wid){
    for(var i=0;i<S.wires.length;i++) if(S.wires[i].id===wid){wCols.push(xc(S.wires[i].color||'#888'));break;}
  });
  var maxS=Math.min(wCols.length,8);
  if(maxS>0){
    var sw=Math.max(0.8,thick*0.1), spread=thick*0.28;
    wCols.slice(0,maxS).forEach(function(col,ci){
      var t2=maxS===1?0:((ci/(maxS-1))*2-1)*spread;
      var dOff='';
      for(var pi=0;pi<pts.length-1;pi++){
        var ddx=pts[pi+1].x-pts[pi].x, ddy=pts[pi+1].y-pts[pi].y;
        var l=Math.sqrt(ddx*ddx+ddy*ddy)||1;
        var nnx=-ddy/l*t2, nny=ddx/l*t2;
        if(pi===0) dOff='M'+f1(pts[0].x+nnx)+' '+f1(pts[0].y+nny);
        dOff+=' L'+f1(pts[pi+1].x+nnx)+' '+f1(pts[pi+1].y+nny);
      }
      p('<path d="'+dOff+'" stroke="'+col+'" stroke-width="'+sw.toFixed(1)+'" fill="none" stroke-linecap="butt"/>');
    });
  }
}

/* ── Connector body SVG ── */
function _drawConnectorSVG(p, cx, cy, lib, angle, label, itemN){
  var pins=lib.pins;
  var bw=Math.max(22,Math.min(42,20+pins*1.1));
  var bh=Math.max(18,Math.min(38,12+pins*1.7));
  var gid='cg_'+label.replace(/[^a-z0-9]/gi,'_')+'_'+Math.random().toString(36).slice(2,5);
  p('<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1">');
  p('<stop offset="0%" stop-color="#aea698"/><stop offset="40%" stop-color="#c6beb0"/>');
  p('<stop offset="60%" stop-color="#b6aea0"/><stop offset="100%" stop-color="#706860"/>');
  p('</linearGradient></defs>');
  p('<g transform="translate('+f1(cx)+','+f1(cy)+') rotate('+angle+')">');
  // Shadow
  p(rc(-bw/2+2,-bh/2+2,bw,bh,'rgba(0,0,0,0.22)','none',0,3));
  // Shell
  p(rc(-bw/2,-bh/2,bw,bh,'url(#'+gid+')','#50483c',1,3));
  // Insert
  p(rc(-bw*0.42,-bh*0.4,bw*0.84,bh*0.8,'#282010','#180808',0.5,2));
  // Keying tab
  p(rc(-bw*0.22,-bh/2-4,bw*0.44,4.5,'#807868','#605848',0.6,2));
  // Pins
  var cols2=Math.ceil(Math.sqrt(pins)),rows2=Math.ceil(pins/cols2);
  var cw2=bw*0.84/cols2,ch2=bh*0.8/rows2;
  var dr=Math.max(1.5,Math.min(3.8,cw2*0.3));
  lib.pinout.forEach(function(pp,i){
    var c=i%cols2,r=Math.floor(i/cols2);
    var px=-bw*0.42+cw2*(c+0.5),py=-bh*0.4+ch2*(r+0.5);
    p('<circle cx="'+f1(px)+'" cy="'+f1(py)+'" r="'+dr+'" fill="'+xc(pp.c)+'" stroke="rgba(0,0,0,0.55)" stroke-width="0.4"/>');
  });
  p('</g>');
  // Labels (unrotated)
  p(tx(cx,cy+bh/2+12,label,9,'#111','middle','bold'));
  p(tx(cx,cy+bh/2+21,lib.short,7,'#555','middle'));
  // Item balloon
  if(itemN!==undefined){
    var bx=cx+bw/2+18,by=cy-bh/2-16;
    p(ln(bx,by,cx,cy,'#444',0.8));
    p('<circle cx="'+f1(bx)+'" cy="'+f1(by)+'" r="9" fill="white" stroke="#111" stroke-width="1.2"/>');
    p(tx(bx,by+3.5,String(itemN),8.5,'#111','middle','bold'));
  }
}

/* ── Dimension line SVG ── */
function _drawDimLine(p, ep1, ep2, mid, ang, text, side, offset){
  var px2=Math.cos(ang+Math.PI/2)*side, py2=Math.sin(ang+Math.PI/2)*side;
  var lx=mid.x+px2*offset, ly=mid.y+py2*offset;
  var d1x=ep1.x+px2*offset, d1y=ep1.y+py2*offset;
  var d2x=ep2.x+px2*offset, d2y=ep2.y+py2*offset;
  // Extension lines
  p(ln(ep1.x,ep1.y,d1x,d1y,'#336699',0.65,'2.5,2'));
  p(ln(ep2.x,ep2.y,d2x,d2y,'#336699',0.65,'2.5,2'));
  // Dim line
  p(ln(d1x,d1y,d2x,d2y,'#336699',0.9));
  // Arrows
  function arr(px3,py3,aa){
    var s=8,a1=aa+2.65,a2=aa-2.65;
    p(ln(px3,py3,px3+Math.cos(a1)*s,py3+Math.sin(a1)*s,'#336699',0.9));
    p(ln(px3,py3,px3+Math.cos(a2)*s,py3+Math.sin(a2)*s,'#336699',0.9));
  }
  arr(d1x,d1y,Math.atan2(d2y-d1y,d2x-d1x)+Math.PI);
  arr(d2x,d2y,Math.atan2(d1y-d2y,d1x-d2x)+Math.PI);
  // Label
  var drawAng=(ang>Math.PI/2||ang<-Math.PI/2)?ang+Math.PI:ang;
  var tw=text.length*6+12;
  p('<g transform="translate('+f1(lx)+','+f1(ly)+') rotate('+(drawAng*180/Math.PI).toFixed(1)+')">');
  p(rc(-tw/2,-10,tw,12,'rgba(247,245,238,0.97)','#336699',0.7,1.5));
  p(tx(0,0,text,8.5,'#336699','middle','bold'));
  p('</g>');
}

/* ── Pin tables ── */
function _drawPinTables(p, startX, startY, maxW, pinCols, ptW, connNodes){
  var ptRowH=10, ptHdrH=15, ptColH=11;
  var curY=startY;
  connNodes.forEach(function(nd,idx){
    var lib=CL[nd.connId]; if(!lib)return;
    var col=idx%pinCols, row=Math.floor(idx/pinCols);
    var px=startX+col*(ptW+4);
    var py=startY+row*(ptHdrH+ptColH+lib.pinout.length*ptRowH+4+6);
    var tH=ptHdrH+ptColH+lib.pinout.length*ptRowH+4;
    var itemN=nd.itemNo||String.fromCharCode(65+idx);

    p(rc(px,py,ptW,tH,'#fff','#b0a890',0.8));
    p(rc(px,py,ptW,ptHdrH,'#c4bfb0'));
    p(tx(px+5,py+11,nd.label+' — '+lib.short+' ('+lib.pins+'P)',8.5,'#111','start','bold'));
    p('<circle cx="'+(px+ptW-12)+'" cy="'+(py+8)+'" r="7" fill="white" stroke="#222" stroke-width="1"/>');
    p(tx(px+ptW-12,py+11,String(itemN),7.5,'#111','middle','bold'));

    // Column headers
    var cws=[13,ptW*0.23,ptW*0.22,ptW*0.13,ptW*0.14,ptW*0.16];
    var cxs=[px+2]; cws.forEach(function(w,i){if(i>0)cxs.push(cxs[i-1]+cws[i-1]);});
    p(rc(px,py+ptHdrH,ptW,ptColH,'#dedad0'));
    ['#','NAME','SIGNAL','AWG','CLR','→ TO'].forEach(function(h,i){
      p(tx(cxs[i]+1,py+ptHdrH+8,h,6.5,'#333','start','bold'));
    });
    cxs.slice(1).forEach(function(cx2){
      p(ln(cx2,py,cx2,py+tH,'#ddd',0.4));
    });

    lib.pinout.forEach(function(pp,i){
      var ry=py+ptHdrH+ptColH+ptRowH*(i+1);
      if(i%2===0) p(rc(px+1,ry-ptRowH+1,ptW-2,ptRowH,'#f4f2ec'));
      var wfp=null;
      S.wires.forEach(function(w){
        if((w.fromEl===nd.id&&String(w.fromPin)===String(pp.id))||(w.toEl===nd.id&&String(w.toPin)===String(pp.id)))wfp=w;
      });
      var toPin='—';
      if(wfp){
        var oe=null; S.elements.forEach(function(e){if(e.id===(wfp.fromEl===nd.id?wfp.toEl:wfp.fromEl))oe=e;});
        toPin=(oe?oe.label||'?':'?')+'.'+( wfp.fromEl===nd.id?wfp.toPin:wfp.fromPin);
      }
      var rowData=[pp.id,pp.n.substring(0,11),(wfp?wfp.signal||pp.sig:pp.sig).substring(0,8),pp.g.substring(0,6)];
      rowData.forEach(function(d,ci){
        p(tx(cxs[ci]+1,ry,String(d),(ci===0?7.5:7),(ci===0?'#336699':'#111'),'start',(ci===0?'bold':null)));
      });
      p('<circle cx="'+(cxs[4]+7)+'" cy="'+(ry-4)+'" r="4" fill="'+xc(pp.c)+'" stroke="rgba(0,0,0,0.5)" stroke-width="0.5"/>');
      p(tx(cxs[5]+1,ry,toPin.substring(0,10),6.5,'#336699','start','bold'));
      p(ln(px+1,ry+1.5,px+ptW-1,ry+1.5,'#e8e4dc',0.3));
    });

    if(col===pinCols-1 || idx===connNodes.length-1){
      curY=py+tH+6;
    }
  });
  return curY;
}

/* ── BOM ── */
function _drawBOM(p, x, y, w, maxH, items){
  var rh=9, hh=26;
  var H2=Math.min(maxH, hh+items.length*rh+4);
  p(rc(x,y,w,H2,'#f8f7f2','#999',0.7));
  p(rc(x,y,w,14,'#c4bfb0'));
  p(tx(x+w/2,y+10,'BILL OF MATERIALS',8,'#111','middle','bold','1'));
  var cols=[18,w*0.26,w*0.36,22,20];
  var cxs=[x+1]; cols.forEach(function(cw,i){if(i>0)cxs.push(cxs[i-1]+cols[i-1]);});
  p(rc(x,y+14,w,11,'#dedad0'));
  ['#','PART NUMBER','DESCRIPTION','QTY','UNIT'].forEach(function(h,i){
    p(tx(cxs[i]+1,y+22,h,6,'#333','start','bold'));
  });
  cxs.slice(1).forEach(function(cx2){ p(ln(cx2,y,cx2,y+H2,'#ccc',0.4)); });
  items.forEach(function(it,i){
    var ry=y+25+rh*(i+1); if(ry>y+H2-2)return;
    if(i%2===0) p(rc(x+1,ry-rh+1,w-2,rh,'#f2f0ea'));
    p(tx(cxs[0]+1,ry,String(i+1),6.5,'#336699','start','bold'));
    p(tx(cxs[1]+1,ry,String(it.pn||it.id||'—').substring(0,20),6,'#222'));
    p(tx(cxs[2]+1,ry,String(it.desc||it.name||'—').substring(0,28),6,'#222'));
    p(tx(cxs[3]+1,ry,String(it.qty||1),6,'#333','middle'));
    p(tx(cxs[4]+1,ry,String(it.unit||'EA'),6,'#555'));
    p(ln(x+1,ry+1,x+w-1,ry+1,'#e8e4d8',0.3));
  });
  p(rc(x+w-46,y+H2-14,43,11,'none','#27ae60',1.5));
  p(tx(x+w-24,y+H2-5,'RoHS ✓',7,'#27ae60','middle','bold'));
  return y+H2;
}

/* ── Notes ── */
function _drawNotes(p, x, y, w, h, notes){
  p(rc(x,y,w,h,'#f8f7f2','#999',0.7));
  p(rc(x,y,22,h,'#c4bfb0'));
  p(tx(x+11,y+h/2+4,'NOTES',8,'#333','middle','bold',null)+
    '<animateTransform attributeName="transform" type="rotate" from="-90 '+(x+11)+' '+(y+h/2)+'" to="-90 '+(x+11)+' '+(y+h/2)+'" dur="0s" fill="freeze"/>');
  // Manual rotate text
  p('<text x="'+(x+11)+'" y="'+(y+h/2+3)+'" text-anchor="middle" font-size="8" fill="#333" font-weight="bold" transform="rotate(-90 '+(x+11)+' '+(y+h/2)+')">NOTES</text>');
  notes.forEach(function(note,i){
    var ty=y+12+i*12; if(ty>y+h-4)return;
    p('<circle cx="'+(x+30)+'" cy="'+(ty-4)+'" r="5.5" fill="none" stroke="#333" stroke-width="1.1"/>');
    p(tx(x+30,ty-1,String(i+1),6.5,'#333','middle','bold'));
    p(tx(x+41,ty,note.length>95?note.substring(0,93)+'…':note,7,'#222'));
  });
}

/* ── Title block ── */
function _drawTitleBlock(p, PW, PH, ML, MR, MB, TB_Y, TB_H, sheetNum, totalSheets, today){
  var TBX=ML+5, TBW=PW-ML-MR-10;
  p(rc(TBX,TB_Y,TBW,TB_H,'#f0ede4','#333',0.8));
  // Vertical separator: right panel
  var RP_W=265, RP_X=TBX+TBW-RP_W;
  p(rc(RP_X,TB_Y,RP_W,TB_H,'#e8e4d8','#333',0.6));
  p(ln(RP_X,TB_Y,RP_X,TB_Y+TB_H,'#333',1));
  // Company header in right panel
  p(rc(RP_X,TB_Y,RP_W,18,'#d0ccc0'));
  p(tx(RP_X+RP_W/2,TB_Y+13,S.company||'COMPANY',12,'#1a1a1a','middle','bold','2'));
  // Right panel fields grid
  var RP2=RP_W/2;
  p(ln(RP_X+RP2,TB_Y+18,RP_X+RP2,TB_Y+TB_H,'#aaa',0.5));
  var rFields=[
    [RP_X+2,     TB_Y+24, 'DRAWN BY', S.drawnBy||'—', 8.5],
    [RP_X+2,     TB_Y+38, 'DATE',     today,           8.5],
    [RP_X+2,     TB_Y+52, 'APPROVED', '—',             8.5],
    [RP_X+RP2+2, TB_Y+24, 'DWG NO.',  S.dwgNo||'—',   8.5],
    [RP_X+RP2+2, TB_Y+36, 'P/N',      S.partNo||'—',  9  ],
    [RP_X+RP2+2, TB_Y+50, 'REV',      S.rev||'A',      14 ],
  ];
  rFields.forEach(function(f){
    p(tx(f[0],f[1]-8,f[2],5.5,'#888','start','bold','0.5'));
    p(tx(f[0],f[1],f[3],f[4],'#111','start','bold'));
  });
  // Sheet number
  p(tx(RP_X+RP_W-2,TB_Y+TB_H-4,'SHEET '+sheetNum+'/'+totalSheets,7,'#444','end','bold'));
  // Left panel: title + info
  p(tx(TBX+5,TB_Y+11,'TITLE',6,'#666','start','bold','0.5'));
  p(tx(TBX+5,TB_Y+24,S.title||'—',14,'#111','start','bold'));
  p(tx(TBX+5,TB_Y+37,S.company||'',8,'#555'));
  p(tx(TBX+5,TB_Y+48,'TOLERANCE: ±'+(S.lengthTol||20)+'mm UNLESS NOTED   ALL DIMENSIONS IN mm',7,'#666'));
  // RoHS
  p(rc(RP_X-52,TB_Y+TB_H-14,48,12,'none','#27ae60',1.5));
  p(tx(RP_X-28,TB_Y+TB_H-5,'RoHS ✓',7,'#27ae60','middle','bold'));
  // Scale indicator
  p(tx(TBX+5,TB_Y+TB_H-4,'SCALE: NTS   '+paper().label,6.5,'#888'));
}
