// A2 : rechargement, déconnexion, reconnexion, mauvais mot de passe, clé de secours, première connexion d'un membre.
const { reprendre } = require('./outils2');
(async () => {
  const o = await reprendre(`${__dirname}/etat-a1.json`);
  const { p, cap, texte } = o; const log = (...a) => console.log(...a);
  log('Après rechargement : vue =', await p.title(), '| tutoriel affiché :', await p.locator('.tour-card').count());
  await o.fermerTour();
  // Ce qui est déjà « à décider » et dans la cloche d'une pharmacie neuve.
  await p.locator('.top-ico[aria-haspopup]').first().click(); await p.waitForTimeout(300);
  log('CLOCHE :', (await texte('.menu.cloche')).replace(/\n/g, ' | '));
  await cap('a2-01-cloche-pharmacie-neuve');
  await p.keyboard.press('Escape');
  await o.nav('resoudre'); await p.waitForTimeout(400);
  log('RÉSOUDRE :', (await texte('.content')).slice(0, 900).replace(/\n/g, ' | '));
  await cap('a2-02-resoudre-neuf');
  await o.nav('tableau');
  log('TABLEAU :', (await texte('.content')).slice(0, 1200).replace(/\n/g, ' | '));
  await cap('a2-03-tableau-neuf', { fullPage: true });
  // Déconnexion.
  await o.deconnecter();
  log('Après déconnexion :', await p.title(), '| session :', await p.evaluate(() => localStorage.getItem('releve.session')));
  log('Lien « Mot de passe oublié » présent :', await p.locator('.cx-lien').count());
  // Mauvais mot de passe.
  await o.connecter('claire@tilleuls.fr', 'mauvais1');
  log('Mauvais mdp :', await p.locator('#cx-err').innerText().catch(() => 'pas d’erreur'));
  await cap('a2-04-mauvais-mdp');
  // Identifiant avec une autre casse et des espaces.
  await o.connecter('  CLAIRE@TILLEULS.FR ', 'secret12');
  log('Casse et espaces différents :', await p.title(), '| session :', await p.evaluate(() => localStorage.getItem('releve.session')));
  await o.fermerTour();
  await o.deconnecter();
  // Mot de passe oublié : clé fausse, clé juste, mot de passe court.
  await p.locator('.cx-lien').click(); await p.waitForTimeout(300);
  await cap('a2-05-oubli');
  log('OUBLI écran :', (await texte('.connexion-in')).replace(/\n/g, ' | ').slice(0, 800));
  const cle = (await o.courante()).officine.secours;
  await p.fill('#ob-identifiant', 'julie.bernard'); await p.fill('#ob-cle', cle); await p.fill('#ob-nouveau', 'nouveau1');
  await p.getByRole('button', { name: 'Redéfinir le mot de passe' }).click(); await p.waitForTimeout(200);
  log('Oubli, identifiant d’un salarié :', await p.locator('.erreur').innerText().catch(() => '-'));
  await p.fill('#ob-identifiant', 'claire@tilleuls.fr'); await p.fill('#ob-cle', 'AAAA-BBBB');
  await p.getByRole('button', { name: 'Redéfinir le mot de passe' }).click(); await p.waitForTimeout(200);
  log('Oubli, clé fausse :', await p.locator('.erreur').innerText().catch(() => '-'));
  await p.fill('#ob-cle', cle.toLowerCase()); await p.fill('#ob-nouveau', '123');
  await p.getByRole('button', { name: 'Redéfinir le mot de passe' }).click(); await p.waitForTimeout(200);
  log('Oubli, mot de passe trop court :', await p.locator('.erreur').innerText().catch(() => '-'));
  await p.fill('#ob-nouveau', 'nouveau99');
  await p.getByRole('button', { name: 'Redéfinir le mot de passe' }).click(); await p.waitForTimeout(300);
  log('Oubli, réussite :', await p.locator('.notice.ok').innerText().catch(() => '-'), '| identifiant prérempli :', await p.inputValue('#cx-identifiant'));
  await o.connecter('claire@tilleuls.fr', 'secret12');
  log('Ancien mdp après redéfinition :', await p.locator('#cx-err').innerText().catch(() => 'accepté !'));
  await o.connecter('claire@tilleuls.fr', 'nouveau99');
  log('Nouveau mdp :', await p.title());
  await o.fermerTour();
  // Le mot de passe provisoire de Julie, lu dans sa fiche « Équipe ».
  await o.nav('equipe');
  await p.locator('.g-item', { hasText: 'Julie Bernard' }).click(); await p.waitForTimeout(300);
  const compte = await p.locator('.fiche .acc', { hasText: 'Compte de connexion' }).innerText().catch(() => '');
  log('FICHE Julie, compte :', compte.replace(/\n/g, ' | '));
  const prov = (compte.match(/provisoire : (\d{6})/) || [])[1];
  await o.deconnecter();
  // Première connexion de Julie.
  await o.connecter('julie.bernard', prov);
  log('Julie connectée :', await p.title(), '| tour :', await p.locator('.tour-card').count());
  log('JULIE écran :', (await texte('.content')).slice(0, 700).replace(/\n/g, ' | '));
  await cap('a2-06-julie-premiere-connexion');
  await p.locator('.compte-btn').click(); await p.waitForTimeout(200); await p.locator('.menu button', { hasText: 'Mon compte' }).click(); await p.waitForTimeout(400);
  log('JULIE compte, connexion :', (await texte('section[aria-labelledby="c-code"]')).replace(/\n/g, ' | '));
  await cap('a2-07-julie-compte', { fullPage: true });
  // Julie change son mot de passe (sans connaître l'actuel ? avec le provisoire).
  await p.fill('#code-actuel', 'faux000'); await p.fill('#code-nouveau', 'julie123'); await p.getByRole('button', { name: 'Changer le mot de passe' }).click(); await p.waitForTimeout(200);
  log('Changement avec mauvais actuel :', await p.locator('section[aria-labelledby="c-code"] .erreur').innerText().catch(() => '-'));
  await p.fill('#code-actuel', prov); await p.fill('#code-nouveau', 'julie123'); await p.getByRole('button', { name: 'Changer le mot de passe' }).click(); await p.waitForTimeout(300);
  log('Changement OK, toast :', await o.toast(), '| pastille :', await p.locator('section[aria-labelledby="c-code"] .pill').innerText());
  // Le bouton « Se déconnecter » du compte : passe-t-il par le point d'étape ?
  await p.locator('.page-compte .btn', { hasText: 'Se déconnecter' }).click(); await p.waitForTimeout(400);
  log('Déconnexion depuis Mon compte :', await p.title());
  await o.connecter('claire@tilleuls.fr', 'nouveau99'); await o.fermerTour();
  await o.nav('equipe'); await p.locator('.g-item', { hasText: 'Julie Bernard' }).click(); await p.waitForTimeout(300);
  log('FICHE Julie après son changement :', (await p.locator('.fiche .acc', { hasText: 'Compte de connexion' }).innerText()).replace(/\n/g, ' | '));
  log('ERREURS console :', o.errs.join(' || ') || 'aucune');
  await o.sauver('etat-a2.json');
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
