/* ============================================================
   CANVAS.JS
   MOTI HarnessPro
   ============================================================ */
'use strict';

// CANVAS ENGINE
// ============================================================
var CV, CTX;
var drag={active:false,type:"",id:"",ox:0,oy:0,ex:0,ey:0};
var selected=null;
var tool="select";
var wireStart=null;

function worldToScreen(wx,wy){return{x:wx*S.zoom+S.panX, y:wy*S.zoom+S.panY};}
function screenToWorld(sx,sy){return{x:(sx-S.panX)/S.zoom, y:(sy-S.panY)/S.zoom};}

function initCanvas(){
  CV=document.getElementById("main-canvas");
  CTX=CV.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize",resizeCanvas);
  CV.addEventListener("mousedown",onMouseDown);
  CV.addEventListener("mousemove",onMouseMove);
  CV.addEventListener("mouseup",onMouseUp);
  CV.addEventListener("wheel",onWheel,{passive:false});
  CV.addEventListener("dblclick",onDblClick);
  CV.addEventListener("contextmenu",function(e){e.preventDefault();onRightClick(e);});
}

function resizeCanvas(){
  var wrap=document.getElementById("canvas-wrap");
  CV.width=wrap.clientWidth;
  CV.height=wrap.clientHeight;
  renderCanvas();
}

// ============================================================
// DRAW
// ============================================================
function renderCanvas(){
  if(!CV)return;
  CTX.clearRect(0,0,CV.width,CV.height);
  CTX.fillStyle="#0d0d0d"; CTX.fillRect(0,0,CV.width,CV.height);
  drawGrid();
  CTX.save();
  for(var i=0;i<S.dimensions.length;i++) drawDimension(S.dimensions[i]);
  for(var i=0;i<S.wires.length;i++) drawWire(S.wires[i]);
  if(wireStart){
    if(tool==="autoroute"){
      drawAutoRoutePreview({x:wireStart.wx,y:wireStart.wy},{x:drag.ex,y:drag.ey});
    } else {
      var ps=worldToScreen(wireStart.wx,wireStart.wy);
      CTX.strokeStyle="#d4b870"; CTX.lineWidth=1.5;
      CTX.setLineDash([4,3]);
      CTX.beginPath(); CTX.moveTo(ps.x,ps.y); CTX.lineTo(drag.ex,drag.ey); CTX.stroke();
      CTX.setLineDash([]);
    }
  }
  for(var i=0;i<S.elements.length;i++) drawElement(S.elements[i]);
  CTX.restore();
}

function drawGrid(){
  var step=20*S.zoom, ox=S.panX%step, oy=S.panY%step;
  CTX.strokeStyle="rgba(255,255,255,0.04)"; CTX.lineWidth=0.5;
  for(var x=ox;x<CV.width;x+=step){CTX.beginPath();CTX.moveTo(x,0);CTX.lineTo(x,CV.height);CTX.stroke();}
  for(var y=oy;y<CV.height;y+=step){CTX.beginPath();CTX.moveTo(0,y);CTX.lineTo(CV.width,y);CTX.stroke();}
}

function drawElement(el){
  var s=worldToScreen(el.x,el.y);
  var z=S.zoom;
  var isSel=(selected&&selected.id===el.id);
  if(el.kind==="connector") drawConnector(el,s.x,s.y,z,isSel);
  else if(el.kind==="accessory") drawAccessory(el,s.x,s.y,z,isSel);
}

function getConnSize(el){
  var lib=CL[el.connId]; if(!lib) return{w:80,h:60};
  var pins=lib.pins;
  var w=90*S.zoom, h=Math.max(60,(pins*14+30))*S.zoom;
  return{w:w,h:h};
}

function drawConnector(el,sx,sy,z,isSel){
  var lib=CL[el.connId]; if(!lib) return;
  var pins=lib.pins;
  var bw=90*z, bh=Math.max(60,(pins*14+30))*z;
  var rowH=(bh-22*z)/pins;
  var isCustom=!lib.builtin;

  if(isSel){CTX.shadowColor=isCustom?"#5ab0f0":"#d4b870";CTX.shadowBlur=8;}

  CTX.fillStyle="#1e1e1e"; CTX.strokeStyle=isSel?(isCustom?"#5ab0f0":"#d4b870"):(isCustom?"#1a3050":"#555");
  CTX.lineWidth=isSel?1.5:1;
  roundRect(CTX,sx,sy,bw,bh,4*z); CTX.fill(); CTX.stroke();
  CTX.shadowBlur=0;

  CTX.fillStyle=isCustom?"#0a1a2a":"#2a2a2a";
  roundRect(CTX,sx,sy,bw,20*z,4*z); CTX.fill();
  CTX.strokeStyle=isCustom?"#1a3050":"#555"; CTX.lineWidth=0.5;
  CTX.beginPath(); CTX.moveTo(sx,sy+20*z); CTX.lineTo(sx+bw,sy+20*z); CTX.stroke();

  CTX.fillStyle=isCustom?"#5ab0f0":"#d4b870"; CTX.font="bold "+(8*z)+"px 'Courier New'";
  CTX.textAlign="center";
  CTX.fillText((el.label||"P?")+" - "+lib.short, sx+bw/2, sy+13*z);

  var faceLeft=(el.side!=="right");
  for(var i=0;i<lib.pinout.length;i++){
    var p=lib.pinout[i];
    var py=sy+22*z+i*rowH;
    CTX.fillStyle=i%2?"#1a1a1a":"#161616";
    CTX.fillRect(sx+1,py,bw-2,rowH-0.5);
    var dotX=faceLeft?sx:sx+bw;
    var dotY=py+rowH/2;
    CTX.beginPath(); CTX.arc(dotX,dotY,4*z,0,Math.PI*2);
    CTX.fillStyle=sc(p.c); CTX.fill();
    CTX.strokeStyle="#111"; CTX.lineWidth=0.5; CTX.stroke();
    CTX.fillStyle="#bbb"; CTX.font=(6.5*z)+"px 'Courier New'";
    CTX.textAlign=faceLeft?"left":"right";
    var tx=faceLeft?sx+8*z:sx+bw-8*z;
    CTX.fillText(p.id+" "+p.n, tx, py+rowH/2+2.5*z);
  }

  CTX.fillStyle="#666"; CTX.font=(7*z)+"px 'Courier New'";
  CTX.textAlign="center";
  CTX.fillText(lib.name, sx+bw/2, sy+bh+12*z);
}

