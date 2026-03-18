/* ============================================================
   PANELS.JS — Routes, BOM, Cut List, Drawing Panel
   MOTI HarnessPro
   ============================================================ */
'use strict';


// ============================================================
// ROUTES PANEL
// ============================================================
function renderRoutes(){
  var connEls=S.elements.filter(function(e){return e.kind==="connector";});
  var gauges=["12AWG","14AWG","16AWG","18AWG","20AWG","22AWG","24AWG","26AWG","28AWG","30AWG"];
  var h='<div style="padding:14px;flex:1;overflow:auto">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  h+='<span style="font-size:11px;color:var(--accent);letter-spacing:2px">WIRE ROUTES ('+S.wires.length+' total)</span>';
  h+='<div style="display:flex;gap:6px"><button class="btn btn-g" onclick="addWireRow()">+ ADD WIRE</button><button class="btn" onclick="clearWires()">CLEAR</button></div></div>';
  h+='<div style="overflow-x:auto"><table class="rt"><thead><tr>';
  h+='<th>ON</th><th>FROM</th><th>F.PIN</th><th>TO</th><th>T.PIN</th><th>SIGNAL</th><th>GAUGE</th><th>COLOR</th><th>DEL</th></tr></thead><tbody>';
  for(var i=0;i<S.wires.length;i++){
    var w=S.wires[i],wid=w.id;
    var fiS="background:var(--bg1);border:1px solid var(--border);color:var(--accent);padding:2px 3px;font-size:9px";
    h+='<tr>';
    h+='<td style="text-align:center"><input type="checkbox"'+(w.active?" checked":"")+" onchange=\"wUpd('"+wid+"','active',this.checked)\"/></td>";
    h+="<td><select style='"+fiS+";width:70px' onchange=\"wUpd('"+wid+"','fromEl',this.value)\">";
    h+='<option value="">--</option>';
    connEls.forEach(function(el){h+='<option value="'+el.id+'"'+(w.fromEl===el.id?" selected":"")+">"+esc(el.label)+"</option>";});
    h+='</select></td>';
    var fLib=w.fromEl?getElLib(w.fromEl):null;
    h+="<td><select style='"+fiS+";width:70px' onchange=\"wUpd('"+wid+"','fromPin',this.value)\">";
    h+='<option value="">--</option>';
    if(fLib){fLib.pinout.forEach(function(p){h+='<option value="'+p.id+'"'+(String(w.fromPin)===String(p.id)?" selected":"")+">"+p.id+" "+p.n+"</option>";});}
    h+='</select></td>';
    h+="<td><select style='"+fiS+";width:70px' onchange=\"wUpd('"+wid+"','toEl',this.value)\">";
    h+='<option value="">--</option>';
    connEls.forEach(function(el){h+='<option value="'+el.id+'"'+(w.toEl===el.id?" selected":"")+">"+esc(el.label)+"</option>";});
    h+='</select></td>';
    var tLib=w.toEl?getElLib(w.toEl):null;
    h+="<td><select style='"+fiS+";width:70px' onchange=\"wUpd('"+wid+"','toPin',this.value)\">";
    h+='<option value="">--</option>';
    if(tLib){tLib.pinout.forEach(function(p){h+='<option value="'+p.id+'"'+(String(w.toPin)===String(p.id)?" selected":"")+">"+p.id+" "+p.n+"</option>";});}
    h+='</select></td>';
    h+='<td><input value="'+esc(w.signal||"")+'" style="'+fiS+';width:65px" oninput="wUpd(\''+wid+'\',\'signal\',this.value)"/></td>';
    h+="<td><select style='"+fiS+"' onchange=\"wUpd('"+wid+"','gauge',this.value)\">";
    gauges.forEach(function(g){h+='<option'+(w.gauge===g?" selected":"")+">"+g+"</option>";});
    h+='</select></td>';
    var safeC=(w.color&&w.color[0]==="#")?w.color:"#888888";
    h+='<td style="text-align:center"><input type="color" value="'+safeC+'" style="width:28px;height:20px;border:none;padding:0;cursor:pointer" oninput="wUpd(\''+wid+'\',\'color\',this.value)"/></td>';
    h+='<td style="text-align:center"><button class="del" onclick="delWire(\''+wid+'\')">&#215;</button></td>';
    h+='</tr>';
  }
  h+='</tbody></table></div></div>';
  document.getElementById("panel-routes").innerHTML=h;
}

function getElLib(elId){for(var i=0;i<S.elements.length;i++){if(S.elements[i].id===elId&&S.elements[i].kind==="connector"){return CL[S.elements[i].connId];}}return null;}
function wUpd(id,k,v){for(var i=0;i<S.wires.length;i++){if(S.wires[i].id===id){S.wires[i][k]=v;break;}}saveState();renderCanvas();}
function addWireRow(){S.wires.push({id:uid(),fromEl:"",fromPin:"",toEl:"",toPin:"",signal:"",gauge:"22AWG",color:"#888888",active:true});renderAll();}
function clearWires(){if(confirm("Clear all wires?")){S.wires=[];renderAll();}}
function delWire(id){S.wires=S.wires.filter(function(w){return w.id!==id;});renderAll();}

