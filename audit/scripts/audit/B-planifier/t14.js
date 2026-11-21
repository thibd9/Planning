const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav, bascule } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  // Import : type par défaut ignoré quand une autre ligne précise le sien
  await nav('gardes');
  await p.locator('.page-head button', { hasText: 'Importer' }).click(); await p.waitForTimeout(300);
  await p.locator('[role=dialog] select').selectOption('astreinte');
  await p.locator('[role=dialog] textarea').fill('14/02/2027;19:30;08:30;volets ouverts\n21/02/2027;19:30;08:30');
  await p.waitForTimeout(200);
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(300);
  log('IMPORT types', JSON.stringify((await data()).gardes.filter((g) => g.date.startsWith('2027-02')).map((g) => [g.date, g.type])));
  // Import seul sans type
  await p.locator('.page-head button', { hasText: 'Importer' }).click(); await p.waitForTimeout(300);
  await p.locator('[role=dialog] select').selectOption('astreinte');
  await p.locator('[role=dialog] textarea').fill('28/02/2027;19:30;08:30');
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(300);
  log('IMPORT seul', JSON.stringify((await data()).gardes.filter((g) => g.date === '2027-02-28').map((g) => g.type)));
  // Garde sur jour de poste (Léa 26/11) : effet dans Résoudre
  const avant = await texte('#onglet-gardes');
  await p.locator('.page-head button', { hasText: 'Ajouter' }).first().click(); await p.waitForTimeout(300);
  await p.locator('#garde-date').fill('2026-11-26'); await p.locator('#garde-personne').selectOption('p_lea'); await p.waitForTimeout(150);
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(300);
  await nav('resoudre');
  log('RESOUDRE onglets', await texte('.ong-onglet'));
  await p.locator('#onglet-gardes').click(); await p.waitForTimeout(300);
  log('RESOUDRE gardes', (await texte('#panneau-decisions')).join(' ').replace(/\s+/g, ' ').slice(0, 900));
  await shot('14-resoudre-gardes');
  // Tâche Formation depuis la fenêtre du poste
  await nav('construire'); await allerSemaine(p, '2026-11-30');
  await p.locator('.plan-grid .pg-c .tile').first().click(); await p.waitForTimeout(300);
  log('TACHES', await texte('[role=dialog] .dp-tache .choix > *'));
  await p.locator('#tache-vers-formation').click(); await p.waitForTimeout(500);
  log('-> fenêtre ouverte', ((await dlg(p)) || '').slice(0, 80));
  log('   phrase du bas', await texte('[role=dialog] .tiny.muted'));
  await shot('14-formation-depuis-poste');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  log('vue après fermeture', await p.evaluate(() => document.querySelector('[data-tour^="nav-"][aria-current="page"]')?.getAttribute('data-tour')));
  // Inventaire : semaine publiée (jeudi 3/12) pendant l'ouverture, Thomas + Nicolas ; et semaine non publiée
  await p.locator('.top-creer').click(); await p.waitForTimeout(200);
  await p.locator('.menu button', { hasText: 'Un inventaire' }).click(); await p.waitForTimeout(500);
  log('INV dlg', ((await dlg(p)) || '').slice(0, 300));
  await p.locator('#inventaire-date').fill('2026-12-03'); await p.locator('#inventaire-debut').fill('14:00'); await p.locator('#inventaire-fin').fill('18:00');
  await p.locator('#inventaire-p_thomas').check(); await p.locator('#inventaire-p_camille').check(); await p.waitForTimeout(200);
  log('INV notice', await texte('[role=dialog] .notice'));
  await shot('14-inventaire');
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(400);
  log('INV toast', await toast());
  let d = await data();
  log('INV postes 3/12 Thomas', d.shifts.filter((s) => s.personId === 'p_thomas' && s.date === '2026-12-03').map((s) => s.start + '-' + s.end + ' ' + s.activite).join(' | '), '| snapshot', d.semaines['2026-11-30'].snapshot.filter((s) => s.personId === 'p_thomas' && s.date === '2026-12-03').map((s) => s.start + '-' + s.end + ' ' + s.activite).join(' | '));
  log('INV notifs', JSON.stringify(d.notifications.filter((n) => /Inventaire/.test(n.apres)).map((n) => [n.personId, n.apres])));
  await allerSemaine(p, '2026-11-30');
  log('CONTROLES 30/11', await texte('[data-tour="controles"] .card-head .pill'), (await texte('[data-tour="controles"] .issue .issue-message')).filter((x) => /Thomas|Nicolas/.test(x)));
  // Inventaire sur semaine non publiée (14/12)
  await p.locator('.top-creer').click(); await p.waitForTimeout(200);
  await p.locator('.menu button', { hasText: 'Un inventaire' }).click(); await p.waitForTimeout(400);
  await p.locator('#inventaire-date').fill('2026-12-15'); await p.locator('#inventaire-p_ines').check(); await p.waitForTimeout(100);
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(300);
  d = await data();
  log('INV 15/12 : notif Inès', JSON.stringify(d.notifications.filter((n) => n.personId === 'p_ines').map((n) => [n.date, n.apres])), '| semaine 14/12 statut', d.semaines['2026-12-14']?.statut);
  // Inventaire : fin avant début, date passée
  await p.locator('.top-creer').click(); await p.waitForTimeout(200);
  await p.locator('.menu button', { hasText: 'Un inventaire' }).click(); await p.waitForTimeout(400);
  await p.locator('#inventaire-p_ines').check(); await p.locator('#inventaire-debut').fill('22:00'); await p.locator('#inventaire-fin').fill('20:00'); await p.waitForTimeout(150);
  log('INV fin<début : bouton désactivé', await p.locator('[role=dialog] .dialog-foot button.primary').isDisabled(), '| messages', await texte('[role=dialog] .notice, [role=dialog] .erreur'));
  await p.locator('#inventaire-debut').fill('19:30'); await p.locator('#inventaire-fin').fill('22:30'); await p.locator('#inventaire-date').fill('2026-11-02'); await p.waitForTimeout(150);
  log('INV date passée : bouton désactivé', await p.locator('[role=dialog] .dialog-foot button.primary').isDisabled());
  await p.keyboard.press('Escape');
  // Bascule Nicolas : voit-il l'inventaire et la notification ?
  await bascule('Préparateur'); await nav('moi'); await p.waitForTimeout(400);
  const mp = await p.evaluate(() => document.querySelector('.content, main')?.innerText.replace(/\s+/g, ' '));
  log('NICOLAS mon planning inventaire ?', /Inventaire/i.test(mp), (mp.match(/.{0,100}Inventaire.{0,100}/i) || [''])[0]);
  log('errs', errs);
  await b.close();
})();
