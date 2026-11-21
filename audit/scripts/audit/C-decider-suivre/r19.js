// Journal et paie : entrées après des actions, filtres, export du dossier (événement download), fiche navette et export CSV.
const { ouvrir, dialogue } = require('./lib');
(async () => {
  const o = await ouvrir({ role: 0 }); const { p } = o;
  // Quelques actions
  await o.nav('resoudre'); await p.locator('.options .option.reco button', { hasText: 'Choisir' }).click(); await p.waitForTimeout(500);
  await p.locator('#onglet-remplacements').click(); await p.locator('.demande-r').first().getByRole('button', { name: 'Refuser' }).click(); await p.waitForTimeout(300); await p.locator('[role=dialog] button.btn.danger').click(); await p.waitForTimeout(400);
  await o.nav('messages'); await p.fill('#msg-texte', 'Test journal'); await p.locator('form button[type=submit]').click(); await p.waitForTimeout(300);
  await o.nav('heures'); await p.locator('.hc', { hasText: 'Thomas' }).getByRole('button', { name: 'Solder' }).click(); await p.waitForTimeout(400);
  await p.locator('[aria-label^="Retirer la régularisation"]').first().click(); await p.waitForTimeout(300);
  await o.nav('journal'); await p.waitForTimeout(500);
  console.log('JOURNAL', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(0, 2200));
  await o.shot('r19-journal', { fullPage: false });
  console.log('FILTRES', await p.evaluate(() => [...document.querySelectorAll('.jr-filtre')].map((b) => b.innerText.trim()).join(' / ')));
  for (const f of ['Corrections', 'Absences', 'Publications']) { await p.locator('.jr-filtre', { hasText: f }).click(); await p.waitForTimeout(200); console.log(`  filtre ${f}`, await p.locator('article.jr').count(), 'entrées ; natures', JSON.stringify([...new Set(await p.locator('.jr-nature').allInnerTexts())])); }
  await p.locator('.jr-filtre', { hasText: 'Tout' }).click();
  // Export du dossier
  let telecharge = null; p.on('download', (dl) => { telecharge = dl; });
  await p.getByRole('button', { name: /Exporter le dossier/ }).click(); await p.waitForTimeout(1200);
  console.log('EXPORT download ?', !!telecharge, telecharge ? telecharge.suggestedFilename() : '');
  const dl = await dialogue(p); console.log('EXPORT dialogue', dl.slice(0, 400));
  const contenu = await p.locator('#export-contenu').inputValue().catch(() => '');
  if (contenu) { const j = JSON.parse(contenu); console.log('  contenu : clés', Object.keys(j).join(','), '| journal', j.journal.length, '| accusés', j.accusesDeLecture.length, '| règles', j.regles.length, '| taille', contenu.length); console.log('  1re entrée', JSON.stringify(j.journal[0]).slice(0, 300)); }
  await o.shot('r19-export-dossier');
  await p.getByRole('button', { name: /Copier le contenu/ }).click().catch(() => {}); await p.waitForTimeout(300);
  console.log('  bouton copie', await p.getByRole('button', { name: /Copi/ }).first().innerText().catch(() => '-'));
  await p.getByRole('button', { name: 'Fermer' }).click().catch(() => {});
  // Fiche navette
  await p.getByRole('radio', { name: 'Fiche navette' }).or(p.getByRole('button', { name: 'Fiche navette' })).first().click(); await p.waitForTimeout(400);
  console.log('NAVETTE', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(0, 2500));
  await o.shot('r19-navette', { fullPage: true });
  await p.getByRole('button', { name: /Exporter pour le comptable/ }).click(); await p.waitForTimeout(800);
  const csv = await p.locator('#export-contenu').inputValue().catch(() => '');
  console.log('CSV', csv.slice(0, 1200));
  await p.getByRole('button', { name: 'Fermer' }).click().catch(() => {});
  await p.getByRole('button', { name: 'Mois précédent' }).click(); await p.waitForTimeout(300);
  console.log('NAVETTE octobre', (await p.locator('.chiffres').innerText()).replace(/\n+/g, ' | '));
  console.log('ERR', o.errs); await o.b.close();
})();
