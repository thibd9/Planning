// Lot 16 : menu de l'environnement de test (plus de barre), fondu sous la barre du haut, pauses courtes.
const { ouvrir } = require('./lib');
const MOBILE = !!process.env.MOBILE;
let ok = 0, ko = 0; const verifie = (nom, cond) => { cond ? ok++ : ko++; console.log(`${cond ? '✓' : '✗'} ${nom}`); };
(async () => {
  const { b, p, errs, nav } = await ouvrir({ role: 0, w: MOBILE ? 390 : 1440, h: MOBILE ? 844 : 900, mode: process.env.MODE });
  const donnees = async (f) => { await p.waitForTimeout(350); return p.evaluate((corps) => { const v = JSON.parse(localStorage.getItem('releve.v3')); return new Function('d', `return (${corps})(d)`)(v.officines[v.courante]); }, f.toString()); };
  // ---- Plus de barre de test : l'étiquette de l'espace ouvre un menu
  const haut = await p.evaluate(() => ({ barre: !!document.querySelector('.bandeau-test'), contenu: Math.round(document.getElementById('contenu').getBoundingClientRect().top), barreHaut: Math.round(document.querySelector('.topbar').getBoundingClientRect().bottom) }));
  verifie(`aucune barre de test : le contenu commence juste sous la barre du haut (${haut.contenu - haut.barreHaut} px)`, !haut.barre && haut.contenu - haut.barreHaut <= 2);
  await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(300);
  const menu = await p.evaluate(() => ({ roles: [...document.querySelectorAll('.menu-test .bt-roles button')].map((x) => x.querySelector('b').textContent), coche: document.querySelector('.menu-test .bt-roles button[aria-pressed="true"] b')?.textContent, actions: [...document.querySelectorAll('.menu-test .bt-actions button')].map((x) => x.textContent.trim()), dansEcran: document.querySelector('.menu-test').getBoundingClientRect().right <= innerWidth }));
  verifie(`le menu réunit ${menu.roles.length} profils, les tutoriels et la remise à neuf`, menu.roles.length === 7 && menu.coche === 'Titulaire 1' && menu.actions.join('|') === 'Tutoriels|Réinitialiser' && menu.dansEcran);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  verifie('Échap ferme le menu', (await p.locator('.menu-test').count()) === 0);
  await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); await p.locator('.menu-test .bt-roles button', { hasText: 'Préparateur' }).click(); await p.waitForTimeout(700);
  verifie('choisir « Préparateur » change d’espace et referme le menu', /Bon(jour|soir) Nicolas/.test(await p.locator('.tb-nom h1').innerText()) && (await p.locator('.menu-test').count()) === 0 && /préparateur/i.test(await p.locator('#bt-ouvrir').textContent()));
  await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); await p.locator('.menu-test .bt-actions button', { hasText: 'Tutoriels' }).click(); await p.waitForTimeout(500);
  verifie('« Tutoriels » ouvre le choix des visites', (await p.locator('.choix-parcours, .decouvrir').count()) > 0);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); await p.locator('.menu-test .bt-roles button', { hasText: 'Titulaire 1' }).click(); await p.waitForTimeout(700);
  // ---- Le fondu sous la barre du haut n'apparaît qu'en défilant
  const avant = await p.evaluate(() => ({ masque: getComputedStyle(document.getElementById('contenu')).maskImage, classe: document.querySelector('.main').classList.contains('defile') }));
  await p.evaluate(() => { document.getElementById('contenu').scrollTop = 240; }); await p.waitForTimeout(350);
  const apres = await p.evaluate(() => ({ masque: getComputedStyle(document.getElementById('contenu')).maskImage, ombre: getComputedStyle(document.querySelector('.topbar-in')).boxShadow }));
  verifie('au repos, rien n’est masqué ; en défilant, le contenu s’estompe sous la barre, qui prend une ombre', avant.masque === 'none' && !avant.classe && /gradient/.test(apres.masque) && apres.ombre !== 'none');
  await p.evaluate(() => { document.getElementById('contenu').scrollTop = 0; });
  // ---- Pauses courtes dans un poste
  if (MOBILE) await p.locator('.tab[data-tab="construire"]').click(); else await nav('construire');
  await p.waitForTimeout(500);
  await p.locator('.pg-c .tile').first().click(); await p.waitForTimeout(500);
  const depart = await p.locator('#pauses-courtes .pc-ligne').count();
  verifie(`un poste de démonstration porte déjà ses pauses courtes (${depart})`, depart >= 1 && /Pause déjeuner/.test(await p.locator('.dialog').innerText()));
  for (let i = 0; i < depart; i++) await p.locator('#pauses-courtes .pc-ligne button').first().click();
  await p.locator('#pc-proposer').click(); await p.waitForTimeout(200);
  const proposees = await p.locator('#pauses-courtes .pc-ligne input[type=time]').evaluateAll((l) => l.map((x) => x.value));
  verifie(`« Une par demi-journée » propose des pauses calées sur le quart d’heure (${proposees.join(', ')})`, proposees.length >= 1 && proposees.every((v) => /:(00|15|30|45)$/.test(v)));
  await p.locator('#pauses-courtes .pc-ligne input[type=time]').first().fill('23:00'); await p.waitForTimeout(200);
  verifie('une pause hors du poste est signalée', /ne sera pas gardée/.test(await p.locator('#pauses-courtes').innerText()));
  await p.locator('#pauses-courtes .pc-ligne input[type=time]').first().fill('10:10'); await p.locator('#pauses-courtes .pc-ligne select').first().selectOption('20'); await p.waitForTimeout(200);
  await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(600);
  const garde = await donnees((d) => d.shifts.filter((s) => (s.pauses ?? []).some((x) => x.start === 610 && x.end === 630)).length);
  verifie('la pause de 10 h 10, vingt minutes, est enregistrée avec le poste', garde === 1);
  // ---- Les pauses sur la feuille imprimée
  await p.locator("button[aria-label='Imprimer le planning']").click(); await p.waitForTimeout(600);
  const feuille = await p.locator('.imp-zone .feuille').first().innerText();
  verifie('la feuille imprime la pause déjeuner (« déj. ») et les pauses courtes (« p. »), avec leur légende', /déj\. \d/.test(feuille) && /p\. \d/.test(feuille) && /10 h 10/.test(feuille) && /pauses courtes/.test(feuille));
  const deb = await p.evaluate(() => { const f = document.querySelector('.imp-zone .feuille'); const c = f.querySelector('.f-corps'); return Math.round(Math.max(...[...c.querySelectorAll('.f-bloc')].map((x) => x.offsetTop + x.offsetHeight)) - (c.offsetTop + c.offsetHeight)); });
  const coupes = await p.evaluate(() => [...document.querySelectorAll('.imp-zone .feuille .f-c')].filter((c) => c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1).length);
  verifie(`avec les pauses, rien ne déborde de la page (${deb}) ni d’une case (${coupes})`, deb <= 0 && coupes === 0);
  await p.locator('.imp-outils .seg').nth(0).getByRole('button', { name: 'Mois' }).click(); await p.waitForTimeout(500);
  const mois = await p.evaluate(() => ({ coupes: [...document.querySelectorAll('.imp-zone .feuille .f-c')].filter((c) => c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1).length, debords: [...document.querySelectorAll('.imp-zone .feuille')].map((f) => { const c = f.querySelector('.f-corps'); return Math.round(Math.max(...[...c.querySelectorAll('.f-bloc')].map((x) => x.offsetTop + x.offsetHeight)) - (c.offsetTop + c.offsetHeight)); }), dej: /déj\. \d/.test(document.querySelector('.imp-zone').innerText) }));
  verifie(`au mois aussi : pauses écrites, aucune case coupée (${mois.coupes}), aucune page dépassée (${mois.debords})`, mois.dej && mois.coupes === 0 && mois.debords.every((d) => d <= 0));
  console.log(`\n${ok}/${ok + ko} vérifications`); console.log(errs.length ? errs.join('\n') : 'aucune erreur de page');
  await b.close();
})();
