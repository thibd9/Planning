// Demandes adressées à un collègue, appel à l'équipe, validation d'un volontaire, et ce que chacun voit ensuite.
const { ouvrir } = require('../lib');
(async () => {
  const o = await ouvrir({ role: 3 });
  const { p } = o; const log = [];
  const etape = async (nom, fn) => { try { await fn(); } catch (e) { log.push(`!! ÉCHEC ${nom}: ${e.message.split('\n')[0].slice(0, 200)}`); await o.shot(`flux2-echec-${nom.replace(/[^a-z0-9]+/gi, '-')}`); await p.keyboard.press('Escape').catch(() => {}); } };
  const D = '.dialog';
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\n+/g, ' | ');
  const toast = async () => { await p.waitForTimeout(300); return p.locator('.toast').innerText().then((t) => t.replace(/\n+/g, ' ')).catch(() => '-'); };
  const remplacer = async (jour) => { await o.nav('demandes'); await p.locator('#dem-remplacements').click(); await p.waitForTimeout(300); await p.locator('.dm', { hasText: jour }).locator('button').last().click(); await p.waitForTimeout(400); };
  const adresser = async (jour, qui, motif = 'famille') => {
    await remplacer(jour);
    const labs = (await p.locator(`${D} fieldset.collegues > label`).allInnerTexts()).map((n) => n.replace(/\n+/g, ' '));
    log.push(`  possibles ${jour} : ${labs.join(' || ')}`);
    const lab = p.locator(`${D} fieldset.collegues > label`).filter({ hasText: qui }).first();
    if (!(await lab.count())) { log.push(`  ${qui} non proposé`); await p.locator(`${D} button`, { hasText: 'Annuler' }).click(); return false; }
    await lab.click(); await p.locator('#rempl-motif').selectOption(motif);
    await p.locator(`${D} button.primary`, { hasText: 'Envoyer la demande' }).click(); log.push(`  envoyé à ${qui} : ` + await toast()); return true;
  };
  // 1. Nicolas demande à Igor (27/11)
  await etape('nicolas-a-igor', async () => { log.push('1. Nicolas -> Igor'); await adresser('Ven. 27 novembre', 'Igor'); });
  // 2. Sarah demande à un collègue de test
  await o.profil('Animateur');
  let cibleSarah = '';
  await etape('sarah-demande', async () => {
    log.push('2. Sarah demande');
    for (const j of ['Lun. 30 novembre', 'Ven. 4 décembre', 'Mar. 1 décembre', 'Ven. 27 novembre']) {
      for (const q of ['Nicolas', 'Yanis', 'Manon', 'Igor']) { if (await adresser(j, q)) { cibleSarah = q; break; } }
      if (cibleSarah) break;
    }
  });
  // 3. Caroline : accord pour les demandes adressées ; congé de Nicolas accepté ; appel à l'équipe
  await o.profil('Titulaire 1');
  await o.nav('resoudre');
  await etape('caroline-accords', async () => {
    await p.locator('#onglet-remplacements').click(); await p.waitForTimeout(400);
    log.push('3. Résoudre rempl : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 2500));
    await o.shot('flux2-1-resoudre-adressees', { fullPage: true });
  });
  await etape('caroline-conge', async () => {
    await p.locator('#onglet-demandes').click(); await p.waitForTimeout(400);
    await p.locator('[data-decider]').first().click(); await p.waitForTimeout(300);
    log.push('3. Décider : ' + (await txt(`${D} .dialog-titre, ${D} h2`)));
    await p.locator('label[for="dc-accepter"]').click(); await p.locator('#dc-confirmer').click(); log.push('   ' + await toast());
    await p.locator('#onglet-absences').click(); await p.waitForTimeout(400);
    log.push('3. Absences : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 1800));
    const prev = p.locator('section.appel button', { hasText: /^Prévenir/ }).first();
    log.push('   bouton : ' + (await prev.innerText().catch(() => 'aucun')));
    await prev.click(); log.push('   appel : ' + await toast());
    await o.shot('flux2-2-appel-lance', { fullPage: true });
    log.push('   appel liste : ' + await txt('section.appel'));
  });
  // 4. Igor : demande qui lui est adressée -> « Je ne peux pas »
  await o.profil('Pharmacien');
  await etape('igor-refuse', async () => {
    log.push('\n4. Igor accueil : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 600));
    await o.shot('flux2-3-igor-accueil');
    await o.nav('moi');
    log.push('   carte : ' + await txt('[data-focus="aider"]'));
    await p.locator('[data-focus="aider"] .decision', { hasText: '27 nov' }).locator('button', { hasText: 'Je ne peux pas' }).click(); await p.waitForTimeout(300);
    log.push('   dialogue : ' + await txt(D)); await o.shot('flux2-4-igor-refus');
    await p.locator('#refus-raison').selectOption({ index: 1 }); await p.locator(`${D} button.btn.danger`).click(); log.push('   ' + await toast());
    log.push('   carte après : ' + await txt('[data-focus="aider"]').catch(() => 'aucune'));
  });
  // 5. Nicolas voit le refus et élargit
  await o.profil('Préparateur');
  await etape('nicolas-elargit', async () => {
    await o.nav('demandes'); await p.locator('#dem-remplacements').click(); await p.waitForTimeout(300);
    const l = p.locator('.dm', { hasText: 'Ven. 27 novembre' });
    log.push('\n5. Nicolas ligne 27/11 : ' + (await l.innerText()).replace(/\n+/g, ' | '));
    await o.shot('flux2-5-nicolas-refus-igor');
    await l.locator('button', { hasText: 'Demander à toute l’équipe' }).click(); log.push('   ' + await toast());
    log.push('   ligne après : ' + (await l.innerText()).replace(/\n+/g, ' | '));
    await o.nav('messages'); log.push('   messages : ' + (await p.locator('.msg-fils').innerText()).replace(/\n+/g, ' | ').slice(0, 600));
    // l'appel à l'équipe pour son propre poste ?
    await o.nav('moi'); log.push('   carte aider Nicolas : ' + await txt('[data-focus="aider"]').catch(() => 'aucune'));
  });
  // 6. Le collègue demandé par Sarah accepte ; appel : Yanis « Je peux », Manon « Je ne peux pas »
  for (const [n, r] of [['Nicolas', 'Préparateur'], ['Yanis', 'Étudiant'], ['Manon', 'Apprenti'], ['Igor', 'Pharmacien']]) {
    await o.profil(r);
    await etape(`aide-${n}`, async () => {
      await o.nav('moi');
      const carte = p.locator('[data-focus="aider"]');
      log.push(`\n6. ${n} carte : ` + ((await carte.count()) ? await txt('[data-focus="aider"]') : 'aucune'));
      if (n === cibleSarah) { await carte.locator('button', { hasText: 'J’accepte' }).first().click(); log.push(`   ${n} J'accepte : ` + await toast()); await o.shot(`flux2-6-${n}-accepte`); }
      const appel = carte.locator('.appel-recu').first();
      if (await appel.count()) {
        if (n === 'Yanis') { await appel.locator('button', { hasText: 'Je peux' }).click(); log.push('   Yanis Je peux : ' + await toast()); }
        if (n === 'Manon') { await appel.locator('button', { hasText: 'Je ne peux pas' }).click(); await p.waitForTimeout(300); log.push('   dialogue Manon : ' + await txt(D)); await p.locator('#refus-raison').selectOption({ index: 2 }); await p.locator(`${D} button.btn.danger`).click(); log.push('   Manon non : ' + await toast()); }
        await o.shot(`flux2-7-appel-${n}`);
      }
      if (n === 'Igor') { const b = carte.locator('.decision', { hasText: '27 nov' }).locator('button', { hasText: /Je me propose|J’accepte/ }); log.push('   Igor bouton 27 : ' + (await b.count())); if (await b.count()) { await b.first().click(); log.push('   Igor se propose : ' + await toast()); } }
      if (await carte.count()) log.push(`   ${n} carte après : ` + await txt('[data-focus="aider"]'));
    });
  }
  // 7. Caroline valide
  await o.profil('Titulaire 1');
  await o.nav('resoudre');
  await etape('valider', async () => {
    for (const t of ['remplacements', 'absences']) {
      await p.locator(`#onglet-${t}`).click(); await p.waitForTimeout(400);
      log.push(`\n7. ${t} : ` + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 2200));
      await o.shot(`flux2-8-caroline-${t}`, { fullPage: true });
      const bts = p.locator('button', { hasText: /^(Valider avec|Confier)/ });
      const n = await bts.count(); log.push('   boutons : ' + (await bts.allInnerTexts()).join(' / '));
      for (let i = 0; i < n; i++) { const b = p.locator('button', { hasText: /^(Valider avec|Confier)/ }).first(); if (!(await b.count())) break; await b.click(); log.push('   validé : ' + await toast()); await p.waitForTimeout(300); }
    }
  });
  // 8. Retours
  for (const [n, r] of [['Nicolas', 'Préparateur'], ['Igor', 'Pharmacien'], ['Yanis', 'Étudiant'], ['Sarah', 'Animateur'], [cibleSarah, { Nicolas: 'Préparateur', Yanis: 'Étudiant', Manon: 'Apprenti', Igor: 'Pharmacien' }[cibleSarah]]]) {
    if (!r) continue;
    await o.profil(r);
    await etape(`retour-${n}`, async () => {
      log.push(`\n8. ${n} accueil : ` + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 1500));
      await o.nav('moi');
      log.push(`   ${n} mon planning : ` + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 1800));
      await o.shot(`flux2-9-retour-${n}`, { fullPage: true });
      const vu = p.locator('[data-focus="changements"] button', { hasText: 'J\'ai vu ce changement' });
      if (await vu.count()) { await vu.first().click(); await p.waitForTimeout(200); log.push(`   ${n} « J'ai vu » ok, reste ${await vu.count()}`); }
      await o.nav('suivi'); log.push(`   ${n} suivi : ` + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 500));
      await o.nav('demandes'); await p.locator('#dem-remplacements').click(); await p.waitForTimeout(300);
      log.push(`   ${n} mes remplacements : ` + (await o.texte()).split('Quel poste')[1]?.replace(/\n+/g, ' | ').slice(0, 900));
    });
  }
  const d = await o.data();
  log.push('\nREMPLACEMENTS : ' + JSON.stringify(d.remplacements.map((r) => ({ d: r.date, dem: r.demandeur, dest: r.destinataire, st: r.statut, acc: r.accord, vol: r.volontaires, ind: r.indisponibles, rem: r.remplacantId, trou: !!r.trouId }))));
  log.push('NOTIFS : ' + JSON.stringify(d.notifications.map((n) => [n.personId, n.date, n.avant, n.apres, n.luLe ? 'lu' : 'non lu'])));
  log.push('ERR ' + JSON.stringify(o.errs));
  o.ecrire('flux2.txt', log.join('\n'));
  console.log(log.join('\n').slice(0, 25000));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
