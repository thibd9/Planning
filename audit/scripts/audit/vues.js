const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [r, vues] of [[0, ['tableau', 'resoudre', 'equipe']], [3, ['espace', 'demandes']]]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' }); const p = await ctx.newPage();
    await p.goto('http://localhost:5180/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
    await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(300); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').nth(r).click(); await p.waitForTimeout(800);
    for (const v of vues) { await p.evaluate((id) => document.querySelector(`[data-tour="nav-${id}"]`)?.click(), v); await p.waitForTimeout(800); await p.screenshot({ path: `${__dirname}/audit-${r}-${v}.png`, fullPage: true }); }
    await ctx.close();
  }
  await b.close();
})();
