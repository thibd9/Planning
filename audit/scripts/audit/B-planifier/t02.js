const { ouvrir } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  // Cloche
  await p.locator('.outils .top-ico').first().click(); await p.waitForTimeout(400);
  await shot('02-cloche');
  log('CLOCHE badge', await texte('.top-ico .pastille-n'));
  log('CLOCHE', JSON.stringify(await texte('.menu.cloche > *'), null, 1));
  await p.keyboard.press('Escape'); await p.locator('.outils .top-ico').first().click({ force: true }).catch(() => {}); await p.waitForTimeout(300);
  // Résoudre badge nav
  log('NAV résoudre badge', await texte('[data-tour="nav-resoudre"] .nav-badge'));
  // Tuile 1 : équipe aujourd'hui -> journée
  await nav('tableau');
  await p.locator('.tb-chiffre').nth(0).click(); await p.waitForTimeout(600);
  await shot('02-tuile1-jour');
  log('JOUR titre', await texte('.dialog h2, [role=dialog] h2'));
  log('JOUR sous', await texte('[role=dialog] .sub, [role=dialog] p'));
  log('JOUR lignes', (await texte('.je-ligne:not(.regle) .je-qui b')).join(', '));
  log('JOUR pills', await texte('[role=dialog] .pill'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // Tuile 2 : Pharmacien présent -> construire semaine courante
  await p.locator('.tb-chiffre').nth(1).click(); await p.waitForTimeout(800);
  log('CONSTRUIRE (tuile2) repères', await texte('.ph-reperes li'));
  log('CONSTRUIRE (tuile2) semaine', await texte('.week-nav .label'));
  log('CONSTRUIRE (tuile2) statut', await texte('.plan-bar .pill'));
  await shot('02-tuile2-construire');
  // Tuile 3 : semaine prochaine
  await nav('tableau');
  await p.locator('.tb-chiffre').nth(2).click(); await p.waitForTimeout(800);
  log('CONSTRUIRE (tuile3) semaine', await texte('.week-nav .label'), await texte('.plan-bar .pill'));
  // Tuile 4 : heures
  await nav('tableau');
  await p.locator('.tb-chiffre').nth(3).click(); await p.waitForTimeout(800);
  log('HEURES chiffres', await texte('.chiffres .chiffre'));
  log('HEURES alerte', await texte('.hc-alerte'));
  await shot('02-tuile4-heures');
  // Tuile 5 : gardes
  await nav('tableau');
  await p.locator('.tb-chiffre').nth(4).click(); await p.waitForTimeout(800);
  log('GARDES liste', (await texte('.g-item')).slice(0, 6));
  await shot('02-tuile5-gardes');
  // Résoudre
  await nav('resoudre');
  log('RESOUDRE onglets', await texte('.ong-onglet'));
  await shot('02-resoudre');
  // Construire mois : préférences reçues
  await nav('construire');
  await p.locator('button', { hasText: 'Mois' }).first().click(); await p.waitForTimeout(800);
  log('MOIS label', await texte('.plan.mois .week-nav .label'));
  log('MOIS reponses', await texte('#mois-reponses'));
  for (let i = 0; i < 2; i++) { await p.locator('[aria-label="Mois suivant"]').click(); await p.waitForTimeout(500); log('MOIS +', i + 1, await texte('.plan.mois .week-nav .label'), await texte('#mois-reponses')); }
  log('errs', errs);
  await b.close();
})();
