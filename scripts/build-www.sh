#!/usr/bin/env bash
# Crea www/: app web installabile (PWA) per iPhone/Android e base per Capacitor.
set -e
cd "$(dirname "$0")/.."
rm -rf www && mkdir -p www/data www/vendor
cp src/data/comuni.json www/data/
cp -r vendor/* www/vendor/
cp assets/modulo-cai.pdf www/modulo-cai.pdf
cp assets/icon.svg www/icon.svg && cp assets/icon.svg src/icon.svg
cp assets/icon-180.png www/apple-touch-icon.png
cp assets/icon-192.png assets/icon-512.png www/
VER=$(grep -o 'version: "[0-9.]*"' src/app.html | grep -o '[0-9.]*')
# librerie locali al posto dei CDN (funziona offline)
sed -e 's#https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js#vendor/jspdf.umd.min.js#' \
    -e 's#https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js#vendor/pdf-lib.min.js#' \
    -e 's#https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js#vendor/qrcode.js#' \
    -e 's#https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js#vendor/jsQR.js#' src/app.html > /tmp/cidnow-body.html
{
  printf '<!doctype html><html lang="it"><head><meta charset="utf-8">'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  printf '<meta name="theme-color" content="#0A0E17"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
  printf '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="CIDnow">'
  printf '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg"><link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png?v=%s">' "$VER"
  printf '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-size:14px;font-family:system-ui,sans-serif}img{max-width:100%%}[hidden]{display:none!important}</style></head><body>\n'
  cat /tmp/cidnow-body.html
  printf '\n</body></html>\n'
} > www/index.html
cat > www/manifest.webmanifest <<JSON
{
  "name": "CIDnow - Constatazione amichevole",
  "short_name": "CIDnow",
  "lang": "it",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0A0E17",
  "theme_color": "#0A0E17",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
JSON
cat > www/sw.js <<JS
// Service worker: l'app si apre e funziona anche senza rete (sul luogo dell'incidente).
const CACHE = "cidnow-$VER";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png",
  "data/comuni.json", "modulo-cai.pdf", "vendor/pdf-lib.min.js", "vendor/jspdf.umd.min.js", "vendor/qrcode.js", "vendor/jsQR.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || (u.origin !== location.origin && !u.hostname.endsWith("gstatic.com") && !u.hostname.endsWith("googleapis.com"))) return; // GPS, vie e modello vocale: rete diretta // l'indirizzo dal GPS va sempre chiesto in rete
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && (u.origin === location.origin || u.hostname.endsWith("gstatic.com") || u.hostname.endsWith("googleapis.com"))) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
    return res; }).catch(() => caches.match("index.html"))));
});
JS
touch www/.nojekyll
echo "www/ creata (versione $VER)"
