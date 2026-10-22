/* The map of Phatake Bazaar: where everything stands, and the walking rules that follow from it.
   Pure data and functions (no three.js, no DOM), so Node can test them. The game only draws what is here. */
(function(root){
"use strict";
const VERSION=2;
const C={x:0,z:-32};
const RING={stall:31,front:28.7,walk:27.7,maid:18,path:19,pathOut:32.8};
const NPC_BAND={r0:20,r1:27,lanes:[26,23.5]};
const SLOTS=20;
// what stands in each ring slot, k=0 at the lane opening, counting round through the west side; the corridor opens at k=10
const ORDER=[null,'Sharma Fireworks','Pappu Chaat','Laxmi Patakha','Chudi Bazaar','Ring Phenko','Jalebi Junction','Diya Ghar','kollabkit','Sivakasi Wale',
  null,'Mishra Halwai','brand:stall-ring-b','Kismat Chakra','Kulfi Wala','Gubbare Phodo','Khilona Ghar','Raja Rockets','Raju Chai','Gupta Crackers'];
const ENTRY={hx:4,z1:10},SPAWN={x:0,z:8},GATE={z:-.6,hx:4.6},NORTH={hx:5,z0:-71};
const JG={x0:-43,x1:43,z0:-118,z1:-68},BOUNDS={x0:-45,x1:45,z0:-120,z1:12};
const WHEEL={x:0,z:-74,hx:4.6,hz:1.6};
// Maut ka Kuan: a wooden well (inner radius 8) with a gallery round the rim, and a straight stair up its south side
const MAUT={x:24,z:-96,r:10,well:8,stairs:{x:24,z:-85.1,hx:4.8,hz:.9}};
const RIDES={carousel:{x:-30,z:-84,r:4},columbus:{x:-30,z:-108,hx:5.8,hz:2},chairs:{x:-8,z:-106,r:5.6},maut:{x:MAUT.x,z:MAUT.z,r:MAUT.r}};
const KK={k:8,entry:{x:7,z:1.5,ry:-.7,w:4.4},jhoola:{x:-14,z:-116.5,ry:.2,w:6.4}};
const BRAND={'stall-ring-b':{kind:'premium_stall',k:12},'hoarding-entry-b':{kind:'hoarding',x:-7,z:1.5,ry:.7,w:4.4}};
const BW={x:-15.4,z:-13.6},DHOL={x:7.8,z:-9.3};

// slot k's spot at radius r; ry turns a group so its +z faces the ring centre, as the stalls are built
function slotAt(k,r){const a=Math.PI/2+k*2*Math.PI/SLOTS;return{x:C.x+Math.cos(a)*r,z:C.z+Math.sin(a)*r,ry:Math.atan2(-Math.cos(a),-Math.sin(a)),a};}

const inLane=(x,z)=>Math.abs(x)<ENTRY.hx&&z>C.z+RING.walk-2.5&&z<ENTRY.z1;
const inCorridor=(x,z)=>Math.abs(x)<NORTH.hx&&z<C.z-RING.walk+2.5&&z>NORTH.z0;
const inJG=(x,z)=>x>JG.x0&&x<JG.x1&&z>JG.z0&&z<JG.z1;
function zoneAt(x,z){const r=Math.hypot(x-C.x,z-C.z);if(r<RING.walk)return r<RING.maid?'maidan':'ring';
  if(inLane(x,z))return 'lane';if(inCorridor(x,z))return 'corridor';if(inJG(x,z))return 'jhoola';return 'outside';}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function clampToMap(x,z){return{x:clamp(x,BOUNDS.x0,BOUNDS.x1),z:clamp(z,BOUNDS.z0,BOUNDS.z1)};}
function clampToMaidan(x,z){const dx=x-C.x,dz=z-C.z,r=Math.hypot(dx,dz);if(r<=RING.maid)return{x,z};return{x:C.x+dx/r*RING.maid,z:C.z+dz/r*RING.maid};}

/* ---- walking ---- */
function walkable(x,z){const r=Math.hypot(x-C.x,z-C.z);if(r<RING.walk)return r>.6;return inLane(x,z)||inCorridor(x,z)||inJG(x,z);}
const inBox=(x,z,b,hx,hz)=>Math.abs(x-b.x)<hx&&Math.abs(z-b.z)<hz;
function blocked(x,z){if(inBox(x,z,WHEEL,WHEEL.hx,WHEEL.hz))return true;
  for(const k in RIDES){const r=RIDES[k];if(r.r?Math.hypot(x-r.x,z-r.z)<r.r:inBox(x,z,r,r.hx,r.hz))return true;}
  const st=MAUT.stairs;return inBox(x,z,st,st.hx,st.hz);}
const open=(x,z)=>walkable(x,z)&&!blocked(x,z);
// room for a body: open here and 0.45 m away in four directions
const roomy=(x,z)=>open(x,z)&&open(x+.45,z)&&open(x-.45,z)&&open(x,z+.45)&&open(x,z-.45);

/* ---- routing: A* on a 1 m grid over the whole map, then cut corners where the way is clear ---- */
const GW=Math.round(BOUNDS.x1-BOUNDS.x0),GH=Math.round(BOUNDS.z1-BOUNDS.z0);
let GRID=null;
const cx=i=>BOUNDS.x0+.5+i,cz=j=>BOUNDS.z0+.5+j;
function grid(){if(GRID)return GRID;GRID=new Uint8Array(GW*GH);for(let j=0;j<GH;j++)for(let i=0;i<GW;i++)GRID[j*GW+i]=roomy(cx(i),cz(j))?1:0;return GRID;}
const cellOf=(x,z)=>{const i=Math.floor(x-BOUNDS.x0),j=Math.floor(z-BOUNDS.z0);return i<0||j<0||i>=GW||j>=GH?-1:j*GW+i;};
// the nearest open cell to a point, searching outward ring by ring
function nearestOpen(x,z){const g=grid(),i0=Math.floor(x-BOUNDS.x0),j0=Math.floor(z-BOUNDS.z0);let best=-1,bd=1e9;
  for(let rad=0;rad<12&&best<0;rad++)for(let j=j0-rad;j<=j0+rad;j++)for(let i=i0-rad;i<=i0+rad;i++){
    if(Math.max(Math.abs(i-i0),Math.abs(j-j0))!==rad||i<0||j<0||i>=GW||j>=GH||!g[j*GW+i])continue;
    const d=Math.hypot(cx(i)-x,cz(j)-z);if(d<bd){bd=d;best=j*GW+i;}}
  return best;}
// a straight leg is clear when every 0.25 m sample has room, except close to its own ends, which need only be open and off the pole
function clear(a,b){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.25));
  for(let k=0;k<=n;k++){const x=a.x+(b.x-a.x)*k/n,z=a.z+(b.z-a.z)*k/n;
    const end=Math.hypot(x-a.x,z-a.z)<.75||Math.hypot(x-b.x,z-b.z)<.75;
    if(end?!open(x,z)||Math.hypot(x-C.x,z-C.z)<1:!roomy(x,z))return false;}
  return true;}
