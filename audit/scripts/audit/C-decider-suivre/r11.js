// Retard ou absence : pour soi, pour un autre, accident du travail, cas limites.
const { ouvrir, dialogue } = require('./lib');
const ouvrirSg = async (p) => { await p.getByRole('button', { name: /Retard ou absence/ }).first().click(); await p.waitForTimeout(400); };
const toast = (p) => p.evaluate(() => document.querySelector('[class*=toast]')?.innerText);
(async () => {
  let o = await ouvrir({ role: 0 }); let p = o.p;
  // 1. Caroline, retard pour elle-même
  await ouvrirSg(p); await p.locator('label[for=sg-retard]').click(); await p.waitForTimeout(200);
  console.log('1 RETARD MOI', (await dialogue(p)).replace(/\n+/g, ' | ').slice(0, 900));
  await p.getByRole('button', { name: '15 min' }).click(); await o.shot('r11-retard-moi');
  console.log('  bouton', await p.locator('#sg-confirmer').innerText(), 'désactivé', await p.locator('#sg-confirmer').isDisabled());
  await p.locator('#sg-confirmer').click(); await p.waitForTimeout(500);
  console.log('  toast', await toast(p));
  let d = await o.data(); console.log('  retards', JSON.stringify(d.retards), '| messages', JSON.stringify(d.messages.slice(2).map((m) => [m.de, m.a, m.texte])), '| journal', d.journal[0].titre, '| annonce', JSON.stringify([d.annonces[0].titre, d.annonces[0].pour]));
  // 2. Retard pour Thomas (+ de 20 min, valeurs limites)
  await ouvrirSg(p); await p.selectOption('#sg-qui', 'p_thomas'); await p.locator('label[for=sg-retard]').click(); await p.getByRole('button', { name: /\+ de 20 min/ }).click();
  for (const v of ['0', '-30', '999', '45']) { await p.fill('#sg-minutes', v); await p.waitForTimeout(150); console.log(`  minutes=${v}`, await p.locator('.ret-arrivee, #sg-sans-poste').first().innerText().catch(() => '-'), '| bouton actif', !(await p.locator('#sg-confirmer').isDisabled())); }
  await o.shot('r11-retard-thomas');
  await p.locator('#sg-confirmer').click(); await p.waitForTimeout(500);
  console.log('  toast', await toast(p));
  d = await o.data(); console.log('  retards', JSON.stringify(d.retards?.map((r) => [r.personId, r.date, r.start, r.minutes, r.par])), '| journal', d.journal[0].titre, '| annonce', JSON.stringify([d.annonces[0].titre, d.annonces[0].pour, d.annonces[0].effets]));
  // 3. Absence pour Caroline elle-même, dates inversées et passées
  await ouvrirSg(p); await p.locator('label[for=sg-absence]').click();
  await p.fill('#sg-du', '2026-11-10'); await p.waitForTimeout(150);
  console.log('3 date passée acceptée ?', await p.inputValue('#sg-du'), '|', await p.locator('#sg-postes').innerText());
  await p.fill('#sg-du', '2026-11-25'); await p.fill('#sg-au', '2026-11-23'); await p.waitForTimeout(150);
  console.log('  du 25 au 23 ->', await p.inputValue('#sg-du'), await p.inputValue('#sg-au'), '|', await p.locator('#sg-postes').innerText());
  await o.shot('r11-absence-dates');
  await p.locator('button', { hasText: 'Annuler' }).last().click(); await p.waitForTimeout(300);
  // 4. Accident du travail pour Thomas
  await ouvrirSg(p); await p.selectOption('#sg-qui', 'p_thomas'); await p.locator('label[for=sg-absence]').click();
  await p.fill('#sg-du', '2026-11-21'); await p.fill('#sg-au', '2026-11-24');
  await p.getByRole('button', { name: 'Accident du travail' }).click(); await p.waitForTimeout(200);
  await p.fill('#sg-acc-heure', '10:15'); await p.fill('#sg-acc-faits', 'Chute dans la réserve, poignet droit'); await p.fill('#sg-acc-temoin', 'Jules');
  console.log('4 ACCIDENT', (await dialogue(p)).replace(/\n+/g, ' | ').slice(0, 2200));
  await o.shot('r11-accident', { fullPage: true });
  await p.locator('#sg-confirmer').click(); await p.waitForTimeout(600);
  console.log('  toast', await toast(p));
  d = await o.data(); const acc = d.absences.find((a) => a.type === 'accident');
  console.log('  absence', JSON.stringify(acc), '| journal', d.journal[0].titre, d.journal[0].detail);
  await o.nav('tableau'); await p.waitForTimeout(500);
  console.log('  TABLEAU', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(0, 1400));
  await o.shot('r11-tableau-accident');
  const fait = p.locator(`[data-declare]`).first();
  console.log('  bouton C’est fait présent', await fait.count());
  if (await fait.count()) { await fait.click(); await p.waitForTimeout(500); console.log('  toast', await toast(p)); d = await o.data(); console.log('  declareLe', d.absences.find((a) => a.type === 'accident').accident.declareLe, '| journal', d.journal[0].titre, '| rappel restant', await p.locator('[data-declare]').count()); }
  await o.nav('resoudre'); console.log('  RESOUDRE mentionne Thomas ?', (await p.locator('#panneau-decisions').innerText()).includes('Thomas'));
  console.log('ERR', o.errs); await o.b.close();
  // 5. Pierre, pour lui-même : retard et absence
  o = await ouvrir({ role: 1 }); p = o.p;
  await ouvrirSg(p); await p.locator('label[for=sg-retard]').click(); await p.waitForTimeout(150);
  console.log('5 PIERRE retard', (await dialogue(p)).replace(/\n+/g, ' | ').slice(0, 700));
  await p.locator('#sg-confirmer').click(); await p.waitForTimeout(500); console.log('  toast', await toast(p));
  d = await o.data(); console.log('  messages', JSON.stringify(d.messages.slice(2).map((m) => [m.de, m.a, m.texte])), '| retards', JSON.stringify(d.retards));
  await ouvrirSg(p); await p.locator('label[for=sg-absence]').click(); await p.fill('#sg-du', '2026-11-23'); await p.fill('#sg-au', '2026-11-23');
  console.log('  PIERRE absence', (await dialogue(p)).replace(/\n+/g, ' | ').slice(300, 900), '| bouton', await p.locator('#sg-confirmer').innerText());
  await p.locator('#sg-confirmer').click(); await p.waitForTimeout(500); console.log('  toast', await toast(p));
  d = await o.data(); console.log('  absences Pierre', JSON.stringify(d.absences.filter((a) => a.personId === 'p_antoine')), '| accords', JSON.stringify(d.accords.map((a) => a.titre)));
  console.log('ERR', o.errs); await o.b.close();
})();
