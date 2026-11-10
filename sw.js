// Life Planner – Offline-Unterstützung
const CACHE="lifeplanner-v5";
const CORE=["./","./index.html","./manifest.webmanifest","./icon-180.png","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;
  const url=new URL(req.url);
  // Nur App-Dateien, Schriften und Firebase-Bibliothek cachen – niemals die Datenbank-Verbindung
  const ok=url.origin===location.origin||["fonts.googleapis.com","fonts.gstatic.com","www.gstatic.com"].includes(url.hostname);
  if(!ok)return;
  // App-Seite: erst online (für Updates), sonst aus dem Speicher
  if(req.mode==="navigate"||url.pathname.endsWith("index.html")){
    e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put("./index.html",cp));return r;}).catch(()=>caches.match("./index.html")));return;}
  // Schriften & Dateien: aus dem Speicher, sonst laden und merken
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r.ok||r.type==="opaque"){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return r;})));
});
