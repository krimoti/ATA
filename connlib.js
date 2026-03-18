/* ============================================================
   CONNLIB.JS — Custom Connector Editor
   MOTI HarnessPro
   ============================================================ */
'use strict';

// CUSTOM CONNECTOR EDITOR (CCE)
// ============================================================
var CCE = {
  selectedId: null,   // id of connector currently being edited
  editBuf: null       // in-memory working copy while editing
};

// Default pin colors cycle
var PIN_COLORS = ["#e74c3c","#3498db","#27ae60","#f39c12","#9b59b6","#1abc9c","#e67e22","#c0392b",
                  "#2980b9","#16a085","#8e44ad","#d35400","#27ae60","#2c3e50","#7f8c8d","#f1c40f"];

function renderConnectorEditor(){
  var panel=document.getElementById("panel-connectors");

  // Build list of all connectors (built-in + custom)
  var allBuiltin=[], allCustom=[];
  for(var id in CL){
    if(CL[id].builtin) allBuiltin.push(CL[id]);
    else allCustom.push(CL[id]);
  }

  var listHTML='';

  // Custom connectors first
  if(allCustom.length){
    listHTML+='<div class="cat-label" style="padding:0 4px;margin-bottom:6px;color:#5ab0f0;font-size:7px;letter-spacing:1px">CUSTOM ('+allCustom.length+')</div>';
    allCustom.forEach(function(c){
      var active=(CCE.selectedId===c.id);
      listHTML+='<div class="cce-list-item custom-item'+(active?' active':'')+'" onclick="cceSelect(\''+c.id+'\',false)">';
      listHTML+='<div><div class="cce-item-name">'+esc(c.short)+'</div><div class="cce-item-meta">'+esc(c.name)+' &bull; '+c.pins+'p &bull; '+esc(c.cat)+'</div></div>';
      listHTML+='<span class="cce-item-badge badge-custom">CUSTOM</span>';
      listHTML+='</div>';
    });
  }

  // Built-in (read-only preview)
  listHTML+='<div class="cat-label" style="padding:0 4px;margin:8px 0 6px;color:var(--text3);font-size:7px;letter-spacing:1px">BUILT-IN ('+allBuiltin.length+')</div>';
  allBuiltin.forEach(function(c){
    var active=(CCE.selectedId===c.id);
    listHTML+='<div class="cce-list-item builtin'+(active?' active':'')+'" onclick="cceSelect(\''+c.id+'\',true)">';
    listHTML+='<div><div class="cce-item-name">'+esc(c.short)+'</div><div class="cce-item-meta">'+esc(c.name)+' &bull; '+c.pins+'p &bull; '+esc(c.cat)+'</div></div>';
    listHTML+='<span class="cce-item-badge badge-builtin">BUILT-IN</span>';
    listHTML+='</div>';
  });

  // Right pane: editor or placeholder
  var editorHTML='';
  if(!CCE.selectedId){
    editorHTML='<div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;color:var(--text3);gap:12px">';
    editorHTML+='<div style="font-size:32px;opacity:0.2">&#9741;</div>';
    editorHTML+='<div style="font-size:9px;letter-spacing:2px">SELECT A CONNECTOR TO EDIT</div>';
    editorHTML+='<div style="font-size:8px;color:var(--text3)">or create a new one</div>';
    editorHTML+='</div>';
  } else {
    var isBuiltin=!!(CL[CCE.selectedId]&&CL[CCE.selectedId].builtin);
    if(isBuiltin){
      editorHTML=cceBuiltinPreview(CL[CCE.selectedId]);
    } else {
      editorHTML=cceEditorForm();
    }
  }

  panel.innerHTML='<div class="cce-layout" style="flex:1;height:100%">'
    +'<div class="cce-list-pane">'
    +'<div class="cce-list-header">'
    +'<span class="cce-list-title">LIBRARY</span>'
    +'<button class="btn btn-b" style="font-size:8px;padding:3px 8px" onclick="cceNew()">+ NEW</button>'
    +'</div>'
    +'<div class="cce-list-body">'+listHTML+'</div>'
    +'</div>'
    +'<div class="cce-editor-pane">'+editorHTML+'</div>'
    +'</div>';
}

