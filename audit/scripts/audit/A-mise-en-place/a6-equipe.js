// A6 : Équipe dans la vraie pharmacie : ajout, fiche (fonction, heures, contrat, entrée, compétences), marques, droits, mot de passe.
const { reprendre } = require('./outils2');
(async () => {
  const o = await reprendre(`${__dirname}/etat-a5.json`);
  const { p, cap, texte } = o; const log = (...a) => console.log(...a);
  await o.fermerTour();
  const pers = async (n) => (await o.courante()).personnes.find((x) => `${x.prenom} ${x.nom}` === n);
  const ouvrir = async (n) => { await p.locator('.g-item', { hasText: n }).first().click(); await p.waitForTimeout(300); };
  await o.nav('equipe');
  await cap('a6-01-equipe', { fullPage: true });
  log('LISTE :', (await p.locator('.split > .col').first().innerText()).replace(/\n/g, ' | '));
  // Ajouter : champs vides, heures absurdes, homonyme.
  const ajouter = async (prenom, nom, q, h, taux, externe) => {
    await p.locator('[data-focus="ajouter-personne"]').click(); await p.waitForTimeout(300);
    if (prenom !== null) { await p.fill('#personne-prenom', prenom); await p.fill('#personne-nom', nom); }
    if (externe) await p.locator('.dialog input[type=checkbox]').check();
    if (q) await p.selectOption('#personne-fonction', q);
    if (h !== undefined && (await p.locator('#personne-heures').count())) await p.fill('#personne-heures', h);
    if (taux !== undefined && (await p.locator('#personne-taux').count())) await p.fill('#personne-taux', taux);
    const b = p.locator('.dialog').getByRole('button', { name: 'Ajouter', exact: true }); const actif = !(await b.isDisabled());
    if (actif) await b.click(); else await p.locator('.dialog').getByRole('button', { name: 'Annuler' }).click();
    await p.waitForTimeout(300); return actif;
  };
  await p.locator('[data-focus="ajouter-personne"]').click(); await p.waitForTimeout(300);
  log('Fonctions proposées :', (await p.locator('#personne-fonction option').allInnerTexts()).join(' / '));
  log('Champs du dialogue :', (await p.locator('.dialog label').allInnerTexts()).map((t) => t.split('\n')[0]).join(' / '));
  await cap('a6-02-ajout-dialogue');
  await p.locator('.dialog').getByRole('button', { name: 'Annuler' }).click(); await p.waitForTimeout(200);
  log('Ajout sans nom possible :', await ajouter('', '', null));
  log('Ajout « Zoé Faure » 200 h, taux -10 :', await ajouter('Zoé', 'Faure', 'preparateur', '200', '-10'), '→', JSON.stringify(await pers('Zoé Faure').then((x) => ({ h: x.heuresHebdo, taux: x.tauxHoraire, id: x.identifiant }))), '| toast :', await o.toast());
  log('Ajout « Yves Noir » -8 h :', await ajouter('Yves', 'Noir', 'rayonniste', '-8'), '→', (await pers('Yves Noir')).heuresHebdo);
  log('Ajout homonyme « Julie Bernard » :', await ajouter('Julie', 'Bernard', 'adjoint', '20'), '→ identifiants :', (await o.courante()).personnes.filter((x) => x.prenom === 'Julie').map((x) => x.identifiant).join(', '));
  // Remplaçant coché puis fonction « Titulaire » : le remplaçant devient-il titulaire extérieur ?
  await p.locator('[data-focus="ajouter-personne"]').click(); await p.waitForTimeout(300);
  await p.fill('#personne-prenom', 'Rémi'); await p.fill('#personne-nom', 'Extérieur'); await p.selectOption('#personne-fonction', 'adjoint'); await p.locator('.dialog input[type=checkbox]').check(); await p.selectOption('#personne-fonction', 'titulaire'); await p.waitForTimeout(150);
  log('Remplaçant puis Titulaire : case remplaçant visible =', await p.locator('.dialog input[type=checkbox]').count());
  await p.locator('.dialog').getByRole('button', { name: 'Ajouter', exact: true }).click(); await p.waitForTimeout(300);
  const remi = await pers('Rémi Extérieur'); log('Rémi enregistré :', JSON.stringify({ q: remi.qualification, externe: remi.externe, id: remi.identifiant, h: remi.heuresHebdo }));
  log('Fiche Rémi :', (await texte('.split > .card')).replace(/\n/g, ' | ').slice(0, 300));
  await cap('a6-03-remi-titulaire-exterieur');
  // Fiche de Marc : heures, contrat, entrée, fonction.
  await ouvrir('Marc Petit');
  const heures = p.locator('.fiche-contrat input[type=number]').first();
  for (const v of ['-5', '0', '100', '']) { await heures.fill(v); await p.waitForTimeout(120); log(`Heures « ${v} » → enregistré ${(await pers('Marc Petit')).heuresHebdo} | affiché ${await heures.inputValue()}`); }
  await heures.fill('35');
  log('Types de contrat (préparateur) :', (await p.locator('#fiche-contrat option').allInnerTexts()).join(' / '));
  await p.selectOption('#fiche-contrat', { index: 1 }); await p.waitForTimeout(100); log('Contrat choisi :', (await pers('Marc Petit')).contrat, '| résumé :', await p.locator('.acc', { hasText: 'Poste et contrat' }).locator('summary').innerText().then((t) => t.replace(/\n/g, ' ')));
  await p.fill('#fiche-entree', '2031-05-01'); await p.waitForTimeout(150);
  log('Entrée future 2031-05-01 → enregistré', (await pers('Marc Petit')).entreeLe, '| aide :', await p.locator('#fiche-anciennete').innerText());
  await p.fill('#fiche-entree', '2018-03-15'); await p.waitForTimeout(150); log('Entrée 2018-03-15 → aide :', await p.locator('#fiche-anciennete').innerText());
  // Compétences d'un préparateur : les réservées.
  const reservees = await p.locator('.comp.reservee').allInnerTexts(); log('Compétences réservées (verrouillées) pour un préparateur :', reservees.map((t) => t.trim()).join(' / '));
  // Julie : pharmacienne avec une compétence réservée, puis passée préparatrice.
  await ouvrir('Julie Bernard');
  const premiereReservee = await p.locator('.comp[data-competence]').evaluateAll((els) => els.map((e) => e.getAttribute('data-competence')));
  await p.locator('.comp[data-competence="entretien"]').click(); await p.waitForTimeout(150);
  log('Julie compétences :', (await pers('Julie Bernard')).competences.join(','));
  await p.locator('.fiche-contrat select').first().selectOption('preparateur'); await p.waitForTimeout(200);
  const j = await pers('Julie Bernard'); log('Julie passée préparatrice : compétences gardées =', j.competences.join(','), '| salarie', j.salarie, '| contrat', j.contrat, '| volontaireGardes', j.volontaireGardes);
  log('Bouton « Entretiens » affiché :', await p.locator('.comp[data-competence="entretien"]').getAttribute('class'));
  await cap('a6-04-julie-preparatrice-competence-reservee');
  await p.locator('.fiche-contrat select').first().selectOption('adjoint'); await p.waitForTimeout(200);
  // Le titulaire principal change sa propre fonction.
  await ouvrir('Claire Martin');
  log('Fonctions proposées pour Claire :', (await p.locator('.fiche-contrat select').first().locator('option').allInnerTexts()).join(' / '));
  await p.locator('.fiche-contrat select').first().selectOption('preparateur'); await p.waitForTimeout(300);
  log('Claire préparatrice → espace :', await p.locator('.espace-badge').innerText(), '| rôle fiche :', await p.locator('.split > .card .card-head .small').innerText(), '| menu Réglages :', await p.locator('[data-tour="nav-officine"]').count());
  await cap('a6-05-claire-preparatrice');
  const cl = await pers('Claire Martin'); log('Claire enregistrée :', cl.qualification, 'salarie', cl.salarie, 'contrat', cl.contrat);
  await p.locator('.fiche-contrat select').first().selectOption('titulaire'); await p.waitForTimeout(300);
  // Animatrice : les marques.
  await ouvrir('Inès Garcia');
  log('Fiche Inès (rubriques) :', (await p.locator('.split > .card summary').allInnerTexts()).map((t) => t.split('\n')[0]).join(' / '));
  log('Texte marques :', await p.locator('.acc', { hasText: 'Marques présentées' }).locator('p.small').first().innerText());
  await p.fill('#mq-nom', 'Avène'); await p.locator('#mq-ajouter').click(); await p.waitForTimeout(200); log('Ajout Avène, toast :', await o.toast());
  await p.fill('#mq-nom', '  avène '); await p.waitForTimeout(100); log('Doublon « avène » : bouton désactivé', await p.locator('#mq-ajouter').isDisabled(), '|', await p.locator('#mq-deja').innerText().catch(() => '-'));
  await p.fill('#mq-nom', ''); 
  await p.locator('.mq .mq-types button').first().click(); await p.waitForTimeout(100);
  log('Marques d’Inès :', JSON.stringify((await pers('Inès Garcia')).marques.map((m) => [m.marque, m.types])), '| répertoire :', JSON.stringify((await o.courante()).officine.marques));
  await p.locator('input[id^="mq-mq"]').first().fill(''); await p.waitForTimeout(100);
  log('Nom de marque vidé dans la fiche → enregistré :', JSON.stringify((await pers('Inès Garcia')).marques.map((m) => m.marque)));
  await cap('a6-06-marques');
  // Droits d'accès : donner la gestion à Léa (préparatrice).
  await ouvrir('Léa Roux');
  await p.locator('.acc', { hasText: 'Droits d’accès' }).locator('input[type=checkbox]').check(); await p.waitForTimeout(200);
  log('Gestion donnée à Léa, toast :', await o.toast(), '| enregistré :', (await pers('Léa Roux')).gestion);
  // Mot de passe provisoire régénéré.
  const avant = (await pers('Marc Petit')).provisoire; await ouvrir('Marc Petit');
  await p.locator('.acc', { hasText: 'Compte de connexion' }).getByRole('button', { name: /Nouveau mot de passe provisoire/ }).click(); await p.waitForTimeout(200);
  log('Nouveau provisoire Marc :', avant, '→', (await pers('Marc Petit')).provisoire, '| toast :', await o.toast());
  // Besoin ou absence depuis la fiche de Léa.
  await ouvrir('Léa Roux'); await p.getByRole('button', { name: /Besoin ou absence/ }).click(); await p.waitForTimeout(400);
  log('DIALOGUE besoin :', (await texte('.dialog')).replace(/\n/g, ' | ').slice(0, 900));
  await cap('a6-07-besoin-dialogue', { fullPage: true });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await o.sauver('etat-a6.json');
  // Léa se connecte : espace responsable ?
  await o.deconnecter(); await o.connecter('lea.roux', (await (async () => { const s = require('./lire-etat')(`${__dirname}/etat-a6.json`); const d = s.v3.officines[s.v3.courante]; return d.personnes.find((x) => x.prenom === 'Léa').provisoire; })()));
  log('Léa connectée (accès gestion) : badge', await p.locator('.espace-badge').innerText().catch(() => '-'), '| menu :', (await p.locator('.side .nav-item').allInnerTexts()).map((t) => t.split('\n')[0]).join(', '));
  await o.fermerTour();
  await o.nav('officine');
  log('Léa voit « Repartir de zéro » :', await p.locator('#acc-zero').count(), '| Dimensionnement :', await p.locator('#dimensionnement').count());
  await cap('a6-08-lea-gestion-reglages');
  log('ERREURS console :', o.errs.join(' || ') || 'aucune');
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
