// Cycle complet : demandes de Nicolas -> décisions de Caroline -> réponses et volontaires -> validation -> retour.
const { ouvrir } = require('../lib');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const o = await ouvrir({ role: 3 });
  const { p } = o; const log = [];
  const etape = async (nom, fn) => { try { await fn(); } catch (e) { log.push(`!! ÉCHEC ${nom}: ${e.message.split('\n')[0].slice(0, 200)}`); await o.shot(`flux-echec-${nom.replace(/[^a-z0-9]+/gi, '-')}`); await p.keyboard.press('Escape').catch(() => {}); } };
  const D = '.dialog';
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\n+/g, ' | ');
  const toast = async () => { await p.waitForTimeout(300); return p.locator('.toast').innerText().then((t) => t.replace(/\n+/g, ' ')).catch(() => '-'); };
  const nouvelle = async () => { await o.nav('demandes'); await p.locator('#dem-absences').click(); await p.waitForTimeout(300); await p.locator('.card-head button', { hasText: 'Nouvelle demande' }).click(); await p.waitForTimeout(300); };
  const genre = (v) => p.locator(`${D} label.field`, { hasText: 'Type de besoin' }).locator('select').selectOption(v);
  const date = (lib) => p.locator(`${D} label.field`, { hasText: lib }).locator('input[type=date]');
  const remplacer = async (jour) => { await o.nav('demandes'); await p.locator('#dem-remplacements').click(); await p.waitForTimeout(300); await p.locator('.dm', { hasText: jour }).locator('button').last().click(); await p.waitForTimeout(400); };

  // ---------- Phase 1 : Nicolas demande
  await etape('conge', async () => { await nouvelle(); await p.locator('#demande-motif').selectOption('repos'); await genre('absence'); await date('Premier jour').fill('2026-12-14'); await date('Dernier jour').fill('2026-12-18'); await p.locator(`${D} button.primary`, { hasText: 'Envoyer' }).click(); log.push('P1 congé: ' + await toast()); });
  await etape('horaire', async () => { await nouvelle(); await p.locator('#demande-motif').selectOption('famille'); await genre('finir_avant'); await p.locator(`${D} fieldset button`, { hasText: /^mardi$/ }).click(); await p.locator(`${D} label.field`, { hasText: 'Finir avant' }).locator('input').fill('17:00'); await p.locator(`${D} button.primary`, { hasText: 'Envoyer' }).click(); log.push('P1 horaire: ' + await toast()); });
  await etape('rempl-equipe', async () => {
    await remplacer('Ven. 27 novembre');
    log.push('P1 dialogue remplacement 27/11 : ' + (await txt(D)).slice(0, 1400));
    await o.shot('flux-1-remplacer-27');
    await p.locator('#rempl-motif').selectOption('transport'); await p.locator(`${D} button.primary`, { hasText: 'Envoyer la demande' }).click(); log.push('P1 rempl équipe: ' + await toast());
  });
  let destinataire = '';
  await etape('rempl-collegue', async () => {
    await remplacer('Lun. 30 novembre');
    const noms = await p.locator(`${D} fieldset.collegues > label`).allInnerTexts();
    log.push('P1 collègues possibles 30/11 : ' + noms.map((n) => n.replace(/\n+/g, ' ')).join(' || '));
    const lab = p.locator(`${D} fieldset.collegues > label`).filter({ hasText: /Sarah|Yanis|Manon/ }).first();
    destinataire = (await lab.innerText()).split('\n').find((l) => /Sarah|Yanis|Manon/.test(l)) ?? '';
    await lab.click();
    await p.locator('#rempl-motif').selectOption('autre'); await p.waitForTimeout(100);
    log.push('Motif « autre » sans précision -> bouton ' + ((await p.locator(`${D} button.primary`, { hasText: 'Envoyer la demande' }).isDisabled()) ? 'grisé' : 'actif') + ' title=' + await p.locator(`${D} button.primary`, { hasText: 'Envoyer la demande' }).getAttribute('title'));
    await p.locator('#rempl-precision').fill('Mariage');
    await o.shot('flux-2-remplacer-collegue');
    await p.locator(`${D} button.primary`, { hasText: 'Envoyer la demande' }).click(); log.push(`P1 rempl à ${destinataire}: ` + await toast());
  });
  await etape('rempl-medical', async () => {
    await remplacer('Mar. 24 novembre');
    await p.locator(`${D} fieldset.urgence label.medical`).click(); await p.waitForTimeout(150);
    log.push('Médical : motif select désactivé=' + await p.locator('#rempl-motif').isDisabled() + ' valeur=' + await p.locator('#rempl-motif').inputValue());
    await p.locator(`${D} .piece input[type=file]`).setInputFiles({ name: 'texte.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }); await p.waitForTimeout(300);
    log.push('Fichier texte : ' + await p.locator(`${D} .piece`).innerText().then((t) => t.replace(/\n+/g, ' | ')));
    await p.locator(`${D} .piece input[type=file]`).setInputFiles({ name: 'arret.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(600);
    log.push('Fichier PNG : ' + await p.locator(`${D} .piece`).innerText().then((t) => t.replace(/\n+/g, ' | ')));
    await o.shot('flux-3-medical');
    await p.locator(`${D} button.primary`, { hasText: 'Envoyer la demande' }).click(); log.push('P1 rempl médical: ' + await toast());
  });
  await etape('suivi-nicolas-1', async () => { await o.nav('demandes'); await p.locator('#dem-remplacements').click(); await p.waitForTimeout(300); log.push('\nP1 Mes demandes/remplacements : ' + (await o.texte()).split('Quel poste')[1]?.replace(/\n+/g, ' | ').slice(0, 2500)); await o.shot('flux-4-suivi-nicolas', { fullPage: true }); });

  // ---------- Phase 2 : Caroline décide
  await o.profil('Titulaire 1');
  await o.nav('resoudre');
  await etape('resoudre-onglets', async () => { log.push('\nP2 onglets Résoudre : ' + await txt('.ong-barre')); });
  await etape('dec-conge', async () => {
    await p.locator('#onglet-demandes').click(); await p.waitForTimeout(400);
    log.push('P2 Demandes : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 2500));
    await o.shot('flux-5-resoudre-demandes', { fullPage: true });
    const carte = p.locator('[data-decider]').filter({ has: p.locator('xpath=.') });
    // le congé du 14 décembre de Nicolas
    const bloc = p.locator('.decision, .dm, article, li, div').filter({ hasText: /Nicolas/ }).filter({ hasText: /14 déc/ }).locator('[data-decider]').first();
    await bloc.click(); await p.waitForTimeout(400);
    log.push('P2 Décider congé : ' + (await txt(D)).slice(0, 1200));
    await p.locator('label[for="dc-accepter"]').click(); await p.locator('#dc-confirmer').click(); log.push('P2 congé accepté: ' + await toast());
  });
  await etape('dec-horaire', async () => {
    const bloc = p.locator('div, article, li').filter({ hasText: /Nicolas/ }).filter({ hasText: /Finir avant 17 h - mardi/ }).locator('[data-decider]').first();
    await bloc.click(); await p.waitForTimeout(400);
    await p.locator('label[for="dc-refuser"]').click(); await p.waitForTimeout(150);
    await p.locator('#dc-raison').selectOption({ index: 1 }); await p.locator('#dc-mot').fill('Le mardi nous manquons de monde.');
    log.push('P2 aperçu refus horaire : ' + await txt('#dc-message'));
    await p.locator('#dc-confirmer').click(); log.push('P2 horaire refusé: ' + await toast());
  });
  await etape('dec-rempl', async () => {
    await p.locator('#onglet-remplacements').click(); await p.waitForTimeout(400);
    log.push('\nP2 Remplacements : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 3000));
    await o.shot('flux-6-resoudre-rempl', { fullPage: true });
    for (const jour of ['24 nov', '27 nov']) {
      const bt = p.locator('div, li, article').filter({ hasText: /Nicolas/ }).filter({ hasText: new RegExp(jour) }).locator('[data-decider]').first();
      if (!(await bt.count())) { log.push(`P2 pas de bouton Décider pour ${jour}`); continue; }
      await bt.click(); await p.waitForTimeout(400);
      log.push(`P2 Décider rempl ${jour} : ` + (await txt(D)).slice(0, 1500));
      await p.locator('label[for="dr-equipe"]').click(); await p.locator('#dr-confirmer').click(); log.push(`P2 rempl ${jour} accepté (équipe) : ` + await toast());
    }
    const acc = p.locator('div, li, article').filter({ hasText: /Nicolas/ }).filter({ hasText: /30 nov/ }).locator('button', { hasText: 'Accepter' }).last();
    if (await acc.count()) { await acc.click(); log.push('P2 rempl 30/11 accord : ' + await toast()); } else log.push('P2 30/11 : pas de bouton Accepter');
  });

  // ---------- Phase 3 : Nicolas voit les réponses
  await o.profil('Préparateur');
  await etape('nicolas-reponses', async () => {
    log.push('\nP3 Accueil : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 1800));
    await p.locator('.outils .top-ico').first().click(); await p.waitForTimeout(300);
    log.push('P3 Cloche : ' + await txt('.menu.cloche')); await o.shot('flux-7-nicolas-cloche'); await p.keyboard.press('Escape');
    await o.nav('demandes'); await p.locator('#dem-absences').click(); await p.waitForTimeout(300);
    log.push('P3 Absences : ' + (await o.texte()).split('Nouvelle demande')[1]?.replace(/\n+/g, ' | ').slice(0, 2000));
    await p.locator('#dem-remplacements').click(); await p.waitForTimeout(300);
    log.push('P3 Remplacements : ' + (await o.texte()).split('Quel poste')[1]?.replace(/\n+/g, ' | ').slice(0, 2500));
    await o.shot('flux-8-nicolas-rempl', { fullPage: true });
    await o.nav('messages'); log.push('P3 Messages : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 1500));
  });

  // ---------- Phase 4 : le collègue demandé, puis les autres
  const roles = { Sarah: 'Animateur', Yanis: 'Étudiant', Manon: 'Apprenti' };
  const dest = Object.keys(roles).find((n) => destinataire.includes(n));
  for (const [n, r] of Object.entries(roles)) {
    await o.profil(r);
    await etape(`aide-${n}`, async () => {
      log.push(`\nP4 ${n} Accueil : ` + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 900));
      await o.shot(`flux-9-accueil-${n}`);
      await o.nav('moi'); await p.waitForTimeout(300);
      const carte = p.locator('[data-focus="aider"]');
      log.push(`P4 ${n} carte aider : ` + ((await carte.count()) ? await carte.innerText().then((t) => t.replace(/\n+/g, ' | ')) : 'aucune'));
      await o.shot(`flux-10-monplanning-${n}`);
      if (n === dest) { const b = carte.locator('button', { hasText: 'J’accepte' }); if (await b.count()) { await b.click(); log.push(`P4 ${n} J'accepte : ` + await toast()); } }
      const prop = carte.locator('.decision', { hasText: '27 nov' }).locator('button', { hasText: 'Je me propose' });
      if (n === 'Yanis' && (await prop.count())) { await prop.click(); log.push(`P4 ${n} se propose 27/11 : ` + await toast()); }
      if (n === 'Manon' && (await prop.count())) { await prop.click(); log.push(`P4 Manon se propose 27/11 : ` + await toast()); await p.waitForTimeout(200); const ret = carte.locator('.decision', { hasText: '27 nov' }).locator('button', { hasText: 'Retirer' }); if (await ret.count()) { await ret.click(); log.push('P4 Manon retire : ' + await toast()); } }
      if (await carte.count()) log.push(`P4 ${n} carte après : ` + await carte.innerText().then((t) => t.replace(/\n+/g, ' | ')));
    });
  }

  // ---------- Phase 5 : Caroline valide
  await o.profil('Titulaire 1');
  await o.nav('resoudre');
  await etape('valider', async () => {
    await p.locator('#onglet-remplacements').click(); await p.waitForTimeout(400);
    log.push('\nP5 Remplacements : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 2500));
    await o.shot('flux-11-resoudre-volontaires', { fullPage: true });
    const vs = p.locator('button', { hasText: /^Valider avec/ });
    const n = await vs.count(); log.push('P5 boutons Valider : ' + n);
    for (let i = 0; i < n; i++) { await p.locator('button', { hasText: /^Valider avec/ }).first().click(); log.push('P5 validé : ' + await toast()); await p.waitForTimeout(300); }
  });

  // ---------- Phase 6 : retours
  for (const [n, r] of [['Nicolas', 'Préparateur'], ['Sarah', 'Animateur'], ['Yanis', 'Étudiant']]) {
    await o.profil(r);
    await etape(`retour-${n}`, async () => {
      await o.nav('moi');
      log.push(`\nP6 ${n} Mon planning : ` + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 1600));
      await o.shot(`flux-12-retour-${n}`, { fullPage: true });
      await o.nav('suivi'); log.push(`P6 ${n} Suivi : ` + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 700));
      await o.nav('documents'); await p.locator('button[role=tab]', { hasText: 'Mes fichiers' }).click().catch(() => {}); await p.waitForTimeout(200);
      log.push(`P6 ${n} Mes fichiers : ` + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 700));
    });
  }
  const d = await o.data();
  log.push('\nREMPLACEMENTS : ' + JSON.stringify(d.remplacements.map((r) => ({ d: r.date, dem: r.demandeur, dest: r.destinataire, st: r.statut, acc: r.accord, vol: r.volontaires, rem: r.remplacantId, urg: r.urgence, motif: r.motif, precision: r.precision }))));
  log.push('Shifts 24/27/30 : ' + JSON.stringify(d.shifts.filter((s) => ['2026-11-24', '2026-11-27', '2026-11-30'].includes(s.date) && ['p_camille', 'p_sarah', 'p_yanis', 'p_manon'].includes(s.personId)).map((s) => [s.date, s.personId, s.start, s.end])));
  log.push('Snapshot 23/30 : ' + JSON.stringify([...(d.semaines['2026-11-23'].snapshot || []), ...(d.semaines['2026-11-30'].snapshot || [])].filter((s) => ['2026-11-24', '2026-11-27', '2026-11-30'].includes(s.date) && ['p_camille', 'p_sarah', 'p_yanis', 'p_manon'].includes(s.personId)).map((s) => [s.date, s.personId])));
  log.push('Documents : ' + JSON.stringify((d.documents || []).map((x) => [x.personId, x.nom, x.categorie, x.partage, x.origine])));
  log.push('ERR ' + JSON.stringify(o.errs));
  o.ecrire('flux.txt', log.join('\n'));
  console.log(log.join('\n').slice(0, 20000));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
