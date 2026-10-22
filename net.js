/* Live play for Phatake Bazaar outside claude.ai.
   Provides window.claude.use('room') on top of Supabase Realtime, with the same shape the game expects:
   room.presence(obj), room.peers(), room.onPeers(cb, onErr), room.join(name), channel.leave().
   Membership rides on Realtime presence (name only); position, crackers and chat ride on throttled broadcasts. */
(()=>{
"use strict";
if(window.claude&&window.claude.use)return;
// project and public anon key come from sb-config.js
const SB_URL=window.SB&&window.SB.url,SB_KEY=window.SB&&window.SB.key;
if(!SB_URL||!SB_KEY)return;
const LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const MIN_GAP=300;
const me=Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
let libP=null,client=null;
const loadLib=()=>libP||(libP=new Promise((res,rej)=>{if(window.supabase)return res(window.supabase);
  const s=document.createElement('script');s.src=LIB;s.async=true;
  s.onload=()=>window.supabase?res(window.supabase):rej(new Error('lib'));s.onerror=()=>{libP=null;rej(new Error('lib'));};document.head.appendChild(s);}));

function channel(name){
  const peers=new Map([[me,{peer:me,sameTab:true,presence:{}}]]);
  const subs=new Set();
  const ch=client.channel('phatake:'+(window.LAYOUT?'v'+LAYOUT.VERSION+':':'')+(name||'open'),{config:{presence:{key:me},broadcast:{self:false}}});
  let mine=null,tracked=null,lastSent=0,timer=null,closed=false,ready=false;
  const emit=chg=>{for(const s of subs)try{s.cb(chg);}catch(e){console.error(e);}};
  const fail=code=>{for(const s of subs)if(s.err)try{s.err({code});}catch(e){}};
  const addPeer=(key,pres)=>{let p=peers.get(key);if(p)return p;p={peer:key,sameTab:false,presence:pres||{}};peers.set(key,p);emit({joined:[p],left:[],updated:[]});return p;};
  const send=()=>{timer=null;if(closed||!ready||!mine)return;lastSent=Date.now();ch.send({type:'broadcast',event:'p',payload:{peer:me,presence:mine}}).catch(()=>{});};
  const schedule=now=>{if(timer)return;timer=setTimeout(send,now?0:Math.max(0,MIN_GAP-(Date.now()-lastSent)));};
  const retrack=()=>{if(!ready||!mine)return;const n=typeof mine.n==='string'?mine.n:'';if(tracked===n)return;tracked=n;ch.track({n}).catch(()=>{tracked=null;});};

  ch.on('presence',{event:'join'},({key,newPresences})=>{if(key===me||closed)return;const n=newPresences&&newPresences[0]&&newPresences[0].n;
    const p=peers.get(key);if(p){if(typeof n==='string'&&!p.presence.n){p.presence.n=n;emit({joined:[],left:[],updated:[p]});}}else addPeer(key,{n:typeof n==='string'?n:''});
    if(mine)schedule(true);});
  // re-tracking (e.g. a name change) sends a leave for the old entry; only drop peers with nothing left
  ch.on('presence',{event:'leave'},({key,currentPresences})=>{if(key===me||closed||(currentPresences&&currentPresences.length))return;const p=peers.get(key);if(!p)return;peers.delete(key);emit({joined:[],left:[p],updated:[]});});
  ch.on('broadcast',{event:'p'},({payload})=>{if(closed||!payload||typeof payload.peer!=='string'||payload.peer===me)return;
    const pres=payload.presence&&typeof payload.presence==='object'?payload.presence:{};
    const had=peers.has(payload.peer);const p=addPeer(payload.peer,pres);if(had){p.presence=pres;emit({joined:[],left:[],updated:[p]});}});

  const api={
    presence(obj){if(closed)return Promise.resolve();
      if(!obj||!obj.p){mine=null;if(tracked!==null){tracked=null;ch.untrack().catch(()=>{});}return Promise.resolve();}
      mine=obj;retrack();schedule(false);return Promise.resolve();},
    peers(){return Array.from(peers.values());},
    onPeers(cb,err){const s={cb,err};subs.add(s);return()=>subs.delete(s);},
    join(n){return channel(n);},
    leave(){closed=true;clearTimeout(timer);return client.removeChannel(ch).then(()=>{},()=>{});}
  };
  return new Promise((res,rej)=>{let first=true;
    const to=setTimeout(()=>{if(first){first=false;closed=true;client.removeChannel(ch);rej({code:'timeout'});}},10000);
    ch.subscribe(status=>{
      if(status==='SUBSCRIBED'){ready=true;if(first){first=false;clearTimeout(to);res(api);}else{tracked=null;retrack();schedule(true);}}
      else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){ready=false;if(first){first=false;clearTimeout(to);closed=true;client.removeChannel(ch);rej({code:'error'});}else fail('error');}
      else if(status==='CLOSED')ready=false;});});
}

window.claude={use(name){if(name!=='room')return Promise.resolve(null);
  return loadLib().then(lib=>{if(!client)client=lib.createClient(SB_URL,SB_KEY,{auth:{persistSession:false,autoRefreshToken:false},realtime:{params:{eventsPerSecond:10}}});return channel('');});}};
})();
