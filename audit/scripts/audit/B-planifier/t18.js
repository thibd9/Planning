const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  const sig = (d) => d.shifts.filter((s) => s.date >= '2026-11-16' && s.date <= '2026-11-19').map((s) => s.personId + s.date + s.start + '-' + s.end).sort().join('|');
  const passes = async () => { const d = await data(); return { n: d.shifts.filter((s) => s.date >= '2026-11-16' && s.date <= '2026-11-19').length, sig: sig(d) }; };
  await nav('heures'); const h0 = await texte('.chiffres .chiffre');
  await nav('construire'); await allerSemaine(p, '2026-11-16');
  const a0 = await passes();
  log('semaine en cours : boutons', await texte('.plan-bar .right button'));
  // Recopier sur la semaine en cours
  await p.locator('.plan-bar button', { hasText: 'Recopier' }).click(); await p.waitForTimeout(400);
  const a1 = await passes(); log('RECOPIER : jours passés (16-19) modifiés ?', a0.sig !== a1.sig, a0.n, '->', a1.n, '| pill', await texte('.plan-bar .pill'));
  await nav('heures'); log('HEURES après recopie (non publiée)', await texte('.chiffres .chiffre'), 'avant', h0);
  await nav('construire'); await allerSemaine(p, '2026-11-16');
  await p.locator('[aria-label="Annuler la dernière manipulation"]').click(); await p.waitForTimeout(300);
  log('annulé', (await passes()).sig === a0.sig);
  // Proposer sur la semaine en cours
  await p.locator('.plan-bar [data-tour="proposer"]').click(); await p.waitForTimeout(300);
  await p.locator('[role=dialog] input[name=mode]').first().check(); await p.locator('[role=dialog] button', { hasText: 'Calculer les propositions' }).click();
  await p.waitForSelector('[role=dialog] .variant', { timeout: 60000 });
  await p.locator('[role=dialog] button', { hasText: 'Placer dans le brouillon' }).click(); await p.waitForTimeout(400);
  const a2 = await passes(); log('PROPOSER (repartir vide) : jours passés modifiés ?', a0.sig !== a2.sig, a0.n, '->', a2.n, '| pill', await texte('.plan-bar .pill'));
  await shot('18-proposer-semaine-en-cours', { fullPage: true });
  await p.locator('[aria-label="Annuler la dernière manipulation"]').click(); await p.waitForTimeout(300);
  // Remettre à zéro sur la semaine en cours
  await p.locator('#plan-zero').click(); await p.waitForTimeout(300);
  const a3 = await passes(); log('ZERO : jours passés modifiés ?', a0.sig !== a3.sig, '| toast', await toast());
  log('errs', errs);
  await b.close();
})();