function drawAccessory(el,sx,sy,z,isSel){
  var acc=null;
  for(var i=0;i<ACCESSORIES.length;i++){if(ACCESSORIES[i].id===el.accId){acc=ACCESSORIES[i];break;}}
  if(!acc) return;
  var w=50*z, h=28*z;
  CTX.fillStyle=acc.color||"#333";
  CTX.strokeStyle=isSel?"#d4b870":"#666";
  CTX.lineWidth=isSel?1.5:0.8;
  if(acc.type==="heatshrink"||acc.type==="sleeve"){
    CTX.beginPath();
    CTX.ellipse(sx,sy+h/2,6*z,h/2,0,Math.PI/2,Math.PI*3/2); CTX.stroke();
    CTX.fillRect(sx,sy,w,h); CTX.strokeRect(sx,sy,w,h);
    CTX.strokeStyle=isSel?"#d4b870":"#888";
    CTX.beginPath();
    CTX.ellipse(sx+w,sy+h/2,6*z,h/2,0,Math.PI/2*3,Math.PI/2); CTX.stroke();
  } else {
    roundRect(CTX,sx,sy,w,h,3*z); CTX.fill(); CTX.stroke();
  }
  CTX.fillStyle=acc.type==="heatshrink"?"#ccc":"#d4b870";
  CTX.font="bold "+(7*z)+"px 'Courier New'"; CTX.textAlign="center";
  CTX.fillText(acc.symbol, sx+w/2, sy+h/2+2.5*z);
  CTX.fillStyle="#888"; CTX.font=(6*z)+"px 'Courier New'";
  CTX.fillText(el.label||acc.name.split(" ").slice(0,2).join(" "), sx+w/2, sy+h+11*z);
}

// ============================================================
// AUTO-ROUTING ENGINE
// ============================================================

// Returns bounding box for an element in world coords (with margin)
function getElBounds(el, margin){
  margin=margin||0;
  var bw=90, bh=30;
  if(el.kind==="connector"){
    var lib=CL[el.connId]; if(lib) bh=Math.max(60,(lib.pins*14+30));
  } else {bw=50;bh=28;}
  return{x:el.x-margin,y:el.y-margin,w:bw+margin*2,h:bh+margin*2};
}

// Check if segment (x1,y1)-(x2,y2) intersects rect {x,y,w,h}
function segIntersectsRect(x1,y1,x2,y2,r){
  // Separating-axis: reject if segment is fully outside any axis
  var minX=Math.min(x1,x2),maxX=Math.max(x1,x2);
  var minY=Math.min(y1,y2),maxY=Math.max(y1,y2);
  if(maxX<r.x||minX>r.x+r.w||maxY<r.y||minY>r.y+r.h) return false;
  return true;
}

// Build an orthogonal route (world coords) from p1→p2
// avoids connector bodies (skip fromEl and toEl)
function buildOrthoRoute(p1,p2,fromElId,toElId){
  var GAP=18; // clearance around connectors
  var obstacles=[];
  S.elements.forEach(function(el){
    if(el.id===fromElId||el.id===toElId) return;
    if(el.kind==="connector") obstacles.push(getElBounds(el,GAP));
  });

  // Determine exit direction from p1 (pins face left/right)
  var fromEl=null,toEl=null;
  S.elements.forEach(function(e){if(e.id===fromElId)fromEl=e;if(e.id===toElId)toEl=e;});
  var exitRight= fromEl?(fromEl.side==="right"):false;
  var enterRight= toEl?(toEl.side!=="right"):true; // enter from pin side

  var exitX= exitRight? p1.x+GAP : p1.x-GAP;
  var enterX= enterRight? p2.x+GAP : p2.x-GAP;

  // 3-segment L-route: exit → mid column → enter
  var midX=(exitX+enterX)/2;
  var pts=[p1,{x:exitX,y:p1.y},{x:midX,y:p1.y},{x:midX,y:p2.y},{x:enterX,y:p2.y},p2];

  // Check if any obstacle blocks the mid-column segment
  var blocked=false;
  for(var i=0;i<obstacles.length;i++){
    var o=obstacles[i];
    if(segIntersectsRect(midX,p1.y,midX,p2.y,o)){blocked=true;break;}
  }
  if(blocked){
    // Route above all connectors
    var topY=p1.y, btmY=p2.y;
    S.elements.forEach(function(el){
      var b=getElBounds(el,GAP+10);
      if(midX>=b.x&&midX<=b.x+b.w) topY=Math.min(topY,b.y-GAP);
    });
    pts=[p1,{x:exitX,y:p1.y},{x:exitX,y:topY},{x:enterX,y:topY},{x:enterX,y:p2.y},p2];
  }
  return pts;
}

