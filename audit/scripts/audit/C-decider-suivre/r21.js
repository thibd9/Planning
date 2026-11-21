// « Annuler » des messages flash : après une suppression de document, après une décision.
const { ouvrir } = require('./lib');
const F = __dirname + '/fichiers/';
(async () => {
  const o = await ouvrir({ role: 0 }); const { p } = o;
  // une décision annulable d'abord : solder Thomas
  await o.nav('heures'); await p.locator('.hc', { hasText: 'Thomas' }).getByRole('button', { name: 'Solder' }).click(); await p.waitForTimeout(500);
  await o.nav('documents'); await p.locator('[role=tab]', { hasText: 'Mes fichiers' }).click();
  await p.locator('input[type=file]').first().setInputFiles(F + 'arret-test.pdf'); await p.waitForTimeout(600);
  let d = await o.data(); console.log('avant suppression : docs', d.documents.length, '| régul', d.regularisations.length);
  await p.locator('[aria-label^="Supprimer"]').first().click(); await p.waitForTimeout(300);
  const t = p.locator('[class*=toast] button', { hasText: 'Annuler' });
  console.log('toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText.replace(/\n/g, ' ')));
  await t.first().click(); await p.waitForTimeout(500);
  d = await o.data(); console.log('après « Annuler » : docs', (d.documents ?? []).length, '| régul', (d.regularisations ?? []).length);
  await o.shot('r21-annuler-suppression');
  // Annuler une décision de Résoudre
  await o.nav('resoudre'); await p.locator('.options .option.reco button', { hasText: 'Choisir' }).click(); await p.waitForTimeout(500);
  await p.locator('[class*=toast] button', { hasText: 'Annuler' }).first().click(); await p.waitForTimeout(500);
  d = await o.data(); console.log('Choisir puis Annuler : trou 20/11', JSON.stringify(d.trous.filter((t) => t.shift.date === '2026-11-20').map((t) => t.statut)), '| Pierre publié', JSON.stringify(d.semaines['2026-11-16'].snapshot.filter((s) => s.personId === 'p_antoine' && s.date === '2026-11-20').map((s) => [s.start, s.end])), '| notif Pierre', d.notifications.filter((n) => n.personId === 'p_antoine').length, '| journal', d.journal[0].titre);
  console.log('ERR', o.errs); await o.b.close();
})();
