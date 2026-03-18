/* ============================================================
   HARNESS.JS — Harness View canvas engine
   MOTI HarnessPro
   ============================================================ */
'use strict';

// HARNESS VIEW ENGINE
// Physical cable layout canvas — drag & drop topology editor
// ═══════════════════════════════════════════════════════════════
// H is declared in app.js
var HVC=null,HVCTX=null;
var hvPan={a:false,sx:0,sy:0,px:0,py:0};

function hw2s(x,y){return{x:x*H.zoom+H.panX,y:y*H.zoom+H.panY};}
function hs2w(x,y){return{x:(x-H.panX)/H.zoom,y:(y-H.panY)/H.zoom};}
function hvNById(id){for(var i=0;i<H.nodes.length;i++)if(H.nodes[i].id===id)return H.nodes[i];return null;}
function hvSById(id){for(var i=0;i<H.segs.length;i++) if(H.segs[i].id===id)return H.segs[i];return null;}
function hvDist(ax,ay,bx,by){return Math.sqrt((bx-ax)*(bx-ax)+(by-ay)*(by-ay));}
function hvPSD(px,py,ax,ay,bx,by){
  var dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
  if(l2<.001)return hvDist(px,py,ax,ay);
  var t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/l2));
  return hvDist(px,py,ax+t*dx,ay+t*dy);
}
function hvSegThick(seg){return Math.max(5,Math.min(30,5+(seg.wires?seg.wires.length:0)*2.2));}

function hvBuildTopology(){
  var connEls=S.elements.filter(function(e){return e.kind==="connector";});
  var posCache={};
  H.nodes.forEach(function(n){posCache[n.id]={x:n.x,y:n.y,angle:n.angle};});
  var junctions=H.nodes.filter(function(n){return n.isJunction;});

  H.nodes=connEls.map(function(el,i){
    var c=posCache[el.id];
    var n=connEls.length,a=(i/Math.max(n,1))*Math.PI*2-Math.PI/2,r=160+n*25;
    return{id:el.id,label:el.label,connId:el.connId,
           x:c?c.x:Math.cos(a)*r,y:c?c.y:Math.sin(a)*r,
           angle:c&&c.angle!==undefined?c.angle:(a*180/Math.PI+90),isJunction:false};
  }).concat(junctions);

  var seen={};
  H.nodes=H.nodes.filter(function(n){if(seen[n.id])return false;seen[n.id]=true;return true;});

  var segMap={};
  S.wires.forEach(function(w){
    if(!w.fromEl||!w.toEl)return;
    var key=[w.fromEl,w.toEl].sort().join("~~");
    if(!segMap[key])segMap[key]={from:w.fromEl,to:w.toEl,wires:[]};
    segMap[key].wires.push(w.id);
  });
  var sc2={};
  H.segs.forEach(function(s){sc2[s.id]=s;});
  H.segs=Object.keys(segMap).map(function(key){
    var sm=segMap[key],ex=sc2[key];
    return{id:key,from:sm.from,to:sm.to,wires:sm.wires,
           lengthMm:ex?ex.lengthMm:S.cableLength,label:ex?ex.label:"",pts:ex&&ex.pts?ex.pts:[]};
  });
}

function hvAutoLayout(){
  var cn=H.nodes.filter(function(n){return!n.isJunction;}),n=cn.length;
  if(!n)return;
  if(n===1){cn[0].x=0;cn[0].y=0;cn[0].angle=0;return;}
  if(n===2){cn[0].x=-220;cn[0].y=0;cn[0].angle=180;cn[1].x=220;cn[1].y=0;cn[1].angle=0;return;}
  var r=150+n*28;
  cn.forEach(function(nd,i){var a=(i/n)*Math.PI*2-Math.PI/2;nd.x=Math.cos(a)*r;nd.y=Math.sin(a)*r;nd.angle=(a*180/Math.PI)+90;});
}

function renderHarness(){
  hvBuildTopology();
  HVC=document.getElementById("hv-cv");
  if(!HVC)return;
  var wrap=document.getElementById("hv-wrap");
  if(!wrap)return;
  HVC.width=wrap.clientWidth||900;
  HVC.height=wrap.clientHeight||560;
  HVCTX=HVC.getContext("2d");
  hvFit();
  HVC.onmousedown=hvMD;
  HVC.onmousemove=hvMM;
  HVC.onmouseup=hvMU;
  HVC.addEventListener("wheel",hvMW,{passive:false});
  HVC.ondblclick=hvDbl;
  window.addEventListener("resize",hvResize);
}

