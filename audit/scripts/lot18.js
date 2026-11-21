// Lot 18 : thèmes clair, mixte, sombre ; choix à la création ; menu ; accessibilité du menu foncé.
const fs = require('fs');
const { chromium } = require('playwright');
const { ouvrir } = require('./lib.js');
const axeSrc = fs.readFileSync(__dirname + '/axe/node_modules/axe-core/axe.min.js', 'utf8');
const axe = async (p, sel) => { await p.evaluate(axeSrc); const r = await p.evaluate(async (s) => await window.axe.run(document.querySelector(s), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }), sel); return r.violations.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0].target.join(' ')}`); };
(async () => {
  const ok = []; const ko = []; const t = (nom, c) => (c ? ok : ko).push(nom);
  // 1. Création : le choix de l'apparence, appliqué puis conservé
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5180/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /Créer/ }).first().click(); await p.waitForTimeout(600);
  t('création : 3 maquettes', await p.locator('#choix-apparence .app-carte svg.app-maquette').count() === 3);
  t('création : clair par défaut', await p.locator('#apparence-clair').isChecked());
  await p.locator('#apparence-sombre').check({ force: true }); await p.waitForTimeout(200);
  t('création : aperçu sombre immédiat', await p.evaluate(() => document.documentElement.dataset.mode) === 'sombre');
  await p.locator('#apparence-mixte').check({ force: true }); await p.waitForTimeout(200);
  t('création : mixte = clair + menu foncé', await p.evaluate(() => document.documentElement.dataset.mode + '/' + document.documentElement.dataset.menu) === 'clair/sombre');
  const v1 = await axe(p, '#choix-apparence'); t('création : accessibilité ' + v1.join(' ; '), v1.length === 0);
  await p.keyboard.press('Tab'); 
  await p.fill('#officine-nom', 'Pharmacie du Test'); await p.getByRole('button', { name: /Continuer : l’équipe/ }).click(); await p.waitForTimeout(500);
  await p.fill('#tit-prenom', 'Alix'); await p.fill('#tit-nom', 'Durand'); await p.fill('#tit-identifiant', 'alix.durand'); await p.fill('#tit-mdp', 'Officine-2026!');
  await p.getByRole('button', { name: /Continuer : vérification/ }).click(); await p.waitForTimeout(500);
  const cree = p.getByRole('button', { name: /Créer mon officine/ });
  if (await cree.count()) { await cree.click(); await p.waitForTimeout(1200);
    const etat = await p.evaluate(() => ({ menu: document.documentElement.dataset.menu, mode: document.documentElement.dataset.mode, prefs: localStorage.getItem('releve.preferences') }));
    t('création : mixte conservé après connexion ' + JSON.stringify(etat).slice(0, 160), etat.menu === 'sombre' && etat.mode === 'clair' && /"mode":"mixte"/.test(etat.prefs || ''));
  } else { t('création : étape 3 atteinte (' + (await p.locator('.erreur').allInnerTexts()).join(' | ') + ')', false); }
  await b.close();
  // 2. Dans l'application : menu du compte, mixte, accessibilité du menu foncé
  const o = await ouvrir({ role: 0, w: 1440, h: 900 });
  const menu = async (ouvert) => { const b = o.p.locator('.compte-btn'); if ((await b.getAttribute('aria-expanded')) !== String(ouvert)) { await b.click(); await o.p.waitForTimeout(250); } };
  await menu(true);
  t('menu : 3 choix', await o.p.locator('.menu-apparence .ap-choix button').count() === 3);
  await o.p.locator('#apparence-mixte').click(); await o.p.waitForTimeout(300);
  t('menu : mixte appliqué', await o.p.evaluate(() => document.documentElement.dataset.menu) === 'sombre' && await o.p.locator('#apparence-mixte').getAttribute('aria-pressed') === 'true');
  await menu(false);
  const fond = await o.p.evaluate(() => getComputedStyle(document.querySelector('.side')).backgroundImage); t('mixte : menu en dégradé foncé', /gradient/.test(fond));
  const v2 = await axe(o.p, '.side'); t('mixte : accessibilité du menu ' + v2.join(' ; '), v2.length === 0);
  await o.nav('resoudre'); const v3 = await axe(o.p, '.side'); t('mixte : menu, rubrique ouverte ' + v3.join(' ; '), v3.length === 0);
  await o.p.reload(); await o.p.waitForTimeout(600); t('mixte : conservé au rechargement', await o.p.evaluate(() => document.documentElement.dataset.menu) === 'sombre');
  await menu(true); await o.p.locator('#apparence-sombre').click(); await o.p.waitForTimeout(300);
  t('sombre : plus de menu « mixte »', await o.p.evaluate(() => document.documentElement.dataset.mode + '/' + (document.documentElement.dataset.menu || '')) === 'sombre/');
  await menu(false); await o.nav('tableau');
  const v4 = await axe(o.p, '.app, #root'); t('sombre : tableau de bord ' + v4.join(' ; '), v4.length === 0);
  await menu(true); await o.p.locator('#apparence-clair').click(); await menu(false); await o.p.waitForTimeout(300);
  const v5 = await axe(o.p, '#root'); t('clair : tableau de bord ' + v5.join(' ; '), v5.length === 0);
  // 3. Structure : bannière, repères, aide en bas du menu
  t('bannière en un bloc', await o.p.locator('.tb-couverture .tb-nom h1').count() === 1 && await o.p.locator('.tb-couverture .tb-resume').count() === 1);
  const h = await o.p.locator('.tb-chiffre').evaluateAll((l) => l.map((x) => Math.round(x.getBoundingClientRect().height))); t('repères de même hauteur ' + h.join('/'), new Set(h).size === 1 && h.length === 5);
  const ic = await o.p.locator('.tb-chiffre .ico').evaluateAll((l) => l.every((x) => { const r = x.getBoundingClientRect(); const s = x.querySelector('svg').getBoundingClientRect(); return Math.abs((r.left + r.right) - (s.left + s.right)) < 2 && Math.abs((r.top + r.bottom) - (s.top + s.bottom)) < 2; })); t('pictogrammes centrés', ic);
  t('aide en carte dans le menu', await o.p.locator('.side .nav-aide[data-tour="nav-aide"]').count() === 1);
  await o.p.locator('.nav-aide').click(); await o.p.waitForTimeout(400); t('carte aide → page d’aide', await o.p.locator('.page-aide').count() === 1);
  // Compte : 4 cartes
  await menu(true); await o.p.getByRole('button', { name: 'Mon compte', exact: true }).last().click(); await o.p.waitForTimeout(400);
  t('compte : 4 cartes dont « Comme l’appareil »', await o.p.locator('[aria-label="Apparence"] .app-carte').count() === 4 && await o.p.locator('#mode-auto').count() === 1);
  // Téléphone
  await o.p.setViewportSize({ width: 390, height: 844 }); await o.nav('tableau').catch(() => {}); await o.p.waitForTimeout(400);
  t('téléphone : pas de débordement', await o.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  console.log(`${ok.length}/${ok.length + ko.length}`, ko.length ? 'ÉCHECS : ' + ko.join(' | ') : '', [...errs, ...o.errs].length ? 'ERREURS ' + [...errs, ...o.errs].join(' ; ') : '');
  await o.b.close();
})();
