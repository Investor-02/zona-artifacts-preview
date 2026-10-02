const CACHE='mayak-854ef7c0ebc1',ART='mayak-art-v2',BASE="/zona-artifacts-preview/",SHELL=["/zona-artifacts-preview/","/zona-artifacts-preview/index.html","/zona-artifacts-preview/app-icon.png","/zona-artifacts-preview/manifest.webmanifest","/zona-artifacts-preview/pda-condensed.938869f81aebc7067340edad3ead7408.ttf","/zona-artifacts-preview/_expo/static/js/web/index-cf53e955a36950fbd7b2082b057a9d8d.js"];
const pending=new Map();let writes=Promise.resolve();
const immutable=url=>url.pathname.startsWith(BASE)&&/[/.-][a-f0-9]{32}\.(png|jpg|jpeg|webp|js|ttf|m4a|mp3|wav)$/.test(url.pathname);
async function cached(name,request){try{return await (await caches.open(name)).match(request);}catch{return undefined;}}
function save(name,request,response){
  if(!response.ok)return Promise.resolve();
  const copy=response.clone();
  writes=writes.then(async()=>{try{const c=await caches.open(name);
    try{await c.put(request,copy);}catch{if(name!==ART)return;
      // Phone quota can be smaller than our entry limit. Recover space, retry once.
      const old=await c.keys();for(const key of old.slice(0,8))await c.delete(key);
      await c.put(request,response.clone());
    }
    if(name===ART){const keys=await c.keys();for(const key of keys.slice(0,Math.max(0,keys.length-96)))await c.delete(key);}
  }catch{/* Storage disabled/full: network and gameplay must still work. */}});
  return writes;
}
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{})));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mayak-')&&k!==CACHE&&k!==ART).map(k=>caches.delete(k)))).catch(()=>{})));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
  // Register lifetime work synchronously (before awaits); cache writes may outlive the response.
  let finish;const work=[];const done=new Promise(resolve=>{finish=resolve;});e.waitUntil(done);
  e.respondWith((async()=>{
    try{
      if(immutable(url)){
        const hit=await cached(ART,e.request)||await cached(CACHE,e.request);if(hit)return hit;
        let download=pending.get(url.href);
        if(!download){download=fetch(e.request).then(response=>{
          const write=save(ART,e.request,response);work.push(write);
          write.finally(()=>pending.delete(url.href));return response;
        },error=>{pending.delete(url.href);throw error;});pending.set(url.href,download);}
        return (await download).clone();
      }
      // HTML/manifest/non-hashed files stay fresh. Offline: use exact entry or cached shell.
      try{const response=await fetch(e.request);work.push(save(CACHE,e.request,response));return response;}
      catch{return await cached(CACHE,e.request)||(e.request.mode==='navigate'?await cached(CACHE,BASE+'index.html'):undefined)||Response.error();}
    }finally{Promise.all(work).then(finish,finish);}
  })());
});