/* The map of Phatake Bazaar: where everything stands, and the walking rules that follow from it.
   Pure data and functions (no three.js, no DOM), so Node can test them. The game only draws what is here. */
(function(root){
"use strict";
const VERSION=2;
const C={x:0,z:-64};
const RING={stall:49,front:46.7,walk:45.7,maid:29,path:30.6,pathOut:50.8};
const TRAIN={r0:31,r1:35};// kept clear for the Toy Train (part 2)
const NPC_BAND={r0:37,r1:44.5,lanes:[43,39.5]};
const SLOTS=30;
// what stands in each ring slot, k=0 at the lane opening, counting round through the west side
const ORDER=[null,'Sharma Fireworks','Pappu Chaat','Momo Point','Laxmi Patakha','Chudi Bazaar','Mehendi Corner','Ring Phenko','Dabba Giraao',
  'Jalebi Junction','Bombay Pav Bhaji','Diya Ghar','kollabkit','Sivakasi Wale','cart',null,'cart','Mishra Halwai','brand:stall-ring-b','Kismat Chakra',
  'Bioscope','Kulfi Wala','Ganne ka Ras','Gubbare Phodo','Photo Studio','Khilona Ghar','Akash Kandil','Raja Rockets','Raju Chai','Gupta Crackers'];
const ENTRY={hx:6.4,z1:10},SPAWN={x:0,z:8},GATE={z:-14.6,hx:7},NORTH={hx:7.6,z0:-124};
const JG={x0:-68,x1:68,z0:-219,z1:-121},BOUNDS={x0:-70,x1:70,z0:-221,z1:12};
const WHEEL={x:0,z:-127,hx:4.6,hz:1.6};
const RIDES={carousel:{x:-48,z:-144,r:4},columbus:{x:-45,z:-196,hx:5.8,hz:2},chairs:{x:0,z:-201,r:5.6}};
const PLOTS=[{id:'breakdance',name:'Break Dance',hi:'ब्रेक डांस',x:-23,z:-166,w:18,d:18},{id:'mautkakuan',name:'Maut ka Kuan',hi:'मौत का कुआँ',x:23,z:-164,w:20,d:20},
  {id:'droptower',name:'Drop Tower',hi:'ड्रॉप टावर',x:55,z:-140,w:10,d:10},{id:'dodgem',name:'Bumper Cars',hi:'बंपर कार',x:44,z:-198,w:24,d:16}];
const OPEN_PLOTS=[{x:-55,z:-168,w:14,d:14},{x:55,z:-166,w:14,d:14},{x:-22,z:-211,w:14,d:14}];
const KK={k:12,entry:{x:10.5,z:-4,ry:-.7,w:4.4},jhoola:{x:-40,z:-214,ry:.25,w:6.4}};
const BRAND={'stall-ring-b':{kind:'premium_stall',k:18},'hoarding-entry-b':{kind:'hoarding',x:-10.5,z:-4,ry:.7,w:4.4}};
const BW={x:-24.7,z:-35.2},DHOL={x:12,z:-28};

// slot k's spot at radius r; ry turns a group so its +z faces the ring centre, as the stalls are built
function slotAt(k,r){const a=Math.PI/2+k*2*Math.PI/SLOTS;return{x:C.x+Math.cos(a)*r,z:C.z+Math.sin(a)*r,ry:Math.atan2(-Math.cos(a),-Math.sin(a)),a};}

const KINDS=['chana','bhutta','gola','buddhi'];
const CARTS=(()=>{const out=[],add=(x,z,ry)=>out.push({x,z,ry,kind:KINDS[out.length%KINDS.length]});
  for(const k of [14,16]){const s=slotAt(k,RING.stall-.6);add(s.x,s.z,s.ry);}
  add(-9,4,Math.PI/2);add(9,4,-Math.PI/2);
  for(let x=-48;x<=48;x+=8)add(x,-181,0);
  for(let x=-30;x<=30;x+=8)add(x,-149,0);
  return out;})();
const BRAND_CART=(()=>{const s=slotAt(18,RING.stall-.6);return{x:s.x,z:s.z,ry:s.ry,kind:'chana'};})();

const inLane=(x,z)=>Math.abs(x)<ENTRY.hx&&z>C.z+RING.walk-2.5&&z<ENTRY.z1;
const inCorridor=(x,z)=>Math.abs(x)<NORTH.hx&&z<C.z-RING.walk+2.5&&z>NORTH.z0;
const inJG=(x,z)=>x>JG.x0&&x<JG.x1&&z>JG.z0&&z<JG.z1;
function zoneAt(x,z){const r=Math.hypot(x-C.x,z-C.z);if(r<RING.walk)return r<RING.maid?'maidan':'ring';
  if(inLane(x,z))return 'lane';if(inCorridor(x,z))return 'corridor';if(inJG(x,z))return 'jhoola';return 'outside';}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function clampToMap(x,z){return{x:clamp(x,BOUNDS.x0,BOUNDS.x1),z:clamp(z,BOUNDS.z0,BOUNDS.z1)};}
function clampToMaidan(x,z){const dx=x-C.x,dz=z-C.z,r=Math.hypot(dx,dz);if(r<=RING.maid)return{x,z};return{x:C.x+dx/r*RING.maid,z:C.z+dz/r*RING.maid};}

const LAYOUT={VERSION,C,RING,TRAIN,NPC_BAND,SLOTS,ORDER,ENTRY,SPAWN,GATE,NORTH,JG,BOUNDS,WHEEL,RIDES,PLOTS,OPEN_PLOTS,CARTS,BRAND_CART,KK,BRAND,BW,DHOL,
  slotAt,zoneAt,clampToMap,clampToMaidan};
if(typeof module!=='undefined'&&module.exports)module.exports=LAYOUT;else root.LAYOUT=LAYOUT;
})(typeof window!=='undefined'?window:globalThis);
