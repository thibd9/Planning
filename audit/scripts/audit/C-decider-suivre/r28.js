// Droits : ce que voient le pharmacien et le préparateur ; Solvi côté équipe sur des questions de titulaire.
const { ouvrir } = require('./lib');
(async () => {
  for (const role of [2, 3]) {
    const o = await ouvrir({ role }); const { p } = o;
    const nav = await p.evaluate(() => [...new Set([...document.querySelectorAll('[data-tour^="nav-"]')].map((e) => e.getAttribute('data-tour')))].join(','));
    console.log('ROLE', role, 'nav', nav);
    const ok = await o.nav('resoudre'); console.log('  accès Résoudre', ok, ok ? await p.evaluate(() => document.querySelector('h1')?.innerText) : '');
    await p.locator('.aide-fab').click(); await p.waitForTimeout(300);
    for (const q of ['combien d’heures a fait Thomas ?', 'qui est absent cette semaine ?', 'quelles demandes sont en attente ?']) {
      const n = await p.locator('.aide-bulle.bot').count();
      await p.fill('#aide-question', q); await p.keyboard.press('Enter');
      await p.waitForFunction((k) => document.querySelectorAll('.aide-bulle.bot:not(.attente)').length > k, n, { timeout: 5000 }).catch(() => {});
      console.log(`  Q « ${q} » -> ${(await p.evaluate(() => [...document.querySelectorAll('.aide-bulle.bot:not(.attente)')].pop()?.innerText.replace(/\n+/g, ' | '))).slice(0, 300)}`);
    }
    await o.b.close();
  }
})();
