const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  const ou = async () => ({ vue: await p.evaluate(() => document.querySelector('[data-tour^="nav-"][aria-current="page"]')?.getAttribute('data-tour')), onglet: await texte('.ong-onglet[aria-selected="true"]'), semaine: await texte('.week-nav .label'), dlg: ((await dlg(p)) || '').slice(0, 60) });
  const essai = async (nom, sel, txt) => { await nav('tableau'); const l = txt ? p.locator(sel, { hasText: txt }).first() : p.locator(sel).first(); if (!(await l.count())) { log(nom, 'ABSENT'); return; } await l.click(); await p.waitForTimeout(600); log(nom, JSON.stringify(await ou())); await p.keyboard.press('Escape'); await p.waitForTimeout(200); };
  await essai('Priorité « Couvrir l’absence »', '.tb-priorite button', 'Couvrir');
  await essai('« Tout voir »', '.tb-faire .card-head button');
  for (const s of ['Absences à couvrir', 'Remplacements', 'Demandes de l’équipe', 'Gardes']) await essai(`Sujet ${s}`, '.tb-sujet', s);
  await essai('Cycle bouton', '.cycle .cycle-tete button');
  await essai('Agenda « Mon planning »', '.tb-agenda .card-head button');
  await essai('Comptoir « Voir la journée »', '.tb-jour .card-head button');
  // Tout marquer comme lu (décisions récentes)
  await nav('tableau');
  log('cloche avant', await texte('.top-ico .pastille-n'));
  const tl = p.locator('.tb-annonces button', { hasText: 'Tout marquer' });
  if (await tl.count()) { await tl.click(); await p.waitForTimeout(300); log('cloche après « Tout marquer comme lu »', await texte('.top-ico .pastille-n')); }
  // Échéance : Préparer décembre
  log('ÉCHÉANCE', await texte('.tb-echeance'));
  const t0 = Date.now();
  await p.locator('#echeance-preparer').click(); await p.waitForTimeout(800);
  log('PRÉPARER temps ms ~', Date.now() - t0, '| toast', await toast(), '|', JSON.stringify(await ou()));
  log('   mois', await texte('.plan.mois .week-nav .label'));
  const d = await data();
  log('   semaines', Object.entries(d.semaines).filter(([k]) => k >= '2026-12-07').map(([k, v]) => k + ':' + v.statut).join(' '), '| postes déc', ['2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28'].map((l) => d.shifts.filter((s) => s.date >= l && s.date < new Date(new Date(l).getTime() + 7 * 864e5).toISOString().slice(0, 10)).length).join(','), '| 25/12', d.shifts.filter((s) => s.date === '2026-12-25').length);
  await shot('16-preparer-decembre');
  await nav('tableau');
  log('TABLEAU après préparation', await texte('.tb-echeance'), await texte('.cycle'));
  await shot('16-tableau-apres');
  // Contrôles des semaines préparées
  await nav('construire'); await p.locator('.ph-outils button', { hasText: 'Semaine' }).click(); await p.waitForTimeout(300);
  for (const l of ['2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28']) { await allerSemaine(p, l); log('  contrôles', l, await texte('[data-tour="controles"] .card-head .pill')); }
  log('errs', errs);
  await b.close();
})();
