const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav, bascule } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  const ligneJour = (nom) => p.locator('.je-ligne').filter({ has: p.locator('.je-qui b', { hasText: nom }) }).first();
  // Heures avant
  await nav('heures');
  const heuresAvant = await texte('.chiffres .chiffre'); const lignesAvant = await texte('.decision.hc');
  // Journée d'aujourd'hui depuis le tableau
  await nav('tableau');
  await p.locator('.tb-jour .card-head button', { hasText: 'Voir la journée' }).click(); await p.waitForTimeout(400);
  // Retard (écart) pour Thomas
  await ligneJour('Thomas N.').locator('button', { hasText: 'Noter un retard' }).click(); await p.waitForTimeout(200);
  log('types d’écart', await p.evaluate(() => [...document.querySelectorAll('[id^=ecart-type] option')].map((o) => o.textContent)));
  await ligneJour('Thomas N.').locator('select').nth(1).selectOption('15');
  await ligneJour('Thomas N.').locator('button', { hasText: 'Noter' }).click(); await p.waitForTimeout(300);
  log('ECART toast', await toast(), '| pills Thomas', await ligneJour('Thomas N.').locator('.pill').allInnerTexts());
  // Départ anticipé pour Jules
  await ligneJour('Jules P.').locator('button', { hasText: 'Noter un retard' }).click(); await p.waitForTimeout(200);
  await ligneJour('Jules P.').locator('select').first().selectOption('depart');
  await ligneJour('Jules P.').locator('button', { hasText: 'Noter' }).click(); await p.waitForTimeout(300);
  log('DEPART pills Jules', await ligneJour('Jules P.').locator('.pill').allInnerTexts());
  // Pause : modifier, invalide, retirer, ajouter
  const pde = ligneJour('Sarah L.').locator('input[id^=pause-de]');
  log('pause Sarah', await pde.inputValue().catch(() => 'aucune'));
  await pde.fill('13:00'); await pde.blur(); await p.waitForTimeout(300);
  let d = await data(); log('pause Sarah après', d.shifts.filter((s) => s.personId === 'p_sarah' && s.date === '2026-11-20').map((s) => s.pauseStart + '-' + s.pauseEnd));
  const pa = ligneJour('Sarah L.').locator('input[id^=pause-a]');
  await pa.fill('20:00'); await pa.blur(); await p.waitForTimeout(300);
  log('pause hors poste toast', await toast());
  await ligneJour('Sarah L.').locator('button', { hasText: 'Retirer' }).click(); await p.waitForTimeout(200);
  log('après Retirer : bouton', await ligneJour('Sarah L.').locator('.je-pause').innerText());
  await ligneJour('Sarah L.').locator('button', { hasText: 'Ajouter une pause' }).click(); await p.waitForTimeout(200);
  d = await data(); log('après Ajouter', d.shifts.filter((s) => s.personId === 'p_sarah' && s.date === '2026-11-20').map((s) => s.pauseStart + '-' + s.pauseEnd));
  await shot('11-journee');
  await p.locator('[role=dialog] button', { hasText: 'Lendemain' }).click(); await p.waitForTimeout(300);
  log('LENDEMAIN', ((await dlg(p)) || '').slice(0, 120));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // Tableau : retards et retouches
  log('TABLEAU retards affichés', await texte('.tbj-retard'), '| bandeau', await texte('#tb-nonpublie'));
  // Avis de retard par le bouton du haut pour Nicolas
  await p.locator('#top-signaler').click(); await p.waitForTimeout(400);
  await p.locator('#sg-qui').selectOption('p_camille').catch((e) => log('sg-qui', e.message.slice(0, 80)));
  await p.locator('#sg-retard').check().catch(() => {});
  await p.locator('#sg-durees button').first().click().catch(() => {});
  await p.waitForTimeout(200);
  log('SIGNALER dlg', ((await dlg(p)) || '').slice(0, 300));
  await p.locator('#sg-confirmer').click().catch((e) => log('confirmer', e.message.slice(0, 60))); await p.waitForTimeout(400);
  log('SIGNALER toast', await toast());
  log('TABLEAU retards après avis', await texte('.tbj-retard'));
  await p.locator('.tb-jour .card-head button', { hasText: 'Voir la journée' }).click(); await p.waitForTimeout(400);
  log('JOUR ligne Nicolas', await ligneJour('Nicolas L.').innerText().then((x) => x.replace(/\s+/g, ' ')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // Heures après retouche de pause (brouillon, non publié)
  await nav('heures');
  const heuresApres = await texte('.chiffres .chiffre'); const lignesApres = await texte('.decision.hc');
  log('HEURES avant', heuresAvant, '\n  après', heuresApres);
  log('  Sarah avant', lignesAvant.find((x) => /Sarah/.test(x))?.replace(/\s+/g, ' ').slice(0, 120), '\n  Sarah après', lignesApres.find((x) => /Sarah/.test(x))?.replace(/\s+/g, ' ').slice(0, 120));
  // Retouche de mon propre poste de demain (samedi 21) : tableau vs mon planning
  await nav('construire'); await allerSemaine(p, '2026-11-16');
  const cell = p.locator('.plan-grid [role=row]').filter({ has: p.locator('.pg-p .nm', { hasText: /^Caroline T\.$/ }) }).locator('.pg-c').nth(5);
  await cell.locator('.tile').first().click(); await p.waitForTimeout(300);
  await p.locator('[role=dialog] .dp-horaires input[type=time]').nth(0).fill('10:00'); await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(300);
  log('CONSTRUIRE pill', await texte('.plan-bar .pill'));
  await nav('tableau');
  log('TABLEAU agenda', (await texte('.tb-agenda h2'))[0], '| bandeau', await texte('#tb-nonpublie'));
  await nav('moi'); await p.waitForTimeout(400);
  const mp = await p.evaluate(() => document.querySelector('.content, main')?.innerText.replace(/\s+/g, ' '));
  log('MON PLANNING prochain poste', (mp.match(/PROCHAIN POSTE.{0,80}/) || [''])[0]);
  await shot('11-monplanning-caroline');
  log('errs', errs);
  await b.close();
})();
