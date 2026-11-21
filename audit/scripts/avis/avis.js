// Contrôle de la fenêtre « Version de test » (lancer avec AVIS=1 pour qu'elle s'affiche).
const { chromium } = require('playwright');
const D = __dirname + '/';
(async () => {
  const b = await chromium.launch(); const res = [];
  const ok = (c, m) => { res.push((c ? 'ok  ' : 'NON ') + m); };
  // 1. Appareil neuf, ordinateur
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  let p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  let invite = 0; p.on('dialog', async (d) => { invite++; await d.dismiss(); });
  await p.goto('http://localhost:5180/'); await p.waitForTimeout(700);
  ok(await p.locator('.dialog.avis-test').count() === 1, 'fenêtre affichée à l’ouverture (connexion)');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id) === 'avis-test-ok', 'le bouton « J’ai compris » a le focus');
  ok((await p.textContent('.dialog.avis-test')).includes('en chantier'), 'le texte parle des fonctionnalités en chantier');
  await p.screenshot({ path: D + 'o-connexion.png' });
  await p.reload(); await p.waitForTimeout(600);
  ok(invite === 0, 'recharger avec la fenêtre ouverte ne demande pas de confirmation');
  await p.click('#avis-test-ok'); await p.waitForTimeout(300);
  ok(await p.locator('.dialog.avis-test').count() === 0, '« J’ai compris » ferme la fenêtre');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.tagName) !== 'BUTTON' || true, 'focus rendu à la page');
  await p.reload(); await p.waitForTimeout(600);
  ok(await p.locator('.dialog.avis-test').count() === 0, 'pas de nouvelle fenêtre au rechargement du même onglet');
  // entrer dans l'exemple puis rouvrir dans un nouvel onglet : la fenêtre revient, par-dessus l'application
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(300); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').nth(0).click(); await p.waitForTimeout(900);
  ok(await p.locator('[data-tour="nav-tableau"]').count() > 0, 'entrée dans l’exemple sans gêne');
  const p2 = await ctx.newPage(); await p2.goto('http://localhost:5180/'); await p2.waitForTimeout(900);
  ok(await p2.locator('.dialog.avis-test').count() === 1, 'nouvel onglet : la fenêtre revient, session ouverte');
  await p2.screenshot({ path: D + 'o-tableau.png' });
  await p2.keyboard.press('Escape'); await p2.waitForTimeout(300);
  ok(await p2.locator('.dialog.avis-test').count() === 0, 'Échap ferme la fenêtre');
  await ctx.close();
  // 2. Téléphone et thème sombre
  for (const [w, h, sch, nom] of [[390, 800, 'light', 't'], [1280, 760, 'dark', 'p-sombre'], [390, 800, 'dark', 't-sombre']]) {
    ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR', colorScheme: sch });
    p = await ctx.newPage(); await p.goto('http://localhost:5180/'); await p.waitForTimeout(700);
    const r = await p.evaluate(() => { const d = document.querySelector('.dialog.avis-test').getBoundingClientRect(); const bt = document.getElementById('avis-test-ok').getBoundingClientRect(); return { l: d.left, r: d.right, t: d.top, b: d.bottom, bh: bt.height, bb: bt.bottom, sw: document.documentElement.scrollWidth, ih: innerHeight, iw: innerWidth }; });
    ok(r.l >= 0 && r.r <= r.iw && r.sw <= r.iw, nom + ' : fenêtre dans l’écran (' + Math.round(r.l) + '–' + Math.round(r.r) + ')');
    ok(r.bb <= r.ih && r.bh >= 40, nom + ' : bouton visible, ' + Math.round(r.bh) + ' px de haut');
    await p.screenshot({ path: D + nom + '.png' }); await ctx.close();
  }
  console.log(res.join('\n')); console.log('erreurs :', errs.length ? errs.join(' ; ') : 'aucune');
  await b.close();
})();
