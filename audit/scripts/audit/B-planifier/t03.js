const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  const sh = async (pid, date) => (await data()).shifts.filter((s) => s.personId === pid && s.date === date).map((s) => `${s.start}-${s.end} p${s.pauseStart}-${s.pauseEnd} ${s.activite} courtes=${JSON.stringify(s.pauses ?? [])} ${s.origine}`);
  await nav('construire');
  log('SEMAINE par défaut', await texte('.week-nav .label'));
  log('aller', await allerSemaine(p, '2026-12-07'));
  await shot('03-semaine-vide', { fullPage: true });
  log('BARRE', await texte('.plan-bar'));
  // 1. Poser un poste à Nicolas lundi
  await p.getByRole('button', { name: 'Ajouter un poste à Nicolas L. lundi' }).click(); await p.waitForTimeout(500);
  log('DLG ouvert', (await dlg(p)).slice(0, 1500));
  const v = async () => p.evaluate(() => [...document.querySelectorAll('[role=dialog] input[type=time]')].map((i) => i.value).join(' '));
  log('valeurs initiales', await v());
  await shot('03-dlg-nouveau');
  await p.locator('[role=dialog] .ptc', { hasText: 'Fermeture' }).click(); await p.waitForTimeout(200);
  log('après Fermeture', await v(), await texte('#dp-total'));
  await p.locator('[role=dialog] label[for="tache-back"]').click();
  // pause courte
  const acc = p.locator('[role=dialog] #pauses-courtes, [role=dialog] details').first();
  log('accordeon open?', await p.evaluate(() => [...document.querySelectorAll('[role=dialog] details')].map((d) => d.open)));
  await p.locator('#pc-ajouter').click(); await p.waitForTimeout(200);
  log('pause courte', await v());
  await shot('03-dlg-fermeture');
  await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(400);
  log('TOAST', await toast());
  log('DATA nicolas 7/12', await sh('p_camille', '2026-12-07'));
  // 2. modifier fin à 18:00
  await p.locator('.pg-c .tile', { hasText: '11:30' }).first().click(); await p.waitForTimeout(400);
  log('DLG modifier titre', (await dlg(p)).slice(0, 200));
  const inputs = p.locator('[role=dialog] .dp-horaires input[type=time]');
  await inputs.nth(1).fill('18:00'); await p.waitForTimeout(200);
  log('total', await texte('#dp-total'));
  await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(400);
  log('TOAST', await toast(), 'DATA', await sh('p_camille', '2026-12-07'));
  // 3. fin avant début
  await p.locator('.pg-c .tile', { hasText: '11:30' }).first().click(); await p.waitForTimeout(400);
  await inputs.nth(1).fill('10:00'); await p.waitForTimeout(200);
  log('FIN<DEBUT enregistrer disabled?', await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).isDisabled(), '| avert', await texte('[role=dialog] .notice.warn'));
  await shot('03-dlg-fin-avant-debut');
  await inputs.nth(1).fill('11:30'); await p.waitForTimeout(200);
  log('FIN=DEBUT disabled?', await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).isDisabled());
  // 4. pause hors du poste
  await inputs.nth(1).fill('19:30'); await p.waitForTimeout(100);
  await inputs.nth(2).fill('20:00'); await inputs.nth(3).fill('20:30'); await p.waitForTimeout(300);
  log('PAUSE HORS : total', await texte('#dp-total'), '| notices', await texte('[role=dialog] .notice'), '| erreurs', await texte('[role=dialog] .erreur'));
  await shot('03-dlg-pause-hors');
  // pause fin < pause début
  await inputs.nth(2).fill('15:00'); await inputs.nth(3).fill('14:00'); await p.waitForTimeout(300);
  log('PAUSE INVERSEE : total', await texte('#dp-total'), '| notices', await texte('[role=dialog] .notice'));
  await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(400);
  log('après enregistrement pause inversée', await sh('p_camille', '2026-12-07'));
  // 5. poste de 14 h
  await p.locator('.pg-c .tile', { hasText: '11:30' }).first().click(); await p.waitForTimeout(400);
  await inputs.nth(0).fill('06:00'); await inputs.nth(1).fill('20:00'); await p.waitForTimeout(400);
  log('14H : total', await texte('#dp-total'), '| effets', await texte('[role=dialog] .notice'));
  await shot('03-dlg-14h');
  await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(400);
  log('DATA 14h', await sh('p_camille', '2026-12-07'));
  log('CONTROLES', (await texte('[data-tour="controles"] .issue')).filter((x) => /Nicolas/.test(x)).join('\n'));
  await shot('03-controles-14h', { fullPage: true });
  // 6. supprimer
  await p.locator('.pg-c .tile', { hasText: '06:00' }).first().click(); await p.waitForTimeout(400);
  await p.locator('[role=dialog] button', { hasText: 'Supprimer' }).click(); await p.waitForTimeout(400);
  log('SUPPR toast', await toast(), 'DATA', await sh('p_camille', '2026-12-07'));
  // 7. Annuler / rétablir (boutons)
  await p.locator('[aria-label="Annuler la dernière manipulation"]').click(); await p.waitForTimeout(300);
  log('UNDO bouton', await sh('p_camille', '2026-12-07'));
  await p.locator('[aria-label="Rétablir"]').click(); await p.waitForTimeout(300);
  log('REDO bouton', await sh('p_camille', '2026-12-07'));
  await p.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
  log('CTRL+Z', await sh('p_camille', '2026-12-07'));
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(300);
  log('CTRL+MAJ+Z', await sh('p_camille', '2026-12-07'));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
  log('CTRL+Z (2)', await sh('p_camille', '2026-12-07'));
  // 8. Repos : Thomas mardi
  await p.getByRole('button', { name: 'Ajouter un poste à Thomas N. mardi' }).click(); await p.waitForTimeout(400);
  await p.locator('#ptc-repos').click(); await p.waitForTimeout(200);
  log('REPOS dlg', await texte('#dp-repos'), await texte('#dp-total'));
  await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(400);
  log('REPOS toast', await toast(), 'repos data', JSON.stringify((await data()).repos));
  log('REPOS cellule', await texte('.tile.repos-pose'));
  await shot('03-repos', { fullPage: true });
  // Repos sur un poste existant
  log('errs', errs);
  await b.close();
})();