function hvFit(){
  if(!HVC)return;
  var pts=[];
  H.nodes.forEach(function(n){pts.push({x:n.x,y:n.y});});
  if(!pts.length){H.zoom=1;H.panX=HVC.width/2;H.panY=HVC.height/2;hvDraw();return;}
  var mn={x:pts[0].x-80,y:pts[0].y-80},mx={x:pts[0].x+80,y:pts[0].y+80};
  pts.forEach(function(p){mn.x=Math.min(mn.x,p.x-80);mn.y=Math.min(mn.y,p.y-80);mx.x=Math.max(mx.x,p.x+80);mx.y=Math.max(mx.y,p.y+80);});
  var pw=HVC.width-60,ph=HVC.height-60;
  H.zoom=Math.max(0.1,Math.min(2.5,Math.min(pw/(mx.x-mn.x||1),ph/(mx.y-mn.y||1))));
  H.panX=30-mn.x*H.zoom;H.panY=30-mn.y*H.zoom;
  hvDraw();
}

function hvSync(){hvBuildTopology();hvDraw();toast("Synced from canvas");}

function hvDraw(){
  if(!HVC||!HVCTX)return;
  var W=HVC.width,Ht=HVC.height,z=H.zoom;
  HVCTX.clearRect(0,0,W,Ht);
  // Paper bg
  HVCTX.fillStyle="#c8c4b8";HVCTX.fillRect(0,0,W,Ht);
  // Dot grid
  HVCTX.fillStyle="rgba(0,0,0,0.06)";
  var step=25*z,ox=((H.panX%step)+step)%step,oy=((H.panY%step)+step)%step;
  for(var gx=ox;gx<W;gx+=step)for(var gy=oy;gy<Ht;gy+=step){HVCTX.beginPath();HVCTX.arc(gx,gy,0.85,0,Math.PI*2);HVCTX.fill();}
  // Draw cables
  H.segs.forEach(function(seg){hvDrawCable(seg);});
  // Draw connectors
  H.nodes.forEach(function(nd){hvDrawNode(nd);});
  // Dim labels on segs
  H.segs.forEach(function(seg){hvDrawDimLabel(seg);});
  // Bend handles
  if(H.sel&&H.sel.type==="seg"){var sg=hvSById(H.sel.id);if(sg)(sg.pts||[]).forEach(function(p){var s=hw2s(p.x,p.y);HVCTX.beginPath();HVCTX.arc(s.x,s.y,6*z,0,Math.PI*2);HVCTX.fillStyle="rgba(200,168,40,.9)";HVCTX.fill();HVCTX.strokeStyle="#fff";HVCTX.lineWidth=1.5;HVCTX.stroke();});}
}

function hvGetPath(seg,n1,n2){
  var stub=38,a1=(n1.angle||0)*Math.PI/180,a2=(n2.angle||0)*Math.PI/180;
  var s1={x:n1.x+Math.cos(a1)*stub,y:n1.y+Math.sin(a1)*stub};
  var s2={x:n2.x+Math.cos(a2)*stub,y:n2.y+Math.sin(a2)*stub};
  return[{x:n1.x,y:n1.y},s1].concat(seg.pts||[]).concat([s2,{x:n2.x,y:n2.y}]);
}

