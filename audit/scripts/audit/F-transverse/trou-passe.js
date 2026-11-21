const { ouvrir } = require('../../lib');
(async () => {
  const { b, p } = await ouvrir({ w: 1440, h: 900 });
  await p.evaluate(() => document.querySelector('[data-tour="nav-tableau"]')?.click()); await p.waitForTimeout(600);
  const tb = await p.evaluate(() => [...document.querySelectorAll('.content *')].find((e) => /À FAIRE EN PREMIER/i.test(e.textContent) && e.children.length < 8)?.closest('.card, section')?.innerText.replace(/\s+/g, ' ').slice(0, 260));
  await p.evaluate(() => document.querySelector('[data-tour="nav-resoudre"]')?.click()); await p.waitForTimeout(800);
  const rs = (await p.evaluate(() => document.querySelector('.content').innerText)).replace(/\s+/g, ' ').slice(0, 700);
  console.log('HEURE', new Date().toISOString()); console.log('TABLEAU', tb); console.log('RÉSOUDRE', rs);
  await p.screenshot({ path: __dirname + '/resoudre-tard.png' }); await b.close();
})();
