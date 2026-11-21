// Équité, Statistiques, Équipe : relevé des chiffres affichés.
const { ouvrir } = require('./lib');
(async () => {
  const o = await ouvrir({ role: 0 }); const { p } = o;
  await o.nav('equite'); await p.waitForTimeout(400);
  console.log('EQUITE', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(0, 2500));
  await o.shot('r17-equite', { fullPage: true });
  for (const f of ['Fermetures en semaine', 'Gardes et astreintes', 'Dépannages assurés', 'Changements tardifs absorbés', 'Demandes refusées']) {
    await p.locator('.jr-filtre', { hasText: f }).click(); await p.waitForTimeout(250);
    console.log(`EQUITE ${f}`, (await p.locator('section.card').first().innerText()).replace(/\n+/g, ' | ').slice(0, 900));
  }
  await p.locator('.jr-filtre', { hasText: 'Changements tardifs' }).click(); await o.shot('r17-equite-tardifs');
  for (const per of ['12 semaines', '6 mois']) { await p.getByRole('radio', { name: per }).or(p.getByRole('button', { name: per })).first().click(); await p.waitForTimeout(250); console.log('PERIODE', per, (await p.locator('.chiffres').innerText()).replace(/\n+/g, ' | ')); }
  await o.nav('statistiques'); await p.waitForTimeout(500);
  console.log('\nSTATS', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(0, 7000));
  await o.shot('r17-stats', { fullPage: true });
  await o.nav('equipe'); await p.waitForTimeout(500);
  console.log('\nEQUIPE', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(0, 2500));
  await o.shot('r17-equipe', { fullPage: true });
  await o.b.close();
})();
