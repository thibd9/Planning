const { ouvrir } = require('./lib');
(async () => {
  const o = await ouvrir({ role: 0 }); const { p } = o;
  await p.getByRole('button', { name: /Retard ou absence/ }).first().click(); await p.waitForTimeout(400);
  await p.selectOption('#sg-qui', process.env.QUI || 'p_thomas'); await p.locator('label[for=sg-absence]').click();
  await p.fill('#sg-du', process.env.DU || '2026-11-21'); await p.fill('#sg-au', process.env.DU || '2026-11-21');
  await p.locator('#sg-confirmer').click(); await p.waitForTimeout(700);
  await o.nav('resoudre');
  console.log(await p.locator('#panneau-decisions').innerText());
  await o.shot('r4b-' + (process.env.QUI || 'p_thomas'), { fullPage: true });
  await o.b.close();
})();
