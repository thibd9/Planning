// Barre du haut (Créer, Retard ou absence, cloche, menu du compte), barre latérale ouverte au téléphone,
// fenêtres « Retard ou absence », « Planifier une formation », « Planifier un inventaire ».
const ux = require('./ux');
const dlg = async (p, nom) => {
  await p.waitForTimeout(800); await ux.shot(p, `${nom}-1`);
  const d = await p.evaluate(() => { const d = [...document.querySelectorAll('.dialog')].pop(); if (!d) return null; const c = d.querySelector('.dialog-body') || d; return { H: c.clientHeight, T: c.scrollHeight, titre: (d.querySelector('h2,h1')?.textContent || '').trim() }; });
  let k = 1; if (d && d.T > d.H + 10) for (let y = d.H - 60; k < 5; y += d.H - 60) { await p.evaluate((y) => { const d = [...document.querySelectorAll('.dialog')].pop(); (d.querySelector('.dialog-body') || d).scrollTo(0, y); }, y); await p.waitForTimeout(250); k++; await ux.shot(p, `${nom}-${k}`); if (y + d.H >= d.T) break; }
  console.log(nom, JSON.stringify(d), JSON.stringify(await ux.mesurer(p, '.dialog')).slice(0, 700));
};
const esc = async (p) => { await p.keyboard.press('Escape'); await p.waitForTimeout(400); };
(async () => {
  const b = await ux.lancer();
  for (const [t, w, h, tact] of [['d', 1440, 900, false], ['p', 1280, 760, false], ['t', 390, 800, true]]) {
    const { p, errs } = await ux.ouvrir(b, { w, h, plie: true, tactile: tact });
    console.log(t, 'barre', JSON.stringify(await ux.mesurer(p, '.topbar')).slice(0, 900));
    // Créer
    await p.locator('.top-creer').click(); await p.waitForTimeout(400); await ux.shot(p, `${t}-barre-creer`); await esc(p);
    // Cloche
    await p.locator('.outils .top-ico').first().click(); await p.waitForTimeout(500); await ux.shot(p, `${t}-barre-cloche`);
    console.log(t, 'cloche', JSON.stringify(await p.evaluate(() => { const m = document.querySelector('.menu.cloche'); const r = m.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), b: Math.round(r.bottom), h: Math.round(r.height), sh: m.scrollHeight }; })));
    await esc(p);
    // Menu du compte
    await p.locator('[data-tour="compte"]').click(); await p.waitForTimeout(400); await ux.shot(p, `${t}-barre-compte`); await esc(p);
    // Menu test (Espace titulaire)
    await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(400); await ux.shot(p, `${t}-barre-test`); await esc(p);
    if (t === 't') { await p.locator('.tab.burger').click(); await p.waitForTimeout(500); await ux.shot(p, 't-barre-volet'); await p.evaluate(() => document.querySelector('.side').scrollTo(0, 9999)); await p.waitForTimeout(200); await ux.shot(p, 't-barre-volet-bas'); await esc(p); await p.evaluate(() => document.querySelector('.side-voile')?.click()); await p.waitForTimeout(300); }
    if (t !== 'p') {
      // Retard ou absence
      await p.locator('#top-signaler').click(); await dlg(p, `${t}-retard`); await esc(p);
      // Formation, Inventaire via Créer
      for (const [lib, nom] of [['Une formation', 'formation'], ['Un inventaire', 'inventaire']]) {
        await p.locator('.top-creer').click(); await p.waitForTimeout(300);
        await p.locator('.outils .menu button', { hasText: lib }).click(); await dlg(p, `${t}-${nom}`);
        console.log(t, nom, 'vue de fond', await p.evaluate(() => document.querySelector('.page-head h1')?.textContent));
        await esc(p);
      }
    }
    console.log(t, errs);
    await p.context().close();
  }
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