// Draw a multi-segment polyline with rounded corners
function drawPolylineRounded(pts, radius){
  if(!pts||pts.length<2) return;
  radius=radius||8;
  CTX.beginPath();
  CTX.moveTo(pts[0].x, pts[0].y);
  for(var i=1;i<pts.length-1;i++){
    var prev=pts[i-1], cur=pts[i], next=pts[i+1];
    var dx1=cur.x-prev.x, dy1=cur.y-prev.y;
    var dx2=next.x-cur.x, dy2=next.y-cur.y;
    var len1=Math.sqrt(dx1*dx1+dy1*dy1);
    var len2=Math.sqrt(dx2*dx2+dy2*dy2);
    if(len1<0.1||len2<0.1){CTX.lineTo(cur.x,cur.y);continue;}
    var r=Math.min(radius,len1/2,len2/2);
    var ux1=dx1/len1, uy1=dy1/len1;
    var ux2=dx2/len2, uy2=dy2/len2;
    CTX.lineTo(cur.x-ux1*r, cur.y-uy1*r);
    CTX.quadraticCurveTo(cur.x,cur.y, cur.x+ux2*r, cur.y+uy2*r);
  }
  CTX.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
  CTX.stroke();
}

function drawWire(w){
  var p1=null,p2=null;
  for(var i=0;i<S.elements.length;i++){
    var el=S.elements[i];
    if(el.id===w.fromEl){var pp=getPinPos(el,w.fromPin);if(pp)p1=pp;}
    if(el.id===w.toEl){var pp=getPinPos(el,w.toPin);if(pp)p2=pp;}
  }
  if(!p1&&w.x1!==undefined) p1={x:w.x1,y:w.y1};
  if(!p2&&w.x2!==undefined) p2={x:w.x2,y:w.y2};
  if(!p1||!p2) return;

  var style=w.routeStyle||getRouteStyle();
  var col=sc(w.color||"#888");
  CTX.strokeStyle=col; CTX.lineWidth=(1.5*S.zoom); CTX.setLineDash([]);

  if(style==="direct"){
    // Simple bezier (original)
    var s1=worldToScreen(p1.x,p1.y), s2=worldToScreen(p2.x,p2.y);
    var mx=(s1.x+s2.x)/2;
    CTX.beginPath(); CTX.moveTo(s1.x,s1.y);
    CTX.bezierCurveTo(mx,s1.y,mx,s2.y,s2.x,s2.y); CTX.stroke();
    drawWireLabel(w,s1,s2);
  } else if(style==="curve"){
    // Smooth curve through ortho waypoints
    var pts=w.routePts||(w.fromEl&&w.toEl?buildOrthoRoute(p1,p2,w.fromEl,w.toEl):null);
    if(!pts){
      var s1=worldToScreen(p1.x,p1.y), s2=worldToScreen(p2.x,p2.y);
      var mx=(s1.x+s2.x)/2;
      CTX.beginPath(); CTX.moveTo(s1.x,s1.y);
      CTX.bezierCurveTo(mx,s1.y,mx,s2.y,s2.x,s2.y); CTX.stroke();
      drawWireLabel(w,s1,s2); return;
    }
    var spts=pts.map(function(p){return worldToScreen(p.x,p.y);});
    drawPolylineRounded(spts, 12*S.zoom);
    drawWireLabel(w,spts[0],spts[spts.length-1]);
  } else {
    // ORTHO (default) — sharp corners
    var pts=w.routePts||(w.fromEl&&w.toEl?buildOrthoRoute(p1,p2,w.fromEl,w.toEl):null);
    if(!pts){
      var s1=worldToScreen(p1.x,p1.y), s2=worldToScreen(p2.x,p2.y);
      var mx=(s1.x+s2.x)/2;
      CTX.beginPath(); CTX.moveTo(s1.x,s1.y);
      CTX.bezierCurveTo(mx,s1.y,mx,s2.y,s2.x,s2.y); CTX.stroke();
      drawWireLabel(w,s1,s2); return;
    }
    var spts=pts.map(function(p){return worldToScreen(p.x,p.y);});
    drawPolylineRounded(spts, 5*S.zoom);
    drawWireLabel(w,spts[0],spts[spts.length-1]);
  }
}

function getRouteStyle(){
  var sel=document.getElementById("route-style");
  return sel?sel.value:"ortho";
}

function drawWireLabel(w,s1,s2){
  if(!w.signal&&!w.gauge) return;
  var lx=(s1.x+s2.x)/2, ly=(s1.y+s2.y)/2-6*S.zoom;
  var txt=(w.signal||"")+(w.gauge?" "+w.gauge:"");
  CTX.fillStyle="rgba(0,0,0,0.65)";
  var tw=CTX.measureText(txt).width+6;
  CTX.fillRect(lx-tw/2,ly-8*S.zoom,tw,10*S.zoom);
  CTX.fillStyle="#bbb"; CTX.font=(6*S.zoom)+"px 'Courier New'"; CTX.textAlign="center";
  CTX.fillText(txt,lx,ly);
}