function cceBuiltinPreview(lib){
  var h='<div class="cce-editor-header"><span class="cce-editor-title" style="color:var(--text2)">&#128274; '+esc(lib.name)+'</span>';
  h+='<button class="btn btn-b" style="font-size:8px;padding:3px 8px" onclick="cceDuplicate(\''+lib.id+'\')">DUPLICATE AS CUSTOM</button>';
  h+='</div>';
  h+='<div class="cce-editor-body">';
  h+='<div class="cce-readonly"><b>Built-in connector — read only.</b><br><br>';
  h+='Short: <b>'+esc(lib.short)+'</b> &nbsp; Type: <b>'+esc(lib.type)+'</b> &nbsp; Pins: <b>'+lib.pins+'</b> &nbsp; Cat: <b>'+esc(lib.cat)+'</b>';
  if(lib.pn) h+=' &nbsp; P/N: <b>'+esc(lib.pn)+'</b>';
  h+='<br><br>Click <b>DUPLICATE AS CUSTOM</b> to create an editable copy.</div>';
  // Pin table preview
  h+='<div style="margin-top:12px"><table class="pin-table"><thead><tr><th>#</th><th>PIN ID</th><th>NAME</th><th>SIGNAL</th><th>GAUGE</th><th>COLOR</th></tr></thead><tbody>';
  lib.pinout.forEach(function(p,i){
    h+='<tr><td style="text-align:center;color:var(--text3);font-size:8px">'+(i+1)+'</td>';
    h+='<td style="text-align:center;color:#5ab0f0;font-size:9px;font-weight:bold">'+esc(p.id)+'</td>';
    h+='<td style="font-size:9px">'+esc(p.n)+'</td>';
    h+='<td style="font-size:9px;color:var(--text2)">'+esc(p.sig)+'</td>';
    h+='<td style="font-size:9px;color:var(--text2)">'+esc(p.g)+'</td>';
    h+='<td><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:'+sc(p.c)+';border:1px solid #333;vertical-align:middle"></span></td></tr>';
  });
  h+='</tbody></table></div></div>';
  return h;
}

function cceEditorForm(){
  var buf=CCE.editBuf;
  if(!buf) return '';
  var isNew=!S.customConnectors.find(function(c){return c.id===buf.id;});

  var h='<div class="cce-editor-header">';
  h+='<span class="cce-editor-title">&#9741; '+(isNew?"NEW CONNECTOR":"EDIT: "+esc(buf.short))+'</span>';
  h+='<div style="display:flex;gap:6px">';
  if(!isNew) h+='<button class="btn btn-r" style="font-size:8px;padding:3px 8px" onclick="cceDelete(\''+buf.id+'\')">DELETE</button>';
  h+='<button class="btn" style="font-size:8px;padding:3px 8px" onclick="cceCancel()">CANCEL</button>';
  h+='<button class="btn btn-g" style="font-size:8px;padding:3px 8px" onclick="cceSave()">&#10003; SAVE</button>';
  h+='</div></div>';

  h+='<div class="cce-editor-body">';

  // Meta section
  h+='<div class="cce-section"><div class="cce-section-title">CONNECTOR INFO</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
  h+=cceField("NAME",   'cce-input hi',"cceSet('name',this.value)",esc(buf.name),"Full descriptive name");
  h+=cceField("SHORT",  'cce-input hi',"cceSet('short',this.value)",esc(buf.short),"Short code (e.g. DB9M)");
  h+=cceField("CAT",    'cce-input hi',"cceSet('cat',this.value)",esc(buf.cat),"Category");
  h+=cceField("P/N",    'cce-input hi',"cceSet('pn',this.value)",esc(buf.pn||""),"Part number (optional)");
  h+='</div>';
  // Type select
  h+='<div class="cce-row"><span class="cce-label">TYPE</span>';
  h+='<select class="cce-select" onchange="cceSet(\'type\',this.value)">';
  ["RECT","CIRC","DSUB","RJ","USB"].forEach(function(t){h+='<option'+(buf.type===t?" selected":"")+">"+t+"</option>";});
  h+='</select>';
  h+='<span style="font-size:8px;color:var(--text3);margin-left:8px">affects canvas icon style</span>';
  h+='</div>';
  h+='</div>';

  // Pin section
  h+='<div class="cce-section">';
  h+='<div class="cce-section-title" style="display:flex;justify-content:space-between;align-items:center">';
  h+='<span>PINS ('+buf.pinout.length+')</span>';
  h+='<div style="display:flex;gap:5px">';
  h+='<button class="btn btn-b" style="font-size:8px;padding:2px 8px" onclick="cceAddPin()">+ PIN</button>';
  h+='<button class="btn" style="font-size:8px;padding:2px 8px" onclick="cceAutoFill()">AUTO-FILL</button>';
  h+='</div></div>';

  h+='<table class="pin-table"><thead><tr>';
  h+='<th style="width:26px">#</th><th>PIN ID</th><th>NAME</th><th>SIGNAL</th><th>GAUGE</th><th>COLOR</th><th style="width:26px"></th>';
  h+='</tr></thead><tbody id="cce-pin-tbody">';
  buf.pinout.forEach(function(p,i){
    h+=ccePinRow(p,i);
  });
  h+='</tbody></table>';
  h+='</div>'; // end pins section

  // Live preview
  h+='<div class="cce-section"><div class="cce-section-title">PREVIEW</div>';
  h+='<div class="cce-preview">';
  h+=cceSVGPreview(buf);
  h+='</div></div>';

  h+='</div>'; // end body
  return h;
}

