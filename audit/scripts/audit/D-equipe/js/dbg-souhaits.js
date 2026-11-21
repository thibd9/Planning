const { ouvrir } = require('../lib');
(async () => {
  const o = await ouvrir({ role: 6 }); const { p } = o;
  await o.nav('demandes');
  await p.locator('.sh-palette button', { hasText: 'Matin' }).click();
  await p.locator('.sh-mois button.sh-jour').nth(0).click(); await p.waitForTimeout(300);
  await o.shot('dbg-souhaits2');
  console.log(await p.evaluate(() => document.querySelector('.sh-mois')?.innerHTML.slice(0, 600)));
  console.log(await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 200)), await p.evaluate(() => document.querySelector('.content')?.innerText.slice(0, 300)));
  await o.b.close();
})();
