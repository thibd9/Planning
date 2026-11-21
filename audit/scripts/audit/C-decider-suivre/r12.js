// Absence enregistrée par un titulaire : qui est prévenu ? Et une date passée saisie au clavier.
const { ouvrir } = require('./lib');
(async () => {
  let o = await ouvrir({ role: 0 }); let p = o.p;
  let d0 = await o.data();
  const nA = (d0.annonces ?? []).length, nM = d0.messages.length, nN = d0.notifications.length;
  await p.getByRole('button', { name: /Retard ou absence/ }).first().click(); await p.waitForTimeout(300);
  await p.selectOption('#sg-qui', 'p_ines'); await p.locator('label[for=sg-absence]').click();
  await p.fill('#sg-du', '2026-11-09'); await p.fill('#sg-au', '2026-11-13'); await p.waitForTimeout(200);
  console.log('dialogue', await p.locator('#sg-postes').innerText(), '| du', await p.inputValue('#sg-du'));
  await p.locator('#sg-confirmer').click(); await p.waitForTimeout(600);
  console.log('toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  const d = await o.data();
  console.log('annonces +', (d.annonces ?? []).length - nA, '| messages +', d.messages.length - nM, '| notifications +', d.notifications.length - nN);
  console.log('absence', JSON.stringify(d.absences.filter((a) => a.personId === 'p_ines')));
  const avant = d0.semaines['2026-11-09'].snapshot.filter((s) => s.personId === 'p_ines').length;
  console.log('Inès sem. du 9/11 : postes publiés avant', avant, 'après', d.semaines['2026-11-09'].snapshot.filter((s) => s.personId === 'p_ines').length, '| brouillon après', d.shifts.filter((s) => s.personId === 'p_ines' && s.date >= '2026-11-09' && s.date <= '2026-11-13').length);
  console.log('trous', JSON.stringify(d.trous.filter((t) => t.shift.personId === 'p_ines').map((t) => t.shift.date)));
  await o.nav('heures'); await p.waitForTimeout(400);
  console.log('HEURES Inès', await p.locator('.hc', { hasText: 'Inès' }).innerText().catch(() => '-'));
  console.log('ERR', o.errs); await o.b.close();
  o = await ouvrir({ role: 0 }); p = o.p; await o.nav('heures'); await p.waitForTimeout(400);
  console.log('HEURES Inès (sans l’absence)', await p.locator('.hc', { hasText: 'Inès' }).innerText().catch(() => '-'));
  await o.b.close();
})();