function cceField(label,cls,handler,val,ph){
  return '<div class="cce-row"><span class="cce-label">'+label+'</span><input class="'+cls+'" value="'+val+'" placeholder="'+esc(ph||"")+'" oninput="'+handler+'"/></div>';
}

function ccePinRow(p,i){
  var gauges=["12AWG","14AWG","16AWG","18AWG","20AWG","22AWG","24AWG","26AWG","28AWG","30AWG"];
  var sigs=["PWR","GND","DATA","SIG","RS232","ETH","USB","CAN","ANLG","AUD","HDMI","CLK","I2C","SPI","UART","NC"];
  var safeC=(p.c&&p.c[0]==="#")?p.c:(PIN_COLORS[i%PIN_COLORS.length]);
  var h='<tr id="cce-pin-'+i+'">';
  h+='<td><span class="pin-num">'+(i+1)+'</span></td>';
  // PIN ID
  h+='<td><input class="pi" style="width:52px" value="'+esc(p.id)+'" title="Pin ID" oninput="ccePinSet('+i+',\'id\',this.value)"/></td>';
  // NAME
  h+='<td><input class="pi" style="width:80px" value="'+esc(p.n)+'" title="Pin name" oninput="ccePinSet('+i+',\'n\',this.value)"/></td>';
  // SIGNAL
  h+='<td><select class="pi" style="width:72px" onchange="ccePinSet('+i+',\'sig\',this.value)">';
  sigs.forEach(function(s){h+='<option'+(p.sig===s?" selected":"")+">"+s+"</option>";});
  h+='</select></td>';
  // GAUGE
  h+='<td><select class="pi" style="width:68px" onchange="ccePinSet('+i+',\'g\',this.value)">';
  gauges.forEach(function(g){h+='<option'+(p.g===g?" selected":"")+">"+g+"</option>";});
  h+='</select></td>';
  // COLOR
  h+='<td><input type="color" class="pin-color-swatch" value="'+safeC+'" title="Pin color" onchange="ccePinSet('+i+',\'c\',this.value)"/></td>';
  // DELETE
  h+='<td><button class="del" title="Remove pin" onclick="cceRemovePin('+i+')">&#215;</button></td>';
  h+='</tr>';
  return h;
}

