// Les autres options de la carte (heures complémentaires, remplaçant extérieur), « Classer », « à la main ».
const { ouvrir } = require('./lib');
const tst = async () => (await (await ouvrir({ role: 0 })));
(async () => {
  for (const idx of [1, 2]) {
    const o = await ouvrir({ role: 0 }); const { p } = o;
    await o.nav('resoudre');
    const opt = p.locator('.options .option').nth(idx);
    const titre = await opt.locator('h3').innerText();
    await opt.locator('button', { hasText: 'Choisir' }).click(); await p.waitForTimeout(600);
    const d = await o.data();
    const sh = d.shifts.filter((s) => s.date === '2026-11-20' && (s.personId === 'p_lea' || s.personId === 'x_paul'));
    const sn = d.semaines['2026-11-16'].snapshot.filter((s) => s.date === '2026-11-20' && (s.personId === 'p_lea' || s.personId === 'x_paul'));
    console.log(`OPTION ${titre}: brouillon`, JSON.stringify(sh.map((s) => [s.personId, s.start, s.end, s.pauseStart])), 'publié', JSON.stringify(sn.map((s) => [s.personId, s.start, s.end])));
    console.log('  notifs', JSON.stringify(d.notifications.filter((n) => n.date === '2026-11-20').map((n) => [n.personId, n.apres])), 'journal', d.journal[0].titre, '| detail', d.journal[0].detail);
    console.log('  toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
    if (idx === 2) { await o.nav('construire'); await p.waitForTimeout(500); console.log('  Construire semaine contient Paul ?', await p.evaluate(() => document.body.innerText.includes('Paul'))); await o.shot('r6-paul-construire'); }
    await o.b.close();
  }
  // « Classer » : absence de Thomas le 21/11 qui ne découvre rien ; puis « Je règle ce jour à la main » sur Igor.
  const o = await ouvrir({ role: 0 }); const { p } = o;
  await p.getByRole('button', { name: /Retard ou absence/ }).first().click(); await p.waitForTimeout(300);
  await p.selectOption('#sg-qui', 'p_thomas'); await p.locator('label[for=sg-absence]').click();
  await p.fill('#sg-du', '2026-11-21'); await p.fill('#sg-au', '2026-11-21'); await p.locator('#sg-confirmer').click(); await p.waitForTimeout(600);
  await o.nav('resoudre');
  await p.getByRole('button', { name: 'Classer' }).click(); await p.waitForTimeout(500);
  let d = await o.data();
  console.log('CLASSER', JSON.stringify(d.trous.filter((t) => t.shift.date === '2026-11-21').map((t) => [t.statut, t.resolution])), '| toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText), '| journal', d.journal[0].titre);
  await p.getByRole('button', { name: /Voir et choisir la solution/ }).first().click(); await p.waitForTimeout(500);
  for (const fs of await p.locator('fieldset.rs-jour').all()) await fs.locator('.rs-option.libre').click();
  console.log('pied', await p.locator('.dialog-foot, footer').last().innerText().catch(() => ''));
  await p.getByRole('button', { name: /Appliquer mes choix/ }).click(); await p.waitForTimeout(900);
  console.log('A LA MAIN toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText), '| vue', await p.evaluate(() => document.querySelector('.page-head h1, h1')?.innerText), '| url', p.url());
  await o.shot('r6-a-la-main');
  d = await o.data();
  console.log('trous Igor', JSON.stringify(d.trous.filter((t) => t.shift.personId === 'p_karim').map((t) => [t.shift.date, t.statut])));
  console.log('ERR', o.errs); await o.b.close();
})();
