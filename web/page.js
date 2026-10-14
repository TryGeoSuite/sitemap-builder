// The single-page UI for the hosted Sitemap Builder. Bilingual (en/it): the worker
// picks a locale and calls renderPage(lang); all user-facing copy lives in the S
// dictionary below. The interactive crawl form talks to /api/crawl and renders the
// result; its visitor-visible strings are injected as I18N and read at runtime.
//
// It wears GeoSuite's design (theme.js, shared with the hub at tools.trygeosuite.it):
// same bar, hero, panels and closing call to action, so the free tools read as
// one site. Icons are inline line SVGs, never emoji, and a state is always
// spelled out in text next to its color.
//
// Product names and "sitemap.xml" stay as-is; only prose/labels/buttons translate.

import { FONTS, BASE_CSS, ENGINES } from './theme.js';

const BASE = 'https://sitemap-builder.geosuite.workers.dev';
const HUB = 'https://tools.trygeosuite.it';
const REPO = 'https://github.com/TryGeoSuite/sitemap-builder';
const NPM = 'https://www.npmjs.com/package/@geosuite/sitemap-builder';
const ANALYSIS = 'https://trygeosuite.it/analisi-gratuita?utm_source=geosuite-open&utm_medium=tool&utm_campaign=sitemap-builder';
const CMD = 'npx @geosuite/sitemap-builder &lt;url&gt;';

// Filled circle + white mark, colored by the surrounding state class. Always
// next to a text label, never the only signal.
const ICONS = {
  ok: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9"/><path d="M6 10.5l2.6 2.6L14 7.7" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  warn: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9"/><path d="M10 5.5v5.2M10 14.1v.4" fill="none" stroke-width="2" stroke-linecap="round"/></svg>',
  crit: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9"/><path d="M7 7l6 6M13 7l-6 6" fill="none" stroke-width="2" stroke-linecap="round"/></svg>',
};
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"><path d="M12 3.2l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6-4.3-4.2 6-.9z"/></svg>';