function hvDrawCable(seg){
  var n1=hvNById(seg.from),n2=hvNById(seg.to);if(!n1||!n2)return;
  var thick=hvSegThick(seg),isSel=(H.sel&&H.sel.id===seg.id);
  var pts=hvGetPath(seg,n1,n2);
  var spts=pts.map(function(p){return hw2s(p.x,p.y);});
  var z=H.zoom;

  function poly(pts2){HVCTX.beginPath();HVCTX.moveTo(pts2[0].x,pts2[0].y);for(var i=1;i<pts2.length;i++)HVCTX.lineTo(pts2[i].x,pts2[i].y);HVCTX.stroke();}

  // Shadow
  HVCTX.shadowColor="rgba(0,0,0,.3)";HVCTX.shadowBlur=5*z;HVCTX.shadowOffsetY=2*z;
  // Outer sheath
  HVCTX.strokeStyle=isSel?"#b85810":"#282418";HVCTX.lineWidth=thick*z;HVCTX.lineCap="round";HVCTX.lineJoin="round";HVCTX.setLineDash([]);poly(spts);
  HVCTX.shadowBlur=0;HVCTX.shadowOffsetY=0;
  // Highlight stripe
  HVCTX.strokeStyle=isSel?"rgba(220,140,40,.5)":"rgba(160,148,110,.38)";HVCTX.lineWidth=thick*z*.36;poly(spts);
  // Braid hatch
  for(var pi=0;pi<spts.length-1;pi++){
    var ax=spts[pi].x,ay=spts[pi].y,bx=spts[pi+1].x,by=spts[pi+1].y;
    var slen=Math.sqrt((bx-ax)*(bx-ax)+(by-ay)*(by-ay));
    var ang=Math.atan2(by-ay,bx-ax);
    var nx=Math.cos(ang+Math.PI/2)*thick*z*.45,ny=Math.sin(ang+Math.PI/2)*thick*z*.45;
    var sp=10*z;
    HVCTX.strokeStyle="rgba(200,185,148,.32)";HVCTX.lineWidth=0.7;
    for(var t=sp/2;t<slen-sp/2;t+=sp){
      var tx=ax+Math.cos(ang)*t,ty=ay+Math.sin(ang)*t,dx=Math.cos(ang)*5*z,dy=Math.sin(ang)*5*z;
      HVCTX.beginPath();HVCTX.moveTo(tx+nx,ty+ny);HVCTX.lineTo(tx-nx+dx,ty-ny+dy);HVCTX.stroke();
      HVCTX.beginPath();HVCTX.moveTo(tx-nx,ty-ny);HVCTX.lineTo(tx+nx+dx,ty+ny+dy);HVCTX.stroke();
    }
  }
  // Wire colour stripes
  var wCols=[];(seg.wires||[]).forEach(function(wid){S.wires.forEach(function(w){if(w.id===wid)wCols.push(sc(w.color||"#888"));});});
  var maxS=Math.min(wCols.length,8);
  if(maxS>0){
    var sw=Math.max(1,thick*z*.11),spread=thick*z*.28;
    wCols.slice(0,maxS).forEach(function(col,ci){
      var t2=maxS===1?0:((ci/(maxS-1))*2-1)*spread;
      HVCTX.strokeStyle=col;HVCTX.lineWidth=sw;HVCTX.lineCap="butt";
      HVCTX.beginPath();
      for(var pi2=0;pi2<spts.length-1;pi2++){
        var ddx=spts[pi2+1].x-spts[pi2].x,ddy=spts[pi2+1].y-spts[pi2].y;
        var l=Math.sqrt(ddx*ddx+ddy*ddy)||1;
        var nnx=-ddy/l*t2,nny=ddx/l*t2;
        if(pi2===0)HVCTX.moveTo(spts[0].x+nnx,spts[0].y+nny);
        HVCTX.lineTo(spts[pi2+1].x+nnx,spts[pi2+1].y+nny);
      }
      HVCTX.stroke();
    });
  }
}

