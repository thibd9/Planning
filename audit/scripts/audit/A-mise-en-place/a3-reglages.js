// A3 : Réglages de la vraie pharmacie, réglage par réglage, et leur effet ailleurs.
const { reprendre } = require('./outils2');
(async () => {
  const o = await reprendre(`${__dirname}/etat-a2.json`);
  const { p, cap, texte } = o; const log = (...a) => console.log(...a);
  await o.fermerTour();
  await o.nav('officine');
  await cap('a3-01-reglages', { fullPage: true });
  // L'officine en chiffres et le dimensionnement d'une pharmacie qui n'a rien saisi.
  const chiffres = {}; for (const c of ['surface', 'surfaceVente', 'reserve', 'caisses', 'comptoirs', 'confidentialite']) chiffres[c] = await p.inputValue(`#officine-${c}`);
  log('CHIFFRES préremplis (rien saisi sauf surface -50) :', JSON.stringify(chiffres), '| clients/jour :', await p.inputValue('#dim-passages'));
  log('EN-TÊTE :', (await texte('.page-head')).replace(/\n/g, ' | '));
  log('DIMENSIONNEMENT :', (await texte('#dimensionnement')).replace(/\n/g, ' | ').slice(0, 700));
  // Nom vidé.
  await p.fill('.of-nom input', ''); await p.waitForTimeout(200);
  log('Nom vidé → barre du haut :', await p.locator('.espace-officine').innerText(), '| sélecteur :', await p.locator('#officine-choix option').first().innerText(), '| titre page :', await p.locator('.page-head h1').innerText());
  await cap('a3-02-nom-vide');
  await p.fill('.of-nom input', 'Pharmacie des Tilleuls');
  // Horaires : fermeture avant l'ouverture, sans alerte ?
  await p.fill('input[aria-label="Fermeture le mercredi"]', '07:00'); await p.waitForTimeout(200);
  let d = await o.courante();
  log('Mercredi fermeture 07:00 → enregistré :', JSON.stringify(d.officine.horaires[2]), '| alerte visible :', await p.locator('#acc-horaires .erreur, #acc-horaires [role=alert]').count());
  log('Résumé horaires :', await p.locator('#acc-horaires').locator('.acc-resume, summary').first().innerText().catch(() => '-'));
  await cap('a3-03-mercredi-incoherent', { clip: await p.locator('#acc-horaires').boundingBox().then((b) => ({ x: b.x, y: b.y, width: b.width, height: Math.min(b.height, 700) })) });
  // Fermeture du midi après la réouverture.
  await p.fill('input[aria-label="Fermeture du midi le mardi"]', '15:00'); await p.waitForTimeout(200);
  d = await o.courante(); log('Mardi midi 15:00 > réouverture 14:00 → enregistré :', JSON.stringify(d.officine.horaires[1]));
  // Fermer le jeudi.
  await p.locator('button[aria-label="Fermer ce jour : jeudi"]').click(); await p.waitForTimeout(200);
  // Ouvrir le dimanche.
  await p.locator('button[aria-label="Ouvrir ce jour : dimanche"]').click(); await p.waitForTimeout(200);
  d = await o.courante(); log('Jeudi fermé, dimanche ouvert →', JSON.stringify(d.officine.horaires.map((h) => h.map((x) => `${x.start / 60}-${x.end / 60}`).join('+') || 'fermé')));
  log('Effectifs après ces changements :', JSON.stringify(d.officine.effectifs.map((e) => `${e.jours}:${e.start / 60}-${e.end / 60}=${e.minEquipe}`)), '| postes :', JSON.stringify(d.officine.postes.map((x) => `${x.label}:${x.jours}`)));
  // Recopier : la veille sur le mercredi.
  await p.locator('button[aria-label="Recopier les horaires : mercredi"]').click(); await p.waitForTimeout(150);
  log('Options de recopie (mercredi) :', (await p.locator('#jl-recopie-2').innerText()).replace(/\n/g, ' | '));
  await p.locator('#jl-recopie-2 button', { hasText: 'Copier la veille' }).click(); await p.waitForTimeout(200);
  d = await o.courante(); log('Mercredi après « Copier la veille » :', JSON.stringify(d.officine.horaires[2]), '| toast :', await o.toast());
  // Coupure le midi sur le samedi (9 h - 13 h : 4 h, bouton proposé ?).
  log('Bouton coupure samedi (9-13) :', await p.locator('button[aria-label="Coupure le midi : samedi"]').count(), '| dimanche (9-19) :', await p.locator('button[aria-label="Coupure le midi : dimanche"]').count());
  // Jours fériés.
  log('JOURS FÉRIÉS :', (await texte('#acc-feries')).replace(/\n/g, ' | ').slice(0, 400));
  // Comptoir : valeurs absurdes.
  const eff = p.locator('.of-effectifs input').first();
  await eff.fill('-3'); await p.waitForTimeout(150); d = await o.courante(); log('Effectif -3 → enregistré :', d.officine.effectifs[0].minEquipe);
  await eff.fill(''); await p.waitForTimeout(150); d = await o.courante(); log('Effectif vidé → enregistré :', d.officine.effectifs[0].minEquipe, '| affiché :', await eff.inputValue());
  await eff.fill('2');
  log('Lignes du tableau effectif (modifiables : nombre seulement) :', await p.locator('.of-effectifs tbody tr').count(), '| boutons ajout/suppression :', await p.locator('#acc-effectif button').count());
  // Qui prépare : vous seul / avec l'équipe ; date limite et publication.
  log('MODÈLE (défaut) :', (await texte('#acc-modele')).replace(/\n/g, ' | ').slice(0, 300));
  log('PUBLICATION (défaut) :', (await texte('#acc-publication')).replace(/\n/g, ' | ').slice(0, 400));
  await p.selectOption('#souhaits-limite', '28'); await p.waitForTimeout(150);
  log('Limite préférences 28 :', (await p.locator('.qp-exemple').innerText()), '| publication :', await p.locator('.pub-exemple').innerText(), '| alerte :', await p.locator('#acc-modele .notice, #acc-publication .notice, .qp-limite .erreur').count());
  await cap('a3-04-limite-vs-publication', { fullPage: true });
  for (const v of ['0', '100', '-5', '']) { await p.fill('#pub-delai', v); await p.waitForTimeout(100); log(`Délai « ${v} » → affiché ${await p.inputValue('#pub-delai')} | enregistré ${(await o.courante()).officine.publication?.delai}`); }
  await p.fill('#pub-delai', '14');
  await p.fill('#pub-rappel', '40'); await p.waitForTimeout(100); log('Rappel 40 →', (await o.courante()).officine.publication?.rappel);
  await p.fill('#pub-rappel', '7');
  // Postes types : modifier en ligne avec une fin avant le début, nom vide.
  const lignes = p.locator('.pt-table tbody tr');
  log('Postes types :', await lignes.count());
  await p.fill('input[aria-label="Fin du poste Matin"]', '07:00'); await p.waitForTimeout(150);
  d = await o.courante(); const matin = d.officine.postes.find((x) => x.label === 'Matin'); log('Poste Matin fin 07:00 → enregistré', matin.start / 60, '→', matin.end / 60, '| travail effectif affiché :', await lignes.nth(2).locator('td').nth(5).innerText());
  await p.fill('input[aria-label="Fin du poste Matin"]', '13:00');
  log('Jours d’un poste type modifiables en ligne :', await lignes.first().locator('td').nth(4).locator('select, input, button').count(), '| pause ajoutable sur « Matin » (sans pause) :', await lignes.nth(2).locator('td').nth(3).locator('input, button').count());
  // Supprimer un poste type, sans confirmation ?
  await p.locator('button[aria-label="Retirer le poste Fermeture"]').click(); await p.waitForTimeout(200);
  log('Après suppression « Fermeture » : toast =', await o.toast(), '| postes =', (await o.courante()).officine.postes.map((x) => x.label).join(', '));
  // Nouveau poste type : validation, jours possibles.
  await p.getByRole('button', { name: 'Ajouter un poste type' }).click(); await p.waitForTimeout(250);
  log('Choix de jours :', (await p.locator('#pt-jours option').allInnerTexts()).join(' / '));
  await p.fill('#pt-debut', '18:00'); await p.fill('#pt-fin', '10:00'); await p.waitForTimeout(100);
  log('Fin avant début : message =', await p.locator('.dialog [role=alert]').innerText().catch(() => '-'), '| bouton désactivé :', await p.getByRole('button', { name: 'Ajouter le poste type' }).isDisabled());
  await p.fill('#pt-debut', '06:00'); await p.fill('#pt-fin', '23:00'); await p.fill('#pt-nom', 'Renfort nuit'); await p.selectOption('#pt-jours', 'tous'); await p.locator('.pt-nuance').nth(2).click();
  log('Poste 6 h - 23 h tous les jours (pharmacie 8 h 30 - 19 h 30, dimanche fermé) : bouton actif =', !(await p.getByRole('button', { name: 'Ajouter le poste type' }).isDisabled()), '| alerte :', await p.locator('.dialog [role=alert]').count());
  await cap('a3-05-poste-type-hors-horaires');
  await p.getByRole('button', { name: 'Ajouter le poste type' }).click(); await p.waitForTimeout(250);
  d = await o.courante(); const renfort = d.officine.postes.find((x) => x.label === 'Renfort nuit'); log('Renfort nuit enregistré :', JSON.stringify({ s: renfort.start, e: renfort.end, jours: renfort.jours, couleur: renfort.couleur }));
  // Paramètres.
  await p.fill('input[placeholder="à saisir"]', '-2'); await p.waitForTimeout(100);
  const plafond = p.locator('#acc-parametres input[type=number]').nth(1); await plafond.fill('-4'); await p.waitForTimeout(100);
  const ca = p.locator('#acc-parametres input[type=number]').nth(2); await ca.fill('2900000'); await p.waitForTimeout(100);
  d = await o.courante(); log('Paramètres → valeurPoint', d.officine.valeurPoint, '| plafond', d.officine.plafondPrioritaires, '| CA', d.officine.caAnnuelHT);
  log('Résumé paramètres :', await p.locator('#acc-parametres').locator('.acc-resume').innerText().catch(async () => (await texte('#acc-parametres')).split('\n').slice(0, 3).join(' | ')));
  await plafond.fill('2'); await p.fill('input[placeholder="à saisir"]', '');
  await p.check('#couts-afficher'); await p.waitForTimeout(100);
  await cap('a3-06-parametres', { fullPage: true });
  await o.sauver('etat-a3.json');
  log('ERREURS console :', o.errs.join(' || ') || 'aucune');
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