const S = {
  en: {
    title: 'Sitemap Builder: generate a sitemap.xml by crawling your site',
    desc: 'Paste a URL and get a sitemaps.org-compliant sitemap.xml by crawling your site. Free, capped quick version; use the CLI for a full crawl.',
    nav: 'Site',
    tools: 'Free tools',
    eyebrow: 'Sitemap Builder, a free GeoSuite tool',
    h1: 'Turn your site into a sitemap.xml',
    lead: `Paste a URL: we crawl your site and build a <a href="https://www.sitemaps.org/" target="_blank" rel="noopener">sitemap.xml</a> you can copy or download.`,
    label: 'Your website',
    placeholder: 'yoursite.com',
    build: 'Build the sitemap',
    facts: ['Free', 'No sign-up', 'Open source (MIT)', 'sitemaps.org compliant'],
    howLabel: 'How it works',
    how: [
      'We start from the page you paste and follow the links that stay on your site.',
      'Up to ~40 pages, two clicks deep, so the answer comes back in seconds.',
      'You get a valid sitemap.xml to copy or download, ready for your site root.',
    ],
    cliLabel: 'From the terminal',
    hintPre: 'Quick crawl, capped at ~40 pages (depth 2) to stay fast. For a full crawl of a large site, use the CLI:',
    copyCmd: 'Copy',
    copiedCmd: 'Copied',
    copyLabel: 'Copy the command',
    star: 'Star on GitHub',
    ctaTitle: 'Being found is step one. Being recommended is the goal.',
    ctaText: 'A sitemap.xml helps crawlers, AI ones included, find every page you want read. GeoSuite checks what happens next: it asks ChatGPT, Gemini and Perplexity the questions your customers really ask, and tells you where you appear, who wins instead and what to fix first. The report arrives by email.',
    ctaButton: 'Get the free analysis',
    footer: `Open source (MIT) by <a href="https://github.com/matte97p">Matteo Perino</a>, maintained under <a href="https://trygeosuite.it">GeoSuite</a>, the Italian platform for AI visibility. Code on <a href="${REPO}">GitHub</a>, package on <a href="${NPM}">npm</a>.`,
    // Strings read at runtime by the interactive crawl script.
    js: {
      crawling: 'Crawling',
      crawlingTail: '… (up to ~40 pages)',
      networkError: 'Network error, try again.',
      cappedPre: 'Capped at',
      cappedPost: 'pages (the edge version stays fast). Run the CLI for a full crawl.',
      sitemapFor: 'sitemap.xml for',
      page: 'page',
      pages: 'pages',
      copy: 'Copy',
      copied: 'Copied',
      download: 'Download',
    },
  },
  it: {
    title: 'Sitemap Builder: genera un sitemap.xml esplorando il tuo sito',
    desc: 'Incolla un URL e ottieni un sitemap.xml conforme a sitemaps.org esplorando il tuo sito. Versione rapida e limitata gratuita; usa la CLI per un crawl completo.',
    nav: 'Sito',
    tools: 'Strumenti gratuiti',
    eyebrow: 'Sitemap Builder, uno strumento gratuito di GeoSuite',
    h1: 'Trasforma il tuo sito in un sitemap.xml',
    lead: `Incolla un URL: esploriamo il tuo sito e costruiamo un <a href="https://www.sitemaps.org/" target="_blank" rel="noopener">sitemap.xml</a> che puoi copiare o scaricare.`,
    label: 'Il tuo sito',
    placeholder: 'tuosito.it',
    build: 'Costruisci la sitemap',
    facts: ['Gratis', 'Senza registrazione', 'Open source (MIT)', 'Conforme a sitemaps.org'],
    howLabel: 'Come funziona',
    how: [
      'Partiamo dalla pagina che incolli e seguiamo i link che restano sul tuo sito.',
      'Fino a ~40 pagine, a due clic di profondità, così la risposta arriva in pochi secondi.',
      'Ottieni un sitemap.xml valido da copiare o scaricare, pronto per la radice del sito.',
    ],
    cliLabel: 'Dal terminale',
    hintPre: 'Crawl rapido, limitato a ~40 pagine (profondità 2) per restare veloce. Per un crawl completo di un sito grande, usa la CLI:',
    copyCmd: 'Copia',
    copiedCmd: 'Copiato',
    copyLabel: 'Copia il comando',
    star: 'Stella su GitHub',
    ctaTitle: 'Farsi trovare è il primo passo. Farsi consigliare è l’obiettivo.',
    ctaText: 'Un sitemap.xml aiuta i crawler, anche quelli delle AI, a trovare tutte le pagine che vuoi far leggere. GeoSuite controlla cosa succede dopo: fa a ChatGPT, Gemini e Perplexity le domande che i tuoi clienti fanno davvero, e ti dice dove compari, chi vince al posto tuo e cosa correggere per primo. Il report arriva via mail.',
    ctaButton: 'Richiedi l’analisi gratuita',
    footer: `Open source (MIT) di <a href="https://github.com/matte97p">Matteo Perino</a>, mantenuto da <a href="https://trygeosuite.it">GeoSuite</a>, la piattaforma italiana per la visibilità sulle AI. Codice su <a href="${REPO}">GitHub</a>, pacchetto su <a href="${NPM}">npm</a>.`,
    // Stringhe lette a runtime dallo script interattivo del crawl.
    js: {
      crawling: 'Esplorazione di',
      crawlingTail: '… (fino a ~40 pagine)',
      networkError: 'Errore di rete, riprova.',
      cappedPre: 'Limitato a',
      cappedPost: 'pagine (la versione edge resta veloce). Lancia la CLI per un crawl completo.',
      sitemapFor: 'sitemap.xml per',
      page: 'pagina',
      pages: 'pagine',
      copy: 'Copia',
      copied: 'Copiato',
      download: 'Scarica',
    },
  },
};

