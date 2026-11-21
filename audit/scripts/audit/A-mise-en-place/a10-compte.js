// A10 (exemple) : Mon compte : apparence, couleur, taille, disposition, mot de passe, clé de secours ; propres à chacun, gardés au rechargement.
const { exemple } = require('./outils');
(async () => {
  const o = await exemple({ role: 0 });
  const { p, cap, texte } = o; const log = (...a) => console.log(...a);
  await o.fermerTour();
  const profil = async (t) => { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); await p.locator('.bandeau-test .bt-roles button', { hasText: t }).first().click(); await p.waitForTimeout(700); await o.fermerTour(); };
  const aspect = () => p.evaluate(() => ({ mode: document.documentElement.dataset.mode, menu: document.documentElement.dataset.menu || '-', theme: document.documentElement.dataset.theme, texte: document.documentElement.dataset.texte }));
  const compte = async () => { await p.locator('.compte-btn').click(); await p.waitForTimeout(200); await p.locator('.menu button', { hasText: 'Mon compte' }).click(); await p.waitForTimeout(400); };
  await compte();
  await cap('a10-01-compte-caroline', { fullPage: true });
  log('COMPTE Caroline (sections) :', (await p.locator('.page-compte h2').allInnerTexts()).join(' / '));
  log('Aspect initial :', JSON.stringify(await aspect()));
  await p.locator('label[for="mode-sombre"]').click(); await p.locator('label[for="theme-rose"]').click(); await p.locator('label[for="texte-grand"]').click(); await p.locator('label[for="disposition-classique"]').click(); await p.waitForTimeout(300);
  log('Après choix (sombre, framboise, grand, priorité d’abord) :', JSON.stringify(await aspect()));
  await cap('a10-02-compte-caroline-sombre', { fullPage: true });
  await p.reload(); await p.waitForTimeout(800); await o.fermerTour();
  log('Après rechargement :', JSON.stringify(await aspect()), '| vue :', await p.title());
  await o.nav('tableau'); log('Tableau : disposition =', await p.evaluate(() => document.querySelector('.content [class*="disposition"], .content [data-disposition]')?.className || [...document.querySelectorAll('.content section, .content .tb')].slice(0, 2).map((e) => e.className).join(',')));
  await cap('a10-03-tableau-classique-sombre');
  log('Préférences enregistrées :', await p.evaluate(() => localStorage.getItem('releve.preferences')));
  // Nicolas : ses propres réglages.
  await profil('Préparateur');
  log('Nicolas, aspect :', JSON.stringify(await aspect()));
  await compte();
  log('Nicolas : choix de couleur =', await p.locator('input[name="theme"]').count(), '| texte :', (await p.locator('#couleur-profil').innerText().catch(() => '-')).replace(/\n/g, ' '), '| disposition :', await p.locator('#choix-disposition').count(), '| clé de secours :', await p.locator('section[aria-labelledby="c-code"] .notice').count());
  await p.locator('label[for="mode-mixte"]').click(); await p.waitForTimeout(200);
  log('Nicolas mixte :', JSON.stringify(await aspect()));
  await cap('a10-04-compte-nicolas-mixte', { fullPage: true });
  await profil('Titulaire 1');
  log('Retour Caroline :', JSON.stringify(await aspect()));
  // Mode « Comme l'appareil » avec un appareil sombre puis clair.
  await compte(); await p.locator('label[for="mode-auto"]').click(); await p.waitForTimeout(200);
  await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(300); log('Auto + appareil sombre :', JSON.stringify(await aspect()));
  await p.locator('.compte-btn').click(); await p.waitForTimeout(200);
  log('Menu rapide (auto, appareil sombre) boutons actifs :', await p.locator('.menu-apparence button[aria-pressed="true"]').allInnerTexts());
  await cap('a10-05-menu-apparence-auto');
  await p.keyboard.press('Escape');
  await p.emulateMedia({ colorScheme: 'light' }); await p.waitForTimeout(300); log('Auto + appareil clair :', JSON.stringify(await aspect()));
  // Mot de passe et clé de secours.
  await p.fill('#code-actuel', 'pasbon'); await p.fill('#code-nouveau', 'abcdefg'); await p.getByRole('button', { name: 'Changer le mot de passe' }).click(); await p.waitForTimeout(200);
  log('Mdp actuel faux :', await p.locator('section[aria-labelledby="c-code"] .erreur').innerText().catch(() => '-'));
  await p.fill('#code-actuel', 'demo'); await p.fill('#code-nouveau', 'abc'); await p.getByRole('button', { name: 'Changer le mot de passe' }).click(); await p.waitForTimeout(200);
  log('Nouveau trop court :', await p.locator('section[aria-labelledby="c-code"] .erreur').innerText().catch(() => '-'));
  log('Section connexion Caroline :', (await texte('section[aria-labelledby="c-code"]')).replace(/\n/g, ' | '));
  // Le bouton « Relancer le tutoriel ».
  await p.getByRole('button', { name: 'Relancer le tutoriel' }).click(); await p.waitForTimeout(500);
  log('Tutoriel relancé :', await p.locator('.tour-card').count(), (await p.locator('.tour-card').innerText().catch(() => '')).replace(/\n/g, ' | ').slice(0, 200));
  await o.fermerTour();
  // Pierre : pas de clé, pas de couleur.
  await profil('Titulaire 2'); await compte();
  log('Pierre : couleur libre =', await p.locator('input[name="theme"]').count(), '| clé =', await p.locator('section[aria-labelledby="c-code"] .notice').count(), '| texte couleur :', (await p.locator('#couleur-profil').innerText().catch(() => '-')).replace(/\n/g, ' '));
  log('ERREURS console :', o.errs.join(' || ') || 'aucune');
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