function cceSVGPreview(lib){
  // Render a small canvas-style SVG preview of the connector face
  var sz=120, pins=lib.pinout, po=pins, t=lib.type||"RECT";
  var cx=sz/2,cy=sz/2,R=sz*0.38;
  var s='<svg viewBox="0 0 '+sz+' '+sz+'" width="'+sz+'" height="'+sz+'" style="flex-shrink:0">';
  if(t==="CIRC"){
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+(R+6)+'" fill="#555" stroke="#5ab0f0" stroke-width="1.5"/>';
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+R+'" fill="#1a1a1a" stroke="#444" stroke-width="1"/>';
    for(var i=0;i<po.length;i++){
      var angle=(i/po.length)*Math.PI*2-Math.PI/2;
      var px=cx+R*0.72*Math.cos(angle),py=cy+R*0.72*Math.sin(angle);
      s+='<circle cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="'+(sz*0.055)+'" fill="'+sc(po[i].c)+'" stroke="#222" stroke-width="0.5"/>';
    }
  } else if(t==="DSUB"){
    var rows=po.length<=9?[5,4]:po.length<=15?[8,7]:[Math.ceil(po.length/2),Math.floor(po.length/2)];
    var pw=sz*0.85,ph=sz*0.5,x0=(sz-pw)/2,y0=(sz-ph)/2+8;
    s+='<rect x="'+x0+'" y="'+y0+'" width="'+pw+'" height="'+ph+'" rx="8" fill="#2a2a2a" stroke="#5ab0f0" stroke-width="1"/>';
    var idx=0;
    for(var ri=0;ri<rows.length&&idx<po.length;ri++){
      var cnt=Math.min(rows[ri],po.length-idx);
      var rowY=y0+ph*0.28+ri*(ph*0.44),rowW=(cnt-1)*((pw-10)/(rows[0]));
      for(var pi=0;pi<cnt;pi++,idx++){
        var ppx=cx-rowW/2+pi*(rowW/(cnt-1||1));
        s+='<circle cx="'+ppx.toFixed(1)+'" cy="'+rowY.toFixed(1)+'" r="5" fill="'+sc(po[idx].c)+'" stroke="#111" stroke-width="0.5"/>';
      }
    }
  } else {
    // RECT / USB / RJ generic grid
    var cols=Math.ceil(Math.sqrt(po.length)),rows2=Math.ceil(po.length/cols);
    var pw=sz*0.8,ph=sz*0.7,x0=(sz-pw)/2,y0=(sz-ph)/2;
    s+='<rect x="'+x0+'" y="'+y0+'" width="'+pw+'" height="'+ph+'" rx="6" fill="#0a1e2e" stroke="#5ab0f0" stroke-width="1"/>';
    for(var i=0;i<po.length;i++){
      var ppx=x0+(i%cols+0.5)*(pw/cols), ppy=y0+(Math.floor(i/cols)+0.5)*(ph/rows2);
      var r=Math.min(pw/cols,ph/rows2)*0.28;
      s+='<circle cx="'+ppx.toFixed(1)+'" cy="'+ppy.toFixed(1)+'" r="'+r.toFixed(1)+'" fill="'+sc(po[i].c)+'" stroke="#111" stroke-width="0.5"/>';
    }
  }
  // Labels
  s+='<text x="'+cx+'" y="'+(sz-4)+'" text-anchor="middle" font-size="8" font-family="monospace" fill="#5ab0f0">'+esc(lib.short)+'</text>';
  s+='</svg>';

  // Also render a text legend
  var legend='<div style="margin-left:12px;overflow-y:auto;max-height:120px">';
  po.forEach(function(p){
    legend+='<div style="display:flex;align-items:center;gap:5px;font-size:8px;margin-bottom:2px">';
    legend+='<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+sc(p.c)+';border:1px solid #333;flex-shrink:0"></span>';
    legend+='<span style="color:#5ab0f0;min-width:22px">'+esc(p.id)+'</span>';
    legend+='<span style="color:var(--text2)">'+esc(p.n)+'</span>';
    legend+='<span style="color:var(--text3);margin-left:4px">'+esc(p.sig)+'</span>';
    legend+='</div>';
  });
  legend+='</div>';

  return '<div style="display:flex;align-items:flex-start">'+s+legend+'</div>';
}

// -- CCE Actions --

function cceNew(){
  var newId="CX"+Date.now().toString(36).toUpperCase();
  CCE.selectedId=newId;
  CCE.editBuf={
    id:newId, name:"Custom Connector", short:"CX1", type:"RECT",
    cat:"Custom", pn:"", pins:4, builtin:false,
    pinout:[
      {id:1,n:"VCC",sig:"PWR",g:"22AWG",c:"#e74c3c"},
      {id:2,n:"GND",sig:"GND",g:"22AWG",c:"#555555"},
      {id:3,n:"SIG1",sig:"DATA",g:"24AWG",c:"#3498db"},
      {id:4,n:"SIG2",sig:"DATA",g:"24AWG",c:"#27ae60"}
    ]
  };
  renderConnectorEditor();
}

function cceSelect(id,isBuiltin){
  CCE.selectedId=id;
  if(!isBuiltin){
    // Deep clone for editing
    var found=S.customConnectors.find(function(c){return c.id===id;});
    if(found) CCE.editBuf=JSON.parse(JSON.stringify(found));
  } else {
    CCE.editBuf=null;
  }
  renderConnectorEditor();
}

function cceSet(key,val){
  if(!CCE.editBuf) return;
  CCE.editBuf[key]=val;
  if(key==="short"||key==="type") cceRefreshPreview();
}

function ccePinSet(idx,key,val){
  if(!CCE.editBuf||!CCE.editBuf.pinout[idx]) return;
  CCE.editBuf.pinout[idx][key]=val;
  cceRefreshPreview();
}

function cceRefreshPreview(){
  // Update pin count
  if(CCE.editBuf) CCE.editBuf.pins=CCE.editBuf.pinout.length;
  // Refresh just the preview div if it exists
  var prev=document.querySelector('.cce-preview');
  if(prev) prev.innerHTML=cceSVGPreview(CCE.editBuf);
}

function cceAddPin(){
  if(!CCE.editBuf) return;
  var i=CCE.editBuf.pinout.length;
  CCE.editBuf.pinout.push({
    id:i+1, n:"P"+(i+1), sig:"SIG", g:"22AWG",
    c:PIN_COLORS[i%PIN_COLORS.length]
  });
  CCE.editBuf.pins=CCE.editBuf.pinout.length;
  // Append row instead of full re-render for performance
  var tbody=document.getElementById("cce-pin-tbody");
  if(tbody){
    var tr=document.createElement("tr");
    tr.id="cce-pin-"+i;
    tr.innerHTML=ccePinRow(CCE.editBuf.pinout[i],i).replace(/^<tr[^>]*>/,"").replace(/<\/tr>$/,"");
    tbody.appendChild(tr);
  }
  cceRefreshPreview();
}

