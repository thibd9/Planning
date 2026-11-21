const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  const semaine = async (l) => (await data()).shifts.filter((s) => s.date >= l && s.date <= addD(l, 6));
  const addD = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const qui = async (pid, date) => (await data()).shifts.filter((s) => s.personId === pid && s.date === date).map((s) => `${s.start}-${s.end}`);
  await nav('construire');
  await allerSemaine(p, '2026-12-07');
  // Recopier sur semaine vide
  await p.locator('.plan-bar button', { hasText: 'Recopier' }).click(); await p.waitForTimeout(500);
  log('RECOPIER toast', await toast());
  let s = await semaine('2026-12-07');
  log('RECOPIER postes 7/12', s.length, 'source 30/11', (await semaine('2026-11-30')).length, 'origines', [...new Set(s.map((x) => x.origine))]);
  log('Nicolas semaine 30/11 (congé demandé)', (await semaine('2026-11-30')).filter((x) => x.personId === 'p_camille').length);
  await shot('04-recopie-7dec', { fullPage: true });
  log('CONTROLES pill', await texte('[data-tour="controles"] .card-head .pill'));
  // Glisser-déposer : Nicolas lundi -> Thomas lundi
  const lun = (await data()).shifts.filter((x) => x.date === '2026-12-07').map((x) => x.personId); log('lundi 7 occupés', lun.join(','));
  log('avant DnD Nicolas lun', await qui('p_camille', '2026-12-07'), 'Jules lun', await qui('p_jules', '2026-12-07'));
  const rowOf = async (nom) => p.evaluate((nom) => { const rows = [...document.querySelectorAll('.plan-grid [role=row]')]; return rows.findIndex((r) => r.querySelector('.pg-p .nm')?.textContent === nom); }, nom);
  const cell = (nom, col) => p.locator('.plan-grid [role=row]').filter({ has: p.locator('.pg-p .nm', { hasText: new RegExp('^' + nom + '$') }) }).locator('.pg-c').nth(col);
  const tileN = cell('Nicolas L.', 0).locator('.tile').first();
  await tileN.dragTo(cell('Jules P.', 0)); await p.waitForTimeout(500);
  log('DnD toast', await toast());
  log('après DnD Nicolas lun', await qui('p_camille', '2026-12-07'), 'Jules lun', await qui('p_jules', '2026-12-07'));
  await shot('04-dnd-double', { fullPage: true });
  log('CONTROLES Jules', (await texte('[data-tour="controles"] .issue')).filter((x) => /Jules/.test(x)), await texte('[data-tour="controles"] .card-head .pill'));
  // DnD vers dimanche (fermé)
  const tileT = cell('Thomas N.', 1).locator('.tile').first();
  log('Thomas mar avant', await qui('p_thomas', '2026-12-08'));
  await tileT.dragTo(cell('Thomas N.', 6)); await p.waitForTimeout(500);
  log('DnD dimanche : Thomas mar', await qui('p_thomas', '2026-12-08'), 'dim', await qui('p_thomas', '2026-12-13'));
  // Modifier un des deux postes de Thomas lundi : la fenêtre permet-elle un chevauchement ?
  const tilesTL = await cell('Jules P.', 0).locator('.tile').count();
  log('tuiles Jules lundi', tilesTL); await cell('Jules P.', 0).locator('.tile').nth(1).click(); await p.waitForTimeout(300); log('DLG 2e poste Jules', (await dlg(p)).slice(0,120), await texte('[role=dialog] .notice')); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // Remettre à zéro puis Annuler (toast)
  await p.locator('#plan-zero').click(); await p.waitForTimeout(400);
  log('ZERO toast', await toast(), 'postes', (await semaine('2026-12-07')).length);
  await p.locator('.toast button').click().catch((e) => log('pas de bouton dans le toast'));
  await p.waitForTimeout(400);
  log('ZERO Annuler (toast) -> postes', (await semaine('2026-12-07')).length);
  await p.locator('#plan-zero').click(); await p.waitForTimeout(400);
  await p.locator('[aria-label="Annuler la dernière manipulation"]').click(); await p.waitForTimeout(400);
  log('ZERO Annuler (bouton) -> postes', (await semaine('2026-12-07')).length);
  // Recopier quand la semaine précédente est vide : semaine du 21 (source 14 vide)
  await allerSemaine(p, '2026-12-21');
  await p.getByRole('button', { name: 'Ajouter un poste à Igor L. lundi' }).click(); await p.waitForTimeout(400);
  await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(400);
  log('21/12 avant recopie', (await semaine('2026-12-21')).length, 'source 14/12', (await semaine('2026-12-14')).length);
  await p.locator('.plan-bar button', { hasText: 'Recopier' }).click(); await p.waitForTimeout(500);
  log('RECOPIE source vide toast', await toast(), '-> 21/12 postes', (await semaine('2026-12-21')).length);
  await shot('04-recopie-source-vide', { fullPage: true });
  // Recopier en chaîne 14 puis 21 : le 25 décembre (férié, fermé)
  log('nav14', await allerSemaine(p, '2026-12-14'));
  await p.locator('.plan-bar button', { hasText: 'Recopier' }).click(); await p.waitForTimeout(400);
  await allerSemaine(p, '2026-12-21');
  await p.locator('.plan-bar button', { hasText: 'Recopier' }).click(); await p.waitForTimeout(500);
  const noel = (await data()).shifts.filter((x) => x.date === '2026-12-25');
  log('POSTES le 25/12 (férié)', noel.length, noel.map((x) => x.personId).join(','));
  log('en-tête 25', await p.evaluate(() => [...document.querySelectorAll('.pg-h')].map((h) => h.innerText.replace(/\n/g, ' ')).join(' | ')));
  log('CONTROLES 21/12', await texte('[data-tour="controles"] .card-head .pill'), (await texte('[data-tour="controles"] .issue')).filter((x) => /25|vendredi|férié|fermé/i.test(x)).slice(0, 5));
  await shot('04-noel', { fullPage: true });
  log('errs', errs);
  await b.close();
})();
