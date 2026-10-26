/* Mangiare e dormire in Mugello — mappa di alloggi e locali (stessa base di Salute Mugello) */
(function () {
  'use strict';

  const CENTRO = [44.0, 11.43], ZOOM = 10;
  // contatore dei clic senza cookie (Chiama / Portami qui / Sito): indirizzo da impostare quando il servizio è attivo
  const CONTATORE = '';

  const ICONE = {
    albergo: '<path d="M3 20V5h2v9h6V8h7a3 3 0 013 3v9h-2v-3H5v3zm4-8a2 2 0 110-4 2 2 0 010 4z"/>',
    bb: '<path d="M12 3l9.5 8.5H18.5V21h-5v-6h-3v6h-5v-9.5H2.5z"/>',
    agriturismo: '<path d="M4 21V11l8-6 8 6v10h-5v-5H9v5zM12 2c1 1.5 3 2 5 1.5-.5 2-2 3.5-5 3.5z"/>',
    campeggio: '<path d="M12 3l10 17H2zm0 6l-4.5 9h9z" fill-rule="evenodd"/>',
    rifugio: '<path d="M2 21l7-13 3 5 3-4 7 12zM9 3l1.5 3h-3z"/>',
    ristorante: '<path d="M7 2h2v7a2 2 0 01-1 1.7V22H6V10.7A2 2 0 015 9V2h2v6h0zm8 0c2.5 0 4 2.5 4 6s-1.2 4-2 4.5V22h-2z"/>',
    pizzeria: '<path d="M12 2c4.5 0 8.5 1.6 10 3.5L12 22 2 5.5C3.5 3.6 7.5 2 12 2zm-2 6a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm4.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" fill-rule="evenodd"/>',
    bar: '<path d="M3 4h15v3h1.5a2.5 2.5 0 010 5H18c-.5 4-3.5 7-7.5 7S3.5 16 3 12zm15 5v1h1.5a.5.5 0 000-1zM2 20h17v2H2z"/>',
    agristoro: '<path d="M12 2c3 3 4 6 3 9h4l-7 11L5 11h4c-1-3 0-6 3-9z"/>'
  };
  const COLORE = { dormire: ['#2b4c7e', '#1b3358'], mangiare: ['#c0562b', '#8c3a17'] };
  const GRUPPO = { dormire: 'Dormire', mangiare: 'Mangiare' };
  const svg = (cat) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONE[cat] || ICONE.bb}</svg>`;
  const goccia = (cat, gr) => `<svg viewBox="0 0 34 46"><path d="M17 45C17 45 2 27.5 2 17a15 15 0 0130 0C32 27.5 17 45 17 45z" fill="${COLORE[gr][0]}" stroke="#fff" stroke-width="2"/><circle cx="17" cy="17" r="10" fill="#fff"/><g transform="translate(9 9) scale(.667)" fill="${COLORE[gr][1]}">${ICONE[cat] || ICONE.bb}</g></svg>`;

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const telHref = (n) => 'tel:' + n.replace(/[^\d+]/g, '');
  const urlSito = (s) => /^https?:\/\//.test(s) ? s : 'https://' + s;

  let D, mappa, markers = {}, stato = { q: '', comune: '', cat: '', gruppo: '', sel: '' };

  // ---------- avvio ----------
  fetch('data/dati.json').then((r) => r.json()).then((d) => {
    D = d;
    D.catById = Object.fromEntries(D.categorie.map((c) => [c.id, c]));
    D.byId = Object.fromEntries(D.strutture.map((s) => [s.id, s]));
    D.strutture.forEach((s) => {
      s._mappa = s.livello_posizione !== 'comune';  // senza indirizzo trovato: solo nell'elenco
      s._txt = norm([s.nome, s.comune, s.localita, s.indirizzo, s.tipo, s.cucina, D.catById[s.categoria].nome, GRUPPO[s.gruppo], ...s.servizi].join(' '));
    });
    $('#agg').textContent = new Date(D.aggiornato).toLocaleDateString('it-IT');
    initMappa();
    leggiHash();
    render();
    if (!location.hash) vistaIniziale();
    initEventi();
  });

  // ---------- mappa ----------
  function initMappa() {
    mappa = L.map('mappa', { zoomControl: true, tap: true }).setView(CENTRO, ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mappa);
    // più strutture nello stesso punto (o tutte al centro del paese): le affianco a raggiera
    const gruppi = {};
    const sullaMappa = D.strutture.filter((s) => s._mappa);
    sullaMappa.forEach((s) => { (gruppi[s.lat.toFixed(4) + ',' + s.lng.toFixed(4)] ||= []).push(s); });
    Object.values(gruppi).forEach((g) => {
      if (g.length < 2) return;
      g.forEach((s, i) => {
        const a = (2 * Math.PI * i) / g.length, r = 0.00012 + 0.00004 * g.length;
        s._pos = [s.lat + r * Math.sin(a), s.lng + r * Math.cos(a) * 1.4];
      });
    });
    sullaMappa.forEach((s) => {
      const icon = L.divIcon({ className: 'goccia', html: goccia(s.categoria, s.gruppo), iconSize: [34, 46], iconAnchor: [17, 45] });
      markers[s.id] = L.marker(s._pos || [s.lat, s.lng], { icon, title: s.nome, keyboard: true })
        .bindTooltip(s.nome, { direction: 'top', offset: [0, -40], className: 'etichetta' })
        .on('click', () => apri(s.id));
    });
  }

  // ---------- filtri ----------
  function filtrate(ignora) {
    const q = norm(stato.q).split(/\s+/).filter(Boolean);
    return D.strutture.filter((s) =>
      (ignora === 'gruppo' || !stato.gruppo || s.gruppo === stato.gruppo) &&
      (ignora === 'comune' || !stato.comune || s.comune === stato.comune) &&
      (ignora === 'cat' || !stato.cat || s.categoria === stato.cat) &&
      q.every((w) => s._txt.includes(w)));
  }

  function render() {
    const lista = filtrate();
    // dormire / mangiare
    const perGr = countBy(filtrate('gruppo'), 'gruppo');
    $('#gruppi').innerHTML = [['', 'Tutto'], ['dormire', 'Dormire'], ['mangiare', 'Mangiare']].map(([id, n]) =>
      `<button type="button" data-gruppo="${id}" class="${stato.gruppo === id ? 'on' : ''}">${n} <span class="n">${id ? perGr[id] || 0 : filtrate('gruppo').length}</span></button>`).join('');
    // paesi
    const perComune = countBy(filtrate('comune'), 'comune');
    $('#comuni').innerHTML = `<button class="chip ${!stato.comune ? 'on' : ''}" data-comune="">Tutti</button>` +
      D.comuni.map((c) => `<button class="chip ${stato.comune === c.nome ? 'on' : ''}" data-comune="${esc(c.nome)}">${esc(c.nome)} <span class="n">${perComune[c.nome] || 0}</span></button>`).join('');
    // tipi (solo quelli del gruppo scelto)
    const perCat = countBy(filtrate('cat'), 'categoria');
    $('#categorie').innerHTML = `<button class="chip ${!stato.cat ? 'on' : ''}" data-cat="">Tutti</button>` +
      D.categorie.filter((c) => !stato.gruppo || c.gruppo === stato.gruppo)
        .map((c) => `<button class="chip g-${c.gruppo} ${stato.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${svg(c.id)} ${esc(c.nome)} <span class="n">${perCat[c.id] || 0}</span></button>`).join('');
    // lista
    const ord = D.categorie.map((c) => c.id);
    lista.sort((a, b) => ord.indexOf(a.categoria) - ord.indexOf(b.categoria) || a.comune.localeCompare(b.comune) || a.nome.localeCompare(b.nome));
    $('#conteggio').textContent = lista.length === 1 ? '1 risultato' : `${lista.length} risultati`;
    $('#lista').innerHTML = lista.length ? lista.map((s) => `
      <li><button data-id="${s.id}" class="${stato.sel === s.id ? 'sel' : ''}">
        <span class="ic g-${s.gruppo}">${svg(s.categoria)}</span>
        <span><strong>${esc(s.nome)}</strong><small>${esc(s.tipo || D.catById[s.categoria].nome)}${s.stelle ? ' ' + '★'.repeat(s.stelle) : ''} · ${esc(s.localita ? s.localita + ', ' : '')}${esc(s.comune)}${s._mappa ? '' : ' · <i>non sulla mappa</i>'}</small></span>
      </button></li>`).join('')
      : '<li class="vuoto">Nessun risultato. Prova a togliere un filtro o a cambiare parola.</li>';
    // marker
    const vis = new Set(lista.map((s) => s.id));
    Object.entries(markers).forEach(([id, m]) => {
      if (vis.has(id)) { if (!mappa.hasLayer(m)) m.addTo(mappa); } else m.remove();
    });
  }

  function adattaVista() {
    const pts = filtrate().filter((s) => s._mappa).map((s) => [s.lat, s.lng]);
    if (!pts.length) return;
    if (pts.length === 1) mappa.setView(pts[0], 16);
    else inquadra(pts, 15);
  }

  const ZOOM_MIN_VISTA = 9;
  function inquadra(pts, maxZoom) {
    const prima = inquadrando; inquadrando = true;
    mappa.invalidateSize();
    const sz = mappa.getSize();
    const pad = [Math.min(40, sz.x * 0.06), Math.min(40, sz.y * 0.06)];
    const b = L.latLngBounds(pts);
    const z = Math.max(ZOOM_MIN_VISTA, Math.min(maxZoom, mappa.getBoundsZoom(b, false, L.point(pad[0] * 2, pad[1] * 2))));
    mappa.setView(b.getCenter(), z, { animate: false });
    inquadrando = prima;
  }

  // ---------- scheda ----------
  function apri(id, daHash) {
    const s = D.byId[id];
    if (!s) return;
    stato.sel = id;
    Object.entries(markers).forEach(([k, m]) => m._icon && m._icon.classList.toggle('sel', k === id));
    // con posizione indicativa porto Google Maps all'indirizzo scritto, non al punto
    const dest = s.posizione_approx ? encodeURIComponent(`${s.nome}, ${s.indirizzo}`) : encodeURIComponent(`${s.lat},${s.lng}`);
    const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    const link = linkScheda(id);
    const dett = [
      s.prezzo && ['Prezzo', s.prezzo],
      s.cucina && ['Cucina', s.cucina],
      s.camere && ['Camere', s.camere],
      s.posti_letto && ['Posti letto', s.posti_letto],
      s.chiusura && ['Apertura', s.chiusura]
    ].filter(Boolean);
    const el = $('#scheda');
    el.innerHTML = `
      <button class="chiudi" aria-label="Chiudi scheda">×</button>
      <span class="cat g-${s.gruppo}">${svg(s.categoria)} ${esc(GRUPPO[s.gruppo])} · ${esc(s.tipo || D.catById[s.categoria].nome)}</span>
      <h1>${esc(s.nome)}${s.stelle ? ` <span class="stelle" title="${s.stelle} stelle">${'★'.repeat(s.stelle)}</span>` : ''}</h1>
      <p class="ind">${esc(s.indirizzo)}${!s._mappa ? '<br><span class="approx">Indirizzo non trovato sulla mappa: usa "Portami qui" o telefona</span>' : s.posizione_approx ? '<br><span class="approx">Posizione sulla mappa indicativa</span>' : ''}</p>
      ${s.avvisi.map((a) => `<div class="avviso">${esc(a)}</div>`).join('')}
      <div class="azioni">
        <a class="btn pri" href="${gmaps}" target="_blank" rel="noopener">Portami qui con Google Maps</a>
        <button class="btn" data-az="condividi">Invia al telefono</button>
        <button class="btn" data-az="contatto">Salva nei contatti</button>
      </div>
      ${s.telefoni.length ? `<h2>Telefono</h2>${s.telefoni.map((t) => `<div class="tel"><span>Chiama</span><a href="${telHref(t)}">${esc(t)}</a></div>`).join('')}` : ''}
      ${s.email ? `<h2>Email</h2><p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : ''}
      ${s.sito ? `<h2>Sito</h2><p><a href="${esc(urlSito(s.sito))}" target="_blank" rel="noopener" data-sito>${esc(s.sito.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></p>` : ''}
      ${dett.length ? `<h2>Informazioni</h2><dl class="dett">${dett.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
      ${s.servizi.length ? `<h2>Servizi</h2><ul class="servizi">${s.servizi.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
      <div class="qr"><div id="qr-img"></div><p><strong>Scheda sul telefono</strong><br>Inquadra il codice con la fotocamera per aprire la scheda sul tuo smartphone.</p></div>
      <p class="segnala-scheda"><a href="${mailtoScheda(s, 'errore')}">Segnala un errore</a> · <a href="${mailtoScheda(s, 'titolare')}">Sei il titolare? Correggi o aggiungi foto e orari</a></p>
      <h2>Fonte dei dati</h2>
      <p class="fonti">${s.fonti.map((f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nome)}</a>`).join('<br>')}<br>
      Ultima verifica: ${new Date(s.verificato).toLocaleDateString('it-IT')}</p>`;
    el.hidden = false;
    el.scrollTop = 0;
    const qr = qrcode(0, 'M'); qr.addData(link); qr.make();
    $('#qr-img').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    el.querySelector('.chiudi').onclick = chiudi;
    el.querySelectorAll('[data-az]').forEach((b) => b.onclick = () => azione(b.dataset.az, s));
    el.querySelectorAll('a[href^="tel:"]').forEach((a) => a.addEventListener('click', () => conta('chiama', s)));
    el.querySelector('.btn.pri').addEventListener('click', () => conta('portami', s));
    el.querySelectorAll('a[data-sito]').forEach((a) => a.addEventListener('click', () => conta('sito', s)));
    conta('scheda', s);
    if (!daHash) history.replaceState(null, '', '#s=' + id);
    if (s._mappa) {
      mappa.setView(s._pos || [s.lat, s.lng], Math.max(mappa.getZoom(), s.posizione_approx ? 14 : 17), { animate: false });
      if (window.innerWidth > 800) mappa.panBy([el.offsetWidth / 2 + 12, 0], { animate: false });
    }
    render();
  }

  // nessun dato personale: solo quale scheda e quale pulsante
  function conta(azione, s) {
    if (!CONTATORE || !navigator.sendBeacon) return;
    navigator.sendBeacon(CONTATORE, JSON.stringify({ a: azione, id: s.id, c: s.comune }));
  }

  function chiudi() {
    $('#scheda').hidden = true;
    stato.sel = '';
    Object.values(markers).forEach((m) => m._icon && m._icon.classList.remove('sel'));
    history.replaceState(null, '', location.pathname + location.search + (stato.comune ? '#c=' + encodeURIComponent(stato.comune) : ''));
    render();
  }

  function linkScheda(id) { return location.origin + location.pathname + '#s=' + id; }

  function mailtoScheda(s, tipo) {
    const ogg = tipo === 'titolare' ? `Mangiare e dormire in Mugello: richiesta del titolare - ${s.nome}` : `Mangiare e dormire in Mugello: errore nella scheda ${s.nome}`;
    const corpo = tipo === 'titolare'
      ? `Scheda: ${s.nome}\nLink: ${linkScheda(s.id)}\n\nSono il titolare / gestore.\nChiedo di: [ ] correggere i dati  [ ] aggiungere foto, orari, menu  [ ] rimuovere la scheda\n\nDettagli:\n`
      : `Scheda: ${s.nome}\nLink: ${linkScheda(s.id)}\n\nCosa non è corretto (es. chiuso, telefono cambiato):\n`;
    return 'mailto:' + D.segnalazioni + '?subject=' + encodeURIComponent(ogg) + '&body=' + encodeURIComponent(corpo);
  }

  function testoScheda(s) {
    return [s.nome, s.indirizzo, ...s.telefoni, linkScheda(s.id)].join('\n');
  }

  function azione(az, s) {
    if (az === 'condividi') {
      if (navigator.share) navigator.share({ title: s.nome, text: testoScheda(s), url: linkScheda(s.id) }).catch(() => {});
      else window.open('https://wa.me/?text=' + encodeURIComponent(testoScheda(s)), '_blank', 'noopener');
    }
    if (az === 'contatto') {
      const v = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${s.nome}`, `ORG:${s.nome}`,
        ...s.telefoni.map((t) => `TEL;TYPE=WORK,VOICE:${t}`),
        s.email ? `EMAIL:${s.email}` : '',
        `ADR;TYPE=WORK:;;${s.indirizzo.replace(/[,;]/g, ' ')};;;;Italia`,
        s.sito ? `URL:${urlSito(s.sito)}` : '', 'END:VCARD'].filter(Boolean).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([v], { type: 'text/vcard' }));
      a.download = s.nome.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') + '.vcf';
      a.click();
    }
  }

  // ---------- eventi ----------
  function initEventi() {
    $('#q').addEventListener('input', (e) => { stato.q = e.target.value; render(); });
    $('#gruppi').addEventListener('click', (e) => {
      const b = e.target.closest('[data-gruppo]'); if (!b) return;
      stato.gruppo = b.dataset.gruppo;
      if (stato.cat && D.catById[stato.cat].gruppo !== stato.gruppo) stato.cat = '';
      render(); adattaVista();
    });
    $('#comuni').addEventListener('click', (e) => {
      const b = e.target.closest('[data-comune]'); if (!b) return;
      stato.comune = b.dataset.comune;
      history.replaceState(null, '', stato.comune ? '#c=' + encodeURIComponent(stato.comune) : location.pathname + location.search);
      render(); adattaVista();
    });
    $('#categorie').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      stato.cat = b.dataset.cat; render(); adattaVista();
    });
    $('#lista').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) apri(b.dataset.id); });
    $('#vista').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      document.querySelectorAll('#vista button').forEach((x) => x.classList.toggle('on', x === b));
      document.body.classList.toggle('v-mappa', b.dataset.v === 'mappa');
      setTimeout(() => { mappa.invalidateSize(); if (b.dataset.v === 'mappa') adattaVista(); }, 50);
    });
    $('#home').addEventListener('click', (e) => { e.preventDefault(); reset(); });
    $('#segnala').addEventListener('click', (e) => {
      e.preventDefault();
      location.href = 'mailto:' + D.segnalazioni + '?subject=' + encodeURIComponent('Mangiare e dormire in Mugello: segnalazione');
    });
    window.addEventListener('hashchange', () => { leggiHash(); render(); });
    mappa.on('dragstart zoomstart', (e) => { if (e.hard !== false && !inquadrando) mossaUtente = true; });
    let tRes;
    window.addEventListener('resize', () => {
      clearTimeout(tRes);
      tRes = setTimeout(() => { mappa.invalidateSize(); if (!mossaUtente && $('#scheda').hidden) { inquadrando = true; stato.comune || stato.cat || stato.q || stato.gruppo ? adattaVista() : vistaIniziale(); inquadrando = false; } }, 200);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#scheda').hidden) chiudi(); });
  }

  function leggiHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('c')) { stato.comune = h.get('c'); setTimeout(adattaVista, 0); }
    if (h.get('g') && GRUPPO[h.get('g')]) stato.gruppo = h.get('g');
    if (h.get('s') && D.byId[h.get('s')]) setTimeout(() => apri(h.get('s'), true), 0);
    else if (!$('#scheda').hidden) { $('#scheda').hidden = true; stato.sel = ''; }
  }

  let mossaUtente = false, inquadrando = false;
  function vistaIniziale() {
    inquadra(D.strutture.filter((s) => s._mappa).map((s) => [s.lat, s.lng]), 12);
    mossaUtente = false;
  }

  function reset() {
    stato = { q: '', comune: '', cat: '', gruppo: '', sel: '' };
    $('#q').value = '';
    $('#scheda').hidden = true;
    history.replaceState(null, '', location.pathname + location.search);
    render();
    vistaIniziale();
  }

  function countBy(arr, k) { return arr.reduce((o, x) => (o[x[k]] = (o[x[k]] || 0) + 1, o), {}); }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