function cceRemovePin(idx){
  if(!CCE.editBuf||CCE.editBuf.pinout.length<=1){toast("Connector must have at least 1 pin",true);return;}
  CCE.editBuf.pinout.splice(idx,1);
  CCE.editBuf.pins=CCE.editBuf.pinout.length;
  // Re-number remaining pinout IDs if they are numeric
  CCE.editBuf.pinout.forEach(function(p,i){if(!isNaN(p.id)) p.id=i+1;});
  renderConnectorEditor();
}

function cceAutoFill(){
  if(!CCE.editBuf) return;
  var n=parseInt(prompt("How many pins?",CCE.editBuf.pinout.length)||"0",10);
  if(!n||n<1||n>200){toast("Enter 1–200 pins",true);return;}
  var po=[];
  for(var i=0;i<n;i++) po.push({id:i+1,n:"P"+(i+1),sig:"SIG",g:"22AWG",c:PIN_COLORS[i%PIN_COLORS.length]});
  CCE.editBuf.pinout=po;
  CCE.editBuf.pins=n;
  renderConnectorEditor();
}

function cceSave(){
  if(!CCE.editBuf) return;
  var b=CCE.editBuf;
  // Validate
  if(!b.name.trim()){toast("Name is required",true);return;}
  if(!b.short.trim()){toast("Short code is required",true);return;}
  if(!b.pinout.length){toast("At least one pin required",true);return;}
  // Check short uniqueness (among custom only — builtins can't be overridden)
  var dup=S.customConnectors.find(function(c){return c.id!==b.id && c.short.toLowerCase()===b.short.toLowerCase();});
  if(dup){toast("Short code '"+b.short+"' already used by another custom connector",true);return;}

  b.pins=b.pinout.length;
  b.builtin=false;

  var existing=S.customConnectors.findIndex(function(c){return c.id===b.id;});
  if(existing>=0) S.customConnectors[existing]=JSON.parse(JSON.stringify(b));
  else S.customConnectors.push(JSON.parse(JSON.stringify(b)));

  syncCustomConnectors();
  CCE.selectedId=b.id;
  CCE.editBuf=JSON.parse(JSON.stringify(b));

  saveState();
  buildSidebar();
  renderConnectorEditor();
  toast("Connector '"+b.short+"' saved!");
}

function cceCancel(){
  // If it was a new unsaved connector, deselect
  var found=S.customConnectors.find(function(c){return c.id===CCE.selectedId;});
  if(!found){ CCE.selectedId=null; CCE.editBuf=null; }
  else {
    CCE.editBuf=JSON.parse(JSON.stringify(found));
  }
  renderConnectorEditor();
}

function cceDelete(id){
  if(!confirm("Delete custom connector? Any canvas instances will be removed.")) return;
  S.customConnectors=S.customConnectors.filter(function(c){return c.id!==id;});
  // Remove canvas elements using this connector
  S.elements=S.elements.filter(function(e){return e.connId!==id;});
  S.wires=S.wires.filter(function(w){
    var rem=S.elements.find(function(e){return e.id===w.fromEl||e.id===w.toEl;});
    return !!rem;
  });
  delete CL[id];
  CCE.selectedId=null; CCE.editBuf=null;
  saveState(); buildSidebar(); renderCanvas();
  renderConnectorEditor();
  toast("Connector deleted");
}

function cceDuplicate(builtinId){
  var src=CL[builtinId]; if(!src) return;
  var newId="CX"+Date.now().toString(36).toUpperCase();
  CCE.selectedId=newId;
  CCE.editBuf=JSON.parse(JSON.stringify(src));
  CCE.editBuf.id=newId;
  CCE.editBuf.builtin=false;
  CCE.editBuf.short=src.short+"_C";
  CCE.editBuf.name=src.name+" (Custom)";
  CCE.editBuf.cat="Custom";
  renderConnectorEditor();
  toast("Duplicated '"+src.short+"' — edit and save");
}

