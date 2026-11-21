// Ergonomie : chaque écran et chaque fenêtre de mon domaine à 1280×760 et 390×800 (onglets et accordéons comme un utilisateur).
const { ouvrir, injecter } = require('./lib');
const F = require('./fixtures');
const W = +(process.env.W || 1280), H = +(process.env.H || 760), TAG = `${W}`;
const mesurer = (p) => p.evaluate(() => {
  const out = []; const Wd = innerWidth;
  const vis = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const defile = (e) => { for (let x = e.parentElement; x; x = x.parentElement) { const s = getComputedStyle(x); if (/(auto|scroll)/.test(s.overflowX) && x.scrollWidth > x.clientWidth + 1) return true; } return false; };
  if (document.documentElement.scrollWidth > Wd + 1) out.push(`PAGE déborde de ${document.documentElement.scrollWidth - Wd}px`);
  for (const e of document.querySelectorAll('button, a, input, select, textarea, h1, h2, h3, .pill, b')) { if (!vis(e) || defile(e)) continue; const r = e.getBoundingClientRect(); if (r.right > Wd + 2 || r.left < -2) out.push(`HORS ÉCRAN ${e.tagName.toLowerCase()} « ${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30)} »`); }
  for (const e of document.querySelectorAll('h1, h2, h3, b, .btn, span, p, label')) { if (!vis(e) || e.children.length > 3) continue; const s = getComputedStyle(e); if (s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) out.push(`COUPÉ « ${(e.innerText || '').trim().slice(0, 40)} »`); }
  for (const e of document.querySelectorAll('[role=dialog] button, .content button, main button')) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.width < 32 || r.height < 28) out.push(`PETIT ${Math.round(r.width)}×${Math.round(r.height)} « ${(e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 24)} »`); }
  return [...new Set(out)].slice(0, 12);
});
(async () => {
  const o = await ouvrir({ role: 0, w: W, h: H, mode: process.env.MODE }); const { p } = o;
  await injecter(p, F.DEMANDES_REMPLACEMENT + F.CONGE_SARAH);
  const cap = async (nom, plein = false) => { await p.waitForTimeout(350); const m = await mesurer(p); console.log(`${m.length ? '!!' : 'ok'} ${nom}${m.length ? '\n     ' + m.join('\n     ') : ''}`); await p.screenshot({ path: `${__dirname}/captures/e-${TAG}${process.env.MODE ? '-' + process.env.MODE : ''}-${nom}.png`, fullPage: plein }); };
  const fermer = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(250); };
  await o.nav('resoudre'); await cap('resoudre-absences', true);
  await p.locator('#onglet-remplacements').click(); await cap('resoudre-remplacements', true);
  await p.locator('[data-decider="r_audit_medical"]').click(); await p.waitForTimeout(300); await p.locator('label[for=dr-titulaire]').first().click(); await cap('dlg-decision-remplacement');
  await fermer();
  await p.locator('.demande-r', { hasText: 'Demain' }).getByRole('button', { name: 'Refuser' }).click(); await cap('dlg-refus'); await fermer();
  await p.locator('#onglet-demandes').click(); await cap('resoudre-demandes', true);
  await p.locator('[data-decider^="a_"]').first().click(); await p.waitForTimeout(300); await p.locator('label[for=dc-refuser]').click(); await cap('dlg-decision-conge'); await fermer();
  await p.locator('#onglet-gardes').click(); await cap('resoudre-gardes');
  await p.locator('#onglet-absences').click(); await p.getByRole('button', { name: /Voir et choisir la solution/ }).first().click(); await cap('dlg-reglage'); await fermer();
  await p.locator('#top-signaler').click(); await p.waitForTimeout(300); await p.locator('label[for=sg-absence]').click(); await p.getByRole('button', { name: 'Accident du travail' }).click(); await cap('dlg-signaler-accident'); await fermer();
  await o.nav('messages'); await cap('messages');
  await p.locator('#rdv-demander').click(); await cap('dlg-rdv'); await fermer();
  await o.nav('heures'); await cap('heures', true);
  await p.locator('[data-regul]').first().click(); await cap('dlg-regulariser'); await fermer();
  await o.nav('equite'); await cap('equite', true);
  await o.nav('stats'); await cap('stats', true);
  await o.nav('journal'); await cap('journal');
  await p.getByRole('button', { name: /Exporter le dossier/ }).click(); await cap('dlg-export'); await fermer();
  await p.locator('button', { hasText: 'Fiche navette' }).first().click(); await cap('navette', true);
  await o.nav('documents'); await cap('documents');
  await p.locator('[role=tab]', { hasText: 'Mes fichiers' }).click(); await cap('documents-fichiers');
  await p.locator('[role=tab]', { hasText: 'Absences de l’équipe' }).click(); await cap('documents-historique', true);
  await o.nav('aide'); await cap('aide');
  await p.locator('.aide-fab').click(); await p.fill('#aide-question', 'qui travaille demain ?'); await p.keyboard.press('Enter'); await p.waitForTimeout(700); await cap('solvi');
  console.log('ERR', o.errs); await o.b.close();
})();