function hvDrawDimLabel(seg){
  var n1=hvNById(seg.from),n2=hvNById(seg.to);if(!n1||!n2)return;
  var pts=hvGetPath(seg,n1,n2);
  var spts=pts.map(function(p){return hw2s(p.x,p.y);});
  var thick=hvSegThick(seg),z=H.zoom,isSel=(H.sel&&H.sel.id===seg.id);
  var totLen=0,cumL=[0];
  for(var i=0;i<spts.length-1;i++){var dx=spts[i+1].x-spts[i].x,dy=spts[i+1].y-spts[i].y;var l=Math.sqrt(dx*dx+dy*dy);totLen+=l;cumL.push(totLen);}
  if(totLen<20)return;
  var half=totLen/2,mid={x:0,y:0},mAng=0;
  for(var i=1;i<spts.length;i++){if(cumL[i]>=half){var tt=(half-cumL[i-1])/(cumL[i]-cumL[i-1]);mid={x:spts[i-1].x+(spts[i].x-spts[i-1].x)*tt,y:spts[i-1].y+(spts[i].y-spts[i-1].y)*tt};mAng=Math.atan2(spts[i].y-spts[i-1].y,spts[i].x-spts[i-1].x);break;}}
  var px=Math.cos(mAng+Math.PI/2),py=Math.sin(mAng+Math.PI/2);
  if(py>0){px=-px;py=-py;}
  var off=(thick*z/2)+18;
  var lx=mid.x+px*off,ly=mid.y+py*off;
  var txt=(seg.label?seg.label+" | ":"")+seg.lengthMm+" mm"+(S.lengthTol?" \xb1"+S.lengthTol:"");
  var drawAng=(mAng>Math.PI/2||mAng<-Math.PI/2)?mAng+Math.PI:mAng;
  HVCTX.save();HVCTX.translate(lx,ly);HVCTX.rotate(drawAng);
  HVCTX.font="bold "+(9*z)+"px 'Courier New'";HVCTX.textAlign="center";
  var tw=HVCTX.measureText(txt).width+10;
  HVCTX.fillStyle=isSel?"rgba(185,90,10,.95)":"rgba(245,240,225,.95)";
  HVCTX.strokeStyle=isSel?"#d06010":"#336699";HVCTX.lineWidth=0.8;
  hvRR(HVCTX,-tw/2,-10*z,tw,12*z,2*z);HVCTX.fill();HVCTX.stroke();
  HVCTX.fillStyle=isSel?"#fff":"#336699";HVCTX.fillText(txt,0,0);
  HVCTX.restore();
  // Dim line + arrows
  var ep1={x:lx-Math.cos(mAng)*totLen*.46,y:ly-Math.sin(mAng)*totLen*.46};
  var ep2={x:lx+Math.cos(mAng)*totLen*.46,y:ly+Math.sin(mAng)*totLen*.46};
  HVCTX.strokeStyle="#336699";HVCTX.lineWidth=0.8*z;HVCTX.setLineDash([3,2]);
  HVCTX.beginPath();HVCTX.moveTo(spts[0].x,spts[0].y);HVCTX.lineTo(ep1.x,ep1.y);HVCTX.stroke();
  HVCTX.beginPath();HVCTX.moveTo(spts[spts.length-1].x,spts[spts.length-1].y);HVCTX.lineTo(ep2.x,ep2.y);HVCTX.stroke();
  HVCTX.setLineDash([]);
  HVCTX.beginPath();HVCTX.moveTo(ep1.x,ep1.y);HVCTX.lineTo(ep2.x,ep2.y);HVCTX.stroke();
  function hvArrow(px2,py2,a2){var s=7*z,a1=a2+2.65,a3=a2-2.65;HVCTX.beginPath();HVCTX.moveTo(px2,py2);HVCTX.lineTo(px2+Math.cos(a1)*s,py2+Math.sin(a1)*s);HVCTX.moveTo(px2,py2);HVCTX.lineTo(px2+Math.cos(a3)*s,py2+Math.sin(a3)*s);HVCTX.stroke();}
  hvArrow(ep1.x,ep1.y,Math.atan2(ep2.y-ep1.y,ep2.x-ep1.x)+Math.PI);
  hvArrow(ep2.x,ep2.y,Math.atan2(ep1.y-ep2.y,ep1.x-ep2.x)+Math.PI);
}

