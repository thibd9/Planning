const { ouvrir } = require('../lib');
(async () => {
  const o = await ouvrir({ role: 5 }); const { p } = o;
  await o.nav('moi');
  await p.locator('.lien-jour', { hasText: 'Mercredi' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.dialog .pill', { hasText: 'Arrêt' }).scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  await o.shot('preuve-jour-18-arret-vu-par-manon');
  for (let i = 0; i < 8; i++) { await p.locator('.dialog button', { hasText: 'Veille' }).click(); await p.waitForTimeout(120); }
  await p.locator('.dialog .pill', { hasText: 'Retard' }).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  await o.shot('preuve-jour-10-retard-jules-vu-par-manon');
  console.log('ok', await p.locator('.dialog .pill').allInnerTexts());
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
