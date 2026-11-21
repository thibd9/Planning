const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav, bascule } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  const nG = async () => (await data()).gardes.length;
  await nav('gardes');
  log('GARDES tête', await texte('.page-head'));
  await shot('13-gardes');
  const g0 = await nG();
  // 1. Ajouter une garde, affecter plus tard
  await p.locator('.page-head button', { hasText: 'Ajouter' }).first().click(); await p.waitForTimeout(400);
  log('AJOUT dlg', ((await dlg(p)) || '').slice(0, 700));
  log('options personne', await p.evaluate(() => [...document.querySelectorAll('#garde-personne option')].map((o) => o.textContent)));
  await shot('13-ajout-garde');
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(300);
  log('AJOUT toast', await toast(), '| gardes', g0, '->', await nG());
  // 2. Garde sur une personne déjà en poste : Léa, date où elle travaille jusqu'à 19 h 30 (semaine du 23)
  let d = await data();
  const lea = d.semaines['2026-11-23'].snapshot.filter((s) => s.personId === 'p_lea').sort((a, b) => b.end - a.end)[0];
  const igor = d.semaines['2026-11-23'].snapshot.filter((s) => s.personId === 'p_karim');
  log('Léa poste', lea && lea.date + ' ' + lea.start + '-' + lea.end, '| Igor', igor.map((s) => s.date.slice(8) + ':' + s.start + '-' + s.end).join(' '));
  await p.locator('.page-head button', { hasText: 'Ajouter' }).first().click(); await p.waitForTimeout(300);
  await p.locator('#garde-date').fill(lea.date); await p.waitForTimeout(300);
  log('GARDE sur jour de poste : options', await p.evaluate(() => [...document.querySelectorAll('#garde-personne option')].map((o) => o.textContent)));
  log('   avertissements', await texte('[role=dialog] .notice'));
  await p.locator('#garde-personne').selectOption('p_lea'); await p.waitForTimeout(200);
  log('   après choix Léa', await texte('[role=dialog] .notice'), '| bouton', await texte('[role=dialog] .dialog-foot button.primary'));
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(300);
  log('   toast', await toast());
  d = await data();
  log('   notif Léa', JSON.stringify(d.notifications.filter((n) => n.personId === 'p_lea').slice(0, 1)), '| garde', JSON.stringify(d.gardes.filter((g) => g.date === lea.date)));
  // 3. Garde dans le passé
  await p.locator('.page-head button', { hasText: 'Ajouter' }).first().click(); await p.waitForTimeout(300);
  await p.locator('#garde-date').fill('2026-11-01'); await p.waitForTimeout(200);
  log('PASSÉ : bouton désactivé ?', await p.locator('[role=dialog] .dialog-foot button.primary').isDisabled(), '| notices', await texte('[role=dialog] .notice'));
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(300);
  log('PASSÉ toast', await toast(), '| gardes le 1/11', (await data()).gardes.filter((g) => g.date === '2026-11-01').length);
  // 4. Garde sur personne absente : formation de Léa d'abord via Créer
  await p.locator('.top-creer').click(); await p.waitForTimeout(200);
  await p.locator('.menu button', { hasText: 'Une formation' }).click(); await p.waitForTimeout(500);
  log('FORMATION dlg', ((await dlg(p)) || '').slice(0, 300));
  await p.locator('#formation-intitule').fill('Vaccination');
  await p.locator('#formation-externe').check();
  await p.locator('#formation-lieu').fill('Lyon');
  await p.locator('#formation-debut').fill('2026-12-01'); await p.locator('#formation-fin').fill('2026-12-02');
  await p.locator('#formation-p_lea').check(); await p.waitForTimeout(200);
  log('FORMATION notice', await texte('[role=dialog] .notice'));
  await shot('13-formation');
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(400);
  log('FORMATION toast', await toast());
  d = await data();
  log('FORMATION absence', JSON.stringify(d.absences.filter((a) => a.type === 'formation')), '| notif Léa', JSON.stringify(d.notifications.filter((n) => n.personId === 'p_lea').map((n) => n.apres)), '| trous', d.trous.length);
  log('   postes de Léa 1-2/12 brouillon', d.shifts.filter((s) => s.personId === 'p_lea' && s.date >= '2026-12-01' && s.date <= '2026-12-02').length, 'publiés', d.semaines['2026-11-30'].snapshot.filter((s) => s.personId === 'p_lea' && s.date >= '2026-12-01' && s.date <= '2026-12-02').length);
  await nav('gardes');
  await p.locator('.page-head button', { hasText: 'Ajouter' }).first().click(); await p.waitForTimeout(300);
  await p.locator('#garde-date').fill('2026-12-01'); await p.waitForTimeout(300);
  log('GARDE sur absente : options', await p.evaluate(() => [...document.querySelectorAll('#garde-personne option')].map((o) => o.textContent)));
  await p.locator('#garde-personne').selectOption('p_lea'); await p.waitForTimeout(200);
  log('   avert', await texte('[role=dialog] .notice'));
  await shot('13-garde-absente');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // 5. Série régulière
  await p.locator('.page-head button', { hasText: 'Ajouter' }).first().click(); await p.waitForTimeout(300);
  await p.locator('#garde-repeter').check(); await p.waitForTimeout(100);
  await p.locator('#garde-intervalle').fill('2'); await p.locator('#garde-nombre').fill('5'); await p.waitForTimeout(200);
  log('SERIE texte', await texte('[role=dialog] .row.wrap .small.soft'));
  const avant = await nG();
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(300);
  log('SERIE toast', await toast(), '| +', (await nG()) - avant, (await data()).gardes.slice(-5).map((g) => g.date).join(','));
  // Série : valeurs limites
  await p.locator('.page-head button', { hasText: 'Ajouter' }).first().click(); await p.waitForTimeout(300);
  await p.locator('#garde-repeter').check(); await p.locator('#garde-intervalle').fill('0'); await p.locator('#garde-nombre').fill('-3'); await p.waitForTimeout(200);
  log('SERIE limites texte', await texte('[role=dialog] .row.wrap .small.soft'), 'bouton désactivé', await p.locator('[role=dialog] .dialog-foot button.primary').isDisabled());
  const av2 = await nG();
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(300);
  log('SERIE limites toast', await toast(), '| +', (await nG()) - av2);
  await p.locator('#garde-intervalle').count().then(async (n) => { if (n) await p.keyboard.press('Escape'); });
  // 6. Importer
  await p.locator('.page-head button', { hasText: 'Importer' }).click(); await p.waitForTimeout(300);
  await p.locator('[role=dialog] textarea').fill('14/02/2027;19:30;08:30;volets fermés\n07/03/2027;09:00;19:00;volets ouverts\n31/02/2027;09:00;19:00\nn importe quoi\n2027-04-04;09:00;19:00;astreinte');
  await p.waitForTimeout(300);
  log('IMPORT dlg', ((await dlg(p)) || '').slice(0, 900));
  await shot('13-import');
  const av3 = await nG();
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(300);
  log('IMPORT toast', await toast(), '| +', (await nG()) - av3, JSON.stringify((await data()).gardes.slice(-4).map((g) => [g.date, g.start, g.end, g.type])));
  // 7. Répartir
  const btnRep = p.locator('.page-head button', { hasText: 'Répartir' });
  log('Répartir présent', await btnRep.count());
  if (await btnRep.count()) {
    await btnRep.click(); await p.waitForTimeout(400);
    log('REPARTIR dlg', ((await dlg(p)) || '').slice(0, 1500));
    await shot('13-repartir');
    await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(400);
    log('REPARTIR toast', await toast());
    d = await data();
    const leaG = d.gardes.filter((g) => g.personId === 'p_lea' && g.date >= '2026-12-01' && g.date <= '2026-12-02');
    log('  gardes confiées à Léa pendant sa formation', leaG.length, '| sans personne restantes', d.gardes.filter((g) => !g.personId && g.date >= '2026-11-20').length);
  }
  // 8. Effet dans Construire : garde visible dans la grille
  await nav('construire'); await allerSemaine(p, '2026-11-23');
  log('CONSTRUIRE tuiles garde semaine 23', await texte('.pg-c .tile.garde'));
  log('errs', errs);
  await b.close();
})();
