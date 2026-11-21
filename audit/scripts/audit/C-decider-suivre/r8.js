// Demandes : congé de Nicolas (accepter / refuser), deux congés sur les mêmes dates, demande d'horaire de Jules (4 décisions).
const { ouvrir, injecter, dialogue } = require('./lib');
const F = require('./fixtures');
(async () => {
  let o = await ouvrir({ role: 0 }); let p = o.p;
  await injecter(p, F.CONGE_SARAH);
  await o.nav('resoudre'); await p.locator('#onglet-demandes').click(); await p.waitForTimeout(400);
  console.log('ONGLET DEMANDES', (await p.locator('#panneau-decisions').innerText()).slice(0, 3500));
  await o.shot('r8-demandes', { fullPage: true });
  let d0 = await o.data();
  const conge = d0.absences.find((a) => a.personId === 'p_camille' && a.statut === 'demandee');
  const avantPostes = d0.shifts.filter((s) => s.personId === 'p_camille' && s.date >= conge.from && s.date <= conge.to).length;
  await p.locator(`[data-decider="${conge.id}"]`).click(); await p.waitForTimeout(500);
  console.log('DIALOGUE CONGE', (await dialogue(p)).slice(0, 2500));
  await p.locator('label[for=dc-accepter]').click(); await p.waitForTimeout(200);
  console.log('message prévu', await p.locator('#dc-message').innerText());
  await o.shot('r8-dialogue-conge');
  await p.locator('#dc-confirmer').click(); await p.waitForTimeout(700);
  console.log('toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  let d = await o.data();
  console.log('postes Nicolas avant', avantPostes, 'après brouillon', d.shifts.filter((s) => s.personId === 'p_camille' && s.date >= conge.from && s.date <= conge.to).length, 'après publié', d.semaines['2026-11-30'].snapshot.filter((s) => s.personId === 'p_camille' && s.date >= conge.from && s.date <= conge.to).length);
  console.log('trous créés', JSON.stringify(d.trous.filter((t) => t.absenceId === conge.id).map((t) => t.shift.date)));
  console.log('messages Nicolas', JSON.stringify(d.messages.filter((m) => m.a === 'p_camille').map((m) => m.texte)));
  console.log('notifs Nicolas', JSON.stringify(d.notifications.filter((n) => n.personId === 'p_camille')));
  console.log('annonce', JSON.stringify(d.annonces[0]));
  console.log('journal', JSON.stringify(d.journal[0]));
  console.log('ONGLETS', await p.evaluate(() => [...document.querySelectorAll('.ong-onglet')].map((x) => x.innerText.replace(/\n/g, ' ')).join(' / ')));
  console.log('Carte Sarah après', (await p.locator('#panneau-decisions').innerText()).slice(0, 1500));
  // Ce que voit Nicolas
  await o.profil('Préparateur');
  console.log('CLOCHE badge', await p.evaluate(() => [...document.querySelectorAll('.topbar button, header button')].map((b) => b.getAttribute('aria-label') || b.innerText).filter((t) => /notification|message/i.test(t)).join(' | ')));
  await o.nav('demandes'); await p.waitForTimeout(400);
  console.log('NICOLAS demandes', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(0, 1500));
  await o.shot('r8-nicolas-demandes');
  console.log('ERR', o.errs); await o.b.close();

  // Refus motivé
  o = await ouvrir({ role: 0 }); p = o.p;
  await o.nav('resoudre'); await p.locator('#onglet-demandes').click(); await p.waitForTimeout(300);
  d0 = await o.data(); const c2 = d0.absences.find((a) => a.personId === 'p_camille' && a.statut === 'demandee');
  await p.locator(`[data-decider="${c2.id}"]`).click(); await p.waitForTimeout(400);
  await p.locator('label[for=dc-refuser]').click(); await p.selectOption('#dc-raison', { index: 1 }); await p.fill('#dc-mot', 'La semaine suivante serait possible.');
  console.log('\nREFUS message prévu', await p.locator('#dc-message').innerText(), '| bouton', await p.locator('#dc-confirmer').innerText());
  await o.shot('r8-refus-conge');
  await p.locator('#dc-confirmer').click(); await p.waitForTimeout(600);
  console.log('toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  d = await o.data();
  console.log('statut', d.absences.find((a) => a.id === c2.id).statut, '| messages Nicolas', JSON.stringify(d.messages.filter((m) => m.a === 'p_camille').map((m) => m.texte)), '| journal', d.journal[0].titre, d.journal[0].detail);
  // Refus sans raison
  await o.b.close();

  // Demande d'horaire de Jules : les quatre décisions
  for (const cle of ['preference', 'prioritaire', 'reconnue', 'refuser']) {
    o = await ouvrir({ role: 0 }); p = o.p;
    await o.nav('resoudre'); await p.locator('#onglet-demandes').click(); await p.waitForTimeout(300);
    d0 = await o.data(); const b = d0.besoins.find((x) => x.decision === 'en_attente');
    await p.locator(`[data-decider="${b.id}"]`).click(); await p.waitForTimeout(400);
    if (cle === 'preference') { console.log('\nDIALOGUE BESOIN', (await dialogue(p)).slice(0, 2200)); await o.shot('r8-dialogue-besoin'); }
    console.log(`\n== Jules : ${cle} désactivée ?`, await p.locator(`#dc-${cle}`).isDisabled());
    await p.locator(`label[for=dc-${cle}]`).click(); await p.waitForTimeout(200);
    console.log('  message prévu', await p.locator('#dc-message').innerText());
    await p.locator('#dc-confirmer').click(); await p.waitForTimeout(600);
    d = await o.data(); const b2 = d.besoins.find((x) => x.id === b.id);
    console.log('  besoin', JSON.stringify([b2.decision, b2.statut, b2.decidedAt]), '| messages Jules', JSON.stringify(d.messages.filter((m) => m.a === 'p_jules').map((m) => m.texte)), '| annonce', d.annonces[0].titre, JSON.stringify(d.annonces[0].effets), '| journal', d.journal[0].titre);
    if (cle === 'refuser') { await o.nav('equite'); await p.locator('.jr-filtre', { hasText: 'Demandes refusées' }).click(); await p.waitForTimeout(300); console.log('  EQUITE refus', (await p.locator('.eq-liste, .card').nth(0).innerText()).replace(/\n+/g, ' | ').slice(0, 600)); }
    await o.b.close();
  }
})();
