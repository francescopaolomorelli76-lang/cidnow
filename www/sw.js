// Service worker: l'app si apre e funziona anche senza rete (sul luogo dell'incidente).
const CACHE = "cidnow-0.4.0";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png",
  "data/comuni.json", "modulo-cai.pdf", "vendor/pdf-lib.min.js", "vendor/jspdf.umd.min.js", "vendor/qrcode.js", "vendor/jsQR.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.hostname.includes("nominatim") || u.hostname.includes("photon")) return; // l'indirizzo dal GPS va sempre chiesto in rete
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && (u.origin === location.origin || u.hostname.endsWith("gstatic.com") || u.hostname.endsWith("googleapis.com"))) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
    return res; }).catch(() => caches.match("index.html"))));
});
