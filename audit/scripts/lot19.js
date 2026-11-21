// Lot 19 : dimensionnement de l'équipe (Réglages, titulaires).
const fs = require('fs');
const { ouvrir } = require('./lib.js');
const axeSrc = fs.readFileSync(__dirname + '/axe/node_modules/axe-core/axe.min.js', 'utf8');
(async () => {
  const ok = []; const ko = []; const t = (nom, c) => (c ? ok : ko).push(nom);
  const o = await ouvrir({ role: 0, w: 1440, h: 900, mode: process.env.MODE });
  await o.nav('officine');
  t('carte présente pour le titulaire', await o.p.locator('#dimensionnement').count() === 1);
  t('exemple : repères affichés', await o.p.locator('#dim-comptoir b').count() === 4 && await o.p.locator('.dim-bilan').count() === 2);
  const lire = async () => ({ c: await o.p.locator('#dim-comptoir b').allInnerTexts(), eq: await o.p.locator('#dim-equipe .dim-chiffres').innerText(), ph: await o.p.locator('#dim-pharmaciens .pill').innerText(), rq: await o.p.locator('#dim-remarques').innerText().catch(() => '') });
  const avant = await lire();
  // Six caisses ne font pas six personnes
  await o.p.fill('#officine-caisses', '6'); await o.p.fill('#officine-comptoirs', '6'); await o.p.fill('#dim-passages', '220'); await o.p.waitForTimeout(300);
  const six = await lire();
  t(`6 caisses, 220 clients : ${six.c.join('/')}`, six.c[0] === '2' && six.c[1] === '4' && six.c[3] === '7');
  t('la remarque le dit', /6 caisses, mais 4 personnes/.test(six.rq));
  await o.p.fill('#officine-caisses', '3'); await o.p.fill('#officine-comptoirs', '4'); await o.p.waitForTimeout(300);
  const trois = await lire();
  t('moins de caisses, même besoin en équipe', trois.eq === six.eq);
  await o.p.fill('#dim-passages', '700'); await o.p.waitForTimeout(300);
  t('forte activité : plafond signalé', /faute de place, pas faute de personnel/.test((await lire()).rq));
  await o.p.fill('#dim-passages', ''); await o.p.fill('#officine-surfaceVente', ''); await o.p.waitForTimeout(300);
  t('sans mesure : aucune estimation, et on dit quoi saisir', await o.p.locator('#dim-attente').count() === 1 && await o.p.locator('.dim-bilan').count() === 0);
  await o.p.fill('#officine-surfaceVente', '110'); await o.p.waitForTimeout(300);
  t('surface seule : estimation dite grossière', /grossière/.test((await lire()).rq));
  await o.p.fill('#dim-passages', '320'); await o.p.fill('#dim-activite', '2700000'); await o.p.waitForTimeout(300);
  const regle = await o.p.locator('#dim-adjoints').innerText();
  t('règle du nombre de pharmaciens rappelée : ' + regle.slice(0, 60), /au moins 2 pharmaciens en équivalent temps plein, en plus du titulaire/.test(regle) && /21 février 2022/.test(regle));
  await o.p.locator('.dim-calcul summary').click(); await o.p.waitForTimeout(200);
  t('calcul détaillé : 8 hypothèses', await o.p.locator('.dim-calcul ol li').count() === 8);
  await o.p.evaluate(axeSrc); const v = await o.p.evaluate(async () => (await window.axe.run(document.querySelector('#dimensionnement'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((x) => `${x.id} ${x.nodes[0].target.join(' ')}`));
  t('accessibilité ' + v.join(' ; '), v.length === 0);
  await o.p.locator('#dimensionnement').scrollIntoViewIfNeeded(); await o.p.locator('#dimensionnement').screenshot({ path: __dirname + '/shots/l19-dim.png' });
  // Solvi
  await o.p.locator('.aide-fab').click(); await o.p.waitForTimeout(400); await o.p.locator('#aide-question').fill('ai-je assez de préparateurs ?'); await o.p.keyboard.press('Enter'); await o.p.waitForTimeout(900);
  t('Solvi répond au titulaire', /Préparateurs et comptoir :/.test(await o.p.locator('.aide-panneau').innerText()));
  await o.p.keyboard.press('Escape');
  // Aide
  await o.nav('aide'); await o.p.fill('#aide-recherche', 'assez nombreuse'); await o.p.waitForTimeout(400);
  t('fiche d’aide avec tutoriel', await o.p.locator('[data-fiche="dimensionnement"]').count() === 1 && /Voir le tutoriel/.test(await o.p.locator('[data-fiche="dimensionnement"]').innerText()));
  // Téléphone
  await o.p.setViewportSize({ width: 390, height: 844 }); await o.p.waitForTimeout(300);
  await o.b.close();
  // Un préparateur n'y a pas accès ; Solvi le lui dit
  const e = await ouvrir({ role: 3, w: 1440, h: 900 });
  await e.p.locator('.aide-fab').click(); await e.p.waitForTimeout(400); await e.p.locator('#aide-question').fill('est-ce qu’on est en sous-effectif ?'); await e.p.keyboard.press('Enter'); await e.p.waitForTimeout(900);
  t('préparateur : réservé aux titulaires', /réservé aux titulaires/.test(await e.p.locator('.aide-panneau').innerText()));
  console.log(`${ok.length}/${ok.length + ko.length}`, ko.length ? 'ÉCHECS : ' + ko.join(' | ') : '', [...o.errs, ...e.errs].length ? 'ERREURS ' + [...o.errs, ...e.errs].join(' ; ') : '');
  await e.b.close();
})();
