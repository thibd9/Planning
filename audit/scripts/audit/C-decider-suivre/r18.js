const { ouvrir } = require('./lib');
(async () => {
  const o = await ouvrir({ role: 0 }); const { p } = o;
  await o.nav('stats'); await p.waitForTimeout(600);
  console.log('STATS', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(0, 9000));
  await o.shot('r18-stats', { fullPage: true });
  const d = await o.data(); require('fs').writeFileSync(__dirname + '/etat-seed2.json', JSON.stringify(d));
  await o.b.close();
})();
