// A13 : texte de l'étape 3 en mode « ajout », déconnexion par le menu et par « Mon compte ».
const { exemple } = require('./outils');
(async () => {
  const log = (...a) => console.log(...a);
  const o = await exemple({ role: 0 }); const p = o.p; await o.fermerTour();
  await p.locator('.compte-btn').click(); await p.waitForTimeout(200); await p.locator('.menu button', { hasText: 'Ajouter une pharmacie' }).click(); await p.waitForTimeout(400);
  await p.fill('#officine-nom', 'Annexe'); await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(300);
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(300);
  log('Ajout, étape 3, pied :', await p.locator('.accueil-actions').innerText().then((t) => t.replace(/\n/g, ' | ')));
  await o.cap('a13-01-ajout-etape3');
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(900);
  log('Après ajout : tutoriel affiché =', await p.locator('.tour-card').count(), '| pharmacie :', await p.locator('.espace-officine').innerText());
  await p.selectOption('#officine-choix', { label: 'Grande Pharmacie de la Pinède' }); await p.waitForTimeout(500); await o.fermerTour();
  // Déconnexion par le menu : point d'étape ?
  await p.locator('.compte-btn').click(); await p.waitForTimeout(200); await p.locator('.menu button', { hasText: 'Se déconnecter' }).click(); await p.waitForTimeout(500);
  log('Menu → Se déconnecter : dialogue =', (await p.locator('.dialog').innerText().catch(() => 'aucun')).replace(/\n/g, ' | ').slice(0, 300));
  await o.cap('a13-02-point-etape-deconnexion');
  await p.getByRole('button', { name: 'Rester et finir' }).click(); await p.waitForTimeout(300);
  await p.locator('.compte-btn').click(); await p.waitForTimeout(200); await p.locator('.menu button', { hasText: 'Mon compte' }).click(); await p.waitForTimeout(400);
  await p.locator('.page-compte .btn', { hasText: 'Se déconnecter' }).click(); await p.waitForTimeout(500);
  log('Mon compte → Se déconnecter : dialogue =', await p.locator('.dialog').count(), '| écran :', await p.title());
  log('ERREURS console :', o.errs.join(' || ') || 'aucune');
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
