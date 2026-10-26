// Cache offline: l'app funziona anche senza rete (i dati si aggiornano quando torna la connessione)
const V = 'mangiare-dormire-v1';
const FILE = ['./', 'index.html', 'style.css', 'app.js', 'data/dati.json', 'vendor/leaflet.js', 'vendor/leaflet.css', 'vendor/qrcode.js', 'icons/icon.svg', 'note-legali.html'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(FILE))));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x))))));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  // rete prima, cache come riserva: così i dati restano aggiornati
  e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(V).then((c) => c.put(e.request, cp)); return r; })
    .catch(() => caches.match(e.request)));
});