function hvDrawNode(node){
  var s=hw2s(node.x,node.y);var isSel=(H.sel&&H.sel.id===node.id);var lib=CL[node.connId];var z=H.zoom;
  if(node.isJunction){
    HVCTX.shadowColor="rgba(0,0,0,.4)";HVCTX.shadowBlur=5*z;
    HVCTX.beginPath();HVCTX.arc(s.x,s.y,9*z,0,Math.PI*2);
    HVCTX.fillStyle=isSel?"#b85810":"#282010";HVCTX.fill();
    HVCTX.strokeStyle=isSel?"#e08020":"#806840";HVCTX.lineWidth=1.2;HVCTX.stroke();
    HVCTX.shadowBlur=0;
    HVCTX.fillStyle="#f0e0c0";HVCTX.font="bold "+(7.5*z)+"px 'Courier New'";HVCTX.textAlign="center";
    HVCTX.fillText(node.label||"J",s.x,s.y+2.8*z);
    HVCTX.fillStyle=isSel?"#b85810":"#706040";HVCTX.font=(7*z)+"px 'Courier New'";
    HVCTX.fillText(node.label||"J",s.x,s.y+18*z);return;
  }
  if(!lib)return;
  var ang=(node.angle||0)*Math.PI/180;
  var bw=Math.max(24,Math.min(42,20+lib.pins*1.1))*z;
  var bh=Math.max(18,Math.min(38,12+lib.pins*1.7))*z;
  HVCTX.save();HVCTX.translate(s.x,s.y);HVCTX.rotate(ang);
  HVCTX.shadowColor="rgba(0,0,0,.45)";HVCTX.shadowBlur=8*z;HVCTX.shadowOffsetY=2*z;
  var g=HVCTX.createLinearGradient(-bw/2,-bh/2,bw/2,bh/2);
  g.addColorStop(0,"#a8a090");g.addColorStop(.4,"#c0b8a8");g.addColorStop(.6,"#b0a898");g.addColorStop(1,"#686058");
  HVCTX.fillStyle=g;HVCTX.strokeStyle=isSel?"#c07030":"#504840";HVCTX.lineWidth=isSel?2*z:1*z;
  hvRR(HVCTX,-bw/2,-bh/2,bw,bh,3*z);HVCTX.fill();HVCTX.stroke();HVCTX.shadowBlur=0;HVCTX.shadowOffsetY=0;
  var ig=HVCTX.createLinearGradient(-bw*.4,-bh*.38,bw*.4,bh*.38);ig.addColorStop(0,"#352c20");ig.addColorStop(1,"#181008");
  HVCTX.fillStyle=ig;HVCTX.strokeStyle="#100808";HVCTX.lineWidth=0.7*z;
  hvRR(HVCTX,-bw*.42,-bh*.4,bw*.84,bh*.8,2*z);HVCTX.fill();HVCTX.stroke();
  HVCTX.fillStyle="#807060";HVCTX.strokeStyle="#585040";HVCTX.lineWidth=0.7*z;
  hvRR(HVCTX,-bw*.24,-bh/2-4*z,bw*.48,5*z,2*z);HVCTX.fill();HVCTX.stroke();
  var cols=Math.ceil(Math.sqrt(lib.pins)),rows=Math.ceil(lib.pins/cols);
  var cw2=bw*.84/cols,ch2=bh*.8/rows,dr=Math.max(1.5,Math.min(3.8,cw2*.32));
  lib.pinout.forEach(function(pp,i){
    var c=i%cols,r2=Math.floor(i/cols);
    var px=-bw*.42+cw2*(c+.5),py2=-bh*.4+ch2*(r2+.5);
    HVCTX.beginPath();HVCTX.arc(px,py2,dr,0,Math.PI*2);
    HVCTX.fillStyle=sc(pp.c);HVCTX.fill();HVCTX.strokeStyle="rgba(0,0,0,.6)";HVCTX.lineWidth=.4*z;HVCTX.stroke();
    HVCTX.beginPath();HVCTX.arc(px-dr*.24,py2-dr*.24,dr*.28,0,Math.PI*2);HVCTX.fillStyle="rgba(255,255,255,.3)";HVCTX.fill();
  });
  if(isSel){HVCTX.strokeStyle="rgba(200,120,40,.7)";HVCTX.lineWidth=2*z;HVCTX.setLineDash([4*z,3*z]);hvRR(HVCTX,-bw/2-4*z,-bh/2-4*z,bw+8*z,bh+8*z,5*z);HVCTX.stroke();HVCTX.setLineDash([]);}
  HVCTX.restore();
  HVCTX.fillStyle="#111";HVCTX.font="bold "+(8.5*z)+"px 'Courier New'";HVCTX.textAlign="center";
  HVCTX.fillText(node.label||"?",s.x,s.y+bh/2+12*z);
  HVCTX.fillStyle="#555";HVCTX.font=(6.5*z)+"px 'Courier New'";HVCTX.fillText(lib.short,s.x,s.y+bh/2+21*z);
  // Pin table popup when selected
  if(isSel) hvPinPopup(node,s,bw,bh,lib,z,ang);
}

