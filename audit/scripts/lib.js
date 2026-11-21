// Outils communs : ouvrir l'application de test sous un rôle, naviguer, capturer.
const { chromium } = require('playwright');
exports.ouvrir = async ({ role = 0, w = 1440, h = 900, mode, url = 'http://localhost:5180/' } = {}) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR', deviceScaleFactor: 1, ...(process.env.TACTILE ? { hasTouch: true, isMobile: true } : {}) });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('PAGE ' + e.message)); p.on('console', (m) => (m.type() === 'error' || /same key|\[visite\]/.test(m.text())) && errs.push(m.text().slice(0, 300)));
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(300); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').nth(role).click(); await p.waitForTimeout(600);
  if (mode) { await p.evaluate((m) => { const o = {}; for (const id of ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste']) o[id] = { theme: 'ciel', texte: 'normal', mode: m }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }, mode); await p.reload(); await p.waitForTimeout(600); }
  const nav = async (v) => { await p.locator(`[data-tour="nav-${v}"]`).click(); await p.waitForTimeout(500); };
  const shot = (nom, opt = {}) => p.screenshot({ path: `${__dirname}/shots/${nom}.png`, ...opt });
  return { b, p, errs, nav, shot };
};