// ============================================================
// DRAWING PANEL (printable)
// ============================================================
function connFaceSVG(lib,sz){
  if(!lib)return"";
  var cx=sz/2,cy=sz/2,R=sz*0.38,pins=lib.pins,po=lib.pinout,t=lib.type,s="";
  s='<svg viewBox="0 0 '+sz+' '+sz+'" width="'+sz+'" height="'+sz+'">';
  if(t==="DSUB"){
    var rows=pins<=9?[5,4]:pins<=15?[8,7]:[13,12];
    var pw=sz*0.85,ph=sz*0.55,x0=(sz-pw)/2,y0=(sz-ph)/2;
    var pw2=Math.min(10,pw/(rows[0]+1)),ph2=pw2*1.6;
    s+='<rect x="'+x0+'" y="'+y0+'" width="'+pw+'" height="'+ph+'" rx="'+(sz*0.07)+'" fill="#3a3a3a" stroke="#666" stroke-width="1"/>';
    var idx=0;
    for(var ri=0;ri<rows.length;ri++){
      var cnt=rows[ri],rowY=y0+ph*0.28+ri*(ph*0.44),rowW=(cnt-1)*(pw2+3);
      for(var pi=0;pi<cnt&&idx<po.length;pi++,idx++){
        var px=cx-rowW/2+pi*(pw2+3);
        s+='<rect x="'+(px-pw2/2)+'" y="'+(rowY-ph2/2)+'" width="'+pw2+'" height="'+ph2+'" rx="1" fill="'+sc(po[idx].c)+'" stroke="#222" stroke-width="0.5"/>';
      }
    }
  } else if(t==="CIRC"){
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+(R+6)+'" fill="#555" stroke="#888" stroke-width="1.5"/>';
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+R+'" fill="#2a2a2a" stroke="#444" stroke-width="1"/>';
    for(var i=0;i<po.length;i++){
      var angle=(i/pins)*Math.PI*2-Math.PI/2;
      var px2=cx+R*0.72*Math.cos(angle),py2=cy+R*0.72*Math.sin(angle);
      s+='<circle cx="'+px2+'" cy="'+py2+'" r="'+(sz*0.055)+'" fill="'+sc(po[i].c)+'" stroke="#222" stroke-width="0.5"/>';
    }
  } else if(t==="RJ"){
    var pw=sz*0.65,ph=sz*0.5,x0=(sz-pw)/2,y0=(sz-ph)/2;
    s+='<rect x="'+x0+'" y="'+y0+'" width="'+pw+'" height="'+ph+'" rx="3" fill="#c8c8c8" stroke="#888" stroke-width="1"/>';
    for(var i=0;i<po.length;i++){var px=(x0+(i+0.5)/pins*pw);s+='<rect x="'+(px-4)+'" y="'+(y0+ph*0.3)+'" width="7" height="'+(ph*0.6)+'" rx="1" fill="'+sc(po[i].c)+'" stroke="#222" stroke-width="0.5"/>';}
  } else {
    var cols=Math.ceil(Math.sqrt(pins)),rows2=Math.ceil(pins/cols),pw=sz*0.75,ph=sz*0.65,x0=(sz-pw)/2,y0=(sz-ph)/2;
    s+='<rect x="'+x0+'" y="'+y0+'" width="'+pw+'" height="'+ph+'" rx="4" fill="#2a2a2a" stroke="#666" stroke-width="1"/>';
    for(var i=0;i<po.length;i++){var px=x0+(i%cols+0.5)*(pw/cols),py=y0+(Math.floor(i/cols)+0.5)*(ph/rows2),r3=Math.min(pw/cols,ph/rows2)*0.32;s+='<circle cx="'+px+'" cy="'+py+'" r="'+r3+'" fill="'+sc(po[i].c)+'" stroke="#222" stroke-width="0.5"/>';}
  }
  s+='</svg>'; return s;
}

function wireTableHTML(lib,side,wires){
  if(!lib)return"";
  var other=side==="L"?"P2":"P1";
  var h='<table><thead><tr><th class="dwg-th">PIN</th><th class="dwg-th">NAME</th><th class="dwg-th">SIG</th><th class="dwg-th">AWG</th><th class="dwg-th">COLOR</th><th class="dwg-th">'+esc(other)+'</th></tr></thead><tbody>';
  for(var i=0;i<lib.pinout.length;i++){
    var p=lib.pinout[i];
    var w2=null;
    for(var j=0;j<wires.length;j++){
      var w3=wires[j];
      var myEl=null;
      for(var k=0;k<S.elements.length;k++){
        if(S.elements[k].id===w3.fromEl&&side==="L"){myEl=S.elements[k];}
        if(S.elements[k].id===w3.toEl&&side==="R"){myEl=S.elements[k];}
      }
      if(myEl&&String(side==="L"?w3.fromPin:w3.toPin)===String(p.id)){w2=w3;break;}
    }
    var ow=w2?(side==="L"?w2.toPin:w2.fromPin):"--";
    h+='<tr style="background:'+(i%2?"#f5f2eb":"#faf8f4")+'">';
    h+='<td class="dwg-td" style="font-weight:bold;color:#336699;text-align:center">'+esc(p.id)+'</td>';
    h+='<td class="dwg-td">'+esc(p.n)+'</td>';
    h+='<td class="dwg-td">'+esc(w2?w2.signal||p.sig:p.sig)+'</td>';
    h+='<td class="dwg-td" style="text-align:center;color:#555">'+esc(p.g)+'</td>';
    h+='<td class="dwg-td" style="text-align:center"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:'+sc(p.c)+';border:1px solid #333"></span></td>';
    h+='<td class="dwg-td" style="text-align:center;font-weight:bold;color:#336699">'+esc(ow)+'</td></tr>';
  }
  return h+'</tbody></table>';
}