function hvPinPopup(node,s,bw,bh,lib,z,ang){
  var cx=s.x+Math.cos(ang)*(bw*.5+14*z)+14;
  var cy=s.y+Math.sin(ang)*(bw*.5+14*z);
  var cw=186*z,rh=12*z,hh=16*z,ch=hh+(lib.pinout.length+1)*rh+8*z;
  if(cx+cw>HVC.width-10)cx=s.x-cw-20;
  cy=Math.max(5,Math.min(HVC.height-ch-5,cy));
  HVCTX.shadowColor="rgba(0,0,0,.35)";HVCTX.shadowBlur=8*z;
  HVCTX.fillStyle="#faf7ee";HVCTX.strokeStyle="#c07030";HVCTX.lineWidth=1.2;
  hvRR(HVCTX,cx,cy,cw,ch,4*z);HVCTX.fill();HVCTX.stroke();HVCTX.shadowBlur=0;
  HVCTX.fillStyle="#336699";hvRR(HVCTX,cx,cy,cw,hh,4*z);HVCTX.fill();
  HVCTX.fillStyle="#fff";HVCTX.font="bold "+(7*z)+"px 'Courier New'";HVCTX.textAlign="center";
  HVCTX.fillText((node.label||"?")+" \u2014 "+lib.short+" ("+lib.pins+"P)",cx+cw/2,cy+11*z);
  var cxs=[cx+3*z,cx+22*z,cx+64*z,cx+104*z,cx+130*z,cx+154*z];
  ["#","NAME","SIG","AWG","C","\u2192TO"].forEach(function(h,i){HVCTX.fillStyle="#7a6040";HVCTX.font=(5.5*z)+"px 'Courier New'";HVCTX.textAlign="left";HVCTX.fillText(h,cxs[i],cy+hh+8*z);});
  HVCTX.strokeStyle="#ddd";HVCTX.lineWidth=.5;HVCTX.beginPath();HVCTX.moveTo(cx+2,cy+hh+10*z);HVCTX.lineTo(cx+cw-2,cy+hh+10*z);HVCTX.stroke();
  lib.pinout.forEach(function(pp,i){
    var ry=cy+hh+rh*(i+2);
    if(i%2===0){HVCTX.fillStyle="rgba(0,0,0,.04)";HVCTX.fillRect(cx,ry-rh+2*z,cw,rh);}
    var wfp=null;
    S.wires.forEach(function(w){if((w.fromEl===node.id&&String(w.fromPin)===String(pp.id))||(w.toEl===node.id&&String(w.toPin)===String(pp.id)))wfp=w;});
    var toPin="\u2014";
    if(wfp){var oe=null;S.elements.forEach(function(e){if(e.id===(wfp.fromEl===node.id?wfp.toEl:wfp.fromEl))oe=e;});toPin=(oe?oe.label:"?")+"."+( wfp.fromEl===node.id?wfp.toPin:wfp.fromPin);}
    HVCTX.fillStyle="#1a1208";HVCTX.font=(6*z)+"px 'Courier New'";HVCTX.textAlign="left";
    HVCTX.fillText(String(pp.id),cxs[0],ry);HVCTX.fillText(pp.n.substring(0,6),cxs[1],ry);
    HVCTX.fillText((wfp?wfp.signal||pp.sig:pp.sig).substring(0,5),cxs[2],ry);HVCTX.fillText(pp.g.substring(0,5),cxs[3],ry);
    HVCTX.beginPath();HVCTX.arc(cxs[4]+4*z,ry-3.5*z,3.5*z,0,Math.PI*2);HVCTX.fillStyle=sc(pp.c);HVCTX.fill();HVCTX.strokeStyle="#aaa";HVCTX.lineWidth=.4;HVCTX.stroke();
    HVCTX.fillStyle="#336699";HVCTX.font="bold "+(5.5*z)+"px 'Courier New'";HVCTX.fillText(toPin.substring(0,9),cxs[5],ry);
  });
}

function hvRR(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}

function hvHitNode(wx,wy){
  for(var i=H.nodes.length-1;i>=0;i--){
    var n=H.nodes[i];
    if(n.isJunction){if(hvDist(wx,wy,n.x,n.y)<14/H.zoom)return n;continue;}
    var lib=CL[n.connId];if(!lib)continue;
    var bw=Math.max(24,Math.min(42,20+lib.pins*1.1)),bh=Math.max(18,Math.min(38,12+lib.pins*1.7));
    var ang=(n.angle||0)*Math.PI/180,dx=wx-n.x,dy=wy-n.y;
    var lx=dx*Math.cos(-ang)-dy*Math.sin(-ang),ly=dx*Math.sin(-ang)+dy*Math.cos(-ang);
    if(Math.abs(lx)<bw/2+10&&Math.abs(ly)<bh/2+25)return n;
  }
  return null;
}
function hvHitSeg(wx,wy){
  for(var i=0;i<H.segs.length;i++){
    var s=H.segs[i],n1=hvNById(s.from),n2=hvNById(s.to);if(!n1||!n2)continue;
    var pts=hvGetPath(s,n1,n2),th=(hvSegThick(s)/H.zoom)+5;
    for(var j=0;j<pts.length-1;j++)if(hvPSD(wx,wy,pts[j].x,pts[j].y,pts[j+1].x,pts[j+1].y)<th)return s;
  }
  return null;
}
function hvHitBend(wx,wy){
  if(!H.sel||H.sel.type!=="seg")return null;
  var s=hvSById(H.sel.id);if(!s||!s.pts)return null;
  for(var i=0;i<s.pts.length;i++)if(hvDist(wx,wy,s.pts[i].x,s.pts[i].y)<10/H.zoom)return{segId:s.id,ptIdx:i};
  return null;
}

