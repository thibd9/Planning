// A1 : de la page de connexion à la création d'une vraie pharmacie, avec les erreurs de saisie à chaque étape.
const { lancer } = require('./outils');
(async () => {
  const o = await lancer({});
  const { p, cap, texte } = o; const log = (...a) => console.log(...a);
  await cap('a1-01-connexion');
  log('Bouton connexion désactivé à vide :', await p.locator('.cx-valider button[type=submit]').isDisabled());
  log('Lien mot de passe oublié présent (appareil vide) :', await p.locator('.cx-lien').count());
  await p.fill('#cx-identifiant', 'personne'); await p.fill('#cx-mdp', 'abcdef'); await p.locator('.cx-valider button[type=submit]').click(); await p.waitForTimeout(300);
  log('Erreur connexion appareil vide :', await p.locator('#cx-err').innerText().catch(() => '-'));
  await p.getByRole('button', { name: /Créer ma pharmacie/ }).click(); await p.waitForTimeout(400);
  await cap('a1-02-etape1-vide');
  // Étape 1 : rien de rempli, horaires incohérents.
  await p.fill('#sem-debut', '19:00'); await p.fill('#sem-fin', '08:00');
  await p.check('#coupure'); await p.fill('#midi-debut', '15:00'); await p.fill('#midi-fin', '13:00');
  await p.fill('#sam-debut', '13:00'); await p.fill('#sam-fin', '09:00');
  await p.fill('#officine-surface', '-50');
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(400);
  log('ÉTAPE 1 erreurs :', (await p.locator('.resume-erreurs').innerText().catch(() => 'aucune')).replace(/\n/g, ' | '));
  await cap('a1-03-etape1-erreurs', { fullPage: true });
  // Nom fait d'espaces.
  await p.fill('#officine-nom', '   ');
  await p.fill('#sem-debut', '08:30'); await p.fill('#sem-fin', '19:30'); await p.fill('#midi-debut', '12:30'); await p.fill('#midi-fin', '14:00');
  await p.fill('#sam-debut', '09:00'); await p.fill('#sam-fin', '13:00');
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(300);
  log('Nom fait d’espaces :', (await p.locator('.resume-erreurs').innerText().catch(() => 'aucune')).replace(/\n/g, ' | '));
  await p.fill('#officine-nom', 'Pharmacie des Tilleuls');
  await p.fill('#officine-surface', '-50');
  // L'apparence à la création.
  log('Choix d’apparence à la création :', await p.locator('#choix-apparence label').allInnerTexts().then((t) => t.map((x) => x.split('\n')[0]).join(' / ')));
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(400);
  log('Passage à l’étape 2 :', await p.locator('.accueil-in h1').innerText());
  await cap('a1-04-etape2-vide', { fullPage: true });
  // Étape 2 : erreurs.
  await p.fill('#tit-heures', '200');
  await p.fill('#tit-identifiant', 'ab'); await p.fill('#tit-mdp', '123');
  const prenoms = p.locator('input[id$="-prenom"]:not(#tit-prenom)'); const noms = p.locator('input[id$="-nom"]:not(#tit-nom)'); const heures = p.locator('input[id$="-heures"]:not(#tit-heures)');
  log('Lignes proposées par défaut (prénom) :', await prenoms.count());
  await prenoms.nth(0).fill('Julie'); // pharmacien sans nom
  await prenoms.nth(1).fill('Marc'); await noms.nth(1).fill('Petit'); await heures.nth(1).fill('60');
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(400);
  log('ÉTAPE 2 erreurs :', (await p.locator('.resume-erreurs').innerText().catch(() => 'aucune')).replace(/\n/g, ' | '));
  await cap('a1-05-etape2-erreurs', { fullPage: true });
  // Corrections.
  await p.fill('#tit-prenom', 'Claire'); await p.fill('#tit-nom', 'Martin');
  await p.fill('#tit-identifiant', 'Claire@Tilleuls.fr'); await p.fill('#tit-mdp', 'secret12');
  await noms.nth(0).fill('Bernard'); await heures.nth(0).fill('35');
  await heures.nth(1).fill('35');
  await prenoms.nth(2).fill('Léa'); await noms.nth(2).fill('Roux'); await heures.nth(2).fill('28');
  // Un titulaire secondaire, une animatrice, une apprentie.
  await p.getByRole('button', { name: 'Ajouter un titulaire' }).click(); await p.waitForTimeout(150);
  await p.locator('input[id^="tit2-"][id$="-prenom"]').fill('Paul'); await p.locator('input[id^="tit2-"][id$="-nom"]').fill('Durand');
  await p.getByRole('button', { name: 'Ajouter un animateur' }).click(); await p.waitForTimeout(150);
  await p.locator('input[id^="anim-"][id$="-prenom"]').fill('Inès'); await p.locator('input[id^="anim-"][id$="-nom"]').fill('Garcia'); await p.locator('input[id^="anim-"][id$="-heures"]').fill('20');
  await p.getByRole('button', { name: 'Ajouter un apprenti' }).click(); await p.waitForTimeout(150);
  await p.locator('input[id^="appr-"][id$="-prenom"]').fill('Emma'); await p.locator('input[id^="appr-"][id$="-nom"]').fill('Blanc');
  await p.getByRole('button', { name: 'Ajouter un étudiant' }).click(); await p.waitForTimeout(150); // ligne laissée vide
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(400);
  log('Après corrections :', await p.locator('.accueil-in h1').innerText(), '| erreurs :', (await p.locator('.resume-erreurs').innerText().catch(() => 'aucune')).replace(/\n/g, ' | '));
  log('RÉCAP :', (await texte('.accueil-in')).replace(/\n/g, ' | '));
  await cap('a1-06-verification', { fullPage: true });
  // Retour à l'étape 1 et retour : rien n'est perdu ?
  await p.getByRole('button', { name: /Modifier la pharmacie/ }).click(); await p.waitForTimeout(300);
  log('Retour étape 1, nom conservé :', await p.inputValue('#officine-nom'), '| surface :', await p.inputValue('#officine-surface'));
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(300);
  log('Étape 2, titulaire conservé :', await p.inputValue('#tit-prenom'), await p.inputValue('#tit-heures'), '| mdp conservé :', (await p.inputValue('#tit-mdp')).length, 'car.');
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(300);
  await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(900);
  await cap('a1-07-apres-creation');
  log('Après création, texte visible :', (await texte('body')).slice(0, 600).replace(/\n/g, ' | '));
  const d = await o.courante();
  log('DONNÉES officine :', JSON.stringify({ nom: d.officine.nom, surface: d.officine.surface, secours: d.officine.secours, horaires: d.officine.horaires, postes: d.officine.postes.map((x) => `${x.label} ${x.jours}`), effectifs: d.officine.effectifs.map((e) => `${e.jours} ${e.start}-${e.end} min ${e.minEquipe}`), modele: d.officine.modele, responsableId: d.officine.responsableId }));
  log('DONNÉES personnes :', JSON.stringify(d.personnes.map((x) => ({ n: `${x.prenom} ${x.nom}`, q: x.qualification, h: x.heuresHebdo, id: x.identifiant, prov: x.provisoire, sal: x.salarie, garde: x.volontaireGardes }))));
  log('Session :', await p.evaluate(() => localStorage.getItem('releve.session')), '| prefs :', await p.evaluate(() => localStorage.getItem('releve.preferences')));
  // Le tutoriel : ses étapes.
  for (let i = 0; i < 12; i++) {
    const c = p.locator('.tour-card'); if (!(await c.count())) break;
    log(`TOUR ${i + 1} :`, (await c.innerText()).replace(/\n/g, ' | ').slice(0, 260));
    if (i === 0) await cap('a1-08-tour1');
    const s = p.locator('.tour-suite'); if (!(await s.count())) break; await s.click(); await p.waitForTimeout(450);
  }
  log('ERREURS console :', o.errs.join(' || ') || 'aucune');
  await p.context().storageState({ path: `${__dirname}/etat-a1.json` });
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
