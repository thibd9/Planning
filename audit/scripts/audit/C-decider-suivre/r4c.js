const { ouvrir } = require('./lib');
(async () => {
  for (const [qui, du] of [['p_ines', '2026-11-24'], ['p_camille', '2026-11-26'], ['p_jules', '2026-11-23']]) {
    const o = await ouvrir({ role: 0 }); const { p } = o;
    await p.getByRole('button', { name: /Retard ou absence/ }).first().click(); await p.waitForTimeout(300);
    try { await p.selectOption('#sg-qui', qui, { timeout: 2000 }); } catch { await o.b.close(); continue; }
    await p.locator('label[for=sg-absence]').click();
    await p.fill('#sg-du', du); await p.fill('#sg-au', du);
    await p.locator('#sg-confirmer').click(); await p.waitForTimeout(600);
    await o.nav('resoudre'); await p.evaluate(() => document.querySelectorAll('details.volet').forEach((d) => (d.open = true))); await p.waitForTimeout(200);
    const t = await p.evaluate(() => [...document.querySelectorAll('section.appel')].map((s) => s.innerText.replace(/\n+/g, ' | ').slice(0, 300)));
    console.log(qui, du, JSON.stringify(t));
    await o.b.close();
  }
})();