function hvShowProps(html){var pb=document.getElementById("hv-props");if(pb)pb.innerHTML=html;}
function hvNodeProps(nd){
  var lib=CL[nd.connId];
  hvShowProps("<span style='color:var(--accent);font-weight:bold'>"+(nd.isJunction?"JUNCTION":"CONNECTOR")+"</span>&nbsp;"+
    "<span style='color:#c8c8c8'>"+esc(nd.label||"?")+"</span>&nbsp;&nbsp;"+
    (lib?"<span style='color:#887040'>"+esc(lib.name)+" | "+lib.pins+"P</span>&nbsp;&nbsp;":"")+
    (!nd.isJunction?"<span style='color:#505050'>ANGLE:</span>&nbsp;<input type='number' value='"+(nd.angle||0).toFixed(0)+"' min='-360' max='360' step='15' style='width:50px;background:#120e04;border:1px solid #4a3010;color:var(--accent);padding:2px 4px;font-family:monospace;font-size:9px' oninput=\"hvSetAngle('"+nd.id+"',+this.value)\"/>&deg;&nbsp;&nbsp;":"")+
    (nd.isJunction?"<button onclick=\"hvDelJunction('"+nd.id+"')\" style='background:none;border:1px solid #3a1010;color:var(--red);cursor:pointer;padding:2px 7px;font-family:monospace;font-size:8px'>\xd7 DELETE</button>":""));
}
function hvSegProps(seg){
  var n1=hvNById(seg.from),n2=hvNById(seg.to),wc="";
  (seg.wires||[]).slice(0,8).forEach(function(wid){S.wires.forEach(function(w){if(w.id===wid)wc+="<span style='display:inline-block;width:9px;height:9px;border-radius:50%;background:"+sc(w.color)+";margin:0 1px;vertical-align:middle'></span>";});});
  hvShowProps("<span style='color:var(--accent);font-weight:bold'>CABLE</span>&nbsp;"+
    "<span style='color:#887040'>"+(n1?n1.label:"?")+" \u2194 "+(n2?n2.label:"?")+"</span>&nbsp;"+wc+"&nbsp;<span style='color:#505050'>"+(seg.wires||[]).length+"w</span>&nbsp;&nbsp;"+
    "<span style='color:#505050'>LENGTH:</span>&nbsp;<input type='number' value='"+seg.lengthMm+"' min='1' style='width:60px;background:#120e04;border:1px solid #4a3010;color:var(--accent);padding:2px 4px;font-family:monospace;font-size:9px' oninput=\"hvSetLen('"+seg.id+"',+this.value)\"/>&nbsp;mm&nbsp;&nbsp;"+
    "<span style='color:#505050'>LABEL:</span>&nbsp;<input value='"+esc(seg.label||"")+"' style='width:70px;background:#120e04;border:1px solid #4a3010;color:var(--accent);padding:2px 4px;font-family:monospace;font-size:9px' placeholder='S1, TRUNK\u2026' oninput=\"hvSetLabel('"+seg.id+"',this.value)\"/>&nbsp;&nbsp;"+
    "<span style='color:#444;font-size:8px'>Dbl-click cable = bend point</span>");
}
function hvSetAngle(id,v){H.nodes.forEach(function(n){if(n.id===id)n.angle=v;});hvDraw();}
function hvSetLen(id,v){H.segs.forEach(function(s){if(s.id===id)s.lengthMm=v||0;});hvDraw();}
function hvSetLabel(id,v){H.segs.forEach(function(s){if(s.id===id)s.label=v;});hvDraw();}

