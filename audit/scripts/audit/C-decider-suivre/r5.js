// Appel à l'équipe complet : Nicolas absent jeu. 26/11, « Prévenir les 2 personnes », Sarah répond « Je peux », Caroline confie.
const { ouvrir } = require('./lib');
const ouvrirVolets = (p) => p.evaluate(() => document.querySelectorAll('details.volet').forEach((d) => (d.open = true)));
(async () => {
  const o = await ouvrir({ role: 0 }); const { p } = o;
  await p.getByRole('button', { name: /Retard ou absence/ }).first().click(); await p.waitForTimeout(300);
  await p.selectOption('#sg-qui', 'p_camille'); await p.locator('label[for=sg-absence]').click();
  await p.fill('#sg-du', '2026-11-26'); await p.fill('#sg-au', '2026-11-26');
  await p.locator('#sg-confirmer').click(); await p.waitForTimeout(600);
  await o.nav('resoudre'); await ouvrirVolets(p); await p.waitForTimeout(200);
  const carte = p.locator('.card:has(h3:has-text("Nicolas L."))').first();
  await carte.locator('section.appel .appel-tete button.btn.primary').click(); await p.waitForTimeout(600);
  console.log('TOAST', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  let d = await o.data();
  let r = d.remplacements.find((x) => x.trouId && x.date === '2026-11-26');
  console.log('REMPL', JSON.stringify([r.statut, r.sollicites, r.volontaires]));
  console.log('MESSAGES', JSON.stringify(d.messages.slice(2).map((m) => [m.de, m.a, m.texte])));
  console.log('JOURNAL', d.journal[0].titre);
  console.log('Badge Résoudre', await p.evaluate(() => document.querySelector('[data-tour="nav-resoudre"]')?.innerText.replace(/\n/g, ' ')));
  await o.profil('Animateur');
  await o.nav('moi');
  const recu = p.locator('.appel-recu').first();
  console.log('SARAH appel reçu', await recu.count() ? (await recu.innerText()).replace(/\n/g, ' | ') : 'ABSENT');
  await o.shot('r5-sarah-appel-recu');
  console.log('SARAH messages badge', await p.evaluate(() => document.querySelector('[data-tour="nav-messages"]')?.innerText.replace(/\n/g, ' ')));
  if (await recu.count()) { await recu.getByRole('button', { name: 'Je peux' }).click(); await p.waitForTimeout(500); console.log('après Je peux', (await recu.innerText()).replace(/\n/g, ' | ')); }
  await o.profil('Titulaire 1');
  await o.nav('resoudre'); await ouvrirVolets(p); await p.waitForTimeout(200);
  const c2 = p.locator('.card:has(h3:has-text("Nicolas L."))').first();
  console.log('APPEL titulaire', (await c2.locator('section.appel').innerText()).replace(/\n+/g, ' | ').slice(0, 700));
  await o.shot('r5-titulaire-volontaire', { fullPage: true });
  await c2.locator('section.appel button', { hasText: /Confier/ }).first().click(); await p.waitForTimeout(700);
  console.log('TOAST', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  d = await o.data();
  console.log('Sarah 26/11 brouillon', JSON.stringify(d.shifts.filter((s) => s.personId === 'p_sarah' && s.date === '2026-11-26').map((s) => [s.start, s.end, s.origine])), 'publié', JSON.stringify(d.semaines['2026-11-23'].snapshot.filter((s) => s.personId === 'p_sarah' && s.date === '2026-11-26').map((s) => [s.start, s.end])));
  console.log('notif Sarah', JSON.stringify(d.notifications.filter((n) => n.personId === 'p_sarah')));
  console.log('messages', JSON.stringify(d.messages.slice(2).map((m) => [m.de, m.a, m.texte])));
  console.log('trou', JSON.stringify(d.trous.filter((t) => t.shift.date === '2026-11-26').map((t) => [t.statut, t.resolution])));
  // Sarah voit-elle son nouveau poste ?
  await o.profil('Animateur'); await o.nav('moi');
  console.log('SARAH mon planning', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(0, 1200));
  await o.shot('r5-sarah-apres');
  console.log('ERR', o.errs); await o.b.close();
})();
