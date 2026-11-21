// Heures : Solder, retirer, Faire rattraper (fenêtre), Régulariser automatiquement.
const { ouvrir, dialogue } = require('./lib');
const toast = (p) => p.evaluate(() => document.querySelector('[class*=toast]')?.innerText);
const ligne = (p, nom) => p.locator('.hc', { hasText: nom }).innerText().then((t) => t.replace(/\n+/g, ' | ')).catch(() => '-');
const travail = (s) => s.end - s.start - (s.pauseStart != null && s.pauseEnd != null ? Math.max(0, Math.min(s.end, s.pauseEnd) - Math.max(s.start, s.pauseStart)) : 0);
(async () => {
  let o = await ouvrir({ role: 0 }); let p = o.p;
  await o.nav('heures');
  // Solder Thomas
  await p.locator('.hc', { hasText: 'Thomas' }).getByRole('button', { name: 'Solder' }).click(); await p.waitForTimeout(500);
  console.log('SOLDER toast', await toast(p), '| ligne', await ligne(p, 'Thomas'));
  let d = await o.data(); console.log('  regul', JSON.stringify(d.regularisations), '| journal', d.journal[0].titre);
  console.log('  historique', (await p.locator('[aria-label="Régularisations enregistrées"]').innerText()).replace(/\n+/g, ' | '));
  await o.shot('r16-solder', { fullPage: true });
  await p.locator('[aria-label^="Retirer la régularisation"]').first().click(); await p.waitForTimeout(400);
  d = await o.data(); console.log('RETIRER (sans confirmation) regul', (d.regularisations ?? []).length, '| ligne', await ligne(p, 'Thomas'), '| journal', d.journal[0].titre);
  // Faire rattraper Yanis
  await p.locator('.hc', { hasText: 'Yanis' }).getByRole('button', { name: 'Faire rattraper' }).click(); await p.waitForTimeout(600);
  console.log('RATTRAPER', (await dialogue(p)).replace(/\n+/g, ' | ').slice(0, 2500));
  await o.shot('r16-rattraper');
  const crit = await p.locator('#rat-controle').innerText().catch(() => '-'); console.log('  contrôle', crit.replace(/\n/g, ' '));
  await p.locator('#rat-valider').click(); await p.waitForTimeout(600);
  console.log('  toast', await toast(p), '| ligne', await ligne(p, 'Yanis'));
  d = await o.data(); const r = d.regularisations.slice(-1)[0]; console.log('  regul', JSON.stringify(r));
  if (r.date) {
    const m = Object.keys(d.semaines).find((k) => k <= r.date && r.date < new Date(new Date(k).getTime() + 7 * 864e5).toISOString().slice(0, 10));
    console.log('  postes Yanis le', r.date, JSON.stringify(d.shifts.filter((s) => s.personId === 'p_yanis' && s.date === r.date).map((s) => [s.start, s.end])), 'publié', JSON.stringify((d.semaines[m]?.snapshot ?? []).filter((s) => s.personId === 'p_yanis' && s.date === r.date).map((s) => [s.start, s.end])), '| notif', JSON.stringify(d.notifications.filter((n) => n.personId === 'p_yanis')), '| message', JSON.stringify(d.messages.filter((m) => m.a === 'p_yanis').map((m) => m.texte)));
  }
  console.log('  journal', d.journal[0].titre);
  await o.b.close();
  // Régulariser automatiquement
  o = await ouvrir({ role: 0 }); p = o.p;
  await o.nav('heures');
  const d0 = await o.data();
  const sem = '2026-12-07'; const fin = '2026-12-13';
  const parP = (x) => Object.fromEntries(x.personnes.filter((q) => q.salarie && !q.externe).map((q) => [q.prenom, x.shifts.filter((s) => s.personId === q.id && s.date >= sem && s.date <= fin).reduce((t, s) => t + travail(s), 0) / 60]));
  console.log('AUTO avant : brouillon sem. 7/12', JSON.stringify(parP(d0)));
  await p.locator('[data-focus="auto-heures"], button', { hasText: 'Régulariser automatiquement' }).first().click(); await p.waitForTimeout(2500);
  console.log('  toast', await toast(p));
  d = await o.data();
  console.log('  regul', JSON.stringify(d.regularisations.map((r) => [r.personId, r.minutes / 60, r.type, r.semaine])));
  console.log('  après : brouillon sem. 7/12', JSON.stringify(parP(d)), '| semaine publiée ?', d.semaines[sem]?.statut);
  const cible = Object.fromEntries(d.personnes.filter((q) => q.salarie && !q.externe).map((q) => [q.prenom, q.heuresHebdo + d.regularisations.filter((r) => r.personId === q.id && r.semaine === sem).reduce((t, r) => t + r.minutes, 0) / 60]));
  console.log('  cibles', JSON.stringify(cible));
  console.log('  journal', d.journal[0].titre, '|', d.journal[0].detail);
  console.log('  ECRAN', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(0, 1500));
  await o.shot('r16-auto', { fullPage: true });
  // Construire : la semaine du 7/12
  console.log('ERR', o.errs); await o.b.close();
})();
