// A5 : Règles (filtres, seuils, « Me prévenir ») et leur effet sur Construire ; quota de pharmaciens.
const { reprendre } = require('./outils2');
(async () => {
  const o = await reprendre(`${__dirname}/etat-a4.json`);
  const { p, cap, texte } = o; const log = (...a) => console.log(...a);
  await o.fermerTour();
  const controles = async () => (await texte('[data-tour="controles"]')).replace(/\n/g, ' | ').slice(0, 1600);
  const semaine30 = async () => { await p.reload(); await p.waitForTimeout(600); await o.fermerTour(); await o.nav('construire'); await p.locator('button[aria-label="Semaine suivante"]').click(); await p.waitForTimeout(600); };
  await o.nav('regles');
  await cap('a5-01-regles', { fullPage: true });
  for (const f of ['Toutes', 'Obligatoires', 'Réglables', 'À faire valider']) {
    await p.locator('.jr-filtre', { hasText: f }).click(); await p.waitForTimeout(200);
    const n = await p.locator('details.rg').count(); const imp = await p.locator('details.rg .rg-etat.obligatoire').count();
    log(`Filtre ${f} : compteur ${await p.locator('.jr-filtre', { hasText: f }).locator('.rg-nb').innerText()} | affichées ${n} dont obligatoires ${imp}`);
  }
  await p.locator('.jr-filtre', { hasText: 'Toutes' }).click(); await p.waitForTimeout(200);
  const fiche = (t) => p.locator('details.rg', { hasText: t }).first();
  const regler = async (t, v) => { const f = fiche(t); if (!(await f.evaluate((e) => e.open))) await f.locator('summary').click(); await p.waitForTimeout(100); await f.locator('input[type=number]').fill(v); await p.waitForTimeout(100); const b = f.getByRole('button', { name: 'Enregistrer' }); const ok = await b.count(); if (ok) await b.click(); await p.waitForTimeout(200); return ok; };
  log('Fiche « Durée quotidienne maximale » ouverte :', (await (async () => { await fiche('Durée quotidienne maximale').locator('summary').click(); return (await fiche('Durée quotidienne maximale').innerText()).replace(/\n/g, ' | '); })()));
  await cap('a5-02-regle-obligatoire-ouverte');
  log('Seuil obligatoire porté à 8 h, bouton Enregistrer :', await regler('Durée quotidienne maximale', '8'), '| toast :', await o.toast());
  let d = await o.courante(); log('Enregistré :', d.regles.find((r) => r.id === 'duree.quotidienne').valeur, 'version', d.regles.find((r) => r.id === 'duree.quotidienne').version);
  await semaine30();
  log('CONTRÔLES semaine 30 nov. avec 8 h max :', await controles());
  await cap('a5-03-construire-seuil-8h', { fullPage: true });
  await o.nav('regles');
  log('Seuil -5 accepté :', await regler('Durée quotidienne maximale', '-5'), '→', (await o.courante()).regles.find((r) => r.id === 'duree.quotidienne').valeur);
  log('Seuil 30 accepté :', await regler('Durée quotidienne maximale', '30'), '→', (await o.courante()).regles.find((r) => r.id === 'duree.quotidienne').valeur);
  log('Repos quotidien (« Lue sur le texte », obligatoire) porté à 2 h :', await regler('Repos quotidien', '2'), '→', (await o.courante()).regles.find((r) => r.id === 'repos.quotidien').valeur);
  await cap('a5-04-regles-seuils-absurdes', { fullPage: true });
  await regler('Durée quotidienne maximale', '10'); await regler('Repos quotidien', '11');
  // « Me prévenir » : couper l'alerte d'effectif minimal.
  const eff = fiche('Effectif minimal au comptoir'); await eff.locator('summary').click(); await p.waitForTimeout(100);
  await eff.locator('input[type=checkbox]').uncheck(); await p.waitForTimeout(200);
  log('Alerte effectif coupée, toast :', await o.toast(), '| libellé dans la liste :', (await eff.locator('summary').innerText()).replace(/\n/g, ' '));
  await semaine30();
  log('CONTRÔLES sans alerte d’effectif :', await controles());
  log('Ligne « Équipe au complet ? » :', (await p.locator('.plan-grid .pg-o').allInnerTexts()).slice(1, 8).map((x) => x.replace(/\n/g, ' ')).join(' / '));
  await cap('a5-05-construire-sans-alerte-effectif', { fullPage: true });
  await o.nav('regles'); await fiche('Effectif minimal au comptoir').locator('summary').click(); await fiche('Effectif minimal au comptoir').locator('input[type=checkbox]').check(); await p.waitForTimeout(150);
  // Effectif minimum à 9 : effet sur la semaine préparée.
  await o.nav('officine'); await p.locator('.of-effectifs input').first().fill('9'); await p.waitForTimeout(150);
  await semaine30();
  log('CONTRÔLES avec minimum 9 :', (await controles()).slice(0, 500));
  await o.nav('officine'); await p.locator('.of-effectifs input').first().fill('2'); await p.waitForTimeout(150);
  // Le quota de pharmaciens : Équipe et Dimensionnement.
  await o.nav('equipe');
  log('ÉQUIPE en-tête (CA 2 900 000 dans Paramètres) :', (await texte('.page-head')).replace(/\n/g, ' | '));
  log('ÉQUIPE alertes :', (await p.locator('.content > div > .notice.warn').allInnerTexts()).join(' || '));
  await cap('a5-06-equipe-quota');
  await o.nav('officine');
  log('Dimensionnement, règle officielle avant saisie de l’activité :', await p.locator('#dim-adjoints').count());
  await p.fill('#dim-activite', '2900000'); await p.waitForTimeout(200);
  log('Dimensionnement, activité 2 900 000 :', (await p.locator('#dim-adjoints').innerText().catch(() => '-')).replace(/\n/g, ' '));
  await o.nav('regles'); await regler('Nombre de pharmaciens', '900000');
  await o.nav('equipe'); log('ÉQUIPE en-tête après tranche 900 000 € :', (await texte('.page-head')).replace(/\n/g, ' | '));
  await o.nav('officine'); log('Dimensionnement après tranche 900 000 € :', (await p.locator('#dim-adjoints').innerText().catch(() => '-')).replace(/\n/g, ' '));
  await cap('a5-07-dimensionnement-quota', { fullPage: true });
  await o.nav('regles'); await regler('Nombre de pharmaciens', '1300000');
  // Le journal garde-t-il les changements ?
  await o.nav('journal'); await p.waitForTimeout(300);
  log('JOURNAL (début) :', (await texte('.content')).replace(/\n/g, ' | ').slice(0, 900));
  await o.sauver('etat-a5.json');
  log('ERREURS console :', o.errs.join(' || ') || 'aucune');
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
