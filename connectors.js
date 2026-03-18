/* ============================================================
   CONNECTOR LIBRARY — built-in read-only definitions
   MOTI HarnessPro — db/connectors.js
   ============================================================ */

'use strict';

function mkpins(n,pre,sig,awg,hStep){
  var r=[];
  for(var i=0;i<n;i++) r.push({id:i+1,n:pre+(i+1),sig:sig,g:awg,c:hslc(i*hStep)});
  return r;
}
function hslc(h){ return 'hsl('+h+',65%,45%)'; }

/* exported CL_BUILTIN */
var CL_BUILTIN = {
  'DB9M':  {id:'DB9M',  name:'D-SUB 9P Male',     short:'DB9M',  pins:9,  type:'DSUB',cat:'Serial',builtin:true,
    pinout:[{id:1,n:'DCD',sig:'RS232',g:'28AWG',c:'#e74c3c'},{id:2,n:'RXD',sig:'RS232',g:'28AWG',c:'#3498db'},
            {id:3,n:'TXD',sig:'RS232',g:'28AWG',c:'#27ae60'},{id:4,n:'DTR',sig:'RS232',g:'28AWG',c:'#f39c12'},
            {id:5,n:'GND',sig:'GND',  g:'28AWG',c:'#888'},   {id:6,n:'DSR',sig:'RS232',g:'28AWG',c:'#9b59b6'},
            {id:7,n:'RTS',sig:'RS232',g:'28AWG',c:'#1abc9c'},{id:8,n:'CTS',sig:'RS232',g:'28AWG',c:'#e67e22'},
            {id:9,n:'RI', sig:'RS232',g:'28AWG',c:'#c0392b'}]},
  'DB9F':  {id:'DB9F',  name:'D-SUB 9P Female',    short:'DB9F',  pins:9,  type:'DSUB',cat:'Serial',builtin:true,
    pinout:[{id:1,n:'DCD',sig:'RS232',g:'28AWG',c:'#e74c3c'},{id:2,n:'RXD',sig:'RS232',g:'28AWG',c:'#3498db'},
            {id:3,n:'TXD',sig:'RS232',g:'28AWG',c:'#27ae60'},{id:4,n:'DTR',sig:'RS232',g:'28AWG',c:'#f39c12'},
            {id:5,n:'GND',sig:'GND',  g:'28AWG',c:'#888'},   {id:6,n:'DSR',sig:'RS232',g:'28AWG',c:'#9b59b6'},
            {id:7,n:'RTS',sig:'RS232',g:'28AWG',c:'#1abc9c'},{id:8,n:'CTS',sig:'RS232',g:'28AWG',c:'#e67e22'},
            {id:9,n:'RI', sig:'RS232',g:'28AWG',c:'#c0392b'}]},
  'DB25M': {id:'DB25M',name:'D-SUB 25P Male',   short:'DB25M',pins:25,type:'DSUB',cat:'Serial',builtin:true, pinout:mkpins(25,'P','DATA','28AWG',14)},
  'DB25F': {id:'DB25F',name:'D-SUB 25P Female', short:'DB25F',pins:25,type:'DSUB',cat:'Serial',builtin:true, pinout:mkpins(25,'P','DATA','28AWG',14)},
  'RJ45':  {id:'RJ45', name:'RJ45 8P8C',         short:'RJ45', pins:8, type:'RJ',  cat:'Network',builtin:true,
    pinout:[{id:1,n:'TX+', sig:'ETH',g:'26AWG',c:'#ff8c00'},{id:2,n:'TX-', sig:'ETH',g:'26AWG',c:'#cc6600'},
            {id:3,n:'RX+', sig:'ETH',g:'26AWG',c:'#00aa00'},{id:4,n:'BI3+',sig:'ETH',g:'26AWG',c:'#0044ff'},
            {id:5,n:'BI3-',sig:'ETH',g:'26AWG',c:'#4488ff'},{id:6,n:'RX-', sig:'ETH',g:'26AWG',c:'#006600'},
            {id:7,n:'BI4+',sig:'ETH',g:'26AWG',c:'#885500'},{id:8,n:'BI4-',sig:'ETH',g:'26AWG',c:'#aa7744'}]},
  'USBA':  {id:'USBA',name:'USB Type-A',  short:'USB-A',pins:4, type:'USB',cat:'USB',builtin:true,
    pinout:[{id:1,n:'VBUS',sig:'PWR',g:'28AWG',c:'#e74c3c'},{id:2,n:'D-',sig:'USB',g:'28AWG',c:'#bbb'},
            {id:3,n:'D+', sig:'USB',g:'28AWG',c:'#27ae60'}, {id:4,n:'GND',sig:'GND',g:'28AWG',c:'#555'}]},
  'USBC':  {id:'USBC',name:'USB Type-C',  short:'USB-C',pins:12,type:'USB',cat:'USB',builtin:true, pinout:mkpins(12,'C','USB','28AWG',30)},
  'XLR3M': {id:'XLR3M',name:'XLR 3P Male',   short:'XLR3M',pins:3,type:'CIRC',cat:'Audio',builtin:true,
    pinout:[{id:1,n:'GND', sig:'GND',g:'24AWG',c:'#555'},{id:2,n:'HOT', sig:'AUD',g:'24AWG',c:'#e74c3c'},{id:3,n:'COLD',sig:'AUD',g:'24AWG',c:'#3498db'}]},
  'XLR3F': {id:'XLR3F',name:'XLR 3P Female', short:'XLR3F',pins:3,type:'CIRC',cat:'Audio',builtin:true,
    pinout:[{id:1,n:'GND', sig:'GND',g:'24AWG',c:'#555'},{id:2,n:'HOT', sig:'AUD',g:'24AWG',c:'#e74c3c'},{id:3,n:'COLD',sig:'AUD',g:'24AWG',c:'#3498db'}]},
  'MF2P':  {id:'MF2P', name:'Molex Micro-Fit 2P', short:'MF2P', pins:2, type:'RECT',cat:'Molex',pn:'43045-0200',builtin:true,
    pinout:[{id:1,n:'VCC',sig:'PWR',g:'22AWG',c:'#e74c3c'},{id:2,n:'GND',sig:'GND',g:'22AWG',c:'#555'}]},
  'MF4P':  {id:'MF4P', name:'Molex Micro-Fit 4P', short:'MF4P', pins:4, type:'RECT',cat:'Molex',pn:'43045-0400',builtin:true,
    pinout:[{id:1,n:'VCC', sig:'PWR', g:'20AWG',c:'#e74c3c'},{id:2,n:'GND', sig:'GND', g:'20AWG',c:'#555'},
            {id:3,n:'SIG1',sig:'DATA',g:'24AWG',c:'#3498db'},{id:4,n:'SIG2',sig:'DATA',g:'24AWG',c:'#27ae60'}]},
  'MF6P':  {id:'MF6P', name:'Molex Micro-Fit 6P', short:'MF6P', pins:6, type:'RECT',cat:'Molex',pn:'43045-0600',builtin:true, pinout:mkpins(6,'P','SIG','22AWG',60)},
  'MF8P':  {id:'MF8P', name:'Molex Micro-Fit 8P', short:'MF8P', pins:8, type:'RECT',cat:'Molex',pn:'43045-0800',builtin:true, pinout:mkpins(8,'P','SIG','22AWG',45)},
  'MF12P': {id:'MF12P',name:'Molex Micro-Fit 12P',short:'MF12P',pins:12,type:'RECT',cat:'Molex',pn:'43045-1200',builtin:true, pinout:mkpins(12,'P','SIG','22AWG',30)},
  'PH2P':  {id:'PH2P', name:'JST PH 2P', short:'PH2P',pins:2,type:'RECT',cat:'JST',pn:'B2B-PH-K-S',builtin:true,
    pinout:[{id:1,n:'VCC',sig:'PWR',g:'26AWG',c:'#e74c3c'},{id:2,n:'GND',sig:'GND',g:'26AWG',c:'#555'}]},
  'PH3P':  {id:'PH3P', name:'JST PH 3P', short:'PH3P',pins:3,type:'RECT',cat:'JST',pn:'B3B-PH-K-S',builtin:true,
    pinout:[{id:1,n:'VCC',sig:'PWR', g:'26AWG',c:'#e74c3c'},{id:2,n:'SIG',sig:'DATA',g:'26AWG',c:'#3498db'},{id:3,n:'GND',sig:'GND',g:'26AWG',c:'#555'}]},
  'XH2P':  {id:'XH2P', name:'JST XH 2P', short:'XH2P',pins:2,type:'RECT',cat:'JST',pn:'B2B-XH-A',builtin:true,
    pinout:[{id:1,n:'VCC',sig:'PWR',g:'24AWG',c:'#e74c3c'},{id:2,n:'GND',sig:'GND',g:'24AWG',c:'#555'}]},
  'XH4P':  {id:'XH4P', name:'JST XH 4P', short:'XH4P',pins:4,type:'RECT',cat:'JST',pn:'B4B-XH-A',builtin:true, pinout:mkpins(4,'P','SIG','24AWG',90)},
  'DT2P':  {id:'DT2P', name:'Deutsch DT 2P',short:'DT2P',pins:2,type:'CIRC',cat:'Deutsch',pn:'DT06-2S',builtin:true,
    pinout:[{id:1,n:'PWR',sig:'PWR',g:'16AWG',c:'#e74c3c'},{id:2,n:'GND',sig:'GND',g:'16AWG',c:'#555'}]},
  'DT4P':  {id:'DT4P', name:'Deutsch DT 4P',short:'DT4P',pins:4,type:'CIRC',cat:'Deutsch',pn:'DT06-4S',builtin:true,
    pinout:[{id:1,n:'PWR',sig:'PWR', g:'16AWG',c:'#e74c3c'},{id:2,n:'GND',sig:'GND', g:'16AWG',c:'#555'},
            {id:3,n:'SGA',sig:'ANLG',g:'22AWG',c:'#3498db'},{id:4,n:'SGB',sig:'ANLG',g:'22AWG',c:'#27ae60'}]},
  'DT6P':  {id:'DT6P', name:'Deutsch DT 6P',short:'DT6P',pins:6,type:'CIRC',cat:'Deutsch',pn:'DT06-6S',builtin:true,
    pinout:[{id:1,n:'PWR', sig:'PWR', g:'16AWG',c:'#e74c3c'},{id:2,n:'GND', sig:'GND', g:'16AWG',c:'#555'},
            {id:3,n:'SGA', sig:'ANLG',g:'22AWG',c:'#3498db'},{id:4,n:'SGB', sig:'ANLG',g:'22AWG',c:'#27ae60'},
            {id:5,n:'CANH',sig:'CAN', g:'22AWG',c:'#f39c12'},{id:6,n:'CANL',sig:'CAN', g:'22AWG',c:'#9b59b6'}]},
  'MIL13': {id:'MIL13',name:'MIL-38999 13P',short:'MIL13',pins:13,type:'CIRC',cat:'Military',builtin:true,
    pinout:['A','B','C','D','E','F','G','H','J','K','L','M','N'].map(function(l,i){return{id:l,n:l,sig:'SIG',g:'22AWG',c:hslc(i*28)};})},
  'MIL35': {id:'MIL35',name:'MIL-38999 35P',short:'MIL35',pins:35,type:'CIRC',cat:'Military',builtin:true,
    pinout:['A','B','C','D','E','F','G','H','J','K','L','M','N','P','R','S','T','U','V','W','X','Y','Z','a','b','c','d','e','f','g','h','j','k','m','n'].map(function(l,i){return{id:l,n:l,sig:'SIG',g:'22AWG',c:hslc(i*10)};})},
  'HDMI':  {id:'HDMI', name:'HDMI Type A',short:'HDMI',pins:19,type:'RECT',cat:'Video',builtin:true, pinout:mkpins(19,'P','HDMI','28AWG',19)}
};
