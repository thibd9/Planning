// A8 : plusieurs pharmacies : ajout, bascule, séparation des données, connexion de membres, nouveau compte sur l'appareil, remise à zéro.
const { reprendre } = require('./outils2');
const lire = require('./lire-etat');
(async () => {
  const o = await reprendre(`${__dirname}/etat-a6.json`);
  const { p, cap, texte } = o; const log = (...a) => console.log(...a);
  await o.fermerTour();
  const resume = async () => { const e = await o.etat(); return Object.entries(e.officines).map(([id, d]) => `${id === e.courante ? '*' : ' '}${d.officine.nom} (${d.personnes.length} pers., ${d.shifts.length} postes, clé ${d.officine.secours})`).join(' ; '); };
  log('AVANT :', await resume());
  // Ajouter une pharmacie depuis le menu du compte.
  await p.locator('.compte-btn').click(); await p.waitForTimeout(200);
  log('Menu du compte :', (await p.locator('.compte-btn + .menu, .menu').last().innerText()).replace(/\n/g, ' | '));
  await p.locator('.menu button', { hasText: 'Ajouter une pharmacie' }).click(); await p.waitForTimeout(500);
  await cap('a8-01-ajout-pharmacie');
  log('Écran ajout :', (await texte('.accueil-in')).replace(/\n/g, ' | ').slice(0, 300));
  await p.fill('#officine-nom', 'Pharmacie du Port');
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(300);
  log('Étape 2 (ajout) titulaire prérempli :', await p.inputValue('#tit-prenom'), await p.inputValue('#tit-nom'), await p.inputValue('#tit-heures'), '| champs identifiant :', await p.locator('#tit-identifiant').count(), '|', await p.locator('.accueil-in .notice.info').innerText().catch(() => '-'));
  const prenoms = p.locator('input[id$="-prenom"]:not(#tit-prenom)'); const noms = p.locator('input[id$="-nom"]:not(#tit-nom)');
  await prenoms.nth(0).fill('Hugo'); await noms.nth(0).fill('Lenoir');
  await prenoms.nth(1).fill('Marc'); await noms.nth(1).fill('Petit');
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(300);
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(900);
  log('APRÈS AJOUT :', await resume());
  log('Tutoriel relancé :', await p.locator('.tour-card').count(), '| sélecteur :', (await p.locator('#officine-choix option').allInnerTexts()).join(' / '), '| barre :', await p.locator('.espace-officine').innerText());
  await o.fermerTour();
  let e = await o.etat(); let d2 = e.officines[e.courante];
  log('Pharmacie 2 : identifiants', d2.personnes.map((x) => x.identifiant).join(', '), '| Claire même code ?', d2.personnes[0].code === Object.values(e.officines).find((x) => x.officine.nom === 'Pharmacie des Tilleuls').personnes.find((x) => x.prenom === 'Claire').code, '| horaires', JSON.stringify(d2.officine.horaires.map((h) => h.length)), '| infos', JSON.stringify(d2.officine.infos), '| surface', d2.officine.surface);
  await o.nav('equipe'); log('ÉQUIPE pharmacie 2 :', (await p.locator('.split > .col').first().innerText()).replace(/\n/g, ' | '));
  await o.nav('tableau'); log('TABLEAU pharmacie 2 :', (await texte('.content')).replace(/\n/g, ' | ').slice(0, 300));
  await cap('a8-02-pharmacie2-tableau');
  // Bascule vers la première.
  await p.selectOption('#officine-choix', { label: 'Pharmacie des Tilleuls' }); await p.waitForTimeout(500);
  log('Après bascule :', await p.locator('.espace-officine').innerText(), '| vue :', await p.title());
  await o.nav('equipe'); log('ÉQUIPE pharmacie 1 :', (await p.locator('.split > .col').first().innerText()).replace(/\n/g, ' | ').slice(0, 300));
  // Le thème choisi dans l'une vaut-il dans l'autre ?
  await p.locator('.compte-btn').click(); await p.locator('#apparence-sombre').click(); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.selectOption('#officine-choix', { label: 'Pharmacie du Port' }); await p.waitForTimeout(400);
  log('Mode sombre choisi dans Tilleuls → dans Port :', await p.evaluate(() => document.documentElement.dataset.mode || document.documentElement.className || getComputedStyle(document.body).backgroundColor));
  await p.locator('.compte-btn').click(); await p.locator('#apparence-clair').click(); await p.keyboard.press('Escape');
  // Annuler (Ctrl+Z) après bascule.
  // Connexion d'un membre de la pharmacie 2 alors que la 1 est ouverte.
  await p.selectOption('#officine-choix', { label: 'Pharmacie des Tilleuls' }); await p.waitForTimeout(300);
  e = await o.etat(); const port = Object.values(e.officines).find((x) => x.officine.nom === 'Pharmacie du Port');
  const hugo = port.personnes.find((x) => x.prenom === 'Hugo'); const marc2 = port.personnes.find((x) => x.prenom === 'Marc');
  log('Identifiants Port : Hugo', hugo.identifiant, '| Marc', marc2.identifiant);
  await o.deconnecter();
  await o.connecter(hugo.identifiant, hugo.provisoire); await o.fermerTour();
  log('Hugo connecté → pharmacie :', await p.locator('.espace-officine').innerText(), '| sélecteur visible :', await p.locator('#officine-choix').count());
  await o.deconnecter();
  await o.connecter('claire@tilleuls.fr', 'nouveau99'); await o.fermerTour();
  log('Claire reconnectée → pharmacie ouverte :', await p.locator('.espace-officine').innerText());
  await o.deconnecter();
  // Un autre titulaire crée sa pharmacie sur le même appareil.
  await p.getByRole('button', { name: /Créer ma pharmacie/ }).click(); await p.waitForTimeout(300);
  log('Création depuis un appareil occupé, bouton retour :', await p.locator('.accueil-actions .btn').first().innerText());
  await p.fill('#officine-nom', 'Pharmacie Voisine'); await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(300);
  await p.fill('#tit-prenom', 'Bruno'); await p.fill('#tit-nom', 'Voisin'); await p.fill('#tit-identifiant', 'CLAIRE@tilleuls.fr'); await p.fill('#tit-mdp', 'voisin12');
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(300);
  log('Identifiant déjà pris (autre casse) :', (await p.locator('.resume-erreurs').innerText().catch(() => 'accepté')).replace(/\n/g, ' | '));
  await p.fill('#tit-identifiant', 'marc.petit'); await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(300);
  log('Identifiant d’un salarié d’une autre pharmacie :', (await p.locator('.resume-erreurs').innerText().catch(() => 'accepté')).replace(/\n/g, ' | '));
  await p.fill('#tit-identifiant', 'bruno@voisine.fr');
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(300);
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(900);
  log('APRÈS « Pharmacie Voisine » :', await resume());
  await o.fermerTour();
  log('Bruno : sélecteur', (await p.locator('#officine-choix option').allInnerTexts()).join(' / '));
  await o.sauver('etat-a8.json');
  // Bruno remet à zéro depuis ses Réglages.
  await o.nav('officine');
  await p.locator('#acc-zero').getByRole('button', { name: 'Réinitialiser' }).click(); await p.waitForTimeout(200);
  log('Confirmation :', (await p.locator('#acc-zero .row').innerText()).replace(/\n/g, ' | '));
  await cap('a8-03-repartir-de-zero-confirmation');
  await p.getByRole('button', { name: /Oui, réinitialiser/ }).click(); await p.waitForTimeout(700);
  log('APRÈS remise à zéro par Bruno :', await resume(), '| écran :', await p.title());
  await cap('a8-04-apres-remise-a-zero');
  await o.connecter('claire@tilleuls.fr', 'nouveau99');
  log('Claire tente de se connecter :', await p.locator('#cx-err').innerText().catch(() => 'connectée'));
  log('Préférences restantes :', await p.evaluate(() => localStorage.getItem('releve.preferences')));
  log('ERREURS console :', o.errs.join(' || ') || 'aucune');
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
