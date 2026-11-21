const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const sortie = {};
  const roles = (process.env.ROLES || '0,3,2,4,5,6').split(',').map(Number);
  for (const r of roles) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' }); const p = await ctx.newPage();
    await p.goto('http://localhost:5180/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
    await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(300); await p.locator('#dc-onglet-libre').click(); await p.waitForTimeout(200);
    const nomRole = (await p.locator('.dc-role').nth(r).innerText()).replace(/\s+/g, ' ');
    await p.locator('.dc-role').nth(r).click(); await p.waitForTimeout(800);
    const nav = await p.evaluate(() => [...document.querySelectorAll('[data-tour^="nav-"]')].filter((e) => e.offsetParent).map((e) => ({ id: e.dataset.tour.slice(4), texte: e.innerText.replace(/\s+/g, ' ').trim() })));
    const barre = await p.evaluate(() => [...document.querySelectorAll('.topbar-in button, .topbar-in a')].filter((e) => e.offsetParent).map((e) => (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
    const ecrans = [];
    for (const n of nav) {
      await p.evaluate((id) => document.querySelector(`[data-tour="nav-${id}"]`)?.click(), n.id); await p.waitForTimeout(700);
      ecrans.push(await p.evaluate((n) => {
        const c = document.querySelector('.content') || document.body; const t = (s) => [...c.querySelectorAll(s)].filter((e) => e.offsetParent).map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean);
        return { menu: n.texte, id: n.id, surtitre: t('.page-head .eyebrow')[0] || '', titre: t('.page-head h1')[0] || t('h1')[0] || '', sous: t('.page-head p')[0] || '', cartes: [...new Set(t('h2, h3, .card-head b'))].slice(0, 40), boutons: [...new Set(t('button').map((x) => x.slice(0, 60)))].slice(0, 80), onglets: t('[role=tab]'), mots: (c.innerText || '').length };
      }, n));
    }
    sortie[nomRole] = { nav, barre, ecrans };
    await ctx.close();
  }
  fs.writeFileSync(__dirname + '/crawl.json', JSON.stringify(sortie, null, 1)); console.log(Object.keys(sortie).join(' | ')); await b.close();
})();
