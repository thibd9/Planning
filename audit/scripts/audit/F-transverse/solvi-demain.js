const { ouvrir } = require('../../lib');
(async () => {
  const { b, p } = await ouvrir({ w: 1440, h: 900 });
  await p.evaluate(() => document.querySelector('[data-tour="nav-tableau"]')?.click()); await p.waitForTimeout(500);
  await p.locator('.aide-fab').click(); await p.waitForTimeout(300);
  await p.fill('#aide-question', 'Qui travaille demain ?'); await p.locator('.aide-envoyer').click(); await p.waitForTimeout(1200);
  console.log(JSON.stringify({ li: await p.locator('.aide-bulle.bot li').count(), texte: (await p.locator('.aide-bulle.bot').last().innerText()).slice(0, 400) }));
  await b.close();
})();
