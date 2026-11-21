// Accords : Pierre (titulaire secondaire) décide ; ses décisions attendent l'accord de Caroline.
const { ouvrir, dialogue } = require('./lib');
(async () => {
  const o = await ouvrir({ role: 1 }); const { p } = o;
  console.log('PROFIL', await p.evaluate(() => document.querySelector('.topbar, header')?.innerText.replace(/\n/g, ' ').slice(0, 200)));
  await o.nav('resoudre');
  // 1. Option conseillée pour l'absence d'Igor
  await p.locator('.options .option.reco button', { hasText: 'Choisir' }).click(); await p.waitForTimeout(600);
  console.log('1 toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  // 2. Accepter le congé de Nicolas
  await p.locator('#onglet-demandes').click(); await p.waitForTimeout(300);
  let d = await o.data(); const conge = d.absences.find((a) => a.personId === 'p_camille' && a.statut === 'demandee');
  await p.locator(`[data-decider="${conge.id}"]`).click(); await p.waitForTimeout(300); await p.locator('label[for=dc-accepter]').click(); await p.locator('#dc-confirmer').click(); await p.waitForTimeout(600);
  console.log('2 toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  // 3. Refuser la demande de remplacement d'Igor (déjà acceptée dans l'exemple)
  await p.locator('#onglet-remplacements').click(); await p.waitForTimeout(300);
  await p.locator('.demande-r').first().getByRole('button', { name: 'Refuser' }).click(); await p.waitForTimeout(300);
  await p.locator('[role=dialog] button.btn.danger').click(); await p.waitForTimeout(600);
  console.log('3 toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  d = await o.data();
  console.log('ÉTAT après Pierre : accords', JSON.stringify(d.accords.map((a) => [a.action, a.titre])));
  console.log('  trou 20/11', JSON.stringify(d.trous.filter((t) => t.shift.date === '2026-11-20').map((t) => t.statut)), '| congé', d.absences.find((a) => a.id === conge.id).statut, '| rempl Igor 21/11', d.remplacements.find((r) => r.date === '2026-11-21' && !r.trouId).statut);
  console.log('  messages', JSON.stringify(d.messages.slice(2).map((m) => [m.de, m.a, m.texte.slice(0, 100)])));
  await o.nav('resoudre');
  console.log('PIERRE onglets', await p.evaluate(() => [...document.querySelectorAll('.ong-onglet')].map((x) => x.innerText.replace(/\n/g, ' ')).join(' / ')));
  await p.locator('#onglet-accords').click(); await p.waitForTimeout(300);
  console.log('PIERRE accords', (await p.locator('#panneau-decisions').innerText()));
  await o.shot('r10-pierre-accords');
  // 4. Retirer la deuxième proposition
  await p.locator('#panneau-decisions .decision').nth(1).getByRole('button', { name: 'Retirer' }).click(); await p.waitForTimeout(400);
  d = await o.data(); console.log('après Retirer', JSON.stringify(d.accords.map((a) => a.titre)));
  // Caroline
  await o.profil('Titulaire 1');
  console.log('CAROLINE badge Résoudre', await p.evaluate(() => document.querySelector('[data-tour="nav-resoudre"]')?.innerText.replace(/\n/g, ' ')));
  console.log('CAROLINE tableau mentionne accord ?', await p.evaluate(() => /accord/i.test(document.body.innerText)));
  await o.nav('resoudre');
  console.log('CAROLINE onglet actif', await p.evaluate(() => document.querySelector('.ong-onglet.on')?.innerText.replace(/\n/g, ' ')));
  console.log('CAROLINE accords', await p.locator('#panneau-decisions').innerText());
  await o.shot('r10-caroline-accords');
  await p.getByRole('button', { name: /Donner mon accord/ }).first().click(); await p.waitForTimeout(800);
  console.log('toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  d = await o.data();
  console.log('après accord : accords', d.accords.length, '| trou 20/11', JSON.stringify(d.trous.filter((t) => t.shift.date === '2026-11-20').map((t) => [t.statut, t.resolution])));
  console.log('  Pierre 20/11', JSON.stringify(d.shifts.filter((s) => s.personId === 'p_antoine' && s.date === '2026-11-20').map((s) => [s.start, s.end])), 'publié', JSON.stringify(d.semaines['2026-11-16'].snapshot.filter((s) => s.personId === 'p_antoine' && s.date === '2026-11-20').map((s) => [s.start, s.end])));
  console.log('  messages', JSON.stringify(d.messages.slice(2).map((m) => [m.de, m.a, m.texte.slice(0, 120)])));
  console.log('  journal', JSON.stringify(d.journal.slice(0, 3).map((j) => j.titre)));
  // Refuser un accord (s'il en reste) : on recrée une proposition de Pierre
  await o.profil('Titulaire 2'); await o.nav('heures');
  const solder = p.getByRole('button', { name: /^Solder$|^Payer$/ }).first();
  if (await solder.count()) { console.log('Pierre clique', await solder.innerText()); await solder.click(); await p.waitForTimeout(500); console.log(' toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText)); }
  d = await o.data(); console.log(' regularisations', (d.regularisations ?? []).length, '| accords', JSON.stringify(d.accords.map((a) => a.titre)));
  await o.profil('Titulaire 1'); await o.nav('resoudre');
  await p.getByRole('button', { name: /^Refuser$/ }).first().click(); await p.waitForTimeout(600);
  console.log('refus toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  d = await o.data(); console.log(' regularisations', (d.regularisations ?? []).length, '| accords', d.accords.length, '| message', JSON.stringify(d.messages.slice(-1).map((m) => [m.de, m.a, m.texte])), '| journal', d.journal[0].titre);
  console.log('ERR', o.errs); await o.b.close();
})();