// ============================================================
// BOM + CUTLIST
// ============================================================
function renderBOM(){
  var h='<div style="padding:14px;flex:1;overflow:auto">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  h+='<span style="font-size:11px;color:var(--accent);letter-spacing:2px">BILL OF MATERIALS</span>';
  h+='<button class="btn btn-g" onclick="addBOM()">+ ADD</button></div>';
  h+='<table class="rt"><thead><tr><th>#</th><th>QTY</th><th>UNIT</th><th>PART NO.</th><th>DESCRIPTION</th><th>CAT</th><th>DEL</th></tr></thead><tbody>';
  for(var i=0;i<S.bomItems.length;i++){
    var it=S.bomItems[i],bid=it.id;
    var fi="background:var(--bg1);border:1px solid var(--border);color:var(--accent);padding:2px 3px;font-size:9px";
    h+='<tr><td style="text-align:center;font-weight:bold;color:var(--accent)">'+(i+1)+'</td>';
    h+='<td><input type="number" min="1" value="'+esc(it.qty||1)+'" style="'+fi+';width:45px" oninput="bUpd(\''+bid+'\',\'qty\',this.value)"/></td>';
    h+="<td><select style='"+fi+"' onchange=\"bUpd('"+bid+"','unit',this.value)\">";
    ["EA","M","FT","SET","LOT"].forEach(function(u){h+='<option'+(it.unit===u?" selected":"")+">"+u+"</option>";});
    h+='</select></td>';
    h+='<td><input value="'+esc(it.pn||"")+'" style="'+fi+';width:90px" oninput="bUpd(\''+bid+'\',\'pn\',this.value)"/></td>';
    h+='<td><input value="'+esc(it.desc||"")+'" style="'+fi+';width:180px" placeholder="Description" oninput="bUpd(\''+bid+'\',\'desc\',this.value)"/></td>';
    h+="<td><select style='"+fi+"' onchange=\"bUpd('"+bid+"','cat',this.value)\">";
    ["MATERIAL","HARDWARE","PURCHASED","REFERENCE"].forEach(function(c){h+='<option'+(it.cat===c?" selected":"")+">"+c+"</option>";});
    h+='</select></td>';
    h+='<td style="text-align:center"><button class="del" onclick="delBOM(\''+bid+'\')">&#215;</button></td></tr>';
  }
  h+='</tbody></table></div>';
  document.getElementById("panel-bom").innerHTML=h;
}
function bUpd(id,k,v){for(var i=0;i<S.bomItems.length;i++){if(S.bomItems[i].id===id){S.bomItems[i][k]=v;break;}}saveState();}
function addBOM(){S.bomItems.push({id:uid(),qty:1,unit:"EA",pn:"",desc:"",cat:"MATERIAL"});renderAll();}
function delBOM(id){S.bomItems=S.bomItems.filter(function(b){return b.id!==id;});renderAll();}

function renderCutList(){
  var active=S.wires.filter(function(w){return w.active&&w.fromEl&&w.toEl;});
  var h='<div style="padding:14px;flex:1;overflow:auto">';
  h+='<div style="font-size:11px;color:var(--accent);letter-spacing:2px;margin-bottom:12px">CUT LIST</div>';
  h+='<table class="rt" style="max-width:660px"><thead><tr>';
  h+='<th>#</th><th>FROM</th><th>TO</th><th>SIGNAL</th><th>GAUGE</th><th>COLOR</th><th>LENGTH</th></tr></thead><tbody>';
  active.forEach(function(w,i){
    var fEl=null,tEl=null;
    S.elements.forEach(function(e){if(e.id===w.fromEl)fEl=e;if(e.id===w.toEl)tEl=e;});
    h+='<tr><td style="text-align:center;color:var(--text2)">'+(i+1)+'</td>';
    h+='<td style="font-weight:bold;color:#5ab0f0">'+esc((fEl?fEl.label:"?")+"."+w.fromPin)+'</td>';
    h+='<td style="font-weight:bold;color:#5ab0f0">'+esc((tEl?tEl.label:"?")+"."+w.toPin)+'</td>';
    h+='<td>'+esc(w.signal||"--")+'</td><td style="text-align:center">'+esc(w.gauge)+'</td>';
    h+='<td style="text-align:center"><span style="display:inline-flex;align-items:center;gap:4px"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:'+sc(w.color||"#888")+';border:1px solid #333"></span>'+esc(w.color)+'</span></td>';
    h+='<td style="text-align:center">'+S.cableLength+' +/-'+S.lengthTol+'mm</td></tr>';
  });
  h+='<tr><td colspan="7" style="padding:8px 4px;color:var(--text2);font-size:9px;border-top:1px solid var(--border2)">Total: '+active.length+' wires | Length: '+S.cableLength+'mm +/-'+S.lengthTol+'mm</td></tr>';
  h+='</tbody></table></div>';
  document.getElementById("panel-cutlist").innerHTML=h;
}

// ============================================================
// MAIN RENDER + TABS
// ============================================================