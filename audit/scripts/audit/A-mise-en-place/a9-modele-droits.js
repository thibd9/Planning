// A9 (exemple) : « Vous seul » / « Avec l'équipe » vu par l'équipe ; ce qu'un titulaire secondaire peut changer sans accord.
const { exemple } = require('./outils');
(async () => {
  const o = await exemple({ role: 0 });
  const { p, cap, texte } = o; const log = (...a) => console.log(...a);
  await o.fermerTour();
  const profil = async (t) => { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); await p.locator('.bandeau-test button', { hasText: t }).first().click(); await p.waitForTimeout(700); await o.fermerTour(); };
  await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250);
  log('Profils du menu de test :', (await p.locator('.bandeau-test .bt-roles button').allInnerTexts()).map((t) => t.replace(/\n/g, ' ')).join(' / '));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const vueEquipe = async (lab) => {
    await profil('Préparateur'); await o.nav('demandes'); await p.waitForTimeout(400);
    log(`${lab} · Nicolas, Mes demandes :`, (await texte('.content')).replace(/\n/g, ' | ').slice(0, 420));
    await cap(`a9-${lab}-nicolas-demandes`);
    await o.nav('espace'); log(`${lab} · Nicolas, accueil mentionne préférences :`, /préférence/i.test(await texte('.content')));
    await profil('Titulaire');
  };
  await vueEquipe('avec-equipe');
  await o.nav('officine'); await p.locator('#acc-modele label', { hasText: 'Vous seul' }).click(); await p.waitForTimeout(300);
  log('Résumé modèle :', (await texte('#qp-effets')).replace(/\n/g, ' | ').slice(0, 300));
  await o.nav('tableau'); log('Tableau titulaire mentionne « préférences » :', ((await texte('.content')).match(/[^|\n]*référence[^|\n]*/g) || []).slice(0, 4).join(' || '));
  await o.nav('construire'); log('Construire : case « Préférences » :', await p.locator('#plan-preferences').count());
  await vueEquipe('vous-seul');
  // Aide : la fiche « préférences » suit-elle ?
  await o.nav('officine'); await p.locator('#acc-modele label', { hasText: 'Avec l’équipe' }).click(); await p.waitForTimeout(200);
  // Pierre, titulaire secondaire : réglages, règles, remise à zéro.
  await profil('Titulaire secondaire').catch(async () => profil('Pierre'));
  log('Profil actuel :', await p.locator('.espace-badge').innerText());
  await o.nav('officine');
  await p.fill('.of-nom input', 'Pharmacie renommée par Pierre'); await p.waitForTimeout(200);
  let d = await o.courante(); log('Pierre renomme : enregistré =', d.officine.nom, '| accords en attente :', (d.accords || []).length);
  await p.fill('.of-nom input', 'Grande Pharmacie de la Pinède');
  await o.nav('regles'); const f = p.locator('details.rg', { hasText: 'Repos quotidien' }).first(); await f.locator('summary').click(); await f.locator('input[type=number]').fill('9'); await f.getByRole('button', { name: 'Enregistrer' }).click(); await p.waitForTimeout(300);
  d = await o.courante(); log('Pierre baisse le repos quotidien à 9 h : enregistré =', d.regles.find((r) => r.id === 'repos.quotidien').valeur, '| accords :', (d.accords || []).length, '| toast :', await o.toast());
  await o.nav('officine'); log('Pierre voit « Repartir de zéro » :', await p.locator('#acc-zero').count(), '| Dimensionnement :', await p.locator('#dimensionnement').count());
  await o.nav('equipe'); await p.locator('.g-item', { hasText: 'Nicolas' }).click(); await p.waitForTimeout(300);
  await p.locator('.fiche-contrat input[type=number]').first().fill('20'); await p.waitForTimeout(200);
  d = await o.courante(); log('Pierre change les heures de Nicolas : enregistré =', d.personnes.find((x) => x.prenom === 'Nicolas').heuresHebdo, '| accords :', (d.accords || []).length);
  await p.getByRole('button', { name: /Retirer de l’équipe/ }).click(); await p.getByRole('button', { name: /Oui, retirer Nicolas/ }).click(); await p.waitForTimeout(400);
  d = await o.courante(); log('Pierre retire Nicolas : toujours là =', !!d.personnes.find((x) => x.prenom === 'Nicolas'), '| accords :', (d.accords || []).map((a) => a.titre).join(' ; '), '| toast :', await o.toast());
  await cap('a9-pierre-retrait-accord');
  await o.nav('officine'); await p.locator('#acc-zero').getByRole('button', { name: 'Réinitialiser' }).click(); await p.getByRole('button', { name: /Oui, réinitialiser/ }).click(); await p.waitForTimeout(600);
  const e = await o.etat(); log('Pierre réinitialise : pharmacies restantes =', Object.values(e.officines).map((x) => `${x.officine.nom || '(vide)'}:${x.personnes.length} pers.`).join(', '), '| écran :', await p.title());
  log('ERREURS console :', o.errs.join(' || ') || 'aucune');
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
