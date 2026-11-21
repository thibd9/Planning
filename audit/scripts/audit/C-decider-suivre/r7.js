// Remplacements : la demande « acceptée » de l'exemple (Refuser), puis trois demandes à trancher (Décider : équipe, confier, titulaire, refuser).
const { ouvrir, injecter, dialogue } = require('./lib');
const F = require('./fixtures');
const resume = async (o, rid, pid, date, monday) => {
  const d = await o.data();
  const r = d.remplacements.find((x) => x.id === rid) ?? d.remplacements.find((x) => x.demandeur === pid && x.date === date && !x.trouId);
  console.log('   rempl', JSON.stringify([r?.statut, r?.accord, r?.remplacantId, r?.sollicites]));
  console.log('   brouillon', JSON.stringify(d.shifts.filter((s) => s.date === date && s.start === r.start && s.end === r.end).map((s) => s.personId)), 'publié', JSON.stringify((d.semaines[monday]?.snapshot ?? []).filter((s) => s.date === date && s.start === r.start && s.end === r.end).map((s) => s.personId)));
  console.log('   notifs', JSON.stringify(d.notifications.filter((n) => n.date === date && !n.luLe).map((n) => [n.personId, n.avant, n.apres])));
  console.log('   messages', JSON.stringify(d.messages.slice(2).map((m) => [m.de, m.a, m.texte.slice(0, 160)])));
  console.log('   journal', d.journal[0].titre, '| annonce', JSON.stringify([(d.annonces ?? [])[0]?.titre, (d.annonces ?? [])[0]?.pour]));
};
(async () => {
  if (!process.env.SAUTE) {
  let o = await ouvrir({ role: 0 }); let p = o.p;
  await o.nav('resoudre'); await p.locator('#onglet-remplacements').click(); await p.waitForTimeout(300);
  console.log('ONGLET', (await p.locator('#panneau-decisions').innerText()).slice(0, 900));
  await o.shot('r7-onglet-exemple');
  await p.locator('.demande-r').first().getByRole('button', { name: 'Refuser' }).click(); await p.waitForTimeout(400);
  console.log('REFUS DIALOGUE', (await dialogue(p)).slice(0, 700));
  await p.selectOption('#refus-raison', { index: 1 }); await p.fill('#refus-mot', 'Désolée, samedi impossible.');
  await o.shot('r7-refus-dialogue');
  await p.locator('[role=dialog] button.btn.danger').click(); await p.waitForTimeout(600);
  console.log(' toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  await resume(o, 'x', 'p_karim', '2026-11-21', '2026-11-16');
  await o.b.close(); }
  let o, p;
  // 1. Les demandes à trancher
  for (const [rid, choix, label] of (process.env.SAUTE ? [] : [['r_audit_prevu', 'equipe', 'Nicolas 30/11 : accepter et prévenir l’équipe'], ['r_audit_prevu', 'confier', 'Nicolas 30/11 : confier']]).concat([['r_audit_medical', 'titulaire', 'Sarah 24/11 médical : titulaire'], ['r_audit_igor', 'liste', 'Igor 25/11 : options'], ['r_audit_prevu', 'refuser', 'Nicolas 30/11 : refuser']])) {
    o = await ouvrir({ role: 0 }); p = o.p;
    await injecter(p, F.DEMANDES_REMPLACEMENT);
    await o.nav('resoudre'); await p.locator('#onglet-remplacements').click(); await p.waitForTimeout(300);
    if (rid === 'r_audit_prevu' && choix === 'equipe') { console.log('ONGLET 4 demandes', (await p.locator('#panneau-decisions').innerText()).slice(0, 2500)); await o.shot('r7-onglet-4', { fullPage: true }); }
    await p.locator(`[data-decider="${rid}"]`).click(); await p.waitForTimeout(500);
    console.log(`\n== ${label}`);
    const dl = await dialogue(p); console.log('  DIALOGUE', dl.slice(0, choix === 'liste' || choix === 'titulaire' ? 2500 : 1400));
    if (choix === 'liste') { await o.shot('r7-decider-igor'); await o.b.close(); continue; }
    const radio = p.locator(`#dr-${choix}`);
    console.log('  option désactivée ?', await radio.isDisabled());
    await p.locator(`label[for=dr-${choix}]`).click(); await p.waitForTimeout(300);
    if (choix === 'refuser') { await p.selectOption('#dr-raison', { index: 2 }); await p.fill('#dr-mot', 'Un autre jour serait possible.'); }
    if (choix === 'confier') console.log('  remplaçants', await p.locator('#dr-remplacant').innerText());
    if (choix === 'titulaire') console.log('  titulaires', await p.locator('select#dr-titulaire').innerText(), '|', await p.locator('label.field .aide').first().innerText().catch(() => ''));
    console.log('  message', await p.locator('#dr-message').innerText().catch(() => '-'));
    console.log('  bouton', await p.locator('#dr-confirmer').innerText());
    await o.shot(`r7-decider-${choix}`);
    await p.locator('#dr-confirmer').click(); await p.waitForTimeout(700);
    console.log('  toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
    const r = rid === 'r_audit_prevu' ? ['p_camille', '2026-11-30', '2026-11-30'] : ['p_sarah', '2026-11-24', '2026-11-23'];
    await resume(o, rid, r[0], r[1], r[2]);
    if (choix === 'equipe') { console.log('  carte après', (await p.locator('.demande-r').first().innerText()).replace(/\n+/g, ' | ')); await o.shot('r7-apres-equipe'); }
    console.log('  ERR', o.errs);
    await o.b.close();
  }
})();