function xcrossSVG(wires){
  var active=wires.filter(function(w){return w.fromEl&&w.toEl;});
  if(!active.length) return '<p style="color:#888;font-size:9px">No wires defined</p>';
  var rowH=22,W=380,pad=12,H=active.length*rowH+pad*2+20;
  var c1=55,c2=130,c3=250,c4=325,mid=190;
  var s='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">';
  s+='<rect x="0" y="0" width="'+W+'" height="18" fill="#c8c4b4"/>';
  ["P1 PIN","WIRE","P2 PIN","SIGNAL"].forEach(function(t,i){var x=[c1,mid,c4,W-6][i],ta=i===3?"end":"middle";s+='<text x="'+x+'" y="12" text-anchor="'+ta+'" font-size="7.5" font-family="monospace" font-weight="bold" fill="#333">'+t+'</text>';});
  for(var i=0;i<active.length;i++){
    var w=active[i],y=18+pad+i*rowH,cy=y+rowH/2-3,col=sc(w.color);
    s+='<rect x="0" y="'+y+'" width="'+W+'" height="'+rowH+'" fill="'+(i%2?"#f5f3ee":"#faf8f5")+'"/>';
    s+='<circle cx="'+c1+'" cy="'+cy+'" r="9" fill="#dce8f4" stroke="#336699" stroke-width="1"/>';
    s+='<text x="'+c1+'" y="'+(cy+3.5)+'" text-anchor="middle" font-size="7.5" font-family="monospace" font-weight="bold" fill="#224466">'+esc(w.fromPin)+'</text>';
    s+='<line x1="'+(c1+9)+'" y1="'+cy+'" x2="'+c2+'" y2="'+cy+'" stroke="'+col+'" stroke-width="2.5"/>';
    s+='<line x1="'+c2+'" y1="'+(cy-6)+'" x2="'+c3+'" y2="'+(cy+6)+'" stroke="'+col+'" stroke-width="2"/>';
    s+='<line x1="'+c2+'" y1="'+(cy+6)+'" x2="'+c3+'" y2="'+(cy-6)+'" stroke="'+col+'" stroke-width="2"/>';
    s+='<line x1="'+c3+'" y1="'+cy+'" x2="'+(c4-9)+'" y2="'+cy+'" stroke="'+col+'" stroke-width="2.5"/>';
    s+='<rect x="'+(mid-18)+'" y="'+(cy-7)+'" width="36" height="13" fill="#f8f5ee" stroke="#ccc" stroke-width="0.5"/>';
    s+='<text x="'+mid+'" y="'+(cy+3)+'" text-anchor="middle" font-size="6.5" font-family="monospace" fill="#666">'+esc(w.gauge)+'</text>';
    s+='<circle cx="'+c4+'" cy="'+cy+'" r="9" fill="#dce8f4" stroke="#336699" stroke-width="1"/>';
    s+='<text x="'+c4+'" y="'+(cy+3.5)+'" text-anchor="middle" font-size="7.5" font-family="monospace" font-weight="bold" fill="#224466">'+esc(w.toPin)+'</text>';
    s+='<text x="'+(W-6)+'" y="'+(cy+3.5)+'" text-anchor="end" font-size="6.5" font-family="monospace" fill="#555">'+esc(w.signal)+'</text>';
  }
  return s+'</svg>';
}

