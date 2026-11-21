// Gardes et « À publier » dans Résoudre.
const { ouvrir, injecter, dialogue } = require('./lib');
(async () => {
  let o = await ouvrir({ role: 0 }); let p = o.p;
  await o.nav('resoudre'); await p.locator('#onglet-gardes').click(); await p.waitForTimeout(300);
  console.log('GARDES', (await p.locator('#panneau-decisions').innerText()));
  await o.shot('r9-gardes');
  await p.getByRole('button', { name: /Relire/ }).first().click(); await p.waitForTimeout(700);
  console.log('RELIRE ->', (await dialogue(p)).slice(0, 1500), '| h1', await p.evaluate(() => document.querySelector('h1')?.innerText));
  await o.shot('r9-relire');
  const valider = p.getByRole('button', { name: /Valider/ }).first();
  if (await valider.count()) { console.log('bouton', await valider.innerText()); await valider.click(); await p.waitForTimeout(500); }
  let d = await o.data(); console.log('garde 24/10 valideLe', d.gardes.find((g) => g.date === '2026-10-24').valideLe, '| journal', d.journal[0].titre);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await o.nav('resoudre'); await p.locator('#onglet-gardes').click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Affecter/ }).first().click(); await p.waitForTimeout(700);
  console.log('AFFECTER ->', (await dialogue(p)).slice(0, 1800));
  await o.shot('r9-affecter');
  await o.b.close();
  // À publier : une retouche du brouillon d'une semaine publiée (un poste de Jules retiré le 24/11)
  o = await ouvrir({ role: 0 }); p = o.p;
  await injecter(p, `const i = d.shifts.findIndex((s) => s.personId === 'p_jules' && s.date === '2026-11-24'); d.shifts.splice(i, 1);`);
  await o.nav('resoudre'); await p.locator('#onglet-publications').click(); await p.waitForTimeout(300);
  console.log('A PUBLIER', await p.locator('#panneau-decisions').innerText());
  await o.shot('r9-a-publier');
  await p.locator('[data-publier]').first().click(); await p.waitForTimeout(900);
  console.log('-> h1', await p.evaluate(() => document.querySelector('h1')?.innerText), '| semaine', await p.evaluate(() => document.querySelector('.week-nav .label, .sem-titre, h2')?.innerText), '| toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  await o.shot('r9-publier-modifs');
  console.log('ERR', o.errs); await o.b.close();
})();
