const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav, bascule } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  await nav('construire'); await allerSemaine(p, '2026-12-07');
  // Tirage au sort
  await p.getByRole('button', { name: 'Ajouter un poste à Nicolas L. lundi' }).click(); await p.waitForTimeout(400);
  log('chances', await texte('#dp-preferences .dp-pref-qui li'));
  const compte = {};
  const N = 150;
  for (let i = 0; i < N; i++) {
    await p.locator('#dp-tirer').click();
    const t = await p.locator('#dp-tirage').innerText();
    const m = t.match(/désigné (\S+)\./); compte[m ? m[1] : '?'] = (compte[m ? m[1] : '?'] || 0) + 1;
  }
  log('TIRAGES', N, JSON.stringify(compte));
  log('après tirage : texte', await texte('#dp-tirage'), '| boutons', await texte('#dp-preferences .dp-pref-actions button'), '| sous-titre', (await dlg(p)).slice(0, 80));
  await shot('10-tirage');
  // Rendre le poste
  if (await p.locator('#dp-revenir').count()) { await p.locator('#dp-revenir').click(); await p.waitForTimeout(200); log('RENDRE -> sous-titre', (await dlg(p)).slice(0, 80), '| résultat', await texte('.dp-pref-resultat')); }
  // tirer jusqu'à un gagnant autre que Nicolas puis enregistrer
  let g = 'Nicolas';
  for (let i = 0; i < 30 && g === 'Nicolas'; i++) { await p.locator('#dp-tirer').click(); g = ((await p.locator('#dp-tirage').innerText()).match(/désigné (\S+)\./) || [])[1]; }
  log('gagnant retenu', g, '| titre', (await dlg(p)).slice(0, 60));
  await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(400);
  log('toast', await toast());
  let d = await data();
  log('postes lundi 7', d.shifts.filter((s) => s.date === '2026-12-07').map((s) => s.personId + ' ' + s.start + '-' + s.end + ' expl=' + (s.explication || '')).join(' | '));
  // Accorder : Jules lundi, poste type Après-midi (Thomas seul à l'avoir demandé)
  await p.getByRole('button', { name: 'Ajouter un poste à Jules P. lundi' }).click(); await p.waitForTimeout(300);
  await p.locator('[role=dialog] .ptc', { hasText: 'Après-midi' }).first().click(); await p.waitForTimeout(200);
  log('ACCORDER texte', await texte('#dp-pref-texte'), '| boutons', await texte('#dp-preferences .dp-pref-actions button'));
  await p.locator('#dp-accorder').click(); await p.waitForTimeout(200);
  log('après Accorder : sous-titre', (await dlg(p)).slice(0, 70), '| résultat', await texte('.dp-pref-resultat'), '| boutons', await texte('#dp-preferences .dp-pref-actions button'));
  await shot('10-accorder');
  await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(400);
  log('toast', await toast());
  d = await data();
  log('lundi 7 Thomas', d.shifts.filter((s) => s.date === '2026-12-07' && s.personId === 'p_thomas').map((s) => s.start + '-' + s.end + ' ' + s.explication), '| Jules', d.shifts.filter((s) => s.date === '2026-12-07' && s.personId === 'p_jules').length);
  // Contre : Pierre a demandé repos lundi
  await p.getByRole('button', { name: 'Ajouter un poste à Pierre F. lundi' }).click(); await p.waitForTimeout(300);
  log('CONTRE texte', await texte('#dp-pref-texte'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // Case préférences et pastilles
  log('case préférences cochée ?', await p.locator('#plan-preferences').isChecked(), '| pastilles', await p.locator('.pg-pref').count());
  await p.locator('#plan-preferences').uncheck(); await p.waitForTimeout(300);
  log('décochée -> pastilles', await p.locator('.pg-pref').count());
  await p.locator('#plan-preferences').check(); await p.waitForTimeout(300);
  // Mes postes
  await p.locator('.ph-outils button', { hasText: 'Mes postes' }).click(); await p.waitForTimeout(300);
  log('MES POSTES lignes', await texte('.pg-p .nm'), '| repères', await texte('.ph-reperes li'), '| contrôles pill', await texte('[data-tour="controles"] .card-head .pill'));
  await shot('10-mes-postes', { fullPage: true });
  await p.locator('.ph-outils button', { hasText: 'Toute l’équipe' }).click(); await p.waitForTimeout(300);
  // Équité
  await p.locator('.plan-bar button', { hasText: 'Équité' }).click(); await p.waitForTimeout(400);
  log('EQUITE entête', await texte('.pg-h:last-child'), '| 3 premières synthèses', (await texte('.pg-sum')).slice(0, 3));
  await shot('10-equite');
  await p.locator('.plan-bar button', { hasText: 'Heures' }).click(); await p.waitForTimeout(300);
  // Voir la journée depuis l'en-tête
  await p.locator('.pg-h .jour-btn').nth(0).click(); await p.waitForTimeout(400);
  log('VOIR JOURNEE', ((await dlg(p)) || '').slice(0, 250));
  await p.keyboard.press('Escape');
  // Relancer Sarah depuis le mois, puis vérifier chez elle
  await p.locator('.ph-outils button', { hasText: 'Mois' }).click(); await p.waitForTimeout(500);
  await p.locator('#mois-reponses').click(); await p.waitForTimeout(300);
  await p.locator('[data-relancer="p_sarah"]').click(); await p.waitForTimeout(300);
  log('relance toast', await toast());
  await bascule('Animateur');
  log('SARAH badge messages', await p.evaluate(() => document.querySelector('[aria-label^="Messages"]')?.getAttribute('aria-label')));
  await nav('messages'); await p.waitForTimeout(500);
  const txt = await p.evaluate(() => document.querySelector('.content, main')?.innerText.replace(/\s+/g, ' '));
  log('SARAH messages contient le rappel ?', /pensez à donner vos préférences/.test(txt), (txt.match(/.{0,80}pensez à donner.{0,80}/) || [''])[0]);
  await shot('10-sarah-messages');
  log('errs', errs);
  await b.close();
})();
