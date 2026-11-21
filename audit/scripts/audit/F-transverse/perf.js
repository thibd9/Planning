const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const r = {};
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
  let t = Date.now(); await p.goto('http://localhost:5180/'); await p.waitForSelector('text=Comment ça marche'); r.chargementConnexion_ms = Date.now() - t;
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.locator('#dc-onglet-libre').click();
  t = Date.now(); await p.locator('.dc-role').first().click(); await p.waitForSelector('[data-tour="nav-construire"]'); r.entreeExemple_ms = Date.now() - t;
  r.stockage_ko = await p.evaluate(() => Math.round(Object.keys(localStorage).reduce((n, k) => n + (localStorage.getItem(k) || '').length, 0) / 1024));
  r.cles = await p.evaluate(() => Object.keys(localStorage));
  const d = await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('releve.v3')); const o = v.officines[v.courante]; return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, Array.isArray(x) ? x.length : typeof x === 'object' && x ? Object.keys(x).length : x === undefined ? 0 : 1])); });
  r.contenu = d;
  for (const v of ['construire', 'stats', 'equite', 'aide', 'resoudre']) { t = Date.now(); await p.evaluate((id) => document.querySelector(`[data-tour="nav-${id}"]`)?.click(), v); await p.waitForTimeout(50); await p.waitForLoadState('networkidle'); r['ecran_' + v + '_ms'] = Date.now() - t; }
  // données abîmées : que fait l'application ?
  await p.evaluate(() => localStorage.setItem('releve.v3', '{abîmé')); await p.reload(); await p.waitForTimeout(1200);
  r.donneesAbimees = { texte: (await p.evaluate(() => document.body.innerText)).slice(0, 160).replace(/\s+/g, ' '), erreurs: errs.slice(-3) };
  await p.evaluate(() => localStorage.setItem('releve.v3', JSON.stringify({ officines: {}, courante: 'x' }))); await p.reload(); await p.waitForTimeout(1200);
  r.donneesVides = { texte: (await p.evaluate(() => document.body.innerText)).slice(0, 160).replace(/\s+/g, ' '), erreurs: errs.slice(-3) };
  console.log(JSON.stringify(r, null, 1)); await b.close();
})();
