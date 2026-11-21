const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav, bascule } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  const ap = async () => ({ periode: await texte('#imp-periode'), format: await texte('#imp-format'), note: await texte('.imp-note'), statut: await texte('.imp-zone .f-statut'), h1: await texte('.imp-zone .f-tete h1'), legende: (await texte('.imp-zone .f-pied'))[0]?.slice(0, 90), lignes: (await texte('.imp-zone .f-nom b')).length, cases: (await texte('.imp-zone .f-poste b')).length, nb: await p.locator('.imp-zone .feuille.nb').count() });
  // Heures : retouche réelle de 2 h sur Thomas cette semaine (non publiée)
  await nav('heures'); const hAvant = (await texte('.decision.hc')).find((x) => /Thomas/.test(x))?.replace(/\s+/g, ' ').slice(0, 90);
  await nav('construire'); await allerSemaine(p, '2026-11-16');
  const cellT = p.locator('.plan-grid [role=row]').filter({ has: p.locator('.pg-p .nm', { hasText: /^Thomas N\.$/ }) }).locator('.pg-c');
  let fait = false;
  for (let i = 4; i >= 0 && !fait; i--) { if (await cellT.nth(i).locator('.tile').count()) { await cellT.nth(i).locator('.tile').first().click(); await p.waitForTimeout(300); const ins = p.locator('[role=dialog] .dp-horaires input[type=time]'); const deb = await ins.nth(0).inputValue(); const [h, m] = deb.split(':').map(Number); await ins.nth(0).fill(String(h + 2).padStart(2, '0') + ':' + String(m).padStart(2, '0')); await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(300); fait = i; } }
  log('retouche Thomas colonne', fait, await texte('.plan-bar .pill'));
  await nav('heures'); const hApres = (await texte('.decision.hc')).find((x) => /Thomas/.test(x))?.replace(/\s+/g, ' ').slice(0, 90);
  log('HEURES Thomas avant', hAvant, '\n       après (non publié)', hApres);
  // Impression depuis Construire (semaine en cours, publiée avec retouche en attente)
  await nav('construire'); await allerSemaine(p, '2026-11-16');
  await p.locator('[aria-label="Imprimer le planning"]').click(); await p.waitForTimeout(600);
  let a = await ap(); log('IMP semaine', JSON.stringify(a));
  const thomasImp = await p.evaluate(() => { const r = [...document.querySelectorAll('.imp-zone tr')].find((x) => /Thomas/.test(x.querySelector('.f-nom')?.textContent || '')); return r ? r.innerText.replace(/\s+/g, ' ') : null; });
  log('IMP ligne Thomas', thomasImp);
  const snap = (await data()).semaines['2026-11-16'].snapshot.filter((s) => s.personId === 'p_thomas').map((s) => s.date.slice(8) + ' ' + s.start + '-' + s.end);
  log('version publiée Thomas', snap);
  await shot('12-imp-semaine');
  await p.locator('[role=dialog] .imp-outils button', { hasText: 'Noir et blanc' }).click(); await p.waitForTimeout(300);
  a = await ap(); log('IMP N&B', JSON.stringify(a)); await shot('12-imp-nb');
  await p.locator('[role=dialog] .imp-outils button', { hasText: 'Mes postes' }).click(); await p.waitForTimeout(300);
  a = await ap(); log('IMP moi', JSON.stringify(a)); await shot('12-imp-moi');
  await p.locator('[role=dialog] .imp-outils button', { hasText: 'Mois' }).click(); await p.waitForTimeout(400);
  a = await ap(); log('IMP mois moi', JSON.stringify(a)); await shot('12-imp-mois-moi');
  await p.locator('[role=dialog] .imp-outils button', { hasText: 'Toute l’équipe' }).click(); await p.locator('[role=dialog] .imp-outils button', { hasText: 'Couleur' }).click(); await p.waitForTimeout(400);
  a = await ap(); log('IMP mois équipe couleur', JSON.stringify(a)); await shot('12-imp-mois-equipe');
  await p.locator('[aria-label="Mois suivant"]').last().click(); await p.waitForTimeout(400);
  a = await ap(); log('IMP décembre', JSON.stringify(a)); await shot('12-imp-decembre');
  await p.locator('[aria-label="Mois suivant"]').last().click(); await p.waitForTimeout(400);
  a = await ap(); log('IMP janvier', JSON.stringify(a));
  // Bouton Imprimer : déclenche window.print ?
  await p.evaluate(() => { window.__print = 0; window.print = () => { window.__print++; }; });
  await p.locator('#imp-imprimer').click(); await p.waitForTimeout(500);
  log('window.print appelé', await p.evaluate(() => window.__print), '| toast', await toast());
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // Côté Nicolas : impression de la même semaine
  await bascule('Préparateur'); await nav('planning'); await allerSemaine(p, '2026-11-16');
  await p.locator('#equipe-imprimer').click(); await p.waitForTimeout(500);
  a = await ap(); log('NICOLAS IMP semaine', JSON.stringify(a));
  const thomasImpN = await p.evaluate(() => { const r = [...document.querySelectorAll('.imp-zone tr')].find((x) => /Thomas/.test(x.querySelector('.f-nom')?.textContent || '')); return r ? r.innerText.replace(/\s+/g, ' ') : null; });
  log('NICOLAS IMP ligne Thomas', thomasImpN);
  await p.keyboard.press('Escape');
  // Journée de demain : l'avis de retard apparaît-il ?
  await bascule('Titulaire 1');
  await p.locator('#top-signaler').click(); await p.waitForTimeout(400);
  await p.locator('#sg-qui').selectOption('p_camille'); await p.locator('#sg-durees button').first().click(); await p.waitForTimeout(200);
  await p.locator('#sg-confirmer').click(); await p.waitForTimeout(400);
  log('avis', await toast(), JSON.stringify((await data()).retards));
  await p.evaluate(() => [...document.querySelectorAll('.tb-jour .card-head button')][0]?.click()); await p.waitForTimeout(400);
  await p.locator('[role=dialog] button', { hasText: 'Lendemain' }).click(); await p.waitForTimeout(300);
  const ln = await p.evaluate(() => [...document.querySelectorAll('.je-ligne')].find((x) => /Nicolas/.test(x.innerText))?.innerText.replace(/\s+/g, ' '));
  log('JOUR demain Nicolas', ln);
  await shot('12-jour-demain-avis');
  log('errs', errs);
  await b.close();
})();