function hvAddJunction(){
  if(!HVC)return;
  var c=hs2w(HVC.width/2,HVC.height/2);
  var cnt=H.nodes.filter(function(n){return n.isJunction;}).length;
  H.nodes.push({id:"J_"+uid(),label:"J"+(cnt+1),connId:null,x:c.x,y:c.y,angle:0,isJunction:true});
  hvDraw();toast("Junction added");
}
function hvDelJunction(id){
  H.nodes=H.nodes.filter(function(n){return n.id!==id;});
  H.segs=H.segs.filter(function(s){return s.from!==id&&s.to!==id;});
  H.sel=null;hvDraw();hvShowProps("Click a cable or connector");
}

function hvMD(e){
  var rect=HVC.getBoundingClientRect();var sx=e.clientX-rect.left,sy=e.clientY-rect.top,w=hs2w(sx,sy);
  if(e.button===1||(e.altKey&&e.button===0)){hvPan={a:true,sx:sx,sy:sy,px:H.panX,py:H.panY};HVC.style.cursor="grabbing";return;}
  var bp=hvHitBend(w.x,w.y);if(bp){H.drag={type:"bend",segId:bp.segId,ptIdx:bp.ptIdx};HVC.style.cursor="grabbing";return;}
  var nd=hvHitNode(w.x,w.y);
  if(nd){H.sel={type:"node",id:nd.id};H.drag={type:"node",id:nd.id,ox:w.x-nd.x,oy:w.y-nd.y};HVC.style.cursor="grabbing";hvDraw();hvNodeProps(nd);return;}
  var sg=hvHitSeg(w.x,w.y);
  if(sg){H.sel={type:"seg",id:sg.id};H.drag=null;hvDraw();hvSegProps(sg);return;}
  H.sel=null;H.drag=null;hvShowProps("Click a cable or connector");hvDraw();
}
function hvMM(e){
  var rect=HVC.getBoundingClientRect();var sx=e.clientX-rect.left,sy=e.clientY-rect.top,w=hs2w(sx,sy);
  if(hvPan.a){H.panX=hvPan.px+(sx-hvPan.sx);H.panY=hvPan.py+(sy-hvPan.sy);hvDraw();return;}
  if(H.drag){
    if(H.drag.type==="node")H.nodes.forEach(function(n){if(n.id===H.drag.id){n.x=w.x-H.drag.ox;n.y=w.y-H.drag.oy;}});
    else if(H.drag.type==="bend"){var s=hvSById(H.drag.segId);if(s&&s.pts)s.pts[H.drag.ptIdx]={x:w.x,y:w.y};}
    hvDraw();return;
  }
  if(hvHitBend(w.x,w.y)){HVC.style.cursor="crosshair";return;}
  if(hvHitNode(w.x,w.y)){HVC.style.cursor="grab";return;}
  HVC.style.cursor=hvHitSeg(w.x,w.y)?"pointer":"default";
}
function hvMU(){hvPan.a=false;H.drag=null;HVC.style.cursor="default";}
function hvMW(e){
  e.preventDefault();var rect=HVC.getBoundingClientRect();var sx=e.clientX-rect.left,sy=e.clientY-rect.top;
  var f=e.deltaY<0?1.12:.89,nz=Math.max(.08,Math.min(5,H.zoom*f));
  H.panX=sx-(sx-H.panX)*(nz/H.zoom);H.panY=sy-(sy-H.panY)*(nz/H.zoom);H.zoom=nz;hvDraw();
}
function hvDbl(e){
  var rect=HVC.getBoundingClientRect();var w=hs2w(e.clientX-rect.left,e.clientY-rect.top);
  var sg=hvHitSeg(w.x,w.y);
  if(sg){if(!sg.pts)sg.pts=[];sg.pts.push({x:w.x,y:w.y});H.sel={type:"seg",id:sg.id};hvDraw();hvSegProps(sg);return;}
  var nd=hvHitNode(w.x,w.y);
  if(nd&&nd.isJunction){var v=prompt("Label:",nd.label||"J");if(v!==null){nd.label=v;hvDraw();}}
}
function hvResize(){
  if(!HVC)return;var wrap=document.getElementById("hv-wrap");if(!wrap)return;
  HVC.width=wrap.clientWidth||900;HVC.height=wrap.clientHeight||560;hvDraw();
}
window.addEventListener("resize",function(){hvResize();});

// ═══════════════════════════════════════════════════════════════
// 