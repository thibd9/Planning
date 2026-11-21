const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav, bascule } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  await nav('construire');
  await p.locator('.ph-outils button', { hasText: 'Mois' }).click(); await p.waitForTimeout(600);
  log('MOIS', await texte('.plan.mois .week-nav .label'));
  await shot('09-mois-novembre');
  log('semaines passées bouton', await texte('.mo-anciennes'));
  log('entêtes semaines', await texte('.mo-semaines th'));
  await p.locator('.mo-anciennes').click(); await p.waitForTimeout(400);
  log('après « Semaines passées »', await texte('.mo-semaines th'), await texte('.mo-anciennes'));
  await shot('09-mois-semaines-passees');
  // Décembre
  await p.locator('[aria-label="Mois suivant"]').click(); await p.waitForTimeout(500);
  log('DEC', await texte('.plan.mois .week-nav .label'), await texte('.plan.mois .plan-bar .pill'));
  log('DEC entêtes', await texte('.mo-semaines th'));
  await p.locator('#mois-reponses').click(); await p.waitForTimeout(300);
  log('DEC réponses', await texte('#mois-reponses-liste .mo-rep-col'));
  await shot('09-mois-dec-reponses');
  // Relancer la première personne sans réponse
  const rel = p.locator('[data-relancer]').first();
  const qui = await rel.getAttribute('data-relancer');
  await rel.click(); await p.waitForTimeout(300);
  log('RELANCER toast', await toast());
  let d = await data();
  const msg = d.messages.filter((m) => m.a === qui);
  log('RELANCER message', qui, JSON.stringify(msg.slice(-1)));
  // double clic : deux messages ?
  await rel.click(); await p.waitForTimeout(200);
  d = await data(); log('RELANCER 2e clic : messages à', qui, d.messages.filter((m) => m.a === qui).length);
  // poser un poste depuis une case
  const cases = p.locator('.mo-poser');
  log('cases posables', await cases.count());
  await cases.first().click(); await p.waitForTimeout(400);
  log('POSER depuis case dlg', ((await dlg(p)) || '').slice(0, 120));
  await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(400);
  log('POSER toast', await toast());
  log('DEC label après', await texte('.plan.mois .week-nav .label'));
  // Corriger automatiquement
  const t0 = Date.now();
  await p.locator('button', { hasText: 'Corriger automatiquement' }).click();
  await p.waitForSelector('.mo-bilan', { timeout: 120000 }); log('CORRIGER temps ms', Date.now() - t0);
  log('CORRIGER bilan', await texte('.mo-bilan'), '| toast', await toast());
  d = await data();
  const decem = (l) => d.shifts.filter((s) => s.date >= l && s.date <= l.replace(/\d\d$/, (x) => String(+x + 6).padStart(2, '0'))).length;
  log('postes par semaine', ['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28'].map((l) => l + ':' + d.shifts.filter((s) => s.date >= l && s.date < new Date(new Date(l).getTime() + 7 * 864e5).toISOString().slice(0, 10)).length).join(' '));
  log('postes le 25/12', d.shifts.filter((s) => s.date === '2026-12-25').length, '| 1/1', d.shifts.filter((s) => s.date === '2027-01-01').length);
  log('effectif row', (await texte('.mo-effectif td')).join(' '));
  await shot('09-mois-corrige');
  // Contrôles semaine par semaine après correction
  // Publier le mois
  await p.locator('#mois-publier').click(); await p.waitForTimeout(600);
  log('PUBLIER MOIS toast', await toast());
  d = await data();
  log('statuts', Object.entries(d.semaines).filter(([k]) => k >= '2026-11-30').map(([k, v]) => k + ':' + v.statut).join(' '));
  log('DEC label', await texte('.plan.mois .week-nav .label'));
  log('notifs total', d.notifications.length, '| journal[0..3]', d.journal.slice(0, 4).map((j) => j.titre).join(' / '));
  // Retouche dans une semaine publiée puis « Publier le mois »
  await p.locator('.mo-c.mo-poser, button.mo-c').nth(3).click(); await p.waitForTimeout(300);
  const t = (await dlg(p)) || ''; log('retouche dlg', t.slice(0, 80));
  if (t) { const ins = p.locator('[role=dialog] .dp-horaires input[type=time]'); await ins.nth(1).fill('18:00'); await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(300); }
  log('après retouche label', await texte('.plan.mois .week-nav .label'), 'publier mois désactivé ?', await p.locator('#mois-publier').isDisabled());
  // Remettre le mois à zéro
  await p.locator('#mois-zero').click(); await p.waitForTimeout(500);
  log('ZERO toast', await toast());
  d = await data();
  log('après zéro : postes décembre', d.shifts.filter((s) => s.date.startsWith('2026-12')).length, '| snapshots publiés intacts', Object.entries(d.semaines).filter(([k]) => k >= '2026-12-07').map(([k, v]) => k + ':' + v.statut + ':' + (v.snapshot || []).length).join(' '));
  log('label', await texte('.plan.mois .week-nav .label'));
  await shot('09-mois-zero');
  log('errs', errs);
  // Côté personne relancée
  const pers = d.personnes.find((x) => x.id === qui);
  log('relancé', pers.prenom, pers.qualification);
  await b.close();
})();
