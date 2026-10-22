/* Brand placements for Phatake Bazaar: loads the live campaigns, caches them, and picks one brand per slot per visit.
   The game only draws; everything about which brand goes where lives here and in Supabase (see the admin page). */
(function(root){
"use strict";
const ADS_KEY='pb_ads',PICKS_KEY='pb_ad_picks';

// weighted by share (1-10); null when nothing is live
function pick(list,rnd){if(!list||!list.length)return null;let r=rnd()*list.reduce((t,c)=>t+(c.share||1),0);
  for(const c of list){r-=c.share||1;if(r<0)return c;}return list[list.length-1];}

// one campaign per switched-on slot; a pick saved earlier in this tab sticks while it is still live
function choose(data,saved,rnd){const slots={},next={};
  for(const s of (data&&data.slots)||[]){const live=((data.campaigns)||[]).filter(c=>c.slot_id===s.id);
    const c=live.find(c=>c.id===saved[s.id])||pick(live,rnd);slots[s.id]={kind:s.kind,campaign:c||null};if(c)next[s.id]=c.id;}
  return {slots,saved:next};}

const readJSON=(st,k,d)=>{try{const v=st&&st.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}};
const writeJSON=(st,k,v)=>{try{st&&st.setItem(k,JSON.stringify(v));}catch(e){}};
function webStore(name){try{return root[name];}catch(e){return null;}}

function fetchAdsDefault(){const SB=root.SB;if(!SB||!SB.url)return Promise.reject(new Error('no config'));
  return fetch(SB.url+'/rest/v1/rpc/bazaar_ads',{method:'POST',headers:{apikey:SB.key,Authorization:'Bearer '+SB.key,'Content-Type':'application/json'},body:'{}'})
    .then(r=>{if(!r.ok)throw new Error('http '+r.status);return r.json();});}

// onData(state) right away from the cache if there is one, then again only if the fresh answer changes what is shown.
// state is {slots:{id:{kind,campaign}}}, or null when there is nothing to go on (the game then shows Diwali art).
function start(onData,opts={}){
  const storage=opts.storage||webStore('localStorage'),session=opts.session||webStore('sessionStorage');
  const rnd=opts.rnd||Math.random,fetchAds=opts.fetchAds||fetchAdsDefault,timeoutMs=opts.timeoutMs||4000;
  let saved=readJSON(session,PICKS_KEY,{})||{},shown=null;
  const show=data=>{const st=choose(data,saved,rnd);saved=st.saved;writeJSON(session,PICKS_KEY,saved);
    const key=JSON.stringify(st.slots);if(key===shown)return;shown=key;onData({slots:st.slots});};
  const cached=readJSON(storage,ADS_KEY,null);
  const usable=d=>d&&Array.isArray(d.slots)&&Array.isArray(d.campaigns);
  if(usable(cached))show(cached);
  let timer;
  const late=new Promise((_,rej)=>{timer=setTimeout(()=>rej(new Error('timeout')),timeoutMs);});
  Promise.race([Promise.resolve().then(fetchAds),late]).then(data=>{clearTimeout(timer);if(!usable(data))throw new Error('bad data');
      writeJSON(storage,ADS_KEY,data);show(data);})
    .catch(()=>{clearTimeout(timer);if(shown===null){shown='null';onData(null);}});
}

const BRANDS={pick,choose,start};
if(typeof module!=='undefined'&&module.exports)module.exports=BRANDS;else root.BRANDS=BRANDS;
})(typeof window!=='undefined'?window:globalThis);