// lang: 'en' | 'it'.
export function renderPage(lang) {
  const t = S[lang] || S.en;

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.title}</title>
<meta name="description" content="${t.desc}">
<link rel="canonical" href="${BASE}/${lang}">
<link rel="alternate" hreflang="en" href="${BASE}/en">
<link rel="alternate" hreflang="it" href="${BASE}/it">
<link rel="alternate" hreflang="x-default" href="${BASE}/">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="GeoSuite Open">
<meta property="og:title" content="${t.title}">
<meta property="og:description" content="${t.desc}">
<meta property="og:url" content="${BASE}/${lang}">
<meta property="og:image" content="${BASE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${lang === 'it' ? 'it_IT' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t.title}">
<meta name="twitter:description" content="${t.desc}">
<meta name="twitter:image" content="${BASE}/og.png">
${FONTS}
<style>
${BASE_CSS}
  .bar nav a { min-height:36px; }
  .hero > * { min-width:0; }
  code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

  .side { padding:20px; }
  .side .label + * { margin-top:10px; }
  ol.how { list-style:none; margin:0 0 20px; padding:0; counter-reset:how; }
  ol.how li { counter-increment:how; display:grid; grid-template-columns:28px 1fr; gap:10px; padding:8px 0; color:var(--ink-2); font-size:.9375rem; border-top:1px solid var(--line); }
  ol.how li:first-child { border-top:0; padding-top:0; }
  ol.how li::before { content:counter(how); display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:999px; background:var(--sunk); color:var(--ink-3); font-size:.8125rem; font-weight:600; font-variant-numeric:tabular-nums; }
  .hint { color:var(--ink-2); font-size:.875rem; margin:0 0 12px; }
  .cmd { display:flex; align-items:center; gap:8px; padding:4px 4px 4px 12px; background:var(--surface-2); border:1px solid var(--line); border-radius:8px; margin:0 0 16px; }
  .cmd code { flex:1; min-width:0; overflow-x:auto; white-space:nowrap; color:var(--ink-2); font-size:.8125rem; padding:6px 0; }
  .cmd button { flex:none; min-height:36px; padding:4px 12px; font-size:.8125rem; }
  a.ghost { display:inline-flex; align-items:center; gap:6px; text-decoration:none; }
  a.ghost svg { width:16px; height:16px; }

  #out { margin-top:32px; }
  #out:empty { display:none; }
  .note { display:flex; align-items:flex-start; gap:10px; padding:14px 16px; border-radius:12px; border:1px solid var(--line); background:var(--surface); color:var(--ink-2); font-size:.9375rem; margin:0 0 12px; }
  .note svg { width:18px; height:18px; flex:none; margin-top:2px; }
  .note svg path { stroke:var(--surface); }
  .note.warn { background:var(--warn-soft); border-color:transparent; color:var(--ink); }
  .note.warn svg circle { fill:var(--warn); }
  .note.crit { background:var(--crit-soft); border-color:transparent; color:var(--ink); }
  .note.crit svg circle { fill:var(--crit); }
  .note.busy { color:var(--ink-2); }
  .spinner { width:18px; height:18px; flex:none; margin-top:2px; border-radius:999px; border:2px solid var(--line-2); border-top-color:var(--ink-2); animation:spin .8s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation:none; } }

  .result { padding:20px; }
  .meta { display:flex; align-items:center; gap:8px 12px; flex-wrap:wrap; margin:0 0 14px; }
  .meta h2 { margin:0; font-size:1.0625rem; letter-spacing:-.01em; min-width:0; overflow-wrap:anywhere; }
  .meta .count { display:inline-flex; align-items:center; gap:6px; color:var(--ink-3); font-size:.875rem; font-variant-numeric:tabular-nums; }
  .meta .count svg { width:14px; height:14px; } .meta .count svg circle { fill:var(--ok); } .meta .count svg path { stroke:var(--surface); }
  .actions { display:flex; gap:8px; margin-left:auto; }
  pre.gen { margin:0; padding:16px; border-radius:8px; background:var(--surface-2); border:1px solid var(--line); color:var(--ink-2); overflow:auto; max-height:460px; font-size:.8125rem; line-height:1.55; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space:pre; }

  .cta { margin-top:48px; }
  @media (max-width:640px) {
    .actions { margin-left:0; width:100%; }
    .actions .ghost { flex:1; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="bar">
    <a class="brand" href="https://trygeosuite.it">GeoSuite</a>
    <nav aria-label="${t.nav}">
      <a href="${HUB}/${lang}">${t.tools}</a>
      <a href="/en"${lang === 'en' ? ' aria-current="page"' : ''} hreflang="en">EN</a>
      <a href="/it"${lang === 'it' ? ' aria-current="page"' : ''} hreflang="it">IT</a>
    </nav>
  </header>

  <main>
    <div class="hero">
      <div>
        <p class="eyebrow">${t.eyebrow}</p>
        <h1>${t.h1}</h1>
        <p class="lead">${t.lead}</p>
        <form id="f" class="urlform">
          <label for="u">${t.label}</label>
          <input id="u" name="url" type="text" inputmode="url" autocomplete="url" spellcheck="false" autocapitalize="off" placeholder="${t.placeholder}" autofocus>
          <button id="go" class="primary" type="submit">${t.build}</button>
        </form>
        <ul class="facts">${t.facts.map((f) => `<li>${ICONS.ok}${f}</li>`).join('')}</ul>
      </div>

      <aside class="panel side">
        <p class="label">${t.howLabel}</p>
        <ol class="how">${t.how.map((s) => `<li><span>${s}</span></li>`).join('')}</ol>
        <p class="label">${t.cliLabel}</p>
        <p class="hint">${t.hintPre}</p>
        <div class="cmd"><code>${CMD}</code></div>
        <a class="ghost" href="${REPO}" target="_blank" rel="noopener">${STAR}${t.star}</a>
      </aside>
    </div>

    <section id="out" aria-live="polite"></section>

    <section class="panel cta">
      <div>
        <h2>${t.ctaTitle}</h2>
        <p>${t.ctaText}</p>
        ${ENGINES}
      </div>
      <a class="primary" href="${ANALYSIS}" target="_blank" rel="noopener">${t.ctaButton}</a>
    </section>
  </main>

  <footer>${t.footer}</footer>
</div>

<script>var I18N = ${JSON.stringify(t.js)}; var ICONS = ${JSON.stringify(ICONS)};</script>
<script>
  var out = document.getElementById('out');
  var input = document.getElementById('u');
  var btn = document.getElementById('go');
  var lastText = '';

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  function note(kind, html){
    var mark = kind === 'busy' ? '<span class="spinner" aria-hidden="true"></span>' : ICONS[kind];
    return '<div class="note ' + kind + '"' + (kind === 'crit' ? ' role="alert"' : '') + '>' + mark + '<span>' + html + '</span></div>';
  }

  function render(r){
    if (r.error){ out.innerHTML = note('crit', esc(r.error)); return; }
    lastText = r.xml || '';
    var warn = r.capped ? note('warn', I18N.cappedPre + ' ' + r.count + ' ' + I18N.cappedPost) : '';
    out.innerHTML =
      warn +
      '<div class="panel result">' +
        '<div class="meta">' +
          '<h2>' + I18N.sitemapFor + ' ' + esc(r.site) + '</h2>' +
          '<span class="count">' + ICONS.ok + r.count + ' ' + (r.count === 1 ? I18N.page : I18N.pages) + '</span>' +
          '<span class="actions">' +
            '<button id="copy" class="ghost" type="button">' + I18N.copy + '</button>' +
            '<button id="dl" class="ghost" type="button">' + I18N.download + '</button>' +
          '</span>' +
        '</div>' +
        '<pre class="gen" tabindex="0">' + esc(lastText) + '</pre>' +
      '</div>';

    document.getElementById('copy').addEventListener('click', function(){
      navigator.clipboard.writeText(lastText).then(function(){
        var b = document.getElementById('copy'); b.textContent = I18N.copied; setTimeout(function(){ b.textContent = I18N.copy; }, 1500);
      });
    });
    document.getElementById('dl').addEventListener('click', function(){
      var blob = new Blob([lastText], { type: 'application/xml' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sitemap.xml';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
    });
  }

  function run(url){
    if (!url) return;
    btn.disabled = true;
    out.innerHTML = note('busy', I18N.crawling + ' ' + esc(url) + ' ' + I18N.crawlingTail);
    fetch('/api/crawl?url=' + encodeURIComponent(url))
      .then(function(res){ return res.json(); })
      .then(function(r){ render(r); })
      .catch(function(){ out.innerHTML = note('crit', I18N.networkError); })
      .finally(function(){ btn.disabled = false; });
  }

  document.getElementById('f').addEventListener('submit', function(e){
    e.preventDefault();
    var url = input.value.trim();
    if (url){ history.replaceState(null, '', '?url=' + encodeURIComponent(url)); run(url); }
  });

  var shared = new URLSearchParams(location.search).get('url');
  if (shared){ input.value = shared; run(shared); }
</script>
<script>
(function () {
  var L = { copy: ${JSON.stringify(t.copyCmd)}, copied: ${JSON.stringify(t.copiedCmd)}, label: ${JSON.stringify(t.copyLabel)} };
  if (!navigator.clipboard) return;
  document.querySelectorAll('.cmd').forEach(function (box) {
    var cmd = box.querySelector('code').textContent.trim();
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ghost'; b.textContent = L.copy; b.setAttribute('aria-label', L.label);
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(cmd).then(function () {
        b.textContent = L.copied;
        setTimeout(function () { b.textContent = L.copy; }, 1200);
      }).catch(function () {});
    });
    box.appendChild(b);
  });
})();
</script>
</body>
</html>`;
}
