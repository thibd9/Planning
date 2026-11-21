// Reprendre un état enregistré (storageState) dans un nouveau navigateur.
const { chromium } = require('playwright');
const base = require('./outils');
exports.reprendre = async (fichier, { w = 1440, h = 900 } = {}) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR', deviceScaleFactor: 1, storageState: fichier });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('PAGE ' + e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 300)));
  await p.goto('http://localhost:5180/'); await p.waitForTimeout(700);
  const DIR = __dirname;
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
  const connecter = async (id, mdp) => { await p.fill('#cx-identifiant', id); await p.fill('#cx-mdp', mdp); await p.locator('.cx-valider button[type=submit]').click(); await p.waitForTimeout(700); };
  const texte = (sel = 'body') => p.locator(sel).first().innerText();
  const toast = async () => (await p.locator('.toast').count()) ? (await p.locator('.toast').first().innerText()) : '';
  const sauver = (nom) => ctx.storageState({ path: `${DIR}/${nom}` });
  return { b, ctx, p, errs, cap, etat, courante, fermerTour, nav, deconnecter, connecter, texte, toast, sauver };
};
