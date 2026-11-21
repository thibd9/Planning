// Outils de l'auditeur C : ouvrir l'exemple sous un profil, lire les données, capturer.
const { chromium } = require('playwright');
const D = __dirname;
exports.D = D;
exports.ouvrir = async ({ role = 0, w = 1440, h = 900, mode, url = 'http://localhost:5180/', downloads = false } = {}) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR', deviceScaleFactor: 1, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('PAGE ' + e.message)); p.on('console', (m) => (m.type() === 'error') && errs.push(m.text().slice(0, 300)));
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(300); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').nth(role).click(); await p.waitForTimeout(700);
  if (mode) { await p.evaluate((m) => { const o = {}; for (const id of ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste']) o[id] = { theme: 'ciel', texte: 'normal', mode: m }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }, mode); await p.reload(); await p.waitForTimeout(600); }
  const nav = async (v) => { const ok = await p.evaluate((sel) => { const e = [...document.querySelectorAll(`[data-tour="nav-${sel}"]`)].find((x) => x.getBoundingClientRect().width > 0) ?? document.querySelector(`[data-tour="nav-${sel}"]`); if (!e) return false; e.click(); return true; }, v); await p.waitForTimeout(600); return ok; };
  const shot = (nom, opt = {}) => p.screenshot({ path: `${D}/captures/${nom}.png`, ...opt });
  const data = () => p.evaluate(() => { const e = JSON.parse(localStorage.getItem('releve.v3')); return e.officines[e.courante]; });
  const profil = async (txt) => { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(300); await p.locator('.bandeau-test button', { hasText: txt }).first().click(); await p.waitForTimeout(800); };
  const texte = (sel = 'main, .content, body') => p.evaluate((s) => (document.querySelector(s)?.innerText ?? ''), sel);
  const toast = () => p.evaluate(() => [...document.querySelectorAll('.toast, [role=status], .annonce-toast')].map((e) => e.innerText).join(' | '));
  return { b, ctx, p, errs, nav, shot, data, profil, texte, toast };
};
// Modifier les données enregistrées (préparation d'un cas de test), puis recharger la page.
exports.injecter = async (p, fn, arg) => {
  await p.evaluate(([src, a]) => { const e = JSON.parse(localStorage.getItem('releve.v3')); const d = e.officines[e.courante]; const f = new Function('d', 'a', src); f(d, a); localStorage.setItem('releve.v3', JSON.stringify(e)); }, [fn, arg]);
  await p.reload(); await p.waitForTimeout(900);
};
exports.dialogue = (p) => p.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog], dialog, .dialog')].filter((x) => x.getBoundingClientRect().width > 0).pop(); return d ? d.innerText : ''; });
