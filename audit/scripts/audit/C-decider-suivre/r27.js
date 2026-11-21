// Cas limites : double clic, heures en plus (Payer, Faire récupérer), régularisation automatique sur une semaine déjà commencée.
const { ouvrir, injecter, dialogue } = require('./lib');
const toast = (p) => p.evaluate(() => document.querySelector('[class*=toast]')?.innerText);
(async () => {
  let o = await ouvrir({ role: 0 }); let p = o.p;
  await o.nav('resoudre');
  await p.locator('.options .option.reco button', { hasText: 'Choisir' }).dblclick(); await p.waitForTimeout(600);
  let d = await o.data();
  console.log('DOUBLE CLIC Choisir : postes Pierre 20/11', d.shifts.filter((s) => s.personId === 'p_antoine' && s.date === '2026-11-20').length, '| entrées journal réparation', d.journal.filter((j) => j.type === 'reparation').length);
  await o.b.close();
  o = await ouvrir({ role: 0 }); p = o.p;
  await p.locator('#top-signaler').click(); await p.waitForTimeout(300);
  await p.selectOption('#sg-qui', 'p_camille'); await p.locator('label[for=sg-absence]').click(); await p.fill('#sg-du', '2026-11-26'); await p.fill('#sg-au', '2026-11-26');
  await p.locator('#sg-confirmer').dblclick(); await p.waitForTimeout(600);
  d = await o.data(); console.log('DOUBLE CLIC Enregistrer l’absence : absences Nicolas 26/11', d.absences.filter((a) => a.personId === 'p_camille' && a.from === '2026-11-26').length);
  await o.nav('resoudre'); await p.evaluate(() => document.querySelectorAll('details.volet').forEach((x) => (x.open = true)));
  await p.locator('.card:has(h3:has-text("Nicolas L.")) section.appel .appel-tete button.btn.primary').dblclick(); await p.waitForTimeout(600);
  d = await o.data(); console.log('DOUBLE CLIC Prévenir : appels', d.remplacements.filter((r) => r.trouId && r.date === '2026-11-26').length, '| messages', d.messages.length);
  await o.b.close();
  // Heures en plus : un poste ajouté à Léa le sam. 14/11 (semaine publiée passée), brouillon et version publiée.
  o = await ouvrir({ role: 0 }); p = o.p;
  await injecter(p, `const s = { id: 's_audit_lea', personId: 'p_lea', date: '2026-11-14', start: 540, end: 840, origine: 'manuel' }; d.shifts.push(s); d.semaines['2026-11-09'].snapshot.push({ ...s }); const t = { id: 's_audit_lea2', personId: 'p_lea', date: '2026-11-07', start: 540, end: 840, origine: 'manuel' }; d.shifts.push(t); d.semaines['2026-11-02'].snapshot.push({ ...t });`);
  await o.nav('heures');
  console.log('LÉA', (await p.locator('.hc', { hasText: 'Léa' }).innerText()).replace(/\n+/g, ' | '));
  console.log('ALERTE', await p.locator('.hc-alerte').innerText());
  await p.locator('.hc', { hasText: 'Léa' }).getByRole('button', { name: 'Faire récupérer' }).click(); await p.waitForTimeout(600);
  console.log('RÉCUPÉRER', (await dialogue(p)).replace(/\n+/g, ' | ').slice(0, 1600));
  await o.shot('r27-recuperer');
  await p.locator('#rat-valider').click(); await p.waitForTimeout(500);
  console.log('  toast', await toast(p)); d = await o.data(); const r = d.regularisations.slice(-1)[0]; console.log('  regul', JSON.stringify(r), '| ligne', (await p.locator('.hc', { hasText: 'Léa' }).innerText()).replace(/\n+/g, ' | '));
  if (r?.date) console.log('  Léa le', r.date, JSON.stringify(d.shifts.filter((s) => s.personId === 'p_lea' && s.date === r.date).map((s) => [s.start, s.end, s.pauseStart])));
  await p.getByRole('button', { name: 'Payer' }).first().click().catch(() => console.log('  pas de bouton Payer')); await p.waitForTimeout(400);
  d = await o.data(); console.log('  après Payer', JSON.stringify(d.regularisations.map((x) => [x.personId, x.type, x.minutes])), '| ligne', (await p.locator('.hc', { hasText: 'Léa' }).innerText()).replace(/\n+/g, ' | '));
  await o.b.close();
  // Régulariser automatiquement alors que la semaine du 7/12 a déjà un poste posé à la main
  o = await ouvrir({ role: 0 }); p = o.p;
  await injecter(p, `d.shifts.push({ id: 's_audit_main', personId: 'p_sarah', date: '2026-12-08', start: 600, end: 720, origine: 'manuel', explication: 'Posé à la main' });`);
  await o.nav('heures'); await p.getByRole('button', { name: /Régulariser automatiquement/ }).click(); await p.waitForTimeout(2500);
  d = await o.data(); console.log('AUTO : poste posé à la main conservé ?', d.shifts.some((s) => s.id === 's_audit_main'), '| Sarah 8/12', JSON.stringify(d.shifts.filter((s) => s.personId === 'p_sarah' && s.date === '2026-12-08').map((s) => [s.start, s.end, s.origine])));
  console.log('ERR', o.errs); await o.b.close();
})();
