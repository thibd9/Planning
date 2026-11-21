const { ouvrir, allerSemaine } = require('./h.js');
(async () => {
  const { b, p, errs, texte, nav } = await ouvrir({ role: 0 });
  await nav('construire'); await allerSemaine(p, '2026-12-14');
  await p.getByRole('button', { name: 'Ajouter un poste à Nicolas L. lundi' }).click(); await p.waitForTimeout(300);
  await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(400);
  console.log('titres', await texte('[data-tour="controles"] .issues-titre'));
  console.log('pills', await texte('[data-tour="controles"] .card-head .pill'));
  const c = p.locator('[data-tour="controles"]'); await c.scrollIntoViewIfNeeded();
  await p.evaluate(() => { const e = document.querySelector('[data-tour="controles"]'); e.scrollIntoView(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: __dirname + '/captures/19-controles-blocages.png' });
  console.log('errs', errs);
  await b.close();
})();
