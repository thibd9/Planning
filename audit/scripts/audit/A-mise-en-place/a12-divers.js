// A12 : double clic à la création, bouton Retour du navigateur, effacement depuis la page de connexion, libellés de rôle.
const { lancer, exemple } = require('./outils');
(async () => {
  const log = (...a) => console.log(...a);
  // 1. Double clic sur « Créer mon officine ».
  let o = await lancer({}); let p = o.p;
  await p.getByRole('button', { name: /Créer ma pharmacie/ }).click(); await p.waitForTimeout(300);
  log('Écran de création sur un appareil vide, bouton :', await p.locator('.accueil-actions .btn').first().innerText());
  await p.fill('#officine-nom', 'Pharmacie Double'); await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(300);
  await p.fill('#tit-prenom', 'Nadia'); await p.fill('#tit-nom', 'Roche'); await p.fill('#tit-identifiant', 'nadia.roche'); await p.fill('#tit-mdp', 'secret12');
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(300);
  await p.locator('.accueil-actions button[type=submit]').dblclick().catch(() => {}); await p.waitForTimeout(900);
  let e = await o.etat(); log('Après double clic : pharmacies =', Object.keys(e.officines).length, Object.values(e.officines).map((d) => d.officine.nom).join(', '));
  await o.fermerTour();
  // 2. Bouton « Tutoriel » annoncé en haut de l'écran ?
  log('Boutons de la barre du haut :', (await p.locator('.topbar button').evaluateAll((b) => b.map((x) => (x.getAttribute('aria-label') || x.innerText || '').trim().replace(/\n/g, ' ')).filter(Boolean))).join(' / '));
  // 3. Bouton Retour du navigateur.
  await o.nav('equipe'); await o.nav('officine');
  const avant = p.url(); const r = await p.goBack().catch(() => null); await p.waitForTimeout(500);
  log('Retour du navigateur depuis Réglages : URL avant', avant, '→ après', p.url(), '| écran :', await p.title().catch(() => '-'));
  await o.b.close();
  // 4. « Tout effacer » depuis la page de connexion, sans mot de passe.
  o = await exemple({ role: 0 }); p = o.p; await o.fermerTour(); await o.deconnecter();
  await p.locator('.cx-lien').click(); await p.waitForTimeout(200);
  await p.fill('#ob-effacer', 'effacer'); await p.waitForTimeout(100);
  log('Bouton « Tout effacer » actif avec « effacer » en minuscules, sans mot de passe :', !(await p.getByRole('button', { name: /Tout effacer et recommencer/ }).isDisabled()));
  await p.getByRole('button', { name: /Tout effacer et recommencer/ }).click(); await p.waitForTimeout(500);
  e = await o.etat(); log('Après effacement : pharmacies =', Object.values(e.officines).map((d) => `${d.officine.nom || '(vide)'}:${d.personnes.length}`).join(', '), '| message :', await p.locator('.notice.ok').innerText().catch(() => '-'));
  await o.cap('a12-01-tout-efface');
  await o.b.close();
  // 5. Libellés de rôle (exemple, Caroline).
  o = await exemple({ role: 0 }); p = o.p; await o.fermerTour();
  log('TABLEAU Caroline :', (await p.locator('.content').innerText()).split('\n').slice(0, 6).join(' | '));
  await o.nav('equipe'); await p.locator('.g-item', { hasText: 'Caroline' }).click(); await p.waitForTimeout(300);
  log('FICHE Caroline, droits :', (await p.locator('.acc', { hasText: 'Droits d’accès' }).innerText()).replace(/\n/g, ' | '));
  await p.locator('.g-item', { hasText: 'Sarah' }).click(); await p.waitForTimeout(300);
  log('FICHE Sarah, rôle :', await p.locator('.split > .card .card-head .small').innerText(), '| marques :', await p.locator('.acc', { hasText: 'Marques présentées' }).locator('p.small').first().innerText());
  await o.cap('a12-02-fiche-sarah', { fullPage: false });
  await p.locator('.g-item', { hasText: 'Manon' }).click(); await p.waitForTimeout(300);
  log('FICHE Manon, rôle :', await p.locator('.split > .card .card-head .small').innerText());
  await p.locator('.compte-btn').click(); await p.waitForTimeout(200);
  log('Menu compte Caroline :', (await p.locator('.menu .qui').innerText()).replace(/\n/g, ' | '));
  await p.keyboard.press('Escape');
  await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(200); await p.locator('.bandeau-test .bt-roles button', { hasText: 'Animateur' }).click(); await p.waitForTimeout(700); await o.fermerTour();
  log('Sarah connectée, badge :', await p.locator('.espace-badge').innerText(), '| accueil :', (await p.locator('.content').innerText()).split('\n').slice(0, 5).join(' | '));
  await o.cap('a12-03-sarah-accueil', { fullPage: false });
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