// Draw preview line for wire-in-progress (auto-route mode)
function drawAutoRoutePreview(p1world, screenEnd){
  var style=getRouteStyle();
  CTX.strokeStyle="#5ab0f0"; CTX.lineWidth=1.5; CTX.setLineDash([4,3]);
  if(style==="direct"){
    var ps=worldToScreen(p1world.x,p1world.y);
    CTX.beginPath(); CTX.moveTo(ps.x,ps.y); CTX.lineTo(screenEnd.x,screenEnd.y); CTX.stroke();
  } else {
    var p2world=screenToWorld(screenEnd.x,screenEnd.y);
    var pts=buildOrthoRoute(p1world,p2world,wireStart.el?wireStart.el.id:null,null);
    var spts=pts.map(function(p){return worldToScreen(p.x,p.y);});
    drawPolylineRounded(spts, style==="curve"?12*S.zoom:5*S.zoom);
  }
  CTX.setLineDash([]);
}

// ── AUTO-ROUTE ALL ──
// Connects every pin of el1 to matching pin (by name/signal/index) of el2
function autoRouteAll(){
  var connEls=S.elements.filter(function(e){return e.kind==="connector";});
  if(connEls.length<2){toast("Need at least 2 connectors on canvas");return;}

  var style=getRouteStyle();

  // If exactly 2, use them; otherwise pick first two
  var el1=connEls[0], el2=connEls[1];
  var lib1=CL[el1.connId], lib2=CL[el2.connId];
  if(!lib1||!lib2){toast("Connector library missing");return;}

  var added=0, skipped=0;

  // Build lookup: existing wire endpoints to avoid duplicates
  var wiredPins={};
  S.wires.forEach(function(w){
    if(w.fromEl) wiredPins[w.fromEl+"_"+w.fromPin]=true;
    if(w.toEl)   wiredPins[w.toEl+"_"+w.toPin]=true;
  });

  var n=Math.min(lib1.pinout.length, lib2.pinout.length);
  for(var i=0;i<n;i++){
    var pin1=lib1.pinout[i], pin2=lib2.pinout[i];
    var k1=el1.id+"_"+pin1.id, k2=el2.id+"_"+pin2.id;
    if(wiredPins[k1]||wiredPins[k2]){skipped++;continue;}

    var p1=getPinPos(el1,pin1.id), p2=getPinPos(el2,pin2.id);
    if(!p1||!p2){skipped++;continue;}

    var pts=buildOrthoRoute(p1,p2,el1.id,el2.id);
    var wire={
      id:uid(),
      fromEl:el1.id, fromPin:pin1.id,
      toEl:el2.id,   toPin:pin2.id,
      color:sc(pin1.c)||"#888888",
      gauge:pin1.g||"22AWG",
      signal:pin1.sig||"",
      active:true,
      routeStyle:style,
      routePts:pts
    };
    S.wires.push(wire);
    wiredPins[k1]=true; wiredPins[k2]=true;
    added++;
  }

  saveState(); renderAll();
  toast("Auto-routed "+added+" wire"+(added!==1?"s":"")+(skipped?" ("+skipped+" skipped)":""));
}

function drawDimension(d){
  if(!d.x1&&d.x1!==0) return;
  var s1=worldToScreen(d.x1,d.y1), s2=worldToScreen(d.x2,d.y2);
  var off=20*S.zoom;
  var oy=s1.y-off;
  CTX.strokeStyle="#5ab0f0"; CTX.fillStyle="#5ab0f0"; CTX.lineWidth=0.8*S.zoom;
  CTX.beginPath(); CTX.moveTo(s1.x,oy); CTX.lineTo(s2.x,oy); CTX.stroke();
  arrow(CTX,s2.x,oy,s1.x,oy,5*S.zoom);
  arrow(CTX,s1.x,oy,s2.x,oy,5*S.zoom);
  CTX.setLineDash([3,3]);
  CTX.beginPath(); CTX.moveTo(s1.x,s1.y); CTX.lineTo(s1.x,oy); CTX.stroke();
  CTX.beginPath(); CTX.moveTo(s2.x,s2.y); CTX.lineTo(s2.x,oy); CTX.stroke();
  CTX.setLineDash([]);
  var len=Math.round(Math.abs(d.x2-d.x1));
  var tol=d.tol||0;
  var txt=len+"mm"+(tol?" +/-"+tol:"");
  CTX.font="bold "+(9*S.zoom)+"px 'Courier New'"; CTX.textAlign="center";
  var mx=(s1.x+s2.x)/2;
  CTX.fillStyle="rgba(0,0,0,0.7)";
  var tw=CTX.measureText(txt).width+8;
  CTX.fillRect(mx-tw/2,oy-10*S.zoom,tw,11*S.zoom);
  CTX.fillStyle="#5ab0f0";
  CTX.fillText(txt,mx,oy-1*S.zoom);
  if(d.balloon){
    var bx=(s1.x+s2.x)/2, by=oy-20*S.zoom;
    CTX.beginPath(); CTX.arc(bx,by,10*S.zoom,0,Math.PI*2);
    CTX.fillStyle="rgba(0,60,120,0.7)"; CTX.fill();
    CTX.strokeStyle="#5ab0f0"; CTX.lineWidth=0.8; CTX.stroke();
    CTX.fillStyle="#5ab0f0"; CTX.font="bold "+(7*S.zoom)+"px 'Courier New'";
    CTX.textAlign="center"; CTX.fillText(d.balloon,bx,by+2.5*S.zoom);
  }
}