function renderDrawing(){
  var connEls=S.elements.filter(function(e){return e.kind==="connector";});
  var B="1px solid #c8c4b4";
  var today=new Date().toLocaleDateString();
  var h='<div id="dwg-sheet">';
  h+='<div style="display:grid;grid-template-columns:1fr 130px 130px 55px;border-bottom:'+B+'">';
  h+='<div style="border-right:'+B+';padding:4px 8px"><div style="font-size:6px;color:#777;border-bottom:'+B+';margin-bottom:1px">TITLE</div><div style="font-size:16px;font-weight:bold">'+esc(S.title)+'</div></div>';
  h+='<div style="border-right:'+B+';padding:4px 6px"><div style="font-size:6px;color:#777;border-bottom:'+B+'">CUSTOMER</div><div style="font-size:9px;padding-top:2px">'+esc(S.company||"--")+'</div></div>';
  h+='<div style="border-right:'+B+';padding:4px 6px"><div style="font-size:6px;color:#777;border-bottom:'+B+'">PART NUMBER</div><div style="font-size:11px;font-weight:bold;padding-top:2px">'+esc(S.partNo||"--")+'</div></div>';
  h+='<div style="padding:4px 5px"><div style="font-size:6px;color:#777;border-bottom:'+B+'">REV.</div><div style="font-size:16px;font-weight:bold;padding-top:2px">'+esc(S.rev||"A")+'</div></div>';
  h+='</div>';
  h+='<div style="border-bottom:'+B+';padding:8px 10px;text-align:center;color:#888;font-size:9px">';
  h+='[ Cable schematic -- see Canvas tab for interactive drawing ]</div>';
  if(connEls.length){
    h+='<div style="border-bottom:'+B+';display:grid;grid-template-columns:repeat('+Math.min(connEls.length,3)+',1fr)">';
    for(var i=0;i<Math.min(connEls.length,6);i++){
      var el=connEls[i]; var lib=CL[el.connId];
      h+='<div style="'+(i%3!==2?"border-right:"+B+";":"")+';padding:6px 8px">';
      h+='<div style="font-size:8px;font-weight:bold;color:#336699;margin-bottom:4px">'+esc(el.label)+' - '+esc(lib?lib.short:"")+'</div>';
      if(lib){
        h+='<div style="display:flex;gap:8px;align-items:flex-start">';
        h+='<div style="flex-shrink:0">'+connFaceSVG(lib,70)+'<div style="font-size:6px;color:#666;text-align:center;margin-top:2px">'+esc(lib.name)+'</div></div>';
        h+='<div style="flex:1;overflow-x:auto">'+wireTableHTML(lib,i===0?"L":"R",S.wires)+'</div>';
        h+='</div>';
      }
      h+='</div>';
    }
    h+='</div>';
  }
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:'+B+'">';
  h+='<div style="border-right:'+B+';padding:6px 10px"><div style="font-size:8px;font-weight:bold;color:#336699;margin-bottom:4px">WIRE DIAGRAM</div>'+xcrossSVG(S.wires)+'</div>';
  h+='<div style="padding:6px 10px"><div style="font-size:8px;font-weight:bold;color:#555;margin-bottom:4px">VARIANT / ACCESSORIES</div>';
  h+='<table><thead><tr><th class="dwg-th">QTY</th><th class="dwg-th">TYPE</th><th class="dwg-th">DESCRIPTION</th></tr></thead><tbody>';
  var accEls=S.elements.filter(function(e){return e.kind==="accessory";});
  accEls.forEach(function(el,i){
    var acc=null; for(var j=0;j<ACCESSORIES.length;j++){if(ACCESSORIES[j].id===el.accId){acc=ACCESSORIES[j];break;}}
    h+='<tr style="background:'+(i%2?"#f5f2eb":"#faf8f4")+'"><td class="dwg-td" style="text-align:center">1</td><td class="dwg-td">'+esc(acc?acc.type:"")+'</td><td class="dwg-td">'+esc(el.label)+'</td></tr>';
  });
  h+='</tbody></table></div></div>';
  h+='<div style="display:grid;grid-template-columns:1fr 190px">';
  h+='<div style="border-right:'+B+';padding:5px 8px"><div style="font-size:7px;font-weight:bold;color:#777;margin-bottom:3px;letter-spacing:1px">NOTES:</div>';
  h+='<ol style="padding-left:14px;font-size:7px;line-height:1.9;color:#333">';
  S.notes.forEach(function(n){h+='<li>'+esc(n)+'</li>';});
  h+='</ol></div>';
  h+='<div style="padding:5px 8px;font-size:8px"><table style="width:100%;margin-bottom:6px">';
  [["DWG NO.",S.dwgNo||"--"],["DATE",today],["DRAWN",S.drawnBy||"***"],["SCALE","1:1"],["SHEET","1 OF 1"]].forEach(function(r){
    h+='<tr><td style="font-weight:bold;color:#555;padding:1px 4px;font-size:7px;border-bottom:'+B+';white-space:nowrap">'+r[0]+'</td><td style="padding:1px 4px;font-size:7px;border-bottom:'+B+'">'+esc(r[1])+'</td></tr>';
  });
  h+='</table><div style="border:2px solid #27ae60;padding:3px 5px;font-size:7px;color:#27ae60;font-weight:bold;display:inline-block">RoHS<br>COMPLIANT</div></div></div>';
  h+='</div>';
  document.getElementById("panel-drawing").innerHTML='<div style="overflow:auto;flex:1;padding:8px">'+h+'</div>';
}
