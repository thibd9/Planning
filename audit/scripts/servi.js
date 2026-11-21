// Sert la copie compilée (dossier « heberge ») aux navigateurs de test sans serveur : chaque contexte Playwright
// intercepte http://localhost:5180/ et répond depuis le disque. À charger avec NODE_OPTIONS="-r …/servi.js".
const pw = require('playwright'); const fs = require('fs'); const path = require('path');
const RACINE = path.join(__dirname, 'heberge');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const brancher = async (ctx) => {
  // Solvéa démarre sur la connexion et ouvre la fenêtre « Version de test » à chaque chargement. Les contrôles rechargent
  // la page en cours de route : ils restent connectés (CONNEXION=1 fait comme un utilisateur) et passent la fenêtre
  // (AVIS=1 la garde).
  await ctx.addInitScript((r) => { window.__solveaTest = r; }, { garderSession: !process.env.CONNEXION, sansAvis: !process.env.AVIS });
  // Les rubriques en accordéon sont ouvertes une fois, à leur apparition : les contrôles lisent tout le contenu.
  // PLIE=1 les laisse dans leur état par défaut (visites guidées, contrôles qui portent sur les accordéons).
  if (!process.env.PLIE) await ctx.addInitScript(() => { const ouvrir = () => document.querySelectorAll('details.acc:not([data-vu])').forEach((d) => { d.setAttribute('data-vu', ''); if (!d.open) d.open = true; }); new MutationObserver(ouvrir).observe(document, { childList: true, subtree: true }); const montrer = () => { if (!document.head || document.getElementById('test-onglets')) return; const st = document.createElement('style'); st.id = 'test-onglets'; st.textContent = '[data-onglets] > [role=tabpanel][data-panneau][hidden] { display: block !important; }'; document.head.appendChild(st); }; montrer(); document.addEventListener('DOMContentLoaded', montrer); });
  await ctx.route(/^http:\/\/localhost:5180\//, (route) => {
    let p = new URL(route.request().url()).pathname; if (p === '/') p = '/index.html';
    const f = path.join(RACINE, decodeURIComponent(p));
    if (!f.startsWith(RACINE) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'absent' });
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  return ctx;
};
const lancer = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await lancer(...a); const neuf = b.newContext.bind(b);
  b.newContext = async (...x) => brancher(await neuf(...x));
  b.newPage = async (...x) => (await b.newContext(...x)).newPage();
  return b;
};
