// Signaler pour quelqu'un (Igor, absence le sam. 28/11), puis Résoudre : « Je prends ce poste moi-même » ; appel à l'équipe.
const { ouvrir, dialogue } = require('./lib');
(async () => {
  const o = await ouvrir({ role: 0 });
  const { p } = o;
  await p.getByRole('button', { name: /Retard ou absence/ }).first().click(); await p.waitForTimeout(500);
  console.log('DIALOGUE 0', (await dialogue(p)).slice(0, 600));
  await p.selectOption('#sg-qui', 'p_karim'); await p.locator('label[for=sg-absence]').click(); await p.waitForTimeout(200);
  await p.fill('#sg-du', '2026-11-28'); await p.fill('#sg-au', '2026-11-28'); await p.waitForTimeout(300);
  console.log('DIALOGUE 1', (await dialogue(p)).slice(0, 1500));
  await o.shot('r3-signaler-igor');
  await p.locator('#sg-confirmer').click(); await p.waitForTimeout(700);
  console.log('TOAST', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  let d = await o.data();
  const a = d.absences.find((x) => x.from === '2026-11-28');
  console.log('ABSENCE', JSON.stringify(a));
  console.log('TROUS', JSON.stringify(d.trous.filter((t) => t.absenceId === a.id).map((t) => [t.shift.date, t.shift.start, t.shift.end, t.statut])));
  console.log('snapshot 28/11 Igor', JSON.stringify(d.semaines['2026-11-23'].snapshot.filter((s) => s.personId === 'p_karim' && s.date === '2026-11-28')));
  console.log('annonces', JSON.stringify((d.annonces ?? []).slice(0, 2).map((x) => [x.titre, x.pour])), 'messages', d.messages.length, 'notifs Igor', JSON.stringify(d.notifications.filter((n) => n.personId === 'p_karim')));
  console.log('journal0', JSON.stringify(d.journal[0]));
  await o.nav('resoudre');
  const carte = p.locator('.card', { hasText: 'sam. 28 novembre' }).first();
  console.log('CARTE', (await carte.innerText()).slice(0, 1800));
  await o.shot('r3-carte-28', { fullPage: true });
  await carte.getByRole('button', { name: /Voir et choisir la solution/ }).click(); await p.waitForTimeout(600);
  const dl = await dialogue(p); console.log('REGLAGE', dl.slice(0, 1500));
  const moi = p.locator('.rs-option', { hasText: 'Je prends ce poste moi-même' });
  console.log('option moi presente', await moi.count());
  if (await moi.count()) { await moi.click(); await p.waitForTimeout(300); await o.shot('r3-reglage-moi'); await p.getByRole('button', { name: /Appliquer mes choix/ }).click(); await p.waitForTimeout(800); }
  d = await o.data();
  console.log('Caroline 28/11 brouillon', JSON.stringify(d.shifts.filter((s) => s.personId === 'p_helene' && s.date === '2026-11-28').map((s) => [s.start, s.end, s.origine, s.explication])));
  console.log('Caroline 28/11 publié', JSON.stringify(d.semaines['2026-11-23'].snapshot.filter((s) => s.personId === 'p_helene' && s.date === '2026-11-28').map((s) => [s.start, s.end])));
  console.log('trou', JSON.stringify(d.trous.filter((t) => t.absenceId === a.id).map((t) => [t.statut, t.resolution])));
  console.log('journal0', JSON.stringify(d.journal[0].titre), 'notifs Caroline', JSON.stringify(d.notifications.filter((n) => n.personId === 'p_helene')));
  console.log('ERR', o.errs); await o.b.close();
})();
