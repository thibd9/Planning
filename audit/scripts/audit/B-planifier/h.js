// Aide commune B-planifier : ouvre l'exemple sous un rôle, captures dans B-planifier/captures.
const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad';
exports.B = __dirname;
exports.ouvrir = async ({ role = 0, w = 1440, h = 900, mode, url = 'http://localhost:5180/' } = {}) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR', deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('PAGE ' + e.message)); p.on('console', (m) => (m.type() === 'error' || /same key/.test(m.text())) && errs.push(m.text().slice(0, 300)));
  p.on('dialog', (d) => { errs.push('DIALOG ' + d.message().slice(0, 200)); d.accept(); });
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(300); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').nth(role).click(); await p.waitForTimeout(700);
  if (mode) { await p.evaluate((m) => { const o = {}; for (const id of ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste']) o[id] = { theme: 'ciel', texte: 'normal', mode: m }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }, mode); await p.reload(); await p.waitForTimeout(600); }
  const nav = async (v) => { await p.evaluate((v) => { const e = [...document.querySelectorAll(`[data-tour="nav-${v}"]`)].find((x) => x.getBoundingClientRect().width > 0) ?? document.querySelector(`[data-tour="nav-${v}"]`); e?.click(); }, v); await p.waitForTimeout(600); };
  const shot = (nom, opt = {}) => p.screenshot({ path: `${__dirname}/captures/${nom}.png`, ...opt });
  const data = () => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('releve.v3')); return s.officines ? s.officines[s.courante] : s; });
  const bascule = async (txt) => { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(300); await p.locator('.bandeau-test button', { hasText: txt }).first().click(); await p.waitForTimeout(700); };
  const texte = (sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => e.innerText.replace(/\s+/g, ' ').trim()), sel);
  return { b, ctx, p, errs, nav, shot, data, bascule, texte };
};
// Va à la semaine du lundi `cible` (ISO) ou dont le libellé contient `cible`.
const MOISN = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const lundiDuLibelle = (l) => { const m = l.match(/^(\d+)(?: (\S+))? – (\d+) (\S+) (\d{4})/); if (!m) return null; const an = +m[5]; const moisFin = MOISN.indexOf(m[4]); const moisDeb = m[2] ? MOISN.indexOf(m[2]) : moisFin; const anDeb = moisDeb > moisFin ? an - 1 : an; return `${anDeb}-${String(moisDeb + 1).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`; };
exports.allerSemaine = async (p, cible) => {
  for (let i = 0; i < 60; i++) {
    const l = await p.locator('.week-nav .label').first().innerText();
    if (!/^\d{4}-/.test(cible) && l.includes(cible)) return true;
    const cur = lundiDuLibelle(l);
    if (/^\d{4}-/.test(cible) && cur === cible) return true;
    const avant = /^\d{4}-/.test(cible) ? cur < cible : true;
    await p.locator(avant ? '[aria-label="Semaine suivante"]' : '[aria-label="Semaine précédente"]').first().click(); await p.waitForTimeout(200);
  }
  return false;
};
exports.dlg = async (p) => p.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\n+/g, ' | ') : null; });
exports.toast = async (p) => p.evaluate(() => [...document.querySelectorAll('.toast, [role=status].toast, .toaster *')].map((e) => e.innerText).join(' / '));
