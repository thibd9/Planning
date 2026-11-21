const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  const addD = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const semaine = async (l) => (await data()).shifts.filter((s) => s.date >= l && s.date <= addD(l, 6));
  const nico = async () => (await semaine('2026-11-30')).filter((s) => s.personId === 'p_camille').map((s) => s.date.slice(8) + ':' + s.start + '-' + s.end);
  const ctrl = async () => ({ pills: await texte('[data-tour="controles"] .card-head .pill'), bloq: (await texte('[data-tour="controles"] .issue.bloquant .issue-message')) });
  const cell = (nom, col) => p.locator('.plan-grid [role=row]').filter({ has: p.locator('.pg-p .nm', { hasText: new RegExp('^' + nom + '$') }) }).locator('.pg-c').nth(col);
  log('Nicolas 30/11 avant', await nico());
  await nav('resoudre');
  await p.locator('#onglet-demandes').click(); await p.waitForTimeout(400);
  const abs = (await data()).absences.find((a) => a.personId === 'p_camille');
  await p.locator(`[data-decider="${abs.id}"]`).click(); await p.waitForTimeout(500);
  log('DECISION dlg', (await dlg(p) || '').slice(0, 600));
  const btns = await texte('[role=dialog] .dialog-foot button'); log('boutons', btns);
  log('choix', await p.evaluate(() => [...document.querySelectorAll('[name=dc-decision]')].map((i) => i.id))); await p.locator('[name=dc-decision]').first().check(); await p.waitForTimeout(200); await p.locator('#dc-confirmer').click(); await p.waitForTimeout(600);
  log('toast', await toast());
  const d1 = await data();
  log('absence statut', d1.absences.find((a) => a.id === abs.id).statut, '| Nicolas 30/11 après', await nico(), '| trous', d1.trous.length);
  log('snapshot 30/11 nicolas', (d1.semaines['2026-11-30'].snapshot || []).filter((s) => s.personId === 'p_camille').length);
  await nav('construire'); await allerSemaine(p, '2026-11-30');
  log('statut semaine', await texte('.plan-bar .pill'));
  await shot('06-absence-approuvee', { fullPage: true });
  log('cellule Nicolas lundi', await cell('Nicolas L.', 0).innerText(), '| bouton + ?', await cell('Nicolas L.', 0).locator('button.add').count());
  // DnD d'un poste sur la case d'absence
  const src = cell('Thomas N.', 0).locator('.tile').first();
  log('Thomas lun', await src.count());
  if (await src.count()) {
    await src.dragTo(cell('Nicolas L.', 0)); await p.waitForTimeout(500);
    log('DnD sur absence : toast', await toast(), '| Nicolas', await nico());
    log('   contrôles', JSON.stringify(await ctrl()));
    log('   cellule', await cell('Nicolas L.', 0).innerText());
    await shot('06-dnd-sur-absence', { fullPage: true });
    await p.locator('[aria-label="Annuler la dernière manipulation"]').click(); await p.waitForTimeout(300);
  }
  // Recopier sur la semaine avec absence
  await p.locator('.plan-bar button', { hasText: 'Recopier' }).click(); await p.waitForTimeout(500);
  log('RECOPIER sur absence : Nicolas', await nico(), '| contrôles', JSON.stringify(await ctrl()));
  log('   pill', await texte('.plan-bar .pill'));
  await shot('06-recopie-sur-absence', { fullPage: true });
  await p.locator('[aria-label="Annuler la dernière manipulation"]').click(); await p.waitForTimeout(300);
  log('après annuler', await nico());
  // Proposer sur la semaine avec absence
  await p.locator('.plan-bar [data-tour="proposer"]').click(); await p.waitForTimeout(400);
  log('PROPOSER dlg', (await dlg(p) || '').slice(0, 300));
  await p.locator('[role=dialog] input[name=mode]').first().check();
  const t0 = Date.now(); await p.locator('[role=dialog] button', { hasText: 'Calculer les propositions' }).click(); await p.waitForSelector('[role=dialog] .variant', { timeout: 120000 }); log('TEMPS ms', Date.now() - t0);
  for (const v of await texte('[role=dialog] .variant')) log('  VAR', v.replace(/\s+/g, ' ').slice(0, 220));
  log('  blocages', await texte('[role=dialog] .issue.diag'));
  await shot('06-propositions-absence');
  await p.locator('[role=dialog] button', { hasText: 'Placer dans le brouillon' }).click(); await p.waitForTimeout(500);
  log('PROPOSER appliqué : Nicolas', await nico(), '| contrôles', JSON.stringify(await ctrl()), '| pill', await texte('.plan-bar .pill'));
  log('   jours passés modifiés ?', (await semaine('2026-11-30')).length);
  log('errs', errs);
  await b.close();
})();
