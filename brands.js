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
  let saved=readJSON(session,PICKS_KEY,{})||{},shown=null,last=null,forced=null;
  const show=data=>{last=data;const st=choose(data,saved,rnd);saved=st.saved;writeJSON(session,PICKS_KEY,saved);
    // an admin preview sits on its slot even when the slot is off or the campaign isn't live yet
    if(forced){const {kind,...c}=forced;st.slots[c.slot_id]={kind,campaign:c};}
    const key=JSON.stringify(st.slots);if(key===shown)return;shown=key;onData({slots:st.slots});};
  const cached=readJSON(storage,ADS_KEY,null);
  const usable=d=>d&&Array.isArray(d.slots)&&Array.isArray(d.campaigns);
  if(usable(cached))show(cached);
  if(opts.fetchPreview)Promise.resolve().then(opts.fetchPreview).then(pc=>{if(pc&&pc.slot_id){forced=pc;show(last||{slots:[],campaigns:[]});}}).catch(()=>{});
  // after the timeout the game falls back to Diwali art, but a late answer still replaces it
  const fallback=()=>{clearTimeout(timer);if(shown===null){shown='null';onData(null);}};
  const timer=setTimeout(fallback,timeoutMs);
  Promise.resolve().then(fetchAds).then(data=>{if(!usable(data))throw new Error('bad data');clearTimeout(timer);
      writeJSON(storage,ADS_KEY,data);show(data);})
    .catch(fallback);
}

/* views and clicks: once per campaign per visit, sent to the track function every 30s and when the page is left.
   Nothing is counted during an admin preview. */
const MAX_BATCH=50,FLUSH_MS=30000;
function create(env){
  const previewId=new URLSearchParams(env.search||'').get('preview'),previewing=!!(previewId&&env.token);
  let visit=null;try{visit=env.session&&env.session.getItem('pb_visit');}catch(e){}
  if(!visit||visit.length<8||visit.length>40){visit=Math.random().toString(36).slice(2,10)+Date.now().toString(36);try{env.session.setItem('pb_visit',visit);}catch(e){}}
  const q=[],done=new Set();
  const queue=(id,t)=>{if(previewing||!id||done.has(t+id))return;done.add(t+id);q.push({c:id,t});};
  const flush=all=>{do{if(!q.length)return;const events=q.splice(0,MAX_BATCH);
    try{env.beacon(env.url,new Blob([JSON.stringify({visit,events})],{type:'text/plain'}));}catch(e){}}while(all);};
  env.setInterval(()=>flush(false),FLUSH_MS);
  env.onPageHide(()=>flush(true));
  const T={visit,previewing,
    seen:id=>queue(id,'v'),clicked:id=>queue(id,'c'),
    open(c){if(!c||typeof c.link!=='string'||!/^https:\/\//.test(c.link))return false;T.clicked(c.id);env.openWin(c.link);return true;},
    flush:()=>flush(true),
    start:(onData,opts={})=>start(onData,Object.assign({},opts,{fetchPreview:previewing?()=>env.fetchPreview(previewId,env.token):null}))};
  return T;}

// the browser wiring: real storage, sendBeacon, and the admin's Supabase session for previews
function browserEnv(){const SB=root.SB||{},ref=(()=>{try{return new URL(SB.url).hostname.split('.')[0];}catch(e){return '';}})();
  let token=null;try{const s=JSON.parse(root.localStorage.getItem('sb-'+ref+'-auth-token')||'null');token=s&&s.access_token||null;}catch(e){}
  return {session:webStore('sessionStorage'),url:(SB.url||'')+'/functions/v1/track',search:root.location?root.location.search:'',token,
    beacon:(u,b)=>root.navigator.sendBeacon(u,b),setInterval:(f,ms)=>root.setInterval(f,ms),
    onPageHide:f=>root.addEventListener('pagehide',f),openWin:u=>root.open(u,'_blank','noopener'),
    fetchPreview:(id,tok)=>fetch(SB.url+'/rest/v1/campaigns?id=eq.'+encodeURIComponent(id)+'&select=id,brand,slot_id,link,art,lines,share,slots(kind)',
        {headers:{apikey:SB.key,Authorization:'Bearer '+tok}}).then(r=>r.ok?r.json():[])
      .then(rows=>{const c=rows[0];if(!c||!c.slots)return null;const {slots,...rest}=c;return Object.assign(rest,{kind:slots.kind});})};}

const BRANDS={pick,choose,start,create};
if(typeof module==='undefined'&&root.document)Object.assign(BRANDS,create(browserEnv()));
if(typeof module!=='undefined'&&module.exports)module.exports=BRANDS;else root.BRANDS=BRANDS;
})(typeof window!=='undefined'?window:globalThis);
