// A11 : captures et mesures d'ergonomie à 1280×760 et 390×800 (onglets et accordéons dans leur état réel : PLIE=1).
const { lancer } = require('./outils');
const W = +(process.env.W || 1280), H = +(process.env.H || 760); const T = `${W}`;
const mesurer = (p) => p.evaluate(() => {
  const Wn = innerWidth; const out = [];
  const visible = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const defile = (e) => { for (let x = e.parentElement; x; x = x.parentElement) { const s = getComputedStyle(x); if (/(auto|scroll)/.test(s.overflowX) && x.scrollWidth > x.clientWidth + 1) return x; } return null; };
  if (document.documentElement.scrollWidth > Wn + 1) out.push(`PAGE déborde de ${document.documentElement.scrollWidth - Wn}px`);
  for (const e of document.querySelectorAll('button, a, input, select, h1, h2, h3, .card, .pill, label')) { if (!visible(e) || defile(e) || e.closest('.cx-fond')) continue; const r = e.getBoundingClientRect(); if (r.right > Wn + 2 || r.left < -2) out.push(`HORS ÉCRAN ${e.tagName.toLowerCase()} « ${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)} » ${Math.round(r.left)}→${Math.round(r.right)}`); }
  for (const e of document.querySelectorAll('h1, h2, h3, b, .btn, p, span, option, .espace-officine, select')) { if (!visible(e) || e.children.length > 3) continue; const s = getComputedStyle(e); if (s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) out.push(`COUPÉ « ${(e.textContent || '').trim().slice(0, 40)} »`); }
  for (const e of document.querySelectorAll('input[type=time], input[type=date], input[type=number], select')) { if (!visible(e)) continue; if (e.scrollWidth > e.clientWidth + 2) out.push(`CHAMP TROP ÉTROIT ${e.id || e.getAttribute('aria-label') || e.name || e.type} (${e.clientWidth}px pour ${e.scrollWidth}px)`); }
  for (const e of document.querySelectorAll('button, a.btn, input[type=checkbox], input[type=radio]')) { if (!visible(e) || e.closest('.plan-grid')) continue; const r = e.getBoundingClientRect(); if ((r.width < 24 || r.height < 24) && !(e.type === 'checkbox' || e.type === 'radio') ) out.push(`PETIT ${Math.round(r.width)}×${Math.round(r.height)} « ${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)} »`); }
  return [...new Set(out)].slice(0, 14);
});
(async () => {
  const log = (...a) => console.log(...a);
  // Connexion et création.
  const o = await lancer({ w: W, h: H }); const { p, cap } = o;
  const rel = async (nom, full = false) => { await p.waitForTimeout(350); const r = await mesurer(p); log(`${r.length ? '!!' : 'ok'} ${T} ${nom}${r.length ? '\n     ' + r.join('\n     ') : ''}`); await cap(`e-${T}-${nom}`, { fullPage: full }); };
  await rel('connexion', true);
  await p.getByRole('button', { name: /Créer ma pharmacie/ }).click(); await rel('creation-1', true);
  await p.locator('.accueil-actions button[type=submit]').click(); await rel('creation-1-erreur', true);
  await p.fill('#officine-nom', 'Pharmacie Test'); await p.locator('.accueil-actions button[type=submit]').click(); await rel('creation-2', true);
  await p.locator('.accueil-actions button[type=submit]').click(); await rel('creation-2-erreurs', true);
  await p.fill('#tit-prenom', 'Anne'); await p.fill('#tit-nom', 'Lemoine'); await p.fill('#tit-identifiant', 'anne.lemoine'); await p.fill('#tit-mdp', 'secret12');
  await p.locator('.accueil-actions button[type=submit]').click(); await rel('creation-3', true);
  await o.b.close();
  // Exemple, Caroline : les écrans du domaine.
  const { exemple } = require('./outils');
  const x = await exemple({ role: 0, w: W, h: H }); const q = x.p;
  await x.fermerTour();
  const rel2 = async (nom, full = true) => { await q.waitForTimeout(400); const r = await mesurer(q); log(`${r.length ? '!!' : 'ok'} ${T} ${nom}${r.length ? '\n     ' + r.join('\n     ') : ''}`); await x.cap(`e-${T}-${nom}`, { fullPage: full }); };
  await x.nav('officine'); await rel2('reglages-pharmacie');
  for (const [cle, nom] of [['horaires', 'Horaires'], ['comptoir', 'Comptoir'], ['planning', 'Planning'], ['parametres', 'Paramètres']]) { await q.locator('[role=tab]', { hasText: nom }).first().click(); await rel2(`reglages-${cle}`); }
  await q.locator('[role=tab]', { hasText: 'Planning' }).first().click(); await q.waitForTimeout(200);
  const postes = q.locator('#acc-postes summary, #acc-postes button[aria-expanded]').first(); if (await postes.count()) { await postes.click(); await rel2('reglages-postes-types'); }
  await q.getByRole('button', { name: 'Ajouter un poste type' }).click().catch(() => {}); await rel2('dialogue-poste-type', false); await q.keyboard.press('Escape');
  await x.nav('equipe'); await rel2('equipe');
  await q.locator('[data-focus="ajouter-personne"]').click(); await rel2('dialogue-ajout-personne', false); await q.keyboard.press('Escape'); await q.waitForTimeout(200);
  await q.locator('.g-item', { hasText: 'Sarah' }).first().click().catch(() => {}); await rel2('equipe-fiche-animatrice');
  await x.nav('regles'); await rel2('regles');
  await q.locator('details.rg').first().locator('summary').click(); await rel2('regles-fiche-ouverte', false);
  await q.locator('.compte-btn').click(); await q.waitForTimeout(250); await rel2('menu-compte', false);
  await q.locator('.menu button', { hasText: 'Mon compte' }).click(); await rel2('compte');
  log('ERREURS console :', [...o.errs, ...x.errs].join(' || ') || 'aucune');
  await x.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
