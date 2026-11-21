const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  for (const r of [0, 3]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' }); const p = await ctx.newPage();
    await p.goto('http://localhost:5180/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
    await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(300); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').nth(r).click(); await p.waitForTimeout(800);
    const ids = await p.evaluate(() => [...document.querySelectorAll('[data-tour^="nav-"]')].filter((e) => e.offsetParent).map((e) => e.dataset.tour.slice(4)));
    for (const id of [...ids, 'compte']) {
      if (id === 'compte') await p.evaluate(() => (window.__ui?.getState?.() ?? null)); 
      await p.evaluate((id) => { const n = document.querySelector(`[data-tour="nav-${id}"]`); if (n) n.click(); }, id); await p.waitForTimeout(700);
      const t = await p.evaluate(() => (document.querySelector('.content') || document.body).innerText);
      fs.writeFileSync(`${__dirname}/textes/${r}-${id}.txt`, t);
    }
    // la barre latérale et le menu « Créer »
    fs.writeFileSync(`${__dirname}/textes/${r}-side.txt`, await p.evaluate(() => document.querySelector('.side')?.innerText ?? ''));
    if (r === 0) { await p.locator('.top-creer').click(); await p.waitForTimeout(300); fs.writeFileSync(`${__dirname}/textes/0-creer.txt`, await p.evaluate(() => document.querySelector('.outils .menu')?.innerText ?? '')); await p.keyboard.press('Escape');
      await p.locator('.outils .top-ico').first().click(); await p.waitForTimeout(400); fs.writeFileSync(`${__dirname}/textes/0-cloche.txt`, await p.evaluate(() => document.querySelector('.outils .menu, .alertes, [role=dialog]')?.innerText ?? '')); }
    await ctx.close();
  }
  // téléphone : la barre d'onglets du bas
  for (const r of [0, 3]) { const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'fr-FR' }); const p = await ctx.newPage();
    await p.goto('http://localhost:5180/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
    await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(300); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').nth(r).click(); await p.waitForTimeout(800);
    fs.writeFileSync(`${__dirname}/textes/${r}-mobile-tabs.txt`, await p.evaluate(() => [...document.querySelectorAll('.tab, .tabbar a, .tabbar button, nav.tabs button')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).join(' | ')));
    await ctx.close(); }
  await b.close(); console.log('ok');
})();
