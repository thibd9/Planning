const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav, bascule } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  const inv = async (date, ids, debut, fin) => {
    await p.locator('.top-creer').click(); await p.waitForTimeout(200);
    await p.locator('.menu button', { hasText: 'Un inventaire' }).click(); await p.waitForTimeout(400);
    log('  vue courante', await p.evaluate(() => document.querySelector('[data-tour^="nav-"][aria-current="page"]')?.getAttribute('data-tour')));
    await p.locator('#inventaire-date').fill(date); if (debut) { await p.locator('#inventaire-debut').fill(debut); await p.locator('#inventaire-fin').fill(fin); }
    for (const id of ids) await p.locator('#inventaire-' + id).check();
    await p.waitForTimeout(150);
    await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(300);
  };
  await inv('2026-12-03', ['p_thomas', 'p_camille'], '14:00', '18:00');
  await nav('construire'); await allerSemaine(p, '2026-11-30');
  log('CONTROLES 30/11', await texte('[data-tour="controles"] .card-head .pill'), (await texte('[data-tour="controles"] .issue .issue-message')).filter((x) => /Thomas|Nicolas/.test(x)));
  const ligne = await p.evaluate(() => [...document.querySelectorAll('.plan-grid [role=row]')].find((r) => /Thomas N\./.test(r.querySelector('.pg-p')?.innerText || ''))?.innerText.replace(/\s+/g, ' '));
  log('LIGNE Thomas', ligne);
  await shot('14-inventaire-grille');
  // Inventaire sur semaine non publiée (15/12) pour Inès
  await inv('2026-12-15', ['p_ines'], '19:30', '22:30');
  let d = await data();
  log('INV 15/12 : notif Inès', JSON.stringify(d.notifications.filter((n) => n.personId === 'p_ines').map((n) => [n.date, n.apres])), '| semaine 14/12 statut', d.semaines['2026-12-14']?.statut ?? 'aucun (brouillon)');
  // Inventaire : fin avant début, date passée
  await p.locator('.top-creer').click(); await p.waitForTimeout(200);
  await p.locator('.menu button', { hasText: 'Un inventaire' }).click(); await p.waitForTimeout(400);
  await p.locator('#inventaire-p_ines').check(); await p.locator('#inventaire-debut').fill('22:00'); await p.locator('#inventaire-fin').fill('20:00'); await p.waitForTimeout(150);
  log('INV fin<début : bouton désactivé', await p.locator('[role=dialog] .dialog-foot button.primary').isDisabled(), '| messages', await texte('[role=dialog] .notice, [role=dialog] .erreur'));
  await p.locator('#inventaire-debut').fill('19:30'); await p.locator('#inventaire-fin').fill('22:30'); await p.locator('#inventaire-date').fill('2026-11-02'); await p.waitForTimeout(150);
  log('INV date passée : bouton désactivé', await p.locator('[role=dialog] .dialog-foot button.primary').isDisabled());
  await p.keyboard.press('Escape');
  // Formation : date passée
  await p.locator('.top-creer').click(); await p.waitForTimeout(200);
  await p.locator('.menu button', { hasText: 'Une formation' }).click(); await p.waitForTimeout(400);
  await p.locator('#formation-intitule').fill('Test'); await p.locator('#formation-interne').check(); await p.locator('#formation-debut').fill('2026-11-02'); await p.locator('#formation-fin').fill('2026-11-03'); await p.locator('#formation-p_jules').check(); await p.waitForTimeout(150);
  log('FORMATION passée : bouton désactivé', await p.locator('[role=dialog] .dialog-foot button.primary').isDisabled(), '| notice', await texte('[role=dialog] .notice'));
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(300);
  d = await data();
  log('FORMATION passée : toast', await toast(), '| absence créée', JSON.stringify(d.absences.filter((a) => a.libelle === 'Test').map((a) => [a.from, a.to])), '| postes passés de Jules retirés ?', d.shifts.filter((s) => s.personId === 'p_jules' && s.date >= '2026-11-02' && s.date <= '2026-11-03').length, '| notif', JSON.stringify(d.notifications.filter((n) => n.personId === 'p_jules').map((n) => n.apres)));
  // Nicolas : voit l'inventaire ?
  await bascule('Préparateur'); await nav('moi'); await p.waitForTimeout(400);
  const mp = await p.evaluate(() => document.querySelector('.content, main')?.innerText.replace(/\s+/g, ' '));
  log('NICOLAS mon planning inventaire ?', /Inventaire/i.test(mp), (mp.match(/.{0,100}nventaire.{0,100}/i) || [''])[0]);
  await shot('14-nicolas-inventaire', { fullPage: true });
  log('errs', errs);
  await b.close();
})();
