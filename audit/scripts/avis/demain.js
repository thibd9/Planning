const { ouvrir } = require('../lib');
(async () => {
  const { b, p, errs } = await ouvrir({ role: 0 });
  await p.locator('.solvi-bouton, [aria-label*="Solvi"], .solvi').first().click().catch(() => {});
  await p.waitForTimeout(500);
  if (!(await p.locator('#aide-question').count())) { await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Aide/.test(x.textContent))?.click()); await p.waitForTimeout(500); }
  await p.fill('#aide-question', 'Qui travaille demain ?'); await p.locator('.aide-envoyer').click(); await p.waitForTimeout(1200);
  console.log((await p.locator('.aide-bulle.bot').last().innerText()).slice(0, 400));
  console.log('date appli :', await p.evaluate(() => new Date().toString().slice(0, 15)), errs.join(' ; '));
  await b.close();
})();
