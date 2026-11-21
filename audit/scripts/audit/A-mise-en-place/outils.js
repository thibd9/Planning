// Outils de l'audit A (mise en place) : lancer un navigateur, capturer, lire les données, se déconnecter.
const { chromium } = require('playwright');
const DIR = __dirname;
exports.lancer = async ({ w = 1440, h = 900, vide = true } = {}) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR', deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('PAGE ' + e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 300)));
  await p.goto('http://localhost:5180/');
  if (vide) { await p.evaluate(() => localStorage.clear()); await p.reload(); }
  await p.waitForTimeout(500);
  const cap = (nom, opt = {}) => p.screenshot({ path: `${DIR}/captures/${nom}.png`, ...opt });
  const etat = () => p.evaluate(() => JSON.parse(localStorage.getItem('releve.v3') || 'null'));
  const courante = async () => { const e = await etat(); return e && e.officines[e.courante]; };
  const fermerTour = async () => { for (let i = 0; i < 3; i++) { const t = p.locator('.tour-fermer'); if (await t.count()) { await t.first().click(); await p.waitForTimeout(250); } } };
  const nav = async (v) => { await p.evaluate((v) => { const e = [...document.querySelectorAll(`[data-tour="nav-${v}"]`)].find((x) => x.getBoundingClientRect().width > 0) ?? document.querySelector(`[data-tour="nav-${v}"]`); e && e.click(); }, v); await p.waitForTimeout(450); };
  const deconnecter = async () => {
    await p.locator('.compte-btn').click(); await p.waitForTimeout(200);
    await p.locator('.menu button', { hasText: 'Se déconnecter' }).click(); await p.waitForTimeout(400);
    const q = p.getByRole('button', { name: /Me déconnecter quand même/ }); if (await q.count()) { await q.click(); await p.waitForTimeout(300); }
  };
  const connecter = async (id, mdp) => { await p.fill('#cx-identifiant', id); await p.fill('#cx-mdp', mdp); await p.locator('.cx-valider button[type=submit]').click(); await p.waitForTimeout(600); };
  const texte = (sel = 'body') => p.locator(sel).first().innerText();
  const toast = async () => (await p.locator('.toast').count()) ? (await p.locator('.toast').first().innerText()) : '';
  return { b, ctx, p, errs, cap, etat, courante, fermerTour, nav, deconnecter, connecter, texte, toast };
};
// Entrer dans l'exemple sous un profil (0 Caroline … 6 Yanis), comme $S/lib.js.
exports.exemple = async ({ role = 0, w = 1440, h = 900 } = {}) => {
  const o = await exports.lancer({ w, h });
  await o.p.getByRole('button', { name: /Comment ça marche/ }).click(); await o.p.waitForTimeout(300);
  await o.p.locator('#dc-onglet-libre').click(); await o.p.locator('.dc-role').nth(role).click(); await o.p.waitForTimeout(700);
  return o;
};
