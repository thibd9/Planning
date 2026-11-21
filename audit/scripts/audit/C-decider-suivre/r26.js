const { ouvrir } = require('./lib');
(async () => {
  const o = await ouvrir({ role: 0, w: 390, h: 800 }); const { p } = o;
  await o.nav('messages'); await p.waitForTimeout(600);
  const r = await p.evaluate(() => { const out = []; for (const e of document.querySelectorAll('*')) { if (e.scrollLeft > 0) out.push(`${e.tagName}.${String(e.className).slice(0, 30)} scrollLeft=${e.scrollLeft} sw=${e.scrollWidth} cw=${e.clientWidth}`); } return { sx: scrollX, out, docW: document.documentElement.scrollWidth }; });
  console.log(JSON.stringify(r));
  await p.screenshot({ path: __dirname + '/captures/r26-messages-390.png' });
  // fil : où est la zone d'écriture ?
  console.log('zone texte y =', await p.evaluate(() => Math.round(document.querySelector('#msg-texte').getBoundingClientRect().top + scrollY)), 'hauteur page', await p.evaluate(() => document.documentElement.scrollHeight));
  await p.locator('.msg-fil', { hasText: 'Nicolas' }).click(); await p.waitForTimeout(400);
  console.log('après clic Nicolas : fil visible ?', await p.evaluate(() => { const r = document.querySelector('.fil').getBoundingClientRect(); return [Math.round(r.top), innerHeight]; }));
  await p.screenshot({ path: __dirname + '/captures/r26-messages-390-nicolas.png' });
  await o.b.close();
})();
