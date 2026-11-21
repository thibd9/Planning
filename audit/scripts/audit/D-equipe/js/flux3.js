// Igor accepte la demande de Nicolas ; appel à l'équipe sur les postes du congé de Nicolas.
const { ouvrir } = require('../lib');
(async () => {
  const o = await ouvrir({ role: 3 });
  const { p } = o; const log = [];
  const etape = async (nom, fn) => { try { await fn(); } catch (e) { log.push(`!! ÉCHEC ${nom}: ${e.message.split('\n')[0].slice(0, 200)}`); await o.shot(`flux3-echec-${nom.replace(/[^a-z0-9]+/gi, '-')}`); await p.keyboard.press('Escape').catch(() => {}); } };
  const D = '.dialog';
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\n+/g, ' | ');
  const toast = async () => { await p.waitForTimeout(300); return p.locator('.toast').innerText().then((t) => t.replace(/\n+/g, ' ')).catch(() => '-'); };
  await etape('nicolas-a-igor', async () => {
    await o.nav('demandes'); await p.locator('#dem-remplacements').click(); await p.waitForTimeout(300);
    await p.locator('.dm', { hasText: 'Ven. 27 novembre' }).locator('button').last().click(); await p.waitForTimeout(300);
    await p.locator(`${D} fieldset.collegues > label`).filter({ hasText: 'Igor' }).click(); await p.locator('#rempl-motif').selectOption('famille');
    await p.locator(`${D} button.primary`, { hasText: 'Envoyer la demande' }).click(); log.push('Nicolas -> Igor : ' + await toast());
  });
  await o.profil('Titulaire 1'); await o.nav('resoudre');
  await etape('caroline', async () => {
    await p.locator('#onglet-demandes').click(); await p.waitForTimeout(400);
    // congé de Nicolas (30 nov.)
    const n = await p.locator('[data-decider]').count();
    for (let i = 0; i < n; i++) { await p.locator('[data-decider]').nth(i).click(); await p.waitForTimeout(300); const t = await txt(`${D}`); if (/congé de Nicolas/.test(t)) { await p.locator('label[for="dc-accepter"]').click(); await p.locator('#dc-confirmer').click(); log.push('Congé accepté : ' + await toast()); break; } await p.locator(`${D} button`, { hasText: 'Plus tard' }).click(); await p.waitForTimeout(200); }
    await p.locator('#onglet-absences').click(); await p.waitForTimeout(400);
    const prev = p.locator('section.appel button', { hasText: /^Prévenir/ });
    const k = await prev.count(); log.push('Boutons Prévenir : ' + (await prev.allInnerTexts()).join(' / '));
    for (let i = 0; i < k; i++) { await p.locator('section.appel button', { hasText: /^Prévenir/ }).first().click(); log.push('  appel : ' + await toast()); await p.waitForTimeout(300); }
    log.push('Appels : ' + (await p.locator('section.appel').allInnerTexts()).map((t) => t.replace(/\n+/g, ' | ').slice(0, 400)).join('\n   '));
    await o.shot('flux3-1-appels', { fullPage: true });
  });
  await o.profil('Pharmacien');
  await etape('igor-accepte', async () => {
    await o.nav('moi');
    await p.locator('[data-focus="aider"] .decision', { hasText: '27 nov' }).locator('button', { hasText: 'J’accepte' }).click(); log.push('Igor accepte : ' + await toast());
    log.push('Carte Igor après : ' + await txt('[data-focus="aider"]'));
  });
  await o.profil('Préparateur');
  await etape('nicolas-voit', async () => { await o.nav('demandes'); await p.locator('#dem-remplacements').click(); await p.waitForTimeout(300); log.push('Nicolas ligne 27 : ' + (await p.locator('.dm', { hasText: 'Ven. 27 novembre' }).innerText()).replace(/\n+/g, ' | ')); await o.shot('flux3-2-nicolas-igor-accepte'); });
  for (const [n, r] of [['Sarah', 'Animateur'], ['Yanis', 'Étudiant'], ['Manon', 'Apprenti']]) {
    await o.profil(r);
    await etape(`appel-${n}`, async () => {
      log.push(`\n${n} accueil prio : ` + ((await p.locator('.tb-priorite').count()) ? await txt('.tb-priorite') : 'aucune'));
      await o.nav('moi');
      const carte = p.locator('[data-focus="aider"]');
      log.push(`${n} carte : ` + ((await carte.count()) ? await txt('[data-focus="aider"]') : 'aucune'));
      const appel = carte.locator('.appel-recu').first();
      if (await appel.count()) {
        if (n !== 'Manon') { await appel.locator('button', { hasText: 'Je peux' }).click(); log.push(`${n} Je peux : ` + await toast()); }
        else { await appel.locator('button', { hasText: 'Je ne peux pas' }).click(); await p.waitForTimeout(300); log.push('Dialogue : ' + await txt(D)); await p.locator('#refus-raison').selectOption({ index: 2 }); await p.locator(`${D} button.btn.danger`).click(); log.push('Manon non : ' + await toast()); }
        log.push(`${n} carte après : ` + await txt('[data-focus="aider"]'));
        await o.shot(`flux3-3-appel-${n}`);
      }
    });
  }
  await o.profil('Titulaire 1'); await o.nav('resoudre');
  await etape('valider', async () => {
    await p.locator('#onglet-remplacements').click(); await p.waitForTimeout(400);
    log.push('\nRemplacements : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 1500));
    const v = p.locator('button', { hasText: /^Valider avec Igor/ }); if (await v.count()) { await v.click(); log.push('Valider Igor : ' + await toast()); } else log.push('pas de bouton Valider avec Igor');
    await p.locator('#onglet-absences').click(); await p.waitForTimeout(400);
    log.push('Appels : ' + (await p.locator('section.appel').allInnerTexts()).map((t) => t.replace(/\n+/g, ' | ').slice(0, 500)).join('\n   '));
    const c = p.locator('section.appel button', { hasText: /^Confier/ });
    if (await c.count()) { await c.first().click(); log.push('Confier : ' + await toast()); }
  });
  for (const [n, r] of [['Nicolas', 'Préparateur'], ['Igor', 'Pharmacien'], ['Sarah', 'Animateur'], ['Yanis', 'Étudiant']]) {
    await o.profil(r);
    await etape(`retour-${n}`, async () => {
      await p.locator('.outils .top-ico').first().click(); await p.waitForTimeout(300); log.push(`\n${n} cloche : ` + await txt('.menu.cloche')); await p.keyboard.press('Escape');
      await o.nav('moi');
      const ch = p.locator('[data-focus="changements"]');
      log.push(`${n} Ce qui a changé : ` + ((await ch.count()) ? await txt('[data-focus="changements"]') : 'rien'));
      log.push(`${n} semaine prochaine : ` + ((await p.locator('.card', { hasText: 'Semaine prochaine' }).count()) ? (await p.locator('.card', { hasText: 'Semaine prochaine' }).first().innerText()).replace(/\n+/g, ' | ').slice(0, 900) : '-'));
      await o.shot(`flux3-4-retour-${n}`, { fullPage: true });
      if (await ch.count()) { const b = ch.locator('button', { hasText: 'J\'ai vu ce changement' }); const k = await b.count(); if (k) { await b.first().click(); await p.waitForTimeout(200); log.push(`${n} J'ai vu : reste ${await ch.locator('button', { hasText: 'J\'ai vu ce changement' }).count()} / ${k}`); } }
      await o.nav('suivi'); log.push(`${n} suivi : ` + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 420) + ' … ' + ((await o.texte()).match(/Remplacements assurés\s*\n\s*\d+/)?.[0] ?? '').replace(/\n/g, ' '));
    });
  }
  const d = await o.data();
  log.push('\nREMPLACEMENTS : ' + JSON.stringify(d.remplacements.map((r) => ({ d: r.date, dem: r.demandeur, dest: r.destinataire, st: r.statut, acc: r.accord, vol: r.volontaires, ind: r.indisponibles, sol: r.sollicites, rem: r.remplacantId, trou: !!r.trouId }))));
  log.push('NOTIFS : ' + JSON.stringify(d.notifications.map((n) => [n.personId, n.date, n.avant, n.apres, n.luLe ? 'lu' : 'non lu'])));
  log.push('Snapshot 27/11 : ' + JSON.stringify(d.semaines['2026-11-23'].snapshot.filter((s) => s.date === '2026-11-27').map((s) => s.personId)));
  log.push('ERR ' + JSON.stringify(o.errs));
  o.ecrire('flux3.txt', log.join('\n'));
  console.log(log.join('\n').slice(0, 25000));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