function getPinPos(el,pinId){
  var lib=CL[el.connId]; if(!lib) return null;
  var bh=Math.max(60,(lib.pins*14+30));
  var rowH=(bh-22)/lib.pins;
  var bw=90;
  var faceLeft=(el.side!=="right");
  for(var i=0;i<lib.pinout.length;i++){
    if(String(lib.pinout[i].id)===String(pinId)){
      var py=el.y+22+i*rowH+rowH/2;
      var px=faceLeft?el.x:el.x+bw;
      return{x:px,y:py};
    }
  }
  return null;
}

function arrow(ctx,fromX,fromY,toX,toY,size){
  var angle=Math.atan2(toY-fromY,toX-fromX);
  ctx.beginPath();
  ctx.moveTo(fromX,fromY);
  ctx.lineTo(fromX+size*Math.cos(angle-Math.PI*0.8),fromY+size*Math.sin(angle-Math.PI*0.8));
  ctx.moveTo(fromX,fromY);
  ctx.lineTo(fromX+size*Math.cos(angle+Math.PI*0.8),fromY+size*Math.sin(angle+Math.PI*0.8));
  ctx.stroke();
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

// ============================================================
// MOUSE EVENTS
// ============================================================
function getElAt(wx,wy){
  for(var i=S.elements.length-1;i>=0;i--){
    var el=S.elements[i];
    var bw,bh;
    if(el.kind==="connector"){
      var lib=CL[el.connId]; if(!lib) continue;
      bw=90; bh=Math.max(60,(lib.pins*14+30));
    } else {bw=50;bh=28;}
    if(wx>=el.x&&wx<=el.x+bw&&wy>=el.y&&wy<=el.y+bh) return el;
  }
  return null;
}

function getPinAt(wx,wy){
  for(var i=0;i<S.elements.length;i++){
    var el=S.elements[i]; if(el.kind!=="connector") continue;
    var lib=CL[el.connId]; if(!lib) continue;
    var bh=Math.max(60,(lib.pins*14+30));
    var rowH=(bh-22)/lib.pins;
    var bw=90; var faceLeft=(el.side!=="right");
    for(var j=0;j<lib.pinout.length;j++){
      var py=el.y+22+j*rowH+rowH/2;
      var px=faceLeft?el.x:el.x+bw;
      var dx=wx-px,dy=wy-py;
      if(dx*dx+dy*dy<(8/S.zoom)*(8/S.zoom)){
        return{el:el,pin:lib.pinout[j],wx:px,wy:py};
      }
    }
  }
  return null;
}

var panning=false,panSX=0,panSY=0,panPX=0,panPY=0;

function onMouseDown(e){
  var rect=CV.getBoundingClientRect();
  var sx=e.clientX-rect.left, sy=e.clientY-rect.top;
  var w=screenToWorld(sx,sy);
  if(e.button===1||(e.button===0&&tool==="pan")||(e.button===0&&e.altKey)){
    panning=true; panSX=sx; panSY=sy; panPX=S.panX; panPY=S.panY;
    CV.style.cursor="grabbing"; return;
  }
  if(tool==="wire"||tool==="autoroute"){
    var pin=getPinAt(w.x,w.y);
    if(!wireStart){
      if(pin){wireStart={el:pin.el,pin:pin.pin,wx:pin.wx,wy:pin.wy};}
      else{wireStart={wx:w.x,wy:w.y};}
      // Highlight chosen pin
      if(pin) updateRouteHint("Click destination pin to complete wire");
    } else {
      var isAuto=(tool==="autoroute");
      var style=getRouteStyle();
      var wire={id:uid(),color:"#888888",gauge:"22AWG",signal:"",active:true,routeStyle:isAuto?style:"direct"};
      if(wireStart.el){wire.fromEl=wireStart.el.id;wire.fromPin=wireStart.pin?wireStart.pin.id:null;
        // inherit pin color/gauge/signal
        if(wireStart.pin){wire.color=sc(wireStart.pin.c)||"#888888";wire.gauge=wireStart.pin.g||"22AWG";wire.signal=wireStart.pin.sig||"";}
      } else{wire.x1=wireStart.wx;wire.y1=wireStart.wy;}
      if(pin){wire.toEl=pin.el.id;wire.toPin=pin.pin.id;}
      else{wire.x2=w.x;wire.y2=w.y;}
      // Compute route for auto-route tool
      if(isAuto&&wire.fromEl&&wire.toEl){
        var p1=getPinPos({id:wire.fromEl,connId:getElConnId(wire.fromEl),x:0,y:0,side:"left"},wire.fromPin);
        // actually get from element
        var fe=null,te=null;
        S.elements.forEach(function(e){if(e.id===wire.fromEl)fe=e;if(e.id===wire.toEl)te=e;});
        if(fe&&te){
          var pp1=getPinPos(fe,wire.fromPin), pp2=getPinPos(te,wire.toPin);
          if(pp1&&pp2) wire.routePts=buildOrthoRoute(pp1,pp2,wire.fromEl,wire.toEl);
        }
      }
      S.wires.push(wire); wireStart=null;
      updateRouteHint(null);
      saveState(); renderCanvas(); showProps(wire,"wire"); return;
    }
    drag.ex=sx; drag.ey=sy; renderCanvas(); return;
  }
  if(tool==="dimension"){
    if(!wireStart){wireStart={wx:w.x,wy:w.y};}
    else{
      var dim={id:uid(),x1:wireStart.wx,y1:wireStart.wy,x2:w.x,y2:w.y,tol:20};
      S.dimensions.push(dim); wireStart=null;
      saveState(); renderCanvas(); showProps(dim,"dimension"); return;
    }
    drag.ex=sx; drag.ey=sy; renderCanvas(); return;
  }
  var el=getElAt(w.x,w.y);
  if(el){
    selected=el;
    drag.active=true; drag.id=el.id; drag.ox=w.x-el.x; drag.oy=w.y-el.y;
    showProps(el, el.kind);
  } else {
    selected=null; clearProps();
  }
  renderCanvas();
}

function onMouseMove(e){
  var rect=CV.getBoundingClientRect();
  var sx=e.clientX-rect.left, sy=e.clientY-rect.top;
  var w=screenToWorld(sx,sy);
  if(panning){S.panX=panPX+(sx-panSX); S.panY=panPY+(sy-panSY); renderCanvas(); return;}
  drag.ex=sx; drag.ey=sy;
  if(drag.active){
    for(var i=0;i<S.elements.length;i++){
      if(S.elements[i].id===drag.id){S.elements[i].x=w.x-drag.ox; S.elements[i].y=w.y-drag.oy; break;}
    }
    // Recompute routePts for wires attached to moved element
    recomputeWireRoutes(drag.id);
    saveState(); renderCanvas();
  }
  if(wireStart) renderCanvas();
}

function onMouseUp(e){
  panning=false; drag.active=false; CV.style.cursor="default";
}

function onWheel(e){
  e.preventDefault();
  var rect=CV.getBoundingClientRect();
  var sx=e.clientX-rect.left, sy=e.clientY-rect.top;
  var factor=e.deltaY<0?1.1:0.9;
  var newZoom=clamp(S.zoom*factor,0.2,5);
  S.panX=sx-(sx-S.panX)*(newZoom/S.zoom);
  S.panY=sy-(sy-S.panY)*(newZoom/S.zoom);
  S.zoom=newZoom; renderCanvas();
}

function onDblClick(e){
  var rect=CV.getBoundingClientRect();
  var sx=e.clientX-rect.left,sy=e.clientY-rect.top;
  var w=screenToWorld(sx,sy);
  var el=getElAt(w.x,w.y);
  if(el) showProps(el,el.kind);
}

function onRightClick(e){
  var rect=CV.getBoundingClientRect();
  var sx=e.clientX-rect.left,sy=e.clientY-rect.top;
  var w=screenToWorld(sx,sy);
  var el=getElAt(w.x,w.y);
  if(el){
    if(confirm("Delete "+el.label+"?")){
      S.elements=S.elements.filter(function(x){return x.id!==el.id;});
      S.wires=S.wires.filter(function(w2){return w2.fromEl!==el.id&&w2.toEl!==el.id;});
      selected=null; clearProps(); saveState(); renderCanvas();
    }
  }
}

// ============================================================
// PROPERTIES PANEL
// ============================================================
function showProps(obj,type){
  var p=document.getElementById("props");
  var h="<div style='font-size:9px;color:var(--accent);letter-spacing:2px;margin-bottom:6px'>PROPERTIES</div>";
  if(type==="connector"||type==="accessory"){
    h+="<div class='prop-row'><span class='prop-label'>LABEL</span><input class='fi' style='flex:1' value='"+esc(obj.label||"")+"' oninput=\"setProp('"+obj.id+"','label',this.value)\"/></div>";
    if(type==="connector"){
      h+="<div class='prop-row'><span class='prop-label'>SIDE</span><select class='fi' style='flex:1' onchange=\"setProp('"+obj.id+"','side',this.value)\">";
      h+="<option value='left'"+(obj.side!=="right"?" selected":"")+">Left (pins right)</option>";
      h+="<option value='right'"+(obj.side==="right"?" selected":"")+">Right (pins left)</option>";
      h+="</select></div>";
    }
    h+="<div class='prop-row'><span class='prop-label'>NOTES</span><input class='fi' style='flex:1' value='"+esc(obj.notes||"")+"' oninput=\"setProp('"+obj.id+"','notes',this.value)\"/></div>";
    h+="<div class='prop-row'><button class='btn' style='font-size:8px;padding:2px 6px' onclick=\"deleteEl('"+obj.id+"')\">DELETE</button></div>";
  } else if(type==="wire"){
    h+="<div class='prop-row'><span class='prop-label'>SIGNAL</span><input class='fi' style='flex:1' value='"+esc(obj.signal||"")+"' oninput=\"setWire('"+obj.id+"','signal',this.value)\"/></div>";
    h+="<div class='prop-row'><span class='prop-label'>GAUGE</span><select class='fi' style='flex:1' onchange=\"setWire('"+obj.id+"','gauge',this.value)\">";
    ["12AWG","14AWG","16AWG","18AWG","20AWG","22AWG","24AWG","26AWG","28AWG","30AWG"].forEach(function(g){h+="<option"+(obj.gauge===g?" selected":"")+">"+g+"</option>";});
    h+="</select></div>";
    h+="<div class='prop-row'><span class='prop-label'>COLOR</span><input type='color' value='"+(obj.color&&obj.color[0]==="#"?obj.color:"#888888")+"' style='width:40px;height:20px;border:none;cursor:pointer;background:none' oninput=\"setWire('"+obj.id+"','color',this.value)\"/></div>";
    h+="<div class='prop-row'><button class='btn' style='font-size:8px;padding:2px 6px' onclick=\"deleteWire('"+obj.id+"')\">DELETE</button></div>";
  } else if(type==="dimension"){
    h+="<div class='prop-row'><span class='prop-label'>TOL +/-</span><input type='number' class='fi' style='width:60px' value='"+(obj.tol||0)+"' oninput=\"setDim('"+obj.id+"','tol',+this.value)\"/></div>";
    h+="<div class='prop-row'><span class='prop-label'>BALLOON</span><input class='fi' style='flex:1' value='"+esc(obj.balloon||"")+"' placeholder='A,B...' oninput=\"setDim('"+obj.id+"','balloon',this.value)\"/></div>";
    h+="<div class='prop-row'><button class='btn' style='font-size:8px;padding:2px 6px' onclick=\"deleteDim('"+obj.id+"')\">DELETE</button></div>";
  }
  p.innerHTML=h;
}
function clearProps(){document.getElementById("props").innerHTML="<div style='font-size:9px;color:var(--text3);padding:4px'>Select an element</div>";}
function setProp(id,k,v){for(var i=0;i<S.elements.length;i++){if(S.elements[i].id===id){S.elements[i][k]=v;break;}}saveState();renderCanvas();}
function setWire(id,k,v){for(var i=0;i<S.wires.length;i++){if(S.wires[i].id===id){S.wires[i][k]=v;break;}}saveState();renderCanvas();}
function setDim(id,k,v){for(var i=0;i<S.dimensions.length;i++){if(S.dimensions[i].id===id){S.dimensions[i][k]=v;break;}}saveState();renderCanvas();}
function deleteEl(id){S.elements=S.elements.filter(function(e){return e.id!==id;});S.wires=S.wires.filter(function(w){return w.fromEl!==id&&w.toEl!==id;});selected=null;clearProps();saveState();renderCanvas();}
function deleteWire(id){S.wires=S.wires.filter(function(w){return w.id!==id;});clearProps();saveState();renderCanvas();}
function deleteDim(id){S.dimensions=S.dimensions.filter(function(d){return d.id!==id;});clearProps();saveState();renderCanvas();}

// ============================================================
// SIDEBAR
// ============================================================
function buildSidebar(){
  // Built-in connectors by category
  var cats={};
  for(var id in CL){
    if(!CL[id].builtin) continue;
    var c=CL[id];
    if(!cats[c.cat])cats[c.cat]=[];
    cats[c.cat].push(c);
  }
  var h="<div class='sb-sec'><div class='sb-hdr' onclick=\"toggleSec('sec-conn')\">CONNECTORS &#9660;</div><div id='sec-conn'>";
  for(var cat in cats){
    h+="<div class='cat-label'>"+cat+"</div>";
    cats[cat].forEach(function(c){
      h+="<div class='conn-item' draggable='true' ondragstart=\"sbDragStart(event,'conn','"+c.id+"')\">";
      h+=connMiniSVG(c)+" <span>"+c.short+"</span> <span style='color:var(--text3);font-size:7px'>"+c.pins+"p</span></div>";
    });
  }
  h+="</div></div>";

  // Custom connectors
  var customs=S.customConnectors;
  if(customs.length){
    h+="<div class='sb-sec'><div class='sb-hdr custom-hdr' onclick=\"toggleSec('sec-custom')\">&#9741; CUSTOM &#9660;</div><div id='sec-custom'>";
    customs.forEach(function(c){
      h+="<div class='conn-item custom-conn' draggable='true' ondragstart=\"sbDragStart(event,'conn','"+c.id+"')\">";
      h+=connMiniSVG(c)+" <span>"+esc(c.short)+"</span> <span style='color:#5ab0f080;font-size:7px'>"+c.pins+"p</span></div>";
    });
    h+="</div></div>";
  }

  // Accessories
  h+="<div class='sb-sec'><div class='sb-hdr' onclick=\"toggleSec('sec-acc')\">ACCESSORIES &#9660;</div><div id='sec-acc'>";
  ACCESSORIES.forEach(function(a){
    var col=a.color||"#555";
    h+="<div class='acc-item' draggable='true' ondragstart=\"sbDragStart(event,'acc','"+a.id+"')\">";
    h+="<span style='display:inline-block;width:12px;height:12px;border-radius:2px;background:"+col+";border:1px solid #555;flex-shrink:0'></span> ";
    h+="<span>"+a.name+"</span></div>";
  });
  h+="</div></div>";

  document.getElementById("sidebar-inner").innerHTML=h;
  var wrap=document.getElementById("canvas-wrap");
  wrap.addEventListener("dragover",function(e){e.preventDefault();});
  wrap.addEventListener("drop",function(e){
    e.preventDefault();
    var type=e.dataTransfer.getData("type"), itemId=e.dataTransfer.getData("itemId");
    var rect=CV.getBoundingClientRect();
    var w=screenToWorld(e.clientX-rect.left,e.clientY-rect.top);
    if(type==="conn"){addConnector(itemId,w.x,w.y);}
    else if(type==="acc"){addAccessory(itemId,w.x,w.y);}
  });
}

function connMiniSVG(lib){
  var sz=18, t=lib.type||"RECT";
  if(t==="DSUB") return "<svg width='"+sz+"' height='"+sz+"' viewBox='0 0 18 18'><rect x='1' y='4' width='16' height='10' rx='2' fill='#3a3a3a' stroke='#666' stroke-width='0.8'/><circle cx='5' cy='9' r='2' fill='#d4b870'/><circle cx='9' cy='9' r='2' fill='#3498db'/><circle cx='13' cy='9' r='2' fill='#27ae60'/></svg>";
  if(t==="CIRC") return "<svg width='"+sz+"' height='"+sz+"' viewBox='0 0 18 18'><circle cx='9' cy='9' r='8' fill='#444' stroke='#666' stroke-width='0.8'/><circle cx='9' cy='9' r='5' fill='#2a2a2a'/><circle cx='9' cy='5' r='2' fill='#e74c3c'/><circle cx='13' cy='11' r='2' fill='#3498db'/><circle cx='5' cy='11' r='2' fill='#27ae60'/></svg>";
  if(t==="RJ")   return "<svg width='"+sz+"' height='"+sz+"' viewBox='0 0 18 18'><rect x='2' y='5' width='14' height='9' rx='2' fill='#c8c8c8' stroke='#888' stroke-width='0.8'/><rect x='4' y='8' width='2' height='5' fill='#e74c3c'/><rect x='7' y='8' width='2' height='5' fill='#27ae60'/><rect x='10' y='8' width='2' height='5' fill='#3498db'/><rect x='13' y='8' width='1' height='5' fill='#555'/></svg>";
  if(t==="USB")  return "<svg width='"+sz+"' height='"+sz+"' viewBox='0 0 18 18'><rect x='3' y='6' width='12' height='7' rx='2' fill='#888' stroke='#555' stroke-width='0.8'/><rect x='5' y='8' width='2' height='4' fill='#e74c3c'/><rect x='8' y='8' width='2' height='4' fill='#ccc'/><rect x='11' y='8' width='2' height='4' fill='#27ae60'/></svg>";
  // custom / RECT default — blue tint
  return "<svg width='"+sz+"' height='"+sz+"' viewBox='0 0 18 18'><rect x='2' y='4' width='14' height='10' rx='2' fill='#0a1e2e' stroke='#5ab0f0' stroke-width='0.8'/><circle cx='6' cy='9' r='2' fill='#5ab0f0'/><circle cx='9' cy='9' r='2' fill='#50d0a0'/><circle cx='12' cy='9' r='2' fill='#5ab0f0'/></svg>";
}

function sbDragStart(e,type,id){e.dataTransfer.setData("type",type);e.dataTransfer.setData("itemId",id);}
function toggleSec(id){var el=document.getElementById(id);if(el)el.style.display=el.style.display==="none"?"":"none";}

function addConnector(connId,wx,wy){
  var lib=CL[connId]; if(!lib) return;
  var label="P"+S.nextConnLabel++;
  S.elements.push({id:uid(),kind:"connector",connId:connId,label:label,x:wx,y:wy,side:"left",notes:""});
  saveState(); renderCanvas();
}
function addAccessory(accId,wx,wy){
  var acc=null; for(var i=0;i<ACCESSORIES.length;i++){if(ACCESSORIES[i].id===accId){acc=ACCESSORIES[i];break;}}
  if(!acc) return;
  S.elements.push({id:uid(),kind:"accessory",accId:accId,label:acc.name,x:wx,y:wy});
  saveState(); renderCanvas();
}

// ============================================================
// TOOLS
// ============================================================
function getElConnId(elId){
  for(var i=0;i<S.elements.length;i++){if(S.elements[i].id===elId) return S.elements[i].connId;}
  return null;
}

function updateRouteHint(msg){
  var el=document.getElementById("route-hint");
  if(!el) return;
  if(msg){el.textContent=msg; el.style.color="var(--accent)";}
  else{el.textContent="Drag from sidebar | Right-click=delete | Scroll=zoom | Alt+drag=pan"; el.style.color="var(--text3)";}
}

// Recompute ortho routePts for all wires touching a moved element
function recomputeWireRoutes(elId){
  S.wires.forEach(function(w){
    if(w.routeStyle&&w.routeStyle!=="direct"&&(w.fromEl===elId||w.toEl===elId)){
      var fe=null,te=null;
      S.elements.forEach(function(e){if(e.id===w.fromEl)fe=e;if(e.id===w.toEl)te=e;});
      if(fe&&te){
        var pp1=getPinPos(fe,w.fromPin), pp2=getPinPos(te,w.toPin);
        if(pp1&&pp2) w.routePts=buildOrthoRoute(pp1,pp2,w.fromEl,w.toEl);
      }
    }
  });
}

function setTool(t){
  tool=t; wireStart=null;
  document.querySelectorAll(".ctool").forEach(function(b){b.classList.remove("on");});
  var btn=document.getElementById("tool-"+t);
  if(btn) btn.classList.add("on");
  CV.style.cursor=(t==="wire"||t==="dimension"||t==="autoroute")?"crosshair":t==="pan"?"grab":"default";
  if(t==="autoroute"){
    updateRouteHint("⚡ Click a pin to start → click destination pin  |  ESC to cancel");
  } else {
    updateRouteHint(null);
  }
  renderCanvas();
}

function fitView(){
  if(!S.elements.length){S.zoom=1;S.panX=50;S.panY=50;renderCanvas();return;}
  var minX=99999,minY=99999,maxX=-99999,maxY=-99999;
  S.elements.forEach(function(el){
    minX=Math.min(minX,el.x); minY=Math.min(minY,el.y);
    maxX=Math.max(maxX,el.x+100); maxY=Math.max(maxY,el.y+200);
  });
  var pw=CV.width-80, ph=CV.height-80;
  var zx=pw/(maxX-minX+1), zy=ph/(maxY-minY+1);
  S.zoom=clamp(Math.min(zx,zy),0.2,2);
  S.panX=40-minX*S.zoom; S.panY=40-minY*S.zoom;
  renderCanvas();
}

// ============================================================