const G=new Float64Array(GW*GH),F=new Float64Array(GW*GH),FROM=new Int32Array(GW*GH),SEEN=new Uint32Array(GW*GH),SHUT=new Uint32Array(GW*GH);let GEN=0;
const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
function astar(s,t){const g=grid();GEN++;const ti=t%GW,tj=(t/GW)|0,h=c=>{const dx=Math.abs(c%GW-ti),dy=Math.abs(((c/GW)|0)-tj);return dx+dy+(Math.SQRT2-2)*Math.min(dx,dy);};
  const heap=[s];G[s]=0;F[s]=h(s);FROM[s]=-1;SEEN[s]=GEN;
  const up=k=>{const v=heap[k];while(k){const p=(k-1)>>1;if(F[heap[p]]<=F[v])break;heap[k]=heap[p];k=p;}heap[k]=v;};
  const down=k=>{const v=heap[k],n=heap.length;for(;;){let c=2*k+1;if(c>=n)break;if(c+1<n&&F[heap[c+1]]<F[heap[c]])c++;if(F[heap[c]]>=F[v])break;heap[k]=heap[c];k=c;}heap[k]=v;};
  while(heap.length){const c=heap[0],last=heap.pop();if(heap.length){heap[0]=last;down(0);}
    if(SHUT[c]===GEN)continue;SHUT[c]=GEN;if(c===t)break;const i=c%GW,j=(c/GW)|0;
    for(const [di,dj,w] of NB){const ni=i+di,nj=j+dj;if(ni<0||nj<0||ni>=GW||nj>=GH)continue;const n=nj*GW+ni;if(!g[n]||SHUT[n]===GEN)continue;
      if(di&&dj&&(!g[j*GW+ni]||!g[nj*GW+i]))continue;// no cutting past a corner
      const ng=G[c]+w;if(SEEN[n]===GEN&&ng>=G[n])continue;SEEN[n]=GEN;G[n]=ng;F[n]=ng+h(n);FROM[n]=c;heap.push(n);up(heap.length-1);}}
  if(SHUT[t]!==GEN)return null;const out=[];for(let c=t;c>=0;c=FROM[c])out.push({x:cx(c%GW),z:cz((c/GW)|0)});return out.reverse();}
// waypoints between two spots (start and target left out); empty when the straight line is already clear
function route(fx,fz,tx,tz){const a={x:fx,z:fz},b={x:tx,z:tz};if(clear(a,b))return[];
  const g=grid();let s=cellOf(fx,fz),t=cellOf(tx,tz);if(s<0||!g[s])s=nearestOpen(fx,fz);if(t<0||!g[t])t=nearestOpen(tx,tz);if(s<0||t<0)return[];
  const cells=astar(s,t);if(!cells)return[];
  const pts=[a,...cells,b],out=[];let i=0;
  while(i<pts.length-1){let j=pts.length-1;while(j>i+1&&!clear(pts[i],pts[j]))j--;if(j<pts.length-1)out.push(pts[j]);i=j;}
  return out;}
// where a tap off the walkable ground should lead: the nearest open spot, or the ring's edge when nothing is close
function nearestWalkable(x,z){if(open(x,z))return{x,z};const q=clampToMap(x,z),c=nearestOpen(q.x,q.z);
  if(c>=0)return{x:cx(c%GW),z:cz((c/GW)|0)};const dx=x-C.x,dz=z-C.z,r=Math.hypot(dx,dz)||1;return{x:C.x+dx/r*(RING.walk-.5),z:C.z+dz/r*(RING.walk-.5)};}

const LAYOUT={VERSION,C,RING,NPC_BAND,SLOTS,ORDER,ENTRY,SPAWN,GATE,NORTH,JG,BOUNDS,WHEEL,MAUT,RIDES,KK,BRAND,BW,DHOL,
  slotAt,zoneAt,clampToMap,clampToMaidan,walkable,blocked,route,nearestWalkable};
if(typeof module!=='undefined'&&module.exports)module.exports=LAYOUT;else root.LAYOUT=LAYOUT;
})(typeof window!=='undefined'?window:globalThis);
