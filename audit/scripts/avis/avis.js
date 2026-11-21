// Contrôle du démarrage de Solvéa : page de connexion et fenêtre « Version de test » à chaque chargement.
// À lancer comme un utilisateur : AVIS=1 CONNEXION=1 NODE_OPTIONS="-r …/servi.js" node avis/avis.js
const { chromium } = require('playwright');
const D = __dirname + '/';
(async () => {
  const b = await chromium.launch(); const res = [];
  const ok = (c, m) => { res.push((c ? 'ok  ' : 'NON ') + m); };
  const fenetre = (p) => p.locator('.dialog.avis-test').count();
  const connexion = (p) => p.locator('main.connexion').count();
  // 1. Appareil neuf, ordinateur
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  let p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5180/'); await p.waitForTimeout(700);
  ok(await fenetre(p) === 1 && await connexion(p) === 1, 'ouverture : connexion et fenêtre « Version de test »');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id) === 'avis-test-ok', 'le bouton « J’ai compris » a le focus');
  await p.screenshot({ path: D + 'o-connexion.png' });
  await p.click('#avis-test-ok'); await p.waitForTimeout(300);
  ok(await fenetre(p) === 0, '« J’ai compris » ferme la fenêtre');
  await p.reload(); await p.waitForTimeout(600);
  ok(await fenetre(p) === 1, 'rechargement : la fenêtre revient');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await fenetre(p) === 0, 'Échap ferme la fenêtre');
  // entrer dans l'exemple, puis recharger : retour à la connexion, données gardées
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(300); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').nth(0).click(); await p.waitForTimeout(900);
  ok(await p.locator('[data-tour="nav-tableau"]').count() > 0, 'entrée dans l’exemple');
  const avant = await p.evaluate((() => { const d = JSON.parse(localStorage.getItem('releve.v3') || '{}'); const o = (d.officines || {})[d.courante] || {}; return [o.officine && o.officine.nom, (o.personnes || []).length, (o.shifts || []).length].join('|'); }));
  await p.reload(); await p.waitForTimeout(800);
  ok(await connexion(p) === 1 && await p.locator('[data-tour="nav-tableau"]').count() === 0, 'rechargement connecté : retour à la page de connexion');
  ok(await fenetre(p) === 1, 'rechargement connecté : la fenêtre revient');
  ok(await p.evaluate(() => localStorage.getItem('releve.session')) === null, 'aucune session gardée dans le navigateur');
  ok(await p.evaluate((() => { const d = JSON.parse(localStorage.getItem('releve.v3') || '{}'); const o = (d.officines || {})[d.courante] || {}; return [o.officine && o.officine.nom, (o.personnes || []).length, (o.shifts || []).length].join('|'); })) === avant && /Pinède\|13\|/.test(avant), 'les données de la pharmacie sont gardées (' + avant + ')');
  await p.screenshot({ path: D + 'o-recharge.png' });
  // se reconnecter avec un compte de l'exemple fonctionne toujours
  await p.click('#avis-test-ok'); await p.waitForTimeout(200);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(300); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').nth(3).click(); await p.waitForTimeout(900);
  ok(await p.locator('[data-tour="nav-espace"]').count() > 0, 'nouvelle entrée sous un autre profil');
  // une session gardée par une version précédente n'est pas reprise
  await p.evaluate(() => localStorage.setItem('releve.session', JSON.stringify('caroline.tellier')));
  const p2 = await ctx.newPage(); await p2.goto('http://localhost:5180/'); await p2.waitForTimeout(900);
  ok(await connexion(p2) === 1 && await fenetre(p2) === 1, 'nouvel onglet, ancienne session enregistrée : connexion et fenêtre');
  await ctx.close();
  // 2. Téléphone et thème sombre
  for (const [w, h, sch, nom] of [[390, 800, 'light', 't'], [1280, 760, 'dark', 'p']]) {
    ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR', colorScheme: sch });
    p = await ctx.newPage(); await p.goto('http://localhost:5180/'); await p.waitForTimeout(700);
    const r = await p.evaluate(() => { const d = document.querySelector('.dialog.avis-test').getBoundingClientRect(); const bt = document.getElementById('avis-test-ok').getBoundingClientRect(); return { l: d.left, r: d.right, bh: bt.height, bb: bt.bottom, sw: document.documentElement.scrollWidth, ih: innerHeight, iw: innerWidth }; });
    ok(r.l >= 0 && r.r <= r.iw && r.sw <= r.iw, nom + ' : fenêtre dans l’écran (' + Math.round(r.l) + ' à ' + Math.round(r.r) + ')');
    ok(r.bb <= r.ih && r.bh >= 40, nom + ' : bouton visible, ' + Math.round(r.bh) + ' px de haut');
    await p.screenshot({ path: D + nom + '.png' }); await ctx.close();
  }
  console.log(res.join('\n')); console.log(res.filter((x) => x.startsWith('ok')).length + '/' + res.length + ' ; erreurs de page : ' + (errs.length ? errs.join(' ; ') : 'aucune'));
  await b.close();
})();
