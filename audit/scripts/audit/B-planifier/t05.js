const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  const addD = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const semaine = async (l) => (await data()).shifts.filter((s) => s.date >= l && s.date <= addD(l, 6));
  const attendre = async () => { const t0 = Date.now(); await p.waitForSelector('[role=dialog] .variant', { timeout: 120000 }); return Date.now() - t0; };
  const variantes = async () => texte('[role=dialog] .variant');
  const ctrl = async () => ({ pills: await texte('[data-tour="controles"] .card-head .pill'), bloq: (await texte('[data-tour="controles"] .issue.bloquant .issue-message')), diag: await texte('[data-tour="controles"] .issue.diag .issue-message') });
  await nav('construire');
  // A. semaine vide du 7 décembre
  await allerSemaine(p, '2026-12-07');
  let t0 = Date.now();
  await p.locator('.plan-bar [data-tour="proposer"]').click();
  let ms = await attendre();
  log('A. TEMPS proposer (semaine vide) ms', Date.now() - t0);
  log('A. titre', (await dlg(p)).slice(0, 160));
  for (const v of await variantes()) log('  VAR', v);
  log('A. blocages', await texte('[role=dialog] .issue.diag'));
  await shot('05-propositions-vide');
  // Recalculer
  t0 = Date.now();
  await p.locator('[role=dialog] button', { hasText: 'Recalculer' }).click();
  await p.waitForTimeout(50); await p.waitForSelector('[role=dialog] .variant', { timeout: 120000 });
  log('A. TEMPS recalculer ms', Date.now() - t0);
  for (const v of await variantes()) log('  VAR2', v.slice(0, 200));
  // Appliquer chacune et lire les contrôles
  for (let i = 0; i < 3; i++) {
    if (i) { await p.locator('.plan-bar [data-tour="proposer"]').click(); await p.waitForTimeout(400); await p.locator('[role=dialog] input[name=mode]').first().check(); t0 = Date.now(); await p.locator('[role=dialog] button', { hasText: 'Calculer les propositions' }).click(); await attendre(); log('TEMPS (semaine remplie, repartir vide) ms', Date.now() - t0); }
    await p.locator('[role=dialog] .variant').nth(i).click();
    const v = (await variantes())[i];
    await p.locator('[role=dialog] button', { hasText: 'Placer dans le brouillon' }).click(); await p.waitForTimeout(600);
    const s = await semaine('2026-12-07');
    const c = await ctrl();
    log(`A. APPLIQUÉE ${i}:`, v.replace(/\s+/g, ' ').slice(0, 260));
    log('   toast', await toast(), '| postes', s.length, '| contrôles', JSON.stringify(c));
    log('   repères', await texte('.ph-reperes li'), 'objectifs', (await texte('.pg-o .pg-o-mot b')).join(','));
    await shot(`05-appliquee-${i}`, { fullPage: true });
  }
  // B. semaine déjà remplie : conserver les postes posés
  await p.getByRole('button', { name: /Ajouter un poste à/ }).first().click().catch(() => {});
  await p.waitForTimeout(300);
  const titreAjout = await dlg(p); log('B. ajout manuel sur', titreAjout && titreAjout.slice(0, 80));
  if (titreAjout) { await p.locator('[role=dialog] input[type=time]').nth(0).fill('09:00'); await p.locator('[role=dialog] input[type=time]').nth(1).fill('12:00'); await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(300); }
  const manuel = (await semaine('2026-12-07')).filter((x) => x.start === 540 && x.end === 720);
  log('B. poste manuel', JSON.stringify(manuel.map((x) => [x.personId, x.date])));
  await p.locator('.plan-bar [data-tour="proposer"]').click(); await p.waitForTimeout(400);
  log('B. dlg', (await dlg(p)).slice(0, 400));
  await p.locator('[role=dialog] input[name=mode]').nth(1).check();
  t0 = Date.now(); await p.locator('[role=dialog] button', { hasText: 'Calculer les propositions' }).click(); await attendre(); log('B. TEMPS conserver ms', Date.now() - t0);
  for (const v of await variantes()) log('  VAR', v.replace(/\s+/g, ' ').slice(0, 200));
  await p.locator('[role=dialog] button', { hasText: 'Placer dans le brouillon' }).click(); await p.waitForTimeout(500);
  const apres = (await semaine('2026-12-07')).filter((x) => manuel.some((m) => m.personId === x.personId && m.date === x.date));
  log('B. après conserver : postes de la case du poste manuel', JSON.stringify(apres.map((x) => [x.personId, x.date, x.start, x.end, x.origine])));
  log('B. contrôles', JSON.stringify(await ctrl()));
  // C. Repos posé : semaine du 14
  await allerSemaine(p, '2026-12-14');
  await p.getByRole('button', { name: 'Ajouter un poste à Thomas N. mardi' }).click(); await p.waitForTimeout(300);
  await p.locator('#ptc-repos').click(); await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Ajouter un poste à Caroline T. mercredi' }).click(); await p.waitForTimeout(300);
  await p.locator('#ptc-repos').click(); await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(300);
  log('C. repos', JSON.stringify((await data()).repos));
  t0 = Date.now(); await p.locator('.plan-bar [data-tour="proposer"]').click(); await attendre(); log('C. TEMPS (semaine avec repos seuls) ms', Date.now() - t0);
  for (const v of await variantes()) log('  VAR', v.replace(/\s+/g, ' ').slice(0, 200));
  await p.locator('[role=dialog] button', { hasText: 'Placer dans le brouillon' }).click(); await p.waitForTimeout(500);
  const s14 = await semaine('2026-12-14');
  log('C. Thomas mardi 15', s14.filter((x) => x.personId === 'p_thomas' && x.date === '2026-12-15').length, '| Caroline mercredi 16', s14.filter((x) => x.personId === 'p_helene' && x.date === '2026-12-16').length, '| repos restants', JSON.stringify((await data()).repos));
  log('C. contrôles', JSON.stringify(await ctrl()));
  await shot('05-repos', { fullPage: true });
  log('errs', errs);
  await b.close();
})();
